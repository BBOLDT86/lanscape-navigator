"""v2 data: everything from v1 plus markets, the history ('bread and peace') model, and the information environment."""
import json, math, os, sys, datetime as dt
import numpy as np

SP = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "")
sys.path.insert(0, SP)
os.chdir(SP)
import build_data as V1                       # builds the v1 DATA dict on import
DATA = V1.DATA
HIST = json.load(open(SP + "data/history.json"))
ECON = {int(k): v for k, v in json.load(open(SP + "econ/derived.json")).items()}
load = lambda f: json.load(open(SP + "data/" + f)) if os.path.exists(SP + "data/" + f) else {}
MK = load("markets.json")
WE = load("war_econ.json")
INF = load("info_env.json")
OVR = load("v2_overrides.json")               # hand-checked fills/corrections, each with a source

def num(v):
    try:
        return None if v is None or v == "" else float(v)
    except (TypeError, ValueError):
        return None

# ----------------------------------------------------------------------------- history model
MID = {m["year"]: m for m in HIST["midterm_history"]}
GEN = {g["year"]: g for g in HIST["generic_history"]}

def house_vote(year, we_row, prev=False):
    """(d, r, source) national House popular vote. 2002+ from the v1 history file, earlier from war_econ.json, overrides win."""
    key = f"house_vote_{year}"
    if key in OVR.get("house_vote", {}):
        o = OVR["house_vote"][key]; return o["d"], o["r"], o["source"]
    if year in GEN and GEN[year].get("actual_detail"):
        a = GEN[year]["actual_detail"]; return a["d_pct"], a["r_pct"], a.get("source", "Wikipedia")
    if we_row:
        hv = we_row.get("house_vote_prev" if prev else "house_vote") or {}
        if num(hv.get("d")) is not None and num(hv.get("r")) is not None:
            return num(hv["d"]), num(hv["r"]), hv.get("source")
    return None, None, None

we_by = {m["year"]: m for m in WE.get("midterms", [])}
rows = []
for y in sorted(MID):
    m = MID[y]; w = we_by.get(y, {})
    party = m["party"]
    d, r, src = house_vote(y, w)
    pd_, pr_, psrc = house_vote(y - 2, w, prev=True)
    if None in (d, r, pd_, pr_):
        continue
    share = 100 * (d if party == "D" else r) / (d + r)
    prev_share = 100 * (pd_ if party == "D" else pr_) / (pd_ + pr_)
    rdi = (w.get("rdi_pc") or {})
    inc = num(OVR.get("rdi", {}).get(str(y), {}).get("yoy")) if str(y) in OVR.get("rdi", {}) else num(rdi.get("yoy_pct"))
    war = w.get("war") or {}
    wo = OVR.get("war", {}).get(str(y), {})
    deaths = num(wo.get("deaths")) if wo else num(war.get("us_hostile_deaths_year"))
    heavy = bool(wo.get("heavy")) if wo else False
    sent = num(OVR.get("sentiment", {}).get(str(y))) if str(y) in OVR.get("sentiment", {}) else num((w.get("sentiment_oct") or {}).get("value"))
    un = num((w.get("unemp_oct") or {}).get("value")) or ECON.get(y, {}).get("unemp_annual")
    rows.append(dict(year=y, pres=m["president"], party=party, approval=m["approval"], seats=m["house_change"], senate=m["senate_change"],
                     share=round(share, 2), prevShare=round(prev_share, 2), dV=round(share - prev_share, 2),
                     inc=inc, infl=ECON.get(y, {}).get("cpi_sep_yoy"), unemp=un, deaths=int(deaths) if deaths is not None else 0, heavy=heavy,
                     deathsLabel=wo.get("deathsLabel"), warNote=wo.get("note"), warUrl=wo.get("source"),
                     warName=(wo.get("name") or war.get("name") or "") if (deaths or 0) > 0 else "",
                     sentiment=sent, voteSrc=src, prevSrc=psrc, incSrc=rdi.get("source"), warSrc=war.get("source")))

def ols(X, y):
    X = np.asarray(X, float); y = np.asarray(y, float)
    n, k = X.shape
    beta, *_ = np.linalg.lstsq(X, y, rcond=None)
    res = y - X @ beta
    s2 = res @ res / max(n - k, 1)
    XtXi = np.linalg.pinv(X.T @ X)
    cov = s2 * XtXi
    H = X @ XtXi @ X.T
    loo = res / (1 - np.clip(np.diag(H), None, 0.999))
    r2 = 1 - (res @ res) / ((y - y.mean()) @ (y - y.mean()))
    return dict(beta=beta, cov=cov, sigma=math.sqrt(s2), loo_rmse=float(np.sqrt(np.mean(loo ** 2))), r2=float(r2), res=res, n=n)

FXPY = {
    "app": lambda r: r["approval"] - 50,
    "inc": lambda r: r["inc"],
    "infl": lambda r: r["infl"],
    "war": lambda r: 1.0 if r.get("heavy") else 0.0,
    "prev": lambda r: r["prevShare"] - 50,
}
LABELS = {"app": "Approval (points above or below 50%)", "inc": "Real income per person (% change)", "infl": "Inflation (%)",
          "war": "Heavy-casualty war (hundreds of U.S. combat deaths that year)", "prev": "Previous presidential-year vote share above 50%"}

def fit(keys, data):
    use = [r for r in data if all(FXPY[k](r) is not None for k in keys)]
    X = [[1.0] + [FXPY[k](r) for k in keys] for r in use]
    y = [r["dV"] for r in use]
    return ols(X, y), use

H2 = None
if len(rows) >= 12:
    specs = {"A": ["app", "prev"], "B": ["app", "inc", "prev"], "C": ["app", "inc", "war", "prev"], "D": ["app", "infl", "war", "prev"], "E": ["app", "inc", "infl", "war", "prev"]}
    results = {}
    for name, keys in specs.items():
        try:
            f, use = fit(keys, rows); results[name] = (f, use, keys)
        except Exception as e:
            print("spec", name, "failed", e)
    for name, (f, use, keys) in results.items():
        print(f"spec {name} {keys}: n={f['n']} R2={f['r2']:.2f} sigma={f['sigma']:.2f} LOO={f['loo_rmse']:.2f} beta={np.round(f['beta'], 3)}")
    pick = OVR.get("spec", "C") if OVR.get("spec", "C") in results else max(results, key=lambda k: -results[k][0]["loo_rmse"])
    f, use, keys = results[pick]
    naive = ols([[1.0] for _ in use], [r["dV"] for r in use])
    names = ["const"] + keys
    se = {nm: float(math.sqrt(f["cov"][i][i])) for i, nm in enumerate(names)}
    coef = {nm: float(f["beta"][i]) for i, nm in enumerate(names)}
    for i, r in enumerate(use):
        r["fitted"] = round(r["dV"] - float(f["res"][i]), 2)
    # bivariate fits for the scatter lines
    def biv(xk):
        pts = [(r[xk], r["dV"]) for r in rows if r.get(xk) is not None]
        b, a = np.polyfit([p[0] for p in pts], [p[1] for p in pts], 1)
        return dict(a=float(a), b=float(b))
    READ = {
        "app": f"each 10 points of approval is worth about {abs(coef['app'])*10:.1f} points of vote share",
        "inc": f"each point of real income growth: {coef.get('inc', 0):+.2f} points" if "inc" in coef else "",
        "infl": f"each point of inflation: {coef.get('infl', 0):+.2f} points" if "infl" in coef else "",
        "war": f"fighting a heavy-casualty war: {coef.get('war', 0):+.1f} points, on top of what it does to approval" if "war" in coef else "",
        "prev": f"a party that ran 4 points above 50% two years earlier gives back {abs(coef['prev'])*4:.1f}" if "prev" in coef else "",
    }
    # ------------------------------------------------------------------ 2026 inputs
    now_we = WE.get("now_2026", {})
    nowO = OVR.get("now", {})
    g24 = GEN[2024]["actual_detail"]; vprev = 100 * g24["r_pct"] / (g24["d_pct"] + g24["r_pct"])
    def pick_now(key, fallback=None):
        if key in nowO: return nowO[key]
        return fallback
    now = dict(
        approval=pick_now("approval"), approvalSrc=pick_now("approvalSrc", ""),
        income=pick_now("income"), incomeSrc=pick_now("incomeSrc", ""),
        inflation=ECON[2026]["cpi_sep_yoy"], inflationSrc="CPI-U, August 2026 vs. August 2025 (BLS)",
        war=pick_now("war", 0), warLabel=pick_now("warLabel", ""), warNote=pick_now("warNote", ""),
        vPrev=round(vprev, 2), sentiment=pick_now("sentiment"), sentimentSrc=pick_now("sentimentSrc", ""),
        gas=pick_now("gas"), gasYoY=pick_now("gasYoY"), gasSrc=pick_now("gasSrc", ""),
        unemp=pick_now("unemp"),
    )
    x26 = {"app": now["approval"] - 50 if now["approval"] is not None else None, "inc": now["income"], "infl": now["inflation"],
           "war": 1.0 if now["war"] else 0.0, "prev": vprev - 50}
    # ------------------------------------------------------------------ analogs
    feats = OVR.get("analog_features", {"app": 2.0, "infl": 1.0, "inc": 1.0, "war": 1.0, "unemp": 0.5})
    def fv(r, k):
        return {"app": r["approval"], "infl": r["infl"], "inc": r["inc"], "war": 1.0 if r.get("heavy") else 0.0, "unemp": r["unemp"]}[k]
    now_f = {"app": now["approval"], "infl": now["inflation"], "inc": now["income"], "war": x26["war"], "unemp": now["unemp"]}
    stats = {}
    for k in feats:
        vals = [fv(r, k) for r in rows if fv(r, k) is not None]
        stats[k] = (float(np.mean(vals)), float(np.std(vals)) or 1.0)
    analogs = []
    for r in rows:
        d2 = 0; wsum = 0
        for k, wgt in feats.items():
            a, b = fv(r, k), now_f.get(k)
            if a is None or b is None: continue
            mu, sd = stats[k]; d2 += wgt * ((a - b) / sd) ** 2; wsum += wgt
        if wsum == 0: continue
        bits = [f"approval {r['approval']}%"]
        if r["infl"] is not None: bits.append(f"inflation {r['infl']:.1f}%")
        if r["inc"] is not None: bits.append(f"real income {r['inc']:+.1f}%")
        if r.get("heavy"): bits.append(f"war in {r['warName']} ({r.get('deathsLabel') or format(r['deaths'], ',')} U.S. deaths that year)")
        if r["unemp"] is not None: bits.append(f"unemployment {r['unemp']:.1f}%")
        analogs.append(dict(year=r["year"], pres=r["pres"] + " (" + r["party"] + ")", dist=round(math.sqrt(d2 / wsum), 3), dV=r["dV"], seats=r["seats"], why=(lambda t: t[:1].upper() + t[1:])("; ".join(bits)) + "."))
    analogs.sort(key=lambda a: a["dist"])
    H2 = dict(
        rows=rows,
        model=dict(keys=keys, coef=coef, se=se, cov=f["cov"].tolist(), sigma=f["sigma"], r2=f["r2"], n=f["n"], loo_rmse=f["loo_rmse"], naive_rmse=naive["loo_rmse"],
                   labels=LABELS, read=READ, spec=pick, specs={k: dict(keys=v[2], loo=v[0]["loo_rmse"], r2=v[0]["r2"]) for k, v in results.items()}),
        fits=dict(approval=biv("approval"), income=biv("inc")),
        now=now, analogs=analogs[:5],
        cases=OVR.get("cases") or WE.get("cases", []), models=OVR.get("models") or WE.get("models", []), literature=OVR.get("literature") or WE.get("literature", []),
        modelNote="Dependent variable: the change in the president’s party’s share of the two-party national House vote, from the previous presidential year to the midterm.",
        fitNote=OVR.get("fitNote", ""),
        warNote=OVR.get("warNote", ""), nowSrc=dict(approvalUrl=OVR.get("now", {}).get("approvalUrl")),
        analogNote=OVR.get("analogNote", "Distance on approval (double weight), inflation, real income growth, a war with heavy U.S. losses, and unemployment (half weight), each measured in standard deviations across the 20 midterms. A longer bar means a closer match."),
    )

# ----------------------------------------------------------------------------- markets
def build_markets():
    if not MK: return None
    order = ["HOUSE", "SENATE", "OH-GOV", "OH-SP", "NC-S", "ME-S", "GA-S", "MI-S", "NH-S", "IA-S", "TX-S", "AK-S", "NE-S", "MN-S", "KS-S", "BOP"]
    rows = {}
    labels = {"HOUSE": "House control", "SENATE": "Senate control", "BOP": "Balance of power"}
    for c in MK.get("current", []):
        rid = c.get("race_id"); p = num(c.get("p")); v = c.get("venue")
        if rid not in order or p is None or v not in ("Kalshi", "Polymarket", "PredictIt"): continue
        out = (c.get("outcome") or "").lower()
        if rid == "NE-S" and out == "democratic": continue        # no Democrat on the ballot; Osborn is the D-side
        dside = out in ("democratic", "independent")
        if not dside and out != "republican": continue
        pd_ = p if dside else 1 - p
        r = rows.setdefault(rid, dict(id=rid, label=labels.get(rid), venues={}, ids={}))
        prevv = r["venues"].get(v)
        if prevv and prevv.get("_d"): continue      # keep the price quoted for the Democratic side when both are listed
        r["venues"][v] = dict(p=round(pd_, 4), at=c.get("as_of"), url=c.get("url"), vol=num(c.get("volume_usd")), _d=dside)
    ids = MK.get("ids", {})
    DSIDE = ("democratic", "independent")
    for e in ids.get("polymarket", []):
        rid = e.get("race_id")
        if rid not in order or rid == "BOP": continue
        mk = e.get("markets") or []
        pick_ = None
        if rid == "NE-S": pick_ = next((m for m in mk if (m.get("outcome") or "").lower() == "independent"), None)
        if not pick_: pick_ = next((m for m in mk if (m.get("outcome") or "").lower() == "democratic"), None)
        inv = False
        if not pick_:
            pick_ = next((m for m in mk if (m.get("outcome") or "").lower() == "republican"), None); inv = True
        if not pick_ or not (pick_.get("tokens") or {}).get("Yes"): continue
        rows.setdefault(rid, dict(id=rid, label=labels.get(rid), venues={}, ids={}))["ids"]["polymarket"] = dict(slug=pick_.get("market_slug"), token=str(pick_["tokens"]["Yes"]), invert=inv, event=e.get("event_slug"))
    for e in ids.get("kalshi", []):
        rid = e.get("race_id"); mk = e.get("markets") or {}
        if rid not in order or rid == "BOP" or not isinstance(mk, dict): continue
        if rid == "NE-S" and "Independent" in mk: tk, inv = mk["Independent"], False
        elif "Democratic" in mk: tk, inv = mk["Democratic"], False
        elif "Republican" in mk: tk, inv = mk["Republican"], True
        else: continue
        rows.setdefault(rid, dict(id=rid, label=labels.get(rid), venues={}, ids={}))["ids"]["kalshi"] = dict(ticker=tk, invert=inv, series=e.get("series"), event=e.get("event"))
    for e in ids.get("predictit", []):
        rid = e.get("race_id"); ct = e.get("contracts") or {}
        if rid not in order: continue
        dk = next((k for k in ct if any(t in k.lower() for t in ("democrat", "osborn", "independent", "acton", "brown"))), None)
        if dk: rows.setdefault(rid, dict(id=rid, label=labels.get(rid), venues={}, ids={}))["ids"]["predictit"] = dict(market=e.get("market_id"), contract=ct[dk], invert=False)
    for r in rows.values():
        for v in r["venues"].values(): v.pop("_d", None)
    hist = []
    for h in MK.get("history", []):
        out = (h.get("outcome") or "").lower(); dside = not any(t in out for t in ("republican", "gop"))
        pts = [[p[0][:10], round(p[1] if dside else 1 - p[1], 4)] for p in h.get("points", []) if p and num(p[1]) is not None]
        if pts: hist.append(dict(id=h.get("race_id"), venue=h.get("venue"), pts=pts, source=h.get("source")))
    board = [rows[k] for k in order if k in rows and (rows[k]["venues"] or rows[k]["ids"]) and k != "BOP"]
    import re as _re
    def brk(venue, pat):
        outl = []
        for c in MK.get("current", []):
            if c.get("race_id") != "OTHER" or c.get("venue") != venue: continue
            o = c.get("outcome") or ""
            if not _re.search(pat, o): continue
            outl.append(dict(label=o, p=num(c.get("p")), bid=num(c.get("bid")), ask=num(c.get("ask"))))
        return outl
    brackets = dict(
        houseSeats=brk("Kalshi", r"^D seats (Below 210|Above 249|2\d\d-2\d\d)$"),
        senateSeats=brk("Kalshi", r"^D seats (Below 45|Above 52|4\d|5[0-2])$"),
        popKalshi=brk("Kalshi", r"^(Republicans win|Democrats, )"),
        popPoly=brk("Polymarket", r"^(Democrats|Republicans) \d"),
        bop=[dict(venue=c["venue"], label=c["outcome"], p=num(c.get("p"))) for c in MK.get("current", []) if c.get("race_id") == "BOP"],
    )
    return dict(asOf=MK.get("fetched_at"), rows=board, history=hist, brackets=brackets, track=MK.get("track_record", []), studies=MK.get("studies", []), landscape=OVR.get("landscape") or MK.get("landscape", []), gaps=MK.get("gaps", []), notes=MK.get("method_notes", []))

# ----------------------------------------------------------------------------- information environment
def build_info():
    if not INF: return None
    out = {k: INF.get(k, []) for k in ("news_diet", "ai_events", "rules", "persuasion", "polling", "polarization", "money", "markets_media", "gaps")}
    out.update(OVR.get("info", {}))       # hand-built chart rows (news_chart, persuasion_chart) and notes
    return out

DATA["markets"] = build_markets()
DATA["hist2"] = H2
DATA["info"] = build_info()
if H2:
    M_ = H2["model"]
    _xv = np.array([1.0] + [x26[k] for k in M_["keys"]])
    PRED_SD = 2 * math.sqrt(float(_xv @ np.array(M_["cov"]) @ _xv) + M_["sigma"] ** 2)   # in points of margin
    DATA["method"]["steps2"] = [
        dict(t="Polls", d="Everything on the Senate, House and Ohio tabs: the calibrated polling average and correlated simulation described above. It answers one question — what are voters telling pollsters, corrected for how polls have missed before?"),
        dict(t="History", d=f"A regression of the president’s party’s change in House vote share on approval, real income growth, whether the U.S. was fighting a war with heavy losses, and the party’s vote share two years earlier, fitted on **{M_['n']} midterms** (1946–2022). Its 2026 prediction sets the national environment for a second run of the same race-by-race engine with every race and generic-ballot poll set aside (approval, itself a polling average, remains an input); lean, incumbency, candidate records and district ratings stay. Its national error is the regression’s own prediction error (about ±{PRED_SD:.1f} points of margin), so it is the least certain witness."),
        dict(t="Markets", d="Prices from Kalshi, Polymarket and PredictIt, read as the chance of the Democratic side (Dan Osborn’s in Nebraska) and averaged across whichever venues quote one. The page asks Kalshi’s and Polymarket’s public data feeds for fresh prices when it opens and every five minutes after; if a feed doesn’t answer (some refuse requests from other websites), the page falls back to the snapshot taken on Oct 11. PredictIt stays at the Oct 11 snapshot reported by ElectionBettingOdds.com."),
        dict(t="Blend", d="For each contest, a weighted average of the three chances: **50% polls, 30% markets, 20% history** by default, adjustable in Model settings. These weights are a judgment, not an estimate: polls measure this electorate directly; markets have a mixed record (in 2024 Kalshi and Polymarket leaned toward the presidential winner while PredictIt did not, and in 2022 PredictIt and Polymarket both favored Republicans for a Senate that Democrats held); history’s error is largest. Seat counts and margins on the race tabs are the polls model’s."),
        dict(t="Information-age stress", d="Optional fat-tailed national error, for a world in which one viral event or a polling failure moves every race at once. It changes how often the unlikely result happens, not the most likely one."),
    ]
DATA["sources"] = [dict(s, label=s["label"].replace(" — ", ": ")) for s in DATA["sources"]] + OVR.get("sources", [])
DATA["meta"]["v2"] = True
import importlib.util as _ilu
_spec = _ilu.spec_from_file_location("build_money", SP + "v2/build_money.py"); _bm = _ilu.module_from_spec(_spec); _spec.loader.exec_module(_bm)
DATA["money"] = _bm.build_money(DATA)

if __name__ == "__main__":
    out = "const DATA = " + json.dumps(DATA, ensure_ascii=False, separators=(",", ":"), default=float) + ";"
    open(SP + "v2/data2.js", "w").write(out)
    print("wrote v2/data2.js", len(out), "rows", len(rows), "markets", bool(DATA["markets"]), "hist2", bool(H2), "info", bool(DATA["info"]))
