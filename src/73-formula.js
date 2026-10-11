/* ===================================================================
   Ledger's formula engine: Excel-style tokenizer, parser, evaluator
   and reference shifting (copy/paste, fill, insert/delete rows)
   =================================================================== */
const REF_RE = /^(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7})(?::(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7}))?(?![A-Za-z0-9_(!.])/;
const COLS_RE = /^(\$?)([A-Za-z]{1,3}):(\$?)([A-Za-z]{1,3})(?![A-Za-z0-9_(!])/;
const ROWS_RE = /^(\$?)(\d{1,7}):(\$?)(\d{1,7})(?![\d.A-Za-z])/;
function refAt(src, i) {
  const s = src.slice(i, i + 40);
  let m = REF_RE.exec(s);
  if (m) {
    const c1 = colIndex(m[2]), r1 = +m[4] - 1;
    if (c1 < XL_COLS && r1 >= 0 && r1 < XL_ROWS) {
      const t = { t: 'ref', c1, r1, ca1: !!m[1], ra1: !!m[3], c2: c1, r2: r1, ca2: !!m[1], ra2: !!m[3], range: !!m[6] };
      if (m[6]) { t.c2 = colIndex(m[6]); t.r2 = +m[8] - 1; t.ca2 = !!m[5]; t.ra2 = !!m[7]; }
      return { tok: t, end: i + m[0].length };
    }
  }
  m = COLS_RE.exec(s);
  if (m) return { tok: { t: 'ref', c1: colIndex(m[2]), c2: colIndex(m[4]), ca1: !!m[1], ca2: !!m[3], r1: 0, r2: XL_ROWS - 1, ra1: true, ra2: true, range: true, cols: true }, end: i + m[0].length };
  m = ROWS_RE.exec(s);
  if (m && +m[2] >= 1 && +m[4] >= 1) return { tok: { t: 'ref', r1: +m[2] - 1, r2: +m[4] - 1, ra1: !!m[1], ra2: !!m[3], c1: 0, c2: XL_COLS - 1, ca1: true, ca2: true, range: true, rows: true }, end: i + m[0].length };
  return null;
}
function ftokenize(src) {
  const toks = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    let m;
    if (ch === '"') {
      let j = i + 1, s = '';
      while (j < n) { if (src[j] === '"') { if (src[j + 1] === '"') { s += '"'; j += 2; continue; } break; } s += src[j++]; }
      toks.push({ t: 'str', v: s, a: i, b: Math.min(n, j + 1) });
      i = j + 1;
      continue;
    }
    if (ch === '#' && (m = /^#(DIV\/0!|VALUE!|REF!|NAME\?|N\/A|NUM!|NULL!|CIRC!)/i.exec(src.slice(i, i + 9)))) { toks.push({ t: 'err', v: m[0].toUpperCase(), a: i, b: i + m[0].length }); i += m[0].length; continue; }
    if (ch === "'" && (m = /^'((?:[^']|'')+)'!/.exec(src.slice(i)))) {
      const r = refAt(src, i + m[0].length);
      if (r) { toks.push(Object.assign(r.tok, { sheet: m[1].replace(/''/g, "'"), a: i, b: r.end })); i = r.end; continue; }
      if (/^#REF!/i.test(src.slice(i + m[0].length))) { toks.push({ t: 'err', v: '#REF!', a: i, b: i + m[0].length + 5 }); i += m[0].length + 5; continue; }
    }
    if ((m = /^([A-Za-z_À-￿][\w.À-￿]*)!/.exec(src.slice(i)))) {
      const r = refAt(src, i + m[0].length);
      if (r) { toks.push(Object.assign(r.tok, { sheet: m[1], a: i, b: r.end })); i = r.end; continue; }
      if (/^#REF!/i.test(src.slice(i + m[0].length))) { toks.push({ t: 'err', v: '#REF!', a: i, b: i + m[0].length + 5 }); i += m[0].length + 5; continue; }
    }
    const r = refAt(src, i);
    if (r) { toks.push(Object.assign(r.tok, { a: i, b: r.end })); i = r.end; continue; }
    if ((m = /^(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?/.exec(src.slice(i)))) { toks.push({ t: 'num', v: parseFloat(m[0]), a: i, b: i + m[0].length }); i += m[0].length; continue; }
    if ((m = /^[A-Za-z_À-￿][\w.À-￿]*/.exec(src.slice(i)))) {
      const w = m[0], j = i + w.length;
      let k = j;
      while (src[k] === ' ') k++;
      if (src[k] === '(') toks.push({ t: 'fn', v: w.toUpperCase(), a: i, b: j });
      else if (/^(TRUE|FALSE)$/i.test(w)) toks.push({ t: 'bool', v: /^TRUE$/i.test(w), a: i, b: j });
      else toks.push({ t: 'name', v: w, a: i, b: j });
      i = j;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (two === '<=' || two === '>=' || two === '<>') { toks.push({ t: 'op', v: two, a: i, b: i + 2 }); i += 2; continue; }
    if ('+-*/^&=<>%'.includes(ch)) { toks.push({ t: 'op', v: ch, a: i, b: i + 1 }); i++; continue; }
    if (ch === '(' || ch === ')' || ch === ':') { toks.push({ t: ch, a: i, b: i + 1 }); i++; continue; }
    if (ch === ',' || ch === ';') { toks.push({ t: ',', a: i, b: i + 1 }); i++; continue; }
    if (ch === '{') { const j = src.indexOf('}', i); const body = src.slice(i + 1, j < 0 ? n : j); toks.push({ t: 'arr', v: body.split(/[;,]/).map(x => { const s = x.trim(); return /^".*"$/.test(s) ? s.slice(1, -1).replace(/""/g, '"') : parseNumberText(s) != null ? parseNumberText(s) : /^(true|false)$/i.test(s) ? /^true$/i.test(s) : s; }), a: i, b: j < 0 ? n : j + 1 }); i = j < 0 ? n : j + 1; continue; }
    toks.push({ t: 'bad', v: ch, a: i, b: i + 1 });
    i++;
  }
  return toks;
}
class FSyntax extends Error { }
function fparse(src) {
  const toks = ftokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const isOp = (...ops) => peek() && peek().t === 'op' && ops.includes(peek().v);
  const fail = msg => { throw new FSyntax(msg || 'There\'s a problem with this formula.'); };
  function primary() {
    const t = toks[p++];
    if (!t) fail('The formula ends too soon.');
    switch (t.t) {
      case 'num': return { k: 'num', v: t.v };
      case 'str': return { k: 'str', v: t.v };
      case 'bool': return { k: 'bool', v: t.v };
      case 'err': return { k: 'err', v: t.v };
      case 'arr': return { k: 'arr', v: t.v };
      case 'ref': return { k: 'ref', sheet: t.sheet || null, r1: Math.min(t.r1, t.r2), c1: Math.min(t.c1, t.c2), r2: Math.max(t.r1, t.r2), c2: Math.max(t.c1, t.c2), range: t.range };
      case 'name': return { k: 'name', v: t.v };
      case '(': { const e = cmp(); if (!peek() || peek().t !== ')') fail('A parenthesis is missing.'); p++; return e; }
      case 'fn': {
        if (!peek() || peek().t !== '(') fail();
        p++;
        const args = [];
        if (peek() && peek().t === ')') { p++; return { k: 'fn', name: t.v, args }; }
        while (true) {
          if (peek() && (peek().t === ',' || peek().t === ')')) args.push({ k: 'blank' });
          else args.push(cmp());
          const s = toks[p++];
          if (!s) fail('A parenthesis is missing.');
          if (s.t === ')') break;
          if (s.t !== ',') fail();
        }
        return { k: 'fn', name: t.v, args };
      }
      default: fail();
    }
    return null;
  }
  function postfix() { let a = primary(); while (isOp('%')) { p++; a = { k: 'pct', a }; } return a; }
  function unary() { if (isOp('-', '+')) { const op = toks[p++].v; const a = unary(); return op === '-' ? { k: 'neg', a } : { k: 'pos', a }; } return postfix(); }
  function power() { let a = unary(); while (isOp('^')) { p++; a = { k: 'bin', op: '^', a, b: unary() }; } return a; }
  function mul() { let a = power(); while (isOp('*', '/')) { const op = toks[p++].v; a = { k: 'bin', op, a, b: power() }; } return a; }
  function add() { let a = mul(); while (isOp('+', '-')) { const op = toks[p++].v; a = { k: 'bin', op, a, b: mul() }; } return a; }
  function cat() { let a = add(); while (isOp('&')) { p++; a = { k: 'bin', op: '&', a, b: add() }; } return a; }
  function cmp() { let a = cat(); while (isOp('=', '<>', '<', '>', '<=', '>=')) { const op = toks[p++].v; a = { k: 'bin', op, a, b: cat() }; } return a; }
  if (!toks.length) fail('The formula is empty.');
  const ast = cmp();
  if (p < toks.length) fail();
  return ast;
}

/* ---------------- evaluation ---------------- */
function sheetByName(wb, name) { const n = String(name).toLowerCase(); return wb.sheets.find(s => s.name.toLowerCase() === n) || null; }
function boundsCached(sh, wb) { if (sh._bp !== wb.pass) { sh._b = sheetBounds(sh); sh._bp = wb.pass; } return sh._b; }
function cellValue(sh, r, c, wb) {
  const cell = sh.cells.get(ck(r, c));
  if (!cell) return null;
  if (cell.f != null) return computeCell(sh, r, c, cell, wb);
  return cell.v;
}
function computeCell(sh, r, c, cell, wb) {
  if (cell.pass === wb.pass) return cell.v;
  if (cell.busy) return ERR.CIRC;
  cell.busy = true;
  let v;
  try {
    if (!cell.ast || cell.astF !== cell.f) { try { cell.ast = fparse(cell.f); cell.bad = false; } catch (e) { cell.ast = { k: 'err', v: '#NAME?' }; cell.bad = true; } cell.astF = cell.f; }
    v = scalar(evalNode(cell.ast, { wb, sh, r, c }), { wb, sh, r, c });
  } catch (e) {
    v = e instanceof FErr ? e : e instanceof RangeError ? ERR.CIRC : ERR.VALUE;
  } finally { cell.busy = false; }
  if (v == null) v = 0;
  if (typeof v === 'number' && !isFinite(v)) v = ERR.NUM;
  cell.v = v;
  cell.pass = wb.pass;
  return v;
}
/** recalculate everything (top-left first, so chains of formulas stay shallow) */
function recalc(wb) {
  wb.pass = (wb.pass || 0) + 1;
  for (const sh of wb.sheets) {
    const keys = [];
    for (const [k, cell] of sh.cells) if (cell.f != null) keys.push(k);
    keys.sort((a, b) => a - b);
    for (const k of keys) computeCell(sh, ckR(k), ckC(k), sh.cells.get(k), wb);
  }
}
const isRange = v => v != null && typeof v === 'object' && v.rg === true;
function mkRange(sh, r1, c1, r2, c2) { return { rg: true, sh, r1, c1, r2, c2 }; }
function* rangeCells(R, wb) {
  const b = boundsCached(R.sh, wb);
  const r2 = Math.min(R.r2, b.maxR), c2 = Math.min(R.c2, b.maxC);
  for (let r = R.r1; r <= r2; r++) for (let c = R.c1; c <= c2; c++) yield cellValue(R.sh, r, c, wb);
}
function rangeMatrix(R, wb) {
  const b = boundsCached(R.sh, wb);
  const r2 = Math.min(R.r2, Math.max(b.maxR, R.r1)), c2 = Math.min(R.c2, Math.max(b.maxC, R.c1));
  const out = [];
  for (let r = R.r1; r <= r2; r++) { const row = []; for (let c = R.c1; c <= c2; c++) row.push(cellValue(R.sh, r, c, wb)); out.push(row); }
  return out;
}
/** a range used where one value is wanted: Excel's implicit intersection */
function scalar(v, E) {
  if (Array.isArray(v)) return v.length ? (Array.isArray(v[0]) ? v[0][0] : v[0]) : null;
  if (!isRange(v)) return v;
  if (v.r1 === v.r2 && v.c1 === v.c2) return cellValue(v.sh, v.r1, v.c1, E.wb);
  if (v.c1 === v.c2 && E.r >= v.r1 && E.r <= v.r2 && v.sh === E.sh) return cellValue(v.sh, E.r, v.c1, E.wb);
  if (v.r1 === v.r2 && E.c >= v.c1 && E.c <= v.c2 && v.sh === E.sh) return cellValue(v.sh, v.r1, E.c, E.wb);
  return ERR.VALUE;
}
function toNum(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (isErr(v)) throw v;
  const n = parseNumberText(v);
  if (n != null) return n;
  const p = parseInput(v);
  if (typeof p.v === 'number') return p.v;
  throw ERR.VALUE;
}
function toText(v) {
  if (v == null) return '';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') return generalNum(v);
  if (isErr(v)) throw v;
  return String(v);
}
function toBool(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (v == null || v === '') return false;
  if (isErr(v)) throw v;
  const u = String(v).toUpperCase();
  if (u === 'TRUE') return true;
  if (u === 'FALSE') return false;
  throw ERR.VALUE;
}
const typeRank = v => (typeof v === 'number' ? 0 : typeof v === 'string' ? 1 : typeof v === 'boolean' ? 2 : 0);
function compare(a, b) {
  if (a == null) a = typeof b === 'string' ? '' : typeof b === 'boolean' ? false : 0;
  if (b == null) b = typeof a === 'string' ? '' : typeof a === 'boolean' ? false : 0;
  const ta = typeRank(a), tb = typeRank(b);
  if (ta !== tb) return ta - tb;
  if (typeof a === 'string') { const x = a.toLowerCase(), y = b.toLowerCase(); return x < y ? -1 : x > y ? 1 : 0; }
  return a < b ? -1 : a > b ? 1 : 0;
}
function evalNode(n, E) {
  switch (n.k) {
    case 'num': case 'str': case 'bool': return n.v;
    case 'blank': return null;
    case 'err': return errOf(n.v);
    case 'arr': return n.v.slice();
    case 'name': return ERR.NAME;
    case 'ref': {
      const sh = n.sheet ? sheetByName(E.wb, n.sheet) : E.sh;
      if (!sh) return ERR.REF;
      if (!n.range && n.r1 === n.r2 && n.c1 === n.c2) return cellValue(sh, n.r1, n.c1, E.wb);
      return mkRange(sh, n.r1, n.c1, n.r2, n.c2);
    }
    case 'neg': { const v = scalar(evalNode(n.a, E), E); if (isErr(v)) return v; return -toNum(v); }
    case 'pos': return scalar(evalNode(n.a, E), E);
    case 'pct': { const v = scalar(evalNode(n.a, E), E); if (isErr(v)) return v; return toNum(v) / 100; }
    case 'bin': {
      const a = scalar(evalNode(n.a, E), E), b = scalar(evalNode(n.b, E), E);
      if (isErr(a)) return a;
      if (isErr(b)) return b;
      switch (n.op) {
        case '+': return toNum(a) + toNum(b);
        case '-': return toNum(a) - toNum(b);
        case '*': return toNum(a) * toNum(b);
        case '/': { const d = toNum(b); if (d === 0) return ERR.DIV0; return toNum(a) / d; }
        case '^': { const r = Math.pow(toNum(a), toNum(b)); return isFinite(r) ? r : ERR.NUM; }
        case '&': return toText(a) + toText(b);
        case '=': return compare(a, b) === 0;
        case '<>': return compare(a, b) !== 0;
        case '<': return compare(a, b) < 0;
        case '>': return compare(a, b) > 0;
        case '<=': return compare(a, b) <= 0;
        case '>=': return compare(a, b) >= 0;
      }
      return ERR.VALUE;
    }
    case 'fn': {
      const f = FN[n.name];
      if (!f) return ERR.NAME;
      try { const v = f(n.args, E); return v === undefined ? null : v; } catch (e) { if (e instanceof FErr) return e; throw e; }
    }
  }
  return ERR.VALUE;
}
/* argument helpers */
const FA = (n, E) => (n ? scalar(evalNode(n, E), E) : null);
const FAN = (n, E, d) => { if (!n || n.k === 'blank') { if (d === undefined) throw ERR.VALUE; return d; } const v = FA(n, E); if (isErr(v)) throw v; return toNum(v); };
const FAT = (n, E, d) => { if (!n || n.k === 'blank') { if (d === undefined) throw ERR.VALUE; return d; } const v = FA(n, E); if (isErr(v)) throw v; return toText(v); };
const FAB = (n, E, d) => { if (!n || n.k === 'blank') { if (d === undefined) throw ERR.VALUE; return d; } const v = FA(n, E); if (isErr(v)) throw v; return toBool(v); };
const FAR = (n, E) => { const v = evalNode(n, E); if (isRange(v) || Array.isArray(v)) return v; if (isErr(v)) throw v; return [v]; };
function flat(v, E) {
  if (isRange(v)) return Array.from(rangeCells(v, E.wb));
  if (Array.isArray(v)) return v.flat();
  return [v];
}
function matrix(v, E) {
  if (isRange(v)) return rangeMatrix(v, E.wb);
  if (Array.isArray(v)) return Array.isArray(v[0]) ? v : [v];
  return [[v]];
}
/** numbers from the arguments the way SUM sees them: text and TRUE in ranges are skipped */
function nums(args, E, opts = {}) {
  const out = [];
  for (const a of args) {
    if (a.k === 'blank') continue;
    const v = evalNode(a, E);
    if (isRange(v) || Array.isArray(v)) {
      for (const x of flat(v, E)) {
        if (typeof x === 'number') out.push(x);
        else if (isErr(x)) throw x;
        else if (opts.all && typeof x === 'boolean') out.push(x ? 1 : 0);
        else if (opts.all && typeof x === 'string') out.push(0);
      }
    } else if (isErr(v)) throw v;
    else if (typeof v === 'number') out.push(v);
    else if (typeof v === 'boolean') out.push(v ? 1 : 0);
    else if (v == null) { if (opts.all) out.push(0); }
    else out.push(toNum(v));
  }
  return out;
}
function wildRe(s) { return new RegExp('^' + s.replace(/~([*?~])|([.+^${}()|[\]\\])|(\*)|(\?)/g, (m, esc, sp, star, q) => (esc ? '\\' + esc : sp ? '\\' + sp : star ? '[\\s\\S]*' : '.')) + '$', 'i'); }
function criteria(crit) {
  if (typeof crit === 'number') return v => (typeof v === 'number' ? v === crit : typeof v === 'string' && parseNumberText(v) === crit);
  if (typeof crit === 'boolean') return v => v === crit;
  const s = crit == null ? '' : String(crit);
  const m = /^(<=|>=|<>|<|>|=)?([\s\S]*)$/.exec(s);
  const op = m[1] || '=', rhs = m[2];
  const n = parseNumberText(rhs);
  const cmp = (x, y) => (op === '=' ? x === y : op === '<>' ? x !== y : op === '<' ? x < y : op === '>' ? x > y : op === '<=' ? x <= y : x >= y);
  if (n != null) return v => { const x = typeof v === 'number' ? v : typeof v === 'string' ? parseNumberText(v) : null; if (x == null) return op === '<>'; return cmp(x, n); };
  if (/^(true|false)$/i.test(rhs)) { const b = /^true$/i.test(rhs); return v => (typeof v === 'boolean' ? cmp(v, b) : op === '<>'); }
  if (op === '=' || op === '<>') {
    if (rhs === '') return v => (op === '=') === (v == null || v === '');
    const re = wildRe(rhs);
    return v => (op === '=') === (v != null && typeof v !== 'number' && re.test(String(v)));
  }
  return v => typeof v === 'string' && cmp(v.toLowerCase(), rhs.toLowerCase());
}
function lookupEq(a, b) {
  if (typeof b === 'string' && typeof a === 'string') return /[*?]/.test(b) ? wildRe(b).test(a) : a.toLowerCase() === b.toLowerCase();
  return a === b;
}
const ROUND = (x, d) => { const m = Math.pow(10, d); const y = Math.round(Math.abs(x) * m + 1e-9) / m; return x < 0 ? -y : y; };
function factorial(n) { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }
const statMean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
const statVar = (xs, pop) => { if (xs.length - (pop ? 0 : 1) <= 0) throw ERR.DIV0; const m = statMean(xs); return xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - (pop ? 0 : 1)); };
const FN = {
  SUM: (a, E) => nums(a, E).reduce((x, y) => x + y, 0),
  PRODUCT: (a, E) => nums(a, E).reduce((x, y) => x * y, 1),
  AVERAGE: (a, E) => { const x = nums(a, E); if (!x.length) throw ERR.DIV0; return statMean(x); },
  AVERAGEA: (a, E) => { const x = nums(a, E, { all: true }); if (!x.length) throw ERR.DIV0; return statMean(x); },
  MIN: (a, E) => { const x = nums(a, E); return x.length ? Math.min(...x) : 0; },
  MAX: (a, E) => { const x = nums(a, E); return x.length ? Math.max(...x) : 0; },
  COUNT: (a, E) => { let n = 0; for (const x of a) { if (x.k === 'blank') continue; const v = evalNode(x, E); for (const y of flat(v, E)) if (typeof y === 'number' || (!isRange(v) && !Array.isArray(v) && y != null && parseNumberText(y) != null)) n++; } return n; },
  COUNTA: (a, E) => { let n = 0; for (const x of a) { if (x.k === 'blank') continue; for (const y of flat(evalNode(x, E), E)) if (y != null && y !== '') n++; } return n; },
  COUNTBLANK: (a, E) => { const v = evalNode(a[0], E); let n = 0; if (isRange(v)) { for (let r = v.r1; r <= v.r2 && r <= v.r1 + 100000; r++) for (let c = v.c1; c <= v.c2; c++) { const x = cellValue(v.sh, r, c, E.wb); if (x == null || x === '') n++; } } return n; },
  COUNTIF: (a, E) => { const m = criteria(FA(a[1], E)); let n = 0; for (const v of flat(FAR(a[0], E), E)) if (m(v)) n++; return n; },
  COUNTIFS: (a, E) => {
    const pairs = []; for (let i = 0; i + 1 < a.length; i += 2) pairs.push([flat(FAR(a[i], E), E), criteria(FA(a[i + 1], E))]);
    if (!pairs.length) throw ERR.VALUE;
    let n = 0; for (let k = 0; k < pairs[0][0].length; k++) if (pairs.every(([vals, m]) => m(vals[k]))) n++; return n;
  },
  SUMIF: (a, E) => { const rg = flat(FAR(a[0], E), E), m = criteria(FA(a[1], E)), sv = a[2] ? flat(FAR(a[2], E), E) : rg; let s = 0; rg.forEach((v, i) => { if (m(v) && typeof sv[i] === 'number') s += sv[i]; }); return s; },
  SUMIFS: (a, E) => {
    const sv = flat(FAR(a[0], E), E), pairs = [];
    for (let i = 1; i + 1 < a.length; i += 2) pairs.push([flat(FAR(a[i], E), E), criteria(FA(a[i + 1], E))]);
    let s = 0; sv.forEach((v, k) => { if (typeof v === 'number' && pairs.every(([vals, m]) => m(vals[k]))) s += v; }); return s;
  },
  AVERAGEIF: (a, E) => { const rg = flat(FAR(a[0], E), E), m = criteria(FA(a[1], E)), sv = a[2] ? flat(FAR(a[2], E), E) : rg; let s = 0, n = 0; rg.forEach((v, i) => { if (m(v) && typeof sv[i] === 'number') { s += sv[i]; n++; } }); if (!n) throw ERR.DIV0; return s / n; },
  SUMPRODUCT: (a, E) => { const arrs = a.map(x => flat(FAR(x, E), E)); const L = arrs[0].length; if (arrs.some(x => x.length !== L)) throw ERR.VALUE; let s = 0; for (let i = 0; i < L; i++) { let p = 1; for (const x of arrs) p *= typeof x[i] === 'number' ? x[i] : 0; s += p; } return s; },
  MEDIAN: (a, E) => { const x = nums(a, E).sort((p, q) => p - q); if (!x.length) throw ERR.NUM; const m = x.length >> 1; return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2; },
  MODE: (a, E) => { const x = nums(a, E), c = new Map(); let best = null, bn = 1; for (const v of x) { const n = (c.get(v) || 0) + 1; c.set(v, n); if (n > bn) { bn = n; best = v; } } if (best == null) throw ERR.NA; return best; },
  STDEV: (a, E) => Math.sqrt(statVar(nums(a, E), false)), 'STDEV.S': (a, E) => Math.sqrt(statVar(nums(a, E), false)),
  STDEVP: (a, E) => Math.sqrt(statVar(nums(a, E), true)), 'STDEV.P': (a, E) => Math.sqrt(statVar(nums(a, E), true)),
  VAR: (a, E) => statVar(nums(a, E), false), VARP: (a, E) => statVar(nums(a, E), true),
  LARGE: (a, E) => { const x = flat(FAR(a[0], E), E).filter(v => typeof v === 'number').sort((p, q) => q - p); const k = FAN(a[1], E); if (k < 1 || k > x.length) throw ERR.NUM; return x[k - 1]; },
  SMALL: (a, E) => { const x = flat(FAR(a[0], E), E).filter(v => typeof v === 'number').sort((p, q) => p - q); const k = FAN(a[1], E); if (k < 1 || k > x.length) throw ERR.NUM; return x[k - 1]; },
  RANK: (a, E) => { const v = FAN(a[0], E), x = flat(FAR(a[1], E), E).filter(y => typeof y === 'number'), asc = FAN(a[2], E, 0); if (!x.includes(v)) throw ERR.NA; return x.filter(y => (asc ? y < v : y > v)).length + 1; },
  ROUND: (a, E) => ROUND(FAN(a[0], E), FAN(a[1], E, 0)),
  ROUNDUP: (a, E) => { const x = FAN(a[0], E), m = Math.pow(10, FAN(a[1], E, 0)); return (x < 0 ? -1 : 1) * Math.ceil(Math.abs(x) * m - 1e-9) / m; },
  ROUNDDOWN: (a, E) => { const x = FAN(a[0], E), m = Math.pow(10, FAN(a[1], E, 0)); return (x < 0 ? -1 : 1) * Math.floor(Math.abs(x) * m + 1e-9) / m; },
  INT: (a, E) => Math.floor(FAN(a[0], E)),
  TRUNC: (a, E) => { const x = FAN(a[0], E), m = Math.pow(10, FAN(a[1], E, 0)); return Math.trunc(x * m) / m; },
  ABS: (a, E) => Math.abs(FAN(a[0], E)),
  SIGN: (a, E) => Math.sign(FAN(a[0], E)),
  SQRT: (a, E) => { const x = FAN(a[0], E); if (x < 0) throw ERR.NUM; return Math.sqrt(x); },
  POWER: (a, E) => Math.pow(FAN(a[0], E), FAN(a[1], E)),
  MOD: (a, E) => { const x = FAN(a[0], E), d = FAN(a[1], E); if (d === 0) throw ERR.DIV0; return x - d * Math.floor(x / d); },
  EXP: (a, E) => Math.exp(FAN(a[0], E)),
  LN: (a, E) => { const x = FAN(a[0], E); if (x <= 0) throw ERR.NUM; return Math.log(x); },
  LOG: (a, E) => { const x = FAN(a[0], E), b = FAN(a[1], E, 10); if (x <= 0 || b <= 0 || b === 1) throw ERR.NUM; return Math.log(x) / Math.log(b); },
  LOG10: (a, E) => { const x = FAN(a[0], E); if (x <= 0) throw ERR.NUM; return Math.log10(x); },
  PI: () => Math.PI,
  RAND: () => Math.random(),
  RANDBETWEEN: (a, E) => { const lo = Math.ceil(FAN(a[0], E)), hi = Math.floor(FAN(a[1], E)); return lo + Math.floor(Math.random() * (hi - lo + 1)); },
  CEILING: (a, E) => { const x = FAN(a[0], E), s = FAN(a[1], E, 1); return s === 0 ? 0 : Math.ceil(x / s - 1e-12) * s; },
  FLOOR: (a, E) => { const x = FAN(a[0], E), s = FAN(a[1], E, 1); if (s === 0) throw ERR.DIV0; return Math.floor(x / s + 1e-12) * s; },
  MROUND: (a, E) => { const x = FAN(a[0], E), m = FAN(a[1], E); return m === 0 ? 0 : Math.round(x / m) * m; },
  EVEN: (a, E) => { const x = FAN(a[0], E), y = Math.ceil(Math.abs(x) / 2) * 2; return x < 0 ? -y : y; },
  ODD: (a, E) => { const x = FAN(a[0], E); let y = Math.ceil(Math.abs(x)); if (y % 2 === 0) y++; return x < 0 ? -y : y; },
  FACT: (a, E) => { const n = Math.floor(FAN(a[0], E)); if (n < 0) throw ERR.NUM; return factorial(n); },
  SIN: (a, E) => Math.sin(FAN(a[0], E)), COS: (a, E) => Math.cos(FAN(a[0], E)), TAN: (a, E) => Math.tan(FAN(a[0], E)),
  ASIN: (a, E) => Math.asin(FAN(a[0], E)), ACOS: (a, E) => Math.acos(FAN(a[0], E)), ATAN: (a, E) => Math.atan(FAN(a[0], E)),
  ATAN2: (a, E) => Math.atan2(FAN(a[1], E), FAN(a[0], E)),
  DEGREES: (a, E) => FAN(a[0], E) * 180 / Math.PI, RADIANS: (a, E) => FAN(a[0], E) * Math.PI / 180,
  IF: (a, E) => (FAB(a[0], E) ? (a[1] ? FA(a[1], E) : true) : (a[2] ? FA(a[2], E) : false)),
  IFS: (a, E) => { for (let i = 0; i + 1 < a.length; i += 2) if (FAB(a[i], E)) return FA(a[i + 1], E); throw ERR.NA; },
  IFERROR: (a, E) => { let v; try { v = FA(a[0], E); } catch (e) { if (e instanceof FErr) v = e; else throw e; } return isErr(v) ? FA(a[1], E) : v; },
  IFNA: (a, E) => { let v; try { v = FA(a[0], E); } catch (e) { if (e instanceof FErr) v = e; else throw e; } return v === ERR.NA || (isErr(v) && v.code === '#N/A') ? FA(a[1], E) : v; },
  AND: (a, E) => { let r = true; for (const x of a) for (const v of flat(evalNode(x, E), E)) { if (isErr(v)) throw v; if (v == null || typeof v === 'string') continue; if (!toBool(v)) r = false; } return r; },
  OR: (a, E) => { let r = false; for (const x of a) for (const v of flat(evalNode(x, E), E)) { if (isErr(v)) throw v; if (v == null || typeof v === 'string') continue; if (toBool(v)) r = true; } return r; },
  XOR: (a, E) => { let n = 0; for (const x of a) for (const v of flat(evalNode(x, E), E)) { if (v == null || typeof v === 'string') continue; if (toBool(v)) n++; } return n % 2 === 1; },
  NOT: (a, E) => !FAB(a[0], E),
  TRUE: () => true, FALSE: () => false,
  CHOOSE: (a, E) => { const i = Math.floor(FAN(a[0], E)); if (i < 1 || i >= a.length) throw ERR.VALUE; return FA(a[i], E); },
  SWITCH: (a, E) => { const v = FA(a[0], E); for (let i = 1; i + 1 < a.length; i += 2) if (compare(v, FA(a[i], E)) === 0) return FA(a[i + 1], E); if (a.length % 2 === 0) return FA(a[a.length - 1], E); throw ERR.NA; },
  ISBLANK: (a, E) => { const v = FA(a[0], E); return v == null; },
  ISNUMBER: (a, E) => typeof FA(a[0], E) === 'number',
  ISTEXT: (a, E) => typeof FA(a[0], E) === 'string',
  ISLOGICAL: (a, E) => typeof FA(a[0], E) === 'boolean',
  ISERROR: (a, E) => { try { return isErr(FA(a[0], E)); } catch (e) { return e instanceof FErr; } },
  ISERR: (a, E) => { try { const v = FA(a[0], E); return isErr(v) && v.code !== '#N/A'; } catch (e) { return e instanceof FErr && e.code !== '#N/A'; } },
  ISNA: (a, E) => { try { const v = FA(a[0], E); return isErr(v) && v.code === '#N/A'; } catch (e) { return e instanceof FErr && e.code === '#N/A'; } },
  ISEVEN: (a, E) => Math.floor(Math.abs(FAN(a[0], E))) % 2 === 0, ISODD: (a, E) => Math.floor(Math.abs(FAN(a[0], E))) % 2 === 1,
  NA: () => ERR.NA,
  LEN: (a, E) => FAT(a[0], E).length,
  LEFT: (a, E) => FAT(a[0], E).slice(0, Math.max(0, FAN(a[1], E, 1))),
  RIGHT: (a, E) => { const s = FAT(a[0], E), n = Math.max(0, FAN(a[1], E, 1)); return n ? s.slice(-n) : ''; },
  MID: (a, E) => { const s = FAT(a[0], E), st = FAN(a[1], E), n = FAN(a[2], E); if (st < 1 || n < 0) throw ERR.VALUE; return s.substr(st - 1, n); },
  UPPER: (a, E) => FAT(a[0], E).toUpperCase(), LOWER: (a, E) => FAT(a[0], E).toLowerCase(),
  PROPER: (a, E) => FAT(a[0], E).toLowerCase().replace(/(^|[^a-z'])([a-z])/g, (m, p, c) => p + c.toUpperCase()),
  TRIM: (a, E) => FAT(a[0], E).replace(/ +/g, ' ').trim(),
  CONCATENATE: (a, E) => a.map(x => FAT(x, E, '')).join(''),
  CONCAT: (a, E) => a.map(x => flat(evalNode(x, E), E).map(v => { if (isErr(v)) throw v; return toText(v); }).join('')).join(''),
  TEXTJOIN: (a, E) => { const sep = FAT(a[0], E), skip = FAB(a[1], E, true); const parts = []; for (const x of a.slice(2)) for (const v of flat(evalNode(x, E), E)) { if (isErr(v)) throw v; const t = toText(v); if (!skip || t !== '') parts.push(t); } return parts.join(sep); },
  SUBSTITUTE: (a, E) => { const s = FAT(a[0], E), o = FAT(a[1], E), nw = FAT(a[2], E); if (!o) return s; if (a[3]) { const k = FAN(a[3], E); let i = -1; for (let j = 0; j < k; j++) { i = s.indexOf(o, i + 1); if (i < 0) return s; } return s.slice(0, i) + nw + s.slice(i + o.length); } return s.split(o).join(nw); },
  REPLACE: (a, E) => { const s = FAT(a[0], E), st = FAN(a[1], E), n = FAN(a[2], E); return s.slice(0, st - 1) + FAT(a[3], E) + s.slice(st - 1 + n); },
  FIND: (a, E) => { const f = FAT(a[0], E), s = FAT(a[1], E), st = FAN(a[2], E, 1); const i = s.indexOf(f, st - 1); if (i < 0) throw ERR.VALUE; return i + 1; },
  SEARCH: (a, E) => { const f = FAT(a[0], E), s = FAT(a[1], E), st = FAN(a[2], E, 1); const re = new RegExp(wildRe(f).source.slice(1, -1), 'i'); const m = re.exec(s.slice(st - 1)); if (!m) throw ERR.VALUE; return m.index + st; },
  REPT: (a, E) => FAT(a[0], E).repeat(Math.max(0, Math.min(32767, FAN(a[1], E)))),
  EXACT: (a, E) => FAT(a[0], E) === FAT(a[1], E),
  CHAR: (a, E) => String.fromCharCode(FAN(a[0], E)),
  CODE: (a, E) => { const s = FAT(a[0], E); if (!s) throw ERR.VALUE; return s.charCodeAt(0); },
  VALUE: (a, E) => { const v = FA(a[0], E); if (typeof v === 'number') return v; const p = parseInput(toText(v)); if (typeof p.v !== 'number') throw ERR.VALUE; return p.v; },
  TEXT: (a, E) => { const v = FA(a[0], E); if (isErr(v)) throw v; return formatValue(typeof v === 'string' && parseNumberText(v) != null ? parseNumberText(v) : v, FAT(a[1], E)).text; },
  T: (a, E) => { const v = FA(a[0], E); return typeof v === 'string' ? v : ''; },
  N: (a, E) => { const v = FA(a[0], E); return typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? 1 : 0) : 0; },
  DOLLAR: (a, E) => formatValue(FAN(a[0], E), '$#,##0' + (FAN(a[1], E, 2) > 0 ? '.' + '0'.repeat(FAN(a[1], E, 2)) : '') + '_);($#,##0' + (FAN(a[1], E, 2) > 0 ? '.' + '0'.repeat(FAN(a[1], E, 2)) : '') + ')').text,
  FIXED: (a, E) => { const d = FAN(a[1], E, 2); return formatValue(ROUND(FAN(a[0], E), d), (FAB(a[2], E, false) ? '0' : '#,##0') + (d > 0 ? '.' + '0'.repeat(d) : '')).text; },
  TODAY: () => todaySerial(),
  NOW: () => nowSerial(),
  DATE: (a, E) => { let y = Math.floor(FAN(a[0], E)); if (y < 1900) y += 1900; return dateSerial(y, Math.floor(FAN(a[1], E)) - 1, Math.floor(FAN(a[2], E))); },
  TIME: (a, E) => (FAN(a[0], E) * 3600 + FAN(a[1], E) * 60 + FAN(a[2], E)) / 86400 % 1,
  YEAR: (a, E) => serialParts(FAN(a[0], E)).y, MONTH: (a, E) => serialParts(FAN(a[0], E)).m + 1, DAY: (a, E) => serialParts(FAN(a[0], E)).d,
  HOUR: (a, E) => serialParts(FAN(a[0], E)).hh, MINUTE: (a, E) => serialParts(FAN(a[0], E)).mi, SECOND: (a, E) => serialParts(FAN(a[0], E)).ss,
  WEEKDAY: (a, E) => { const d = serialParts(FAN(a[0], E)).dow, t = FAN(a[1], E, 1); return t === 2 ? (d + 6) % 7 + 1 : t === 3 ? (d + 6) % 7 : d + 1; },
  DATEVALUE: (a, E) => { const p = parseInput(FAT(a[0], E)); if (typeof p.v !== 'number') throw ERR.VALUE; return Math.floor(p.v); },
  EDATE: (a, E) => { const p = serialParts(FAN(a[0], E)); return dateSerial(p.y, p.m + FAN(a[1], E), p.d); },
  EOMONTH: (a, E) => { const p = serialParts(FAN(a[0], E)); return dateSerial(p.y, p.m + FAN(a[1], E) + 1, 0); },
  DAYS: (a, E) => Math.floor(FAN(a[0], E)) - Math.floor(FAN(a[1], E)),
  NETWORKDAYS: (a, E) => { let s = Math.floor(FAN(a[0], E)), e = Math.floor(FAN(a[1], E)), sign = 1; if (e < s) { [s, e] = [e, s]; sign = -1; } let n = 0; for (let d = s; d <= e && n < 1e6; d++) { const w = serialParts(d).dow; if (w !== 0 && w !== 6) n++; } return n * sign; },
  DATEDIF: (a, E) => { const s = FAN(a[0], E), e = FAN(a[1], E), u = FAT(a[2], E).toUpperCase(); if (e < s) throw ERR.NUM; const p = serialParts(s), q = serialParts(e); if (u === 'D') return Math.floor(e) - Math.floor(s); let months = (q.y - p.y) * 12 + (q.m - p.m) - (q.d < p.d ? 1 : 0); if (u === 'M') return months; if (u === 'Y') return Math.floor(months / 12); if (u === 'YM') return months % 12; if (u === 'MD') return q.d >= p.d ? q.d - p.d : Math.round(e - dateSerial(q.y, q.m - 1, p.d)); throw ERR.NUM; },
  PMT: (a, E) => { const r = FAN(a[0], E), n = FAN(a[1], E), pv = FAN(a[2], E), fv = FAN(a[3], E, 0), t = FAN(a[4], E, 0); if (r === 0) return -(pv + fv) / n; const f = Math.pow(1 + r, n); return -(r * (pv * f + fv)) / ((1 + r * t) * (f - 1)); },
  FV: (a, E) => { const r = FAN(a[0], E), n = FAN(a[1], E), pmt = FAN(a[2], E), pv = FAN(a[3], E, 0), t = FAN(a[4], E, 0); if (r === 0) return -(pv + pmt * n); const f = Math.pow(1 + r, n); return -(pv * f + pmt * (1 + r * t) * (f - 1) / r); },
  PV: (a, E) => { const r = FAN(a[0], E), n = FAN(a[1], E), pmt = FAN(a[2], E), fv = FAN(a[3], E, 0), t = FAN(a[4], E, 0); if (r === 0) return -(fv + pmt * n); const f = Math.pow(1 + r, n); return -(fv + pmt * (1 + r * t) * (f - 1) / r) / f; },
  NPV: (a, E) => { const r = FAN(a[0], E); return nums(a.slice(1), E).reduce((s, v, i) => s + v / Math.pow(1 + r, i + 1), 0); },
  IRR: (a, E) => { const cf = flat(FAR(a[0], E), E).filter(v => typeof v === 'number'); let r = FAN(a[1], E, 0.1); for (let it = 0; it < 100; it++) { let f = 0, df = 0; cf.forEach((v, i) => { f += v / Math.pow(1 + r, i); df -= i * v / Math.pow(1 + r, i + 1); }); if (Math.abs(df) < 1e-12) break; const nr = r - f / df; if (Math.abs(nr - r) < 1e-10) return nr; r = nr; } if (!isFinite(r)) throw ERR.NUM; return r; },
  ROW: (a, E) => (a[0] ? (() => { const v = evalNode(a[0], E); return isRange(v) ? v.r1 + 1 : E.r + 1; })() : E.r + 1),
  COLUMN: (a, E) => (a[0] ? (() => { const v = evalNode(a[0], E); return isRange(v) ? v.c1 + 1 : E.c + 1; })() : E.c + 1),
  ROWS: (a, E) => { const v = evalNode(a[0], E); return isRange(v) ? v.r2 - v.r1 + 1 : 1; },
  COLUMNS: (a, E) => { const v = evalNode(a[0], E); return isRange(v) ? v.c2 - v.c1 + 1 : 1; },
  INDEX: (a, E) => {
    const m = matrix(FAR(a[0], E), E);
    let r = FAN(a[1], E, 0), c = FAN(a[2], E, 0);
    if (m.length === 1 && !a[2] && r) { c = r; r = 1; }
    if (!r) r = 1; if (!c) c = 1;
    if (r < 1 || c < 1 || r > m.length || c > (m[0] || []).length) throw ERR.REF;
    return m[r - 1][c - 1];
  },
  MATCH: (a, E) => {
    const v = FA(a[0], E), xs = flat(FAR(a[1], E), E), t = FAN(a[2], E, 1);
    if (t === 0) { const i = xs.findIndex(x => x != null && lookupEq(x, v)); if (i < 0) throw ERR.NA; return i + 1; }
    let best = -1;
    for (let i = 0; i < xs.length; i++) { if (xs[i] == null) continue; const c = compare(xs[i], v); if (t > 0 ? c <= 0 : c >= 0) best = i; else break; }
    if (best < 0) throw ERR.NA;
    return best + 1;
  },
  VLOOKUP: (a, E) => {
    const v = FA(a[0], E), m = matrix(FAR(a[1], E), E), col = FAN(a[2], E), approx = FAB(a[3], E, true);
    if (col < 1 || col > (m[0] || []).length) throw ERR.REF;
    if (!approx) { const row = m.find(r => r[0] != null && lookupEq(r[0], v)); if (!row) throw ERR.NA; return row[col - 1]; }
    let best = null;
    for (const row of m) { if (row[0] == null) continue; if (compare(row[0], v) <= 0) best = row; else break; }
    if (!best) throw ERR.NA;
    return best[col - 1];
  },
  HLOOKUP: (a, E) => {
    const v = FA(a[0], E), m = matrix(FAR(a[1], E), E), row = FAN(a[2], E), approx = FAB(a[3], E, true);
    if (row < 1 || row > m.length) throw ERR.REF;
    const head = m[0];
    let ci = -1;
    if (!approx) ci = head.findIndex(x => x != null && lookupEq(x, v));
    else for (let i = 0; i < head.length; i++) { if (head[i] == null) continue; if (compare(head[i], v) <= 0) ci = i; else break; }
    if (ci < 0) throw ERR.NA;
    return m[row - 1][ci];
  },
  XLOOKUP: (a, E) => {
    const v = FA(a[0], E), keys = flat(FAR(a[1], E), E), vals = flat(FAR(a[2], E), E);
    const i = keys.findIndex(x => x != null && lookupEq(x, v));
    if (i < 0) { if (a[3] && a[3].k !== 'blank') return FA(a[3], E); throw ERR.NA; }
    return vals[i];
  },
  TRANSPOSE: (a, E) => { const m = matrix(FAR(a[0], E), E); return m[0] ? m[0][0] : null; }
};
FN['CEILING.MATH'] = FN.CEILING; FN['FLOOR.MATH'] = FN.FLOOR; FN['VAR.S'] = FN.VAR; FN['VAR.P'] = FN.VARP; FN['MODE.SNGL'] = FN.MODE;
const FN_NAMES = Object.keys(FN).filter(n => /^[A-Z][A-Z0-9.]*$/.test(n)).sort();

/* ---------------- moving references ---------------- */
const quoteSheet = n => (/^[A-Za-z_][\w.]*$/.test(n) && !/^[A-Za-z]{1,3}\d+$/.test(n) ? n : "'" + String(n).replace(/'/g, "''") + "'");
function refText(t) {
  const sh = t.sheet ? quoteSheet(t.sheet) + '!' : '';
  if (t.bad) return sh + '#REF!';
  if (t.cols) return sh + (t.ca1 ? '$' : '') + colName(t.c1) + ':' + (t.ca2 ? '$' : '') + colName(t.c2);
  if (t.rows) return sh + (t.ra1 ? '$' : '') + (t.r1 + 1) + ':' + (t.ra2 ? '$' : '') + (t.r2 + 1);
  const p1 = (t.ca1 ? '$' : '') + colName(t.c1) + (t.ra1 ? '$' : '') + (t.r1 + 1);
  if (!t.range) return sh + p1;
  return sh + p1 + ':' + (t.ca2 ? '$' : '') + colName(t.c2) + (t.ra2 ? '$' : '') + (t.r2 + 1);
}
function rewriteRefs(f, fn) {
  const toks = ftokenize(f);
  let out = '', last = 0;
  for (const t of toks) {
    if (t.t !== 'ref') continue;
    const nt = fn(Object.assign({}, t));
    if (!nt) continue;
    out += f.slice(last, t.a) + refText(nt);
    last = t.b;
  }
  return out + f.slice(last);
}
/** a formula copied dr rows down and dc columns across (relative refs move, $absolute ones stay) */
function shiftFormula(f, dr, dc) {
  if (!dr && !dc) return f;
  return rewriteRefs(f, t => {
    if (!t.rows) { if (!t.ca1) t.c1 += dc; if (!t.ca2) t.c2 += dc; }
    if (!t.cols) { if (!t.ra1) t.r1 += dr; if (!t.ra2) t.r2 += dr; }
    if (t.r1 < 0 || t.c1 < 0 || t.r2 < 0 || t.c2 < 0 || t.r1 >= XL_ROWS || t.r2 >= XL_ROWS || t.c1 >= XL_COLS || t.c2 >= XL_COLS) t.bad = true;
    return t;
  });
}
/**
 * rows or columns inserted (count > 0) or deleted (count < 0) at `at` on sheet `target`;
 * fix a formula that lives on sheet `own`
 */
function adjustFormula(f, own, target, axis, at, count) {
  return rewriteRefs(f, t => {
    const sheet = t.sheet || own;
    if (String(sheet).toLowerCase() !== String(target).toLowerCase()) return null;
    if ((axis === 'r' && t.cols) || (axis === 'c' && t.rows)) return null;
    const k1 = axis === 'r' ? 'r1' : 'c1', k2 = axis === 'r' ? 'r2' : 'c2';
    if (count > 0) {
      if (t[k1] >= at) t[k1] += count;
      if (t[k2] >= at) t[k2] += count;
    } else {
      const n = -count, end = at + n;
      const single = !t.range;
      if (single) { if (t[k1] >= at && t[k1] < end) t.bad = true; else if (t[k1] >= end) { t[k1] -= n; t[k2] -= n; } return t; }
      let a = t[k1], b = t[k2];
      if (a >= end) a -= n; else if (a >= at) a = at;
      if (b >= end) b -= n; else if (b >= at) b = at - 1;
      if (b < a) t.bad = true;
      t[k1] = a; t[k2] = b;
    }
    return t;
  });
}
function renameSheetRefs(f, oldName, newName) {
  return rewriteRefs(f, t => (t.sheet && t.sheet.toLowerCase() === oldName.toLowerCase() ? Object.assign(t, { sheet: newName }) : null));
}
