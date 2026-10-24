#!/usr/bin/env python3
"""Meridian Flight Control: the weather feed.

Pulls, for every station in meridian/index.html:
  METAR + TAF   aviationweather.gov Data API (JSON; raw text as a fallback)
  D-ATIS        datis.clowd.io (all airports in one call), atis.info per airport as a fallback
  NOTAMs        FAA NOTAM Search (every 3 hours; runway, taxiway, nav/ILS, aerodrome, service, IAP and apron items)
and writes  <out>/wx.json  and  <out>/notams.json.

The page reads these files from the meridian-feed branch on raw.githubusercontent.com, which serves them with
Access-Control-Allow-Origin: *, so a browser needs no proxy. A source that fails keeps its last good values
(read from the previous files in <out>), is noted in `errors`, and nothing is invented.

usage: python3 meridian/updater/fetch_wx.py --out feed [--notams]   (--notams forces a NOTAM refresh)
"""
import argparse, datetime as dt, gzip, json, os, re, sys, time, urllib.error, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
PAGE = os.path.join(HERE, '..', 'index.html')
UA = 'MeridianFlightControl/1.0 (+https://bboldt86.github.io/lanscape-navigator/meridian/)'
NOTAM_EVERY_MIN = 175
NOTAM_KEEP = 60          # per airport, after sorting by priority
NOTAM_KINDS = ['RWY', 'NAV', 'TWY', 'AD', 'IAP', 'SVC', 'APRON', 'COM']


def now():
    return dt.datetime.now(dt.timezone.utc)


def iso(t):
    return t.strftime('%Y-%m-%dT%H:%M:%SZ')


def ms(t):
    return int(t.timestamp() * 1000)


def load(p, d):
    try:
        with open(p, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return d


def fetch(url, data=None, timeout=25, accept='application/json'):
    headers = {'User-Agent': UA, 'Accept': accept, 'Accept-Encoding': 'gzip'}
    body = None
    if data is not None:
        body = urllib.parse.urlencode(data).encode()
        headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8'
    req = urllib.request.Request(url, data=body, headers=headers)
    for attempt in (1, 2, 3):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                raw = r.read()
                if r.headers.get('Content-Encoding') == 'gzip' or raw[:2] == b'\x1f\x8b':
                    raw = gzip.decompress(raw)
                return raw.decode('utf-8', 'replace')
        except urllib.error.HTTPError as ex:
            if ex.code in (429, 500, 502, 503, 504) and attempt < 3:
                time.sleep(4 * attempt)
                continue
            raise
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            if attempt < 3:
                time.sleep(4 * attempt)
                continue
            raise


def stations():
    s = open(PAGE, encoding='utf-8').read()
    m = re.search(r'const STATION_DATA=`(.*?)`', s, re.S)
    if not m:
        sys.exit('could not find STATION_DATA in meridian/index.html')
    out = []
    for ln in m.group(1).strip().splitlines():
        f = ln.split('|')
        out.append({'iata': f[0], 'icao': f[1], 'rwys': f[7], 'w': int(f[9])})
    return out


def parse_time(s):
    """AWC issue times: '2026-10-24T17:20:00.000Z', '2026-10-24 17:20:00', or epoch seconds."""
    if s is None or s == '':
        return None
    if isinstance(s, (int, float)):
        return dt.datetime.fromtimestamp(s, dt.timezone.utc)
    s = str(s).strip().replace(' ', 'T').replace('Z', '')
    s = re.sub(r'\.\d+$', '', s)
    try:
        t = dt.datetime.fromisoformat(s)
    except ValueError:
        return None
    return t if t.tzinfo else t.replace(tzinfo=dt.timezone.utc)


def ddhhmm_time(token, ref):
    """'221253Z' -> datetime near ref (handles month rollover)."""
    m = re.match(r'^(\d{2})(\d{2})(\d{2})Z$', token or '')
    if not m:
        return None
    d, h, mi = int(m.group(1)), int(m.group(2)), int(m.group(3))
    for months_back in (0, 1, -1):
        y, mo = ref.year, ref.month - months_back
        while mo < 1:
            mo += 12; y -= 1
        while mo > 12:
            mo -= 12; y += 1
        try:
            t = dt.datetime(y, mo, d, h % 24, mi, tzinfo=dt.timezone.utc)
        except ValueError:
            continue
        if t <= ref + dt.timedelta(hours=2) and t > ref - dt.timedelta(days=20):
            return t
    return None


def tidy_taf(raw):
    raw = re.sub(r'\s+', ' ', raw.strip())
    return re.sub(r'\s+(FM\d{6}|TEMPO|BECMG|PROB\d{2})', r'\n     \1', raw)


# ── METAR / TAF ────────────────────────────────────────────────────────────
def get_metars(icaos, ref):
    out = {}
    ids = ','.join(icaos)
    try:
        js = json.loads(fetch(f'https://aviationweather.gov/api/data/metar?ids={ids}&format=json&hours=3'))
        for o in js if isinstance(js, list) else []:
            icao = o.get('icaoId') or o.get('stationId')
            raw = (o.get('rawOb') or o.get('rawText') or '').strip()
            if not icao or not raw:
                continue
            t = parse_time(o.get('obsTime')) or ddhhmm_time((raw.split() + ['', ''])[1], ref)
            if not t:
                continue
            if (o.get('metarType') == 'SPECI') and not raw.startswith('SPECI'):
                raw = 'SPECI ' + raw
            if icao not in out or out[icao]['t'] < ms(t):
                out[icao] = {'raw': raw, 't': ms(t)}
        return out
    except (ValueError, json.JSONDecodeError):
        pass
    # raw-text fallback: one report per line
    txt = fetch(f'https://aviationweather.gov/api/data/metar?ids={ids}&format=raw&hours=3', accept='text/plain')
    for ln in txt.splitlines():
        ln = ln.strip()
        m = re.match(r'^(?:(METAR|SPECI)\s+)?([A-Z]{4})\s+(\d{6}Z)\b', ln)
        if not m:
            continue
        t = ddhhmm_time(m.group(3), ref)
        if t and (m.group(2) not in out or out[m.group(2)]['t'] < ms(t)):
            out[m.group(2)] = {'raw': ln, 't': ms(t)}
    return out


def get_tafs(icaos, ref):
    out = {}
    ids = ','.join(icaos)
    try:
        js = json.loads(fetch(f'https://aviationweather.gov/api/data/taf?ids={ids}&format=json'))
        for o in js if isinstance(js, list) else []:
            icao = o.get('icaoId') or o.get('stationId')
            raw = (o.get('rawTAF') or o.get('rawText') or '').strip()
            if not icao or not raw:
                continue
            t = parse_time(o.get('issueTime')) or parse_time(o.get('bulletinTime'))
            if not t:
                m = re.search(r'\b(\d{6}Z)\b', raw)
                t = ddhhmm_time(m.group(1), ref) if m else None
            if not t:
                continue
            if not raw.startswith('TAF'):
                raw = 'TAF ' + raw
            if icao not in out or out[icao]['t'] < ms(t):
                out[icao] = {'raw': tidy_taf(raw), 't': ms(t)}
        return out
    except (ValueError, json.JSONDecodeError):
        pass
    txt = fetch(f'https://aviationweather.gov/api/data/taf?ids={ids}&format=raw', accept='text/plain')
    for block in re.split(r'\n(?=TAF\s)', txt.replace('\r', '')):
        block = block.strip()
        m = re.match(r'^TAF(?:\s+(?:AMD|COR))?\s+([A-Z]{4})\s+(\d{6}Z)', block)
        if not m:
            continue
        t = ddhhmm_time(m.group(2), ref)
        if t and (m.group(1) not in out or out[m.group(1)]['t'] < ms(t)):
            out[m.group(1)] = {'raw': tidy_taf(block), 't': ms(t)}
    return out


# ── D-ATIS ────────────────────────────────────────────────────────────────
def datis_items(js):
    """clowd.io / atis.info shape: [{airport, type, code, datis}] (or {error})."""
    if isinstance(js, dict):
        js = js.get('data') or js.get('atis') or []
    return [o for o in js if isinstance(o, dict) and o.get('airport') and o.get('datis')] if isinstance(js, list) else []


def merge_datis(items, keep, out, t):
    by = {}
    for o in items:
        icao = o['airport'].upper()
        if len(icao) == 3:
            icao = 'K' + icao
        if icao not in keep:
            continue
        by.setdefault(icao, []).append(o)
    for icao, lst in by.items():
        lst.sort(key=lambda o: {'combined': 0, 'arr': 1, 'dep': 2}.get(o.get('type'), 3))
        text = '\n\n'.join(((o.get('type') or '').upper() + ': ' if o.get('type') not in (None, 'combined') else '') + o['datis'].strip() for o in lst)
        out[icao] = {'text': text, 'code': lst[0].get('code') or '', 't': t}


def get_datis(sts, t):
    keep = {s['icao'] for s in sts}
    out, errs = {}, []
    try:
        merge_datis(datis_items(json.loads(fetch('https://datis.clowd.io/api/all', timeout=30))), keep, out, t)
    except Exception as ex:
        errs.append(f'D-ATIS all: {type(ex).__name__}: {str(ex)[:90]}')
    # airports with D-ATIS that the bulk call missed: ask one at a time (bigger stations only)
    missing = [s['icao'] for s in sts if s['icao'] not in out and s['w'] >= 3 and s['icao'].startswith(('K', 'PH'))]
    for icao in missing[:45]:
        for base in ('https://datis.clowd.io/api/', 'https://atis.info/api/'):
            try:
                merge_datis(datis_items(json.loads(fetch(base + icao, timeout=12))), keep, out, t)
                if icao in out:
                    break
            except Exception:
                continue
    return out, errs


# ── NOTAMs ────────────────────────────────────────────────────────────────
def notam_kind(text):
    m = re.match(r'^!\S+\s+\S+\s+\S+\s+([A-Z]+)', text)
    k = m.group(1) if m else ''
    if text.startswith('!FDC') or ' IAP ' in text[:60]:
        return 'IAP'
    if k in NOTAM_KINDS:
        return k
    if re.search(r'\bRWY\b', text[:80]):
        return 'RWY'
    if re.search(r'\b(ILS|LOC|GP|VOR|DME|RNAV|GPS)\b', text[:120]):
        return 'NAV'
    if re.search(r'\bTWY\b', text[:80]):
        return 'TWY'
    return k or 'OTHER'


NOTAM_SEARCH = 'https://notams.aim.faa.gov/notamSearch/'
BROWSER_UA = ('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 '
              'MeridianFlightControl/1.0 (+https://bboldt86.github.io/lanscape-navigator/meridian/)')


def keep_notam(out, icao, txt, start, end):
    txt = re.sub(r'\s+', ' ', (txt or '').strip())
    if not txt:
        return
    kind = notam_kind(txt)
    if kind in NOTAM_KINDS:
        out.setdefault(icao, []).append({'text': txt, 'kind': kind, 's': start or '', 'e': end or ''})


def notams_faa_api(sts, cid, secret):
    """The FAA's official NOTAM API (free keys from api.faa.gov), used when FAA_CLIENT_ID / FAA_CLIENT_SECRET are set."""
    out, errs = {}, []
    for s in sts:
        try:
            req = urllib.request.Request(
                f'https://external-api.faa.gov/notamapi/v1/notams?icaoLocation={s["icao"]}&pageSize=1000&responseFormat=geoJson',
                headers={'client_id': cid, 'client_secret': secret, 'User-Agent': UA, 'Accept': 'application/json'})
            with urllib.request.urlopen(req, timeout=30) as r:
                js = json.loads(r.read().decode('utf-8', 'replace'))
            for it in js.get('items') or []:
                core = ((it.get('properties') or {}).get('coreNOTAMData') or {})
                n = core.get('notam') or {}
                txt = ''
                for tr in core.get('notamTranslation') or []:
                    if tr.get('type') == 'LOCAL_FORMAT' and (tr.get('simpleText') or tr.get('formattedText')):
                        txt = tr.get('simpleText') or tr.get('formattedText')
                        break
                keep_notam(out, s['icao'], txt or n.get('text'), n.get('effectiveStart'), n.get('effectiveEnd'))
            time.sleep(0.3)
        except Exception as ex:
            errs.append(f'NOTAM API {s["icao"]}: {type(ex).__name__}: {str(ex)[:80]}')
    return out, errs


def notams_search(sts):
    """FAA NOTAM Search, visited the way a browser does: load the app page (cookies), then POST searches."""
    import http.cookiejar
    jar = http.cookiejar.CookieJar()
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    base = {'User-Agent': BROWSER_UA, 'Accept-Language': 'en-US,en;q=0.9'}
    try:
        op.open(urllib.request.Request(NOTAM_SEARCH + 'nsapp.html', headers={**base, 'Accept': 'text/html,application/xhtml+xml'}), timeout=30).read()
    except Exception:
        pass
    hdr = {**base, 'Accept': 'application/json, text/javascript, */*; q=0.01', 'X-Requested-With': 'XMLHttpRequest',
           'Origin': 'https://notams.aim.faa.gov', 'Referer': NOTAM_SEARCH + 'nsapp.html',
           'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'}
    out, errs = {}, []
    icaos = [s['icao'] for s in sts]
    by_designator = {s['iata']: s['icao'] for s in sts}
    for i in range(0, len(icaos), 8):
        chunk = icaos[i:i + 8]
        offset, total, pages = 0, None, 0
        try:
            while pages < 25 and (total is None or offset < total):
                body = urllib.parse.urlencode({'searchType': '0', 'designatorsForLocation': ','.join(chunk), 'offset': str(offset),
                                               'notamsOnly': 'false', 'radius': '10'}).encode()
                with op.open(urllib.request.Request(NOTAM_SEARCH + 'search', data=body, headers=hdr), timeout=30) as r:
                    raw = r.read()
                    if raw[:2] == b'\x1f\x8b':
                        raw = gzip.decompress(raw)
                js = json.loads(raw.decode('utf-8', 'replace'))
                lst = js.get('notamList') or []
                total = int(js.get('totalNotamCount') or len(lst))
                for o in lst:
                    icao = (o.get('icaoId') or '').upper() or by_designator.get((o.get('facilityDesignator') or '').upper(), '')
                    if icao in chunk:
                        keep_notam(out, icao, o.get('traditionalMessage') or o.get('icaoMessage'), o.get('startDate'), o.get('endDate'))
                offset += len(lst) or 30
                pages += 1
                if not lst:
                    break
                time.sleep(0.5)
        except Exception as ex:
            errs.append(f'NOTAM {",".join(chunk)}: {type(ex).__name__}: {str(ex)[:90]}')
            if '403' in str(ex) and not out:
                errs.append('NOTAM Search refused this server; add FAA_CLIENT_ID / FAA_CLIENT_SECRET (api.faa.gov) to use the official API')
                break
        time.sleep(1)
    return out, errs


def notams_dins(sts):
    """FAA DINS (www.notams.faa.gov/dinsQueryWeb), the older public NOTAM query: raw domestic text inside <PRE> blocks."""
    import html as _html
    out, errs = {}, []
    by_designator = {s['iata']: s['icao'] for s in sts}
    icaos = [s['icao'] for s in sts]
    for i in range(0, len(icaos), 20):
        chunk = icaos[i:i + 20]
        url = ('https://www.notams.faa.gov/dinsQueryWeb/queryRetrievalMapAction.do?reportType=Raw&formatType=DOMESTIC'
               '&actionType=notamRetrievalByICAOs&retrieveLocId=' + '+'.join(chunk))
        try:
            req = urllib.request.Request(url, headers={'User-Agent': BROWSER_UA, 'Accept': 'text/html'})
            with urllib.request.urlopen(req, timeout=40) as r:
                page = r.read().decode('utf-8', 'replace')
            pres = re.findall(r'<PRE>(.*?)</PRE>', page, re.S | re.I)
            if not pres:
                raise ValueError('no NOTAM blocks in the reply')
            for pre in pres:
                txt = re.sub(r'\s+', ' ', _html.unescape(re.sub(r'<[^>]+>', '', pre))).strip()
                m = re.match(r'^!([A-Z0-9]{3,4})\s', txt)
                if not m:
                    continue
                loc = m.group(1)
                icao = loc if loc in chunk else by_designator.get(loc) or ('K' + loc if 'K' + loc in chunk else '')
                if not icao and loc == 'FDC':
                    m2 = re.match(r'^!FDC\s+\S+\s+([A-Z0-9]{3,4})\s', txt)
                    icao = by_designator.get(m2.group(1), '') if m2 else ''
                if icao in chunk:
                    keep_notam(out, icao, txt, '', '')
        except Exception as ex:
            errs.append(f'DINS {chunk[0]}…: {type(ex).__name__}: {str(ex)[:90]}')
        time.sleep(1.5)
    return out, errs


def get_notams(sts):
    cid, secret = os.environ.get('FAA_CLIENT_ID', '').strip(), os.environ.get('FAA_CLIENT_SECRET', '').strip()
    if cid and secret:
        out, errs = notams_faa_api(sts, cid, secret)
    else:
        out, errs = notams_search(sts)
        if not out:
            out, e2 = notams_dins(sts)
            errs = (errs if not out else []) + e2
    pri = {k: n for n, k in enumerate(NOTAM_KINDS)}
    for icao in out:
        seen, keep = set(), []
        for n in sorted(out[icao], key=lambda x: pri.get(x['kind'], 99)):
            if n['text'] in seen:
                continue
            seen.add(n['text'])
            keep.append(n)
        out[icao] = keep[:NOTAM_KEEP]
    return out, errs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='feed')
    ap.add_argument('--notams', action='store_true', help='refresh NOTAMs even if the last pull is recent')
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    t0 = now()
    sts = stations()
    icaos = [s['icao'] for s in sts]
    old = load(os.path.join(a.out, 'wx.json'), {})
    old_n = load(os.path.join(a.out, 'notams.json'), {})
    errors, ok = [], {}

    metar = dict(old.get('metar') or {})
    try:
        got = get_metars(icaos, t0)
        metar.update(got)
        ok['metar'] = len(got)
        print(f'METAR: {len(got)}/{len(icaos)}')
    except Exception as ex:
        errors.append(f'METAR: {type(ex).__name__}: {str(ex)[:120]}')

    taf = dict(old.get('taf') or {})
    try:
        got = get_tafs(icaos, t0)
        taf.update(got)
        ok['taf'] = len(got)
        print(f'TAF: {len(got)}/{len(icaos)}')
    except Exception as ex:
        errors.append(f'TAF: {type(ex).__name__}: {str(ex)[:120]}')

    datis = dict(old.get('datis') or {})
    try:
        got, errs = get_datis(sts, ms(t0))
        errors += errs
        # a D-ATIS older than 3 hours is dropped rather than shown as current
        datis = {k: v for k, v in datis.items() if ms(t0) - v.get('t', 0) < 3 * 3600 * 1000}
        datis.update(got)
        ok['datis'] = len(got)
        print(f'D-ATIS: {len(got)}')
    except Exception as ex:
        errors.append(f'D-ATIS: {type(ex).__name__}: {str(ex)[:120]}')

    notams_at = old_n.get('generated')
    due = a.notams or not notams_at or (t0 - (parse_time(notams_at) or t0 - dt.timedelta(days=1))).total_seconds() / 60 > NOTAM_EVERY_MIN
    if due:
        try:
            got, errs = get_notams(sts)
            errors += errs
            if got:
                merged = dict(old_n.get('notams') or {})
                merged.update(got)
                with open(os.path.join(a.out, 'notams.json'), 'w', encoding='utf-8') as f:
                    json.dump({'v': 1, 'generated': iso(now()), 'source': 'FAA NOTAM Search (notams.aim.faa.gov)',
                               'kinds': NOTAM_KINDS, 'notams': merged}, f, separators=(',', ':'))
                notams_at = iso(now())
                ok['notams'] = sum(len(v) for v in got.values())
                print(f'NOTAMs: {ok["notams"]} kept across {len(got)} airports')
        except Exception as ex:
            errors.append(f'NOTAMs: {type(ex).__name__}: {str(ex)[:120]}')
    else:
        print('NOTAMs: not due')

    # drop reports that are too old to be useful as "current"
    cut_m, cut_t = ms(t0) - 6 * 3600 * 1000, ms(t0) - 36 * 3600 * 1000
    metar = {k: v for k, v in metar.items() if k in icaos and v['t'] >= cut_m}
    taf = {k: v for k, v in taf.items() if k in icaos and v['t'] >= cut_t}

    doc = {
        'v': 1, 'generated': iso(now()), 'every': '30 min (GitHub Actions, :08 and :38 UTC)',
        'sources': {'metar': 'aviationweather.gov', 'taf': 'aviationweather.gov', 'datis': 'datis.clowd.io / atis.info',
                    'notams': 'FAA NOTAM Search'},
        'fresh': ok, 'notamsAt': notams_at, 'errors': errors[:30],
        'metar': dict(sorted(metar.items())), 'taf': dict(sorted(taf.items())), 'datis': dict(sorted(datis.items())),
    }
    with open(os.path.join(a.out, 'wx.json'), 'w', encoding='utf-8') as f:
        json.dump(doc, f, separators=(',', ':'))
    for e in errors:
        print('  error:', e)
    print(f'wrote {a.out}/wx.json · {len(metar)} METAR · {len(taf)} TAF · {len(datis)} D-ATIS · {(now() - t0).total_seconds():.1f}s')
    if not metar and not taf:
        sys.exit(1)


if __name__ == '__main__':
    main()
