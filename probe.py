#!/usr/bin/env python3
"""Scratch probe: which User-Agent does Substack let through from a GitHub runner?"""
import json, urllib.request, urllib.error
UAS = {'chrome': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 TheWatch/1.0',
       'reader': 'TheWatch/1.0 (+https://bboldt86.github.io/lanscape-navigator/news/; feed reader)',
       'feedly': 'Feedly/1.0 (+http://www.feedly.com/fetcher.html; 1 subscribers)',
       'plain': 'Mozilla/5.0', 'curl': 'curl/8.5.0', 'none': ''}
URLS = ['https://heathercoxrichardson.substack.com/feed', 'https://www.astralcodexten.com/feed', 'https://www.lennysnewsletter.com/feed', 'https://api.substack.com/feed/podcast/10845.rss']
out = {}
for u in URLS:
    for k, ua in UAS.items():
        try:
            req = urllib.request.Request(u, headers={'User-Agent': ua, 'Accept': 'application/rss+xml, application/xml;q=0.9, */*;q=0.8'} if ua else {'Accept': '*/*'})
            with urllib.request.urlopen(req, timeout=20) as r:
                out[f'{u} [{k}]'] = {'status': r.status, 'bytes': len(r.read(200000))}
        except urllib.error.HTTPError as ex:
            out[f'{u} [{k}]'] = {'status': ex.code, 'server': ex.headers.get('server'), 'cf': ex.headers.get('cf-mitigated')}
        except Exception as ex:  # noqa: BLE001
            out[f'{u} [{k}]'] = {'error': f'{type(ex).__name__}: {str(ex)[:100]}'}
        print(k, u, out[f'{u} [{k}]'])
json.dump(out, open('probe-results.json', 'w'), indent=1)
