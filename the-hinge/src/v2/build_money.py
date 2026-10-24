"""Merge the "follow the money" research into DATA.money for The Hinge.

Inputs (all in ../data):
  money_national.json, money_ohio.json, money_east.json, money_plains.json, money_north.json, money_house.json
      research files (one per slice), every fact with a source URL
  money_flows.json   hand-curated: one figure per donor->group and group->race flow, with its basis
  ad_scores.json     hand-written: per-ad summary, swing-pull sub-scores and accuracy grade, keyed by ad id
"""
import json, os, re, hashlib

DD = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
FILES = ["money_national.json", "money_ohio.json", "money_east.json", "money_plains.json", "money_north.json", "money_house.json"]


def load(name, default=None):
    p = os.path.join(DD, name)
    if not os.path.exists(p):
        return default
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def num(v):
    try:
        if v is None or v == "":
            return None
        return float(v)
    except (TypeError, ValueError):
        return None


def ad_id(race_id, ad):
    key = "|".join(str(x or "").strip().lower() for x in (race_id, ad.get("side"), ad.get("sponsor"), ad.get("title"), ad.get("date")))
    return race_id.lower() + "-" + hashlib.sha1(key.encode("utf-8")).hexdigest()[:8]


YT = re.compile(r"(?:youtube\.com/(?:watch\?v=|shorts/|embed/)|youtu\.be/)([A-Za-z0-9_-]{11})")


def yt_id(url):
    m = YT.search(url or "")
    return m.group(1) if m else None


PLACEHOLDER = re.compile(r"^\s*(not found|untitled[^()]*|unknown)\s*(?:\((.*)\))?\s*$", re.I)


def clean_title(t):
    """Research placeholders like 'not found (Angela Paxton ad)' become (None, 'Angela Paxton ad')."""
    t = (t or "").strip()
    m = PLACEHOLDER.match(t)
    if m:
        return None, (m.group(2) or "").strip() or None
    return (t or None), None


def clean_sponsor(s):
    s = (s or "").strip()
    # drop long research asides in parentheses, keep short ones such as "(Sherrod Brown campaign)"
    s = re.sub(r"\s*\(([^()]{28,})\)", "", s)
    return s.strip() or None


def clean_ad(race_id, a):
    yt = a.get("youtube_url") or None
    vid = yt_id(yt) if yt else None
    if yt and not vid:          # not a recognisable YouTube video link: keep it as a plain video link
        a.setdefault("video_url", yt)
        yt = None
    return dict(
        id=ad_id(race_id, a), race=race_id, side=(a.get("side") or "").upper()[:1] or None,
        sponsor=clean_sponsor(a.get("sponsor")), sponsorType=a.get("sponsor_type"), title=clean_title(a.get("title"))[0], desc=clean_title(a.get("title"))[1], date=a.get("date"),
        len=num(a.get("length_sec")), yt=("https://www.youtube.com/watch?v=" + vid) if vid else None, ytId=vid,
        video=a.get("video_url") if not vid else None, foundVia=a.get("url_found_via"),
        transcript=(a.get("transcript") or "").strip() or None, complete=a.get("transcript_completeness"),
        transcriptSrc=a.get("transcript_source"), spendBehind=a.get("spend_behind"),
        onScreen=a.get("on_screen_sources") or [], tone=a.get("tone_reported"), issues=a.get("issues") or [],
        factChecks=a.get("fact_checks") or [], claims=a.get("central_claims") or [], coverage=a.get("coverage_url"),
        notes=a.get("notes"),
    )


PARTIAL = [(r"Q3 \(Jul|Q3 2026 \(Jul", "July–Sept"), (r"Q2 2026 \(April|Q2 2026 raise", "April–June"), (r"Q1 2026 \(Jan", "Jan–March"),
           (r"March-June 2026", "March–June"), (r"September contributions only", "September"), (r"July 2026 only", "July"),
           (r"48 hours after", "the 48 hours after the primary"), (r"since becoming nominee", "the weeks since becoming the nominee"),
           (r"period not stated|reporting period not shown", "a period not stated")]
OFFICIAL = re.compile(r"^(FEC|Ohio Secretary of State|Cycle through .*FEC)", re.I)


def period_of(basis):
    for pat, lab in PARTIAL:
        if re.search(pat, basis or "", re.I):
            return lab
    return None


def is_announced(basis):
    b = basis or ""
    return bool(re.search(r"campaign[- ](announced|reported)|campaign said|^'raised|ActBlue|OpenSecrets|Campaign-announced", b, re.I)) and not OFFICIAL.search(b)


def latest_fund(entries):
    """One fundraising line per candidate: the latest cycle-to-date figure (official filings first), its cash on hand,
    and, when a newer partial-period figure exists (a quarter, a month, days after a primary), that figure as an extra."""
    by = {}
    for e in entries or []:
        if num(e.get("raised")) is None and num(e.get("cash_on_hand")) is None:
            continue
        by.setdefault(e.get("candidate") or "?", []).append(e)
    out = []
    for c, ents in by.items():
        key = lambda e: (e.get("as_of") or "", 1 if OFFICIAL.search(e.get("basis") or "") else 0)
        withr = [e for e in ents if num(e.get("raised")) is not None]
        cyc = [e for e in withr if not period_of(e.get("basis"))]
        part = [e for e in withr if period_of(e.get("basis"))]
        main = max(cyc, key=key) if cyc else (max(part, key=key) if part else max(ents, key=key))
        mper = period_of(main.get("basis")) if main in part else None
        cash, cash_as = num(main.get("cash_on_hand")), main.get("as_of")
        if cash is None:
            cands = [e for e in ents if num(e.get("cash_on_hand")) is not None and e.get("as_of")]
            same = [e for e in cands if e.get("as_of") == main.get("as_of")]
            pick = same[0] if same else (max(cands, key=key) if cands else None)
            if pick:
                cash, cash_as = num(pick.get("cash_on_hand")), pick.get("as_of")
        extra = None
        later = [e for e in part if e is not main and ((e.get("as_of") or "") > (main.get("as_of") or "") or (mper and period_of(e.get("basis")) != mper and (e.get("as_of") or "") >= (main.get("as_of") or "")))]
        if later:
            x = max(later, key=key)
            extra = dict(raised=num(x.get("raised")), period=period_of(x.get("basis")), announced=is_announced(x.get("basis")), asOf=x.get("as_of"), source=x.get("source"), url=x.get("url"))
        out.append(dict(name=c, party=main.get("party"), raised=num(main.get("raised")), spent=num(main.get("spent")), cash=cash, cashAsOf=cash_as,
                        period=mper, announced=is_announced(main.get("basis")), basis=main.get("basis"), asOf=main.get("as_of"),
                        source=main.get("source"), url=main.get("url"), extra=extra))
    return out


def build_money(DATA=None):
    races, national, house_rank = [], {}, []
    for fn in FILES:
        d = load(fn, {}) or {}
        if fn == "money_national.json":
            donors = d.get("donors", [])
            national = dict(
                donors=[x for x in donors if not str(x.get("donor", "")).startswith("AGGREGATE")],
                aggregates=[x for x in donors if str(x.get("donor", "")).startswith("AGGREGATE")],
                groups=d.get("groups", []), adTotals=d.get("ad_totals", []), gaps=d.get("gaps", []),
            )
        if fn == "money_house.json":
            house_rank = d.get("house_rankings", [])
        for r in d.get("races", []):
            rid = r.get("race_id")
            if not rid:
                continue
            races.append(dict(
                id=rid, name=r.get("race"), cands=r.get("candidates") or {},
                fund=latest_fund(r.get("fundraising")),
                ads=[clean_ad(rid, a) for a in r.get("ads") or [] if a.get("selected") is not False and not str(a.get("notes") or "").lstrip().upper().startswith("SUPERSEDED")], notes=r.get("notes"), gaps=r.get("gaps") or [],
                src=fn,
            ))
    sel = load("ad_selection.json", {}) or {}
    excl, move = sel.get("exclude", {}), sel.get("move", {})
    byrace = {r["id"]: r for r in races}
    for x in sel.get("extra", []):          # ads found in notes, added so the same selection rule holds everywhere
        if x.get("race") in byrace:
            byrace[x["race"]]["ads"].append(clean_ad(x["race"], x))
    moved = []
    for r in races:
        keep = []
        for a in r["ads"]:
            if a["id"] in excl:
                continue
            if a["id"] in move and move[a["id"]] in byrace and move[a["id"]] != r["id"]:
                a["race"] = move[a["id"]]; moved.append(a); continue
            keep.append(a)
        r["ads"] = keep
    for a in moved:
        byrace[a["race"]]["ads"].append(a)
    flows = load("money_flows.json", {"nodes": [], "links": []})
    scores = load("ad_scores.json", {}) or {}
    raceInfo = (flows or {}).get("races", {})
    for r in races:
        info = raceInfo.get(r["id"], {})
        r.update({k: v for k, v in info.items() if k in ("adTotal", "adD", "adR", "adBasis", "adAsOf", "adSrc", "adUrl", "label", "kind", "district", "headline", "outD", "outR", "outBasis", "outNote", "story")})
        for a in r["ads"]:
            sc = scores.get(a["id"])
            if sc:
                a["score"] = sc
    # stable order: biggest ad markets first, then House districts
    return dict(asOf="2026-10-12", national=national, houseRank=house_rank, races=races, flows=flows,
                method=(flows or {}).get("method", {}))


if __name__ == "__main__":
    M = build_money()
    n_ads = sum(len(r["ads"]) for r in M["races"])
    yt = sum(1 for r in M["races"] for a in r["ads"] if a["yt"])
    full = sum(1 for r in M["races"] for a in r["ads"] if a["complete"] == "full")
    print("races", len(M["races"]), "ads", n_ads, "with YouTube", yt, "full scripts", full)
    for r in M["races"]:
        for a in r["ads"]:
            print(a["id"], a["side"], (a["sponsor"] or "")[:30], "|", (a["title"] or "")[:40], "|", a["complete"], "| yt" if a["yt"] else "")
