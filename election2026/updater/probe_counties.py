#!/usr/bin/env python3
"""Probe public county-level results endpoints from a GitHub Actions runner (the sandbox can't reach them).
Prints status, type, size, JSON keys or discovered data URLs for each candidate. Scratch tool; not run by the site."""
import json, re, sys, urllib.request, urllib.error, gzip, io

UA = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
      'Accept': 'application/json, text/html;q=0.9, */*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9', 'Accept-Encoding': 'gzip'}

CANDS = [l.strip() for l in open(sys.argv[1]) if l.strip() and not l.startswith('#')] if len(sys.argv) > 1 else []

def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=25) as r:
        raw = r.read(6_000_000)
        if r.headers.get('Content-Encoding') == 'gzip':
            raw = gzip.GzipFile(fileobj=io.BytesIO(raw)).read()
        return r.status, r.headers.get('Content-Type', ''), raw

def walk(o, depth=0, path='$', out=None):
    """print the shape of a JSON document: keys and list lengths, a few levels deep"""
    if out is None: out = []
    if len(out) > 60: return out
    if isinstance(o, dict):
        out.append(f"{'  '*depth}{path}: dict keys={list(o.keys())[:25]}")
        for k in list(o.keys())[:6]:
            walk(o[k], depth+1, k, out)
    elif isinstance(o, list):
        out.append(f"{'  '*depth}{path}: list len={len(o)}")
        if o: walk(o[0], depth+1, '[0]', out)
    else:
        out.append(f"{'  '*depth}{path}: {str(o)[:80]!r}")
    return out

for url in CANDS:
    print('=' * 100); print('URL', url)
    try:
        st, ct, raw = get(url)
    except urllib.error.HTTPError as e:
        print('HTTP', e.code, e.reason); continue
    except Exception as e:
        print('ERR', type(e).__name__, str(e)[:200]); continue
    print('status', st, 'type', ct, 'bytes', len(raw))
    txt = raw.decode('utf-8', 'replace')
    if 'json' in ct or txt.lstrip()[:1] in '{[':
        try:
            o = json.loads(txt)
            print('\n'.join(walk(o)))
            s = json.dumps(o)
            for kw in ('county', 'fips', 'reportingUnit', 'reporting_unit', 'precincts', 'votes'):
                i = s.find(kw)
                if i >= 0: print(f'  ...{kw}@{i}: {s[max(0,i-200):i+300]!r}')
        except Exception as e:
            print('json parse failed', e); print(txt[:600])
    else:
        print('head:', txt[:300].replace('\n', ' '))
        urls = sorted(set(re.findall(r'https?://[^"\'\s<>\\]+?\.json[^"\'\s<>\\]*', txt)))
        urls += sorted(set(u for u in re.findall(r'https?://[^"\'\s<>\\]+', txt) if re.search(r'(elections?-assets|live-data|interactives\.ap|election-data|/api/election|results[-_]?data|decisiondesk|ddhq|/elections/)', u)))
        seen = set()
        for u in urls:
            if u in seen: continue
            seen.add(u); print('  link:', u[:220])
            if len(seen) > 80: break
        for kw in ('county', 'counties', 'fips'):
            print(f'  count {kw!r}:', txt.lower().count(kw))
        for m in list(re.finditer(r'[A-Za-z_]*(?:data|api)[A-Za-z_]*["\']?\s*[:=]\s*["\']([^"\']{10,200})["\']', txt))[:15]:
            print('  cfg:', m.group(0)[:220])
