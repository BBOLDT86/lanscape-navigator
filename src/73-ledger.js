/* ===================================================================
   LANscape Ledger: an Excel 97-style spreadsheet
   =================================================================== */
const LEDGER_CSS = `.lg-fx{display:flex;gap:4px;align-items:center;padding:3px 4px;flex:none;border-bottom:1px solid var(--sh);background:var(--face)}
.lg-fx .nb{width:86px;font:12px Arial,sans-serif;text-align:left}
.lg-fx .fxb{width:26px;height:21px;padding:0;font:italic bold 12px "Times New Roman",serif}
.lg-fx .fi{flex:1;min-width:60px;font:13px Arial,Helvetica,"Liberation Sans",sans-serif}
.lg-grid{flex:1;min-height:0;position:relative;overflow:hidden;background:#fff;margin:0 2px;font:13px Arial,Helvetica,"Liberation Sans",sans-serif;user-select:none;outline:none}
.lg-grid .p{position:absolute;overflow:hidden}
.lg-grid .lay{position:absolute;left:0;top:0;will-change:transform}
.lg-br{overflow:scroll!important}
.lg-br .lay{will-change:auto}
.lay.ovl{z-index:9;pointer-events:none}.lay.ovl>*{pointer-events:auto}
.lg-sizer{position:absolute;left:0;top:0;width:1px;height:1px;pointer-events:none}
.c{position:absolute;box-sizing:border-box;border-right:1px solid #d4d4d4;border-bottom:1px solid #d4d4d4;padding:0 3px;white-space:nowrap;overflow:hidden;line-height:19px;color:#000}
.c.v{z-index:1;background:#fff}
.c.wr{white-space:pre-wrap;line-height:1.2;padding-top:2px;overflow-wrap:anywhere}
.c.bd{border:1px solid #000}
.c.m{z-index:2;display:flex;align-items:center}
.hd{position:absolute;box-sizing:border-box;background:var(--face);border-right:1px solid var(--sh);border-bottom:1px solid var(--sh);box-shadow:inset 1px 1px var(--hi);text-align:center;font:11px Tahoma,Arial,sans-serif;line-height:19px;color:#000;cursor:default}
.hd.on{background:#a8a8a8;font-weight:bold}
.ch .hd{cursor:s-resize}.ch .hd{cursor:default}
.lg-corner{position:absolute;left:0;top:0;background:var(--face);box-shadow:inset -1px -1px var(--sh),inset 1px 1px var(--hi);cursor:default}
.selx{position:absolute;z-index:4;background:rgba(0,0,128,.13);pointer-events:none}
.actx{position:absolute;z-index:5;border:2px solid #000;pointer-events:none;box-sizing:border-box}
.fh{position:absolute;z-index:6;width:7px;height:7px;background:#000;border:1px solid #fff;cursor:crosshair;box-sizing:border-box}
.cpx{position:absolute;z-index:5;pointer-events:none;outline:2px dashed #000;outline-offset:-2px;animation:ants .5s steps(2) infinite}
@keyframes ants{50%{outline-color:#fff}}
.refx{position:absolute;z-index:5;pointer-events:none;border:2px solid;box-sizing:border-box}
.fsep{position:absolute;z-index:7;background:#000;pointer-events:none}
textarea.lg-ed{position:absolute;z-index:8;border:2px solid #000;margin:0;padding:0 2px;font:13px Arial,Helvetica,"Liberation Sans",sans-serif;line-height:16px;resize:none;outline:none;overflow:hidden;white-space:pre;background:#fff;color:#000;box-shadow:2px 2px 0 rgba(0,0,0,.2)}
textarea.lg-focus{position:absolute;left:-9999px;top:0;width:40px;height:20px;opacity:0}
.lg-ac{position:absolute;z-index:20;background:#fff;border:1px solid #000;font:11px Tahoma,Arial,sans-serif;min-width:160px;box-shadow:2px 2px 0 rgba(0,0,0,.25)}
.lg-ac div{padding:2px 6px;cursor:default}.lg-ac div.on{background:var(--sel);color:var(--selt)}
.lg-tabs{display:flex;align-items:flex-start;gap:0;flex:none;background:var(--face);padding:0 2px 1px;border-top:1px solid var(--dk);height:22px;overflow:hidden}
.lg-tabs .arr{width:18px;min-width:0;height:18px;min-height:0;padding:0;font-size:8px;margin-right:1px}
.lg-tabs .tabsx{display:flex;overflow:hidden;flex:1;min-width:0}
.lg-tab{position:relative;padding:2px 14px 3px;margin-right:-6px;font:11px Tahoma,Arial,sans-serif;background:#d8d8d8;border:0;clip-path:polygon(0 0,100% 0,calc(100% - 7px) 100%,7px 100%);cursor:default;white-space:nowrap}
.lg-tab::before{content:"";position:absolute;inset:0;border-bottom:1px solid #000;pointer-events:none}
.lg-tab.on{background:#fff;font-weight:bold;z-index:2}
.lg-tab.add{font-weight:bold;padding:2px 12px}
.lg-print{display:none}
@media print{.lg-grid,.lg-fx,.lg-tabs{display:none!important}.lg-print{display:block}.lg-print table{border-collapse:collapse;font:10pt Arial,sans-serif}.lg-print td{border:1px solid #bbb;padding:2px 5px;white-space:nowrap}.lg-print h3{font:bold 12pt Arial;margin:0 0 6px}}
.chart-svg{background:#fff;border:1px solid #808080;display:block;max-width:100%;height:auto}`;
const L_DW = 72, L_DH = 20, L_HW = 44, L_HH = 20;
const LEDGER_FMTS = [
  ['General', 'General'], ['Number', '0.00'], ['Number (1,000)', '#,##0.00'], ['Whole number', '#,##0'], ['Currency', '$#,##0.00_);($#,##0.00)'], ['Currency (red negatives)', '$#,##0.00_);[Red]($#,##0.00)'],
  ['Accounting', '_("$"* #,##0.00_);_("$"* \\(#,##0.00\\);_("$"* "-"??_);_(@_)'], ['Percent', '0%'], ['Percent (2 places)', '0.00%'], ['Scientific', '0.00E+00'],
  ['Date (11/14/2026)', 'm/d/yyyy'], ['Date (14-Nov-26)', 'd-mmm-yy'], ['Date (November 14, 2026)', 'mmmm d, yyyy'], ['Date (Sat 11/14)', 'ddd m/d'], ['Time (6:30 PM)', 'h:mm AM/PM'], ['Time (18:30:00)', 'h:mm:ss'], ['Date & time', 'm/d/yyyy h:mm'], ['Text', '@']
];
const isNumFmt = f => !!f && /[0#]/.test(f) && !isDateFmt(f.split(';')[0]);
function cloneCell(c) { if (!c) return null; const o = Object.assign({}, c); delete o.ast; delete o.astF; delete o.pass; delete o.busy; return o; }
function cellEditText(cell) {
  if (!cell) return '';
  if (cell.f != null) return '=' + cell.f;
  const v = cell.v;
  if (v == null) return '';
  if (isErr(v)) return v.code;
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') {
    const f = cell.fmt || '';
    if (isDateFmt((f.split(';')[0]) || '')) { const p = serialParts(v); const hasT = /h|s/i.test(f.replace(/"[^"]*"/g, '')); const hasD = /[dy]|m(?![^;]*[hs])/i.test(f.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '')); return (hasD || !hasT ? (p.m + 1) + '/' + p.d + '/' + p.y : '') + (hasT ? (hasD ? ' ' : '') + (p.hh % 12 || 12) + ':' + pad(p.mi, 2) + (p.ss ? ':' + pad(p.ss, 2) : '') + ' ' + (p.hh < 12 ? 'AM' : 'PM') : ''); }
    if (/%/.test(f.split(';')[0])) return generalNum(+(v * 100).toPrecision(12)) + '%';
    return generalNum(v);
  }
  const s = String(v);
  return parseNumberText(s) != null || /^(true|false)$/i.test(s) || (s[0] === '=' && s.length > 1) || s[0] === "'" ? "'" + s : s;
}
/** a formula as Excel would show it after you type it: function names and references in capitals */
function tidyFormula(f) {
  const toks = ftokenize(f);
  let out = '', last = 0;
  for (const t of toks) { if (t.t === 'fn' || t.t === 'ref' || t.t === 'bool') { out += f.slice(last, t.a) + (t.t === 'ref' ? refText(t) : t.t === 'bool' ? (t.v ? 'TRUE' : 'FALSE') : t.v); last = t.b; } }
  return out + f.slice(last);
}
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** what comes next when you drag the fill handle */
function fillSeries(src, n) {
  const out = [];
  const vals = src.map(c => (c ? c.v : null));
  const numsOnly = src.length >= 2 && src.every(c => c && c.f == null && typeof c.v === 'number');
  if (numsOnly) {
    const step = (vals[vals.length - 1] - vals[0]) / (vals.length - 1);
    for (let i = 0; i < n; i++) { const c = cloneCell(src[i % src.length]); c.v = +(vals[vals.length - 1] + step * (i + 1)).toPrecision(15); out.push(c); }
    return out;
  }
  for (let i = 0; i < n; i++) {
    const s = src[i % src.length], k = Math.floor(i / src.length) + 1;
    const c = cloneCell(s) || {};
    if (s && s.f == null && typeof s.v === 'string') {
      const lists = [MONTHS, MONTHS_LONG, DAYS_LONG, DAYS_LONG.map(x => x.slice(0, 3))];
      const L = lists.find(l => l.some(x => x.toLowerCase() === s.v.toLowerCase()));
      if (L) { const j = L.findIndex(x => x.toLowerCase() === s.v.toLowerCase()); c.v = L[(j + k * (src.length === 1 ? 1 : src.length)) % L.length]; }
      else { const m = /^(.*?)(\d+)(\D*)$/.exec(s.v); if (m) c.v = m[1] + (parseInt(m[2], 10) + k * src.length).toString().padStart(m[2].length, '0') + m[3]; }
    } else if (s && s.f == null && typeof s.v === 'number' && src.length === 1 && isDateFmt(((s.fmt || '').split(';')[0]))) c.v = s.v + k;
    out.push(c);
  }
  return out;
}
function chartSVG(m, type, title) {
  // m: rows of values; first row/col may be labels
  const rows = m.filter(r => r.some(v => v != null && v !== ''));
  if (!rows.length) return '<p>Select some numbers first.</p>';
  const hasHead = rows[0].some(v => typeof v === 'string') && rows.length > 1;
  const hasLab = rows.slice(hasHead ? 1 : 0).every(r => typeof r[0] === 'string' || r[0] == null) && rows[0].length > 1;
  const head = hasHead ? rows[0].slice(hasLab ? 1 : 0).map(v => String(v == null ? '' : v)) : null;
  const body = rows.slice(hasHead ? 1 : 0);
  const cats = body.map((r, i) => (hasLab ? String(r[0] == null ? '' : r[0]) : String(i + 1)));
  const nser = Math.max(1, (body[0] || []).length - (hasLab ? 1 : 0));
  const series = Array.from({ length: nser }, (_, j) => ({ name: head ? head[j] || 'Series ' + (j + 1) : 'Series ' + (j + 1), vals: body.map(r => { const v = r[j + (hasLab ? 1 : 0)]; return typeof v === 'number' ? v : 0; }) }));
  const W = 560, H = 340, colors = ['#000080', '#c00000', '#008000', '#ff8000', '#800080', '#008080', '#808000', '#ff00ff'];
  const T = s => esc(clip(String(s), 22));
  let svg = '<svg class="chart-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" font-family="Arial" font-size="11"><rect width="' + W + '" height="' + H + '" fill="#fff"/>';
  if (title) svg += '<text x="' + W / 2 + '" y="20" text-anchor="middle" font-size="14" font-weight="bold">' + esc(title) + '</text>';
  const legend = (x0, y0) => series.map((s, j) => '<rect x="' + x0 + '" y="' + (y0 + j * 16) + '" width="10" height="10" fill="' + colors[j % 8] + '"/><text x="' + (x0 + 14) + '" y="' + (y0 + j * 16 + 9) + '">' + T(s.name) + '</text>').join('');
  if (type === 'pie') {
    const vals = series[0].vals.map(v => Math.max(0, v)), tot = vals.reduce((a, b) => a + b, 0) || 1;
    let a = -Math.PI / 2;
    const cx = 200, cy = 185, r = 130;
    vals.forEach((v, i) => {
      const b = a + v / tot * Math.PI * 2;
      const large = b - a > Math.PI ? 1 : 0;
      svg += '<path d="M' + cx + ' ' + cy + ' L' + (cx + r * Math.cos(a)).toFixed(1) + ' ' + (cy + r * Math.sin(a)).toFixed(1) + ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + (cx + r * Math.cos(b)).toFixed(1) + ' ' + (cy + r * Math.sin(b)).toFixed(1) + 'Z" fill="' + colors[i % 8] + '" stroke="#fff"/>';
      a = b;
    });
    svg += cats.map((c, i) => '<rect x="380" y="' + (60 + i * 16) + '" width="10" height="10" fill="' + colors[i % 8] + '"/><text x="394" y="' + (69 + i * 16) + '">' + T(c) + ' (' + Math.round(vals[i] / tot * 100) + '%)</text>').join('');
    return svg + '</svg>';
  }
  const all = series.flatMap(s => s.vals);
  let lo = Math.min(0, ...all), hi = Math.max(0, ...all);
  if (hi === lo) hi = lo + 1;
  const mag = Math.pow(10, Math.floor(Math.log10((hi - lo) / 5))), step = [1, 2, 2.5, 5, 10].map(k => k * mag).find(s => (hi - lo) / s <= 6) || mag * 10;
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
  const X0 = 60, Y0 = 36, PW = 360, PH = 250;
  const y = v => Y0 + PH - (v - lo) / (hi - lo) * PH;
  for (let v = lo; v <= hi + step / 2; v += step) svg += '<line x1="' + X0 + '" x2="' + (X0 + PW) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '" stroke="#c0c0c0"/><text x="' + (X0 - 6) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + esc(generalNum(+v.toPrecision(10))) + '</text>';
  svg += '<rect x="' + X0 + '" y="' + Y0 + '" width="' + PW + '" height="' + PH + '" fill="none" stroke="#000"/>';
  const n = cats.length, bw = PW / n;
  cats.forEach((c, i) => { if (n <= 16 || i % Math.ceil(n / 16) === 0) svg += '<text x="' + (X0 + bw * (i + .5)).toFixed(1) + '" y="' + (Y0 + PH + 14) + '" text-anchor="middle">' + T(c) + '</text>'; });
  series.forEach((s, j) => {
    if (type === 'line') svg += '<polyline fill="none" stroke="' + colors[j % 8] + '" stroke-width="2.5" points="' + s.vals.map((v, i) => (X0 + bw * (i + .5)).toFixed(1) + ',' + y(v).toFixed(1)).join(' ') + '"/>' + s.vals.map((v, i) => '<rect x="' + (X0 + bw * (i + .5) - 3).toFixed(1) + '" y="' + (y(v) - 3).toFixed(1) + '" width="6" height="6" fill="' + colors[j % 8] + '"/>').join('');
    else { const gw = bw * 0.8 / series.length; s.vals.forEach((v, i) => { const x = X0 + bw * i + bw * 0.1 + gw * j; svg += '<rect x="' + x.toFixed(1) + '" y="' + Math.min(y(v), y(0)).toFixed(1) + '" width="' + Math.max(1, gw - 1).toFixed(1) + '" height="' + Math.abs(y(v) - y(0)).toFixed(1) + '" fill="' + colors[j % 8] + '" stroke="#000" stroke-width=".5"/>'; }); }
  });
  return svg + legend(X0 + PW + 16, Y0 + 10) + '</svg>';
}
async function mountLedger(ctx) {
  const { h, doc, win } = ctx;
  let d = ctx.file;
  let wb, note = '';
  if (d) {
    if (d.ext === 'csv' || d.ext === 'tsv') wb = csvToWorkbook(await ctx.text(d), d.name);
    else if (/^(xlsx|xlsm|xltx)$/.test(d.ext)) wb = await xlsxRead(await ctx.blob(d));
    else throw new Error('Ledger opens .xlsx, .csv and .tsv files. ' + d.name + ' is a different kind of spreadsheet.');
  } else wb = newWorkbook();
  recalc(wb);
  let sh = wb.sheets[wb.active] || wb.sheets[0];
  let dirty = false;
  const name = () => (d ? d.name : 'Book1');
  const undoStack = [], redoStack = [];
  let clip = null;
  /* ---------- geometry ---------- */
  let nR = 100, nC = 26, colPos = null, rowPos = null, FW = 0, FH = 0;
  const colW = c => { const w = sh.colW.get(c); return w == null ? L_DW : w; };
  const rowH = r => { const v = sh.rowH.get(r); return v == null ? L_DH : v; };
  function layout() {
    const b = sheetBounds(sh);
    const sr = sh.sel && sh.sel.r2 < XL_ROWS - 1 ? sh.sel.r2 : 0, sc = sh.sel && sh.sel.c2 < XL_COLS - 1 ? sh.sel.c2 : 0;
    nC = clamp(Math.max(b.maxC + 8, sh.freeze.c + 2, 26, sc + 4), 1, XL_COLS);
    nR = clamp(Math.max(b.maxR + 60, sh.freeze.r + 2, 120, sr + 40, nR), 1, XL_ROWS);
    colPos = new Float64Array(nC + 1);
    for (let c = 0; c < nC; c++) colPos[c + 1] = colPos[c] + colW(c);
    rowPos = new Float64Array(nR + 1);
    for (let r = 0; r < nR; r++) rowPos[r + 1] = rowPos[r] + rowH(r);
    FW = colPos[Math.min(sh.freeze.c, nC)];
    FH = rowPos[Math.min(sh.freeze.r, nR)];
  }
  const find = (pos, n, x) => { let lo = 0, hi = n - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (pos[mid] <= x) lo = mid; else hi = mid - 1; } return lo; };
  const findCol = x => find(colPos, nC, x), findRow = y => find(rowPos, nR, y);
  /* ---------- DOM ---------- */
  const focusTa = h('textarea', { class: 'lg-focus', 'aria-label': 'Spreadsheet', tabindex: '0' });
  const grid = h('div', { class: 'lg-grid sunk', role: 'grid', 'aria-label': 'Cells' });
  const corner = h('div', { class: 'lg-corner', title: 'Select All', style: { width: L_HW + 'px', height: L_HH + 'px' } });
  const mk = cls => { const p = h('div', { class: 'p ' + cls }); const lay = h('div', { class: 'lay' }); const ovl = h('div', { class: 'lay ovl' }); p.append(lay, ovl); grid.append(p); return { p, lay, ovl }; };
  const P = { chF: mk('ch chf'), chS: mk('ch chs'), rhF: mk('rh rhf'), rhS: mk('rh rhs'), tl: mk('tl'), tr: mk('tr'), bl: mk('bl') };
  const br = h('div', { class: 'p lg-br' });
  const brLay = h('div', { class: 'lay' }), brOvl = h('div', { class: 'lay ovl' }), sizer = h('div', { class: 'lg-sizer' });
  br.append(sizer, brLay, brOvl);
  grid.append(br, corner, focusTa);
  const nameBox = h('input', { class: 'fld nb', 'aria-label': 'Name box', spellcheck: 'false' });
  const fxInput = h('input', { class: 'fld fi', 'aria-label': 'Formula bar', spellcheck: 'false' });
  const fxBtn = h('button', { class: 'btn fxb', type: 'button', title: 'Insert Function', text: 'fx' });
  const fxBar = h('div', { class: 'lg-fx noprint' }, nameBox, fxBtn, fxInput);
  const tabsBox = h('div', { class: 'tabsx' });
  const tabs = h('div', { class: 'lg-tabs noprint' }, h('button', { class: 'btn arr', type: 'button', text: '◀', title: 'Previous sheet', onclick: () => switchSheet(Math.max(0, wb.sheets.indexOf(sh) - 1)) }), h('button', { class: 'btn arr', type: 'button', text: '▶', title: 'Next sheet', onclick: () => switchSheet(Math.min(wb.sheets.length - 1, wb.sheets.indexOf(sh) + 1)) }), tabsBox);
  const st = { mode: h('span', { text: 'Ready' }), calc: h('span', { class: 'grow', text: '' }), info: h('span', { text: '' }) };
  const statusBar = h('div', { class: 'status noprint' }, st.mode, st.calc, st.info);
  const printBox = h('div', { class: 'lg-print' });
  /* ---------- selection ---------- */
  if (!sh.sel) sh.sel = { r1: 0, c1: 0, r2: 0, c2: 0, ar: 0, ac: 0 };
  let sel = sh.sel;
  let anchor = { r: sel.ar, c: sel.ac }, focusPt = { r: sel.ar, c: sel.ac };
  const mergeAt = (r, c) => sh.merges.find(m => r >= m.r1 && r <= m.r2 && c >= m.c1 && c <= m.c2) || null;
  function setSel(r1, c1, r2, c2, ar, ac) {
    sel = sh.sel = { r1: Math.min(r1, r2), c1: Math.min(c1, c2), r2: Math.max(r1, r2), c2: Math.max(c1, c2), ar, ac };
    for (const m of sh.merges) if (!(m.r2 < sel.r1 || m.r1 > sel.r2 || m.c2 < sel.c1 || m.c1 > sel.c2)) { sel.r1 = Math.min(sel.r1, m.r1); sel.c1 = Math.min(sel.c1, m.c1); sel.r2 = Math.max(sel.r2, m.r2); sel.c2 = Math.max(sel.c2, m.c2); }
    if ((sel.r2 >= nR - 20 && sel.r2 < XL_ROWS - 1) || (sel.c2 >= nC - 4 && sel.c2 < XL_COLS - 1)) layout();
    paint();
    syncBar();
  }
  function select(r, c, extend) {
    r = clamp(r, 0, XL_ROWS - 1); c = clamp(c, 0, XL_COLS - 1);
    if (extend) { focusPt = { r, c }; setSel(anchor.r, anchor.c, r, c, anchor.r, anchor.c); }
    else { const m = mergeAt(r, c); if (m) { r = m.r1; c = m.c1; } anchor = { r, c }; focusPt = { r, c }; setSel(r, c, r, c, r, c); }
    scrollIntoView(extend ? focusPt.r : r, extend ? focusPt.c : c);
  }
  function scrollIntoView(r, c) {
    const vw = br.clientWidth, vh = br.clientHeight;
    if (c >= sh.freeze.c) { const x1 = colPos[c] - FW, x2 = colPos[c + 1] - FW; if (x1 < br.scrollLeft) br.scrollLeft = x1; else if (x2 > br.scrollLeft + vw) br.scrollLeft = x2 - vw; }
    if (r >= sh.freeze.r) { const y1 = rowPos[r] - FH, y2 = rowPos[r + 1] - FH; if (y1 < br.scrollTop) br.scrollTop = y1; else if (y2 > br.scrollTop + vh) br.scrollTop = y2 - vh; }
  }
  const cellAt = (r, c, s = sh) => s.cells.get(ck(r, c)) || null;
  /* ---------- painting ---------- */
  let rafPending = false;
  function paint() { if (rafPending) return; rafPending = true; win.requestAnimationFrame(() => { rafPending = false; paintNow(); }); }
  const CW = 6.6;
  function cellHTML(r, c, x, y, w, hgt, spill) {
    const cell = cellAt(r, c);
    const m = mergeAt(r, c);
    if (m && (m.r1 !== r || m.c1 !== c)) return '';
    if (m) { w = colPos[Math.min(m.c2 + 1, nC)] - colPos[m.c1]; hgt = rowPos[Math.min(m.r2 + 1, nR)] - rowPos[m.r1]; }
    if (!cell || (cell.v == null && cell.f == null && !cell.bg && !cell.bd)) return '<div class="c" style="left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + hgt + 'px"></div>';
    const fv = formatValue(cell.v, cell.fmt);
    let text = fv.text;
    const isNum = typeof cell.v === 'number';
    let al = cell.al || (isNum ? 'right' : typeof cell.v === 'boolean' || isErr(cell.v) ? 'center' : 'left');
    if (isNum && text.length * CW > w - 6 && !cell.wrap) {
      if (!cell.fmt || /^general$/i.test(cell.fmt)) { const room = Math.max(1, Math.floor((w - 6) / CW)); let t2 = text; for (let p = 10; p > 0 && t2.length > room; p--) t2 = generalNum(+cell.v.toPrecision(p)); text = t2.length > room ? '#'.repeat(room) : t2; }
      else text = '#'.repeat(Math.max(1, Math.floor((w - 6) / CW)));
    }
    let width = w;
    if (!isNum && al === 'left' && !cell.wrap && !m && spill) {
      // text spills into empty neighbors to the right
      let need = text.length * CW + 6, cc = c + 1;
      while (need > width && cc < nC && cc < c + 30 && !cellAt(r, cc)) { width += colW(cc); cc++; }
    }
    let css = 'left:' + x + 'px;top:' + y + 'px;width:' + width + 'px;height:' + hgt + 'px;text-align:' + al + ';';
    if (cell.b) css += 'font-weight:bold;';
    if (cell.i) css += 'font-style:italic;';
    if (cell.u || cell.s) css += 'text-decoration:' + (cell.u ? 'underline ' : '') + (cell.s ? 'line-through' : '') + ';';
    if (fv.color || cell.fg) css += 'color:' + (fv.color || cell.fg) + ';';
    if (cell.bg) css += 'background:' + cell.bg + ';';
    if (cell.sz) css += 'font-size:' + Math.round(cell.sz * 96 / 72) + 'px;';
    if (width > w) css += 'z-index:2;';
    if (m) css += 'justify-content:' + (al === 'center' ? 'center' : al === 'right' ? 'flex-end' : 'flex-start') + ';';
    return '<div class="c v' + (cell.wrap ? ' wr' : '') + (cell.bd ? ' bd' : '') + (m ? ' m' : '') + '" style="' + css + '">' + esc(text) + '</div>';
  }
  function paintCells(lay, r0, r1, c0, c1, ox, oy) {
    let html = '';
    const spill = [];
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const x = colPos[c] - ox, y = rowPos[r] - oy, w = colPos[c + 1] - colPos[c], hh = rowPos[r + 1] - rowPos[r];
      if (w <= 0 || hh <= 0) continue;
      const cell = cellAt(r, c);
      if (cell && cell.v != null && typeof cell.v === 'string' && !cell.al && !cell.wrap) spill.push([r, c, x, y, w, hh]);
      else html += cellHTML(r, c, x, y, w, hh, false);
    }
    for (const [r, c, x, y, w, hh] of spill) html += cellHTML(r, c, x, y, w, hh, true);
    html += overlays(r0, r1, c0, c1, ox, oy);
    lay.innerHTML = html;
  }
  function rectOf(r1, c1, r2, c2, ox, oy) { return { x: colPos[c1] - ox, y: rowPos[r1] - oy, w: colPos[Math.min(c2 + 1, nC)] - colPos[c1], h: rowPos[Math.min(r2 + 1, nR)] - rowPos[r1] }; }
  const box = (cls, R, extra) => '<div class="' + cls + '" style="left:' + R.x + 'px;top:' + R.y + 'px;width:' + R.w + 'px;height:' + R.h + 'px;' + (extra || '') + '"></div>';
  const REF_COLORS = ['#0000ff', '#008000', '#a000a0', '#c00000', '#008080', '#808000'];
  function overlays(r0, r1, c0, c1, ox, oy) {
    let o = '';
    const S1 = sel;
    if (!(S1.r2 < r0 || S1.r1 > r1 || S1.c2 < c0 || S1.c1 > c1)) {
      if (S1.r1 !== S1.r2 || S1.c1 !== S1.c2) o += box('selx', rectOf(S1.r1, S1.c1, S1.r2, S1.c2, ox, oy));
      const m = mergeAt(S1.ar, S1.ac);
      const A1 = m ? rectOf(m.r1, m.c1, m.r2, m.c2, ox, oy) : rectOf(S1.ar, S1.ac, S1.ar, S1.ac, ox, oy);
      if (S1.r1 !== S1.r2 || S1.c1 !== S1.c2) o += '<div class="actx" style="left:' + A1.x + 'px;top:' + A1.y + 'px;width:' + A1.w + 'px;height:' + A1.h + 'px;border-width:1px;background:#fff;z-index:3"></div>';
      const R = rectOf(S1.r1, S1.c1, S1.r2, S1.c2, ox, oy);
      o += box('actx', { x: R.x - 1, y: R.y - 1, w: R.w + 1, h: R.h + 1 });
      if (!editing) o += '<div class="fh" style="left:' + (R.x + R.w - 5) + 'px;top:' + (R.y + R.h - 5) + 'px" data-fh="1"></div>';
    }
    if (clip && clip.sheet === sh && !clip.done) o += box('cpx', rectOf(clip.r1, clip.c1, clip.r2, clip.c2, ox, oy));
    if (editing && /^=/.test(editing.input.value)) {
      let i = 0;
      for (const t of ftokenize(editing.input.value.slice(1))) {
        if (t.t !== 'ref' || (t.sheet && t.sheet.toLowerCase() !== sh.name.toLowerCase())) continue;
        o += box('refx', rectOf(Math.min(t.r1, t.r2), Math.min(t.c1, t.c2), Math.min(Math.max(t.r1, t.r2), nR - 1), Math.min(Math.max(t.c1, t.c2), nC - 1), ox, oy), 'border-color:' + REF_COLORS[i++ % REF_COLORS.length]);
      }
    }
    if (fillDrag) o += box('cpx', rectOf(fillDrag.r1, fillDrag.c1, fillDrag.r2, fillDrag.c2, ox, oy), 'outline-style:solid;outline-color:#808080;animation:none');
    return o;
  }
  function headerHTML(kind, i0, i1, ox) {
    let html = '';
    for (let i = i0; i <= i1; i++) {
      if (kind === 'c') { const w = colPos[i + 1] - colPos[i]; if (w <= 0) continue; const on = i >= sel.c1 && i <= sel.c2; html += '<div class="hd' + (on ? ' on' : '') + '" data-c="' + i + '" style="left:' + (colPos[i] - ox) + 'px;top:0;width:' + w + 'px;height:' + L_HH + 'px">' + colName(i) + '</div>'; }
      else { const hh = rowPos[i + 1] - rowPos[i]; if (hh <= 0) continue; const on = i >= sel.r1 && i <= sel.r2; html += '<div class="hd' + (on ? ' on' : '') + '" data-r="' + i + '" style="left:0;top:' + (rowPos[i] - ox) + 'px;width:' + L_HW + 'px;height:' + hh + 'px;line-height:' + hh + 'px">' + (i + 1) + '</div>'; }
    }
    return html;
  }
  function paintNow() {
    if (!ctx.alive()) return;
    const W = grid.clientWidth, H = grid.clientHeight;
    const fr = sh.freeze.r, fc = sh.freeze.c;
    Object.assign(corner.style, { width: L_HW + 'px', height: L_HH + 'px' });
    const place = (o, l, t, w, hh) => Object.assign(o.style, { left: l + 'px', top: t + 'px', width: Math.max(0, w) + 'px', height: Math.max(0, hh) + 'px' });
    place(P.chF.p, L_HW, 0, FW, L_HH); place(P.chS.p, L_HW + FW, 0, W - L_HW - FW, L_HH);
    place(P.rhF.p, 0, L_HH, L_HW, FH); place(P.rhS.p, 0, L_HH + FH, L_HW, H - L_HH - FH);
    place(P.tl.p, L_HW, L_HH, FW, FH); place(P.tr.p, L_HW + FW, L_HH, W - L_HW - FW, FH); place(P.bl.p, L_HW, L_HH + FH, FW, H - L_HH - FH);
    place(br, L_HW + FW, L_HH + FH, W - L_HW - FW, H - L_HH - FH);
    sizer.style.width = (colPos[nC] - FW) + 'px';
    sizer.style.height = (rowPos[nR] - FH) + 'px';
    const sl = br.scrollLeft, stp = br.scrollTop;
    const vw = Math.max(0, W - L_HW - FW), vh = Math.max(0, H - L_HH - FH);
    const c0 = Math.max(fc, findCol(FW + sl)), c1 = Math.min(nC - 1, findCol(FW + sl + vw));
    const r0 = Math.max(fr, findRow(FH + stp)), r1 = Math.min(nR - 1, findRow(FH + stp + vh));
    paintCells(brLay, r0, r1, c0, c1, FW, FH);
    if (fr) { paintCells(P.tr.lay, 0, fr - 1, c0, c1, FW, 0); P.tr.lay.style.transform = P.tr.ovl.style.transform = 'translateX(' + (-sl) + 'px)'; } else P.tr.lay.innerHTML = '';
    if (fc) { paintCells(P.bl.lay, r0, r1, 0, fc - 1, 0, FH); P.bl.lay.style.transform = P.bl.ovl.style.transform = 'translateY(' + (-stp) + 'px)'; } else P.bl.lay.innerHTML = '';
    if (fr && fc) paintCells(P.tl.lay, 0, fr - 1, 0, fc - 1, 0, 0); else P.tl.lay.innerHTML = '';
    P.chS.lay.innerHTML = headerHTML('c', c0, c1, FW); P.chS.lay.style.transform = 'translateX(' + (-sl) + 'px)';
    P.chF.lay.innerHTML = fc ? headerHTML('c', 0, fc - 1, 0) : '';
    P.rhS.lay.innerHTML = headerHTML('r', r0, r1, FH); P.rhS.lay.style.transform = 'translateY(' + (-stp) + 'px)';
    P.rhF.lay.innerHTML = fr ? headerHTML('r', 0, fr - 1, 0) : '';
    for (const x of grid.querySelectorAll('.fsep')) x.remove();
    if (fr) grid.append(h('div', { class: 'fsep', style: { left: '0', right: '0', top: (L_HH + FH - 1) + 'px', height: '1px' } }));
    if (fc) grid.append(h('div', { class: 'fsep', style: { top: '0', bottom: '0', left: (L_HW + FW - 1) + 'px', width: '1px' } }));
    if (editing) placeEditor();
  }
  /* ---------- status + formula bar ---------- */
  function syncBar() {
    nameBox.value = sel.r1 === sel.r2 && sel.c1 === sel.c2 ? a1(sel.ar, sel.ac) : a1(sel.r1, sel.c1) + ':' + a1(sel.r2, sel.c2);
    if (!editing) fxInput.value = cellEditText(cellAt(sel.ar, sel.ac));
    let sum = 0, n = 0, cnt = 0;
    if ((sel.r2 - sel.r1 + 1) * (sel.c2 - sel.c1 + 1) > 1) {
      const b = sheetBounds(sh);
      for (let r = sel.r1; r <= Math.min(sel.r2, b.maxR); r++) for (let c = sel.c1; c <= Math.min(sel.c2, b.maxC); c++) { const cell = cellAt(r, c); if (!cell || cell.v == null) continue; cnt++; if (typeof cell.v === 'number') { sum += cell.v; n++; } }
      st.calc.textContent = cnt ? (n ? 'Sum=' + generalNum(+sum.toPrecision(12)) + '   Average=' + generalNum(+(sum / n).toPrecision(10)) + '   ' : '') + 'Count=' + cnt : '';
    } else {
      const cell = cellAt(sel.ar, sel.ac);
      st.calc.textContent = cell && cell.bad ? 'LANscape Ledger doesn\'t know a function in this formula.' : cell && isErr(cell.v) && cell.v.code === '#CIRC!' ? 'Circular reference: this formula depends on itself.' : '';
    }
    st.info.textContent = sh.name + (wb.sheets.length > 1 ? ' (' + (wb.sheets.indexOf(sh) + 1) + ' of ' + wb.sheets.length + ')' : '');
  }
  const retitle = () => ctx.setTitle(name() + (dirty ? '*' : '') + ' - Ledger');
  function changed() { if (!dirty) { dirty = true; retitle(); } }
  /* ---------- changing cells (with undo) ---------- */
  function commitChanges(changes, label) {
    if (!changes.length) return;
    for (const ch of changes) { if (ch.after) ch.sheet.cells.set(ch.k, ch.after); else ch.sheet.cells.delete(ch.k); }
    undoStack.push({ changes, label });
    if (undoStack.length > 200) undoStack.shift();
    redoStack.length = 0;
    recalc(wb);
    layout(); paint(); syncBar(); changed();
  }
  function change(r, c, fn, s = sh) {
    const k = ck(r, c), before = cloneCell(s.cells.get(k));
    let after = fn(before ? cloneCell(before) : {});
    if (after && after.v == null && after.f == null && !['fmt', 'b', 'i', 'u', 's', 'fg', 'bg', 'al', 'sz', 'wrap', 'bd'].some(x => after[x])) after = null;
    return { sheet: s, k, before, after };
  }
  function snapshot(s) { return { cells: new Map(Array.from(s.cells, ([k, v]) => [k, cloneCell(v)])), colW: new Map(s.colW), rowH: new Map(s.rowH), merges: s.merges.map(m => Object.assign({}, m)), freeze: Object.assign({}, s.freeze) }; }
  function structural(label, fn) {
    const before = wb.sheets.map(snapshot);
    fn();
    const after = wb.sheets.map(snapshot);
    undoStack.push({ struct: true, before, after, label });
    redoStack.length = 0;
    recalc(wb); layout(); paint(); syncBar(); changed();
  }
  function restoreSnaps(snaps) { wb.sheets.forEach((s, i) => { const x = snaps[i]; if (!x) return; s.cells = new Map(Array.from(x.cells, ([k, v]) => [k, cloneCell(v)])); s.colW = new Map(x.colW); s.rowH = new Map(x.rowH); s.merges = x.merges.map(m => Object.assign({}, m)); s.freeze = Object.assign({}, x.freeze); }); }
  function undo() {
    const u = undoStack.pop();
    if (!u) return;
    if (u.struct) restoreSnaps(u.before);
    else for (const ch of u.changes) { if (ch.before) ch.sheet.cells.set(ch.k, cloneCell(ch.before)); else ch.sheet.cells.delete(ch.k); }
    redoStack.push(u);
    recalc(wb); layout(); paint(); syncBar(); changed();
    ctx.status('Undo ' + (u.label || ''));
  }
  function redo() {
    const u = redoStack.pop();
    if (!u) return;
    if (u.struct) restoreSnaps(u.after);
    else for (const ch of u.changes) { if (ch.after) ch.sheet.cells.set(ch.k, cloneCell(ch.after)); else ch.sheet.cells.delete(ch.k); }
    undoStack.push(u);
    recalc(wb); layout(); paint(); syncBar(); changed();
  }
  function inputToCell(text, base) {
    const cell = base || {};
    delete cell.f; delete cell.ast; delete cell.astF; delete cell.pass; delete cell.bad;
    if (text.length > 1 && (text[0] === '=' || (text[0] === '+' && /[A-Za-z(]/.test(text[1])))) {
      const f = text.slice(1);
      fparse(f);
      cell.f = tidyFormula(f);
      cell.v = null;
    } else {
      const p = parseInput(text);
      cell.v = p.v;
      if (p.fmt && (!cell.fmt || /^general$/i.test(cell.fmt))) cell.fmt = p.fmt;
    }
    return cell;
  }
  function eachSel(fn) { const b = sheetBounds(sh); const out = []; for (let r = sel.r1; r <= Math.min(sel.r2, Math.max(b.maxR, sel.r1)); r++) for (let c = sel.c1; c <= Math.min(sel.c2, Math.max(b.maxC, sel.c1)); c++) { const x = fn(r, c); if (x) out.push(x); } return out; }
  function formatSel(fn, label) { commitChanges(eachSel((r, c) => change(r, c, cell => { fn(cell); return cell; })), label); }
  function toggleFmt(key, label) { const cur = cellAt(sel.ar, sel.ac); const on = !(cur && cur[key]); formatSel(cell => { if (on) cell[key] = true; else delete cell[key]; }, label); }
  function clearSel(what) {
    commitChanges(eachSel((r, c) => { const cell = cellAt(r, c); if (!cell) return null; return change(r, c, x => { if (what === 'all') return null; if (what === 'formats') { for (const k of ['fmt', 'b', 'i', 'u', 's', 'fg', 'bg', 'al', 'sz', 'wrap', 'bd']) delete x[k]; return x; } delete x.f; x.v = null; return x; }); }), 'Clear');
  }
  /* ---------- editing ---------- */
  let editing = null;
  const editor = h('textarea', { class: 'lg-ed', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Cell editor', rows: '1' });
  const acBox = h('div', { class: 'lg-ac', hidden: true });
  function editLayer(r, c) { const fr = r < sh.freeze.r, fc = c < sh.freeze.c; return fr && fc ? [P.tl.ovl, 0, 0] : fr ? [P.tr.ovl, FW, 0] : fc ? [P.bl.ovl, 0, FH] : [brOvl, FW, FH]; }
  function placeEditor() {
    const { r, c } = editing;
    const [lay, ox, oy] = editLayer(r, c);
    if (editor.parentNode !== lay) lay.append(editor, acBox);
    const m = mergeAt(r, c);
    const R = m ? rectOf(m.r1, m.c1, m.r2, m.c2, ox, oy) : rectOf(r, c, r, c, ox, oy);
    editor.style.left = (R.x - 1) + 'px';
    editor.style.top = (R.y - 1) + 'px';
    editor.style.height = Math.max(R.h + 1, (editor.value.split('\n').length) * 16 + 4) + 'px';
    const want = Math.max(R.w + 2, Math.min(600, editor.value.split('\n').reduce((a, l) => Math.max(a, l.length), 0) * 7.2 + 16));
    editor.style.width = want + 'px';
    acBox.style.left = (R.x - 1) + 'px';
    acBox.style.top = (R.y + R.h + 2) + 'px';
  }
  function startEdit(text, mode) {
    if (editing) return;
    const r = sel.ar, c = sel.ac;
    const cell = cellAt(r, c);
    editing = { r, c, mode: mode || 'enter', orig: cellEditText(cell), input: editor };
    editor.value = text != null ? text : editing.orig;
    st.mode.textContent = mode === 'edit' ? 'Edit' : 'Enter';
    placeEditor();
    const cs = cell || {};
    editor.style.fontWeight = cs.b ? 'bold' : ''; editor.style.fontStyle = cs.i ? 'italic' : '';
    editor.style.textAlign = typeof cs.v === 'number' && mode === 'edit' && !cs.f ? 'right' : 'left';
    editor.focus();
    const n = editor.value.length;
    editor.setSelectionRange(n, n);
    fxInput.value = editor.value;
    paint();
  }
  function endEdit(commit, move) {
    if (!editing) return true;
    const { r, c } = editing;
    const text = editor.value;
    if (commit && text !== editing.orig) {
      let ch;
      try { ch = change(r, c, base => inputToCell(text, base)); }
      catch (e) { ctx.msg('error', 'LANscape Ledger', '<p>' + esc(e.message || 'There\'s a problem with this formula.') + '</p><p class="hint">Formulas start with = and use cell references like A1 or ranges like A1:B5, for example <b>=SUM(B2:B9)</b>.</p>'); editor.focus(); return false; }
      editing = null;
      commitChanges([ch], 'Typing');
    } else editing = null;
    editor.remove(); acBox.remove(); acBox.hidden = true;
    st.mode.textContent = 'Ready';
    focusTa.focus({ preventScroll: true });
    if (move) select(clamp(sel.ar + move[0], 0, XL_ROWS - 1), clamp(sel.ac + move[1], 0, XL_COLS - 1));
    else { paint(); syncBar(); }
    return true;
  }
  /* formula autocomplete */
  let acList = [], acIdx = 0;
  function updateAC() {
    const v = editor.value, p = editor.selectionStart;
    const m = /^=.*?([A-Za-z][A-Za-z0-9.]*)$/.exec(v.slice(0, p));
    if (!m || /^[A-Za-z]{1,3}\d+$/.test(m[1])) { acBox.hidden = true; return; }
    const pre = m[1].toUpperCase();
    acList = FN_NAMES.filter(n => n.startsWith(pre)).slice(0, 8);
    if (!acList.length || (acList.length === 1 && acList[0] === pre)) { acBox.hidden = true; return; }
    acIdx = 0;
    acBox.innerHTML = acList.map((n, i) => '<div class="' + (i === acIdx ? 'on' : '') + '" data-fn="' + n + '">' + n + '</div>').join('');
    acBox.hidden = false;
  }
  function acceptAC(nm) {
    const v = editor.value, p = editor.selectionStart;
    const m = /([A-Za-z][A-Za-z0-9.]*)$/.exec(v.slice(0, p));
    const before = v.slice(0, p - m[1].length) + nm + '(';
    editor.value = before + v.slice(p);
    editor.setSelectionRange(before.length, before.length);
    acBox.hidden = true;
    fxInput.value = editor.value;
    paint();
  }
  ctx.on(acBox, 'mousedown', e => { const x = e.target.closest('[data-fn]'); if (x) { e.preventDefault(); acceptAC(x.dataset.fn); editor.focus(); } });
  ctx.on(editor, 'input', () => { fxInput.value = editor.value; placeEditor(); updateAC(); paint(); });
  const wantsRef = () => editing && /^=/.test(editor.value) && /[=(,+\-*/^&<>:]\s*$/.test(editor.value.slice(0, editor.selectionStart));
  ctx.on(editor, 'keydown', e => {
    if (!acBox.hidden) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); acIdx = (acIdx + (e.key === 'ArrowDown' ? 1 : -1) + acList.length) % acList.length; acBox.querySelectorAll('div').forEach((x, i) => x.classList.toggle('on', i === acIdx)); return; }
      if (e.key === 'Tab') { e.preventDefault(); acceptAC(acList[acIdx]); return; }
      if (e.key === 'Escape') { e.preventDefault(); acBox.hidden = true; return; }
    }
    if (e.key === 'Enter' && e.altKey) { e.preventDefault(); const p = editor.selectionStart; editor.setRangeText('\n', p, editor.selectionEnd, 'end'); placeEditor(); return; }
    if (e.key === 'Enter') { e.preventDefault(); endEdit(true, [e.shiftKey ? -1 : 1, 0]); return; }
    if (e.key === 'Tab') { e.preventDefault(); endEdit(true, [0, e.shiftKey ? -1 : 1]); return; }
    if (e.key === 'Escape') { e.preventDefault(); endEdit(false); return; }
    if (editing && editing.mode === 'enter' && /^Arrow/.test(e.key) && !wantsRef()) { e.preventDefault(); const mv = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key]; endEdit(true, mv); return; }
    if (e.key === 'F2') { e.preventDefault(); editing.mode = editing.mode === 'edit' ? 'enter' : 'edit'; st.mode.textContent = editing.mode === 'edit' ? 'Edit' : 'Enter'; }
  });
  ctx.on(fxInput, 'focus', () => { if (!editing) { editing = { r: sel.ar, c: sel.ac, mode: 'edit', orig: cellEditText(cellAt(sel.ar, sel.ac)), input: fxInput, bar: true }; st.mode.textContent = 'Edit'; } });
  ctx.on(fxInput, 'input', () => { if (editing && editing.bar) { editor.value = fxInput.value; paint(); } });
  ctx.on(fxInput, 'keydown', e => {
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); if (editing && editing.bar) { editor.value = fxInput.value; const ed = editing; editing = Object.assign(ed, { input: editor }); endEdit(true, e.key === 'Tab' ? [0, 1] : [1, 0]); } }
    else if (e.key === 'Escape') { e.preventDefault(); if (editing && editing.bar) { editing = null; fxInput.value = cellEditText(cellAt(sel.ar, sel.ac)); st.mode.textContent = 'Ready'; focusTa.focus(); } }
  });
  ctx.on(fxInput, 'blur', () => { if (editing && editing.bar) { editor.value = fxInput.value; const ed = editing; editing = Object.assign(ed, { input: editor, bar: false }); endEdit(true); } });
  ctx.on(nameBox, 'keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const rg = parseRangeA1(nameBox.value.replace(/^.*!/, ''));
    if (rg) { anchor = { r: rg.r1, c: rg.c1 }; setSel(rg.r1, rg.c1, rg.r2, rg.c2, rg.r1, rg.c1); scrollIntoView(rg.r1, rg.c1); focusTa.focus(); }
    else ctx.status('Type a cell like B7 or a range like A1:C10.');
  });
  /* ---------- keyboard on the grid ---------- */
  function dataEdge(r, c, dr, dc) {
    const filled = (rr, cc) => { const x = cellAt(rr, cc); return !!(x && (x.v != null || x.f != null)); };
    const b = sheetBounds(sh);
    const limR = Math.max(b.maxR, r) + 1, limC = Math.max(b.maxC, c) + 1;
    let rr = r, cc = c;
    const step = () => { rr += dr; cc += dc; return rr >= 0 && cc >= 0 && rr <= limR && cc <= limC; };
    if (filled(r, c) && filled(r + dr, c + dc)) { while (step() && filled(rr, cc)); return [rr - dr, cc - dc]; }
    while (step() && !filled(rr, cc));
    if (rr < 0 || cc < 0) return [Math.max(0, rr - dr), Math.max(0, cc - dc)];
    if (rr > limR || cc > limC) return dr ? [Math.min(rr, XL_ROWS - 1), c] : [r, Math.min(cc, XL_COLS - 1)];
    return [rr, cc];
  }
  ctx.on(focusTa, 'keydown', e => {
    if (editing) return;
    const mod = e.ctrlKey || e.metaKey, k = e.key;
    const mv = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[k];
    if (mv) {
      e.preventDefault();
      const from = e.shiftKey ? focusPt : { r: sel.ar, c: sel.ac };
      let r = from.r + mv[0], c = from.c + mv[1];
      if (mod) [r, c] = dataEdge(from.r, from.c, mv[0], mv[1]);
      const m = !e.shiftKey && mergeAt(from.r, from.c);
      if (m && !mod) { if (mv[0] > 0) r = m.r2 + 1; if (mv[1] > 0) c = m.c2 + 1; }
      select(r, c, e.shiftKey);
      return;
    }
    if (k === 'Tab') { e.preventDefault(); select(sel.ar, sel.ac + (e.shiftKey ? -1 : 1)); return; }
    if (k === 'Enter') { e.preventDefault(); select(sel.ar + (e.shiftKey ? -1 : 1), sel.ac); return; }
    if (k === 'Home') { e.preventDefault(); if (mod) select(sh.freeze.r, sh.freeze.c, e.shiftKey); else select(sel.ar, 0, e.shiftKey); return; }
    if (k === 'End' && mod) { e.preventDefault(); const b = sheetBounds(sh); select(Math.max(0, b.maxR), Math.max(0, b.maxC), e.shiftKey); return; }
    if (k === 'PageDown' || k === 'PageUp') { e.preventDefault(); const rows = Math.max(1, Math.floor(br.clientHeight / L_DH) - 1); br.scrollTop += (k === 'PageDown' ? 1 : -1) * rows * L_DH; select(sel.ar + (k === 'PageDown' ? rows : -rows), sel.ac, e.shiftKey); return; }
    if (k === 'F2') { e.preventDefault(); startEdit(null, 'edit'); return; }
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); if (k === 'Backspace' && sel.r1 === sel.r2 && sel.c1 === sel.c2) startEdit('', 'enter'); else clearSel('contents'); return; }
    if (k === 'Escape') { if (clip) { clip.done = true; paint(); } return; }
    if (mod && !e.altKey) {
      const lk = k.toLowerCase();
      const map = { z: undo, y: redo, b: () => toggleFmt('b', 'Bold'), i: () => toggleFmt('i', 'Italic'), u: () => toggleFmt('u', 'Underline'), 5: () => toggleFmt('s', 'Strikethrough'), d: () => fillDir('down'), r: () => fillDir('right'), s: () => save(), o: openFile, n: () => ctx.go('http://ledger.lanscape.net/'), p: printSheet, f: () => findDialog(false), h: () => findDialog(true), 1: formatDialog, a: () => { anchor = { r: 0, c: 0 }; setSel(0, 0, XL_ROWS - 1, XL_COLS - 1, sel.ar, sel.ac); } };
      if (lk === 'z' && e.shiftKey) { e.preventDefault(); redo(); return; }
      if (k === ';') { e.preventDefault(); commitChanges([change(sel.ar, sel.ac, x => { x.v = e.shiftKey ? nowSerial() % 1 : todaySerial(); x.fmt = e.shiftKey ? 'h:mm AM/PM' : 'm/d/yyyy'; delete x.f; return x; })], 'Date'); return; }
      if (k === ' ') { e.preventDefault(); anchor = { r: 0, c: sel.c1 }; setSel(0, sel.c1, XL_ROWS - 1, sel.c2, sel.ar, sel.ac); return; }
      if (map[lk]) { e.preventDefault(); map[lk](); }
      return;
    }
    if (e.shiftKey && k === ' ') { e.preventDefault(); anchor = { r: sel.r1, c: 0 }; setSel(sel.r1, 0, sel.r2, XL_COLS - 1, sel.ar, sel.ac); return; }
    if (e.altKey && (k === '=' || k === '+')) { e.preventDefault(); autoSum(); return; }
    if (k.length === 1 && !e.altKey) { startEdit('', 'enter'); /* the key lands in the editor */ }
  });
  /* clipboard */
  function selTSV() {
    const rows = [];
    for (let r = sel.r1; r <= Math.min(sel.r2, sel.r1 + 5000); r++) { const row = []; for (let c = sel.c1; c <= Math.min(sel.c2, sel.c1 + 200); c++) { const cell = cellAt(r, c); row.push(cell ? formatValue(cell.v, cell.fmt).text : ''); } rows.push(row); }
    const b = sheetBounds(sh);
    while (rows.length > 1 && sel.r1 + rows.length - 1 > b.maxR) rows.pop();
    return rows;
  }
  function onCopy(e, cut) {
    if (editing) return;
    e.preventDefault();
    const rows = selTSV();
    const tsv = rows.map(r => r.map(v => (/[\t\n"]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v)).join('\t')).join('\r\n');
    e.clipboardData.setData('text/plain', tsv);
    e.clipboardData.setData('text/html', '<table>' + rows.map(r => '<tr>' + r.map(v => '<td>' + esc(v) + '</td>').join('') + '</tr>').join('') + '</table>');
    const cells = [];
    for (let r = sel.r1; r < sel.r1 + rows.length; r++) { const row = []; for (let c = sel.c1; c <= Math.min(sel.c2, sel.c1 + 200); c++) row.push(cloneCell(cellAt(r, c))); cells.push(row); }
    clip = { sheet: sh, r1: sel.r1, c1: sel.c1, r2: sel.r1 + rows.length - 1, c2: Math.min(sel.c2, sel.c1 + 200), cells, text: tsv, cut };
    paint();
    ctx.status(cut ? 'Select destination and press Enter or choose Paste.' : 'Copied ' + rows.length + ' row' + (rows.length === 1 ? '' : 's') + '.');
  }
  ctx.on(doc, 'copy', e => { if (doc.activeElement === focusTa) onCopy(e, false); });
  ctx.on(doc, 'cut', e => { if (doc.activeElement === focusTa) onCopy(e, true); });
  ctx.on(doc, 'paste', e => {
    if (doc.activeElement !== focusTa || editing) return;
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    pasteText(text);
  });
  function pasteText(text) {
    const changes = [];
    if (clip && !clip.done && text.replace(/\r/g, '') === clip.text.replace(/\r/g, '')) {
      const dr = sel.r1 - clip.r1, dc = sel.c1 - clip.c1;
      if (clip.cut) for (let r = clip.r1; r <= clip.r2; r++) for (let c = clip.c1; c <= clip.c2; c++) changes.push(change(r, c, () => null, clip.sheet));
      clip.cells.forEach((row, i) => row.forEach((cell, j) => {
        const r = sel.r1 + i, c = sel.c1 + j;
        const idx = changes.findIndex(x => x.sheet === sh && x.k === ck(r, c));
        const x = cell ? cloneCell(cell) : null;
        if (x && x.f != null && !clip.cut) x.f = shiftFormula(x.f, dr, dc);
        const ch = change(r, c, () => x);
        if (idx >= 0) changes[idx].after = ch.after; else changes.push(ch);
      }));
      if (clip.cut) clip.done = true;
    } else {
      const rows = parseCSV(text.replace(/\r\n$/, '').replace(/\n$/, ''), Infinity, '\t');
      rows.forEach((row, i) => row.forEach((v, j) => changes.push(change(sel.r1 + i, sel.c1 + j, base => (v === '' ? (base.fmt || base.b ? Object.assign(base, { v: null, f: undefined }) : null) : inputToCell(v, base))))));
    }
    commitChanges(changes, 'Paste');
  }
  /* ---------- mouse ---------- */
  let drag = null, fillDrag = null;
  function hit(e) {
    const g = grid.getBoundingClientRect();
    const x = e.clientX - g.left - L_HW, y = e.clientY - g.top - L_HH;
    const cx = x < FW ? x : x + br.scrollLeft, cy = y < FH ? y : y + br.scrollTop;
    return { r: findRow(Math.max(0, cy)), c: findCol(Math.max(0, cx)), x, y };
  }
  function insertRefText(t) {
    const p = editor.selectionStart;
    editor.setRangeText(t, p, editor.selectionEnd, 'end');
    fxInput.value = editor.value;
    placeEditor(); paint();
  }
  ctx.on(grid, 'pointerdown', e => {
    if (e.button !== 0) return;
    const t = e.target;
    if (t === editor || t.closest('.lg-ac')) return;
    if (t.dataset && t.dataset.fh) { e.preventDefault(); fillDrag = { r1: sel.r1, c1: sel.c1, r2: sel.r2, c2: sel.c2, src: Object.assign({}, sel) }; grid.setPointerCapture(e.pointerId); return; }
    const hd = t.closest('.hd');
    if (hd) {
      e.preventDefault();
      const g = hd.getBoundingClientRect();
      if (hd.dataset.c != null) {
        const c = +hd.dataset.c;
        if (e.clientX > g.right - 5 || (e.clientX < g.left + 4 && c > 0)) { const cc = e.clientX > g.right - 5 ? c : c - 1; drag = { kind: 'cw', c: cc, x0: e.clientX, w0: colW(cc) }; grid.setPointerCapture(e.pointerId); return; }
        if (editing) endEdit(true);
        if (e.shiftKey) setSel(0, anchor.c, XL_ROWS - 1, c, 0, anchor.c); else { anchor = { r: 0, c }; setSel(0, c, XL_ROWS - 1, c, sh.freeze.r, c); }
        drag = { kind: 'cols', c0: anchor.c }; grid.setPointerCapture(e.pointerId);
      } else {
        const r = +hd.dataset.r;
        if (e.clientY > g.bottom - 4 || (e.clientY < g.top + 3 && r > 0)) { const rr = e.clientY > g.bottom - 4 ? r : r - 1; drag = { kind: 'rh', r: rr, y0: e.clientY, h0: rowH(rr) }; grid.setPointerCapture(e.pointerId); return; }
        if (editing) endEdit(true);
        if (e.shiftKey) setSel(anchor.r, 0, r, XL_COLS - 1, anchor.r, 0); else { anchor = { r, c: 0 }; setSel(r, 0, r, XL_COLS - 1, r, sh.freeze.c); }
        drag = { kind: 'rows', r0: anchor.r }; grid.setPointerCapture(e.pointerId);
      }
      return;
    }
    if (t === corner) { if (editing) endEdit(true); anchor = { r: 0, c: 0 }; setSel(0, 0, XL_ROWS - 1, XL_COLS - 1, 0, 0); return; }
    const p = hit(e);
    if (p.x < 0 || p.y < 0) return;
    if (editing && editing.bar) { editor.value = fxInput.value; editing.bar = false; editing.input = editor; if (!endEdit(true)) return; }
    if (editing && wantsRef()) { e.preventDefault(); editing.refStart = editor.selectionStart; editing.refAnchor = p; insertRefText(a1(p.r, p.c)); drag = { kind: 'ref', a: p }; grid.setPointerCapture(e.pointerId); return; }
    if (editing && !endEdit(true)) return;
    e.preventDefault();
    select(p.r, p.c, e.shiftKey);
    drag = { kind: 'cells' };
    grid.setPointerCapture(e.pointerId);
    focusTa.focus({ preventScroll: true });
  });
  ctx.on(grid, 'pointermove', e => {
    const g = grid.getBoundingClientRect();
    if (!drag && !fillDrag) {
      const t = e.target.closest && e.target.closest('.hd');
      if (t) { const r = t.getBoundingClientRect(); grid.style.cursor = t.dataset.c != null ? (e.clientX > r.right - 5 || (e.clientX < r.left + 4 && +t.dataset.c > 0) ? 'col-resize' : 's-resize') : (e.clientY > r.bottom - 4 || (e.clientY < r.top + 3 && +t.dataset.r > 0) ? 'row-resize' : 'e-resize'); }
      else grid.style.cursor = e.target.dataset && e.target.dataset.fh ? 'crosshair' : 'cell';
      return;
    }
    // auto-scroll at the edges
    if (e.clientY > g.bottom - 8) br.scrollTop += 20; else if (e.clientY < g.top + L_HH + FH + 4 && br.scrollTop > 0 && drag && drag.kind !== 'cw') br.scrollTop -= 20;
    if (e.clientX > g.right - 8) br.scrollLeft += 20; else if (e.clientX < g.left + L_HW + FW + 4 && br.scrollLeft > 0 && drag && drag.kind !== 'rh') br.scrollLeft -= 20;
    const p = hit(e);
    if (fillDrag) {
      const s = fillDrag.src;
      const down = p.r - s.r2, right = p.c - s.c2, up = s.r1 - p.r, left = s.c1 - p.c;
      const best = Math.max(down, right, up, left);
      fillDrag = Object.assign(fillDrag, { r1: s.r1, c1: s.c1, r2: s.r2, c2: s.c2, dir: null });
      if (best > 0) { if (best === down) { fillDrag.r2 = p.r; fillDrag.dir = 'down'; } else if (best === right) { fillDrag.c2 = p.c; fillDrag.dir = 'right'; } else if (best === up) { fillDrag.r1 = Math.max(0, p.r); fillDrag.dir = 'up'; } else { fillDrag.c1 = Math.max(0, p.c); fillDrag.dir = 'left'; } }
      paint();
      return;
    }
    if (drag.kind === 'cells') { if (p.r !== focusPt.r || p.c !== focusPt.c) { focusPt = { r: p.r, c: p.c }; setSel(anchor.r, anchor.c, p.r, p.c, anchor.r, anchor.c); } }
    else if (drag.kind === 'cols') setSel(0, drag.c0, XL_ROWS - 1, p.c, 0, drag.c0);
    else if (drag.kind === 'rows') setSel(drag.r0, 0, p.r, XL_COLS - 1, drag.r0, 0);
    else if (drag.kind === 'cw') { sh.colW.set(drag.c, Math.max(0, Math.round(drag.w0 + e.clientX - drag.x0))); layout(); paint(); }
    else if (drag.kind === 'rh') { sh.rowH.set(drag.r, Math.max(0, Math.round(drag.h0 + e.clientY - drag.y0))); layout(); paint(); }
    else if (drag.kind === 'ref') {
      const a = drag.a, txt = a.r === p.r && a.c === p.c ? a1(a.r, a.c) : a1(Math.min(a.r, p.r), Math.min(a.c, p.c)) + ':' + a1(Math.max(a.r, p.r), Math.max(a.c, p.c));
      const s0 = editing.refStart;
      editor.setRangeText(txt, s0, editor.selectionStart, 'end');
      fxInput.value = editor.value; paint();
    }
  });
  ctx.on(grid, 'pointerup', e => {
    if (fillDrag) {
      const fd = fillDrag;
      fillDrag = null;
      if (fd.dir) doFill(fd.src, fd);
      else paint();
    }
    if (drag && (drag.kind === 'cw' || drag.kind === 'rh')) changed();
    if (drag && drag.kind === 'ref') editor.focus();
    drag = null;
    try { grid.releasePointerCapture(e.pointerId); } catch (er) { /* fine */ }
  });
  ctx.on(grid, 'dblclick', e => {
    const hd = e.target.closest('.hd');
    if (hd && hd.dataset.c != null) { const r = hd.getBoundingClientRect(); const c = e.clientX > r.right - 5 ? +hd.dataset.c : e.clientX < r.left + 4 ? +hd.dataset.c - 1 : -1; if (c >= 0) autofit([c]); return; }
    if (hd) return;
    const p = hit(e);
    if (p.x < 0 || p.y < 0) return;
    startEdit(null, 'edit');
  });
  ctx.on(grid, 'contextmenu', e => {
    e.preventDefault();
    const p = hit(e);
    if (p.x >= 0 && p.y >= 0 && !(p.r >= sel.r1 && p.r <= sel.r2 && p.c >= sel.c1 && p.c <= sel.c2)) select(p.r, p.c);
    appPopup(ctx, e.clientX, e.clientY, [
      { label: 'Cut', act: () => { focusTa.focus(); doc.execCommand('cut'); } },
      { label: 'Copy', act: () => { focusTa.focus(); doc.execCommand('copy'); } },
      { label: 'Paste', act: pasteMenu },
      { sep: 1 },
      { label: 'Insert Rows', act: () => insertDelete('r', +1) }, { label: 'Insert Columns', act: () => insertDelete('c', +1) },
      { label: 'Delete Rows', act: () => insertDelete('r', -1) }, { label: 'Delete Columns', act: () => insertDelete('c', -1) },
      { label: 'Clear Contents', act: () => clearSel('contents') },
      { sep: 1 },
      { label: 'Format Cells...', act: formatDialog }
    ]);
  });
  ctx.on(grid, 'wheel', e => { if (br.contains(e.target)) return; e.preventDefault(); br.scrollTop += e.deltaY; br.scrollLeft += e.deltaX; }, { passive: false });
  ctx.on(br, 'scroll', () => {
    if (br.scrollTop + br.clientHeight > rowPos[nR] - FH - 200 && nR < XL_ROWS) { nR = Math.min(XL_ROWS, nR + 200); layout(); }
    if (br.scrollLeft + br.clientWidth > colPos[nC] - FW - 200 && nC < XL_COLS) { nC = Math.min(XL_COLS, nC + 10); const keep = nR; layout(); nR = keep; }
    sh.scroll = { x: br.scrollLeft, y: br.scrollTop };
    paintNow();
  }, { passive: true });
  ctx.on(win, 'resize', paint);
  async function pasteMenu() {
    focusTa.focus();
    try { pasteText(await navigator.clipboard.readText()); } catch (e) { ctx.status('Press Ctrl+V to paste (the browser keeps the clipboard private from menus).'); }
  }
  /* ---------- commands ---------- */
  function doFill(src, fd) {
    const changes = [];
    const vertical = fd.dir === 'down' || fd.dir === 'up';
    if (vertical) {
      for (let c = src.c1; c <= src.c2; c++) {
        const cells = []; for (let r = src.r1; r <= src.r2; r++) cells.push(cellAt(r, c));
        const n = fd.dir === 'down' ? fd.r2 - src.r2 : src.r1 - fd.r1;
        const order = fd.dir === 'down' ? cells : cells.slice().reverse();
        fillSeries(order, n).forEach((x, i) => {
          const r = fd.dir === 'down' ? src.r2 + 1 + i : src.r1 - 1 - i;
          const from = fd.dir === 'down' ? src.r1 + (i % cells.length) : src.r2 - (i % cells.length);
          if (x && x.f != null) x.f = shiftFormula(x.f, r - from, 0);
          changes.push(change(r, c, () => (x && Object.keys(x).length ? x : null)));
        });
      }
    } else {
      for (let r = src.r1; r <= src.r2; r++) {
        const cells = []; for (let c = src.c1; c <= src.c2; c++) cells.push(cellAt(r, c));
        const n = fd.dir === 'right' ? fd.c2 - src.c2 : src.c1 - fd.c1;
        const order = fd.dir === 'right' ? cells : cells.slice().reverse();
        fillSeries(order, n).forEach((x, i) => {
          const c = fd.dir === 'right' ? src.c2 + 1 + i : src.c1 - 1 - i;
          const from = fd.dir === 'right' ? src.c1 + (i % cells.length) : src.c2 - (i % cells.length);
          if (x && x.f != null) x.f = shiftFormula(x.f, 0, c - from);
          changes.push(change(r, c, () => (x && Object.keys(x).length ? x : null)));
        });
      }
    }
    commitChanges(changes, 'Fill');
    setSel(fd.r1, fd.c1, fd.r2, fd.c2, sel.ar, sel.ac);
  }
  function fillDir(dir) {
    if (dir === 'down' && sel.r2 > sel.r1) doFill({ r1: sel.r1, c1: sel.c1, r2: sel.r1, c2: sel.c2 }, { dir: 'down', r1: sel.r1, c1: sel.c1, r2: sel.r2, c2: sel.c2, plain: true });
    else if (dir === 'right' && sel.c2 > sel.c1) doFill({ r1: sel.r1, c1: sel.c1, r2: sel.r2, c2: sel.c1 }, { dir: 'right', r1: sel.r1, c1: sel.c1, r2: sel.r2, c2: sel.c2, plain: true });
  }
  function autoSum() {
    const numAt = (r, c) => { const x = cellAt(r, c); return x && typeof x.v === 'number' && x.f == null || (x && x.f != null && typeof x.v === 'number'); };
    if (sel.r1 === sel.r2 && sel.c1 === sel.c2) {
      const r = sel.ar, c = sel.ac;
      let r0 = r - 1; while (r0 >= 0 && numAt(r0, c)) r0--;
      let c0 = c - 1; while (c0 >= 0 && numAt(r, c0)) c0--;
      const rng = r0 < r - 1 ? a1(r0 + 1, c) + ':' + a1(r - 1, c) : c0 < c - 1 ? a1(r, c0 + 1) + ':' + a1(r, c - 1) : '';
      startEdit('=SUM(' + rng + ')', 'edit');
      if (!rng) editor.setSelectionRange(5, 5);
      return;
    }
    const changes = [];
    for (let c = sel.c1; c <= sel.c2; c++) changes.push(change(sel.r2 + 1, c, x => { delete x.v; x.f = 'SUM(' + a1(sel.r1, c) + ':' + a1(sel.r2, c) + ')'; return x; }));
    commitChanges(changes, 'AutoSum');
  }
  function insertDelete(axis, sign) {
    const at = axis === 'r' ? sel.r1 : sel.c1, n = axis === 'r' ? sel.r2 - sel.r1 + 1 : sel.c2 - sel.c1 + 1;
    if ((axis === 'r' ? n : n) > 5000) { ctx.status('Select fewer rows or columns.'); return; }
    const count = sign * n;
    structural(sign > 0 ? 'Insert' : 'Delete', () => {
      const moved = new Map();
      for (const [k, cell] of sh.cells) {
        let r = ckR(k), c = ckC(k);
        const idx = axis === 'r' ? r : c;
        if (count < 0 && idx >= at && idx < at - count) continue;
        if (idx >= at) { if (axis === 'r') r += count; else c += count; }
        if (r < 0 || c < 0 || r >= XL_ROWS || c >= XL_COLS) continue;
        moved.set(ck(r, c), cell);
      }
      sh.cells = moved;
      const sizes = axis === 'r' ? sh.rowH : sh.colW, ns = new Map();
      for (const [i, v] of sizes) { if (count < 0 && i >= at && i < at - count) continue; ns.set(i >= at ? i + count : i, v); }
      if (axis === 'r') sh.rowH = ns; else sh.colW = ns;
      sh.merges = sh.merges.map(m => { const a = axis === 'r' ? 'r1' : 'c1', b = axis === 'r' ? 'r2' : 'c2'; const x = Object.assign({}, m); if (x[a] >= at) x[a] = Math.max(at, x[a] + count); if (x[b] >= at) x[b] = x[b] + count; return x[b] >= x[a] ? x : null; }).filter(Boolean);
      for (const s of wb.sheets) for (const cell of s.cells.values()) if (cell.f != null) { const nf = adjustFormula(cell.f, s.name, sh.name, axis, at, count); if (nf !== cell.f) { cell.f = nf; delete cell.ast; } }
    });
  }
  function regionAround(r, c) {
    const filled = (rr, cc) => { const x = cellAt(rr, cc); return !!(x && (x.v != null || x.f != null)); };
    let r1 = r, r2 = r, c1 = c, c2 = c, grew = true;
    while (grew) {
      grew = false;
      if (r1 > 0) for (let cc = c1; cc <= c2; cc++) if (filled(r1 - 1, cc)) { r1--; grew = true; break; }
      for (let cc = c1; cc <= c2; cc++) if (filled(r2 + 1, cc)) { r2++; grew = true; break; }
      if (c1 > 0) for (let rr = r1; rr <= r2; rr++) if (filled(rr, c1 - 1)) { c1--; grew = true; break; }
      for (let rr = r1; rr <= r2; rr++) if (filled(rr, c2 + 1)) { c2++; grew = true; break; }
    }
    // a title row over a wider table isn't part of the data
    const count = rr => { let n = 0; for (let cc = c1; cc <= c2; cc++) if (filled(rr, cc)) n++; return n; };
    while (r1 < r2 && c2 > c1 && count(r1) === 1 && count(r1 + 1) >= 2) r1++;
    return { r1, c1, r2, c2 };
  }
  function sortSel(desc) {
    let R = sel.r1 === sel.r2 ? regionAround(sel.ar, sel.ac) : { r1: sel.r1, c1: sel.c1, r2: Math.min(sel.r2, sheetBounds(sh).maxR), c2: Math.min(sel.c2, sheetBounds(sh).maxC) };
    const key = sel.ac;
    const first = cellAt(R.r1, key), second = cellAt(R.r1 + 1, key);
    let header = !!(first && ((typeof first.v === 'string' && second && typeof second.v !== 'string') || first.b));
    if (!header) { let strs = 0, n = 0; for (let c = R.c1; c <= R.c2; c++) { const x = cellAt(R.r1, c); if (x && x.v != null) { n++; if (typeof x.v === 'string' && x.f == null) strs++; } } header = n > 1 && strs === n && !!second && typeof second.v === 'number'; }
    const r0 = header ? R.r1 + 1 : R.r1;
    if (R.r2 <= r0) return;
    const rows = [];
    for (let r = r0; r <= R.r2; r++) { const row = []; for (let c = R.c1; c <= R.c2; c++) row.push(cloneCell(cellAt(r, c))); rows.push({ r, row, v: (cellAt(r, key) || {}).v }); }
    rows.sort((a, b) => { if (a.v == null) return 1; if (b.v == null) return -1; const x = compare(a.v, b.v); return desc ? -x : x; });
    const changes = [];
    rows.forEach((o, i) => o.row.forEach((cell, j) => { const r = r0 + i, c = R.c1 + j; if (cell && cell.f != null) cell.f = shiftFormula(cell.f, r - o.r, 0); changes.push(change(r, c, () => cell)); }));
    commitChanges(changes, 'Sort');
    ctx.status('Sorted ' + rows.length + ' rows by column ' + colName(key) + (header ? ' (kept the header row)' : '') + '.');
  }
  function autofit(cols) {
    const cv = doc.createElement('canvas').getContext('2d');
    cv.font = '13px Arial';
    const b = sheetBounds(sh);
    for (const c of cols) {
      let w = 24;
      for (let r = 0; r <= Math.min(b.maxR, 5000); r++) { const cell = cellAt(r, c); if (!cell || cell.v == null) continue; cv.font = (cell.b ? 'bold ' : '') + '13px Arial'; w = Math.max(w, cv.measureText(formatValue(cell.v, cell.fmt).text).width + 10); }
      sh.colW.set(c, Math.min(500, Math.ceil(w)));
    }
    layout(); paint(); changed();
  }
  function adjustDecimals(delta) {
    formatSel(cell => {
      let f = cell.fmt && !/^general$/i.test(cell.fmt) ? cell.fmt : (typeof cell.v === 'number' ? (Number.isInteger(cell.v) ? '0' : '0.' + '0'.repeat(Math.min(10, (String(cell.v).split('.')[1] || '').length))) : '0');
      f = splitSections(f).map(sec => { if (isDateFmt(sec)) return sec; const m = /0(\.0+)?(?![^"]*")/.exec(sec); if (!m) return sec; const dec = m[1] ? m[1].length - 1 : 0; const nd = clamp(dec + delta, 0, 10); return sec.slice(0, m.index) + '0' + (nd ? '.' + '0'.repeat(nd) : '') + sec.slice(m.index + m[0].length); }).join(';');
      cell.fmt = f;
    }, 'Decimals');
  }
  function switchSheet(i) {
    if (!wb.sheets[i]) return;
    if (editing) endEdit(true);
    sh.scroll = { x: br.scrollLeft, y: br.scrollTop };
    sh = wb.sheets[i]; wb.active = i;
    if (!sh.sel) sh.sel = { r1: 0, c1: 0, r2: 0, c2: 0, ar: 0, ac: 0 };
    sel = sh.sel; anchor = { r: sel.ar, c: sel.ac }; focusPt = { r: sel.ar, c: sel.ac };
    nR = 100;
    layout();
    br.scrollLeft = sh.scroll.x || 0; br.scrollTop = sh.scroll.y || 0;
    paintTabs(); paint(); syncBar();
    focusTa.focus({ preventScroll: true });
  }
  function paintTabs() {
    tabsBox.innerHTML = '';
    wb.sheets.forEach((s, i) => {
      if (s.hidden) return;
      const t = h('button', { class: 'lg-tab' + (s === sh ? ' on' : ''), type: 'button', text: s.name, title: s.name });
      t.addEventListener('mousedown', e => e.preventDefault());
      t.addEventListener('click', () => switchSheet(i));
      t.addEventListener('dblclick', () => renameSheet(i));
      t.addEventListener('contextmenu', e => { e.preventDefault(); appPopup(ctx, e.clientX, e.clientY - 120, [{ label: 'Insert Sheet', act: addSheet }, { label: 'Rename...', act: () => renameSheet(i) }, { label: 'Delete', act: () => deleteSheet(i), disabled: () => wb.sheets.length < 2 }, { sep: 1 }, { label: 'Move Left', act: () => moveSheet(i, -1), disabled: () => i === 0 }, { label: 'Move Right', act: () => moveSheet(i, 1), disabled: () => i === wb.sheets.length - 1 }]); });
      tabsBox.append(t);
    });
    tabsBox.append(h('button', { class: 'lg-tab add', type: 'button', text: '+', title: 'Insert Sheet', onclick: addSheet }));
  }
  function addSheet() {
    let n = wb.sheets.length + 1;
    while (wb.sheets.some(s => s.name.toLowerCase() === ('sheet' + n))) n++;
    structural('Insert Sheet', () => { wb.sheets.push(newSheet('Sheet' + n)); });
    switchSheet(wb.sheets.length - 1);
  }
  async function renameSheet(i) {
    const old = wb.sheets[i].name;
    const v = await ctx.ask('Rename Sheet', 'Name:', old);
    const nm = (v || '').trim().replace(/[\\/?*[\]:]/g, '').slice(0, 31);
    if (!nm || nm === old) return;
    if (wb.sheets.some((s, j) => j !== i && s.name.toLowerCase() === nm.toLowerCase())) { ctx.msg('warn', 'Ledger', '<p>That name is already taken by another sheet.</p>'); return; }
    structural('Rename Sheet', () => { wb.sheets[i].name = nm; for (const s of wb.sheets) for (const cell of s.cells.values()) if (cell.f != null && cell.f.includes(old)) { cell.f = renameSheetRefs(cell.f, old, nm); delete cell.ast; } });
    paintTabs(); syncBar();
  }
  async function deleteSheet(i) {
    if (wb.sheets.length < 2) return;
    const v = await ctx.msg('warn', 'Delete Sheet', '<p>Delete the sheet <b>' + esc(wb.sheets[i].name) + '</b>? Formulas that point to it will show #REF!.</p>', ['Delete', 'Cancel']);
    if (v !== 'Delete') return;
    const gone = wb.sheets[i].name;
    structural('Delete Sheet', () => { wb.sheets.splice(i, 1); for (const s of wb.sheets) for (const cell of s.cells.values()) if (cell.f != null) { const nf = rewriteRefs(cell.f, t => (t.sheet && t.sheet.toLowerCase() === gone.toLowerCase() ? Object.assign(t, { bad: true }) : null)); if (nf !== cell.f) { cell.f = nf; delete cell.ast; } } });
    switchSheet(Math.max(0, i - 1));
  }
  function moveSheet(i, d) { const j = i + d; if (j < 0 || j >= wb.sheets.length) return; const [s] = wb.sheets.splice(i, 1); wb.sheets.splice(j, 0, s); changed(); switchSheet(j); }
  function freeze(kind) {
    if (kind === 'none') sh.freeze = { r: 0, c: 0 };
    else if (kind === 'top') sh.freeze = { r: 1, c: 0 };
    else if (kind === 'first') sh.freeze = { r: 0, c: 1 };
    else sh.freeze = { r: sel.ar, c: sel.ac };
    br.scrollTop = 0; br.scrollLeft = 0;
    layout(); paint(); changed();
  }
  const F = { q: '', r: '', cs: false, formulas: false };
  function findNext(silent) {
    if (!F.q) return false;
    const q = F.cs ? F.q : F.q.toLowerCase();
    const keys = Array.from(sh.cells.keys()).sort((a, b) => a - b);
    const cur = ck(sel.ar, sel.ac);
    const order = keys.filter(k => k > cur).concat(keys.filter(k => k <= cur));
    for (const k of order) {
      const cell = sh.cells.get(k);
      const text = F.formulas && cell.f != null ? '=' + cell.f : formatValue(cell.v, cell.fmt).text;
      if ((F.cs ? text : text.toLowerCase()).includes(q)) { select(ckR(k), ckC(k)); return true; }
    }
    if (!silent) ctx.msg('info', 'Ledger', '<p>Ledger cannot find the data you\'re searching for.</p>');
    return false;
  }
  function findDialog(replace) {
    const body = el('div', { html: '<div class="frow"><label for="lfF" style="min-width:90px">Find what:</label><input class="field" id="lfF" style="flex:1;min-width:180px"></div>' + (replace ? '<div class="frow"><label for="lfR" style="min-width:90px">Replace with:</label><input class="field" id="lfR" style="flex:1;min-width:180px"></div>' : '') + '<div class="frow"><label class="check"><input type="checkbox" id="lfC"> Match case</label>' + (replace ? '' : '<label class="check"><input type="checkbox" id="lfX"> Look in formulas</label>') + '</div>' });
    const f = $('#lfF', body);
    f.value = F.q;
    const sync = () => { F.q = f.value; F.cs = $('#lfC', body).checked; F.formulas = !replace && $('#lfX', body).checked; if (replace) F.r = $('#lfR', body).value; };
    const buttons = [{ label: 'Find Next', primary: true, onClick: () => { sync(); findNext(); return false; } }];
    if (replace) buttons.push({ label: 'Replace All', onClick: () => {
      sync(); if (!F.q) return false;
      const re = new RegExp(F.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), F.cs ? 'g' : 'gi');
      const changes = [];
      for (const [k, cell] of sh.cells) { if (cell.f != null || typeof cell.v !== 'string' || !re.test(cell.v)) continue; re.lastIndex = 0; changes.push(change(ckR(k), ckC(k), x => { x.v = x.v.replace(re, () => F.r); return x; })); }
      commitChanges(changes, 'Replace');
      ctx.msg('info', 'Ledger', '<p>Ledger made ' + changes.length + ' replacement' + (changes.length === 1 ? '' : 's') + '.</p>');
      return false;
    } });
    buttons.push({ label: 'Close' });
    openWin({ title: replace ? 'Replace' : 'Find', body, modal: false, width: 'min(440px, 94vw)', buttons });
    f.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sync(); findNext(); } });
  }
  async function formatDialog() {
    const cell = cellAt(sel.ar, sel.ac) || {};
    const sample = typeof cell.v === 'number' ? cell.v : 1234.5678;
    const body = el('div', { style: { width: 'min(460px, 86vw)' } });
    const opts = LEDGER_FMTS.map(([l, f], i) => '<option value="' + i + '">' + esc(l) + '</option>').join('');
    body.innerHTML = '<fieldset><legend>Number</legend><div class="frow"><label for="lfmt" style="min-width:70px">Category:</label><select class="field" id="lfmt" style="flex:1">' + opts + '<option value="custom">Custom...</option></select></div><div class="frow"><label for="lcus" style="min-width:70px">Format:</label><input class="field mono" id="lcus" style="flex:1"></div><div class="frow"><span style="min-width:70px">Sample:</span><b id="lsam" class="mono"></b></div></fieldset>' +
      '<fieldset><legend>Alignment &amp; Font</legend><div class="frow"><label for="lal" style="min-width:70px">Horizontal:</label><select class="field" id="lal"><option value="">General</option><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select><label class="check"><input type="checkbox" id="lwr"> Wrap text</label></div><div class="frow"><label class="check"><input type="checkbox" id="lb"> Bold</label><label class="check"><input type="checkbox" id="li"> Italic</label><label class="check"><input type="checkbox" id="lu"> Underline</label><label class="check"><input type="checkbox" id="ls"> Strikethrough</label><label class="check"><input type="checkbox" id="lbd"> Border</label></div>' +
      '<div class="frow"><label for="lfg" style="min-width:70px">Text color:</label><input type="color" id="lfg"><label for="lbg">Fill:</label><input type="color" id="lbg"><label class="check"><input type="checkbox" id="lnobg"> No fill</label></div></fieldset>';
    const fsel = $('#lfmt', body), cus = $('#lcus', body), sam = $('#lsam', body);
    const cur = cell.fmt || 'General';
    const idx = LEDGER_FMTS.findIndex(x => x[1] === cur);
    fsel.value = idx >= 0 ? String(idx) : 'custom';
    cus.value = cur;
    const show = () => { const t = formatValue(sample, cus.value); sam.textContent = t.text; sam.style.color = t.color || ''; };
    fsel.addEventListener('change', () => { if (fsel.value !== 'custom') cus.value = LEDGER_FMTS[+fsel.value][1]; show(); });
    cus.addEventListener('input', () => { fsel.value = 'custom'; show(); });
    show();
    $('#lal', body).value = cell.al || '';
    $('#lwr', body).checked = !!cell.wrap;
    for (const k of ['b', 'i', 'u', 's', 'bd']) $('#l' + k, body).checked = !!cell[k];
    $('#lfg', body).value = cell.fg || '#000000';
    $('#lbg', body).value = cell.bg || '#ffffff';
    $('#lnobg', body).checked = !cell.bg;
    const v = await openWin({ title: 'Format Cells', body, width: 'auto', buttons: [{ label: 'OK', primary: true, value: 'ok' }, { label: 'Cancel', value: null }] }).result;
    if (v !== 'ok') return;
    const fmt = cus.value.trim() || 'General', al = $('#lal', body).value, wrap = $('#lwr', body).checked;
    const flags = {}; for (const k of ['b', 'i', 'u', 's', 'bd']) flags[k] = $('#l' + k, body).checked;
    const fg = $('#lfg', body).value, bg = $('#lnobg', body).checked ? null : $('#lbg', body).value;
    formatSel(x => {
      if (/^general$/i.test(fmt)) delete x.fmt; else x.fmt = fmt;
      if (al) x.al = al; else delete x.al;
      if (wrap) x.wrap = true; else delete x.wrap;
      for (const k in flags) { if (flags[k]) x[k] = true; else delete x[k]; }
      if (fg && fg !== '#000000') x.fg = fg; else delete x.fg;
      if (bg && bg !== '#ffffff') x.bg = bg; else delete x.bg;
    }, 'Format Cells');
  }
  async function sizeDialog(kind) {
    const isCol = kind === 'col';
    const cur = isCol ? colW(sel.ac) : rowH(sel.ar);
    const v = await ctx.ask(isCol ? 'Column Width' : 'Row Height', isCol ? 'Column width (characters):' : 'Row height (points):', isCol ? ((cur - 5) / 7).toFixed(2) : (cur * 72 / 96).toFixed(2));
    const n = parseFloat(v);
    if (!(n >= 0)) return;
    if (isCol) for (let c = sel.c1; c <= Math.min(sel.c2, sel.c1 + 500); c++) sh.colW.set(c, Math.round(n * 7 + 5));
    else for (let r = sel.r1; r <= Math.min(sel.r2, sel.r1 + 5000); r++) sh.rowH.set(r, Math.round(n * 96 / 72));
    layout(); paint(); changed();
  }
  async function functionDialog() {
    const body = el('div', { style: { width: 'min(420px,86vw)' } });
    body.innerHTML = '<p class="hint" style="margin-top:0">Pick a function to start a formula in ' + a1(sel.ar, sel.ac) + '.</p><input class="field" id="lfnq" placeholder="Search for a function" style="width:100%;margin-bottom:6px"><select class="field" id="lfns" size="12" style="width:100%"></select>';
    const q = $('#lfnq', body), s = $('#lfns', body);
    const fill = () => { s.innerHTML = FN_NAMES.filter(n => n.includes(q.value.toUpperCase())).map(n => '<option>' + n + '</option>').join(''); s.selectedIndex = 0; };
    q.addEventListener('input', fill); fill();
    const w = openWin({ title: 'Insert Function', body, width: 'auto', buttons: [{ label: 'OK', primary: true, value: 'ok' }, { label: 'Cancel', value: null }] });
    s.addEventListener('dblclick', () => w.close('ok'));
    const v = await w.result;
    if (v !== 'ok' || !s.value) return;
    startEdit('=' + s.value + '(', 'edit');
  }
  function chartDialog() {
    const R = sel.r1 === sel.r2 && sel.c1 === sel.c2 ? regionAround(sel.ar, sel.ac) : { r1: sel.r1, c1: sel.c1, r2: Math.min(sel.r2, sheetBounds(sh).maxR), c2: Math.min(sel.c2, sheetBounds(sh).maxC) };
    const m = [];
    for (let r = R.r1; r <= Math.min(R.r2, R.r1 + 60); r++) { const row = []; for (let c = R.c1; c <= Math.min(R.c2, R.c1 + 8); c++) { const cell = cellAt(r, c); row.push(cell ? cell.v : null); } m.push(row); }
    const body = el('div');
    body.innerHTML = '<div class="frow"><label for="lct">Chart type:</label><select class="field" id="lct"><option value="bar">Column</option><option value="line">Line</option><option value="pie">Pie</option></select><label for="lctt">Title:</label><input class="field" id="lctt" value="' + esc(sh.name) + '" style="flex:1;min-width:120px"></div><div id="lcv"></div><p class="hint">Charting ' + a1(R.r1, R.c1) + ':' + a1(R.r2, R.c2) + '. Charts aren\'t saved into the file; use Save Picture to keep one.</p>';
    const draw = () => { $('#lcv', body).innerHTML = chartSVG(m, $('#lct', body).value, $('#lctt', body).value); };
    $('#lct', body).addEventListener('change', draw); $('#lctt', body).addEventListener('input', draw);
    draw();
    openWin({ title: 'Chart Wizard', body, width: 'min(640px, 96vw)', modal: false, buttons: [{ label: 'Save Picture...', onClick: () => { const svg = $('#lcv svg', body); if (svg) download(slug($('#lctt', body).value || 'chart') + '.svg', new Blob([svg.outerHTML], { type: 'image/svg+xml' })); return false; } }, { label: 'Close', primary: true }] });
  }
  function printSheet() {
    const b = sheetBounds(sh);
    if (b.maxR < 0) { win.print(); return; }
    let t = '<h3>' + esc(name()) + ' — ' + esc(sh.name) + '</h3><table>';
    for (let r = 0; r <= Math.min(b.maxR, 3000); r++) {
      t += '<tr>';
      for (let c = 0; c <= Math.min(b.maxC, 60); c++) {
        const cell = cellAt(r, c);
        if (!cell) { t += '<td></td>'; continue; }
        const fv = formatValue(cell.v, cell.fmt);
        const al = cell.al || (typeof cell.v === 'number' ? 'right' : 'left');
        t += '<td style="text-align:' + al + ';' + (cell.b ? 'font-weight:bold;' : '') + (cell.i ? 'font-style:italic;' : '') + (cell.bg ? 'background:' + cell.bg + ';' : '') + ((fv.color || cell.fg) ? 'color:' + (fv.color || cell.fg) + ';' : '') + '">' + esc(fv.text) + '</td>';
      }
      t += '</tr>';
    }
    printBox.innerHTML = t + '</table>';
    win.print();
  }
  /* ---------- files ---------- */
  async function openFile() {
    const nd = await ctx.open({ title: 'Open', kinds: ['sheet'], label: 'Spreadsheets: .xlsx, .csv, .tsv' });
    if (nd) ctx.go(nd.url);
  }
  const TYPES = [{ ext: 'xlsx', label: 'Excel Workbook (*.xlsx)' }, { ext: 'csv', label: 'CSV (Comma delimited) (*.csv)' }, { ext: 'tsv', label: 'Text (Tab delimited) (*.tsv)' }];
  async function build(ext) {
    if (editing) endEdit(true);
    if (ext === 'xlsx') return xlsxWrite(wb, { title: d ? d.meta.title : '', author: S.prefs.author || '' });
    return sheetToCSV(sh, ext === 'tsv' ? '\t' : ',');
  }
  const lossy = () => wb.sheets.length > 1 || wb.sheets.some(s => Array.from(s.cells.values()).some(c => c.f != null || c.b || c.i || c.bg || c.fg));
  async function save() {
    if (editing) endEdit(true);
    if (d && canWriteBack(d) && /^(xlsx|csv|tsv)$/.test(d.ext)) {
      if (d.ext !== 'xlsx' && lossy()) {
        const v = await ctx.msg('warn', 'LANscape Ledger', '<p><b>' + esc(d.name) + '</b> may contain features that are not compatible with ' + d.ext.toUpperCase() + '. Only the values on <b>' + esc(sh.name) + '</b> are kept; formulas, formatting and other sheets are lost.</p><p>Do you want to keep the workbook in this format?</p>', ['Keep ' + d.ext.toUpperCase(), 'Save as .xlsx...', 'Cancel']);
        if (v === 'Save as .xlsx...') return saveAs('xlsx');
        if (v !== 'Keep ' + d.ext.toUpperCase()) return false;
      }
      ctx.status('Saving ' + d.name + '...');
      const r = await ctx.save(d, await build(d.ext));
      if (r.ok) { dirty = false; retitle(); ctx.status('Saved ' + d.name + '.'); return true; }
      if (r.why === 'denied' || r.why === 'error') { ctx.msg('error', 'Ledger', '<p>Ledger couldn\'t save ' + esc(d.name) + '.</p>'); return false; }
    }
    return saveAs();
  }
  async function saveAs(prefer) {
    const ext = prefer || (d && /^(xlsx|csv|tsv)$/.test(d.ext) ? d.ext : 'xlsx');
    const nd = await ctx.saveAs({ title: 'Save As', name: (d ? d.name.replace(/\.[a-z0-9]+$/i, '') : 'Book1') + '.' + ext, dir: d && canWriteBack(d) ? d.dir : VROOT + '/', types: TYPES.slice().sort((a, b) => (a.ext === ext ? -1 : b.ext === ext ? 1 : 0)), data: build });
    if (!nd) return false;
    dirty = false;
    if (nd === 'download') { retitle(); return true; }
    ctx.go(nd.url, { replace: true, noCheck: true });
    return true;
  }
  /* ---------- menus & toolbar ---------- */
  const menus = appMenubar(ctx, [
    { label: 'File', items: () => [
      { label: 'New', key: 'Ctrl+N', act: () => ctx.go('http://ledger.lanscape.net/') }, { label: 'Open...', key: 'Ctrl+O', act: openFile },
      { label: 'Save', key: 'Ctrl+S', act: save }, { label: 'Save As...', act: () => saveAs() }, { sep: 1 },
      { label: 'Print...', key: 'Ctrl+P', act: printSheet }, { sep: 1 }, { label: 'Exit', act: () => back() }
    ] },
    { label: 'Edit', items: () => [
      { label: 'Undo ' + ((undoStack[undoStack.length - 1] || {}).label || ''), key: 'Ctrl+Z', act: undo, disabled: () => !undoStack.length },
      { label: 'Redo', key: 'Ctrl+Y', act: redo, disabled: () => !redoStack.length }, { sep: 1 },
      { label: 'Cut', key: 'Ctrl+X', act: () => { focusTa.focus(); doc.execCommand('cut'); } },
      { label: 'Copy', key: 'Ctrl+C', act: () => { focusTa.focus(); doc.execCommand('copy'); } },
      { label: 'Paste', key: 'Ctrl+V', act: pasteMenu }, { sep: 1 },
      { label: 'Fill Down', key: 'Ctrl+D', act: () => fillDir('down') }, { label: 'Fill Right', key: 'Ctrl+R', act: () => fillDir('right') },
      { label: 'Clear Contents', key: 'Del', act: () => clearSel('contents') }, { label: 'Clear Formats', act: () => clearSel('formats') }, { label: 'Clear All', act: () => clearSel('all') }, { sep: 1 },
      { label: 'Delete Rows', act: () => insertDelete('r', -1) }, { label: 'Delete Columns', act: () => insertDelete('c', -1) }, { sep: 1 },
      { label: 'Find...', key: 'Ctrl+F', act: () => findDialog(false) }, { label: 'Replace...', key: 'Ctrl+H', act: () => findDialog(true) }
    ] },
    { label: 'View', items: () => [
      { label: 'Freeze Panes at ' + a1(sel.ar, sel.ac), act: () => freeze('here') }, { label: 'Freeze Top Row', act: () => freeze('top') }, { label: 'Freeze First Column', act: () => freeze('first') }, { label: 'Unfreeze Panes', act: () => freeze('none'), disabled: () => !sh.freeze.r && !sh.freeze.c }, { sep: 1 },
      { label: 'Formula Bar', check: () => !fxBar.hidden, act: () => { fxBar.hidden = !fxBar.hidden; paint(); } }, { label: 'Status Bar', check: () => !statusBar.hidden, act: () => { statusBar.hidden = !statusBar.hidden; paint(); } }
    ] },
    { label: 'Insert', items: () => [
      { label: 'Rows', act: () => insertDelete('r', 1) }, { label: 'Columns', act: () => insertDelete('c', 1) }, { label: 'Worksheet', act: addSheet }, { sep: 1 },
      { label: 'Function...', act: functionDialog }, { label: 'AutoSum', key: 'Alt+=', act: autoSum }, { label: 'Chart...', act: chartDialog }, { sep: 1 },
      { label: 'Today\'s Date', key: 'Ctrl+;', act: () => commitChanges([change(sel.ar, sel.ac, x => { delete x.f; x.v = todaySerial(); x.fmt = 'm/d/yyyy'; return x; })], 'Date') }
    ] },
    { label: 'Format', items: () => [
      { label: 'Cells...', key: 'Ctrl+1', act: formatDialog }, { sep: 1 },
      { label: 'Column Width...', act: () => sizeDialog('col') }, { label: 'AutoFit Column', act: () => autofit(Array.from({ length: Math.min(sel.c2, sel.c1 + 100) - sel.c1 + 1 }, (_, i) => sel.c1 + i)) }, { label: 'Row Height...', act: () => sizeDialog('row') }, { sep: 1 },
      { label: 'Merge Cells', act: () => { if (sel.r1 === sel.r2 && sel.c1 === sel.c2) return; structural('Merge', () => { sh.merges = sh.merges.filter(m => m.r2 < sel.r1 || m.r1 > sel.r2 || m.c2 < sel.c1 || m.c1 > sel.c2); sh.merges.push({ r1: sel.r1, c1: sel.c1, r2: sel.r2, c2: sel.c2 }); }); } },
      { label: 'Unmerge Cells', act: () => structural('Unmerge', () => { sh.merges = sh.merges.filter(m => m.r2 < sel.r1 || m.r1 > sel.r2 || m.c2 < sel.c1 || m.c1 > sel.c2); }) }
    ] },
    { label: 'Data', items: () => [{ label: 'Sort Ascending', act: () => sortSel(false) }, { label: 'Sort Descending', act: () => sortSel(true) }, { sep: 1 }, { label: 'Recalculate Now', key: 'F9', act: () => { recalc(wb); paint(); syncBar(); } }] },
    { label: 'Help', items: () => [{ label: 'About Ledger', act: () => ctx.msg('info', 'About LANscape Ledger', '<p><b>LANscape Ledger</b> ' + VERSION + '</p><p>' + FN_NAMES.length + ' worksheet functions. Opens and saves Excel .xlsx and .csv files.</p><p class="hint">Type = to start a formula; click cells to point at them. Drag the little square at the corner of the selection to fill a series.</p>') }] }
  ]);
  const fmtSel = h('select', { class: 'fld', title: 'Number format', 'aria-label': 'Number format', style: { width: '108px' } }, ...LEDGER_FMTS.slice(0, 13).map(([l], i) => h('option', { value: String(i), text: l })));
  fmtSel.addEventListener('change', () => { const f = LEDGER_FMTS[+fmtSel.value][1]; formatSel(x => { if (/^general$/i.test(f)) delete x.fmt; else x.fmt = f; }, 'Number Format'); focusTa.focus(); });
  const tb = h('div', { class: 'tb noprint' },
    tbtn(ctx, I16.new, 'New (Ctrl+N)', () => ctx.go('http://ledger.lanscape.net/')), tbtn(ctx, I16.open, 'Open (Ctrl+O)', openFile), tbtn(ctx, I16.save, 'Save (Ctrl+S)', () => save()), tsep(ctx),
    tbtn(ctx, I16.print, 'Print', printSheet), tsep(ctx),
    tbtn(ctx, I16.cut, 'Cut', () => { focusTa.focus(); doc.execCommand('cut'); }), tbtn(ctx, I16.copy, 'Copy', () => { focusTa.focus(); doc.execCommand('copy'); }), tbtn(ctx, I16.paste, 'Paste', pasteMenu), tsep(ctx),
    tbtn(ctx, I16.undo, 'Undo (Ctrl+Z)', undo), tbtn(ctx, I16.redo, 'Redo (Ctrl+Y)', redo), tsep(ctx),
    tbtn(ctx, I16.sum, 'AutoSum (Alt+=)', autoSum), tbtn(ctx, '<b style="font:italic bold 12px Times New Roman">fx</b>', 'Insert Function', functionDialog), tbtn(ctx, I16.sortAZ, 'Sort Ascending', () => sortSel(false)), tbtn(ctx, I16.sortZA, 'Sort Descending', () => sortSel(true)),
    tbtn(ctx, '<svg viewBox="0 0 16 16"><rect x="2" y="8" width="3" height="6" fill="#000080"/><rect x="6.5" y="4" width="3" height="10" fill="#c00000"/><rect x="11" y="6" width="3" height="8" fill="#008000"/><path d="M1 14.5h14" stroke="#000"/></svg>', 'Chart Wizard', chartDialog), tsep(ctx),
    tbtn(ctx, '<b style="font:bold 13px Times New Roman">B</b>', 'Bold (Ctrl+B)', () => toggleFmt('b', 'Bold')), tbtn(ctx, '<i style="font:italic 13px Times New Roman">I</i>', 'Italic (Ctrl+I)', () => toggleFmt('i', 'Italic')), tbtn(ctx, '<u style="font:13px Times New Roman">U</u>', 'Underline (Ctrl+U)', () => toggleFmt('u', 'Underline')), tsep(ctx),
    tbtn(ctx, I16.left, 'Align Left', () => formatSel(x => { x.al = 'left'; }, 'Align')), tbtn(ctx, I16.center, 'Center', () => formatSel(x => { x.al = 'center'; }, 'Align')), tbtn(ctx, I16.right, 'Align Right', () => formatSel(x => { x.al = 'right'; }, 'Align')),
    tbtn(ctx, '<svg viewBox="0 0 16 16"><rect x="1" y="4" width="14" height="8" fill="#fff" stroke="#000"/><path d="M4 8h8M10 6l2 2-2 2M6 6 4 8l2 2" fill="none" stroke="#000"/></svg>', 'Merge Cells', () => { if (sel.r1 !== sel.r2 || sel.c1 !== sel.c2) structural('Merge', () => { sh.merges.push({ r1: sel.r1, c1: sel.c1, r2: sel.r2, c2: sel.c2 }); }); }), tsep(ctx),
    tbtn(ctx, '<b style="font:bold 12px Arial">$</b>', 'Currency Style', () => formatSel(x => { x.fmt = '$#,##0.00_);($#,##0.00)'; }, 'Currency')), tbtn(ctx, '<b style="font:bold 12px Arial">%</b>', 'Percent Style', () => formatSel(x => { x.fmt = '0%'; }, 'Percent')), tbtn(ctx, '<b style="font:bold 12px Arial">,</b>', 'Comma Style', () => formatSel(x => { x.fmt = '#,##0.00'; }, 'Comma')),
    tbtn(ctx, '<span style="font:9px Arial">.0<br>.00</span>', 'Increase Decimal', () => adjustDecimals(1)), tbtn(ctx, '<span style="font:9px Arial">.00<br>.0</span>', 'Decrease Decimal', () => adjustDecimals(-1)), fmtSel, tsep(ctx),
    tbtn(ctx, I16.fill, 'Fill Color', (e, b) => colorPopup(ctx, b, c => formatSel(x => { x.bg = c; }, 'Fill'), [{ label: 'No Fill', act: () => formatSel(x => { delete x.bg; }, 'Fill') }])),
    tbtn(ctx, I16.font, 'Font Color', (e, b) => colorPopup(ctx, b, c => formatSel(x => { if (c === '#000000') delete x.fg; else x.fg = c; }, 'Font Color'))));
  ctx.root.append(menus.el, tb, fxBar);
  if (d && d.demo) ctx.root.append(h('div', { class: 'wr-note noprint', style: { background: 'var(--tip)', padding: '4px 10px', fontSize: '11px', borderBottom: '1px solid var(--sh)' }, text: 'This is a demo workbook. Use File > Save As to keep your own copy.' }));
  ctx.root.append(grid, tabs, statusBar, printBox);
  ctx.on(fxBtn, 'click', functionDialog);
  ctx.on(win, 'beforeprint', () => { if (!printBox.innerHTML) printSheet(); });
  ctx.on(doc, 'keydown', e => {
    if (e.key === 'F9') { e.preventDefault(); recalc(wb); paint(); return; }
    // shortcuts that work wherever the focus is inside Ledger
    if (e.defaultPrevented || !(e.ctrlKey || e.metaKey) || e.altKey) return;
    const k = e.key.toLowerCase();
    const map = { s: () => save(), o: openFile, n: () => ctx.go('http://ledger.lanscape.net/'), p: printSheet, f: () => findDialog(false), h: () => findDialog(true) };
    if (map[k] && e.target !== editor && e.target !== fxInput) { e.preventDefault(); map[k](); }
  });
  ctx.on(focusTa, 'focus', () => { focusTa.value = ' '; focusTa.select(); });
  layout();
  setSel(sel.r1, sel.c1, sel.r2, sel.c2, sel.ar, sel.ac);
  paintTabs();
  await new Promise(r => win.requestAnimationFrame(r));
  if (sh.scroll) { br.scrollLeft = sh.scroll.x || 0; br.scrollTop = sh.scroll.y || 0; }
  paintNow();
  syncBar();
  retitle();
  focusTa.focus({ preventScroll: true });
  return {
    title: name() + ' - Ledger',
    isDirty: () => dirty, save, docName: name,
    discard() { dirty = false; },
    _wb: wb
  };
}
