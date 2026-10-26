# Building a Create product

Every Create product is one HTML file, a direct descendant of **Vision** (`vision/index.html`, the reference build). Read this before writing one; when in doubt, do what Vision does. The product's functional spec is its entry in `news/create/catalog.json`.

## Where it lives

- `news/create/apps/<id>/index.html` — one file, nothing beside it. (GitHub Pages serves it at `…/news/create/apps/<id>/`; Create · Home offers it for download as `create-<id>.html`.)
- `<title>Create · Name</title>`, a `<meta name="description">`, canonical + Open Graph tags like Vision's (og:image may point at `../../../share.png`), `theme-color` for light and dark, `apple-mobile-web-app-capable`, an inline SVG favicon (data URI).
- External resources, and only these: Google Fonts (`DM Sans` 400–700 + `Instrument Serif`), PeerJS `https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js` (defer), and optionally `https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js` (defer). No frameworks, no build step, no fetches to anything else. If PeerJS doesn't load, the product works solo and says so.
- Gzipped size budget: in the catalog (`budget`, KB). Check with `gzip -9 -c index.html | wc -c`.

## The look

Copy Vision's design tokens so the family reads as one:

```css
:root{
  --bg:#F8F7F4; --raise:#FFFFFF; --sunk:#EFEBE4; --ink:#2A251F; --ink2:#62594F; --ink3:#968B7E; --rule:rgba(42,37,31,.12); --rule2:rgba(42,37,31,.22);
  --a:#C2785C; --a-soft:rgba(194,120,92,.15); --b:#5B7FA1; --b-soft:rgba(91,127,161,.15); --gold:#8B7355; --gold-soft:rgba(139,115,85,.16); --lens:#A88A5E;
  --ok:#3D7A55; --warn:#B4532F; --scrim:rgba(30,25,20,.45); --on:#fff;
  --shadow:0 1px 2px rgba(42,37,31,.05),0 8px 24px rgba(42,37,31,.07);
  --serif:'Instrument Serif','Iowan Old Style',Georgia,serif;
  --sans:'DM Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
  color-scheme:light;
}
@media (prefers-color-scheme:dark){ :root:not([data-theme="light"]){
  --bg:#191613; --raise:#24201B; --sunk:#131110; --ink:#F2EDE6; --ink2:#C6BCAF; --ink3:#918679; --rule:rgba(242,237,230,.12); --rule2:rgba(242,237,230,.24);
  --a:#E39B7F; --a-soft:rgba(227,155,127,.17); --b:#8FB1D2; --b-soft:rgba(143,177,210,.17); --gold:#CDB089; --gold-soft:rgba(205,176,137,.17); --lens:#BFA27A;
  --ok:#7EC39B; --warn:#F08C66; --scrim:rgba(0,0,0,.62); --on:#191613; --shadow:0 1px 2px rgba(0,0,0,.3),0 10px 28px rgba(0,0,0,.34); color-scheme:dark; } }
:root[data-theme="dark"]{ /* same values as the dark block */ }
```

- Partner A is `--a` (terracotta), partner B is `--b` (slate); things that belong to both are `--gold`. The product's own accent (catalog `c`) colors its wordmark and empty states.
- Headings in the serif, everything else in the sans. 16 px body, 44 px touch targets, `env(safe-area-inset-*)` padding, no horizontal scroll at 360 px. Phone first; a wider layout above 760 px.
- Chrome: a slim header (the product name in the serif, a small `Create` wordmark, a presence dot that reads idle / connecting / on / away, a Share button, a menu button), a bottom sheet (`<aside class="sheet" role="dialog">`) for share/pair, settings and backup, a toast with an optional Undo. No modal walls of text.
- Copy in the Scrolls voice: short, plain, warm, specific ("Connected with Ben." not "Peer connection established."). No lorem ipsum, no placeholder cards. Empty states explain the one thing to do first and offer an example to load.

## State and storage

```js
const KEY = 'create.<id>.v1', INBOX = 'create.<id>.inbox', THEME = 'create.theme';
const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
             set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
             del(k) { try { localStorage.removeItem(k); } catch (e) {} } };
const ALPH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const code6 = () => { const a = new Uint32Array(6); crypto.getRandomValues(a); return [...a].map(x => ALPH[x % ALPH.length]).join(''); };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
let lastStamp = 0; const SALT = Math.floor(Math.random() * 90) + 10;
function stamp() { const t = Math.max(Date.now(), Math.floor(lastStamp / 100) + 1); lastStamp = t * 100 + SALT; return lastStamp; }
const seeStamp = n => { if (n > lastStamp) lastStamp = n; };
```

- `S` is one object: `{ v:1, dev: code6(), me:'a'|'b', joined:false, partner:null|{code,at}, pending:null, names:{a:'',b:''}, …product fields…, items:{} }`. The catalog's `model` says what goes in it.
- Every record in `items` (and any other synced map) is `{ id, …fields, del, _t:{ field: stamp } }`. Change fields with `setF(it, {…})`, which stamps each one. Deleting sets `del: true` (soft), never removes.
- `save()` debounces 120 ms; `save(true)` writes now. If storage is full, toast once and keep going.
- `load()` hydrates `S` from `KEY` with fallbacks for missing fields; a state from an older `v` is migrated, never dropped.
- Inbox: other pages on the site may leave `{ …, at }` entries in `INBOX` (an array). Drain it on load and on the `storage` event: turn each into an item, save, broadcast, toast.

## Sync (protocol v2, from Vision)

```js
const PID = c => 'create-<prefix>-' + String(c).toLowerCase();        // the peer id is the device code
function peerOpts() { const q = new URLSearchParams(location.search).get('peer'); // ?peer=127.0.0.1:9000 for a self-hosted server (tests)
  if (q) { const [h, p] = q.split(':'); return { host: h, port: +p || 9000, path: '/', secure: location.protocol === 'https:', debug: 0 }; } return { debug: 0 }; }
```

- `startPeer()`: `new Peer(PID(S.dev), peerOpts())`. On `open`, dial `S.partner.code` (reconnect) or `S.pending` (a code just typed). On `connection`, `wire(c, false)`. On `disconnected`, `peer.reconnect()` after 4 s. If `window.Peer` is missing, net is `nolib` and the UI says the product still works on this device.
- `dial(code)`: `peer.connect(PID(code), { reliable: true, metadata: { v: 1 } })` then `wire(c, true, code)`. The dialer says `hello` first; the dialed side answers once it has accepted the caller.
- Messages: `{ t:'hello', v:1, dev, me, joined, names, …product-level fields…, items }` carries the whole state; `{ t:'put', items:[…] }` carries changed items; `{ t:'meta', … }` carries product-level fields (names, settings) with their `_t`.
- `mergeItem(r)`: per field, `(r._t[k] || 0) > (L._t[k] || 0)` wins; call `seeStamp` on every incoming stamp; a new id is adopted whole. Return whether anything changed, so the UI can redraw only when it must.
- A device never seen before (a `hello` from a `dev` that isn't `S.partner`) must be let in: show its name and code, Accept / Not now. After accepting, remember it as `S.partner` so the two devices reconnect by themselves from then on.
- Both devices think they're partner A → the one that joined moves to B (`swapSlots`) and says hello again.
- Presence states, in order of life: `idle` (no peer yet), `starting`, `ready` (listening, no partner), `dialing`, `on` (hello exchanged), `away` (partner known, not open), `offline` (lost the signaling server), `nolib`, `error`. Paint the dot and the Share sheet from these.
- Products on the **hub** pattern (Form, Pool, Trip with 3+) keep `conns` as a set, merge every guest's put and re-put the merged items to everyone else. Two-person products keep the same code path; `conns` just has one entry.
- Products on the **chunked** pattern split any message whose JSON is over 200 KB into `{ t:'chunk', id, i, n, data }` pieces (128 KB each) and reassemble on the other side before handling.
- Products on the **encrypted** pattern store and send only `{ id, iv, blob, del, _t }`; the key is derived with PBKDF2 (600,000, SHA-256) into a non-extractable AES-GCM CryptoKey and lives in memory only.
- Products on the **hidden-claims** pattern sync every field but never *render* the masked fields on the device of the person they're hidden from.

## Share sheet, backup

- Share: your code as `ABC-234` with Copy, a QR (if the library loaded) of `<page>?join=ABC234`, an input for the partner's code with a Connect button, the status line, and Forget partner. Opening the page with `?join=CODE` fills and dials.
- Backup: **Download a backup** (`create-<id>-backup.json`, the whole `S` pretty-printed) and **Restore** (merges, never replaces, unless the user picks Replace). When the state is small (under ~6 KB deflated) also **Copy as a link** (`#b=` + deflate-raw + base64url, like Vision). Also any product-specific exports the catalog lists (CSV, .ics, a printable page).

## Test hooks (required)

Expose, at the end of the IIFE, exactly:

```js
window.__create = {
  id: '<id>',
  setup: name => { /* complete onboarding programmatically: set names[me] = name, mark the app as started, render */ },
  code: () => S.dev,                              // 'ABC234' (no dash)
  pair: code => { /* same as typing the code and pressing Connect */ },
  net: () => net,                                 // 'on' once hello has been exchanged
  add: () => { /* create one representative, realistic item (vary it each call) and return its id */ },
  count: () => Object.values(S.items).filter(it => !it.del).length,
  state: () => JSON.parse(JSON.stringify(S)),
  export: () => JSON.stringify(S),
};
```

`?peer=127.0.0.1:9000` must switch PeerJS to that host (see `peerOpts`). The harness pairs two browser contexts through a local PeerJS server, so this is a real WebRTC test.

## Before you ship: the gate

Run, from the repo root (the PeerJS server should already be up; if `curl -s 127.0.0.1:9000/` says nothing, start it with `peerjs --port 9000 --path / --host 127.0.0.1 &`):

```sh
python3 news/create/test/smoke.py <id> --shots
```

It must print `PASS`. Then look at the two screenshots it wrote (`news/create/test/<id>-phone.png`, `-desktop.png`) with the Read tool and fix anything that looks off: overflow, tiny targets, an empty state that doesn't explain itself, a header that wraps. Also check:

- [ ] `file://` double-click works with no network (the harness covers this)
- [ ] no `console.error` or uncaught exception anywhere (the harness covers this)
- [ ] every button does something; every list has an empty state; Undo on delete
- [ ] dark mode reads well (`prefers-color-scheme: dark`)
- [ ] 360 px wide: no horizontal scroll, header on one line
- [ ] gzipped size under the catalog budget
- [ ] the catalog's `functions` list is all there — don't ship a subset and call it done
