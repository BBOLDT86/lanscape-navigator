#!/usr/bin/env python3
"""The House, written: Claude (the API) writes a short note on every House seat (a Message Batch) and a reported piece
on the seats that mattered (tools/house.py picks them: the closest, the flips, the uncalled, the most outside money).
Shares the wave writer's client, prices, ledger and cap (tools/write.py).

  python3 news/wave/tools/house_write.py notes [--budget 12] [--wait 80]      -> data/house/notes.json (collects a batch still out)
  python3 news/wave/tools/house_write.py pieces [--budget 90] [--effort high] [--seats OH-9,TX-15] [--redo] [--parallel 3]
                                                                               -> data/house/reports/<ST-NN>.json
  python3 news/wave/tools/house_write.py refresh [--budget 3]                   -> rewrite what the count has changed
"""
import json, os, re, sys, time, argparse, threading, collections
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import write as wave
from write import NAME, now, save, load, margin, pts, n, message, Run, price, MODEL, api, parse_skeleton
import house as H
DATA = H.HD; MOCK = False
def usd(v): return H.usd(v)

PIECE_SYSTEM = wave.STATE_SYSTEM.replace("You are writing the piece for one state.", "You are writing the piece for one House seat: what happened in the district, who won and why, and what the county moves around it say.").replace(
    "maps every county's move between the 2024 Harris–Trump vote and the Nov. 3, 2026 vote for U.S. senator (or governor where there was no Senate race).",
    "maps every county's move between the 2024 Harris–Trump vote and the Nov. 3, 2026 vote; its House report follows all 435 seats.").replace(
    "- 650 to 950 words of body text. Three subheads, one of them about the voters: use the VOTER ANALYSIS block (the page draws it as charts next to that section) to say who moved — big counties or small, the reddest or the bluest, places where turnout fell or held, and, where the Census figures are given, Hispanic, educated, richer or poorer places — and whether turnout or persuasion better explains it. Give the numbers from the block; say plainly that counties are not voters.",
    "- 550 to 800 words of body text. Two or three subheads: the race (the candidates, the campaign, the issues the local press says decided it, the ads and the outside money if the block or the press has them), the district (what kind of place it is, the counties in it and how they moved on the wave), and what the result means (the seat's history, whether an incumbent lost, how close it was, what's still being counted).").replace(
    "<four lines, one per county the map should point at while the reader looks at it, chosen for the story — the biggest move, the most votes, the most telling flip, an exception — each as: FIPS | County label as a reader would say it (e.g. \"Starr County\", \"Cuyahoga County (Cleveland)\") | one clause of at most 18 words saying what it did, with its numbers from the data block>",
    "<up to three lines, one per county in the district worth pointing at, each as: FIPS | County label (e.g. \"Lucas County (Toledo)\") | one clause of at most 18 words on what it did, with its numbers from the data block; or nothing if the block has no counties>")

NOTE_SYSTEM = """You write one short note per House seat for The Watch's House report (all 435 seats as a hemicycle a reader taps). The reader has just tapped this seat and wants to know, in plain English, who won it and how.

Rules:
- Use only the numbers in the message: AP's count (the candidates, votes, the share counted, when AP called it) and the moves since 2024 of the counties in the district (from The Watch's wave data: the county's shift between the 2024 presidential vote and the 2026 Senate or governor vote, which is context, not the House vote). Do not add facts from memory about the district, the candidates or the campaign; do not guess why it went the way it did. Where the message gives the FEC's incumbency flag or outside money, use it.
- If less than 95% of the expected vote is counted, or the race is not called, say the numbers may still move.
- 60 to 110 words, one or two paragraphs, no headline, no bullet points, no markdown. Name the winner and the runner-up once, with parties. Round margins to one decimal; give vote totals with commas.
- Neutral and concrete; no cliché. Output the note only."""


def seat_block(s, full=True):
    L = [f"SEAT: {s['label']} ({s['short']}). AP via The New York Times, as of {H.ASOF}.",
         f"RESULT: " + '; '.join(f"{c[0]} ({c[1]}) {n(c[2])}" for c in s['cands']) + f". Margin {margin(s['margin'])} on {n(s['t'])} votes, {s['e'] if s['e'] is not None else '–'}% of the expected vote counted. " + (f"AP called it for {s['won']} at {s['called']} ET on election night." if s['called'] else "NOT CALLED by AP.")]
    if s['inc']: L.append(f"INCUMBENT (FEC): {s['inc']}" + (" — LOST (the seat changed hands)." if s['flip'] else " — won." if s['flip'] is False else '.'))
    elif s['open']: L.append("OPEN SEAT (no incumbent among the FEC's candidates).")
    if s['receipts']: L.append("RAISED (FEC Form 3 totals): " + '; '.join(f"{v[0]} ({v[1]}) {usd(v[2])}" for v in s['receipts'].values()))
    if s['ie']: L.append(f"OUTSIDE MONEY (FEC independent expenditures): {usd(s['ie_d'])} helping the Democratic side, {usd(s['ie_r'])} the Republican side; by committee: " + '; '.join(f"{nm} {usd(v)}" for nm, v in s['cmtes']))
    if s['counties']:
        L.append(f"THE DISTRICT'S COUNTIES on the wave (each county's move since 2024 in the Senate/governor vote; weighted {pts(s['cmove'])}): " + '; '.join(f"{nm} {pts(mv)}" for f, nm, mv in s['counties'][:30]))
        if full:
            rows = [(f, nm, H.S['counties'][f]) for f, nm, mv in s['counties'] if f in H.S['counties']]
            L.append("  county | FIPS | 2024 Harris–Trump | 2026 (Senate/gov.) | move | 2026 votes | % counted")
            for f, nm, v in sorted(rows, key=lambda x: -x[2][7])[:25]: L.append(f"  {nm} | {f} | {margin(v[0])} | {margin(v[1])} | {pts(v[2])} | {n(v[7])} | {v[3] if v[3] is not None else '–'}")
    st = s['st']
    if full and st in wave.S['states'] and wave.S['states'][st].get('use'):
        L.append(f"THE STATE: " + wave.race_lines(st).replace('\n', ' '))
    L.append(f"NATIONALLY: {H.D} seats called for Democrats, {H.R} for Republicans, {H.U} not called (218 is a majority).")
    return '\n'.join(L)

def piece_params(s, effort):
    return {'model': MODEL, 'max_tokens': 32000, 'output_config': {'effort': effort},
            'system': [{'type': 'text', 'text': PIECE_SYSTEM, 'cache_control': {'type': 'ephemeral'}}],
            'tools': [{'type': 'web_search_20250305', 'name': 'web_search', 'max_uses': 10, 'user_location': {'type': 'approximate', 'country': 'US', 'region': NAME.get(s['st'], s['st'])}}],
            'messages': [{'role': 'user', 'content': [{'type': 'text', 'text': f"Write The Watch's piece on the House seat {s['label']} ({s['short']}). Here is the data block.\n\n{seat_block(s)}"}]}]}
def note_params(s):
    return {'model': MODEL, 'max_tokens': 2500, 'output_config': {'effort': 'low'},
            'system': [{'type': 'text', 'text': NOTE_SYSTEM, 'cache_control': {'type': 'ephemeral'}}],
            'messages': [{'role': 'user', 'content': [{'type': 'text', 'text': seat_block(s, full=False)}]}]}
def snap(s): return {'p': s['p'], 'margin': s['margin'], 'e': s['e'], 'ie': s['ie']}
def stale(old, s):
    if not old: return True
    return old.get('p') != s['p'] or abs((old.get('margin') or 0) - (s['margin'] or 0)) > 1.0 or ((old.get('e') or 0) < 95 <= (s['e'] or 0)) or abs((old.get('ie') or 0) - s['ie']) > max(1e6, 0.25 * (s['ie'] or 1))

def mock_piece(s): return {'headline': f"{s['label']} (mock)", 'dek': 'A mock dek.', 'summary': 'Mock.', 'paras': [{'t': 'p', 'text': 'Mock lede.', 'cites': [[10, 1]]}], 'callouts': [], 'sources': [{'n': 1, 'title': 'Mock', 'url': 'https://example.com/'}], 'words': 20}

def cmd_pieces(a, stale_only=False):
    run = Run('house-pieces', a.budget); want = [x.strip().upper() for x in a.seats.split(',')] if a.seats else [s['id'] for s in H.PICK]
    todo = []
    for k in want:
        s = H.BY.get(k)
        if not s: print(f'{k}: no such seat'); continue
        old = load(os.path.join(DATA, 'reports', k + '.json'))
        if old and not a.redo and not stale(old.get('snapshot'), s): continue
        if stale_only and not old: continue
        todo.append(s)
    todo.sort(key=lambda s: -s['interest'])
    print(f'house pieces: {len(todo)} to write, effort {a.effort}, budget ${a.budget}')
    if a.dry: print(seat_block(todo[0] if todo else H.BY['OH-9'])); return
    sem = threading.Semaphore(max(1, a.parallel)); threads = []; done = []
    def work(s):
        with sem:
            if run.over(): print(f'  {s["id"]}: budget spent, skipped'); return
            t0 = time.time()
            try:
                if MOCK: rep = mock_piece(s); usage = {'input_tokens': 5000, 'output_tokens': 2500}; searches = 6
                else:
                    content, usage, searches, stop = message(piece_params(s, a.effort)); rep, raw = parse_skeleton(content, callouts=3)
                    run.charge(usage, searches=searches, what=f'house {s["id"]}')
                    if not rep or not rep['headline'] or rep['words'] < 250: save(os.path.join(DATA, 'reports', '_failed_' + s['id'] + '.txt'), {'stop': stop, 'doc': raw}); print(f'  {s["id"]}: could not parse ({stop})'); return
                rep.update({'seat': s['id'], 'label': s['label'], 'written': now(), 'asOf': H.S['asOf'], 'model': MODEL, 'effort': a.effort, 'searches': searches, 'usage': usage, 'usd': price(usage, searches=searches), 'seconds': round(time.time() - t0), 'snapshot': snap(s)})
                save(os.path.join(DATA, 'reports', s['id'] + '.json'), rep); done.append(s['id']); print(f'  {s["id"]}: "{rep["headline"]}" — {rep["words"]} words, {len(rep["sources"])} sources, {searches} searches', flush=True)
            except Exception as e: print(f'  {s["id"]}: FAILED {e}', flush=True)
    for s in todo: t = threading.Thread(target=work, args=(s,), daemon=True); t.start(); threads.append(t); time.sleep(2)
    for t in threads: t.join()
    print(run.summary(), f'— {len(done)} written')

NOTES_P = os.path.join(DATA, 'notes.json'); BATCH_P = os.path.join(DATA, '_batch.json')
def cmd_notes(a, stale_only=False):
    if load(BATCH_P) and not MOCK: return collect(a)
    run = Run('house-notes', a.budget); notes = (load(NOTES_P, {}) or {}).get('notes', {})
    todo = [s for s in H.SEATS if a.redo or s['id'] not in notes or stale(notes[s['id']].get('snapshot'), s)]
    if stale_only: todo = [s for s in todo if s['id'] in notes]
    per = (900 * wave.PRICE['in'] + 400 * wave.PRICE['out']) / 1e6 * 0.5; room = max(0.0, wave.CAP - wave.ledger().get('usd', 0.0)); fit = int(min(a.budget, room) / per)
    todo = todo[:fit]; print(f'house notes: {len(todo)} to write (~${len(todo) * per:.2f})')
    if a.dry: print(seat_block(todo[0] if todo else H.BY['OH-9'], full=False)); return
    if not todo: return
    if MOCK:
        for s in todo: put(notes, s, f"(Mock) {s['won'] or 'Nobody'} won {s['label']} by {margin(s['margin'])}.")
        save(NOTES_P, {'v': 1, 'updated': now(), 'notes': notes}); return
    resp = api('/v1/messages/batches', {'requests': [{'custom_id': s['id'], 'params': note_params(s)} for s in todo]})
    save(BATCH_P, {'id': resp['id'], 'n': len(todo), 'submitted': now()}); print(f'batch {resp["id"]}: {len(todo)} seats'); collect(a)
def put(notes, s, text): notes[s['id']] = {'t': text.strip(), 'w': now(), 'asOf': H.S['asOf'], 'snapshot': snap(s)}
def collect(a):
    pending = load(BATCH_P)
    if not pending: print('no house batch pending'); return
    run = Run('house-collect', None); waited = 0
    while True:
        b = api(f"/v1/messages/batches/{pending['id']}"); rc = b.get('request_counts') or {}
        print(f"batch {pending['id']}: {b.get('processing_status')} ({rc.get('processing', '?')} processing, {rc.get('succeeded', 0)} done, {rc.get('errored', 0)} errored)", flush=True)
        if b.get('processing_status') == 'ended': break
        if waited >= (a.wait or 0): print('still running; collect later'); return
        time.sleep(300); waited += 5
    try: os.remove(BATCH_P)
    except OSError: pass
    charged = any(pending['id'] in (r.get('what') or '') for r in wave.ledger()['runs'])
    notes = (load(NOTES_P, {}) or {}).get('notes', {}); ok = 0; usage_sum = {}
    if b.get('results_url'):
        for line in api('', raw=True, url=b['results_url']).splitlines():
            if not line.strip(): continue
            o = json.loads(line); k = o.get('custom_id'); res = o.get('result') or {}
            if res.get('type') != 'succeeded' or k not in H.BY: continue
            msg = res['message']; text = ''.join(c.get('text', '') for c in msg.get('content', []) if c.get('type') == 'text')
            if len(text.split()) < 25: continue
            put(notes, H.BY[k], text); ok += 1
            for kk, v in (msg.get('usage') or {}).items():
                if isinstance(v, int): usage_sum[kk] = usage_sum.get(kk, 0) + v
        if not charged: run.charge(usage_sum, batch=True, what=f'house batch {pending["id"]}: {ok} notes')
    save(NOTES_P, {'v': 1, 'updated': now(), 'notes': notes}); print(f'collected {ok} house notes')

def cmd_refresh(a):
    if load(BATCH_P): collect(a)
    cmd_notes(argparse.Namespace(**dict(vars(a), budget=min(a.budget, 1.0), redo=False)), stale_only=True)
    L = wave.ledger(); today = now()[:10]; used = sum(r['usd'] for r in L['runs'] if r['when'][:10] == today and r['job'].startswith('house')); left = max(0.0, a.budget - used)
    if left >= 1: cmd_pieces(argparse.Namespace(**dict(vars(a), budget=left, redo=False, seats=None, effort='high')), stale_only=True)

if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('job', choices=['notes', 'pieces', 'collect', 'refresh'])
    ap.add_argument('--budget', type=float, default=None); ap.add_argument('--seats', default=None); ap.add_argument('--effort', default='high', choices=['low', 'medium', 'high', 'xhigh', 'max'])
    ap.add_argument('--parallel', type=int, default=3); ap.add_argument('--wait', type=int, default=0); ap.add_argument('--redo', action='store_true'); ap.add_argument('--dry', action='store_true'); ap.add_argument('--mock', action='store_true')
    a = ap.parse_args(); MOCK = a.mock; wave.MOCK = a.mock
    if a.budget is None: a.budget = {'notes': 12.0, 'pieces': 90.0, 'refresh': 3.0}.get(a.job, 0.0)
    os.makedirs(os.path.join(DATA, 'reports'), exist_ok=True)
    {'notes': cmd_notes, 'pieces': cmd_pieces, 'collect': collect, 'refresh': cmd_refresh}[a.job](a)
