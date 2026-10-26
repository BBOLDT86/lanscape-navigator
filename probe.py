#!/usr/bin/env python3
"""Scratch probe: can GitHub's runners reach the keyless services Discover needs, and do they allow browsers (CORS)?"""
import json, urllib.request, urllib.error, time
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 TheWatch/1.0'
URLS = [
 ('apple-chart-podcasts', 'https://rss.marketingtools.apple.com/api/v2/us/podcasts/top/10/podcasts.json'),
 ('apple-chart-books', 'https://rss.marketingtools.apple.com/api/v2/us/books/top-paid/10/books.json'),
 ('apple-chart-albums', 'https://rss.marketingtools.apple.com/api/v2/us/music/most-played/10/albums.json'),
 ('itunes-lookup', 'https://itunes.apple.com/lookup?id=1200361736,1528594034&entity=podcast&country=us'),
 ('itunes-lookup-episodes', 'https://itunes.apple.com/lookup?id=1528594034&entity=podcastEpisode&limit=3&country=us'),
 ('itunes-search-podcast', 'https://itunes.apple.com/search?term=hard+fork&media=podcast&limit=2&country=us'),
 ('itunes-search-movie', 'https://itunes.apple.com/search?term=oppenheimer&media=movie&limit=2&country=us'),
 ('itunes-search-tv', 'https://itunes.apple.com/search?term=severance&media=tvShow&limit=2&country=us'),
 ('openlibrary-search', 'https://openlibrary.org/search.json?q=the+hobbit&limit=2&fields=key,title,author_name,cover_i,first_publish_year'),
 ('openlibrary-trending', 'https://openlibrary.org/trending/daily.json?limit=5'),
 ('openlibrary-cover', 'https://covers.openlibrary.org/b/id/8739161-M.jpg'),
 ('gutendex', 'https://gutendex.com/books/?sort=popular&languages=en'),
 ('wikipedia-summary', 'https://en.wikipedia.org/api/rest_v1/page/summary/Severance_(TV_series)'),
 ('wikipedia-search', 'https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=severance+tv+series&format=json&origin=*'),
 ('simplecast-feed', 'https://feeds.simplecast.com/54nAGcIl'),
 ('newyorker-feed', 'https://www.newyorker.com/feed/everything'),
 ('substack-feed', 'https://heathercoxrichardson.substack.com/feed'),
 ('youtube-feed', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCBJycsmduvYEL83R_U4JriQ'),
 ('podcastindex-public', 'https://podcastindex.org/'),
 ('mediastack-none', 'https://www.listennotes.com/'),
]
out = {}
for key, u in URLS:
    t = time.time()
    try:
        req = urllib.request.Request(u, headers={'User-Agent': UA, 'Accept': '*/*', 'Origin': 'https://bboldt86.github.io'})
        with urllib.request.urlopen(req, timeout=20) as r:
            body = r.read(400000)
            out[key] = {'status': r.status, 'bytes': len(body), 'ms': int((time.time() - t) * 1000),
                        'cors': r.headers.get('Access-Control-Allow-Origin'), 'type': r.headers.get('Content-Type'),
                        'head': body[:300].decode('utf-8', 'replace')}
    except urllib.error.HTTPError as ex:
        out[key] = {'status': ex.code, 'error': str(ex)[:200], 'cors': ex.headers.get('Access-Control-Allow-Origin') if ex.headers else None}
    except Exception as ex:  # noqa: BLE001
        out[key] = {'error': f'{type(ex).__name__}: {str(ex)[:200]}'}
    print(key, out[key].get('status'), out[key].get('cors'), out[key].get('error', ''))
json.dump(out, open('probe-results.json', 'w'), indent=1)
