"""Who moved: the wave's county moves cut by county size, by the 2024 result, by turnout and by the Census profile.
Shared by write.py (the prompt's VOTER ANALYSIS block) and make_pages.py (the charts), so the pieces and the
charts are computed the same way. A row is a county dict (f, n, st, m24, m26, sh, t, t24, e); ctx is
data/context.json's counties (fips -> pop, inc, hisp, black, ba), or {}."""
import statistics, math

SIZE = [('under 10,000', 0, 10000), ('10,000 to 50,000', 10000, 50000), ('50,000 to 250,000', 50000, 250000), ('over 250,000', 250000, 1e12)]
BAND = [('Trump by 30 or more', -1e9, -30), ('Trump by 10 to 30', -30, -10), ('Trump by under 10', -10, 0), ('Harris by under 10', 0, 10), ('Harris by 10 to 30', 10, 30), ('Harris by 30 or more', 30, 1e9)]
TURN = [('under 65%', 0, 65), ('65% to 80%', 65, 80), ('80% to 95%', 80, 95), ('95% and over', 95, 1e9)]
SING = {'counties': 'county', 'parishes': 'parish', 'boroughs': 'borough'}
CENSUS = [('hisp', 'Hispanic share'), ('ba', 'adults with a degree'), ('inc', 'median household income'), ('black', 'Black share')]


def wmove(rs):
    tw = sum(r['t'] for r in rs); return (sum(r['sh'] * r['t'] for r in rs) / tw) if tw else 0.0
def ratio(r): return (r['t'] / r['t24'] * 100) if r['t24'] else None
def corr(xs, ys):
    if len(xs) < 8: return None
    try: return statistics.correlation(xs, ys)
    except Exception: return None
def cut(rs, groups, key):
    out = []
    for label, lo, hi in groups:
        g = [r for r in rs if (v := key(r)) is not None and lo <= v < hi]
        out.append({'label': label, 'n': len(g), 'move': round(wmove(g), 1) if g else None, 'median': round(statistics.median(r['sh'] for r in g), 1) if g else None, 'votes': sum(r['t'] for r in g), 'share': 0.0})
    tv = sum(o['votes'] for o in out) or 1
    for o in out: o['share'] = round(o['votes'] / tv * 100, 1)
    return out


def analysis(rs, ctx=None, points=600):
    """Everything the charts and the prompt need, for one state's counties or the country's."""
    ctx = ctx or {}; rs = [r for r in rs if r['t'] and r['t24']]
    out = {'n': len(rs), 'move': round(wmove(rs), 1), 'median': round(statistics.median(r['sh'] for r in rs), 1) if rs else None,
           'size': cut(rs, SIZE, lambda r: r['t']), 'band': cut(rs, BAND, lambda r: r['m24']), 'turnout': cut(rs, TURN, ratio),
           'turnout_r': corr([ratio(r) for r in rs], [r['sh'] for r in rs]), 'turnout_all': round(sum(r['t'] for r in rs) / sum(r['t24'] for r in rs) * 100, 1) if rs else None,
           'census': None}
    have = [r for r in rs if r['f'] in ctx and ctx[r['f']].get('inc')]
    if len(have) >= 12:
        cen = {}
        for k, label in CENSUS:
            vals = sorted(have, key=lambda r: ctx[r['f']][k]); q = max(1, len(vals) // 4)
            lo, hi = vals[:q], vals[-q:]
            cen[k] = {'label': label, 'top': round(wmove(hi), 1), 'bottom': round(wmove(lo), 1), 'top_from': ctx[hi[0]['f']][k], 'bottom_to': ctx[lo[-1]['f']][k], 'n': q,
                      'r': corr([ctx[r['f']][k] for r in have], [r['sh'] for r in have])}
        out['census'] = cen; out['census_n'] = len(have)
    # points for the scatters: every county for a state; the biggest plus a spread for the country
    pick = rs if len(rs) <= points else sorted(rs, key=lambda r: -r['t'])[:points // 2] + sorted(rs, key=lambda r: -r['t'])[points // 2::max(1, (len(rs) - points // 2) // (points // 2))][:points // 2]
    out['points'] = [[round(r['m24'], 1), round(r['sh'], 1), r['t'], round(ratio(r), 0), (ctx.get(r['f']) or {}).get('hisp'), r['n'], r['st']] for r in pick]
    return out


def prose(a, word='counties'):
    """The VOTER ANALYSIS block for the writer's prompt."""
    def row(o): return f"{o['label']}: {o['n']} {word}, {o['share']:.0f}% of the vote, moved {o['move']:+.1f} (weighted; typical {o['median']:+.1f})" if o['n'] else f"{o['label']}: none"
    L = [f"VOTER ANALYSIS ({a['n']} {word} with a 2024 and a 2026 count; the page shows these as charts, so the piece can refer to them). Weighted by votes the {word} moved {a['move']:+.1f}; the typical one {a['median']:+.1f}.",
         "By size (2026 votes cast): " + '; '.join(row(o) for o in a['size']) + '.',
         "By the 2024 result: " + '; '.join(row(o) for o in a['band']) + '.',
         f"By turnout (2026 votes as a share of 2024; overall {a['turnout_all']}%): " + '; '.join(row(o) for o in a['turnout']) + (f". Correlation between a {SING.get(word, word)}'s turnout change and its move: r = {a['turnout_r']:+.2f}." if a['turnout_r'] is not None else '.')]
    if a.get('census'):
        c = a['census']
        L.append(f"By Census profile (ACS 2023; {a['census_n']} {word}; the top and bottom quarter of the {word} by each measure, weighted by votes): " + '; '.join(
            f"{v['label']}: top quarter moved {v['top']:+.1f}, bottom quarter {v['bottom']:+.1f} (r = {v['r']:+.2f})" if v['r'] is not None else f"{v['label']}: top quarter {v['top']:+.1f}, bottom {v['bottom']:+.1f}" for v in c.values()) + '.')
        L.append("Read the correlations with care: counties are not voters (the ecological fallacy), and a county's move mixes who turned out with who changed their mind.")
    return '\n'.join(x for x in L if x)
