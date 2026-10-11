// Concatenate the sources into one self-contained HTML file.
// The libraries (pdf.js, its worker, pdf-lib) are embedded gzipped + base64 in inert <script type="text/plain"> tags.
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, 'src');
const head = fs.readFileSync(path.join(src, '00-head.html'), 'utf8');
const seen = new Map(), dups = [], parts = [];
for (const f of fs.readdirSync(src).filter(f => f.endsWith('.js')).sort()) {
  const text = fs.readFileSync(path.join(src, f), 'utf8');
  // two files declaring the same top-level name would silently shadow each other inside one script
  const re = /^(?:async\s+)?(?:function\*?\s+([A-Za-z_$][\w$]*)|(?:const|let|var|class)\s+([A-Za-z_$][\w$]*))/gm;
  let m;
  while ((m = re.exec(text))) {
    const name = m[1] || m[2];
    if (seen.has(name) && seen.get(name) !== f) dups.push(name + ' (' + seen.get(name) + ' and ' + f + ')');
    else seen.set(name, f);
  }
  parts.push('/* ---- ' + f + ' ---- */\n' + text);
}
if (dups.length) { console.error('Declared twice: ' + dups.join(', ')); process.exit(3); }
const js = parts.join('\n');
const bad = js.match(/<\/script/gi);
if (bad) { console.error('Found a literal </script inside the JS (' + bad.length + 'x). Escape it as <\\/script.'); process.exit(1); }
try { new Function(js); } catch (e) { console.error('SYNTAX ERROR:', e.message); process.exit(2); }
const libs = fs.readFileSync(path.join(__dirname, 'libs', 'embedded-libs.html'), 'utf8');
const out = head + '\n' + libs + '<script>\n"use strict";\n(() => {\n' + js + '\n})();\n</script>\n</body>\n</html>\n';
// index.html at the top of the repository is what GitHub Pages serves
const dest = path.join(__dirname, 'index.html');
fs.writeFileSync(dest, out);
console.log('Wrote', dest, (out.length / 1024).toFixed(1) + ' KB');
