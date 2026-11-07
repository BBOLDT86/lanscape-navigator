"""Inline SVG charts for the wave's voter analysis (tools/voters.py): drawn at build time by make_pages.py so they
work without JavaScript and follow the page's theme (fills are CSS classes from article.css). Marks follow the
dataviz rules: thin bars with rounded data-ends anchored to zero, >=8px dots with a surface ring, direct labels on a
few marks only, text in ink tokens, one axis per chart, a table view beside the picture."""
import math, html

SING = {'counties': 'county', 'parishes': 'parish', 'boroughs': 'borough'}
def esc(s): return html.escape(str(s), quote=True)
def fmt(v, d=1): return ('+' if v > 0 else '') + f'{v:.{d}f}'
def _scale(lo, hi, a, b): return lambda v: a + (v - lo) / (hi - lo) * (b - a) if hi != lo else (a + b) / 2
def ticks(lo, hi, step):
    v = math.ceil(lo / step) * step; out = []
    while v <= hi + 1e-9: out.append(round(v, 6)); v += step
    return out


def scatter(points, x_index, x_label, x_lo, x_hi, x_step, title, note, label_n=6, x_fmt=lambda v: str(int(v)), zero_x=None):
    """Move (y) against one measure (x); dot area by votes; moved-left dots blue, moved-right dots red."""
    pts = [p for p in points if p[x_index] is not None]
    if len(pts) < 5: return ''
    W, H, L, R, T, B = 640, 360, 44, 16, 28, 44
    ys = [p[1] for p in pts]; y_lo = min(-5, math.floor(min(ys) / 5) * 5); y_hi = max(5, math.ceil(max(ys) / 5) * 5)
    sx = _scale(x_lo, x_hi, L, W - R); sy = _scale(y_lo, y_hi, H - B, T)
    tmax = max(p[2] for p in pts) or 1
    out = [f'<figure class="chart wide"><figcaption><b>{esc(title)}</b><span>{esc(note)}</span></figcaption>',
           f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="{esc(title)}">']
    for t in ticks(y_lo, y_hi, 10 if y_hi - y_lo > 40 else 5):
        y = sy(t); out.append(f'<line class="grid{" zero" if t == 0 else ""}" x1="{L}" x2="{W - R}" y1="{y:.1f}" y2="{y:.1f}"/><text class="tick" x="{L - 6}" y="{y + 4:.1f}" text-anchor="end">{fmt(t, 0)}</text>')
    for t in ticks(x_lo, x_hi, x_step):
        x = sx(t); out.append(f'<text class="tick" x="{x:.1f}" y="{H - B + 16}" text-anchor="middle">{esc(x_fmt(t))}</text>')
    if zero_x is not None: x = sx(zero_x); out.append(f'<line class="grid zero" y1="{T}" y2="{H - B}" x1="{x:.1f}" x2="{x:.1f}"/>')
    out.append(f'<text class="axis" x="{(L + W - R) / 2:.0f}" y="{H - 6}" text-anchor="middle">{esc(x_label)}</text><text class="axis" transform="translate(12 {(T + H - B) / 2:.0f}) rotate(-90)" text-anchor="middle">move since 2024, points</text>')
    big = sorted(pts, key=lambda p: -p[2])
    for p in sorted(pts, key=lambda p: -p[2]):
        x = sx(min(max(p[x_index], x_lo), x_hi)); y = sy(p[1]); r = 4 + 10 * math.sqrt(p[2] / tmax)
        out.append(f'<circle class="dot {"l" if p[1] >= 0 else "r"}" cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}"><title>{esc(p[5])}{", " + esc(p[6]) if p[6] else ""}: moved {fmt(p[1])}; 2024 {("D+" if p[0] > 0 else "R+") + str(abs(p[0]))}; {p[2]:,} votes; turnout {int(p[3])}% of 2024</title></circle>')
    for p in big[:label_n]:
        x = sx(min(max(p[x_index], x_lo), x_hi)); y = sy(p[1]); r = 4 + 10 * math.sqrt(p[2] / tmax)
        out.append(f'<text class="lbl" x="{x + r + 3:.1f}" y="{y + 4:.1f}">{esc(p[5])}</text>')
    out.append('</svg></figure>')
    return ''.join(out)


def bars(groups, title, note, unit='counties'):
    """One horizontal bar per group: the weighted move; the group's share of the vote in muted text."""
    gs = [g for g in groups if g['n']]
    if len(gs) < 2: return ''
    W, L, R, rowh = 440, 168, 56, 34; H = 20 + rowh * len(gs) + 8
    lo = min(0, min(g['move'] for g in gs)); hi = max(0, max(g['move'] for g in gs)); lo, hi = math.floor(lo / 5) * 5, math.ceil(hi / 5) * 5 or 5
    sx = _scale(lo, hi, L, W - R); x0 = sx(0)
    out = [f'<figure class="chart bars"><figcaption><b>{esc(title)}</b><span>{esc(note)}</span></figcaption><svg viewBox="0 0 {W} {H}" role="img" aria-label="{esc(title)}">']
    for t in ticks(lo, hi, 5 if hi - lo <= 40 else 10):
        x = sx(t); out.append(f'<line class="grid{" zero" if t == 0 else ""}" x1="{x:.1f}" x2="{x:.1f}" y1="10" y2="{H - 14}"/>')
    for i, g in enumerate(gs):
        y = 20 + i * rowh; x1 = sx(g['move']); a, b = (x0, x1) if x1 >= x0 else (x1, x0)
        out.append(f'<text class="rowl" x="{L - 10}" y="{y + 13}" text-anchor="end">{esc(g["label"])}</text><text class="rowm" x="{L - 10}" y="{y + 26}" text-anchor="end">{g["n"]} {esc(unit)}, {g["share"]:.0f}% of the vote</text>')
        out.append(f'<rect class="bar {"l" if g["move"] >= 0 else "r"}" x="{a:.1f}" y="{y + 6}" width="{max(2, b - a):.1f}" height="14" rx="4"/><text class="val" x="{(x1 + 6) if x1 >= x0 else (x1 - 6):.1f}" y="{y + 17}" text-anchor="{"start" if x1 >= x0 else "end"}">{fmt(g["move"])}</text>')
    out.append('</svg></figure>')
    return ''.join(out)


def paired(cen, title, note):
    """Top quarter against bottom quarter of the counties by each Census measure: two thin bars a row, with a legend."""
    rows = [v for v in cen.values() if v.get('top') is not None]
    if not rows: return ''
    W, L, R, rowh = 440, 168, 56, 46; H = 34 + rowh * len(rows)
    vals = [v['top'] for v in rows] + [v['bottom'] for v in rows]; lo = min(0, math.floor(min(vals) / 5) * 5); hi = max(5, math.ceil(max(vals) / 5) * 5)
    sx = _scale(lo, hi, L, W - R); x0 = sx(0)
    out = [f'<figure class="chart bars"><figcaption><b>{esc(title)}</b><span>{esc(note)}</span></figcaption>',
           '<div class="legend"><span><i class="sw a"></i>top quarter</span><span><i class="sw b"></i>bottom quarter</span></div>',
           f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="{esc(title)}">']
    for t in ticks(lo, hi, 5 if hi - lo <= 40 else 10):
        x = sx(t); out.append(f'<line class="grid{" zero" if t == 0 else ""}" x1="{x:.1f}" x2="{x:.1f}" y1="8" y2="{H - 10}"/>')
    for i, v in enumerate(rows):
        y = 14 + i * rowh
        out.append(f'<text class="rowl" x="{L - 10}" y="{y + 15}" text-anchor="end">{esc(v["label"])}</text><text class="rowm" x="{L - 10}" y="{y + 28}" text-anchor="end">r = {fmt(v["r"], 2) if v.get("r") is not None else "–"}</text>')
        for j, (k, cls) in enumerate((('top', 'a'), ('bottom', 'b'))):
            x1 = sx(v[k]); a, b = (x0, x1) if x1 >= x0 else (x1, x0); yy = y + 4 + j * 14
            out.append(f'<rect class="bar {cls}" x="{a:.1f}" y="{yy}" width="{max(2, b - a):.1f}" height="11" rx="4"/><text class="val" x="{(x1 + 6) if x1 >= x0 else (x1 - 6):.1f}" y="{yy + 9}" text-anchor="{"start" if x1 >= x0 else "end"}">{fmt(v[k])}</text>')
    out.append('</svg></figure>')
    return ''.join(out)


def voter_charts(a, word='counties', scope='the state'):
    """The four-chart block for an analysis dict (voters.analysis)."""
    if not a or a['n'] < 8: return ''
    parts = [f'<div class="charts">',
             scatter(a['points'], 0, 'Harris–Trump margin, 2024 (R+ to the left, D+ to the right)', -80, 80, 20, f'Where the move came from', f'Every {SING.get(word, word)} on the map: how it voted in 2024 against how far it moved; the area of a dot is its 2026 vote. The dashed lines are zero.', x_fmt=lambda v: ('D+' if v > 0 else 'R+' if v < 0 else '') + str(abs(int(v))), zero_x=0),
             bars(a['size'], 'By county size', f'The weighted move of {word} by votes cast in 2026.', word),
             bars(a['band'], 'By the 2024 result', f'The weighted move of {word} by how they voted two years ago.', word),
             scatter(a['points'], 3, 'votes cast in 2026 as a share of 2024', 40, 130, 10, 'Turnout or persuasion', f'A {SING.get(word, word)}\'s turnout change against its move' + (f' (r = {fmt(a["turnout_r"], 2)}).' if a.get('turnout_r') is not None else '.') + ' Where turnout fell and the move was large, the count cannot tell who stayed home from who changed sides.', x_fmt=lambda v: f'{int(v)}%', zero_x=100),
             bars(a['turnout'], 'By turnout', 'Votes in 2026 as a share of the 2024 vote.', word)]
    if a.get('census'): parts.append(paired(a['census'], 'By the Census profile', f'The top and bottom quarter of {scope}\'s {word} by each measure (ACS 2023 five-year estimates), weighted by votes. Counties are not voters: a county that is more Hispanic moving more does not say which of its voters moved.'))
    parts.append('</div>')
    return ''.join(parts)
