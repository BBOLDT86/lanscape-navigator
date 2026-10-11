/* ===================================================================
   Calculator: Windows 95-style standard & scientific calculator with a
   paper tape, unit conversions, and a power/battery worksheet
   =================================================================== */
const CALC_CSS = `body.app-calc{background:#008080;overflow:auto}
.ca-wrap{flex:1;display:flex;gap:16px;align-items:flex-start;justify-content:center;padding:18px 12px;flex-wrap:wrap}
.ca-win{background:var(--face);padding:3px;box-shadow:inset -1px -1px var(--dk),inset 1px 1px var(--lt),inset -2px -2px var(--sh),inset 2px 2px var(--hi),4px 4px 0 rgba(0,0,0,.35)}
.ca-title{background:linear-gradient(90deg,#000080,#1084d0);color:#fff;font-weight:bold;padding:3px 6px;display:flex;align-items:center;gap:6px}
.ca-title svg{width:16px;height:16px}
.ca-win .mb{background:var(--face)}
.ca-tabs{display:flex;gap:0;padding:6px 6px 0}
.ca-tabs button{border:0;background:var(--face);padding:3px 10px;margin-right:-1px;box-shadow:inset -1px 0 var(--dk),inset 1px 1px var(--hi),inset -2px 0 var(--sh);position:relative;top:1px}
.ca-tabs button.on{font-weight:bold;top:0;padding-bottom:5px;z-index:2}
.ca-body{padding:10px;box-shadow:inset -1px -1px var(--dk),inset 1px 1px var(--hi),inset -2px -2px var(--sh);margin:0 6px 6px}
.ca-disp{background:#fff;text-align:right;font:20px/1.2 "Courier New",var(--mono);padding:4px 8px;min-height:34px;overflow:hidden;white-space:nowrap;margin-bottom:6px}
.ca-sub{font:11px var(--mono);color:#555;text-align:right;min-height:14px;margin:-4px 2px 6px;white-space:nowrap;overflow:hidden}
.ca-row{display:flex;gap:6px;align-items:center;margin-bottom:6px;flex-wrap:wrap}
.ca-mem{width:30px;height:24px;display:inline-grid;place-items:center;font-weight:bold;box-shadow:inset -1px -1px var(--hi),inset 1px 1px var(--sh)}
.ca-keys{display:grid;gap:5px}
.ca-keys button{min-width:0;padding:0;height:30px;font:13px Tahoma,Arial,sans-serif;color:#00008b}
.ca-keys button.op{color:#c00000}.ca-keys button.fn{color:#800080}.ca-keys button.mem{color:#c00000}.ca-keys button.ctl{color:#c00000}
.ca-keys button:disabled{color:#a0a0a0}
.ca-tape{width:240px;display:flex;flex-direction:column}
.ca-tape pre{flex:1;margin:0;background:#fffff4;font:13px/1.45 "Courier New",var(--mono);padding:8px 10px;height:320px;overflow:auto;white-space:pre;border-top:6px dotted #d8d0b0;color:#222}
.ca-tape .tb{gap:4px}
.ca-form{display:grid;grid-template-columns:auto 1fr auto;gap:6px 8px;align-items:center;min-width:300px}
.ca-form input.fld,.ca-form select.fld{width:100%;min-width:90px}
.ca-res{background:#fff;padding:6px 8px;font:15px var(--mono);margin-top:8px;white-space:pre-wrap}
.ca-hint{color:#333;font-size:11px;margin:8px 0 0;max-width:320px}
.radios{display:flex;gap:10px;flex-wrap:wrap;padding:3px 6px;box-shadow:inset -1px -1px var(--hi),inset 1px 1px var(--sh)}`;
const UNITS = {
  Length: [['Millimeters', 0.001], ['Centimeters', 0.01], ['Meters', 1], ['Kilometers', 1000], ['Inches', 0.0254], ['Feet', 0.3048], ['Yards', 0.9144], ['Miles', 1609.344], ['Nautical miles', 1852]],
  Area: [['Square inches', 0.00064516], ['Square feet', 0.09290304], ['Square yards', 0.83612736], ['Square meters', 1], ['Acres', 4046.8564224], ['Hectares', 10000], ['Square miles', 2589988.110336]],
  Volume: [['Milliliters', 0.001], ['Liters', 1], ['Cubic meters', 1000], ['Teaspoons (US)', 0.00492892], ['Tablespoons (US)', 0.0147868], ['Fluid ounces (US)', 0.0295735], ['Cups (US)', 0.236588], ['Quarts (US)', 0.946353], ['Gallons (US)', 3.78541], ['Cubic feet', 28.3168]],
  Weight: [['Grams', 0.001], ['Kilograms', 1], ['Metric tons', 1000], ['Ounces', 0.0283495], ['Pounds', 0.453592], ['Short tons (US)', 907.185]],
  Temperature: [['Celsius', 'C'], ['Fahrenheit', 'F'], ['Kelvin', 'K']],
  Speed: [['Meters/second', 1], ['Kilometers/hour', 1 / 3.6], ['Miles/hour', 0.44704], ['Knots', 0.514444], ['Feet/second', 0.3048]],
  Pressure: [['Pascals', 1], ['Kilopascals', 1000], ['Bar', 100000], ['PSI', 6894.757], ['Atmospheres', 101325], ['Inches of mercury', 3386.389], ['mm of mercury', 133.322]],
  Energy: [['Joules', 1], ['Kilojoules', 1000], ['Calories', 4.184], ['Kilocalories', 4184], ['Watt-hours', 3600], ['Kilowatt-hours', 3.6e6], ['BTU', 1055.06]],
  Power: [['Watts', 1], ['Kilowatts', 1000], ['Megawatts', 1e6], ['Horsepower', 745.7], ['BTU/hour', 0.293071], ['Tons of refrigeration', 3516.85]],
  Torque: [['Newton-meters', 1], ['Foot-pounds', 1.35582], ['Inch-pounds', 0.112985]],
  Data: [['Bytes', 1], ['Kilobytes', 1024], ['Megabytes', 1048576], ['Gigabytes', 1073741824], ['Terabytes', 1099511627776], ['Bits', 0.125]],
  Time: [['Seconds', 1], ['Minutes', 60], ['Hours', 3600], ['Days', 86400], ['Weeks', 604800], ['Years (365 d)', 31536000]]
};
function convertUnit(cat, v, a, b) {
  const list = UNITS[cat];
  const fa = list[a][1], fb = list[b][1];
  if (cat === 'Temperature') {
    const toC = fa === 'C' ? v : fa === 'F' ? (v - 32) * 5 / 9 : v - 273.15;
    return fb === 'C' ? toC : fb === 'F' ? toC * 9 / 5 + 32 : toC + 273.15;
  }
  return v * fa / fb;
}
const calcFmt = (v, group) => {
  if (!isFinite(v)) return 'Cannot divide by zero';
  let s = Math.abs(v) >= 1e16 || (Math.abs(v) < 1e-12 && v !== 0) ? v.toExponential(10).replace(/\.?0+e/, 'e') : String(+v.toPrecision(15));
  if (group && !/e/.test(s)) { const [i, f] = s.split('.'); s = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (f ? '.' + f : ''); }
  return s;
};
async function mountCalc(ctx) {
  const { h, doc } = ctx;
  const saved = (await ctx.kv.get('calc:state')) || {};
  const st = { mode: saved.mode || 'standard', group: !!saved.group, tape: saved.tape || [], mem: saved.mem || 0, angle: saved.angle || 'deg', base: 10, inv: false, showTape: saved.showTape !== false };
  let entry = '0', fresh = true, toks = [], lastOp = null, lastVal = null, err = false, opPending = false;
  const persist = debounce(() => ctx.kv.set('calc:state', { mode: st.mode, group: st.group, tape: st.tape.slice(-400), mem: st.mem, angle: st.angle, showTape: st.showTape }), 300);
  const disp = h('div', { class: 'ca-disp sunk', 'aria-live': 'polite' });
  const sub = h('div', { class: 'ca-sub' });
  const memBox = h('span', { class: 'ca-mem', title: 'Memory' });
  const tapePre = h('pre', { class: 'sunk', 'aria-label': 'Paper tape' });
  const cur = () => (st.base === 10 ? parseFloat(entry) : parseInt(entry, st.base) || 0);
  const shown = v => (st.base === 10 ? calcFmt(v, st.group) : (Math.trunc(v) >>> 0).toString(st.base).toUpperCase());
  function show() {
    disp.textContent = err ? err : st.base === 10 ? (fresh ? calcFmt(parseFloat(entry), st.group) : (st.group ? entry.replace(/^(-?\d+)/, m => m.replace(/\B(?=(\d{3})+(?!\d))/g, ',')) : entry)) : entry.toUpperCase();
    sub.textContent = toks.map(t => (typeof t === 'number' ? shown(t) : t)).join(' ');
    memBox.textContent = st.mem ? 'M' : '';
    tapePre.textContent = st.tape.join('\n');
    tapePre.scrollTop = tapePre.scrollHeight;
    persist();
  }
  const tapeLine = (num, sym) => { st.tape.push(String(num).padStart(18) + ' ' + sym); };
  const PREC = { '+': 1, '-': 1, '×': 2, '÷': 2, 'mod': 2, '^': 3, 'yroot': 3 };
  function apply(a, op, b) {
    switch (op) {
      case '+': return a + b; case '-': return a - b; case '×': return a * b;
      case '÷': if (b === 0) throw new Error('Cannot divide by zero'); return a / b;
      case 'mod': return a - b * Math.floor(a / b);
      case '^': return Math.pow(a, b); case 'yroot': return Math.pow(a, 1 / b);
    }
    return b;
  }
  /** standard mode works left to right like the real thing; scientific mode honours precedence and parentheses */
  function evaluate(list) {
    if (st.mode !== 'scientific') { let acc = list[0]; for (let i = 1; i + 1 < list.length; i += 2) acc = apply(acc, list[i], list[i + 1]); return acc; }
    const out = [], ops = [];
    const reduce = () => { const op = ops.pop(), b = out.pop(), a = out.pop(); out.push(apply(a, op, b)); };
    for (const t of list) {
      if (typeof t === 'number') out.push(t);
      else if (t === '(') ops.push(t);
      else if (t === ')') { while (ops.length && ops[ops.length - 1] !== '(') reduce(); ops.pop(); }
      else { while (ops.length && ops[ops.length - 1] !== '(' && PREC[ops[ops.length - 1]] >= PREC[t] && t !== '^') reduce(); ops.push(t); }
    }
    while (ops.length) { if (ops[ops.length - 1] === '(') ops.pop(); else reduce(); }
    return out.pop();
  }
  const setValue = v => { entry = st.base === 10 ? String(v) : (Math.trunc(v) >>> 0).toString(st.base); fresh = true; };
  function digit(d) {
    if (err) clearAll();
    if (fresh || opPending) { entry = '0'; fresh = false; opPending = false; }
    if (d === '.') { if (st.base !== 10 || entry.includes('.')) return; entry += '.'; }
    else entry = entry === '0' ? d : entry === '-0' ? '-' + d : entry + d;
    if (entry.replace(/[-.]/g, '').length > 32) entry = entry.slice(0, -1);
    show();
  }
  function op(o) {
    if (err) return;
    if (opPending && typeof toks[toks.length - 1] === 'string' && toks[toks.length - 1] !== ')' && toks[toks.length - 1] !== '(') { toks[toks.length - 1] = o; show(); return; }
    if (toks[toks.length - 1] !== ')') toks.push(cur());
    tapeLine(shown(cur()), o);
    if (st.mode !== 'scientific') { try { const v = evaluate(toks); toks = [v, o]; setValue(v); } catch (e) { err = e.message; } }
    else toks.push(o);
    opPending = true; fresh = true;
    show();
  }
  function equals() {
    if (err) { clearAll(); return; }
    try {
      let list;
      if (toks.length) { if (toks[toks.length - 1] !== ')') toks.push(cur()); list = toks; lastOp = list.length >= 3 ? list[list.length - 2] : null; lastVal = cur(); tapeLine(shown(cur()), '='); }
      else if (lastOp) { list = [cur(), lastOp, lastVal]; tapeLine(shown(cur()), lastOp); tapeLine(shown(lastVal), '='); }
      else { tapeLine(shown(cur()), '='); list = [cur()]; }
      let open = list.filter(t => t === '(').length - list.filter(t => t === ')').length;
      while (open-- > 0) list.push(')');
      const v = evaluate(list);
      st.tape.push('-'.repeat(20));
      tapeLine(shown(v), '*');
      st.tape.push('');
      toks = []; setValue(v); opPending = false;
    } catch (e) { err = e.message; toks = []; }
    show();
  }
  function unary(fn, label) {
    if (err) return;
    const x = cur();
    let v;
    const toRad = a => (st.angle === 'deg' ? a * Math.PI / 180 : st.angle === 'grad' ? a * Math.PI / 200 : a);
    const fromRad = a => (st.angle === 'deg' ? a * 180 / Math.PI : st.angle === 'grad' ? a * 200 / Math.PI : a);
    switch (fn) {
      case 'sqrt': v = st.inv ? x * x : Math.sqrt(x); break;
      case 'sq': v = x * x; break; case 'cube': v = st.inv ? Math.cbrt(x) : x * x * x; break;
      case 'recip': if (x === 0) { err = 'Cannot divide by zero'; show(); return; } v = 1 / x; break;
      case 'neg': if (!fresh && !opPending) { entry = entry[0] === '-' ? entry.slice(1) : '-' + entry; show(); return; } v = -x; break;
      case 'pct': { const left = toks.length >= 2 ? toks[toks.length - 2] : 0; v = (typeof left === 'number' ? left : 0) * x / 100; break; }
      case 'sin': v = st.inv ? fromRad(Math.asin(x)) : Math.sin(toRad(x)); break;
      case 'cos': v = st.inv ? fromRad(Math.acos(x)) : Math.cos(toRad(x)); break;
      case 'tan': v = st.inv ? fromRad(Math.atan(x)) : Math.tan(toRad(x)); break;
      case 'ln': v = st.inv ? Math.exp(x) : Math.log(x); break;
      case 'log': v = st.inv ? Math.pow(10, x) : Math.log10(x); break;
      case 'fact': { if (x < 0 || x > 170 || x !== Math.floor(x)) { err = 'Invalid input'; show(); return; } v = factorial(x); break; }
      case 'pi': v = st.inv ? 2 * Math.PI : Math.PI; break;
      case 'e': v = Math.E; break;
      case 'int': v = st.inv ? x - Math.trunc(x) : Math.trunc(x); break;
      case 'abs': v = Math.abs(x); break;
      case 'exp10': v = Math.pow(10, x); break;
      default: return;
    }
    if (Math.abs(v) < 1e-15) v = 0;
    v = +v.toPrecision(15);
    if (!isFinite(v)) { err = 'Invalid input'; show(); return; }
    if (fn !== 'pi' && fn !== 'e') st.tape.push(String(label + '(' + shown(x) + ')').padStart(18) + ' ' + '=' + ' ' + shown(v));
    setValue(v); opPending = false; st.inv = false; syncInv();
    show();
  }
  function paren(p) {
    if (st.mode !== 'scientific') return;
    if (p === '(') { if (!opPending && toks.length && toks[toks.length - 1] === ')') return; toks.push('('); opPending = true; }
    else { if (toks.filter(t => t === '(').length <= toks.filter(t => t === ')').length) return; if (toks[toks.length - 1] !== ')') toks.push(cur()); toks.push(')'); opPending = false; fresh = true; }
    show();
  }
  function clearAll() { entry = '0'; fresh = true; toks = []; err = false; opPending = false; show(); }
  function clearEntry() { entry = '0'; fresh = true; err = false; show(); }
  function backspace() { if (fresh || err) return; entry = entry.length > 1 && entry !== '-0' ? entry.slice(0, -1) : '0'; if (entry === '-') entry = '0'; show(); }
  function memory(k) {
    if (k === 'MC') st.mem = 0;
    else if (k === 'MR') { setValue(st.mem); opPending = false; }
    else if (k === 'MS') st.mem = cur();
    else if (k === 'M+') st.mem += cur();
    fresh = true;
    show();
  }
  function setBase(b) {
    const v = cur();
    st.base = b;
    setValue(v);
    buildKeys();
    show();
  }
  /* ---------- keys ---------- */
  const keysBox = h('div', { class: 'ca-keys' });
  const extraRow = h('div', { class: 'ca-row' });
  let invBox = null;
  const syncInv = () => { if (invBox) invBox.checked = st.inv; };
  function buildKeys() {
    keysBox.innerHTML = '';
    extraRow.innerHTML = '';
    const K = (label, cls, act, dis) => { const b = h('button', { class: 'btn ' + (cls || ''), type: 'button', text: label, title: label }); b.addEventListener('click', act); if (dis) b.disabled = true; keysBox.append(b); return b; };
    const okDigit = d => parseInt(d, 16) < st.base;
    if (st.mode === 'scientific') {
      keysBox.style.gridTemplateColumns = 'repeat(10, 44px)';
      const rad = name => { const id = 'cab' + name; const r = h('label', {}, h('input', { type: 'radio', name: 'cabase', id, checked: st.base === { Hex: 16, Dec: 10, Oct: 8, Bin: 2 }[name] }), ' ' + name); r.querySelector('input').addEventListener('change', () => setBase({ Hex: 16, Dec: 10, Oct: 8, Bin: 2 }[name])); return r; };
      const ang = name => { const r = h('label', {}, h('input', { type: 'radio', name: 'caang', checked: st.angle === name.toLowerCase().slice(0, name === 'Grads' ? 4 : 3) }), ' ' + name); r.querySelector('input').addEventListener('change', () => { st.angle = name === 'Degrees' ? 'deg' : name === 'Radians' ? 'rad' : 'grad'; persist(); }); return r; };
      invBox = h('input', { type: 'checkbox' });
      invBox.addEventListener('change', () => { st.inv = invBox.checked; });
      extraRow.append(h('div', { class: 'radios' }, rad('Hex'), rad('Dec'), rad('Oct'), rad('Bin')), h('div', { class: 'radios' }, ang('Degrees'), ang('Radians'), ang('Grads')), h('label', { class: 'radios' }, invBox, ' Inv'));
      const dec = st.base === 10;
      const rows = [
        [['(', 'fn', () => paren('(')], [')', 'fn', () => paren(')')], ['sin', 'fn', () => unary('sin', 'sin'), !dec], ['cos', 'fn', () => unary('cos', 'cos'), !dec], ['tan', 'fn', () => unary('tan', 'tan'), !dec], ['MC', 'mem', () => memory('MC')], ['7', '', () => digit('7'), !okDigit('7')], ['8', '', () => digit('8'), !okDigit('8')], ['9', '', () => digit('9'), !okDigit('9')], ['÷', 'op', () => op('÷')]],
        [['x^y', 'fn', () => op('^')], ['y√x', 'fn', () => op('yroot'), !dec], ['ln', 'fn', () => unary('ln', 'ln'), !dec], ['log', 'fn', () => unary('log', 'log'), !dec], ['n!', 'fn', () => unary('fact', 'fact')], ['MR', 'mem', () => memory('MR')], ['4', '', () => digit('4'), !okDigit('4')], ['5', '', () => digit('5'), !okDigit('5')], ['6', '', () => digit('6'), !okDigit('6')], ['×', 'op', () => op('×')]],
        [['x²', 'fn', () => unary('sq', 'sqr')], ['x³', 'fn', () => unary('cube', 'cube')], ['√', 'fn', () => unary('sqrt', 'sqrt'), !dec], ['10^x', 'fn', () => unary('exp10', '10^'), !dec], ['π', 'fn', () => unary('pi', 'pi'), !dec], ['MS', 'mem', () => memory('MS')], ['1', '', () => digit('1')], ['2', '', () => digit('2'), !okDigit('2')], ['3', '', () => digit('3'), !okDigit('3')], ['-', 'op', () => op('-')]],
        [['Mod', 'fn', () => op('mod')], ['Int', 'fn', () => unary('int', 'int')], ['|x|', 'fn', () => unary('abs', 'abs')], ['1/x', 'fn', () => unary('recip', 'reciproc'), !dec], ['e', 'fn', () => unary('e', 'e'), !dec], ['M+', 'mem', () => memory('M+')], ['0', '', () => digit('0')], ['+/-', 'fn', () => unary('neg', 'negate')], ['.', '', () => digit('.'), !dec], ['+', 'op', () => op('+')]],
        [['A', '', () => digit('A'), !okDigit('A')], ['B', '', () => digit('B'), !okDigit('B')], ['C', '', () => digit('C'), !okDigit('C')], ['D', '', () => digit('D'), !okDigit('D')], ['E', '', () => digit('E'), !okDigit('E')], ['F', '', () => digit('F'), !okDigit('F')], ['Back', 'ctl', backspace], ['CE', 'ctl', clearEntry], ['C', 'ctl', clearAll], ['=', 'op', equals]]
      ];
      for (const r of rows) for (const [l, c, a, dis] of r) K(l, c, a, dis);
    } else {
      keysBox.style.gridTemplateColumns = '42px 10px repeat(5, 42px)';
      const ctl = h('div', { style: { gridColumn: '3 / span 5', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px' } });
      for (const [l, a] of [['Back', backspace], ['CE', clearEntry], ['C', clearAll]]) { const b = h('button', { class: 'btn ctl', type: 'button', text: l }); b.addEventListener('click', a); ctl.append(b); }
      keysBox.append(h('span'), h('span'), ctl);
      const rows = [
        [['MC', 'mem', () => memory('MC')], ['7'], ['8'], ['9'], ['/', 'op', () => op('÷')], ['sqrt', 'fn', () => unary('sqrt', 'sqrt')]],
        [['MR', 'mem', () => memory('MR')], ['4'], ['5'], ['6'], ['*', 'op', () => op('×')], ['%', 'fn', () => unary('pct', 'pct')]],
        [['MS', 'mem', () => memory('MS')], ['1'], ['2'], ['3'], ['-', 'op', () => op('-')], ['1/x', 'fn', () => unary('recip', 'reciproc')]],
        [['M+', 'mem', () => memory('M+')], ['0'], ['+/-', 'fn', () => unary('neg', 'negate')], ['.'], ['+', 'op', () => op('+')], ['=', 'op', equals]]
      ];
      for (const r of rows) {
        r.forEach(([l, c, a], i) => { K(l, c, a || (() => digit(l))); if (i === 0) keysBox.append(h('span')); });
      }
    }
  }
  /* ---------- units & power ---------- */
  function unitsPanel() {
    const cat = h('select', { class: 'fld' }, ...Object.keys(UNITS).map(k => h('option', { value: k, text: k })));
    const from = h('select', { class: 'fld' }), to = h('select', { class: 'fld' });
    const inp = h('input', { class: 'fld', type: 'text', value: '1', inputmode: 'decimal' });
    const res = h('div', { class: 'ca-res sunk' });
    const fillUnits = () => { const L = UNITS[cat.value]; from.innerHTML = to.innerHTML = ''; L.forEach(([n], i) => { from.append(h('option', { value: String(i), text: n })); to.append(h('option', { value: String(i), text: n })); }); to.value = String(Math.min(1, L.length - 1)); run(); };
    const run = () => {
      const v = parseFloat(inp.value.replace(/,/g, ''));
      if (!isFinite(v)) { res.textContent = 'Type a number.'; return; }
      const r = convertUnit(cat.value, v, +from.value, +to.value);
      const L = UNITS[cat.value];
      res.textContent = calcFmt(v, true) + ' ' + L[+from.value][0].toLowerCase() + '\n= ' + calcFmt(+r.toPrecision(10), true) + ' ' + L[+to.value][0].toLowerCase();
    };
    cat.addEventListener('change', fillUnits);
    for (const x of [from, to]) x.addEventListener('change', run);
    inp.addEventListener('input', run);
    const swap = h('button', { class: 'btn', type: 'button', text: '⇅ Swap', onclick: () => { const a = from.value; from.value = to.value; to.value = a; run(); } });
    const use = h('button', { class: 'btn', type: 'button', text: 'Use Result', title: 'Send the result to the calculator', onclick: () => { const v = convertUnit(cat.value, parseFloat(inp.value.replace(/,/g, '')), +from.value, +to.value); if (isFinite(v)) { setValue(+v.toPrecision(12)); st.mode = 'standard'; render(); } } });
    setTimeout(fillUnits, 0);
    return h('div', {}, h('div', { class: 'ca-form' }, h('label', { text: 'Category:' }), cat, h('span'), h('label', { text: 'Value:' }), inp, h('span'), h('label', { text: 'From:' }), from, swap, h('label', { text: 'To:' }), to, use), res);
  }
  function powerPanel() {
    const f = (label, id, val, unit) => [h('label', { for: id, text: label }), h('input', { class: 'fld', id, value: val, inputmode: 'decimal' }), h('span', { text: unit })];
    const phase = h('select', { class: 'fld', id: 'cphase' }, h('option', { value: '3', text: 'Three-phase AC' }), h('option', { value: '1', text: 'Single-phase AC' }), h('option', { value: 'dc', text: 'DC' }));
    const out1 = h('div', { class: 'ca-res sunk' }), out2 = h('div', { class: 'ca-res sunk' }), out3 = h('div', { class: 'ca-res sunk' });
    const g1 = h('div', { class: 'ca-form' }, h('label', { text: 'System:' }), phase, h('span'), ...f('Voltage:', 'cv', '480', 'V'), ...f('Current:', 'ci', '', 'A'), ...f('Apparent power:', 'ckva', '500', 'kVA'), ...f('Power factor:', 'cpf', '0.9', ''));
    const g2 = h('div', { class: 'ca-form' }, ...f('Load:', 'bl', '450', 'kW'), ...f('DC bus:', 'bv', '480', 'V dc'), ...f('Battery capacity:', 'bah', '200', 'Ah'), ...f('Rated at:', 'bh', '10', 'hour rate'), ...f('Inverter efficiency:', 'be', '95', '%'), ...f('Peukert exponent:', 'bk', '1.15', ''), ...f('Strings in parallel:', 'bs', '2', ''));
    const g3 = h('div', { class: 'ca-form' }, ...f('Volts:', 'ov', '12', 'V'), ...f('Amps:', 'oi', '', 'A'), ...f('Ohms:', 'or', '4', 'Ω'), ...f('Watts:', 'ow', '', 'W'));
    const val = (root, id) => { const x = parseFloat((root.querySelector('#' + id).value || '').replace(/,/g, '')); return isFinite(x) ? x : null; };
    const runA = () => {
      const V = val(g1, 'cv'), I = val(g1, 'ci'), KVA = val(g1, 'ckva'), PF = val(g1, 'cpf') || 1, ph = phase.value;
      const k = ph === '3' ? Math.sqrt(3) : 1;
      let kva = KVA, amps = I;
      if (V && I != null && I !== 0 && (KVA == null || g1.dataset.last === 'ci')) kva = k * V * I / 1000;
      else if (V && KVA != null) amps = KVA * 1000 / (k * V);
      if (!V || kva == null || amps == null) { out1.textContent = 'Enter the voltage and either the current or the kVA.'; return; }
      const kw = ph === 'dc' ? V * amps / 1000 : kva * PF;
      out1.textContent = (ph === 'dc' ? 'Power  = ' + calcFmt(+kw.toPrecision(5), true) + ' kW' : 'kVA    = ' + calcFmt(+kva.toPrecision(5), true) + '\nkW     = ' + calcFmt(+kw.toPrecision(5), true) + ' (at ' + PF + ' PF)\nkVAR   = ' + calcFmt(+Math.sqrt(Math.max(0, kva * kva - kw * kw)).toPrecision(4), true)) + '\nAmps   = ' + calcFmt(+amps.toPrecision(5), true) + ' A' + (ph === '3' ? ' per phase' : '') + '\n125%   = ' + calcFmt(+(amps * 1.25).toPrecision(4), true) + ' A (continuous-load sizing)';
    };
    const runB = () => {
      const L = val(g2, 'bl'), V = val(g2, 'bv'), Ah = val(g2, 'bah'), H = val(g2, 'bh') || 20, eff = (val(g2, 'be') || 100) / 100, k = val(g2, 'bk') || 1, n = val(g2, 'bs') || 1;
      if (!L || !V || !Ah) { out2.textContent = 'Enter the load, DC voltage and battery capacity.'; return; }
      const I = L * 1000 / eff / V / n;
      const t = H * Math.pow(Ah / (I * H), k);
      const ideal = Ah * n * V * eff / (L * 1000);
      out2.textContent = 'DC current   = ' + calcFmt(+(I * n).toPrecision(4), true) + ' A (' + calcFmt(+I.toPrecision(4), true) + ' A per string)\nRuntime      ≈ ' + (t * 60 >= 1 ? calcFmt(+(t * 60).toFixed(1), true) + ' minutes' : '< 1 minute') + '\nNo Peukert   ≈ ' + calcFmt(+(ideal * 60).toFixed(1), true) + ' minutes\nAt 80% (EOL) ≈ ' + calcFmt(+(t * 60 * 0.8).toFixed(1), true) + ' minutes';
    };
    const runC = () => {
      const V = val(g3, 'ov'), I = val(g3, 'oi'), R = val(g3, 'or'), W = val(g3, 'ow');
      let v = V, i = I, r = R, w = W;
      if (v != null && r) { i = v / r; w = v * i; } else if (v != null && i) { r = v / i; w = v * i; } else if (i != null && r != null) { v = i * r; w = v * i; } else if (w != null && v) { i = w / v; r = v / i; } else if (w != null && i) { v = w / i; r = v / i; } else if (w != null && r) { i = Math.sqrt(w / r); v = i * r; }
      out3.textContent = [v, i, r, w].some(x => x == null || !isFinite(x)) ? 'Enter any two values.' : 'V = ' + calcFmt(+v.toPrecision(5)) + ' V   I = ' + calcFmt(+i.toPrecision(5)) + ' A\nR = ' + calcFmt(+r.toPrecision(5)) + ' Ω   P = ' + calcFmt(+w.toPrecision(5)) + ' W';
    };
    g1.addEventListener('input', e => { if (e.target.id === 'ci' || e.target.id === 'ckva') { g1.dataset.last = e.target.id; if (e.target.id === 'ci') g1.querySelector('#ckva').value = ''; else g1.querySelector('#ci').value = ''; } runA(); });
    phase.addEventListener('change', runA);
    g2.addEventListener('input', runB);
    const order = ['ov', 'or'];
    g3.addEventListener('input', e => {
      // keep the two values typed most recently; the other two are worked out
      const id = e.target.id, i = order.indexOf(id);
      if (i >= 0) order.splice(i, 1);
      if (e.target.value.trim()) order.push(id);
      while (order.length > 2) g3.querySelector('#' + order.shift()).value = '';
      runC();
    });
    setTimeout(() => { runA(); runB(); runC(); }, 0);
    return h('div', {}, h('b', { text: 'Power and current' }), g1, out1,
      h('b', { text: 'Battery runtime', style: { display: 'block', marginTop: '14px' } }), g2, out2,
      h('p', { class: 'ca-hint', text: 'Rough sizing only: runtime uses Peukert\'s law from the rated hour capacity. Check the battery maker\'s discharge tables before you quote it.' }),
      h('b', { text: 'Ohm\'s law', style: { display: 'block', marginTop: '14px' } }), g3, out3);
  }
  /* ---------- layout ---------- */
  const tabsRow = h('div', { class: 'ca-tabs' });
  const body = h('div', { class: 'ca-body' });
  const winEl = h('div', { class: 'ca-win', role: 'application', 'aria-label': 'Calculator' });
  const tapeWin = h('div', { class: 'ca-win ca-tape' });
  const menus = appMenubar(ctx, [
    { label: 'Edit', items: () => [{ label: 'Copy', key: 'Ctrl+C', act: copyValue }, { label: 'Paste', key: 'Ctrl+V', act: pasteValue }, { sep: 1 }, { label: 'Clear Tape', act: () => { st.tape = []; show(); } }] },
    { label: 'View', items: () => [
      { label: 'Standard', radio: () => st.mode === 'standard', act: () => { st.mode = 'standard'; st.base = 10; render(); } },
      { label: 'Scientific', radio: () => st.mode === 'scientific', act: () => { st.mode = 'scientific'; render(); } },
      { label: 'Unit Conversions', radio: () => st.mode === 'units', act: () => { st.mode = 'units'; render(); } },
      { label: 'Power & Batteries', radio: () => st.mode === 'power', act: () => { st.mode = 'power'; render(); } },
      { sep: 1 },
      { label: 'Digit Grouping', check: () => st.group, act: () => { st.group = !st.group; show(); } },
      { label: 'Paper Tape', check: () => st.showTape, act: () => { st.showTape = !st.showTape; tapeWin.hidden = !st.showTape; persist(); } }
    ] },
    { label: 'Help', items: () => [{ label: 'Keyboard Keys', act: () => ctx.msg('info', 'Calculator Keys', '<table><tr><td>0-9 . + - * /</td><td>Numbers and operators</td></tr><tr><td>Enter or =</td><td>Equals</td></tr><tr><td>Backspace</td><td>Delete the last digit</td></tr><tr><td>Esc</td><td>Clear (C)</td></tr><tr><td>Delete</td><td>Clear entry (CE)</td></tr><tr><td>%</td><td>Percent</td></tr><tr><td>R</td><td>1/x</td></tr><tr><td>@</td><td>Square root</td></tr><tr><td>F9</td><td>+/-</td></tr><tr><td>( ) ^</td><td>Scientific: parentheses, power</td></tr><tr><td>Ctrl+C / Ctrl+V</td><td>Copy / paste the number</td></tr></table>') }, { label: 'About Calculator', act: () => ctx.msg('info', 'About Calculator', '<p><b>LANscape Calculator</b> ' + VERSION + '</p><p class="hint">Standard mode works left to right like a desk calculator. Scientific mode follows the order of operations.</p>') }] }
  ]);
  function render() {
    tabsRow.innerHTML = '';
    for (const [k, l] of [['standard', 'Standard'], ['scientific', 'Scientific'], ['units', 'Units'], ['power', 'Power']]) {
      const b = h('button', { type: 'button', class: st.mode === k ? 'on' : '', text: l });
      b.addEventListener('click', () => { st.mode = k; if (k === 'standard') st.base = 10; render(); });
      tabsRow.append(b);
    }
    body.innerHTML = '';
    if (st.mode === 'units') body.append(unitsPanel());
    else if (st.mode === 'power') body.append(powerPanel());
    else { buildKeys(); body.append(disp, sub, h('div', { class: 'ca-row' }, memBox, extraRow), keysBox); }
    persist();
    show();
  }
  function copyValue() { copyText(disp.textContent.replace(/,/g, '')); }
  async function pasteValue() { try { const t = (await navigator.clipboard.readText()).replace(/[,\s$]/g, ''); if (isFinite(parseFloat(t))) { setValue(parseFloat(t)); opPending = false; show(); } } catch (e) { ctx.status('Press Ctrl+V to paste a number.'); } }
  ctx.on(doc, 'paste', e => { if (/^(INPUT|SELECT|TEXTAREA)$/.test((e.target || {}).tagName || '')) return; const t = (e.clipboardData.getData('text/plain') || '').replace(/[,\s$]/g, ''); if (isFinite(parseFloat(t))) { e.preventDefault(); setValue(parseFloat(t)); opPending = false; show(); } });
  ctx.on(doc, 'keydown', e => {
    if (st.mode === 'units' || st.mode === 'power') return;
    if (/^(INPUT|SELECT|TEXTAREA)$/.test((e.target || {}).tagName || '')) return;
    const k = e.key;
    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'c') { e.preventDefault(); copyValue(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const map = { '+': () => op('+'), '-': () => op('-'), '*': () => op('×'), '/': () => op('÷'), '=': equals, Enter: equals, Backspace: backspace, Escape: clearAll, Delete: clearEntry, '%': () => unary('pct', 'pct'), r: () => unary('recip', 'reciproc'), R: () => unary('recip', 'reciproc'), '@': () => unary('sqrt', 'sqrt'), F9: () => unary('neg', 'negate'), '(': () => paren('('), ')': () => paren(')'), '^': () => op('^'), '!': () => unary('fact', 'fact'), ',': () => digit('.') };
    if (/^[0-9.]$/.test(k)) { e.preventDefault(); digit(k); return; }
    if (st.base === 16 && /^[a-fA-F]$/.test(k)) { e.preventDefault(); digit(k.toUpperCase()); return; }
    if (map[k]) { e.preventDefault(); map[k](); }
  });
  tapeWin.append(h('div', { class: 'ca-title', html: I16.print + ' Paper Tape' }), tapePre, h('div', { class: 'tb' }, h('button', { class: 'btn', type: 'button', text: 'Clear', onclick: () => { st.tape = []; show(); } }), h('button', { class: 'btn', type: 'button', text: 'Copy', onclick: () => copyText(st.tape.join('\n')) })));
  tapeWin.hidden = !st.showTape;
  winEl.append(h('div', { class: 'ca-title', html: I16.calc + ' Calculator' }), menus.el, tabsRow, body);
  ctx.root.append(h('div', { class: 'ca-wrap' }, winEl, tapeWin));
  render();
  return { title: 'Calculator' };
}
