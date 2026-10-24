#!/usr/bin/env python3
"""Make brazil2026/data/geo.json (simplified SVG paths for the 26 states + DF) from the public states GeoJSON.

Source (not versioned, ~3.4 MB): https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson
Usage: python3 brazil2026/work/make_geo.py /path/to/brazil-states.geojson

Projection: plate carrée scaled by cos(14.5°S) (good enough for a choropleth), simplified with Douglas-Peucker,
tiny islands dropped. Output: {viewBox, paths: {UF: 'M…Z'}, labels: {UF: [x, y]}}.
"""
import json, math, sys, os
sys.setrecursionlimit(20000)

src = sys.argv[1]
g = json.load(open(src, encoding='utf-8'))
LAT0 = math.cos(math.radians(-14.5)); TOL = 0.035; MIN_RING = 0.08  # degrees², drop rings smaller than this
W = 720.0

def dp(pts, tol):
    if len(pts) < 3: return pts
    ax, ay = pts[0]; bx, by = pts[-1]; dx, dy = bx - ax, by - ay; L = math.hypot(dx, dy) or 1e-12
    imax, dmax = 0, 0.0
    for i in range(1, len(pts) - 1):
        px, py = pts[i]; d = abs(dy * px - dx * py + bx * ay - by * ax) / L
        if d > dmax: imax, dmax = i, d
    if dmax > tol: return dp(pts[:imax + 1], tol)[:-1] + dp(pts[imax:], tol)
    return [pts[0], pts[-1]]

def area(r):
    return 0.5 * abs(sum(r[i][0] * r[(i + 1) % len(r)][1] - r[(i + 1) % len(r)][0] * r[i][1] for i in range(len(r))))

feats = {}
for f in g['features']:
    uf = f['properties']['sigla']; geom = f['geometry']
    polys = geom['coordinates'] if geom['type'] == 'MultiPolygon' else [geom['coordinates']]
    rings = []
    for poly in polys:
        outer = poly[0]
        if area(outer) < MIN_RING: continue
        for ring in poly[:1]:  # outer rings only (no state has a meaningful hole except DF inside GO, handled by draw order)
            pts = [(x * LAT0, -y) for x, y in ring]
            if pts[0] == pts[-1]: pts = pts[:-1]
            # a closed ring has a zero-length baseline: split it at the point farthest from the start and simplify the halves
            k = max(range(len(pts)), key=lambda i: (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2)
            pts = dp(pts[:k + 1], TOL * LAT0)[:-1] + dp(pts[k:] + [pts[0]], TOL * LAT0)[:-1]
            if len(pts) >= 4: rings.append((pts, area(ring)))
    feats[uf] = rings

xs = [p[0] for r in feats.values() for ring, _ in r for p in ring]; ys = [p[1] for r in feats.values() for ring, _ in r for p in ring]
x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys); s = W / (x1 - x0); H = (y1 - y0) * s
def P(p): return (round((p[0] - x0) * s, 1), round((p[1] - y0) * s, 1))
paths, labels = {}, {}
order = sorted(feats, key=lambda u: -sum(a for _, a in feats[u]))  # big states first so DF (inside GO) draws on top
for uf in order:
    d = []
    for ring, _ in feats[uf]:
        pts = [P(p) for p in ring]
        d.append('M' + ' '.join(f'{x},{y}' for x, y in pts) + 'Z')
    paths[uf] = ''.join(d)
    big = max(feats[uf], key=lambda r: r[1])[0]
    cx = sum(p[0] for p in big) / len(big); cy = sum(p[1] for p in big) / len(big)
    labels[uf] = list(P((cx, cy)))
out = {'viewBox': f'0 0 {round(W)} {round(H)}', 'order': order, 'paths': paths, 'labels': labels,
       'source': 'codeforamerica/click_that_hood brazil-states.geojson, simplified by brazil2026/work/make_geo.py'}
dst = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'geo.json')
json.dump(out, open(dst, 'w'), separators=(',', ':'))
print(f'{len(paths)} units, {sum(len(v) for v in paths.values()) // 1024} KB of paths -> {os.path.relpath(dst)}')
