#!/usr/bin/env python3
"""Three waves: the county frames for the era player (eraswave.js) and the national scoreboard.

  python3 news/eras/tools/build.py extract <us_county_results_summary.csv>   # once: slim Heideman's file into data/src/
  python3 news/eras/tools/build.py                                            # write data/era1.json, era2.json, era3.json

Each frame is one election. A county's margin is (D - R) / all votes, in points. Its move is that margin minus the same
county's margin in the previous presidential election - the homepage wave's definition (2026 vs 2024), applied to every
election in the era. Presidential years use the presidential vote; midterms use the county's U.S. Senate race where both
parties ran, else its House vote where every district in it was contested by both parties.

Sources: 2000-2024, Paul Heideman, U.S. county-level election results 1990-2024 (v1.0.0, CC BY 4.0,
doi:10.5281/zenodo.22976553); 2026, The Watch's own count (news/wave/data/shift.json, AP via The New York Times);
1920-1932, the county tables on Wikipedia's state pages, read by tools/fetch_wiki.py (data/wiki/)."""
import csv, glob, gzip, json, os, re, sys, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
DATA = os.path.join(HERE, '..', 'data')
SRC = os.path.join(DATA, 'src', 'heideman_2000_2024.csv.gz')

ERAS = {
    'era1': {'name': '1924–1932', 'frames': [(1924, 'P', 1920), (1926, 'M', None), (1928, 'P', 1924), (1930, 'M', None), (1932, 'P', 1928)]},
    'era2': {'name': '2004–2012', 'frames': [(2004, 'P', 2000), (2006, 'M', 2004), (2008, 'P', 2004), (2010, 'M', 2008), (2012, 'P', 2008)]},
    'era3': {'name': '2016–2026', 'frames': [(2016, 'P', 2012), (2018, 'M', 2016), (2020, 'P', 2016), (2022, 'M', 2020), (2024, 'P', 2020), (2026, 'M', 2024)]},
}
# candidates in the county tables (Democrat, Republican)
CANDS = {1920: ('Cox', 'Harding'), 1924: ('Davis', 'Coolidge'), 1928: ('Smith', 'Hoover'), 1932: ('Roosevelt', 'Hoover')}


def extract(path):
    os.makedirs(os.path.dirname(SRC), exist_ok=True)
    n = 0
    with open(path, newline='') as f, gzip.open(SRC, 'wt', newline='') as g:
        w = csv.writer(g); w.writerow(['year', 'office', 'fips', 'dem', 'rep', 'total', 'flag'])
        for r in csv.DictReader(f):
            if int(r['year']) < 2000 or r['status'] != 'covered': continue
            w.writerow([r['year'], r['office'][0].upper(), r['county_fips'], r['dem_votes'], r['rep_votes'], r['total_votes'], r['quality_flag']]); n += 1
    print('wrote', SRC, n, 'rows')


def margin(d, r, t): return round((d - r) / t * 100, 2) if t else None


def modern():
    """{year: {'P'|'S'|'H': {fips: (d, r, t, flag)}}}"""
    out = {}
    with gzip.open(SRC, 'rt', newline='') as f:
        for r in csv.DictReader(f):
            out.setdefault(int(r['year']), {}).setdefault(r['office'], {})[r['fips']] = (round(float(r['dem'] or 0)), round(float(r['rep'] or 0)), round(float(r['total'] or 0)), r['flag'])
    return out


def norm(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    s = re.sub(r'\[.*?\]|\(.*?\)', ' ', s)
    s = s.replace('saint ', 'st ').replace('st. ', 'st ').replace('ste. ', 'ste ')
    s = re.sub(r'\b(county|parish|borough|census area|city and borough)\b', ' ', s)
    return re.sub(r'[^a-z]', '', s)


def num(x):
    x = re.sub(r'[^\d]', '', x or '')
    return int(x) if x else None


def geo_names():
    g = json.load(open(os.path.join(ROOT, 'election2026', 'data', 'geo.json')))
    by = {}
    for c in g['objects']['counties']['geometries']:
        by.setdefault(c['id'][:2], []).append((c['id'], c.get('n', '')))
    return by


ST2FIPS = {'AL': '01', 'AZ': '04', 'AR': '05', 'CA': '06', 'CO': '08', 'CT': '09', 'DE': '10', 'FL': '12', 'GA': '13', 'ID': '16', 'IL': '17', 'IN': '18', 'IA': '19', 'KS': '20', 'KY': '21', 'LA': '22', 'ME': '23', 'MD': '24', 'MA': '25', 'MI': '26', 'MN': '27', 'MS': '28', 'MO': '29', 'MT': '30', 'NE': '31', 'NV': '32', 'NH': '33', 'NJ': '34', 'NM': '35', 'NY': '36', 'NC': '37', 'ND': '38', 'OH': '39', 'OK': '40', 'OR': '41', 'PA': '42', 'RI': '44', 'SC': '45', 'SD': '46', 'TN': '47', 'TX': '48', 'UT': '49', 'VT': '50', 'VA': '51', 'WA': '53', 'WV': '54', 'WI': '55', 'WY': '56'}


def wiki_year(year, names, report):
    """{fips: (d, r, t)} from data/wiki/<year>-<ST>.json"""
    dn, rn = CANDS[year]; out = {}
    for path in sorted(glob.glob(os.path.join(DATA, 'wiki', f'{year}-*.json'))):
        st = path[-7:-5]; sf = ST2FIPS.get(st)
        if not sf: continue
        d = json.load(open(path))
        if d.get('error'): report.append(f'{year} {st}: {d["error"]}'); continue
        head = d['header'] or [[]]; ncol = max(len(r) for r in head + d['rows'][:5])
        lab = [' '.join((h[i] if i < len(h) else '') for h in head).lower() for i in range(ncol)]
        def col(name):
            idx = [i for i, l in enumerate(lab) if name.lower() in l]
            if not idx: return None
            for i in idx:  # the votes column: '#' / 'votes', else the first of the group
                sub = (head[-1][i] if i < len(head[-1]) else '').strip().lower()
                if sub in ('#', 'votes', 'no.', 'vote') or sub.startswith('#'): return i
            return idx[0]
        di, ri = col(dn), col(rn)
        ti = next((i for i, l in enumerate(lab) if 'total' in l), None)
        if di is None or ri is None or di == ri: report.append(f'{year} {st}: columns not found ({dn}/{rn}) in {lab[:12]}'); continue
        votecols = [i for i, l in enumerate(lab) if i and ((head[-1][i] if i < len(head[-1]) else '').strip().lower() in ('#', 'votes', 'no.')) and 'margin' not in l and 'total' not in l]
        index = {}
        for fips, n in names.get(sf, []): index.setdefault(norm(n), fips)
        hit = miss = 0
        for row in d['rows']:
            if not row or len(row) <= max(di, ri): continue
            name = row[0]
            if re.search(r'^\s*(totals?|state total|statewide)\b', name, re.I): continue
            dv, rv = num(row[di]), num(row[ri])
            if dv is None or rv is None: continue
            tv = num(row[ti]) if ti is not None and ti < len(row) else None
            if not tv: tv = sum(num(row[i]) or 0 for i in votecols if i < len(row)) or (dv + rv)
            if tv < dv + rv: tv = dv + rv
            key = norm(name)
            if st == 'VA' and re.search(r'\bcity\b', name, re.I):  # independent cities: match the geo name ending in 'city' first
                fips = next((f for f, n in names.get(sf, []) if norm(n) == key and f[2] >= '5'), None) or index.get(key)
            else:
                fips = index.get(key)
            if not fips: miss += 1; report.append(f'{year} {st}: no county for "{name}"'); continue
            a = out.get(fips, (0, 0, 0)); out[fips] = (a[0] + dv, a[1] + rv, a[2] + tv); hit += 1
        report.append(f'{year} {st}: {hit} counties ({miss} unmatched)')
    return out


def shift2026():
    s = json.load(open(os.path.join(ROOT, 'news', 'wave', 'data', 'shift.json')))
    out = {}
    for f, row in s['counties'].items():  # [m24, m26, move, eevp, race, d, r, t, d24, r24, t24]
        out[f] = (row[5], row[6], row[7], row[4])
    return out, s.get('asOf')


# The national scoreboard. House: popular-vote margin (1924-1932 from each year's Wikipedia results; 2004-2024 Brookings
# Vital Statistics Table 2-2; 2026 unofficial, Popular Vote Analytics) and seats; president: electoral and popular vote
# (checked against the Wikipedia infoboxes in data/wiki/infobox.json when present); governors after each election from the
# gubernatorial-elections infoboxes.
HOUSE = {1924: (-15.8, 183, 247, 5), 1926: (-17.0, 194, 238, 3), 1928: (-14.8, 164, 270, 1), 1930: (-8.5, 216, 218, 1), 1932: (12.4, 313, 117, 5),
         2004: (-2.6, 202, 232, 1), 2006: (6.4, 233, 202, 0), 2008: (10.6, 257, 178, 0), 2010: (-6.6, 193, 242, 0), 2012: (1.4, 201, 234, 0),
         2016: (-0.9, 194, 241, 0), 2018: (8.7, 235, 199, 0), 2020: (3.0, 222, 213, 0), 2022: (-2.6, 213, 222, 0), 2024: (-2.5, 215, 220, 0), 2026: (13.2, 254, 162, 0)}
HOUSE_OPEN = {2026: 19}
PRES = {  # (D, R, EV D, EV R, EV other, PV D %, PV R %)
    1920: ('Cox', 'Harding', 127, 404, 0, 34.15, 60.32), 1924: ('Davis', 'Coolidge', 136, 382, 13, 28.82, 54.04), 1928: ('Smith', 'Hoover', 87, 444, 0, 40.80, 58.21),
    1932: ('Roosevelt', 'Hoover', 472, 59, 0, 57.41, 39.65), 2004: ('Kerry', 'Bush', 251, 286, 1, 48.27, 50.73), 2008: ('Obama', 'McCain', 365, 173, 0, 52.93, 45.65),
    2012: ('Obama', 'Romney', 332, 206, 0, 51.06, 47.20), 2016: ('Clinton', 'Trump', 227, 304, 7, 48.18, 46.09), 2020: ('Biden', 'Trump', 306, 232, 0, 51.31, 46.85),
    2024: ('Harris', 'Trump', 226, 312, 0, 48.32, 49.81)}
GOV = {}  # filled from the infoboxes


def infobox_fields(text):
    f = {}
    for m in re.finditer(r'^\s*\|\s*([a-z_0-9]+)\s*=\s*(.*?)\s*$', text, re.M): f[m.group(1)] = re.sub(r'<.*?>|\{\{.*?\}\}|\[\[(?:[^|\]]*\|)?([^\]]*)\]\]', lambda x: x.group(1) or '', m.group(2)).strip()
    return f


def national(report):
    ib = {}
    p = os.path.join(DATA, 'wiki', 'infobox.json')
    if os.path.exists(p): ib = json.load(open(p))
    gov = {}
    for page, d in ib.items():
        m = re.match(r'(\d{4}) United States (presidential|gubernatorial)', page)
        if not m or not d.get('infobox'): continue
        y, kind = int(m.group(1)), m.group(2); f = infobox_fields(d['infobox'])
        if kind == 'gubernatorial':
            cnt = {}
            for k in range(1, 5):
                party = f.get(f'party{k}', ''); after = num(f.get(f'seats_after{k}', '') or f.get(f'seats_after{k}', ''))
                if not party or after is None: continue
                key = 'd' if 'democr' in party.lower() else 'r' if 'republic' in party.lower() else 'o'
                cnt[key] = cnt.get(key, 0) + after
            if cnt: gov[y] = cnt
            else: report.append(f'governors {y}: no seats_after in infobox')
        else:
            ev = [num(f.get(f'electoral_vote{k}', '')) for k in (1, 2, 3)]
            if y in PRES and ev[0]:
                d0 = PRES[y]; mine = sorted([d0[2], d0[3]], reverse=True)
                if sorted([e for e in ev[:2] if e], reverse=True) != mine: report.append(f'PRES {y}: infobox EV {ev} vs table {mine}')
    out = {}
    for y in sorted(set(HOUSE) | set(PRES) | set(gov)):
        n = {}
        if y in HOUSE: h = HOUSE[y]; n['house'] = {'m': h[0], 'd': h[1], 'r': h[2], 'o': h[3], 'open': HOUSE_OPEN.get(y, 0)}
        if y in PRES:
            p = PRES[y]; n['pres'] = {'d': p[0], 'r': p[1], 'ev_d': p[2], 'ev_r': p[3], 'ev_o': p[4], 'pv_d': p[5], 'pv_r': p[6], 'pv_margin': round(p[5] - p[6], 1)}
        g = gov.get(y) or GOV.get(y)
        if g: n['gov'] = {'d': g.get('d', 0), 'r': g.get('r', 0), 'o': g.get('o', 0)}
        out[y] = n
    json.dump(out, open(os.path.join(DATA, 'national.json'), 'w'), indent=0)
    return out


def main():
    if len(sys.argv) > 2 and sys.argv[1] == 'extract': return extract(sys.argv[2])
    names = geo_names(); report = []
    M = modern() if os.path.exists(SRC) else {}
    pres = {y: {f: v[:3] for f, v in M.get(y, {}).get('P', {}).items()} for y in range(2000, 2025, 4)}
    for y in CANDS:
        if glob.glob(os.path.join(DATA, 'wiki', f'{y}-*.json')): pres[y] = wiki_year(y, names, report)
    s26, asof = shift2026()
    for key, era in ERAS.items():
        frames = []
        for y, kind, base in era['frames']:
            fr = {'y': y, 'kind': kind, 'base': base, 'c': {}}
            if kind == 'P':
                if y not in pres or not pres[y]: fr['missing'] = True
                for f, (d, r, t) in pres.get(y, {}).items():
                    if not t: continue
                    m = margin(d, r, t); b = pres.get(base, {}).get(f)
                    mv = round(m - margin(*b), 2) if b and b[2] else None
                    fr['c'][f] = [m, mv, t, 'P']
            elif y == 2026:
                for f, (d, r, t, race) in s26.items():
                    if not t: continue
                    m = margin(d, r, t); b = pres.get(2024, {}).get(f)
                    fr['c'][f] = [m, round(m - margin(*b), 2) if b and b[2] else None, t, race]
                fr['asOf'] = asof
            elif y in M:
                sen, hou = M[y].get('S', {}), M[y].get('H', {})
                for f in set(sen) | set(hou):
                    v, race = sen.get(f), 'S'
                    if not v or not v[0] or not v[1]:
                        v, race = hou.get(f), 'H'
                        if not v or not v[0] or not v[1] or 'one_party_race' in v[3] or 'excludes_unopposed' in v[3]: continue
                    d, r, t = v[:3]
                    if not t: continue
                    m = margin(d, r, t); b = pres.get(base, {}).get(f)
                    fr['c'][f] = [m, round(m - margin(*b), 2) if b and b[2] else None, t, race]
            else:
                fr['missing'] = True
            mv = [v[1] for v in fr['c'].values() if v[1] is not None]
            fr['left'] = sum(1 for x in mv if x > 0); fr['right'] = sum(1 for x in mv if x < 0); fr['counted'] = len(mv)
            fr['n'] = len(fr['c'])
            races = {}
            for v in fr['c'].values(): races[v[3]] = races.get(v[3], 0) + 1
            fr['races'] = races
            frames.append(fr)
        json.dump({'v': 1, 'era': key, 'name': era['name'], 'frames': frames}, open(os.path.join(DATA, key + '.json'), 'w'), separators=(',', ':'))
        print(key, [(f['y'], f['n'], f['left'], f['right']) for f in frames])
    national(report)
    open(os.path.join(DATA, 'build_report.txt'), 'w').write('\n'.join(report) + '\n')
    print(len([r for r in report if 'no county' in r]), 'unmatched county rows;', len([r for r in report if 'not found' in r or 'error' in r.lower()]), 'state problems')


if __name__ == '__main__':
    main()
