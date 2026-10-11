/* ===================================================================
   Art: 5x7 pixel font, 88x31 buttons, logos, retro page kit, icons
   =================================================================== */
const FONT5x7 = (() => {
  const src = `A 01110 10001 10001 11111 10001 10001 10001|B 11110 10001 10001 11110 10001 10001 11110|C 01110 10001 10000 10000 10000 10001 01110
|D 11110 10001 10001 10001 10001 10001 11110|E 11111 10000 10000 11110 10000 10000 11111|F 11111 10000 10000 11110 10000 10000 10000
|G 01110 10001 10000 10111 10001 10001 01111|H 10001 10001 10001 11111 10001 10001 10001|I 01110 00100 00100 00100 00100 00100 01110
|J 00111 00010 00010 00010 00010 10010 01100|K 10001 10010 10100 11000 10100 10010 10001|L 10000 10000 10000 10000 10000 10000 11111
|M 10001 11011 10101 10101 10001 10001 10001|N 10001 10001 11001 10101 10011 10001 10001|O 01110 10001 10001 10001 10001 10001 01110
|P 11110 10001 10001 11110 10000 10000 10000|Q 01110 10001 10001 10001 10101 10010 01101|R 11110 10001 10001 11110 10100 10010 10001
|S 01111 10000 10000 01110 00001 00001 11110|T 11111 00100 00100 00100 00100 00100 00100|U 10001 10001 10001 10001 10001 10001 01110
|V 10001 10001 10001 10001 10001 01010 00100|W 10001 10001 10001 10101 10101 10101 01010|X 10001 10001 01010 00100 01010 10001 10001
|Y 10001 10001 10001 01010 00100 00100 00100|Z 11111 00001 00010 00100 01000 10000 11111|0 01110 10001 10011 10101 11001 10001 01110
|1 00100 01100 00100 00100 00100 00100 01110|2 01110 10001 00001 00010 00100 01000 11111|3 11111 00010 00100 00010 00001 10001 01110
|4 00010 00110 01010 10010 11111 00010 00010|5 11111 10000 11110 00001 00001 10001 01110|6 00110 01000 10000 11110 10001 10001 01110
|7 11111 00001 00010 00100 01000 01000 01000|8 01110 10001 10001 01110 10001 10001 01110|9 01110 10001 10001 01111 00001 00010 01100
|! 00100 00100 00100 00100 00100 00000 00100|? 01110 10001 00001 00010 00100 00000 00100|. 00000 00000 00000 00000 00000 01100 01100
|, 00000 00000 00000 00000 01100 00100 01000|- 00000 00000 00000 11111 00000 00000 00000|& 01100 10010 10100 01000 10101 10010 01101
|' 01100 00100 01000 00000 00000 00000 00000|: 00000 01100 01100 00000 01100 01100 00000|/ 00000 00001 00010 00100 01000 10000 00000
|+ 00000 00100 00100 11111 00100 00100 00000|# 01010 01010 11111 01010 11111 01010 01010|$ 00100 01111 10100 01110 00101 11110 00100
|@ 01110 10001 10111 10101 10111 10000 01110|* 00000 00100 10101 01110 10101 00100 00000|( 00010 00100 01000 01000 01000 00100 00010
|) 01000 00100 00010 00010 00010 00100 01000|% 11000 11001 00010 00100 01000 10011 00011|_ 00000 00000 00000 00000 00000 00000 11111
|~ 00000 00000 01000 10101 00010 00000 00000`;
  const map = {};
  for (const part of src.split('|')) {
    const t = part.trim().split(/\s+/);
    map[t[0]] = t.slice(1).map(r => parseInt(r, 2));
  }
  map[' '] = [0, 0, 0, 0, 0, 0, 0];
  return map;
})();
// glyphs advance 6px; lines longer than 9 characters are set "condensed" (5px advance)
const pixAdvance = t => (String(t).length > 9 ? 5 : 6);
function pixText(ctx, text, x, y, color, shadow, scale = 1, advance) {
  text = String(text).toUpperCase();
  const adv = (advance || pixAdvance(text)) * scale;
  const draw = (ox, oy, col) => {
    ctx.fillStyle = col;
    let cx = x + ox;
    for (const ch of text) {
      const g = FONT5x7[ch] || FONT5x7['?'];
      for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (g[r] & (16 >> c)) ctx.fillRect(cx + c * scale, y + oy + r * scale, scale, scale);
      cx += adv;
    }
  };
  if (shadow) draw(scale, scale, shadow);
  draw(0, 0, color);
}
const pixWidth = (t, scale = 1) => String(t).length * pixAdvance(t) * scale - scale;

/* colors */
const RETRO = ['#000080', '#800000', '#008000', '#800080', '#008080', '#003399', '#993300', '#336600', '#660066', '#006666', '#990033', '#333399', '#cc3300', '#006633'];
function shade(hex, f) {
  const [r, g, b] = hexToRgb(hex);
  const m = v => clamp(Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f), 0, 255);
  return '#' + [m(r), m(g), m(b)].map(v => v.toString(16).padStart(2, '0')).join('');
}
function lum(hex) { const [r, g, b] = hexToRgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }
function hueShift(hex, deg) {
  const [h, s, l] = rgbToHsl(...hexToRgb(hex));
  const H = ((h + deg) % 360 + 360) % 360 / 360;
  const f = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
  const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  return '#' + [f(p, q, H + 1 / 3), f(p, q, H), f(p, q, H - 1 / 3)].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}
/** whole words on two lines of at most MAX letters, or null when they don't all fit */
function fitTwo(W, MAX = 13) {
  let l1 = '', l2 = '';
  for (const w of W) {
    if (w.length > MAX) return null;
    if (!l2 && (l1 ? l1 + ' ' + w : w).length <= MAX) l1 = l1 ? l1 + ' ' + w : w;
    else if ((l2 ? l2 + ' ' + w : w).length <= MAX) l2 = l2 ? l2 + ' ' + w : w;
    else return null;
  }
  return [l1, l2];
}
/** a site's button text: its name, and when that's too long, without the words its ring is named for */
function buttonLines(site, words) {
  const W = words.map(w => String(w).toUpperCase()).filter(Boolean);
  const lead = site && site.ring && site.ring.lead ? normName(site.ring.lead).toUpperCase().split(' ') : [];
  // crisp letters (11 a line) if possible, else tighter ones (13 a line)
  for (const MAX of [11, 13]) {
    let ws = W, lines = fitTwo(ws, MAX);
    while (!lines && ws.length > 1) {
      const i = ws.findIndex(w => lead.includes(w));
      if (i < 0) break;
      ws = ws.filter((_, k) => k !== i);
      lines = fitTwo(ws, MAX);
    }
    if (lines) return lines;
  }
  // still too long: drop words from the end, never cut one in half
  let ws = W, lines = null;
  while (!lines && ws.length > 1) { ws = ws.slice(0, -1); lines = fitTwo(ws, 13); }
  return lines || twoLines(W);
}
function twoLines(words) {
  const W = words.map(w => String(w).toUpperCase()).filter(Boolean);
  let l1 = '', l2 = '';
  const MAX = 13;
  for (const w of W) {
    if (!l2 && (l1 ? l1 + ' ' + w : w).length <= MAX) l1 = l1 ? l1 + ' ' + w : w;
    else if ((l2 ? l2 + ' ' + w : w).length <= MAX) l2 = l2 ? l2 + ' ' + w : w;
    else if (!l1) { const cut = Math.ceil(w.length / 2); l1 = w.slice(0, Math.min(cut, MAX)) + '-'; l2 = w.slice(Math.min(cut, MAX), Math.min(cut, MAX) + MAX); }
    else if (!l2) l2 = w.slice(0, MAX);
    else break;
  }
  return [l1, l2];
}
const BTN_CACHE = new Map();
function drawButton(o) {
  const key = JSON.stringify(o);
  if (BTN_CACHE.has(key)) return BTN_CACHE.get(key);
  const cv = document.createElement('canvas');
  cv.width = 88; cv.height = 31;
  const c = cv.getContext('2d');
  const base = o.color, dark = lum(base) > .55;
  const g = c.createLinearGradient(0, 0, 0, 31);
  g.addColorStop(0, shade(base, .25)); g.addColorStop(.5, base); g.addColorStop(1, shade(base, -.45));
  c.fillStyle = g; c.fillRect(0, 0, 88, 31);
  // dither scanlines
  c.fillStyle = 'rgba(0,0,0,.07)';
  for (let y = 1; y < 31; y += 2) c.fillRect(0, y, 88, 1);
  // icon panel: narrower when a line has 10 or 11 letters, so every letter keeps its full width
  const [l1, l2] = o.lines;
  const long = Math.max(String(l1 || '').length, String(l2 || '').length) > 9 && !o.scene;
  const PW = long ? 15 : 25, mid = 2 + PW / 2;
  const pc = o.panel || hueShift(base, 180);
  c.fillStyle = pc; c.fillRect(2, 2, PW, 27);
  c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(2, 2, PW, 1); c.fillRect(2, 2, 1, 27);
  c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(2, 28, PW, 1); c.fillRect(PW + 1, 2, 1, 27);
  c.fillStyle = '#000'; c.fillRect(PW + 2, 2, 1, 27);
  if (o.ring) {
    c.lineWidth = 2;
    const rings = long ? [6, 3] : [10, 6.7, 3.4];
    rings.forEach((rad, i) => { c.strokeStyle = i % 2 ? '#fff' : shade(base, -.3); c.beginPath(); c.arc(mid, 15.5, rad, 0, Math.PI * 2); c.stroke(); });
    c.fillStyle = '#ff0'; c.beginPath(); c.arc(mid, 15.5, long ? 1.4 : 2, 0, Math.PI * 2); c.fill();
  } else if (o.scene) {
    const sk = c.createLinearGradient(0, 3, 0, 28); sk.addColorStop(0, '#05052e'); sk.addColorStop(1, '#c2477d');
    c.fillStyle = sk; c.fillRect(3, 3, 23, 25);
    c.fillStyle = '#ffb347'; c.beginPath(); c.arc(19, 19, 4.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#2c7a57'; c.beginPath(); c.moveTo(3, 22); c.lineTo(9, 15); c.lineTo(13, 19); c.lineTo(18, 13); c.lineTo(26, 21); c.lineTo(26, 28); c.lineTo(3, 28); c.fill();
    c.fillStyle = '#fff'; c.fillRect(6, 6, 1, 1); c.fillRect(12, 8, 1, 1); c.fillRect(21, 5, 1, 1);
  } else {
    c.font = 'bold ' + (long ? 12 : 17) + 'px "Apple Symbols","Segoe UI Symbol","DejaVu Sans",sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const gl = (o.glyph || '★') + '︎';
    c.fillStyle = 'rgba(0,0,0,.55)'; c.fillText(gl, mid + 1, 17);
    c.fillStyle = lum(pc) > .6 ? '#111' : '#fff'; c.fillText(gl, mid, 16);
  }
  // text, centered in what's left
  const tc = dark ? '#000' : '#fff', sc = dark ? 'rgba(255,255,255,.7)' : '#000';
  const t2 = o.color2 || (dark ? '#7a0000' : '#ffff66');
  const x0 = PW + 4, cx = (x0 + 86) / 2, room = 86 - x0;
  const adv = t => (String(t).length * 6 - 1 <= room ? 6 : 5);
  const w = t => String(t).length * adv(t) - 1;
  if (l2) {
    pixText(c, l1, Math.round(cx - w(l1) / 2), 6, tc, sc, 1, adv(l1));
    pixText(c, l2, Math.round(cx - w(l2) / 2), 18, t2, sc, 1, adv(l2));
  } else pixText(c, l1, Math.round(cx - w(l1) / 2), 12, tc, sc, 1, adv(l1));
  // bevel border
  c.fillStyle = '#000'; c.fillRect(0, 0, 88, 1); c.fillRect(0, 30, 88, 1); c.fillRect(0, 0, 1, 31); c.fillRect(87, 0, 1, 31);
  c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(1, 1, 86, 1); c.fillRect(1, 1, 1, 29);
  c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(1, 29, 86, 1); c.fillRect(86, 1, 1, 29);
  const url = cv.toDataURL('image/png');
  BTN_CACHE.set(key, url);
  return url;
}
function siteButton(site) {
  if (!site) return '';
  const pal = site.index.meta.palette || [];
  const color = pal[0] || RETRO[hash32(site.key) % RETRO.length];
  const words = (site.words && site.words.length ? site.words : nameWords(site));
  return drawButton({ color, panel: pal[1] || null, glyph: site.ring ? site.ring.glyph : '★', lines: buttonLines(site, words) });
}
function ringButton(r) {
  return drawButton({ color: r.color, ring: true, lines: r.wander ? [r.badge || 'WANDERERS', 'WEB RING'] : r.badgeLines || [r.badge || badgeLabel(r.lead || r.name), 'WEB RING'] });
}
const BADGES = {
  now: () => drawButton({ color: '#111111', scene: true, lines: ['LANSCAPE', 'NOW!'], color2: '#ff4040' }),
  ringhub: () => drawButton({ color: '#3a006b', ring: true, lines: ['RINGHUB', 'MEMBER'] }),
  hound: () => drawButton({ color: '#8b1a1a', glyph: '✦', panel: '#ffd34d', lines: ['HYPER', 'HOUND'] }),
  y2k: () => drawButton({ color: '#006400', glyph: '✓', panel: '#ffffff', lines: ['Y2K', 'COMPLIANT'] }),
  hand: () => drawButton({ color: '#00008b', glyph: '✎', panel: '#ffff99', lines: ['HAND', 'CODED'] }),
  res: () => drawButton({ color: '#555555', glyph: '▣', panel: '#00cccc', lines: ['BEST AT', '800X600'] }),
  spider: () => drawButton({ color: '#2b2b2b', glyph: '✱', panel: '#cc0000', lines: ['SPIDER', 'INDEXED'] })
};

/* ---------------- logos (inline SVG strings) ---------------- */
function lanscapeBanner(w = 468, h = 90) {
  const rnd = rng(42), stars = [];
  for (let i = 0; i < 40; i++) stars.push(`<circle cx="${(rnd() * w).toFixed(1)}" cy="${(rnd() * h * .55).toFixed(1)}" r="${(rnd() * .9 + .3).toFixed(2)}" fill="#fff" opacity="${(rnd() * .6 + .4).toFixed(2)}"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 468 90" role="img" aria-label="LANscape">
<defs><linearGradient id="lsk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05052e"/><stop offset=".62" stop-color="#3b2a7c"/><stop offset="1" stop-color="#e0607e"/></linearGradient>
<linearGradient id="lsu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6b0"/><stop offset="1" stop-color="#ff7b39"/></linearGradient>
<linearGradient id="ltx" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff9c4"/><stop offset=".5" stop-color="#ffd34d"/><stop offset="1" stop-color="#ff8a00"/></linearGradient></defs>
<rect width="468" height="90" fill="url(#lsk)"/>${stars.join('')}
<circle cx="380" cy="66" r="26" fill="url(#lsu)"/>
<g stroke="#ff9b6a" stroke-width="1" opacity=".6"><path d="M350 62h60M346 68h68M344 74h72"/></g>
<path d="M0 70 L40 48 L70 62 L110 38 L150 64 L190 50 L230 68 L270 44 L320 70 L360 56 L410 72 L440 58 L468 66 V90 H0Z" fill="#2c7a57"/>
<path d="M0 80 L60 66 L120 78 L180 64 L240 80 L300 68 L360 82 L420 70 L468 78 V90 H0Z" fill="#164d36"/>
<path d="M226 90 L232 70 L236 70 L242 90Z" fill="#9a9a9a"/><path d="M234 72v3M234 78v4M234 85v4" stroke="#ffd34d" stroke-width="1"/>
<text x="20" y="44" font-family="Georgia,'Times New Roman',serif" font-size="40" font-style="italic" font-weight="bold" fill="#000" opacity=".55">LANscape</text>
<text x="17" y="41" font-family="Georgia,'Times New Roman',serif" font-size="40" font-style="italic" font-weight="bold" fill="url(#ltx)" stroke="#5a1d00" stroke-width=".8">LANscape</text>
<text x="20" y="60" font-family="Verdana,Tahoma,sans-serif" font-size="10.5" fill="#e8e6ff" letter-spacing="1.5">YOUR LOCAL INFORMATION SUPERHIGHWAY</text></svg>`;
}
function houndLogo(big) {
  const s = big ? 1 : 0.62;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(360 * s)}" height="${Math.round(84 * s)}" viewBox="0 0 360 84" role="img" aria-label="HyperHound">
<g transform="translate(4,8)"><path d="M14 40 C12 22 26 10 42 12 L60 19 C68 22 70 30 62 32 L50 34 C46 44 36 50 26 49 C20 48 15 45 14 40Z" fill="#7a4a1f" stroke="#2b1500" stroke-width="2"/>
<path d="M24 16 C14 22 12 40 18 56 C24 54 28 40 30 22Z" fill="#4a2a0f" stroke="#2b1500" stroke-width="2"/>
<circle cx="44" cy="20" r="2.4" fill="#000"/><circle cx="66" cy="27" r="3.4" fill="#000"/><path d="M20 49 Q30 56 44 50" stroke="#c00" stroke-width="4" fill="none"/></g>
<text x="86" y="58" font-family="Georgia,'Times New Roman',serif" font-size="50" font-weight="bold" font-style="italic" fill="#999">Hyper<tspan fill="#999">Hound</tspan></text>
<text x="83" y="55" font-family="Georgia,'Times New Roman',serif" font-size="50" font-weight="bold" font-style="italic" fill="#14287a">Hyper<tspan fill="#b3261e">Hound</tspan></text>
<text x="88" y="76" font-family="Verdana,Tahoma,sans-serif" font-size="9.5" fill="#555" letter-spacing="1.4" textLength="262" lengthAdjust="spacingAndGlyphs">FETCHES EVERY PAGE ON YOUR LAN</text></svg>`;
}
function ringhubLogo() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="96" viewBox="0 0 420 96" role="img" aria-label="RingHub">
<defs><radialGradient id="rhp" cx=".35" cy=".35"><stop offset="0" stop-color="#ffe680"/><stop offset="1" stop-color="#d0570f"/></radialGradient>
<filter id="rhg"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
<g transform="translate(50,48)"><ellipse rx="44" ry="13" fill="none" stroke="#39ff14" stroke-width="3" transform="rotate(-18)" opacity=".55"/>
<circle r="20" fill="url(#rhp)"/><path d="M-44 0 A44 13 0 0 0 44 0" fill="none" stroke="#39ff14" stroke-width="3" transform="rotate(-18)"/>
<circle cx="38" cy="-22" r="3" fill="#ff3cf2"/><circle cx="-36" cy="16" r="2.5" fill="#00e5ff"/></g>
<text x="108" y="62" font-family="'Arial Black',Impact,Verdana,sans-serif" font-size="48" font-weight="900" fill="#ffff00" filter="url(#rhg)" letter-spacing="1">RingHub</text>
<text x="112" y="84" font-family="Verdana,Tahoma,sans-serif" font-size="11.5" fill="#39ff14" letter-spacing="2.4">RING THE WEB • JOIN THE CIRCLE</text></svg>`;
}
function netropolisLogo() {
  const rnd = rng(7);
  let bld = '', x = 0;
  while (x < 200) {
    const bw = 10 + Math.floor(rnd() * 18), bh = 22 + Math.floor(rnd() * 48);
    bld += `<rect x="${x}" y="${80 - bh}" width="${bw}" height="${bh}" fill="#1a2a4a" stroke="#0a1020"/>`;
    for (let wy = 84 - bh; wy < 76; wy += 6) for (let wx = x + 3; wx < x + bw - 3; wx += 5) if (rnd() > .45) bld += `<rect x="${wx}" y="${wy}" width="2" height="3" fill="#ffd34d"/>`;
    x += bw + 2;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="90" viewBox="0 0 440 90"><rect width="440" height="90" fill="#0b1026"/>${bld}
<text x="214" y="50" font-family="Georgia,serif" font-size="38" font-weight="bold" fill="#7fd3ff">Netropolis</text>
<text x="216" y="70" font-family="Verdana,sans-serif" font-size="10.5" fill="#fff" letter-spacing="1.6">FREE HOMEPAGES FOR EVERYONE</text></svg>`;
}

/* ---------------- retro page kit (only for demo + generated pages) ---------------- */
function svgURI(svg) { return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")'; }
const RETRO_CSS = (() => {
  const rnd = rng(1998);
  let st = '';
  for (let i = 0; i < 26; i++) {
    const c = rnd() > .82 ? '#ffffaa' : rnd() > .7 ? '#aaccff' : '#ffffff';
    st += `<circle cx="${(rnd() * 160).toFixed(1)}" cy="${(rnd() * 160).toFixed(1)}" r="${(rnd() * 1 + .35).toFixed(2)}" fill="${c}" opacity="${(rnd() * .7 + .3).toFixed(2)}"/>`;
  }
  const stars = svgURI(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" fill="#000010"/>${st}</svg>`);
  const turb = (bf, oct, matrix, w = 220, h = 220, extra = '') => svgURI(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><filter id="f"><feTurbulence type="fractalNoise" baseFrequency="${bf}" numOctaves="${oct}" stitchTiles="stitch" seed="7"/><feColorMatrix values="${matrix}"/></filter><rect width="100%" height="100%" filter="url(#f)"/>${extra}</svg>`);
  const paper = turb('0.035', 4, '0 0 0 0 0.93  0 0 0 0 0.86  0 0 0 0 0.68  0 0 0 -1.4 1.25');
  const marble = turb('0.012 0.03', 5, '0 0 0 0.25 0.62  0 0 0 0.25 0.62  0 0 0 0.25 0.66  0 0 0 0 1');
  const clouds = turb('0.008', 5, '0.2 0 0 0 0.45  0.2 0 0 0 0.62  0 0 0 0 0.95  0 0 0 0 1', 300, 300);
  const water = turb('0.02 0.06', 3, '0 0 0 0 0.05  0 0 0 0.3 0.35  0 0 0 0.4 0.6  0 0 0 0 1');
  const grass = turb('0.09 0.02', 3, '0 0 0 0.15 0.08  0 0 0 0.35 0.38  0 0 0 0.05 0.04  0 0 0 0 1');
  const wood = turb('0.004 0.12', 3, '0 0 0 0.25 0.42  0 0 0 0.18 0.24  0 0 0 0.08 0.1  0 0 0 0 1', 300, 120);
  const bricks = svgURI(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"><rect width="64" height="32" fill="#c8c0b0"/><g fill="#9b3b22" stroke="#6b2414" stroke-width=".6"><rect x="1" y="1" width="30" height="14"/><rect x="33" y="1" width="30" height="14"/><rect x="-15" y="17" width="30" height="14"/><rect x="17" y="17" width="30" height="14"/><rect x="49" y="17" width="30" height="14"/></g></svg>`);
  return `blink,.blink{animation:lanblink 1s steps(1,end) infinite}@keyframes lanblink{50%{visibility:hidden}}
.bg-stars{background:#000010 ${stars};color:#e0e0ff}.bg-paper{background:#efe2c0 ${paper}}.bg-marble{background:#ddd ${marble}}
.bg-clouds{background:#74a7e8 ${clouds}}.bg-water{background:#0d4f7a ${water};color:#fff}.bg-grass{background:#2f6b26 ${grass};color:#fff}
.bg-wood{background:#6b3e1f ${wood};color:#fff3d6}.bg-bricks{background:#9b3b22 ${bricks}}
.bg-denim{background:#2b4d7a repeating-linear-gradient(45deg,rgba(255,255,255,.05) 0 2px,transparent 2px 5px),repeating-linear-gradient(-45deg,rgba(0,0,0,.08) 0 1px,transparent 1px 4px);color:#fff}
.bg-checker{background:#fff;background-image:conic-gradient(#000 25%,#fff 0 50%,#000 0 75%,#fff 0);background-size:40px 40px}
.uc{display:inline-flex;align-items:center;gap:10px;padding:6px 14px;font:bold 13px/1.2 Verdana,Arial,sans-serif;color:#000;border:2px solid #000;
 background:repeating-linear-gradient(45deg,#ffcc00 0 14px,#111 14px 28px);box-shadow:3px 3px 0 rgba(0,0,0,.4)}
.uc span{background:#ffcc00;padding:3px 8px;border:1px solid #000}
.uc i{width:14px;height:14px;border-radius:50%;background:#ff6a00;box-shadow:0 0 8px #ff6a00;animation:lanblink .8s steps(1,end) infinite;display:inline-block}
.newbadge{display:inline-block;font:bold 10px/1 Verdana,Arial,sans-serif;color:#ff0;background:#e00;padding:5px 7px;transform:rotate(-8deg);margin:0 4px;
 clip-path:polygon(50% 0,61% 22%,85% 10%,78% 36%,100% 50%,78% 64%,85% 90%,61% 78%,50% 100%,39% 78%,15% 90%,22% 64%,0 50%,22% 36%,15% 10%,39% 22%);animation:lanpulse 1s ease-in-out infinite}
@keyframes lanpulse{50%{transform:rotate(-8deg) scale(1.15)}}
.updbadge{display:inline-block;font:bold 9px/1 Verdana,Arial,sans-serif;color:#fff;background:#0066cc;padding:2px 4px;border:1px solid #003366;margin:0 3px}
.coolbadge{display:inline-block;font:bold 9px/1 Verdana,Arial,sans-serif;color:#000;background:linear-gradient(#00ffff,#0080ff);padding:2px 4px;border:1px solid #003;margin:0 3px}
.lan-odo{display:inline-flex;gap:1px;padding:2px;background:#000;border:2px inset #888;vertical-align:middle}
.lan-odo b{display:inline-block;width:11px;text-align:center;background:linear-gradient(#444,#000 48%,#222 52%,#000);color:#fff;font:bold 13px/18px "Courier New",monospace}
hr.rainbow{border:0;height:6px;background:linear-gradient(90deg,red,orange,yellow,lime,cyan,blue,violet,red)}
.spin{display:inline-block;animation:lanspin 2.4s linear infinite}@keyframes lanspin{to{transform:rotateY(360deg)}}
table.lan-ring{border:3px outset #c0c0c0;background:#c0c0c0;color:#000;font:13px/1.3 Arial,Helvetica,sans-serif;margin:16px auto}
table.lan-ring td{padding:6px 10px;text-align:center}table.lan-ring a{color:#0000ee;font-weight:bold}
table.lan-ring .rn{font-size:14px}
@media (prefers-reduced-motion:reduce){blink,.blink,.newbadge,.spin,.uc i{animation:none}}`;
})();

/* ---------------- toolbar / dialog icons ---------------- */
const ICON = {
  back: '<svg viewBox="0 0 24 24"><path d="M2 12 L11 3.5 V8 H21.5 V16 H11 V20.5 Z" fill="#2fbf4a" stroke="#0b3d15" stroke-width="1.2" stroke-linejoin="round"/><path d="M11.5 9 H20.5" stroke="#c6f7cf" stroke-width="1.2"/></svg>',
  fwd: '<svg viewBox="0 0 24 24"><path d="M22 12 L13 3.5 V8 H2.5 V16 H13 V20.5 Z" fill="#2fbf4a" stroke="#0b3d15" stroke-width="1.2" stroke-linejoin="round"/><path d="M3.5 9 H12.5" stroke="#c6f7cf" stroke-width="1.2"/></svg>',
  reload: '<svg viewBox="0 0 24 24"><path d="M19.5 9.5 A8 8 0 1 0 20 14" fill="none" stroke="#0a2a66" stroke-width="4.4"/><path d="M19.5 9.5 A8 8 0 1 0 20 14" fill="none" stroke="#3d86f0" stroke-width="2.6"/><path d="M22.5 3 L22 11.5 L13.8 9.3 Z" fill="#3d86f0" stroke="#0a2a66" stroke-width="1"/></svg>',
  home: '<svg viewBox="0 0 24 24"><rect x="15" y="4" width="2.6" height="5" fill="#777" stroke="#222" stroke-width=".8"/><path d="M2.5 12.5 L12 3.5 L21.5 12.5 Z" fill="#d62d20" stroke="#4d0a05" stroke-width="1.1" stroke-linejoin="round"/><rect x="5.5" y="12" width="13" height="9.5" fill="#f3e2b3" stroke="#5a4320"/><rect x="10.3" y="15" width="3.6" height="6.5" fill="#8b5a2b" stroke="#3a2210" stroke-width=".7"/><rect x="6.8" y="14" width="2.6" height="2.6" fill="#8fd3ff" stroke="#333" stroke-width=".6"/></svg>',
  search: '<svg viewBox="0 0 24 24"><path d="M14.5 14.5 L21 21" stroke="#3b2208" stroke-width="4.2" stroke-linecap="round"/><path d="M14.5 14.5 L21 21" stroke="#8b5a2b" stroke-width="2.4" stroke-linecap="round"/><circle cx="9.5" cy="9.5" r="6.3" fill="#c9ecff" stroke="#14213d" stroke-width="2"/><path d="M6.3 8.6 a3.6 3.6 0 0 1 3.2-3" stroke="#fff" fill="none" stroke-width="1.4"/></svg>',
  rings: '<svg viewBox="0 0 24 24"><circle cx="8.5" cy="12" r="5.6" fill="none" stroke="#5a3d00" stroke-width="3.6"/><circle cx="8.5" cy="12" r="5.6" fill="none" stroke="#f2b705" stroke-width="2"/><circle cx="15.5" cy="12" r="5.6" fill="none" stroke="#4a0000" stroke-width="3.6"/><circle cx="15.5" cy="12" r="5.6" fill="none" stroke="#e03131" stroke-width="2"/><path d="M12.4 7.5 A5.6 5.6 0 0 1 14.1 11" fill="none" stroke="#5a3d00" stroke-width="3.6"/><path d="M12.4 7.5 A5.6 5.6 0 0 1 14.1 11" fill="none" stroke="#f2b705" stroke-width="2"/></svg>',
  open: '<svg viewBox="0 0 24 24"><path d="M2 6.5 h7 l2 2 h10.5 v12 H2z" fill="#e0a800" stroke="#5c4300" stroke-width="1"/><path d="M2 20.5 L5 11 H23 L20 20.5Z" fill="#ffd966" stroke="#5c4300" stroke-width="1" stroke-linejoin="round"/></svg>',
  print: '<svg viewBox="0 0 24 24"><rect x="6" y="2.5" width="12" height="7" fill="#fff" stroke="#222"/><rect x="2.5" y="9" width="19" height="8.5" fill="#b8b8b8" stroke="#222"/><rect x="6" y="14" width="12" height="7.5" fill="#fff" stroke="#222"/><path d="M8 17h8M8 19.3h6" stroke="#444"/><circle cx="18.5" cy="11.6" r="1.1" fill="#2c2"/></svg>',
  stop: '<svg viewBox="0 0 24 24"><path d="M8 1.8h8l6.2 6.2v8L16 22.2H8L1.8 16V8z" fill="#d81e1e" stroke="#4a0606" stroke-width="1.1"/><path d="M8.6 3.4h6.8l5.2 5.2v6.8l-5.2 5.2H8.6l-5.2-5.2V8.6z" fill="none" stroke="#fff" stroke-width=".9"/><rect x="6.5" y="10.6" width="11" height="2.8" fill="#fff"/></svg>',
  spider: '<svg viewBox="0 0 24 24"><g stroke="#111" stroke-width="1.4" fill="none" stroke-linecap="round"><path d="M12 9 L5 3 M12 10 L3 9 M12 13 L3 15 M12 14 L5 21 M12 9 L19 3 M12 10 L21 9 M12 13 L21 15 M12 14 L19 21"/></g><ellipse cx="12" cy="13" rx="3.4" ry="4.4" fill="#222"/><circle cx="12" cy="8.4" r="2.4" fill="#333"/><circle cx="11.2" cy="8" r=".5" fill="#f33"/><circle cx="12.8" cy="8" r=".5" fill="#f33"/><path d="M12 1 V6" stroke="#888" stroke-width=".7"/></svg>',
  progs: '<svg viewBox="0 0 24 24"><rect x="1.5" y="2.5" width="21" height="19" fill="#fff" stroke="#000" stroke-width="1.1"/><rect x="1.5" y="2.5" width="21" height="4" fill="#000080"/><rect x="4" y="9" width="6" height="5" fill="#2b579a" stroke="#000" stroke-width=".6"/><rect x="14" y="9" width="6" height="5" fill="#217346" stroke="#000" stroke-width=".6"/><rect x="4" y="15.5" width="6" height="4.5" fill="#c62828" stroke="#000" stroke-width=".6"/><circle cx="17" cy="17.7" r="2.6" fill="#6aa3e0" stroke="#1d3f6e" stroke-width=".6"/></svg>',
  lock: '<svg viewBox="0 0 16 16"><path d="M4.5 7.2V5a3.5 3.5 0 0 1 7 0v2.2" fill="none" stroke="#555" stroke-width="1.7"/><rect x="2.8" y="7" width="10.4" height="7.8" fill="#e2b33c" stroke="#6b4e00"/><rect x="7.2" y="9.3" width="1.6" height="3.4" fill="#6b4e00"/></svg>',
  globe: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.6" fill="#4aa3ff" stroke="#08306b"/><path d="M3 6c2 0 3 1 3 3s2 2 2 4M9 2c0 2 2 2 3 3s2 1 2.4 2.6" stroke="#2c7a3a" stroke-width="2" fill="none"/><path d="M1.5 8h13M8 1.5c-3 3-3 10 0 13M8 1.5c3 3 3 10 0 13" stroke="#08306b" stroke-width=".6" fill="none"/></svg>',
  key: '<svg viewBox="0 0 16 16"><circle cx="5" cy="8" r="3.3" fill="none" stroke="#7a6a3a" stroke-width="1.8"/><path d="M8 8h6.5M12 8v2.5M10 8v1.6" stroke="#7a6a3a" stroke-width="1.8"/><path d="M2 14 L14 2" stroke="#c00" stroke-width="1.4"/></svg>',
  error: '<svg viewBox="0 0 34 34"><circle cx="17" cy="17" r="15" fill="#e81123" stroke="#6b0008"/><path d="M11 11 L23 23 M23 11 L11 23" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/></svg>',
  info: '<svg viewBox="0 0 34 34"><circle cx="17" cy="17" r="15" fill="#fff" stroke="#1f4ea8" stroke-width="2"/><circle cx="17" cy="10" r="2.2" fill="#1f4ea8"/><rect x="15" y="14" width="4" height="12" fill="#1f4ea8"/></svg>',
  warn: '<svg viewBox="0 0 34 34"><path d="M17 3 L32 30 H2 Z" fill="#ffd400" stroke="#000" stroke-width="1.6" stroke-linejoin="round"/><rect x="15.4" y="11" width="3.2" height="11" fill="#000"/><rect x="15.4" y="24.5" width="3.2" height="3.2" fill="#000"/></svg>',
  question: '<svg viewBox="0 0 34 34"><circle cx="17" cy="17" r="15" fill="#fff" stroke="#1f4ea8" stroke-width="2"/><path d="M12.5 13 a4.6 4.6 0 1 1 6.8 4 c-1.6 .9 -2.3 1.8 -2.3 3.6" fill="none" stroke="#1f4ea8" stroke-width="3"/><circle cx="17" cy="25.4" r="1.9" fill="#1f4ea8"/></svg>',
  modem: '<svg viewBox="0 0 34 34"><rect x="2" y="12" width="30" height="12" rx="2" fill="#d8d0c0" stroke="#333"/><rect x="5" y="16" width="16" height="3" fill="#333"/><circle cx="25" cy="17.5" r="1.4" fill="#2c2"/><circle cx="29" cy="17.5" r="1.4" fill="#fc2"/><path d="M8 12 C10 6 24 6 26 12" fill="none" stroke="#333" stroke-width="1.5"/></svg>'
};
