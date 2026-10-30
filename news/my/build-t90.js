#!/usr/bin/env node
// Pulls the day list out of Together / 90 (news/lifestyle/together-90/index.html) into news/my/t90.json,
// so My Watch's Together / 90 card can name today's session without loading the whole workbook.
// Run after the workbook changes: node news/my/build-t90.js
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..', '..');
const src = fs.readFileSync(path.join(root, 'news/lifestyle/together-90/index.html'), 'utf8');
const a = src.indexOf('const WEEKS = ['), b = src.indexOf('const DAYS = [].concat(D1, D2, D3);');
if (a < 0 || b < 0) throw new Error('WEEKS/DAYS not found');
const WEEKS = [], D1 = [], D2 = [], D3 = [];
const fn = new Function(src.slice(a, b) + '\nreturn { WEEKS, D1, D2, D3 };');
const r = fn();
const days = [].concat(r.D1, r.D2, r.D3).map((d, i) => {
  const k = String(d.d), lbl = /[a-z]$/i.test(k) ? k : String(Number(k) <= 2 ? Number(k) : Number(k) + 1);
  return { n: i + 1, k, lbl, w: d.w, t: d.t, mode: d.mode || '', why: (d.why || '').replace(/<[^>]+>/g, '') };
});
const out = { v: 1, weeks: r.WEEKS.map(w => ({ n: w.n, t: w.t, d: w.d, heavy: !!w.heavy })), days };
fs.writeFileSync(path.join(__dirname, 't90.json'), JSON.stringify(out));
console.log('wrote news/my/t90.json:', days.length, 'days,', out.weeks.length, 'weeks');
