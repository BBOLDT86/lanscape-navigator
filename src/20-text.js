/* ===================================================================
   Text processing: tokenizer, light stemmer, stopwords, HTML extraction
   =================================================================== */
const STOP = new Set((
  // English function words
  'a about above after again against all almost along already also although always am among an and another any anyone anything are around as at away ' +
  'back be became because become been before being below between both but by can cannot could did do does doing done down during each either else ' +
  'enough even ever every few for from further get gets getting go goes going gone got had has have having he her here hers herself him himself his how ' +
  'however i if in into is it its itself just keep last least less let like made make makes many may me might more most much must my myself near need ' +
  'never next no nor not now of off often on once one only onto or other others otherwise our ours ourselves out over own per perhaps please put quite ' +
  'rather really said same see seem seems several shall she should since so some something sometimes still such than that the their theirs them ' +
  'themselves then there therefore these they thing things this those though through thus till to together too toward towards under until up upon us ' +
  'use used uses using very via was way we well were what whatever when where whether which while who whom whose why will with within without would ' +
  'yet you your yours yourself yourselves etc vs ok okay yes yeah also isn aren wasn weren don doesn didn won wouldn couldn shouldn ll ve re ' +
  'll s t d m im ive id youre theyre thats whats lets new old good great best big small many lot lots two three four five first second third ' +
  'dont doesnt didnt cant wont isnt arent wasnt werent wouldnt couldnt shouldnt hasnt havent hadnt youve youll youd theyll theyve weve wed hes shes ' +
  // web / code noise (body text already excludes <script>/<style>, so keep this list to unambiguous code words)
  'http https www html htm php asp aspx js mjs css px em rem vh vw deg ' +
  'function return const var true false null undefined typeof instanceof void async await ' +
  'div span href src img svg xmlns viewbox onclick onchange oninput onload addeventlistener queryselector queryselectorall ' +
  'getelementbyid createelement appendchild innerhtml textcontent classlist dataset setattribute getattribute parentnode foreach ' +
  'findindex indexof tolowercase touppercase tostring parseint parsefloat stringify localstorage getitem setitem settimeout ' +
  'setinterval requestanimationframe prototype constructor rgba rgb hsl hsla calc nbsp amp quot lt gt ' +
  'arial helvetica verdana tahoma georgia courier roboto manrope fraunces monospace sans serif click tap toggle ' +
  'lorem ipsum dolor amet'
).split(/\s+/));

const STEM_CACHE = new Map();
function stem(w) {
  let s = STEM_CACHE.get(w);
  if (s !== undefined) return s;
  s = w;
  if (s.length > 3 && !/\d/.test(s)) {
    if (s.endsWith('ies') && s.length > 4) s = s.slice(0, -3) + 'y';
    else if (s.endsWith('sses')) s = s.slice(0, -2);
    else if (/(ss|sh|ch|x|z)es$/.test(s)) s = s.slice(0, -2);
    else if (s.endsWith('s') && !/(ss|us|is|ous)$/.test(s)) s = s.slice(0, -1);
    if (s.endsWith('ing') && s.length > 6) {
      let t = s.slice(0, -3);
      if (/(.)\1$/.test(t) && !/(ll|ss|zz)$/.test(t)) t = t.slice(0, -1);
      if (t.length >= 4) s = t;
    } else if (s.endsWith('ed') && s.length > 5 && !s.endsWith('eed')) {
      let t = s.slice(0, -2);
      if (/(.)\1$/.test(t) && !/(ll|ss|zz)$/.test(t)) t = t.slice(0, -1);
      if (t.length >= 3) s = t;
    }
    if (s.length > 4 && s.endsWith('e') && !s.endsWith('ee')) s = s.slice(0, -1);
  }
  if (STEM_CACHE.size > 200000) STEM_CACHE.clear();
  STEM_CACHE.set(w, s);
  return s;
}
function normText(t) {
  return String(t || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[’‘`]/g, "'");
}
/** split text into lowercase tokens (surface form, before stemming) */
function tokenize(text) {
  const out = [];
  const m = normText(text).match(/[a-z0-9]+(?:'[a-z]+)?/g);
  if (!m) return out;
  for (let t of m) {
    if (t.includes("'")) { t = t.replace(/'s$/, '').replace(/'/g, ''); }
    const L = t.length;
    if (L < 2 || L > 28) continue;
    if (STOP.has(t)) continue;
    if (/^\d+$/.test(t)) { if (L < 3 || L > 5 || t[0] === '0') continue; }
    else if (/\d/.test(t)) {
      if (L > 9) continue;
      if (/^[0-9a-f]{6}$|^[0-9a-f]{8}$|^[0-9a-f]{3}$/.test(t)) continue; // css hex
      if (/^\d+(px|em|rem|vh|vw|ms|s|pt|deg|fr|x|k|kb|mb)$/.test(t)) continue;
    }
    out.push(t);
  }
  return out;
}

/* ---------- script-literal mining: recover human text from JS-built apps ---------- */
function looksLikeCode(s) {
  if (/=>|function\s*\(|\breturn\b|\bconst\b|\bvar\b|\blet\b|\bnew\s+[A-Z]|\(\)\s*[{;]|[{};]\s*$|^\s*[.#][\w-]+\s*\{/.test(s)) return true;
  if (/^[\w$.-]+$/.test(s)) return true;                                  // single identifier / class
  if (/:\s*[^;]+;/.test(s) && /px|%|#[0-9a-f]{3}|rgb|var\(/i.test(s)) return true; // css
  if (/^(https?:|\/\/|\.{0,2}\/|data:|blob:|mailto:|#)/i.test(s)) return true;      // url
  if (/^[\s\d.,:%$+\-*/()<>=!&|?]+$/.test(s)) return true;
  return false;
}
function scriptStrings(js) {
  if (!js) return '';
  if (js.length > 900000) js = js.slice(0, 900000);
  const out = [];
  let total = 0;
  const push = raw => {
    if (total > 60000) return;
    let s = raw.replace(/\$\{[^}]*\}/g, ' ').replace(/\\[nrt]/g, ' ').replace(/\\(["'`\\])/g, '$1').replace(/\\u[0-9a-f]{4}/gi, ' ');
    if (s.indexOf('<') >= 0) s = s.replace(/<[^>]*>/g, ' ');
    s = s.replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
    if (s.length < 3) return;
    const letters = (s.match(/[A-Za-z]/g) || []).length;
    if (letters < 3 || letters / s.length < 0.5) return;
    if (s.indexOf(' ') < 0) {
      // single word: keep only Capitalized real words (product names, places)
      if (!/^[A-Z][a-z]{3,20}$/.test(s)) return;
    } else if (looksLikeCode(s)) return;
    out.push(s);
    total += s.length + 1;
  };
  const reDQ = /"((?:[^"\\\n]|\\.){3,600})"/g, reSQ = /'((?:[^'\\\n]|\\.){3,600})'/g, reBT = /`((?:[^`\\]|\\.){3,6000})`/g;
  let m;
  while ((m = reBT.exec(js)) && total < 60000) push(m[1]);
  while ((m = reDQ.exec(js)) && total < 60000) push(m[1]);
  while ((m = reSQ.exec(js)) && total < 60000) push(m[1]);
  return out.join(' · ');
}

/* ---------- palette: the page's own colors, used for its 88x31 button ---------- */
function hexToRgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [h * 360, s, l];
}
function paletteFrom(css) {
  if (!css) return [];
  const counts = new Map();
  const re = /#([0-9a-f]{6}|[0-9a-f]{3})\b/gi;
  let m, n = 0;
  while ((m = re.exec(css)) && n < 4000) {
    n++;
    const hex = '#' + (m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1]).toLowerCase();
    counts.set(hex, (counts.get(hex) || 0) + 1);
  }
  const scored = [];
  for (const [hex, c] of counts) {
    const [h, s, l] = rgbToHsl(...hexToRgb(hex));
    if (s < 0.18 || l < 0.12 || l > 0.9) continue;
    scored.push({ hex, c, h, s, l });
  }
  scored.sort((a, b) => b.c - a.c);
  const out = [];
  for (const x of scored) {
    if (out.length >= 3) break;
    if (out.some(o => Math.abs(o.h - x.h) < 18 && Math.abs(o.l - x.l) < .15)) continue;
    out.push(x.hex);
  }
  // remember the page's dominant background too
  const bg = /(?:^|[;{\s])background(?:-color)?\s*:\s*(#[0-9a-f]{3,6})\b/i.exec(css);
  if (bg) out.bg = bg[1];
  return out;
}

/* ---------- full HTML extraction (runs DOMParser; scripts never execute) ---------- */
function collectText(root) {
  const parts = [];
  let total = 0;
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const v = n.nodeValue;
    if (!v || !/\S/.test(v)) continue;
    const p = n.parentNode && n.parentNode.nodeName;
    if (p === 'SCRIPT' || p === 'STYLE' || p === 'NOSCRIPT' || p === 'TEMPLATE') continue;
    parts.push(v);
    total += v.length;
    if (total > 400000) break;
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
function firstSentences(text, n) {
  if (!text) return '';
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  const dot = cut.lastIndexOf('. ');
  return (dot > n * 0.5 ? cut.slice(0, dot + 1) : cut.replace(/\s+\S*$/, '') + '…');
}
function extractHTML(html, name) {
  const meta = { kind: 'html' };
  let doc;
  try { doc = new DOMParser().parseFromString(html, 'text/html'); } catch (e) { doc = null; }
  if (!doc || !doc.documentElement) { meta.title = prettyName(name); meta.body = ''; meta.desc = ''; return meta; }
  const mc = n => {
    const m = doc.querySelector('meta[name="' + n + '" i], meta[property="' + n + '" i]');
    return m ? (m.getAttribute('content') || '').replace(/\s+/g, ' ').trim() : '';
  };
  meta.title = (doc.title || '').replace(/\s+/g, ' ').trim();
  const h1 = doc.querySelector('h1');
  if (!meta.title && h1) meta.title = h1.textContent.replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!meta.title) meta.title = prettyName(name);
  meta.desc = mc('description') || mc('og:description') || mc('twitter:description');
  meta.keywords = mc('keywords');
  meta.author = mc('author');
  meta.pinHost = mc('lanscape:host').toLowerCase();
  meta.pinRing = mc('lanscape:ring');
  meta.headings = $$('h1,h2,h3,h4', doc).slice(0, 120).map(e => e.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' · ').slice(0, 6000);
  const ic = doc.querySelector('link[rel~="icon" i]');
  if (ic) {
    const href = (ic.getAttribute('href') || '').trim();
    if (/^data:image\//i.test(href) && href.length < 60000) meta.favicon = href;
    else if (href && !/^([a-z]+:)?\/\//i.test(href) && !/^data:/i.test(href)) meta.faviconRel = href;
  }
  let js = '', jsonish = '', css = '';
  let scripts = 0, extScripts = 0;
  for (const s of doc.querySelectorAll('script')) {
    scripts++;
    if (s.getAttribute('src')) { extScripts++; continue; }
    const type = (s.getAttribute('type') || '').toLowerCase();
    const txt = s.textContent || '';
    if (/json|text\/plain|markdown|template|x-tmpl/.test(type)) jsonish += ' ' + txt.slice(0, 60000);
    else if (!type || /javascript|ecmascript|module|babel|jsx/.test(type)) js += '\n' + txt;
  }
  for (const st of doc.querySelectorAll('style')) { css += st.textContent.slice(0, 80000); if (css.length > 160000) break; }
  let inl = 0;
  for (const e of doc.querySelectorAll('[style]')) { css += ';' + e.getAttribute('style'); if (++inl > 400) break; }
  meta.palette = paletteFrom(css);
  meta.paletteBg = meta.palette.bg || '';
  const links = [];
  for (const a of doc.querySelectorAll('a[href], area[href]')) { if (links.length >= 400) break; links.push(a.getAttribute('href')); }
  meta.links = links;
  meta.images = doc.images ? doc.images.length : 0;
  meta.forms = doc.forms ? doc.forms.length : 0;
  meta.scripts = scripts; meta.extScripts = extScripts; meta.jsBytes = js.length; meta.cssBytes = css.length;
  meta.canvas = !!doc.querySelector('canvas');
  for (const e of doc.querySelectorAll('script,style,noscript,template,svg,canvas,iframe,object,embed,select')) e.remove();
  const body = doc.body ? collectText(doc.body) : '';
  meta.body = body.slice(0, 80000);
  meta.words = (body.match(/\S+/g) || []).length;
  const mined = scriptStrings(js);
  meta.script = (mined + (jsonish ? ' · ' + jsonish.replace(/[{}\[\]":,]+/g, ' ').replace(/\s+/g, ' ').slice(0, 30000) : '')).slice(0, 70000);
  if (!meta.desc) meta.desc = firstSentences(body, 230) || firstSentences(mined, 200);
  meta.desc = clip(meta.desc, 300);
  meta.lang = doc.documentElement.getAttribute('lang') || '';
  meta.app = meta.jsBytes > 4000 && meta.words < 400; // a script-driven single-file app
  return meta;
}
function extractText(text, name) {
  const t = String(text || '');
  const lines = t.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  let title = lines.length && lines[0].length < 90 ? lines[0].replace(/^#+\s*/, '') : prettyName(name);
  const body = t.replace(/\s+/g, ' ').slice(0, 80000);
  return {
    kind: 'text', title, desc: clip(firstSentences(lines.slice(1).join(' ') || body, 220), 300), keywords: '', headings: lines.filter(l => /^#{1,3}\s/.test(l)).join(' · ').replace(/#/g, '').slice(0, 4000),
    body, script: '', words: (body.match(/\S+/g) || []).length, links: [], palette: [], images: 0, forms: 0
  };
}
function extractBinary(name, kind) {
  return { kind, title: prettyName(name), desc: (kind === 'pdf' ? 'PDF document' : 'Image') + ' — ' + name, keywords: '', headings: '', body: '', script: '', words: 0, links: [], palette: [], images: 0, forms: 0 };
}
