#!/usr/bin/env python3
"""Summit seat tracker.

Polls resale listings for John Summit at the Schottenstein Center (Fri Nov 13, 2026),
keeps the latest snapshot in data/, and pushes an alert (ntfy, with a GitHub issue as
backup) whenever something worth moving for shows up or changes:

  * any Floor / GA listing (new, price moved, or gone), and
  * any pair in rows A-C of the sections that beat 105 Row G
    (104-107, 110, 111, 114, 118, 121-124).

Sources are best-effort: each one is tried, failures are logged, and whatever answers
is used. Run with --fixture <file> to test on a saved sample, --dry to skip alerts.
"""
import datetime as dt
import html as htmlmod
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
os.makedirs(DATA, exist_ok=True)

EVENT_START_UTC = dt.datetime(2026, 11, 14, 0, 0, tzinfo=dt.timezone.utc)  # 7:00 PM ET
IDS = {"seatgeek": "18257252", "tickpick": "7982957", "vivid": "7058794",
       "gametime": "6a0e0197195b8559e5c73814", "stubhub": "161190840"}
LINKS = {
    "seatgeek": "https://seatgeek.com/john-summit-tickets/columbus-ohio-value-city-arena-at-schottenstein-center-2026-11-13-7-pm/concert/18257252",
    "tickpick": "https://www.tickpick.com/buy-john-summit-tickets-value-city-arena-at-the-schottenstein-center-11-13-26-7pm/7982957/",
    "vivid": "https://www.vividseats.com/john-summit-tickets-columbus-value-city-arena-at-schottenstein-center-11-13-2026--concerts-dance-electronica/production/7058794",
    "gametime": "https://gametime.co/concert/john-summit-tickets/11-13-2026-columbus-oh-schottenstein-center/events/6a0e0197195b8559e5c73814",
    "ticketmaster": "https://www.ticketmaster.com/event/050064B3F56A8E85",
    "stubhub": "https://www.stubhub.com/john-summit-columbus-tickets-11-13-2026/event/161190840/",
}
WATCH_SECTIONS = {"104", "105", "106", "107", "110", "111", "114", "118", "121", "122", "123", "124"}
WATCH_ROWS = {"A", "B", "C"}
OWN = {"section": "105", "row": "G"}  # what we hold; used for the "comparable" readout
TRACKER_URL = "https://bboldt86.github.io/lanscape-navigator/summit/tracker/"
DEFAULT_TOPIC = "summit-105g-9fed1325fb"

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/17.5 Safari/605.1.15")

LOG = []
DEBUG = {}


def log(msg):
    line = f"{dt.datetime.now(dt.timezone.utc).strftime('%H:%M:%S')} {msg}"
    LOG.append(line)
    print(line, flush=True)


def fetch(url, headers=None, timeout=25):
    h = {"User-Agent": UA, "Accept": "application/json,text/html;q=0.9,*/*;q=0.8",
         "Accept-Language": "en-US,en;q=0.9"}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, headers=h)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace"), r.headers.get("Content-Type", "")


def to_float(v):
    try:
        return float(str(v).replace("$", "").replace(",", ""))
    except Exception:
        return None


def to_int(v):
    try:
        return int(float(v))
    except Exception:
        return None


def norm_section(s):
    s = htmlmod.unescape(str(s or "")).strip().upper()
    s = re.sub(r"^(ENTRY|CLUB|TERRACE|LOWER|UPPER|LOGE|MEZZANINE)?\s*(LEVEL|BOWL)\s+", "", s)
    s = re.sub(r"^(ENTRY|CLUB|TERRACE|SECTION|SEC)\s+", "", s)
    return s.strip()


def norm_row(r):
    r = htmlmod.unescape(str(r or "")).strip().upper()
    r = re.sub(r"^ROW\s+", "", r)
    return r


def is_floor(l):
    s = l["section"]
    return any(w in s for w in ("FLOOR", "GA ", "GENERAL", "PIT", "STANDING")) or s in ("GA", "FLR")


def fits_pair(l):
    q = l.get("qty")
    if q is None or q >= 2:
        sp = l.get("splits")
        return True if not sp else (2 in sp)
    return False


def is_front(l):
    return l["section"] in WATCH_SECTIONS and l["row"] in WATCH_ROWS and fits_pair(l)


def mk(src, section, row, qty, price, splits=None, note=None):
    section = norm_section(section)
    row = norm_row(row)
    price = to_float(price)
    if not section or price is None or price <= 0:
        return None
    return {"src": src, "section": section, "row": row, "qty": to_int(qty), "price": round(price, 2),
            "splits": splits or None, "note": note}


def walk_lists(obj, depth=0):
    """Yield every list of dicts anywhere in a JSON blob (we don't trust key names)."""
    if depth > 6:
        return
    if isinstance(obj, list):
        if obj and all(isinstance(x, dict) for x in obj):
            yield obj
        for x in obj:
            yield from walk_lists(x, depth + 1)
    elif isinstance(obj, dict):
        for v in obj.values():
            yield from walk_lists(v, depth + 1)


def parse_json_listings(src, data):
    """Pull listings out of any of the JSON shapes these sites use."""
    out = []
    sec_keys = ("s", "section", "sectionName", "section_name", "sec", "sectionDisplayName", "section_group")
    row_keys = ("r", "row", "rowName", "row_name", "rowDisplayName")
    qty_keys = ("q", "quantity", "qty", "availableQuantity", "availableTickets", "ticketCount", "available_quantity")
    price_keys = ("allInPricePerTicket", "aip", "pf", "priceWithFees", "priceWithFeesNumeric", "rawPriceWithFees",
                  "p", "price", "dp", "rawPrice", "pricePerTicket", "fee_price", "listPrice", "display_price")
    for lst in walk_lists(data):
        if len(lst) >= 5 and src not in DEBUG:
            DEBUG[src] = {k: (str(v)[:60]) for k, v in list(lst[0].items())[:40]}
        hits = []
        for d in lst:
            sec = next((d[k] for k in sec_keys if k in d and d[k] not in (None, "")), None)
            row = next((d[k] for k in row_keys if k in d and d[k] not in (None, "")), None)
            price = next((d[k] for k in price_keys if k in d and d[k] not in (None, "", 0)), None)
            if sec is None or price is None:
                continue
            qty = next((d[k] for k in qty_keys if k in d), None)
            sp = d.get("sp") or d.get("splits")
            if isinstance(sp, list):
                sp = [to_int(x) for x in sp if to_int(x)]
            else:
                sp = None
            l = mk(src, sec, row, qty, price, sp)
            if l:
                hits.append(l)
        if len(hits) >= 5:
            out.extend(hits)
    # dedupe
    seen, uniq = set(), []
    for l in out:
        k = (l["section"], l["row"], l["qty"], l["price"])
        if k not in seen:
            seen.add(k)
            uniq.append(l)
    return uniq


# ---------------------------------------------------------------- sources
def src_seatgeek():
    eid = IDS["seatgeek"]
    urls = [
        f"https://seatgeek.com/api/event_listings_v2?client_id=MTY2MnwxMzgzMzIwMTU4&id={eid}&_wt=1",
        f"https://seatgeek.com/api/event_listings_v2?id={eid}",
        f"https://seatgeek.com/api/event_listings_v2?client_id=MTY2MnwxMzgzMzIwMTU4&id={eid}&quantity=2",
    ]
    last = None
    for u in urls:
        try:
            body, _ = fetch(u, {"Referer": LINKS["seatgeek"], "Accept": "application/json"})
            data = json.loads(body)
            got = parse_json_listings("seatgeek", data)
            if got:
                return got
            last = f"parsed 0 listings from {u}"
        except Exception as e:
            last = f"{type(e).__name__}: {e}"
    raise RuntimeError(last or "no data")


def src_tickpick():
    eid = IDS["tickpick"]
    urls = [
        f"https://api.tickpick.com/1.0/listings/internal/event/{eid}?lid=&qty=2&price=&sort=price_asc&type=all",
        f"https://api.tickpick.com/1.0/listings/internal/event/{eid}?lid=&qty=0&sort=price_asc",
        f"https://www.tickpick.com/api/1.0/listings/internal/event/{eid}?qty=2",
    ]
    last = None
    for u in urls:
        try:
            body, _ = fetch(u, {"Referer": LINKS["tickpick"], "Accept": "application/json", "Origin": "https://www.tickpick.com"})
            data = json.loads(body)
            got = parse_json_listings("tickpick", data)
            if got:
                return got
            last = f"parsed 0 listings from {u}"
        except Exception as e:
            last = f"{type(e).__name__}: {e}"
    raise RuntimeError(last or "no data")


def src_vivid():
    pid = IDS["vivid"]
    urls = [
        f"https://www.vividseats.com/hermes/api/v1/listings?productionId={pid}&includeIpAddress=false&currency=USD&priceGroupId=&localizeCurrency=true",
        f"https://www.vividseats.com/hermes/api/v1/listings?productionId={pid}",
    ]
    last = None
    for u in urls:
        try:
            body, _ = fetch(u, {"Referer": LINKS["vivid"], "Accept": "application/json"})
            data = json.loads(body)
            got = parse_json_listings("vivid", data)
            if got:
                return got
            last = f"parsed 0 listings from {u}"
        except Exception as e:
            last = f"{type(e).__name__}: {e}"
    raise RuntimeError(last or "no data")


def src_gametime():
    # Server-rendered listing text, when Gametime sends it: "Entry 104 , Row L ... $255 /ea"
    u = LINKS["gametime"] + "?quantity=2"
    body, _ = fetch(u, {"Accept": "text/html"})
    text = re.sub(r"<script.*?</script>|<style.*?</style>", " ", body, flags=re.S | re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = htmlmod.unescape(re.sub(r"\s+", " ", text))
    pat = re.compile(r"\b(Entry|Club|Terrace|Floor|Lower|Upper)\s+([A-Z0-9 ]{1,14}?)\s*,\s*Row\s+([A-Z0-9]{1,4})\b.{0,80}?\$\s?(\d[\d,]*)(?:\s*/\s*ea)?", re.I)
    out = []
    for m in pat.finditer(text):
        tier, sec, row, price = m.groups()
        sec = sec.strip()
        if tier.lower() == "floor":
            sec = "FLOOR " + sec if "FLOOR" not in sec.upper() else sec
        l = mk("gametime", sec, row, None, price)
        if l:
            out.append(l)
    if not out:
        # the embedded JSON some renders carry
        for m in re.finditer(r'"section"\s*:\s*"([^"]+)"\s*,\s*"row"\s*:\s*"([^"]*)"[^{}]{0,300}?"price"\s*:\s*(\d+(?:\.\d+)?)', body):
            l = mk("gametime", m.group(1), m.group(2), None, m.group(3))
            if l:
                out.append(l)
    if not out:
        raise RuntimeError("page had no listing text (JS-only render this time)")
    return out


def _json_scripts(body):
    """Yield (tag-id, parsed JSON) for every JSON script tag in an HTML page."""
    for m in re.finditer(r'<script[^>]*?(?:id="([^"]*)")?[^>]*type="application/(?:ld\+)?json"[^>]*>(.*?)</script>', body, re.S | re.I):
        try:
            yield (m.group(1) or ""), json.loads(m.group(2))
        except Exception:
            continue
    m = re.search(r'window\.__INITIAL_STATE__\s*=\s*(\{.*?\})\s*;?\s*</script>', body, re.S)
    if m:
        try:
            yield "__INITIAL_STATE__", json.loads(m.group(1))
        except Exception:
            pass


def src_stubhub():
    eid = IDS["stubhub"]
    base = LINKS["stubhub"]
    attempts = [
        ("GET", f"{base}?quantity=2", None),
        ("POST", f"{base}?quantity=2", "quantity=2&pageSize=50&sortBy=NEWPRICE_ASC_SORT"),
        ("GET", f"https://www.stubhub.com/event/{eid}/?quantity=2", None),
    ]
    last = None
    for method, u, payload in attempts:
        try:
            h = {"Referer": base, "Accept": "application/json, text/html;q=0.9"}
            req_body = payload.encode() if payload else None
            if payload:
                h["Content-Type"] = "application/x-www-form-urlencoded"
                h["X-Requested-With"] = "XMLHttpRequest"
            req = urllib.request.Request(u, data=req_body, method=method,
                                         headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9", **h})
            with urllib.request.urlopen(req, timeout=25) as r:
                body = r.read().decode("utf-8", "replace")
            DEBUG.setdefault("stubhub_probe", []).append({"url": u[:80], "method": method, "len": len(body),
                                                           "index-data": 'id="index-data"' in body,
                                                           "json_scripts": len(re.findall(r'type="application/json"', body))})
            data = None
            if body.lstrip().startswith("{") or body.lstrip().startswith("["):
                data = json.loads(body)
            else:
                blobs = [d for _id, d in _json_scripts(body)]
                data = blobs if blobs else None
            if data is None:
                last = f"no JSON in {method} {u}"
                continue
            got = parse_json_listings("stubhub", data)
            if got:
                return got
            last = f"parsed 0 listings from {method} {u}"
        except Exception as e:
            last = f"{type(e).__name__}: {e}"
    raise RuntimeError(last or "no data")


def src_gametime_api():
    eid = IDS["gametime"]
    urls = [
        f"https://mobile.gametime.co/v2/listings?event_id={eid}&quantity=2",
        f"https://mobile.gametime.co/v1/listings?event_id={eid}&quantity=2",
        f"https://mobile.gametime.co/v1/listings/{eid}?quantity=2",
    ]
    last = None
    for u in urls:
        try:
            body, _ = fetch(u, {"Accept": "application/json", "Origin": "https://gametime.co", "Referer": LINKS["gametime"]})
            data = json.loads(body)
            got = parse_json_listings("gametime", data)
            if got:
                return got
            last = f"parsed 0 listings from {u}"
        except Exception as e:
            last = f"{type(e).__name__}: {e}"
    raise RuntimeError(last or "no data")


def src_gametime_any():
    try:
        return src_gametime_api()
    except Exception as e1:
        try:
            return src_gametime()
        except Exception as e2:
            raise RuntimeError(f"api: {str(e1)[:70]} | page: {str(e2)[:70]}")


SOURCES = [("stubhub", src_stubhub), ("vivid", src_vivid), ("gametime", src_gametime_any),
           ("seatgeek", src_seatgeek), ("tickpick", src_tickpick)]


# ---------------------------------------------------------------- alerts
def key(l):
    return f"{l['src']}|{l['section']}|{l['row']}"


def label(l):
    if is_floor(l):
        extra = re.sub(r"\b(FLOOR|GA|GENERAL ADMISSION|STANDING)\b", "", l["section"]).strip(" -")
        return "Floor" + (f" {extra}" if extra else "")
    return f"{l['section']} Row {l['row']}" if l["row"] else l["section"]


def notify(title, body, click=TRACKER_URL, priority="high", tags="ticket"):
    topic = os.environ.get("NTFY_TOPIC") or DEFAULT_TOPIC
    ok = False
    try:
        req = urllib.request.Request(f"https://ntfy.sh/{topic}", data=body.encode("utf-8"), method="POST",
                                     headers={"Title": title, "Priority": priority, "Tags": tags, "Click": click,
                                              "Content-Type": "text/plain; charset=utf-8"})
        with urllib.request.urlopen(req, timeout=20) as r:
            ok = r.status < 300
        log(f"ntfy: {'sent' if ok else 'failed'} -> {topic}")
    except Exception as e:
        log(f"ntfy failed: {e}")
    return ok


def github_issue(title, body, state):
    """Backup channel: one issue, one comment per alert (owner gets GitHub's own notification)."""
    if not os.environ.get("GH_TOKEN") or not os.environ.get("GITHUB_REPOSITORY"):
        return
    repo = os.environ["GITHUB_REPOSITORY"]
    try:
        n = state.get("issue")
        if not n:
            out = subprocess.run(["gh", "issue", "create", "-R", repo, "-t", "Summit seat alerts (automated)",
                                  "-b", f"Alerts from the Summit seat tracker. Live view: {TRACKER_URL}"],
                                 capture_output=True, text=True, timeout=60)
            m = re.search(r"/issues/(\d+)", out.stdout + out.stderr)
            if m:
                n = int(m.group(1))
                state["issue"] = n
        if n:
            subprocess.run(["gh", "issue", "comment", "-R", repo, str(n), "-b", f"**{title}**\n\n{body}"],
                           capture_output=True, text=True, timeout=60)
            log(f"github issue #{n}: commented")
    except Exception as e:
        log(f"github issue failed: {e}")


def main():
    dry = "--dry" in sys.argv
    fixture = None
    if "--fixture" in sys.argv:
        fixture = sys.argv[sys.argv.index("--fixture") + 1]
    now = dt.datetime.now(dt.timezone.utc)
    if now >= EVENT_START_UTC and not fixture:
        log("show has started; nothing to track")
        return 0

    state_path = os.path.join(DATA, "state.json")
    try:
        state = json.load(open(state_path))
    except Exception:
        state = {"seen": {}, "issue": None, "runs": 0}

    listings, status = [], {}
    if fixture:
        fx = json.load(open(fixture))
        listings = [mk(l.get("src", "fixture"), l["section"], l.get("row"), l.get("qty"), l["price"], l.get("splits")) for l in fx]
        listings = [l for l in listings if l]
        status["fixture"] = {"ok": True, "count": len(listings)}
        for l in listings:
            status.setdefault(l["src"], {"ok": True, "count": 0})
    else:
        for name, fn in SOURCES:
            try:
                got = fn()
                status[name] = {"ok": True, "count": len(got)}
                listings.extend(got)
                log(f"{name}: {len(got)} listings")
            except Exception as e:
                status[name] = {"ok": False, "error": str(e)[:200]}
                log(f"{name}: failed ({str(e)[:160]})")

    ok_sources = {s for s, v in status.items() if v.get("ok")}
    floor = sorted([l for l in listings if is_floor(l)], key=lambda l: l["price"])
    front = sorted([l for l in listings if is_front(l) and not is_floor(l)], key=lambda l: l["price"])
    lower = [l for l in listings if re.fullmatch(r"1\d\d", l["section"]) and fits_pair(l)]
    by_sec = {}
    for l in sorted(lower, key=lambda l: l["price"]):
        by_sec.setdefault(l["section"], l)
    comps = sorted([l for l in lower if l["section"] == OWN["section"]], key=lambda l: l["price"])

    # ---- diff against what we had
    alerts = []
    seen = state.setdefault("seen", {})
    current = {}
    for l in sorted(floor + front, key=lambda l: l["price"]):
        current.setdefault(key(l), l)  # lowest price per source/section/row is the one that matters
    for k, l in current.items():
        prev = seen.get(k)
        kind = "Floor" if is_floor(l) else "Front row"
        where = label(l)
        q = f" ({l['qty']} avail)" if l.get("qty") else ""
        if not prev:
            alerts.append((f"{kind}: {where} ${l['price']:.0f}/ea", f"New on {l['src']}{q}. {LINKS.get(l['src'], '')}"))
        elif abs(prev["price"] - l["price"]) >= 5:
            arrow = "down" if l["price"] < prev["price"] else "up"
            alerts.append((f"{kind} {arrow}: {where} ${l['price']:.0f}/ea",
                           f"Was ${prev['price']:.0f} on {l['src']}{q}. {LINKS.get(l['src'], '')}"))
    gone = []
    for k, prev in list(seen.items()):
        src = k.split("|")[0]
        if k not in current and src in ok_sources:
            gone.append(k)
            if prev.get("floor"):
                alerts.append((f"Floor gone: was ${prev['price']:.0f}/ea", f"No longer listed on {src}."))
    for k in gone:
        seen.pop(k, None)
    floor_pairs = sum(1 for l in floor if fits_pair(l))
    prev_pairs = state.get("floor_pairs")
    if prev_pairs is not None and ok_sources and floor_pairs < prev_pairs:
        alerts.append((f"Floor pairs: {prev_pairs} → {floor_pairs}", "A floor pair sold or was pulled."))
    if ok_sources:
        state["floor_pairs"] = floor_pairs
    if alerts and floor:
        ladder = ", ".join(f"${l['price']:.0f}×{l['qty'] or '?'} ({l['src']})" for l in floor[:8])
        alerts.append(("Floor ladder right now", ladder))
    for k, l in current.items():
        seen[k] = {"price": l["price"], "floor": is_floor(l), "last": now.isoformat(timespec="minutes"),
                   "first": seen.get(k, {}).get("first", now.isoformat(timespec="minutes"))}
    state["runs"] = state.get("runs", 0) + 1
    state["last_run"] = now.isoformat(timespec="minutes")

    # ---- write snapshot
    latest = {
        "ran": now.isoformat(timespec="minutes"),
        "sources": status,
        "counts": {"all": len(listings), "floor": len(floor), "front": len(front)},
        "floor": floor,
        "front": front,
        "lowest_lower_bowl_by_section": dict(sorted(by_sec.items())),
        "comparable_to_ours": comps[:12],
        "alerts": [{"title": t, "body": b} for t, b in alerts],
        "listings": sorted(listings, key=lambda l: (l["section"], l["price"])),
        "debug": DEBUG,
        "log": LOG[-40:],
    }
    json.dump(latest, open(os.path.join(DATA, "latest.json"), "w"), indent=1)
    hist_path = os.path.join(DATA, "alerts.json")
    try:
        hist = json.load(open(hist_path))
    except Exception:
        hist = []
    for t, b in alerts:
        hist.insert(0, {"at": now.isoformat(timespec="minutes"), "title": t, "body": b})
    json.dump(hist[:200], open(hist_path, "w"), indent=1)

    # ---- send
    if alerts and not dry:
        if len(alerts) == 1:
            title, body = alerts[0]
        else:
            title = f"Summit: {len(alerts)} seat updates"
            body = "\n".join(f"• {t} — {b}" for t, b in alerts)
        notify(title, body)
        github_issue(title, body, state)
    elif alerts:
        log(f"dry run: {len(alerts)} alert(s) not sent")
        for t, b in alerts:
            log(f"  {t} | {b}")
    else:
        log("no changes in the watch set")
    if not ok_sources and not fixture:
        log("WARNING: every source failed this run")

    json.dump(state, open(state_path, "w"), indent=1)
    return 0


if __name__ == "__main__":
    sys.exit(main())
