#!/usr/bin/env python3
"""The Watch · The quiet sky (news/airspace/): every tracked aircraft over the United States during the nationwide
ground stop of Nov. 13, 2026, minute by minute.

Runs on GitHub Actions (the sandbox can't reach GitHub's release downloads; the runner can). Reads ADSB.lol's open
daily archive (github.com/adsblol/globe_history_2026, Open Database License): one release per UTC day, a tar split
in two parts. Only the `heatmap/NN.bin.ttf` files are used: 48 half-hour files, each a run of time slices (about one
every 30 s) listing every aircraft the network heard: ICAO address, position, barometric altitude, ground speed.
The format is readsb's (the same files drive adsb.lol's replay); see parse_heatmap().

Writes news/airspace/data/
  tracks.bin.gz   every airborne track in the frame, one sample a minute (format: encode())
  meta.json       the clock, per-minute counts (the day and the same hours a week earlier), the facts the page prints
  fetch_log.json  what was downloaded and read, for debugging from a session that can't see the Actions log

Usage: fetch.py [--mock]      (the request is news/airspace/fetch.json)
"""
import gzip, io, json, math, os, re, struct, subprocess, sys, tarfile, time, traceback, urllib.request
from datetime import datetime, timedelta, timezone
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..'))
DATA = os.path.join(ROOT, 'data')
sys.path.insert(0, HERE)
from proj import project  # noqa: E402

MAGIC = 0x0e7f7c9d
REPO = 'adsblol/globe_history_2026'
LOG = {'started': datetime.now(timezone.utc).isoformat(timespec='seconds'), 'days': {}, 'notes': []}
XMIN, XMAX, YMIN, YMAX = -70.0, 1045.0, -45.0, 655.0  # the frame kept, in map units (the map is 975 x 610)
Q = 16  # positions are stored in 1/16 of a map unit (about 290 m)


def note(*a):
    s = ' '.join(str(x) for x in a)
    print(s, flush=True)
    LOG['notes'].append(s)


# ---------------------------------------------------------------- download
def release_urls(day):
    """The two (or more) parts of a day's tar, from the archive's own list of preferred releases."""
    tag = 'v' + day.replace('-', '.')
    for name in ('PREFERRED_RELEASES.txt', 'ALL_RELEASES.txt'):
        try:
            txt = urllib.request.urlopen(f'https://raw.githubusercontent.com/{REPO}/main/{name}', timeout=60).read().decode()
        except Exception as e:  # noqa: BLE001
            note('could not read', name, repr(e))
            continue
        lines = [l for l in txt.splitlines() if tag in l and 'mlatonly' not in l]
        lines.sort(key=lambda l: 0 if 'prod' in l else 1)
        if lines:
            return [u for u in lines[0].split(',') if u.strip()]
    base = f'https://github.com/{REPO}/releases/download/{tag}-planes-readsb-prod-0/{tag}-planes-readsb-prod-0.tar'
    return [base + '.aa', base + '.ab']


def read_heatmaps(day, want):
    """Stream a day's tar and return {half-hour index: raw file bytes} for the indexes wanted."""
    urls = release_urls(day)
    d = LOG['days'].setdefault(day, {})
    d['urls'] = urls
    t0 = time.time()
    p = subprocess.Popen(['curl', '-sSL', '--fail', '--retry', '3', '--retry-delay', '5'] + urls, stdout=subprocess.PIPE, bufsize=1 << 22)
    out, names, dirs, n = {}, [], {}, 0
    try:
        tf = tarfile.open(fileobj=p.stdout, mode='r|')
        for m in tf:
            n += 1
            if len(names) < 25:
                names.append(m.name)
            top = '/'.join(m.name.split('/')[:-1][:3])
            dirs[top] = dirs.get(top, 0) + 1
            mm = re.search(r'heatmap/(\d\d)\.bin\.ttf$', m.name)
            if mm and m.isfile():
                i = int(mm.group(1))
                if i in want:
                    out[i] = tf.extractfile(m).read()
                    if len(out) == len(want):
                        break
    except Exception as e:  # noqa: BLE001
        note(day, 'tar stream ended with', repr(e))
    finally:
        p.kill()
        p.wait()
    d.update({'members_seen': n, 'first_names': names, 'dirs': dict(sorted(dirs.items(), key=lambda kv: -kv[1])[:12]),
              'heatmaps': {str(k): len(v) for k, v in sorted(out.items())}, 'seconds': round(time.time() - t0)})
    note(day, 'read', len(out), 'of', len(want), 'heatmap files from', n, 'tar members in', d['seconds'], 's')
    return out


# ---------------------------------------------------------------- the heatmap format
def unpack(raw):
    if raw[:2] == b'\x1f\x8b':
        return gzip.decompress(raw)
    if raw[:4] == b'\x28\xb5\x2f\xfd':
        return subprocess.run(['zstd', '-dc'], input=raw, stdout=subprocess.PIPE, check=True).stdout
    return raw


def parse_heatmap(raw):
    """readsb's heatmap file: 16-byte records of four little-endian int32s.
    A slice starts with [0x0e7f7c9d, time ms high, time ms low, interval]; then one record per aircraft:
    [ICAO address (bit 24 set = not an ICAO address), lat * 1e6, lon * 1e6, altitude int16 (x25 ft, -123 = on the
    ground) | ground speed int16 << 16 (x0.1 kt)]. A record whose second field is >= 2^30 is an "info" record: the
    callsign is its last eight bytes. Returns [(unix seconds, hex[], lat[], lon[], alt_ft[])...] and {hex: callsign}."""
    buf = unpack(raw)
    buf = buf[:len(buf) // 16 * 16]
    a = np.frombuffer(buf, dtype='<i4').reshape(-1, 4)
    u = np.frombuffer(buf, dtype='<u4').reshape(-1, 4)
    b = np.frombuffer(buf, dtype=np.uint8).reshape(-1, 16)
    starts = np.flatnonzero(a[:, 0] == MAGIC)
    slices, calls = [], {}
    for k, s in enumerate(starts):
        e = starts[k + 1] if k + 1 < len(starts) else len(a)
        ts = (int(u[s, 1]) << 32 | int(u[s, 2])) / 1000.0
        if not (1.6e9 < ts < 2.2e9):
            continue  # the index at the head of the file repeats the magic number
        r = a[s + 1:e]
        info = r[:, 1] >= (1 << 30)
        if info.any():
            for row, hx in zip(b[s + 1:e][info], r[info, 0]):
                cs = bytes(row[8:16]).split(b'\0')[0].decode('ascii', 'ignore').strip()
                if cs and re.fullmatch(r'[A-Z0-9]{2,8}', cs):
                    calls[int(hx) & 0xFFFFFF] = cs
        pos = r[~info]
        hexf = pos[:, 0]
        alt = (pos[:, 3] & 0xFFFF).astype(np.int32)
        alt[alt >= 32768] -= 65536
        ok = ((hexf & 0x1000000) == 0) & (alt != -123)
        slices.append((ts, (hexf[ok] & 0xFFFFFF).astype(np.int64), pos[ok, 1] / 1e6, pos[ok, 2] / 1e6, alt[ok] * 25))
    return slices, calls


# ---------------------------------------------------------------- the map
def np_project(lon, lat):
    x = np.empty(len(lon)); y = np.empty(len(lon))
    K, TX, TY = 1300.0, 487.5, 305.0
    p0, p1 = math.radians(29.5), math.radians(45.5)
    sy0 = math.sin(p0); n = (sy0 + math.sin(p1)) / 2; c = 1 + sy0 * (2 * n - sy0); r0 = math.sqrt(c) / n
    cx0, cy0 = project(-96.6, 38.7)  # equals (TX, TY); kept as a check below
    lam = np.radians(lon + 96.0); phi = np.radians(lat)
    r = np.sqrt(np.maximum(c - 2 * n * np.sin(phi), 0)) / n
    rx, ry = r * np.sin(lam * n), r0 - r * np.cos(lam * n)
    rc = math.sqrt(c - 2 * n * math.sin(math.radians(38.7))) / n
    ccx, ccy = rc * math.sin(math.radians(-0.6) * n), r0 - rc * math.cos(math.radians(-0.6) * n)
    x[:] = TX + K * (rx - ccx); y[:] = TY - K * (ry - ccy)
    assert abs(cx0 - TX) < 1e-6 and abs(cy0 - TY) < 1e-6
    return x, y


def us_mask():
    """The lower 48 as a 975 x 610 raster (plus about 45 km of coastal water), from the site's own state map."""
    from PIL import Image, ImageDraw, ImageFilter
    g = json.load(open(os.path.join(ROOT, '..', '..', 'election2026', 'data', 'geo.json')))
    sc, tl = g['transform']['scale'], g['transform']['translate']
    arcs = []
    for arc in g['arcs']:
        x = y = 0; o = []
        for dx, dy in arc:
            x += dx; y += dy; o.append((x * sc[0] + tl[0], y * sc[1] + tl[1]))
        arcs.append(o)
    W, H, S = 1115, 700, 1  # the kept frame, 1 px per map unit, offset by XMIN/YMIN
    im = Image.new('L', (W, H), 0); dr = ImageDraw.Draw(im)
    for st in g['objects']['states']['geometries']:
        if st['id'] in ('02', '15') or int(st['id']) > 56:
            continue
        for poly in ([st['arcs']] if st['type'] == 'Polygon' else st['arcs']):
            ring = []
            for i in poly[0]:
                pts = arcs[~i][::-1] if i < 0 else arcs[i]
                ring.extend(pts[1:] if ring else pts)
            if len(ring) >= 3:
                dr.polygon([((x - XMIN) * S, (y - YMIN) * S) for x, y in ring], fill=255)
    im = im.filter(ImageFilter.MaxFilter(21))
    return np.asarray(im) > 0


# ---------------------------------------------------------------- frames and tracks
def collect(t0, hours, step):
    """Read the window [t0, t0 + hours) and return per-frame arrays (hex, x, y, alt) and the callsigns heard."""
    t1 = t0 + timedelta(hours=hours)
    want = {}
    t = t0
    while t < t1:
        want.setdefault(t.strftime('%Y-%m-%d'), set()).add(t.hour * 2 + t.minute // 30)
        t += timedelta(minutes=30)
    slices, calls = [], {}
    for day, idx in sorted(want.items()):
        files = read_heatmaps(day, idx)
        for i in sorted(files):
            try:
                s, c = parse_heatmap(files[i])
            except Exception as e:  # noqa: BLE001
                note(day, i, 'parse failed', repr(e)); continue
            LOG['days'][day].setdefault('slices', {})[str(i)] = [len(s), int(sum(len(x[1]) for x in s))]
            if s and 'sample' not in LOG:
                LOG['sample'] = {'file': f'{day} {i:02d}', 'bytes': len(files[i]), 'slice_times': [round(x[0]) for x in s[:4]],
                                 'aircraft_in_first_slice': int(len(s[0][1])), 'callsigns': len(c)}
            slices += s; calls.update(c)
    slices.sort(key=lambda s: s[0])
    nF = int(hours * 3600 // step)
    ts0 = t0.timestamp()
    st = np.array([s[0] for s in slices]) if slices else np.zeros(0)
    frames = []
    for f in range(nF):
        tt = ts0 + f * step
        if not len(st):
            frames.append(None); continue
        k = int(np.argmin(np.abs(st - tt)))
        if abs(st[k] - tt) > step * 0.75:
            frames.append(None); continue
        _, hx, lat, lon, alt = slices[k]
        box = (lat > 18) & (lat < 56) & (lon > -140) & (lon < -55)
        x, y = np_project(lon[box], lat[box])
        hx, alt = hx[box], alt[box]
        ok = (x > XMIN) & (x < XMAX) & (y > YMIN) & (y < YMAX)
        hx, x, y, alt = hx[ok], x[ok], y[ok], alt[ok]
        _, first = np.unique(hx, return_index=True)  # one record per aircraft
        frames.append((hx[first], x[first], y[first], alt[first]))
    return frames, calls, len(slices)


def tracks_from(frames, calls, max_gap=4):
    """Join the frames into tracks. An aircraft missing for up to three minutes (a hole in coverage) is carried across
    in a straight line; a longer silence ends its track."""
    lim = 127.0 / Q
    live, done = {}, []
    for f, fr in enumerate(frames):
        if fr is None:
            continue
        for hx, x, y, alt in zip(fr[0].tolist(), fr[1].tolist(), fr[2].tolist(), fr[3].tolist()):
            a = min(255, max(1, int(round(alt / 250.0)))) if alt > 0 else 1
            tr = live.get(hx)
            if tr is not None:
                g = f - tr['last']
                px, py, pa = tr['pts'][-1]
                if 1 <= g <= max_gap and abs(x - px) / g < lim and abs(y - py) / g < lim:
                    for j in range(1, g):
                        k = j / g
                        tr['pts'].append((px + (x - px) * k, py + (y - py) * k, int(round(pa + (a - pa) * k))))
                    tr['pts'].append((x, y, a)); tr['last'] = f
                    continue
                done.append(tr)
            live[hx] = {'hex': hx, 'start': f, 'last': f, 'pts': [(x, y, a)]}
    done += list(live.values())
    out = []
    for tr in done:
        if len(tr['pts']) < 3:
            continue  # one or two stray fixes
        cs = calls.get(tr['hex'], '')
        tr['cs'] = cs
        tr['flags'] = 1 if re.match(r'^[A-Z]{3}\d', cs) else 0  # an operator's flight number (airlines, cargo, charter fleets)
        out.append(tr)
    out.sort(key=lambda t: (t['start'], t['hex']))
    return out


def counts(tracks, nF, mask):
    """Per minute: aircraft airborne over the lower 48 (all; at or above 18,000 ft; flying an operator's flight number)
    and everything in the frame."""
    c = {k: [0] * nF for k in ('us', 'high', 'ops', 'frame')}
    for tr in tracks:
        f = tr['start']
        for x, y, a in tr['pts']:
            c['frame'][f] += 1
            ix, iy = int(x - XMIN), int(y - YMIN)
            if 0 <= iy < mask.shape[0] and 0 <= ix < mask.shape[1] and mask[iy, ix]:
                c['us'][f] += 1
                if a * 250 >= 18000: c['high'][f] += 1
                if tr['flags'] & 1: c['ops'][f] += 1
            f += 1
    return c


def encode(tracks, nF, t0, step):
    """tracks.bin (gzipped). Little-endian.
    'WAIR' u8 version=1 · u16 frames · u32 t0 (unix s) · u16 step (s) · u32 tracks · u32 points
    then, track by track in parallel arrays: u16 start frame · u16 length · u8 flags (1 = operator flight number)
    · i16 x0 · i16 y0 (1/16 map unit) · 8 bytes callsign · then for all points in order: u8 altitude (x250 ft),
    and for every point after a track's first: i8 dx, i8 dy (1/16 map unit per frame)."""
    n = len(tracks)
    tot = sum(len(t['pts']) for t in tracks)
    start = np.array([t['start'] for t in tracks], '<u2'); ln = np.array([len(t['pts']) for t in tracks], '<u2')
    flags = np.array([t['flags'] for t in tracks], 'u1')
    x0 = np.zeros(n, '<i2'); y0 = np.zeros(n, '<i2')
    alt = np.zeros(tot, 'u1'); dx = np.zeros(tot - n, 'i1'); dy = np.zeros(tot - n, 'i1')
    cs = bytearray(8 * n)
    p = d = 0
    for i, t in enumerate(tracks):
        qx = [int(round(x * Q)) for x, _, _ in t['pts']]; qy = [int(round(y * Q)) for _, y, _ in t['pts']]
        x0[i], y0[i] = qx[0], qy[0]
        cx, cy = qx[0], qy[0]
        for j, (_, _, a) in enumerate(t['pts']):
            alt[p] = a; p += 1
            if j:
                ddx = max(-127, min(127, qx[j] - cx)); ddy = max(-127, min(127, qy[j] - cy))
                dx[d], dy[d] = ddx, ddy; d += 1; cx += ddx; cy += ddy
        c = t['cs'].encode('ascii')[:8]
        cs[i * 8:i * 8 + len(c)] = c
    head = b'WAIR' + struct.pack('<BHIHII', 1, nF, int(t0.timestamp()), step, n, tot)
    raw = head + start.tobytes() + ln.tobytes() + flags.tobytes() + x0.tobytes() + y0.tobytes() + bytes(cs) + alt.tobytes() + dx.tobytes() + dy.tobytes()
    return raw, gzip.compress(raw, 9, mtime=0)


# ---------------------------------------------------------------- a made-up sky, to build the page before the data
def mock(t0, hours, step):
    rng = np.random.default_rng(7)
    hubs = [(-87.90, 41.98), (-84.43, 33.64), (-97.04, 32.90), (-104.67, 39.86), (-118.41, 33.94), (-73.78, 40.64), (-122.38, 37.62),
            (-122.31, 47.45), (-80.29, 25.79), (-95.34, 29.98), (-112.01, 33.43), (-71.01, 42.36), (-93.22, 44.88), (-83.35, 42.21), (-80.94, 35.21)]
    nF = int(hours * 3600 // step); stop = int(1.9 * 3600 // step); lift = int(6.25 * 3600 // step)
    tracks = []
    for i in range(9000):
        a, b = rng.choice(len(hubs), 2, replace=False)
        ax, ay = project(*hubs[a]); bx, by = project(*hubs[b])
        dur = max(20, int(math.hypot(bx - ax, by - ay) / 3.0))
        dep = int(rng.integers(-dur, nF))
        if stop <= dep < lift: continue
        if dep >= lift and rng.random() > 0.5 * (dep - lift) / max(1, nF - lift) + 0.15: continue
        pts = []
        for j in range(dur + 1):
            f = dep + j
            if 0 <= f < nF:
                k = j / dur
                pts.append((ax + (bx - ax) * k + math.sin(k * 3.14) * 6, ay + (by - ay) * k, int(1 + 150 * min(1, k * 6, (1 - k) * 6))))
        if len(pts) >= 3:
            tracks.append({'hex': i, 'start': max(dep, 0), 'last': 0, 'pts': pts, 'cs': f'TW{i % 9000:04d}'[:8] if i % 4 else f'N{i}', 'flags': 1 if i % 4 else 0})
    tracks.sort(key=lambda t: t['start'])
    return tracks, nF


# ---------------------------------------------------------------- main
def main():
    req = json.load(open(os.path.join(ROOT, 'fetch.json')))
    t0 = datetime.fromisoformat(req['from_utc'].replace('Z', '+00:00'))
    hours, step = req.get('hours', 9), req.get('step', 60)
    os.makedirs(DATA, exist_ok=True)
    mask = us_mask()
    is_mock = '--mock' in sys.argv
    base = None
    try:
        if is_mock:
            tracks, nF = mock(t0, hours, step); nslices = 0
        else:
            frames, calls, nslices = collect(t0, hours, step)
            nF = len(frames)
            LOG['frames_empty'] = sum(1 for f in frames if f is None)
            LOG['callsigns'] = len(calls)
            tracks = tracks_from(frames, calls)
            del frames
        c = counts(tracks, nF, mask)
        raw, gz = encode(tracks, nF, t0, step)
        LOG['tracks'] = len(tracks); LOG['points'] = sum(len(t['pts']) for t in tracks); LOG['bin_bytes'] = len(raw); LOG['gz_bytes'] = len(gz)
        note('tracks', len(tracks), 'points', LOG['points'], 'bytes', len(raw), 'gz', len(gz))
        if not is_mock and (LOG['points'] < 50000 or LOG.get('frames_empty', 0) > nF * 0.2):
            raise RuntimeError('too little data read; keeping the last files')
        if req.get('baseline_days') and not is_mock:
            try:
                bt0 = t0 - timedelta(days=req['baseline_days'])
                bfr, bcalls, _ = collect(bt0, hours, step)
                bc = counts(tracks_from(bfr, bcalls), nF, mask)
                if max(bc['us']) > 500:
                    base = {'from_utc': bt0.isoformat().replace('+00:00', 'Z'), 'us': bc['us'], 'high': bc['high'], 'ops': bc['ops']}
            except Exception:  # noqa: BLE001
                note('baseline failed', traceback.format_exc()[-600:])
        meta = {'from_utc': t0.isoformat().replace('+00:00', 'Z'), 'step': step, 'frames': nF, 'tracks': len(tracks), 'points': LOG['points'],
                'counts': c, 'baseline': base, 'mock': is_mock, 'callsigns': sum(1 for t in tracks if t['cs']),
                'source': {'name': 'ADSB.lol globe history', 'url': f'https://github.com/{REPO}', 'license': 'ODbL 1.0',
                           'releases': [d.get('urls', [''])[0].split('/')[-1].rsplit('.tar', 1)[0] for d in LOG['days'].values()]},
                'built': datetime.now(timezone.utc).isoformat(timespec='seconds')}
        with open(os.path.join(DATA, 'tracks.bin.gz'), 'wb') as f: f.write(gz)
        json.dump(meta, open(os.path.join(DATA, 'meta.json'), 'w'), separators=(',', ':'))
        LOG['ok'] = True
    except Exception:  # noqa: BLE001
        LOG['ok'] = False; LOG['error'] = traceback.format_exc()[-3000:]
        print(LOG['error'], file=sys.stderr)
    LOG['finished'] = datetime.now(timezone.utc).isoformat(timespec='seconds')
    if not is_mock:
        json.dump(LOG, open(os.path.join(DATA, 'fetch_log.json'), 'w'), indent=1)
    return 0


if __name__ == '__main__':
    sys.exit(main())
