/* ===================================================================
   Workbooks: the model behind Ledger, Excel number formats, dates,
   and reading/writing .xlsx and .csv
   =================================================================== */
const XL_ROWS = 1048576, XL_COLS = 16384;
const ck = (r, c) => r * 16384 + c;
const ckR = k => Math.floor(k / 16384), ckC = k => k % 16384;
function colName(c) { let s = ''; c++; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; }
function colIndex(name) { let n = 0; for (const ch of String(name).toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; }
const a1 = (r, c) => colName(c) + (r + 1);
function parseA1(s) { const m = /^\$?([A-Za-z]{1,3})\$?(\d{1,7})$/.exec(String(s).trim()); return m ? { r: +m[2] - 1, c: colIndex(m[1]) } : null; }
function parseRangeA1(s) {
  const [x, y] = String(s).split(':');
  const p = parseA1(x), q = y ? parseA1(y) : p;
  return p && q ? { r1: Math.min(p.r, q.r), c1: Math.min(p.c, q.c), r2: Math.max(p.r, q.r), c2: Math.max(p.c, q.c) } : null;
}
function newSheet(name) { return { name, cells: new Map(), colW: new Map(), rowH: new Map(), merges: [], freeze: { r: 0, c: 0 }, sel: null, scroll: { x: 0, y: 0 } }; }
function newWorkbook() { return { sheets: [newSheet('Sheet1')], active: 0, date1904: false, pass: 0 }; }
function sheetBounds(sh) {
  let maxR = -1, maxC = -1;
  for (const [k, cell] of sh.cells) { if (cell.v == null && cell.f == null) continue; const r = ckR(k), c = ckC(k); if (r > maxR) maxR = r; if (c > maxC) maxC = c; }
  return { maxR, maxC };
}

/* ---------------- errors (shared with the formula engine) ---------------- */
class FErr { constructor(code) { this.code = code; } toString() { return this.code; } }
const ERR = { DIV0: new FErr('#DIV/0!'), VALUE: new FErr('#VALUE!'), REF: new FErr('#REF!'), NAME: new FErr('#NAME?'), NA: new FErr('#N/A'), NUM: new FErr('#NUM!'), NULL: new FErr('#NULL!'), CIRC: new FErr('#CIRC!') };
const errOf = code => Object.values(ERR).find(e => e.code === String(code).toUpperCase()) || new FErr(String(code));
const isErr = v => v instanceof FErr;

/* ---------------- dates: Excel serial numbers (1900 system) ---------------- */
const XL_EPOCH = Date.UTC(1899, 11, 30);
const dateSerial = (y, m, d, hh = 0, mi = 0, ss = 0) => (Date.UTC(y, m, d, hh, mi, ss) - XL_EPOCH) / 864e5;
function serialParts(s) {
  const dt = new Date(Math.round(s * 864e5) + XL_EPOCH);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth(), d: dt.getUTCDate(), hh: dt.getUTCHours(), mi: dt.getUTCMinutes(), ss: dt.getUTCSeconds(), dow: dt.getUTCDay() };
}
const todaySerial = () => { const n = new Date(); return dateSerial(n.getFullYear(), n.getMonth(), n.getDate()); };
const nowSerial = () => { const n = new Date(); return dateSerial(n.getFullYear(), n.getMonth(), n.getDate(), n.getHours(), n.getMinutes(), n.getSeconds()); };

/* ---------------- number formats ---------------- */
const BUILTIN_FMT = { 0: 'General', 1: '0', 2: '0.00', 3: '#,##0', 4: '#,##0.00', 5: '"$"#,##0_);("$"#,##0)', 6: '"$"#,##0_);[Red]("$"#,##0)', 7: '"$"#,##0.00_);("$"#,##0.00)', 8: '"$"#,##0.00_);[Red]("$"#,##0.00)', 9: '0%', 10: '0.00%', 11: '0.00E+00', 12: '# ?/?', 13: '# ??/??', 14: 'm/d/yyyy', 15: 'd-mmm-yy', 16: 'd-mmm', 17: 'mmm-yy', 18: 'h:mm AM/PM', 19: 'h:mm:ss AM/PM', 20: 'h:mm', 21: 'h:mm:ss', 22: 'm/d/yyyy h:mm', 37: '#,##0 ;(#,##0)', 38: '#,##0 ;[Red](#,##0)', 39: '#,##0.00;(#,##0.00)', 40: '#,##0.00;[Red](#,##0.00)', 41: '_(* #,##0_);_(* \\(#,##0\\);_(* "-"_);_(@_)', 42: '_("$"* #,##0_);_("$"* \\(#,##0\\);_("$"* "-"_);_(@_)', 43: '_(* #,##0.00_);_(* \\(#,##0.00\\);_(* "-"??_);_(@_)', 44: '_("$"* #,##0.00_);_("$"* \\(#,##0.00\\);_("$"* "-"??_);_(@_)', 45: 'mm:ss', 46: '[h]:mm:ss', 47: 'mm:ss.0', 48: '##0.0E+0', 49: '@' };
const FMT_ID = {};
for (const k in BUILTIN_FMT) FMT_ID[BUILTIN_FMT[k]] = +k;
function generalNum(v) {
  if (!isFinite(v)) return '#NUM!';
  if (Object.is(v, -0)) v = 0;
  if (Number.isInteger(v) && Math.abs(v) < 1e11) return String(v);
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e11 || a < 1e-9)) {
    const [m, e] = v.toExponential(5).split('e');
    return m.replace(/\.?0+$/, '') + 'E' + (e[0] === '-' ? '-' : '+') + e.replace(/^[-+]/, '').padStart(2, '0');
  }
  let s = String(+v.toPrecision(10));
  if (/e/.test(s)) s = v.toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
  return s;
}
function splitSections(fmt) {
  const out = [];
  let cur = '', q = false, br = false;
  for (let i = 0; i < fmt.length; i++) {
    const ch = fmt[i];
    if (ch === '\\' && !q) { cur += ch + (fmt[i + 1] || ''); i++; continue; }
    if (ch === '"') q = !q;
    else if (!q && ch === '[') br = true;
    else if (!q && ch === ']') br = false;
    if (ch === ';' && !q && !br) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}
/** strip quotes and escapes from the literal parts of a format, outside number placeholders */
function fmtLiteral(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"') { const j = s.indexOf('"', i + 1); out += s.slice(i + 1, j < 0 ? s.length : j); i = j < 0 ? s.length : j; }
    else if (ch === '\\') { out += s[i + 1] || ''; i++; }
    else if (ch === '_') { out += ' '; i++; }
    else if (ch === '*') { i++; }
    else out += ch;
  }
  return out;
}
const isDateFmt = sec => { const t = sec.replace(/"[^"]*"/g, '').replace(/\\./g, '').replace(/\[[^\]]*\]/g, m => (/^\[[hms]+\]$/i.test(m) ? 'h' : '')); return /[dmyhs]/i.test(t) && !/[0#?]/.test(t.replace(/s\.0+/i, 's')); };
function fmtDateTime(serial, sec) {
  if (serial < 0 || !isFinite(serial)) return '#'.repeat(8);
  const p = serialParts(serial);
  const toks = [];
  for (let i = 0; i < sec.length;) {
    const rest = sec.slice(i);
    let m;
    if (sec[i] === '"') { const j = sec.indexOf('"', i + 1); toks.push({ lit: sec.slice(i + 1, j < 0 ? sec.length : j) }); i = j < 0 ? sec.length : j + 1; continue; }
    if (sec[i] === '\\') { toks.push({ lit: sec[i + 1] || '' }); i += 2; continue; }
    if ((m = /^\[(h+|m+|s+)\]/i.exec(rest))) { toks.push({ el: m[1][0].toLowerCase(), n: m[1].length }); i += m[0].length; continue; }
    if ((m = /^(AM\/PM|A\/P)/i.exec(rest))) { toks.push({ ap: m[1] }); i += m[0].length; continue; }
    if ((m = /^(y+|m+|d+|h+|s+)/i.exec(rest))) { toks.push({ t: m[1][0].toLowerCase(), n: m[1].length }); i += m[0].length; continue; }
    if ((m = /^\.0+/.exec(rest))) { toks.push({ frac: m[0].length - 1 }); i += m[0].length; continue; }
    if (sec[i] === '_' || sec[i] === '*') { i += 2; continue; }
    toks.push({ lit: sec[i] });
    i++;
  }
  const hasAP = toks.some(t => t.ap);
  // "m" after h or before s is minutes
  toks.forEach((t, i) => {
    if (t.t !== 'm') return;
    const prev = toks.slice(0, i).reverse().find(x => x.t || x.el), next = toks.slice(i + 1).find(x => x.t || x.el);
    if ((prev && (prev.t === 'h' || prev.el === 'h')) || (next && (next.t === 's' || next.el === 's'))) t.t = 'mi';
  });
  const L = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const D = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  let out = '';
  const total = serial * 86400;
  for (const t of toks) {
    if (t.lit != null) out += t.lit;
    else if (t.ap) out += t.ap.length > 3 ? (p.hh < 12 ? 'AM' : 'PM') : (p.hh < 12 ? 'A' : 'P');
    else if (t.el) out += String(Math.floor(t.el === 'h' ? total / 3600 : t.el === 'm' ? total / 60 : total)).padStart(t.n, '0');
    else if (t.frac != null) out += (Math.round(serial * 86400 * 1000) % 1000 / 1000).toFixed(t.frac).slice(1);
    else if (t.t === 'y') out += t.n <= 2 ? pad(p.y % 100, 2) : String(p.y);
    else if (t.t === 'm') out += t.n === 1 ? p.m + 1 : t.n === 2 ? pad(p.m + 1, 2) : t.n === 3 ? L[p.m].slice(0, 3) : t.n === 5 ? L[p.m][0] : L[p.m];
    else if (t.t === 'd') out += t.n === 1 ? p.d : t.n === 2 ? pad(p.d, 2) : t.n === 3 ? D[p.dow].slice(0, 3) : D[p.dow];
    else if (t.t === 'h') { const hh = hasAP ? (p.hh % 12 || 12) : p.hh; out += t.n >= 2 ? pad(hh, 2) : hh; }
    else if (t.t === 'mi') out += t.n >= 2 ? pad(p.mi, 2) : p.mi;
    else if (t.t === 's') out += t.n >= 2 ? pad(p.ss, 2) : p.ss;
  }
  return out;
}
function fmtNumberSection(x, sec) {
  // locate the run of number placeholders
  let a = -1, b = -1, q = false;
  for (let i = 0; i < sec.length; i++) {
    const ch = sec[i];
    if (ch === '"') { q = !q; continue; }
    if (q) continue;
    if (ch === '\\' || ch === '_' || ch === '*') { i++; continue; }
    if ('0#?'.includes(ch) || ((ch === '.' || ch === ',') && a >= 0) || (ch === '.' && /[0#?]/.test(sec[i + 1] || ''))) { if (a < 0) a = i; b = i; }
    else if ((ch === 'E' || ch === 'e') && a >= 0 && /[+-]/.test(sec[i + 1] || '')) { let j = i + 2; while ('0#'.includes(sec[j] || '_')) j++; b = j - 1; i = j - 1; }
  }
  if (a < 0) return fmtLiteral(sec.replace(/@/g, ''));
  const pre = fmtLiteral(sec.slice(0, a)), post = fmtLiteral(sec.slice(b + 1)), pat = sec.slice(a, b + 1);
  const pct = (sec.replace(/"[^"]*"/g, '').match(/%/g) || []).length;
  x *= Math.pow(100, pct);
  const em = /[eE]([+-])([0#]+)$/.exec(pat);
  if (em) {
    const mant = pat.slice(0, em.index), dec = (mant.split('.')[1] || '').length;
    let [m, e] = x.toExponential(dec).split('e');
    const en = parseInt(e, 10);
    return pre + m + 'E' + (en < 0 ? '-' : em[1] === '+' ? '+' : '') + String(Math.abs(en)).padStart(em[2].length, '0') + post;
  }
  let p = pat;
  while (p.endsWith(',')) { x /= 1000; p = p.slice(0, -1); }
  if (/\?\/\?/.test(p)) return pre + generalNum(x) + post;
  const [ip, dp = ''] = p.split('.');
  const decMax = (dp.match(/[0#?]/g) || []).length, decMin = (dp.match(/0/g) || []).length;
  const intMin = (ip.match(/0/g) || []).length;
  const group = /[0#?],[0#?]/.test(ip);
  let s = x.toFixed(decMax);
  let [is, ds = ''] = s.split('.');
  if (decMax > decMin) ds = ds.replace(new RegExp('0{0,' + (decMax - decMin) + '}$'), '');
  is = is.replace(/^0+/, '');
  if (is.length < intMin) is = is.padStart(intMin, '0');
  if (group) is = is.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return pre + is + (ds ? '.' + ds : '') + post;
}
/** text (and color) for a value shown with an Excel number format */
function formatValue(v, fmt) {
  if (v == null || v === '') return { text: '' };
  if (isErr(v)) return { text: v.code, err: true };
  if (typeof v === 'boolean') return { text: v ? 'TRUE' : 'FALSE' };
  const secs = splitSections(fmt || 'General');
  if (typeof v === 'string') {
    const ts = secs.length >= 4 ? secs[3] : secs.find(x => x.includes('@'));
    return { text: ts ? fmtLiteral(ts).replace('@', v) : v };
  }
  if (!fmt || /^general$/i.test(fmt.trim())) return { text: generalNum(v) };
  let sec = secs[0], x = v;
  if (v < 0 && secs.length >= 2 && secs[1] !== '') { sec = secs[1]; x = -v; }
  else if (v === 0 && secs.length >= 3) sec = secs[2];
  let color = null;
  sec = sec.replace(/\[(Red|Blue|Green|Black|White|Yellow|Magenta|Cyan)\]/gi, (m, c) => { color = c.toLowerCase(); return ''; });
  sec = sec.replace(/\[\$([^\]-]*)(?:-[^\]]*)?\]/g, (m, sym) => (sym ? '"' + sym + '"' : ''));
  sec = sec.replace(/\[(?:[<>=][^\]]*|Color\d+|DBNum\d|NatNum\d)\]/gi, '');
  if (/^general$/i.test(sec.trim())) return { text: (x < 0 && sec === secs[0] ? '-' : '') + generalNum(Math.abs(x)), color };
  if (isDateFmt(sec)) return { text: fmtDateTime(v, sec), color };
  const sign = v < 0 && sec === secs[0] && !(secs.length >= 2 && secs[1] !== '') ? '-' : '';
  return { text: sign + fmtNumberSection(Math.abs(x), sec), color };
}
/** what a typed entry means: 12, 1,200, $4.50, 15%, 11/14/2026, TRUE, 'text */
function parseNumberText(s) {
  const t = String(s).trim();
  if (!t) return null;
  if (/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(t)) return parseFloat(t);
  if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) return parseFloat(t.replace(/,/g, ''));
  return null;
}
const MON3 = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
function parseInput(raw) {
  const s = String(raw);
  const t = s.trim();
  if (t === '') return { v: null };
  if (s[0] === "'") return { v: s.slice(1), text: true };
  if (/^(true|false)$/i.test(t)) return { v: /^true$/i.test(t) };
  if (/^#(DIV\/0!|VALUE!|REF!|NAME\?|N\/A|NUM!|NULL!)$/i.test(t)) return { v: errOf(t) };
  let n = parseNumberText(t);
  if (n != null) return { v: n, fmt: /,/.test(t) ? (/\./.test(t) ? '#,##0.' + '0'.repeat(t.split('.')[1].length) : '#,##0') : null };
  let m = /^(\(?)(-?)\$\s?([\d,]*\.?\d+)\)?$/.exec(t);
  if (m && parseNumberText(m[3]) != null) { const dec = (m[3].split('.')[1] || '').length; return { v: (m[1] || m[2] ? -1 : 1) * parseNumberText(m[3]), fmt: '$#,##0' + (dec ? '.' + '0'.repeat(Math.min(dec, 4)) : '') + '_);($#,##0' + (dec ? '.' + '0'.repeat(Math.min(dec, 4)) : '') + ')' }; }
  m = /^(-?[\d,]*\.?\d+)\s?%$/.exec(t);
  if (m && parseNumberText(m[1]) != null) { const dec = (m[1].split('.')[1] || '').length; return { v: parseNumberText(m[1]) / 100, fmt: '0' + (dec ? '.' + '0'.repeat(dec) : '') + '%' }; }
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(t);
  if (m) { let y = +m[3]; if (y < 100) y += y < 30 ? 2000 : 1900; if (+m[1] >= 1 && +m[1] <= 12 && +m[2] >= 1 && +m[2] <= 31) return { v: dateSerial(y, +m[1] - 1, +m[2]), fmt: 'm/d/yyyy' }; }
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(t);
  if (m) return { v: dateSerial(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)), fmt: m[4] ? 'yyyy-mm-dd h:mm' : 'yyyy-mm-dd' };
  m = /^([a-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})$/i.exec(t);
  if (m && MON3.includes(m[1].toLowerCase())) return { v: dateSerial(+m[3], MON3.indexOf(m[1].toLowerCase()), +m[2]), fmt: 'mmm d, yyyy' };
  m = /^(\d{1,2})-([a-z]{3})-(\d{2}|\d{4})$/i.exec(t);
  if (m && MON3.includes(m[2].toLowerCase())) { let y = +m[3]; if (y < 100) y += y < 30 ? 2000 : 1900; return { v: dateSerial(y, MON3.indexOf(m[2].toLowerCase()), +m[1]), fmt: 'd-mmm-yy' }; }
  m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(t);
  if (m) { let hh = +m[1]; if (m[4]) { hh = hh % 12 + (/pm/i.test(m[4]) ? 12 : 0); } if (hh < 24 && +m[2] < 60) return { v: (hh * 3600 + +m[2] * 60 + +(m[3] || 0)) / 86400, fmt: m[4] ? 'h:mm AM/PM' : 'h:mm' }; }
  return { v: s };
}

/* ---------------- .xlsx ---------------- */
const nsAll = (node, local) => (node ? Array.from(node.getElementsByTagNameNS('*', local)) : []);
const kidsL = (node, local) => (node ? Array.from(node.childNodes).filter(n => n.nodeType === 1 && n.localName === local) : []);
const kidL = (node, local) => kidsL(node, local)[0] || null;
const THEME_RGB = ['#ffffff', '#000000', '#e7e6e6', '#44546a', '#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47'];
const INDEXED_RGB = ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#800000', '#008000', '#000080', '#808000', '#800080', '#008080', '#c0c0c0', '#808080', '#9999ff', '#993366', '#ffffcc', '#ccffff', '#660066', '#ff8080', '#0066cc', '#ccccff'];
function xlColor(e) {
  if (!e) return null;
  const rgb = e.getAttribute('rgb');
  if (rgb && /^[0-9a-f]{6,8}$/i.test(rgb)) return '#' + rgb.slice(-6).toLowerCase();
  const th = e.getAttribute('theme');
  if (th != null && THEME_RGB[+th]) {
    let c = THEME_RGB[+th];
    const tint = parseFloat(e.getAttribute('tint') || '0');
    if (tint) c = shade(c, tint);
    return c;
  }
  const ix = e.getAttribute('indexed');
  if (ix != null && INDEXED_RGB[+ix]) return INDEXED_RGB[+ix];
  return null;
}
async function xlsxStyles(zip) {
  const x = await zip.xml('xl/styles.xml');
  if (!x) return [];
  const numFmts = new Map();
  for (const nf of nsAll(x, 'numFmt')) numFmts.set(+nf.getAttribute('numFmtId'), nf.getAttribute('formatCode'));
  const fonts = kidsL(nsAll(x, 'fonts')[0], 'font').map(f => {
    const on = n => { const e = kidL(f, n); return !!e && !/^(0|false)$/i.test(e.getAttribute('val') || ''); };
    const sz = kidL(f, 'sz'), color = xlColor(kidL(f, 'color'));
    return { b: on('b'), i: on('i'), u: !!kidL(f, 'u') && kidL(f, 'u').getAttribute('val') !== 'none', s: on('strike'), fg: color && color !== '#000000' ? color : null, sz: sz ? +sz.getAttribute('val') : 11 };
  });
  const fills = kidsL(nsAll(x, 'fills')[0], 'fill').map(f => { const pf = kidL(f, 'patternFill'); return pf && pf.getAttribute('patternType') === 'solid' ? xlColor(kidL(pf, 'fgColor')) : null; });
  const borders = kidsL(nsAll(x, 'borders')[0], 'border').map(b => ['left', 'right', 'top', 'bottom'].some(s => { const e = kidL(b, s); return e && e.getAttribute('style'); }));
  return kidsL(nsAll(x, 'cellXfs')[0], 'xf').map(xf => {
    const id = +(xf.getAttribute('numFmtId') || 0);
    const font = fonts[+(xf.getAttribute('fontId') || 0)] || {};
    const al = kidL(xf, 'alignment');
    return { fmt: numFmts.get(id) || BUILTIN_FMT[id] || 'General', b: font.b, i: font.i, u: font.u, s: font.s, fg: font.fg, sz: font.sz && font.sz !== 11 ? font.sz : null, bg: fills[+(xf.getAttribute('fillId') || 0)] || null, al: al ? al.getAttribute('horizontal') : null, wrap: !!(al && /^(1|true)$/.test(al.getAttribute('wrapText') || '')), bd: !!borders[+(xf.getAttribute('borderId') || 0)] };
  });
}
function applyXf(cell, st) {
  if (!st) return false;
  let any = false;
  if (st.fmt && !/^general$/i.test(st.fmt)) { cell.fmt = st.fmt; any = true; }
  for (const k of ['b', 'i', 'u', 's', 'fg', 'bg', 'sz', 'wrap', 'bd']) if (st[k]) { cell[k] = st[k]; any = true; }
  if (st.al && st.al !== 'general') { cell.al = st.al === 'centerContinuous' ? 'center' : st.al; any = true; }
  return any;
}
async function xlsxRead(src) {
  const zip = await zipOpen(src);
  const wbx = await zip.xml('xl/workbook.xml');
  if (!wbx) throw new Error('This file has no workbook inside.');
  const rels = parseRels(await zip.xml('xl/_rels/workbook.xml.rels'));
  const pr = nsAll(wbx, 'workbookPr')[0];
  const wb = { sheets: [], active: 0, date1904: !!(pr && /^(1|true)$/.test(pr.getAttribute('date1904') || '')), pass: 0 };
  const sst = [];
  const sx = await zip.xml('xl/sharedStrings.xml');
  if (sx) for (const si of nsAll(sx, 'si')) { let t = ''; for (const n of nsAll(si, 't')) if (!n.parentNode || n.parentNode.localName !== 'rPh') t += n.textContent; sst.push(t); }
  const xfs = await xlsxStyles(zip);
  for (const s of nsAll(wbx, 'sheet')) {
    const rel = rels.get(s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'));
    if (!rel) continue;
    const x = await zip.xml(resolveZipPath('xl/workbook.xml', rel.target));
    if (!x) continue;
    const sh = newSheet(s.getAttribute('name') || 'Sheet' + (wb.sheets.length + 1));
    sh.hidden = /hidden/i.test(s.getAttribute('state') || '');
    readSheetXml(x, sh, sst, xfs);
    wb.sheets.push(sh);
  }
  const view = nsAll(wbx, 'workbookView')[0];
  if (view && view.getAttribute('activeTab')) wb.active = clamp(+view.getAttribute('activeTab'), 0, Math.max(0, wb.sheets.length - 1));
  if (!wb.sheets.length) wb.sheets.push(newSheet('Sheet1'));
  return wb;
}
function readSheetXml(x, sh, sst, xfs) {
  const shared = new Map();
  let rowGuess = 0, count = 0;
  for (const row of kidsL(nsAll(x, 'sheetData')[0], 'row')) {
    const r = row.getAttribute('r') ? +row.getAttribute('r') - 1 : rowGuess;
    rowGuess = r + 1;
    if (row.getAttribute('ht') && /^(1|true)$/.test(row.getAttribute('customHeight') || '')) sh.rowH.set(r, Math.round(+row.getAttribute('ht') * 96 / 72));
    let colGuess = 0;
    for (const c of kidsL(row, 'c')) {
      const ref = c.getAttribute('r');
      const pos = ref ? parseA1(ref) : { r, c: colGuess };
      if (!pos) continue;
      colGuess = pos.c + 1;
      const t = c.getAttribute('t') || 'n', st = xfs[+(c.getAttribute('s') || 0)];
      const vEl = kidL(c, 'v'), fEl = kidL(c, 'f'), isEl = kidL(c, 'is');
      let v = null;
      if (t === 's') v = vEl ? sst[+vEl.textContent] : null;
      else if (t === 'inlineStr') v = isEl ? nsAll(isEl, 't').map(n => n.textContent).join('') : '';
      else if (t === 'b') v = vEl ? /^(1|true)$/i.test(vEl.textContent) : false;
      else if (t === 'e') v = errOf(vEl ? vEl.textContent : '#N/A');
      else if (t === 'str') v = vEl ? vEl.textContent : '';
      else if (t === 'd') { const d = vEl ? new Date(vEl.textContent) : null; v = d && !isNaN(d) ? (d.getTime() - XL_EPOCH) / 864e5 : null; }
      else v = vEl && vEl.textContent !== '' ? +vEl.textContent : null;
      const cell = { v };
      if (fEl) {
        let f = fEl.textContent;
        if (fEl.getAttribute('t') === 'shared') {
          const si = fEl.getAttribute('si');
          if (f) shared.set(si, { f, r: pos.r, c: pos.c });
          else { const base = shared.get(si); if (base) f = shiftFormula(base.f, pos.r - base.r, pos.c - base.c); }
        }
        if (f) cell.f = f.replace(/_xlfn\.|_xlws\./g, '');
      }
      const styled = applyXf(cell, st);
      if (v == null && cell.f == null && !styled) continue;
      sh.cells.set(ck(pos.r, pos.c), cell);
      if (++count > 400000) return;
    }
  }
  for (const col of nsAll(x, 'col')) {
    const min = +col.getAttribute('min') - 1, max = Math.min(+col.getAttribute('max') - 1, min + 300), w = +col.getAttribute('width');
    if (!(w >= 0)) continue;
    for (let c = min; c <= max; c++) sh.colW.set(c, /^(1|true)$/.test(col.getAttribute('hidden') || '') ? 0 : Math.max(0, Math.round(w * 7 + 5)));
  }
  for (const m of nsAll(x, 'mergeCell')) { const rg = parseRangeA1(m.getAttribute('ref') || ''); if (rg) sh.merges.push(rg); }
  const pane = nsAll(x, 'pane')[0];
  if (pane && /frozen/.test(pane.getAttribute('state') || '')) sh.freeze = { r: +(pane.getAttribute('ySplit') || 0), c: +(pane.getAttribute('xSplit') || 0) };
}
/** write a workbook as .xlsx: inline strings, formulas with their cached values, and the styles in use */
async function xlsxWrite(wb, props = {}) {
  const fonts = [{ b: false, i: false, u: false, s: false, fg: null, sz: null }], fills = [null, 'gray125'], numFmts = new Map(), xfs = [{ fmtId: 0, font: 0, fill: 0, al: null, wrap: false, bd: false }];
  const keyOf = o => JSON.stringify(o);
  const fontIx = new Map([[keyOf(fonts[0]), 0]]), fillIx = new Map(), xfIx = new Map([[keyOf(xfs[0]), 0]]);
  let nextFmt = 164;
  const styleOf = cell => {
    const font = { b: !!cell.b, i: !!cell.i, u: !!cell.u, s: !!cell.s, fg: cell.fg || null, sz: cell.sz || null };
    let fk = keyOf(font), fi = fontIx.get(fk);
    if (fi == null) { fi = fonts.length; fonts.push(font); fontIx.set(fk, fi); }
    let fl = 0;
    if (cell.bg) { fl = fillIx.get(cell.bg); if (fl == null) { fl = fills.length; fills.push(cell.bg); fillIx.set(cell.bg, fl); } }
    let fmtId = 0;
    if (cell.fmt && !/^general$/i.test(cell.fmt)) { fmtId = FMT_ID[cell.fmt]; if (fmtId == null) { if (!numFmts.has(cell.fmt)) numFmts.set(cell.fmt, nextFmt++); fmtId = numFmts.get(cell.fmt); } }
    const xf = { fmtId, font: fi, fill: fl, al: cell.al || null, wrap: !!cell.wrap, bd: !!cell.bd };
    const xk = keyOf(xf);
    let xi = xfIx.get(xk);
    if (xi == null) { xi = xfs.length; xfs.push(xf); xfIx.set(xk, xi); }
    return xi;
  };
  const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const files = [];
  wb.sheets.forEach((sh, si) => {
    const b = sheetBounds(sh);
    const rows = new Map();
    for (const [k, cell] of sh.cells) { const r = ckR(k); if (!rows.has(r)) rows.set(r, []); rows.get(r).push([ckC(k), cell]); }
    let data = '';
    for (const r of Array.from(rows.keys()).sort((x, y) => x - y)) {
      const cells = rows.get(r).sort((x, y) => x[0] - y[0]);
      data += '<row r="' + (r + 1) + '"' + (sh.rowH.has(r) ? ' ht="' + (sh.rowH.get(r) * 72 / 96).toFixed(2) + '" customHeight="1"' : '') + '>';
      for (const [c, cell] of cells) {
        const s = styleOf(cell), ref = a1(r, c), sa = s ? ' s="' + s + '"' : '';
        const v = cell.v;
        if (cell.f != null) {
          const ty = typeof v === 'string' ? ' t="str"' : typeof v === 'boolean' ? ' t="b"' : isErr(v) ? ' t="e"' : '';
          const vv = v == null ? '' : typeof v === 'boolean' ? (v ? '1' : '0') : isErr(v) ? v.code : String(v);
          data += '<c r="' + ref + '"' + sa + ty + '><f>' + xmlEsc(cell.f) + '</f>' + (vv !== '' ? '<v>' + xmlEsc(vv) + '</v>' : '') + '</c>';
        } else if (v == null || v === '') data += '<c r="' + ref + '"' + sa + '/>';
        else if (typeof v === 'number') data += '<c r="' + ref + '"' + sa + '><v>' + (isFinite(v) ? String(v) : '0') + '</v></c>';
        else if (typeof v === 'boolean') data += '<c r="' + ref + '"' + sa + ' t="b"><v>' + (v ? 1 : 0) + '</v></c>';
        else if (isErr(v)) data += '<c r="' + ref + '"' + sa + ' t="e"><v>' + xmlEsc(v.code) + '</v></c>';
        else data += '<c r="' + ref + '"' + sa + ' t="inlineStr"><is><t xml:space="preserve">' + xmlEsc(String(v)) + '</t></is></c>';
      }
      data += '</row>';
    }
    const widths = Array.from(sh.colW.entries()).sort((x, y) => x[0] - y[0]);
    const cols = widths.length ? '<cols>' + widths.map(([c, w]) => '<col min="' + (c + 1) + '" max="' + (c + 1) + '" width="' + (w <= 0 ? 0 : Math.max(0.5, (w - 5) / 7)).toFixed(2) + '" customWidth="1"' + (w <= 0 ? ' hidden="1"' : '') + '/>').join('') + '</cols>' : '';
    const fz = sh.freeze && (sh.freeze.r || sh.freeze.c) ? '<pane' + (sh.freeze.c ? ' xSplit="' + sh.freeze.c + '"' : '') + (sh.freeze.r ? ' ySplit="' + sh.freeze.r + '"' : '') + ' topLeftCell="' + a1(sh.freeze.r, sh.freeze.c) + '" activePane="' + (sh.freeze.r && sh.freeze.c ? 'bottomRight' : sh.freeze.r ? 'bottomLeft' : 'topRight') + '" state="frozen"/>' : '';
    const merges = sh.merges.length ? '<mergeCells count="' + sh.merges.length + '">' + sh.merges.map(m => '<mergeCell ref="' + a1(m.r1, m.c1) + ':' + a1(m.r2, m.c2) + '"/>').join('') + '</mergeCells>' : '';
    const dim = b.maxR >= 0 ? 'A1:' + a1(b.maxR, Math.max(0, b.maxC)) : 'A1';
    files.push({ name: 'xl/worksheets/sheet' + (si + 1) + '.xml', data: XML_HEAD + '<worksheet ' + NS + '><dimension ref="' + dim + '"/><sheetViews><sheetView workbookViewId="0"' + (si === wb.active ? ' tabSelected="1"' : '') + '>' + fz + '</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>' + cols + '<sheetData>' + data + '</sheetData>' + merges + '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>' });
  });
  const argb = c => 'FF' + c.replace('#', '').toUpperCase();
  const stylesXml = XML_HEAD + '<styleSheet ' + NS + '>' +
    (numFmts.size ? '<numFmts count="' + numFmts.size + '">' + Array.from(numFmts.entries()).map(([f, id]) => '<numFmt numFmtId="' + id + '" formatCode="' + xmlEsc(f) + '"/>').join('') + '</numFmts>' : '') +
    '<fonts count="' + fonts.length + '">' + fonts.map(f => '<font>' + (f.b ? '<b/>' : '') + (f.i ? '<i/>' : '') + (f.s ? '<strike/>' : '') + (f.u ? '<u/>' : '') + '<sz val="' + (f.sz || 11) + '"/>' + (f.fg ? '<color rgb="' + argb(f.fg) + '"/>' : '<color theme="1"/>') + '<name val="Calibri"/><family val="2"/></font>').join('') + '</fonts>' +
    '<fills count="' + fills.length + '">' + fills.map(f => (f == null ? '<fill><patternFill patternType="none"/></fill>' : f === 'gray125' ? '<fill><patternFill patternType="gray125"/></fill>' : '<fill><patternFill patternType="solid"><fgColor rgb="' + argb(f) + '"/><bgColor indexed="64"/></patternFill></fill>')).join('') + '</fills>' +
    '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color auto="1"/></left><right style="thin"><color auto="1"/></right><top style="thin"><color auto="1"/></top><bottom style="thin"><color auto="1"/></bottom><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="' + xfs.length + '">' + xfs.map(x => '<xf numFmtId="' + x.fmtId + '" fontId="' + x.font + '" fillId="' + x.fill + '" borderId="' + (x.bd ? 1 : 0) + '" xfId="0"' + (x.fmtId ? ' applyNumberFormat="1"' : '') + (x.font ? ' applyFont="1"' : '') + (x.fill ? ' applyFill="1"' : '') + (x.bd ? ' applyBorder="1"' : '') + (x.al || x.wrap ? ' applyAlignment="1"><alignment' + (x.al ? ' horizontal="' + x.al + '"' : '') + (x.wrap ? ' wrapText="1"' : '') + '/></xf>' : '/>')).join('') + '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  const sheetsXml = wb.sheets.map((sh, i) => '<sheet name="' + xmlEsc(sh.name) + '" sheetId="' + (i + 1) + '"' + (sh.hidden ? ' state="hidden"' : '') + ' r:id="rId' + (i + 1) + '"/>').join('');
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  files.unshift(
    { name: '[Content_Types].xml', data: XML_HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' + wb.sheets.map((s, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>' },
    { name: '_rels/.rels', data: XML_HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', data: XML_HEAD + '<workbook ' + NS + '><workbookPr' + (wb.date1904 ? ' date1904="1"' : '') + '/><bookViews><workbookView activeTab="' + (wb.active || 0) + '"/></bookViews><sheets>' + sheetsXml + '</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>' },
    { name: 'xl/_rels/workbook.xml.rels', data: XML_HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + wb.sheets.map((s, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') + '<Relationship Id="rId' + (wb.sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
    { name: 'xl/styles.xml', data: stylesXml },
    { name: 'docProps/core.xml', data: XML_HEAD + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>' + xmlEsc(props.title || '') + '</dc:title><dc:creator>' + xmlEsc(props.author || 'LANscape Ledger') + '</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">' + now + '</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">' + now + '</dcterms:modified></cp:coreProperties>' },
    { name: 'docProps/app.xml', data: XML_HEAD + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>LANscape Ledger</Application></Properties>' }
  );
  return zipWrite(files, MIME.xlsx);
}
/* ---------------- .csv ---------------- */
function csvToWorkbook(text, name) {
  const rows = parseCSV(text);
  const sh = newSheet(String(name || 'Sheet1').replace(/\.[a-z0-9]+$/i, '').slice(0, 31) || 'Sheet1');
  rows.forEach((row, r) => row.forEach((raw, c) => {
    if (raw === '') return;
    if (raw[0] === '=' && raw.length > 1) { sh.cells.set(ck(r, c), { f: raw.slice(1), v: null }); return; }
    const p = parseInput(raw);
    if (p.v == null) return;
    const cell = { v: p.v };
    if (p.fmt) cell.fmt = p.fmt;
    sh.cells.set(ck(r, c), cell);
  }));
  // a header row (text over numbers) gets bold
  const first = rows[0] || [], second = rows[1] || [];
  if (first.length && first.every(x => x === '' || parseNumberText(x) == null) && second.some(x => parseNumberText(x) != null)) first.forEach((x, c) => { const cell = sh.cells.get(ck(0, c)); if (cell) cell.b = true; });
  return { sheets: [sh], active: 0, date1904: false, pass: 0 };
}
function sheetToCSV(sh, delim = ',') {
  const b = sheetBounds(sh);
  const out = [];
  for (let r = 0; r <= b.maxR; r++) {
    const row = [];
    for (let c = 0; c <= b.maxC; c++) { const cell = sh.cells.get(ck(r, c)); row.push(cell && cell.v != null ? formatValue(cell.v, cell.fmt).text : ''); }
    out.push(row);
  }
  return toCSV(out, delim);
}
