#!/usr/bin/env python3
"""One-time ingest of the Nov. 8, 2026 research files (the first sprint's fan-out) into news/mandate/data/*.json.
After this, the data files are the record and are edited directly (by hand or by the weekly sprint); this script is kept
so the shape of the first sprint can be reproduced.  python3 news/mandate/tools/ingest.py <research dir>"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.normpath(os.path.join(HERE, '..', 'data'))
SRC = sys.argv[1] if len(sys.argv) > 1 else '.'


def load(name):
    p = os.path.join(SRC, name)
    if not os.path.exists(p):
        print('missing', name)
        return {}
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def save(name, obj):
    os.makedirs(DATA, exist_ok=True)
    with open(os.path.join(DATA, name), 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
    print('wrote', name)


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', (s or '').lower()).strip('-')[:60]


def verified(x):
    s = json.dumps(x)
    return 'NOT VERIFIED' not in s and x.get('source') not in (None, '') if isinstance(x, dict) else True


def markets():
    g = load('G_markets.json')
    if not g:
        return
    out = {
        'spx': [r for r in g.get('spx', []) if r.get('close')],
        'geo': {'prices': [r for r in g['geo'].get('prices', []) if r.get('close')], 'contracts': [c for c in g['geo'].get('contracts', []) if c.get('source')], 'quotes': g['geo'].get('quotes', []),
                'donations': [], 'lawsuits': g['geo'].get('lawsuits', [])},
        'cxw': {'prices': [r for r in g['cxw'].get('prices', []) if r.get('close')], 'contracts': [c for c in g['cxw'].get('contracts', []) if c.get('source')], 'quotes': g['cxw'].get('quotes', []), 'donations': []},
        'tesla': {'prices': [r for r in g['tesla'].get('prices', []) if r.get('close')], 'events': [e for e in g['tesla'].get('events', []) if e.get('source')],
                  'musk_spending': [s for s in g['tesla'].get('musk_spending', []) if s.get('source')], 'musk_wealth': g['tesla'].get('musk_wealth', []), 'documentaries': [], 'videos': []},
        'profiteers': [p for p in g.get('profiteers', []) if p.get('source')],
        'macro': g.get('macro', {}),
        'comparison': g.get('meta', {}).get('predecessor_comparison', []),
        'computed': g.get('meta', {}).get('computed', {}),
        'gaps': g.get('gaps', []),
    }
    save('markets.json', out)


SECTION_FIX = {'Taking the Reins of Government': 'Taking the reins of government', 'The Common Defense': 'The common defense', 'The General Welfare': 'The general welfare',
               'The Economy': 'The economy', 'Independent Regulatory Agencies': 'Independent regulatory agencies'}


def chapters():
    a = load('A_document.json')
    if not a:
        return
    chs = []
    for c in a.get('chapters', []):
        chs.append({'num': c['num'], 'section': SECTION_FIX.get(c.get('section'), c.get('section')), 'title': c['title'], 'authors': c.get('authors', []), 'agency': c.get('agency', ''),
                    'proposals': c.get('proposals', []), 'sources': c.get('sources', [])})
    out = {'document': a.get('meta', {}).get('document', ''), 'pdf_sources': a.get('meta', {}).get('pdf_sources', []), 'pdf_note': a.get('meta', {}).get('pdf_note', ''),
           'congress_pdf': 'https://www.congress.gov/118/meeting/house/117694/documents/HHRG-118-GO05-20240925-SD004.pdf',
           'chapters': chs, 'trackers': a.get('trackers', []), 'people': a.get('people', []), 'hearing': a.get('hearing', {}), 'distancing': a.get('distancing', []), 'boasts': a.get('heritage_boasts', []),
           'history': [{'date': '2023-04', 'what': 'The Heritage Foundation publishes Mandate for Leadership: The Conservative Promise, the 900-page Project 2025 policy book, 30 chapters by some 400 contributors', 'source': 'https://en.wikipedia.org/wiki/Project_2025'},
                       {'date': '2024-07-05', 'what': 'Trump on Truth Social: “I know nothing about Project 2025. I have no idea who is behind it.”', 'source': 'https://www.axios.com/2024/07/05/trump-project-2025-heritage-foundation'},
                       {'date': '2024-07-30', 'what': 'Paul Dans, Project 2025’s director, leaves Heritage as the campaign distances itself from the project', 'source': 'https://www.pbs.org/newshour/politics/project-2025-author-paul-dans-drops-primary-challenge-to-lindsey-graham-in-south-carolina'},
                       {'date': '2024-09-25', 'what': 'House Oversight subcommittee hearing with Paul Winfree (Ch. 24 author) as a witness; Democrats enter the Mandate into the record', 'source': 'https://oversight.house.gov/hearing/kitchen-table-economics-how-failed-biden-harris-policies-continue-to-hurt-consumers-2'},
                       {'date': '2025-01-20', 'what': 'Inauguration; the first executive orders, two-thirds of which mirror Mandate proposals by Time’s count', 'source': 'https://www.time.com/7209901/donald-trump-executive-actions-project-2025/'},
                       {'date': '2025-10-02', 'what': 'Trump on Truth Social: a meeting with “Russ Vought, he of PROJECT 2025 Fame” — the first public embrace', 'source': 'https://www.axios.com/2025/10/02/trump-project-2025-russ-vought'}]}
    save('chapters.json', out)


TOPIC_MAP = [  # (pattern, normalized topic)
    (r'birthright', 'Birthright citizenship'), (r'tariff', 'Tariffs'), (r'independent agencies|removal power|federal reserve|library of congress', 'Removal power & the Fed'), (r'national guard', 'Troops in cities'),
    (r'alien enemies|abrego|third-country|removals', 'Deportations'), (r'immigration|border|tps', 'Immigration enforcement'), (r'workforce|civil service', 'Federal workforce'),
    (r'education|universit', 'Universities & schools'), (r'law firms', 'Law firms'), (r'press|media', 'Press'), (r'impoundment|grant|appropriations|foreign aid', 'Spending & impoundment'),
    (r'prosecution|classified', 'Prosecuting adversaries'), (r"trump's own|self-dealing|epstein", 'Trump’s own cases'), (r'transgender', 'Transgender policy'), (r'election|voting|redistricting|mail', 'Elections & redistricting'),
]


def topic(t):
    tl = (t or '').lower()
    for pat, name in TOPIC_MAP:
        if re.search(pat, tl):
            return name
    return t or 'Other'


def courts():
    c = load('C_courts.json')
    if not c:
        return
    cases = []
    for k in c.get('cases', []):
        k = dict(k)
        k['topic_raw'] = k.get('topic')
        k['topic'] = topic(k.get('topic'))
        k['dates'] = sorted([d for d in k.get('dates', []) if re.match(r'^\d{4}-\d{2}', d.get('date', ''))], key=lambda d: d['date'])
        k['featured'] = k['id'] in {'learning-resources-v-trump', 'trump-v-slaughter', 'trump-v-cook', 'trump-v-barbara', 'us-v-comey', 'abrego-garcia', 'jgg-v-trump-contempt', 'illinois-v-trump', 'state-v-aids-vaccine-advocacy-coalition', 'us-v-california-ballots'}
        cases.append(k)
    save('courts.json', {'cases': cases, 'meta': c.get('meta', {})})


def people():
    d = load('D_people.json')
    a = load('A_document.json')
    if not d:
        return
    # Project 2025 ties verified by the document map (A) replace the roster's background-knowledge notes
    ties, lasts = {}, {}
    for p in a.get('people', []):
        ties[p['name'].lower()] = p
        lasts.setdefault(p['name'].split()[-1].lower(), []).append(p)
    roster = []
    for p in d.get('roster', []):
        p = dict(p)
        ln = p['name'].split()[-1].lower()
        t = ties.get(p['name'].lower()) or (lasts[ln][0] if len(lasts.get(ln, [])) == 1 else None)
        if t and t.get('p2025_role'):
            p['p2025'] = t['p2025_role']
            p.setdefault('sources', [])
            if t.get('source') and t['source'] not in p['sources']:
                p['sources'].append(t['source'])
        elif (p.get('p2025') or '').lower().startswith('none'):
            p['p2025'] = 'none known'
        else:
            p['p2025'] = (p.get('p2025') or '').split(' - background')[0].split(' (reported')[0] or 'none known'
            if 'unverified' in (p.get('p2025_raw') or '').lower():
                p['p2025'] = 'none known'
        roster.append(p)
    deps = []
    for x in d.get('departures', []):
        x = dict(x)
        if any('wltreport' in u for u in (x.get('sources') or [])):
            continue  # a partisan outlet was the only source; the sprint confirms it or not
        if x.get('type') == 'retired':
            x['type'] = 'resigned'
            x['reason'] = ('Retired. ' + (x.get('reason') or '')).strip()
        deps.append(x)
    save('people.json', {'roster': roster, 'departures': deps, 'turnover_comparison': d.get('turnover_comparison', {}), 'unverified': d.get('unverified_from_memory', []), 'asof': d.get('as_of')})


SHORT = {'ice': [('Deaths in ICE custody, calendar 2025', '31–33'), ('Deaths in ICE custody, FY2026 (Oct', '36–37'), ('Deaths in ICE custody, FY2026 as of', '23'), ('Deaths in ICE custody, calendar 2026', '24–25'), ('Total deaths Jan 2025', '46'), ('DHS death-rate', '0.009%'), ('Detention population, record', '70,766'), ('Detention population, latest', '65,765'), ('Detention population, Dec', '68,440'), ('Detention population, Nov', '65,135'), ('Share of new book-ins', '73%'), ('OBBBA detention', '$45B'), ('US citizens detained', '506'), ('Children detained', '6,200+'), ('Third-country', '536'), ('Venezuelans sent', '252'), ('Removals', '234,211'), ('Operation Metro Surge', '3,789')],
         'iran': [('Twelve-Day War (Jun', '1,190'), ('Twelve-Day War Israeli', '28'), ('Evin', '71–80'), ('Jan 2026 protest', '7,007+'), ('2026 war: Iranian deaths (Iran', '3,468'), ('2026 war: Iranian deaths (HRANA', '3,684'), ('2026 war: Iranian civilians', '3,400+'), ('2026 war: US troops', '23'), ('2026 war: Israel', '72'), ('2026 war: Lebanon', '4,324'), ('2026 war: Gulf', '47+'), ('2026 war: US cost', '$113B'), ('Minab school strike deaths (other', '123 children'), ('Minab school strike deaths', '157'), ('Schools/medical', '65 schools'), ('Hormuz', '30 attacks')],
         'aid': [('Lancet', '14M by 2030'), ('Boston University Impact Counter (Brooke Nichols) — Jan', '750,000+'), ('Impact Counter — final', '781,343'), ('Impact Counter — early', '23,000'), ('Broader cuts', '22M'), ('PEPFAR', '99.9%')],
         'health': [('OBBBA uninsured', '10.9M'), ('OBBBA spending', '$1.2T'), ('OBBBA Medicaid work', '11M'), ('OBBBA distributional', '−3.1%'), ('Rural hospital', '$50B'), ('Shutdown length', '43 days'), ('SNAP lapse', '41–43M'), ('ACA enhanced', 'Jan. 1, 2026'), ('Shutdown RIFs', '4,100+'), ('Early HHS', '5,200')],
         'economy': [('Average effective tariff', '27% → 12%'), ('Supreme Court IEEPA', '6–3'), ('Tariff incidence', '9% foreign'), ('Federal workforce', '~200,000'), ('DOGE savings', '$150B claimed'), ('GDP path', '−0.5% Q1'), ('Shutdown labor', '900,000'), ('Holiday tariff', '$132')],
         'civil': [('Lawsuits', '550+'), ('Court orders violated', '96+'), ('Federal prosecutors who resigned', '12+'), ('US citizens detained while', '63+'), ('Troop deployments', '3 cities'), ('Noem impeachment', '140'), ('Venezuela raid', 'Jan. 3, 2026')]}


def impact():
    f = load('F_impact.json')
    if not f:
        return
    kick = {'ice': 'Detention', 'iran': 'War', 'aid': 'Foreign aid', 'health': 'Health & the safety net', 'economy': 'Households', 'civil': 'Civil liberties'}
    ds = []
    for z in f.get('dossiers', []):
        z = dict(z)
        z['kicker'] = kick.get(z['id'], 'Human cost')
        z['title'] = z['title'].replace(' (partial)', '').replace(' (thin)', '')
        for fig in z.get('headline_figures', []):
            fig['grim'] = any(w in fig['label'].lower() for w in ('death', 'killed', 'died', 'uninsured', 'detained'))
            for pre, short in SHORT.get(z['id'], []):
                if fig['label'].startswith(pre):
                    fig['short'] = short
                    break
        ds.append(z)
    save('impact.json', {'dossiers': ds, 'iran_school_claim': f.get('iran_school_claim'), 'meta': f.get('meta', {})})


def promises():
    e = load('E_promises.json')
    if not e:
        return
    ps = []
    for p in e.get('promises', []):
        p = dict(p)
        p['quote'] = re.sub(r'\s*\((PolitiFact|AP|Bloomberg|Washington Examiner)[^)]*\)\s*$', '', p.get('quote', '')).strip().strip('"')
        p['featured'] = p['id'] in {'ukraine-24h', 'prices-day-one', 'medicaid-no-cuts', 'deport-criminals-first', 'no-new-wars', 'tariffs-foreign-pay', 'doge-2-trillion', 'epstein-files', 'jan6-pardons', 'egg-prices'}
        ps.append(p)
    save('promises.json', {'promises': ps, 'trackers': e.get('trackers', []), 'meta': e.get('meta', {})})


FEATURED = {'schedule-f', 'mass-rifs-doge', 'impoundment', 'humphreys-executor', 'fed-independence', 'usaid-dismantled', 'education-dept-closure', 'medicaid-work-requirements',
            'mass-deportation-ice-funding', 'alien-enemies-act', 'birthright-citizenship', 'tariffs', 'doj-weaponization-prosecutions', 'guard-deployments-cities', 'cpb-defund', 'endangerment-finding'}


AREA = {'Civil service / DOGE': 'Civil service', 'Budget / executive power': 'Budget', 'Public media': 'Media', 'Media / telecom': 'Media', 'Military': 'Defense', 'Defense / LGBTQ': 'Defense',
        'Domestic military use': 'Troops at home', 'Domestic deployment': 'Troops at home', 'LGBTQ': 'Gender policy', 'Health / safety net': 'Health', 'Health / international': 'Health', 'Climate / international': 'Climate',
        'Environment': 'Climate', 'Energy / transport': 'Energy', 'Science / weather': 'Science', 'Education / gender': 'Education', 'Immigration / Constitution': 'Immigration', 'Homeland security': 'Immigration',
        'Elections / census': 'Elections', 'Tax': 'Taxes', 'Disasters': 'Disaster policy', 'Religion': 'Religious liberty', 'Food aid': 'Safety net', 'General welfare': 'Housing', 'Economy': 'Economy'}


def scorecard():
    """the agent's 68 items as the base, with the first sprint's fixes and the seed's extra items merged in"""
    b = load('B_scorecard.json')
    if not b:
        return
    seed = json.load(open(os.path.join(DATA, 'scorecard_seed.json'), encoding='utf-8'))
    items = []
    for it in b.get('items', []):
        it = dict(it)
        it['dates'] = sorted(d for d in (it.get('dates') or []) if re.match(r'^\d{4}-\d{2}', d))
        it['status'] = it['status'].lower().strip()
        it['area'] = AREA.get(it.get('area', ''), (it.get('area') or '').split(' / ')[0])
        it['featured'] = it['id'] in FEATURED
        if it['id'] == 'venezuela-maduro':
            it['dates'] = ['2026-01-03']
            it['action'] = 'Operation Absolute Resolve, Jan. 3, 2026: a U.S. raid on Caracas captured Nicolás Maduro, with Congress not notified in advance; a Senate war-powers resolution failed 52–47. ' + it['action'].split(' (BBC')[0] + '.'
            it['sources'].append({'title': '2026 United States intervention in Venezuela', 'publisher': 'Wikipedia', 'url': 'https://en.wikipedia.org/wiki/2026_United_States_intervention_in_Venezuela', 'date': '2026-11-08'})
            it['note'] = 'Far beyond the Mandate, which called only for pressure on the Maduro government.'
        if it['id'] == 'voa-usagm':
            it['status'] = 'blocked by courts'
            it['dates'] = ['2025-03-14', '2026-03-08']
            it['action'] += ' On March 8, 2026 Judge Lamberth granted summary judgment: Kari Lake’s tenure was unlawful and the reduction in force void.'
            it['note'] = 'The D.C. Circuit appeals were not checked this sprint.'
            it['sources'].insert(0, {'title': 'Federal judge rules actions to dismantle Voice of America are illegal', 'publisher': 'WTOP / AP', 'url': 'https://wtop.com/national/2026/03/federal-judge-rules-trump-administrations-actions-to-dismantle-voice-of-america-are-illegal/', 'date': '2026-03-08'})
        if it['id'] == 'tariffs':
            it['status'] = 'partial'
            it['note'] = 'Scored partial: the emergency tariffs were struck down and the effective rate fell from about 27 percent to 12 percent (Yale Budget Lab, July 2026), though the direction survived under other statutes. The Mandate itself took no single position.'
            it['sources'].append({'title': 'Tariffs in the second Trump administration (Yale Budget Lab figures as compiled)', 'publisher': 'Wikipedia', 'url': 'https://en.wikipedia.org/wiki/Tariffs_in_the_second_Trump_administration', 'date': '2026-11-08'})
        items.append(it)
    have = {i['id'] for i in items}
    for it in seed['items']:
        it['area'] = AREA.get(it.get('area', ''), (it.get('area') or '').split(' / ')[0])
        if it['id'] in ('probationary-firings', 'inspectors-general', 'military-leadership', 'third-country-removals', 'intelligence-purge', 'press-access', 'roving-stops', 'speech-removals', 'vaccine-policy', 'hhs-cuts') and it['id'] not in have:
            items.append(it)
    save('scorecard.json', {'items': items, 'dek': seed.get('dek', '').replace(str(len(seed['items'])), str(len(items))), 'method': seed.get('method', ''), 'meta': b.get('meta', {})})


if __name__ == '__main__':
    markets()
    chapters()
    courts()
    people()
    impact()
    promises()
    scorecard()
