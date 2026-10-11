/* ===================================================================
   Extractors: searchable text + metadata for every file kind
   =================================================================== */
const baseMeta = (kind, title, extra) => Object.assign({ kind, title, desc: '', keywords: '', headings: '', body: '', script: '', words: 0, links: [], palette: [], images: 0, forms: 0 }, extra || {});
const wordCount = t => (String(t || '').match(/\S+/g) || []).length;
const folderWords = path => path.split('/').slice(1, -1).join(' ');

/* ---------- plain text families ---------- */
function extractMarkdown(text, name) {
  const lines = String(text).split(/\r?\n/);
  const h = lines.find(l => /^#{1,2}\s+\S/.test(l));
  const first = lines.find(l => l.trim());
  const title = h ? h.replace(/^#+\s*/, '').trim() : first && first.length < 90 ? first.trim() : prettyName(name);
  const body = String(text).replace(/```[^\n]*\n/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\]\([^)]*\)/g, ' ').replace(/[#>*_`~\[\]|]+/g, ' ').replace(/\s+/g, ' ').trim();
  const links = [];
  String(text).replace(/\]\(([^)\s]+)\)/g, (m, u) => { if (links.length < 200) links.push(u); return m; });
  return baseMeta('md', clip(title, 140), { headings: lines.filter(l => /^#{1,4}\s/.test(l)).map(l => l.replace(/^#+\s*/, '')).join(' · ').slice(0, 6000), body: body.slice(0, 80000), desc: clip(firstSentences(body.replace(title, ''), 230), 300), words: wordCount(body), links });
}
function extractCode(text, name) {
  const t = String(text);
  const defs = [];
  t.replace(/\b(?:function|class|def|func|fn|interface|struct|enum|module|sub|procedure)\s+([A-Za-z_$][\w$]*)/g, (m, n) => { if (defs.length < 200) defs.push(n); return m; });
  const comment = (/^\s*(?:\/\/|#|--|;|\/\*+|<!--)\s*(.+)$/m.exec(t) || [])[1] || '';
  const sample = t.slice(0, 60000);
  return baseMeta('code', name, { headings: defs.join(' · '), body: sample.replace(/[{}()[\];,=<>"'`]+/g, ' ').replace(/\s+/g, ' '), desc: clip(comment.replace(/\*\/.*$/, '').trim() || (t.split(/\r?\n/).length + ' lines of ' + (extOf(name) || 'text').toUpperCase()), 220), words: wordCount(sample), lines: t.split('\n').length });
}
function extractRtf(text, name) {
  const plain = rtfToText(String(text));
  const first = plain.split(/\n/).find(l => l.trim()) || '';
  return baseMeta('rtf', first && first.length < 90 ? first.trim() : prettyName(name), { body: plain.replace(/\s+/g, ' ').slice(0, 80000), desc: clip(firstSentences(plain.replace(/\s+/g, ' '), 230), 300), words: wordCount(plain) });
}
function extractCsv(text, name) {
  const rows = parseCSV(String(text).slice(0, 400000), 400);
  const head = rows[0] || [];
  const body = String(text).slice(0, 80000).replace(/[",;\t|]+/g, ' ').replace(/\s+/g, ' ');
  const lineCount = (String(text).match(/\n/g) || []).length;
  return baseMeta('sheet', prettyName(name), { headings: head.join(' · ').slice(0, 3000), body, desc: clip(head.length + ' columns (' + head.slice(0, 6).join(', ') + (head.length > 6 ? '…' : '') + ') · about ' + Math.max(0, lineCount).toLocaleString() + ' rows', 300), words: wordCount(body), rows: lineCount, cols: head.length });
}
function legacyStrings(u8) {
  const out = [];
  let cur = '';
  const push = () => { if (cur.length >= 5 && /[a-z]{3}/i.test(cur)) out.push(cur.trim()); cur = ''; };
  for (let i = 0; i < u8.length && out.length < 20000; i++) { const b = u8[i]; if ((b >= 32 && b < 127) || b === 9) cur += String.fromCharCode(b); else push(); }
  push();
  for (let i = 0; i + 1 < u8.length && out.length < 40000; i += 2) { const b = u8[i], z = u8[i + 1]; if (z === 0 && ((b >= 32 && b < 127) || b === 9 || b === 13)) cur += b === 13 ? '\n' : String.fromCharCode(b); else push(); }
  push();
  return uniq(out).join('\n').slice(0, 120000);
}
function extractLegacy(u8, name) {
  const t = legacyStrings(u8);
  const lines = t.split('\n').filter(l => l.length > 8 && / /.test(l) && !/[\\{}]|Times New Roman|Microsoft|Normal\.dot/.test(l));
  return baseMeta('legacy', prettyName(name), { body: lines.join(' ').slice(0, 80000), desc: clip(lines.slice(0, 3).join(' '), 230) || 'Older Office document', words: wordCount(lines.join(' ')) });
}

/* ---------- Office Open XML ---------- */
async function coreProps(zip) {
  const d = await zip.xml('docProps/core.xml');
  if (!d) return {};
  const g = n => { const e = d.getElementsByTagName(n)[0]; return e ? e.textContent.trim() : ''; };
  return { title: g('dc:title'), subject: g('dc:subject'), creator: g('dc:creator'), keywords: g('cp:keywords'), description: g('dc:description'), modified: g('dcterms:modified') };
}
async function docxText(zip) {
  const d = await zip.xml('word/document.xml');
  if (!d) return { paras: [], heads: [] };
  const styles = await zip.xml('word/styles.xml');
  const sname = new Map();
  if (styles) for (const s of styles.getElementsByTagName('w:style')) { const n = s.getElementsByTagName('w:name')[0]; sname.set(s.getAttribute('w:styleId'), n ? n.getAttribute('w:val') : ''); }
  const paras = [], heads = [];
  for (const p of d.getElementsByTagName('w:p')) {
    let t = '';
    for (const n of p.getElementsByTagName('*')) { if (n.nodeName === 'w:t') t += n.textContent; else if (n.nodeName === 'w:tab') t += ' '; }
    t = t.trim();
    if (!t) continue;
    paras.push(t);
    const ps = p.getElementsByTagName('w:pStyle')[0];
    const st = ps ? (sname.get(ps.getAttribute('w:val')) || ps.getAttribute('w:val')) : '';
    if (/heading|title/i.test(st)) heads.push(t);
  }
  return { paras, heads };
}
async function extractDocx(blob, name) {
  const zip = await zipOpen(blob);
  const cp = await coreProps(zip);
  const { paras, heads } = await docxText(zip);
  const body = paras.join(' ');
  const title = cp.title || heads[0] || (paras[0] && paras[0].length < 100 ? paras[0] : '') || prettyName(name);
  return baseMeta('docx', clip(title, 140), { headings: heads.join(' · ').slice(0, 6000), body: body.slice(0, 80000), desc: clip(cp.description || cp.subject || firstSentences(body.replace(title, ''), 230), 300), keywords: cp.keywords || '', author: cp.creator || '', words: wordCount(body), paras: paras.length });
}
async function xlsxStrings(zip) {
  const out = [];
  const sst = await zip.xml('xl/sharedStrings.xml');
  if (sst) for (const si of sst.getElementsByTagName('si')) { let t = ''; for (const x of si.getElementsByTagName('t')) t += x.textContent; if (t.trim()) out.push(t.trim()); if (out.length > 50000) break; }
  return out;
}
async function xlsxSheetNames(zip) {
  const wb = await zip.xml('xl/workbook.xml');
  return wb ? Array.from(wb.getElementsByTagName('sheet')).map(s => s.getAttribute('name')) : [];
}
async function extractXlsx(blob, name) {
  const zip = await zipOpen(blob);
  const cp = await coreProps(zip);
  const strings = await xlsxStrings(zip);
  const sheets = await xlsxSheetNames(zip);
  const body = strings.join(' ').slice(0, 80000);
  return baseMeta('sheet', clip(cp.title || prettyName(name), 140), { headings: sheets.join(' · '), body, desc: clip((sheets.length + ' sheet' + (sheets.length === 1 ? '' : 's') + ': ' + sheets.slice(0, 5).join(', ')) + (strings.length ? ' · ' + strings.slice(0, 8).join(', ') : ''), 300), keywords: cp.keywords || '', author: cp.creator || '', words: wordCount(body), sheets });
}
async function pptxSlides(zip, withImages) {
  const pres = await zip.xml('ppt/presentation.xml');
  const rels = parseRels(await zip.xml('ppt/_rels/presentation.xml.rels'));
  const ids = pres ? Array.from(pres.getElementsByTagName('p:sldId')).map(s => s.getAttribute('r:id')) : [];
  let paths = ids.map(id => rels.get(id)).filter(Boolean).map(r => resolveZipPath('ppt/presentation.xml', r.target));
  if (!paths.length) paths = Array.from(zip.entries.keys()).filter(k => /^ppt\/slides\/slide\d+\.xml$/.test(k)).sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));
  const slides = [];
  for (const p of paths) {
    const d = await zip.xml(p);
    if (!d) continue;
    let title = '';
    const bodies = [];
    for (const sp of d.getElementsByTagName('p:sp')) {
      const ph = sp.getElementsByTagName('p:ph')[0];
      const type = ph ? ph.getAttribute('type') || 'body' : 'text';
      const paras = Array.from(sp.getElementsByTagName('a:p')).map(ap => Array.from(ap.getElementsByTagName('a:t')).map(t => t.textContent).join('')).filter(s => s.trim());
      if (!paras.length) continue;
      if (!title && (type === 'title' || type === 'ctrTitle')) title = paras.join(' ');
      else bodies.push(...paras);
    }
    let image = null;
    if (withImages) {
      const blip = d.getElementsByTagName('a:blip')[0];
      if (blip) {
        const srels = parseRels(await zip.xml(p.replace(/slides\/(slide\d+\.xml)$/, 'slides/_rels/$1.rels')));
        const r = srels.get(blip.getAttribute('r:embed'));
        if (r) { const ip = resolveZipPath(p, r.target); const b = await zip.bytes(ip); if (b) image = 'data:' + (MIME[extOf(ip)] || 'image/png') + ';base64,' + u8ToBase64(b); }
      }
    }
    const notesP = p.replace(/slides\/slide(\d+)\.xml$/, 'notesSlides/notesSlide$1.xml');
    let notes = '';
    if (zip.has(notesP)) { const nd = await zip.xml(notesP); if (nd) notes = Array.from(nd.getElementsByTagName('a:t')).map(t => t.textContent).join(' ').replace(/^\s*\d+\s*$/, ''); }
    slides.push({ title, bullets: bodies, image, notes });
  }
  return slides;
}
async function extractPptx(blob, name) {
  const zip = await zipOpen(blob);
  const cp = await coreProps(zip);
  const slides = await pptxSlides(zip, false);
  const body = slides.map(s => [s.title, ...s.bullets, s.notes].join(' ')).join(' ');
  return baseMeta('slides', clip(cp.title || (slides[0] && slides[0].title) || prettyName(name), 140), { headings: slides.map(s => s.title).filter(Boolean).join(' · ').slice(0, 6000), body: body.slice(0, 80000), desc: clip(slides.length + ' slides · ' + slides.slice(0, 4).map(s => s.title).filter(Boolean).join(' · '), 300), author: cp.creator || '', words: wordCount(body), slides: slides.length });
}

/* ---------- PDF (quick: title + page count; full text comes from the Spider) ---------- */
function pdfString(s) {
  if (/^<[0-9a-f\s]+>$/i.test(s)) {
    const hex = s.replace(/[<>\s]/g, '');
    const bytes = hex.match(/../g) || [];
    if (/^fe ?ff/i.test(hex)) { let o = ''; for (let i = 2; i + 1 < bytes.length; i += 2) o += String.fromCharCode(parseInt(bytes[i] + bytes[i + 1], 16)); return o; }
    return bytes.map(b => String.fromCharCode(parseInt(b, 16))).join('');
  }
  let t = s.slice(1, -1).replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (m, c) => ({ n: '\n', r: '\r', t: '\t', b: '', f: '', '(': '(', ')': ')', '\\': '\\' }[c] || String.fromCharCode(parseInt(c, 8))));
  if (t.charCodeAt(0) === 0xfe && t.charCodeAt(1) === 0xff) { let o = ''; for (let i = 2; i + 1 < t.length; i += 2) o += String.fromCharCode((t.charCodeAt(i) << 8) | t.charCodeAt(i + 1)); t = o; }
  return t;
}
/** newer PDFs keep their page tree and Info inside compressed object streams; open a few */
async function pdfObjectStreams(file) {
  if (file.size > 30e6) return '';
  const raw = new Uint8Array(await file.arrayBuffer()), s = latin1(raw);
  const out = [];
  const re = /\/Type\s*\/ObjStm\b/g;
  let m, total = 0;
  while ((m = re.exec(s)) && out.length < 60 && total < 4e6) {
    const dictStart = s.lastIndexOf('<<', m.index), st = s.indexOf('stream', m.index);
    if (dictStart < 0 || st < 0) continue;
    const dict = s.slice(dictStart, st);
    if (!/FlateDecode/.test(dict) || /DecodeParms/.test(dict)) continue;
    let p = st + 6;
    if (s[p] === '\r') p++;
    if (s[p] === '\n') p++;
    const lm = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(dict);
    let end = lm ? p + +lm[1] : s.indexOf('endstream', p);
    if (!lm) while (end > p && (s[end - 1] === '\n' || s[end - 1] === '\r')) end--;
    if (end <= p) continue;
    try { const u = await streamBytes(raw.subarray(p, end), new DecompressionStream('deflate')); total += u.length; out.push(latin1(u)); } catch (e) { /* damaged stream */ }
  }
  return out.join('\n');
}
async function extractPdfQuick(file, name) {
  const size = file.size;
  const head = latin1(new Uint8Array(await file.slice(0, Math.min(size, 200000)).arrayBuffer()));
  const tail = size > 200000 ? latin1(new Uint8Array(await file.slice(Math.max(0, size - 200000)).arrayBuffer())) : '';
  let hay = head + '\n' + tail;
  if (!/\/Type\s*\/Pages\b/.test(hay) && /\/ObjStm\b/.test(hay)) hay += '\n' + await pdfObjectStreams(file);
  const tm = /\/Title\s*(\((?:\\.|[^\\)])*\)|<[0-9A-Fa-f\s]+>)/.exec(hay);
  let title = tm ? pdfString(tm[1]).replace(/[\u0000-\u001f]/g, '').trim() : '';
  if (/^(untitled|microsoft word|document\d*|\.)/i.test(title) || title.length < 3 || /\.(docx?|pdf)$/i.test(title)) title = '';
  const sm = /\/Subject\s*(\((?:\\.|[^\\)])*\)|<[0-9A-Fa-f\s]+>)/.exec(hay);
  const am = /\/Author\s*(\((?:\\.|[^\\)])*\)|<[0-9A-Fa-f\s]+>)/.exec(hay);
  const counts = [];
  hay.replace(/\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)/g, (m, c) => { counts.push(+c); return m; });
  hay.replace(/\/Count\s+(\d+)[^>]*?\/Type\s*\/Pages\b/g, (m, c) => { counts.push(+c); return m; });
  const pages = counts.length ? Math.max(...counts) : 0;
  return baseMeta('pdf', clip(title || prettyName(name), 140), { desc: (sm ? pdfString(sm[1]) + ' · ' : '') + (pages ? pages + ' page' + (pages === 1 ? '' : 's') : 'PDF document'), author: am ? pdfString(am[1]) : '', pages });
}

/* ---------- audio tags ---------- */
const ID3_GENRES = 'Blues,Classic Rock,Country,Dance,Disco,Funk,Grunge,Hip-Hop,Jazz,Metal,New Age,Oldies,Other,Pop,R&B,Rap,Reggae,Rock,Techno,Industrial,Alternative,Ska,Death Metal,Pranks,Soundtrack,Euro-Techno,Ambient,Trip-Hop,Vocal,Jazz+Funk,Fusion,Trance,Classical,Instrumental,Acid,House,Game,Sound Clip,Gospel,Noise,AlternRock,Bass,Soul,Punk,Space,Meditative,Instrumental Pop,Instrumental Rock,Ethnic,Gothic,Darkwave,Techno-Industrial,Electronic,Pop-Folk,Eurodance,Dream,Southern Rock,Comedy,Cult,Gangsta,Top 40,Christian Rap,Pop/Funk,Jungle,Native American,Cabaret,New Wave,Psychadelic,Rave,Showtunes,Trailer,Lo-Fi,Tribal,Acid Punk,Acid Jazz,Polka,Retro,Musical,Rock & Roll,Hard Rock'.split(',');
const synchsafe = (u, i) => ((u[i] & 127) << 21) | ((u[i + 1] & 127) << 14) | ((u[i + 2] & 127) << 7) | (u[i + 3] & 127);
const u32be = (u, i) => ((u[i] << 24) >>> 0) + (u[i + 1] << 16) + (u[i + 2] << 8) + u[i + 3];
const u32le = (u, i) => u[i] + (u[i + 1] << 8) + (u[i + 2] << 16) + ((u[i + 3] << 24) >>> 0);
const ascii = (u, i, n) => String.fromCharCode.apply(null, u.subarray(i, i + n));
function decodeEnc(bytes, enc) {
  let s;
  if (enc === 0) s = latin1(bytes);
  else if (enc === 3) s = UTF8.decode(bytes);
  else {
    let le = enc === 1, start = 0;
    if (bytes[0] === 0xff && bytes[1] === 0xfe) { le = true; start = 2; } else if (bytes[0] === 0xfe && bytes[1] === 0xff) { le = false; start = 2; } else if (enc === 2) le = false;
    s = '';
    for (let i = start; i + 1 < bytes.length; i += 2) s += String.fromCharCode(le ? bytes[i] | (bytes[i + 1] << 8) : (bytes[i] << 8) | bytes[i + 1]);
  }
  return s.replace(/\u0000+$/, '').split('\u0000')[0].trim();
}
function parseID3v2(u) {
  if (u.length < 10 || u[0] !== 0x49 || u[1] !== 0x44 || u[2] !== 0x33) return null;
  const ver = u[3], flags = u[5], size = synchsafe(u, 6), end = Math.min(u.length, 10 + size);
  let p = 10;
  if (flags & 0x40) p += ver === 4 ? synchsafe(u, 10) : u32be(u, 10) + 4;
  const V22 = { TT2: 'TIT2', TP1: 'TPE1', TP2: 'TPE2', TAL: 'TALB', TCO: 'TCON', TRK: 'TRCK', TYE: 'TYER', TPA: 'TPOS', PIC: 'APIC', COM: 'COMM' };
  const tags = {};
  while (p + (ver === 2 ? 6 : 10) <= end) {
    let id, fsize, hdr;
    if (ver === 2) { id = ascii(u, p, 3); fsize = (u[p + 3] << 16) | (u[p + 4] << 8) | u[p + 5]; hdr = 6; id = V22[id] || id; }
    else { id = ascii(u, p, 4); fsize = ver === 4 ? synchsafe(u, p + 4) : u32be(u, p + 4); hdr = 10; }
    if (!/^[A-Z0-9]{3,4}$/.test(id) || fsize <= 0 || p + hdr + fsize > end + 1) break;
    const data = u.subarray(p + hdr, p + hdr + fsize);
    if (id[0] === 'T' && id !== 'TXXX') { if (!tags[id]) tags[id] = decodeEnc(data.subarray(1), data[0]); }
    else if (id === 'APIC' && !tags.APIC) {
      const enc = data[0];
      let i = 1, mime;
      if (ver === 2) { mime = 'image/' + ascii(data, 1, 3).toLowerCase().replace('jpg', 'jpeg'); i = 4; }
      else { const z = data.indexOf(0, 1); mime = latin1(data.subarray(1, z)) || 'image/jpeg'; i = z + 1; }
      i += 1;
      if (enc === 1 || enc === 2) { while (i + 1 < data.length && !(data[i] === 0 && data[i + 1] === 0)) i += 2; i += 2; }
      else { while (i < data.length && data[i] !== 0) i++; i += 1; }
      if (!/^image\//.test(mime)) mime = 'image/' + (mime.toLowerCase().includes('png') ? 'png' : 'jpeg');
      tags.APIC = { mime, bytes: data.slice(i) };
    }
    p += hdr + fsize;
  }
  return { tags, size: 10 + size + (flags & 0x10 ? 10 : 0) };
}
function parseID3v1(t) {
  if (!t || t.length < 128 || ascii(t, 0, 3) !== 'TAG') return null;
  const s = (i, n) => latin1(t.subarray(i, i + n)).replace(/\u0000.*$/, '').trim();
  return { title: s(3, 30), artist: s(33, 30), album: s(63, 30), year: s(93, 4), track: t[125] === 0 && t[126] ? t[126] : 0, genre: ID3_GENRES[t[127]] || '' };
}
function mp3Info(u, fileSize, audioStart) {
  for (let i = 0; i < Math.min(u.length - 4, 65536); i++) {
    if (u[i] !== 0xff || (u[i + 1] & 0xe0) !== 0xe0) continue;
    const vb = (u[i + 1] >> 3) & 3, lb = (u[i + 1] >> 1) & 3, bi = u[i + 2] >> 4, si = (u[i + 2] >> 2) & 3, cm = u[i + 3] >> 6;
    if (vb === 1 || lb !== 1 || bi === 0 || bi === 15 || si === 3) continue;
    const v1 = vb === 3;
    const br = (v1 ? [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320] : [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160])[bi];
    const sr = (vb === 3 ? [44100, 48000, 32000] : vb === 2 ? [22050, 24000, 16000] : [11025, 12000, 8000])[si];
    const spf = v1 ? 1152 : 576;
    const side = v1 ? (cm === 3 ? 17 : 32) : (cm === 3 ? 9 : 17);
    const x = i + 4 + side;
    let frames = 0;
    const tag = ascii(u, x, 4);
    if ((tag === 'Xing' || tag === 'Info') && (u[x + 7] & 1)) frames = u32be(u, x + 8);
    else if (ascii(u, i + 36, 4) === 'VBRI') frames = u32be(u, i + 36 + 14);
    const duration = frames ? frames * spf / sr : (fileSize - audioStart - i) * 8 / (br * 1000);
    return { duration, bitrate: frames ? Math.round((fileSize - audioStart) * 8 / duration / 1000) : br, sampleRate: sr, channels: cm === 3 ? 1 : 2 };
  }
  return null;
}
async function mp4Tags(file) {
  const size = file.size;
  const head = async (o, n) => new Uint8Array(await file.slice(o, Math.min(size, o + n)).arrayBuffer());
  let off = 0, moov = null;
  for (let guard = 0; off + 8 <= size && guard < 64; guard++) {
    const h = await head(off, 16);
    let bs = u32be(h, 0);
    const type = ascii(h, 4, 4);
    if (bs === 1) bs = u32be(h, 8) * 4294967296 + u32be(h, 12); else if (bs === 0) bs = size - off;
    if (bs < 8) break;
    if (type === 'moov') { moov = await head(off, Math.min(bs, 24e6)); break; }
    off += bs;
  }
  if (!moov) return null;
  const out = {};
  const walk = (u, s, e, depth) => {
    let p = s;
    while (p + 8 <= e && depth < 9) {
      let bs = u32be(u, p);
      const type = ascii(u, p + 4, 4);
      if (bs === 0) bs = e - p;
      if (bs < 8 || p + bs > e) break;
      const body = p + 8;
      if (type === 'mvhd') { const v = u[body]; const ts = v === 1 ? u32be(u, body + 20) : u32be(u, body + 12); const du = v === 1 ? u32be(u, body + 24) * 4294967296 + u32be(u, body + 28) : u32be(u, body + 16); if (ts) out.duration = du / ts; }
      else if (type === 'meta') walk(u, body + 4, p + bs, depth + 1);
      else if (/^(moov|udta|ilst|trak|mdia|minf)$/.test(type)) walk(u, body, p + bs, depth + 1);
      else if (depth >= 3 && u32be(u, body + 4) && ascii(u, body + 4, 4) === 'data') {
        const dtype = u32be(u, body + 8) & 0xffffff, payload = u.subarray(body + 16, p + bs);
        const key = type;
        if (dtype === 1) out[key] = UTF8.decode(payload);
        else if (key === 'covr') out.covr = { mime: dtype === 14 ? 'image/png' : 'image/jpeg', bytes: payload.slice() };
        else if (key === 'trkn' || key === 'disk') out[key] = (payload[2] << 8) | payload[3];
        else if (key === 'gnre') out.gnre = ID3_GENRES[((payload[0] << 8) | payload[1]) - 1] || '';
      }
      p += bs;
    }
  };
  walk(moov, 0, moov.length, 0);
  return out;
}
function vorbisComments(u, p) {
  const out = {};
  const vlen = u32le(u, p); p += 4 + vlen;
  const n = u32le(u, p); p += 4;
  for (let i = 0; i < n && p + 4 <= u.length && i < 300; i++) {
    const len = u32le(u, p); p += 4;
    const s = UTF8.decode(u.subarray(p, p + len)); p += len;
    const eq = s.indexOf('=');
    if (eq > 0) { const k = s.slice(0, eq).toUpperCase(); if (!out[k]) out[k] = s.slice(eq + 1); }
  }
  return out;
}
async function flacTags(file) {
  const u = new Uint8Array(await file.slice(0, Math.min(file.size, 4e6)).arrayBuffer());
  let p = 0;
  if (ascii(u, 0, 3) === 'ID3') p = 10 + synchsafe(u, 6);
  if (ascii(u, p, 4) !== 'fLaC') return null;
  p += 4;
  const out = {};
  for (let guard = 0; p + 4 <= u.length && guard < 64; guard++) {
    const last = u[p] & 0x80, type = u[p] & 0x7f, len = (u[p + 1] << 16) | (u[p + 2] << 8) | u[p + 3];
    const b = p + 4;
    if (type === 0) { const sr = (u[b + 10] << 12) | (u[b + 11] << 4) | (u[b + 12] >> 4); const total = (u[b + 13] & 15) * 4294967296 + u32be(u, b + 14); if (sr) out.duration = total / sr; out.sampleRate = sr; out.channels = ((u[b + 12] >> 1) & 7) + 1; }
    else if (type === 4) Object.assign(out, vorbisComments(u, b));
    else if (type === 6 && !out.picture) { let q = b + 4; const ml = u32be(u, q); q += 4; const mime = latin1(u.subarray(q, q + ml)); q += ml; const dl = u32be(u, q); q += 4 + dl + 16; const pl = u32be(u, q); q += 4; out.picture = { mime: mime || 'image/jpeg', bytes: u.slice(q, q + pl) }; }
    p = b + len;
    if (last) break;
  }
  return out;
}
async function oggTags(file) {
  const u = new Uint8Array(await file.slice(0, Math.min(file.size, 300000)).arrayBuffer());
  const s = latin1(u);
  let rate = 48000, out = null;
  const vi = s.indexOf('\x01vorbis');
  if (vi >= 0) rate = u32le(u, vi + 12) || 44100;
  let ci = s.indexOf('\x03vorbis');
  if (ci >= 0) out = vorbisComments(u, ci + 7);
  else if ((ci = s.indexOf('OpusTags')) >= 0) out = vorbisComments(u, ci + 8);
  out = out || {};
  try {
    const t = new Uint8Array(await file.slice(Math.max(0, file.size - 65536)).arrayBuffer());
    const ts = latin1(t);
    const li = ts.lastIndexOf('OggS');
    if (li >= 0) { const g = u32le(t, li + 6) + u32le(t, li + 10) * 4294967296; if (g > 0) out.duration = g / rate; }
  } catch (e) { /* no duration */ }
  return out;
}
async function wavInfo(file) {
  const u = new Uint8Array(await file.slice(0, Math.min(file.size, 1e6)).arrayBuffer());
  if (ascii(u, 0, 4) !== 'RIFF') return null;
  let p = 12, byteRate = 0, dataSize = 0;
  const out = {};
  while (p + 8 <= u.length) {
    const id = ascii(u, p, 4), len = u32le(u, p + 4);
    if (id === 'fmt ') { out.channels = u[p + 10]; out.sampleRate = u32le(u, p + 12); byteRate = u32le(u, p + 16); }
    else if (id === 'data') { dataSize = len; }
    else if (id === 'LIST' && ascii(u, p + 8, 4) === 'INFO') {
      let q = p + 12;
      while (q + 8 <= p + 8 + len) { const sid = ascii(u, q, 4), sl = u32le(u, q + 4); const v = latin1(u.subarray(q + 8, q + 8 + sl)).replace(/\u0000+$/, ''); if (sid === 'INAM') out.title = v; if (sid === 'IART') out.artist = v; if (sid === 'IPRD') out.album = v; if (sid === 'IGNR') out.genre = v; if (sid === 'ICRD') out.year = v.slice(0, 4); q += 8 + sl + (sl & 1); }
    }
    if (id === 'data') break;
    p += 8 + len + (len & 1);
  }
  if (byteRate) out.duration = (dataSize || file.size - 44) / byteRate;
  return out;
}
const albumKey = (artist, album) => slug((artist || 'unknown') + ' ' + (album || 'unknown'));
async function extractAudio(file, name, path) {
  const ext = extOf(name);
  const t = { title: '', artist: '', album: '', genre: '', year: '', track: 0, duration: 0, bitrate: 0, art: null };
  try {
    if (ext === 'mp3' || ext === 'aac') {
      const headLen = Math.min(file.size, 600000);
      let u = new Uint8Array(await file.slice(0, headLen).arrayBuffer());
      let id3 = parseID3v2(u);
      if (id3 && id3.size > u.length && id3.size < 12e6) { u = new Uint8Array(await file.slice(0, id3.size + 70000).arrayBuffer()); id3 = parseID3v2(u); }
      const start = id3 ? id3.size : 0;
      if (id3) {
        const g = id3.tags;
        t.title = g.TIT2 || ''; t.artist = g.TPE1 || g.TPE2 || ''; t.album = g.TALB || ''; t.year = (g.TYER || g.TDRC || '').slice(0, 4);
        t.track = parseInt(g.TRCK, 10) || 0;
        let gen = g.TCON || '';
        const gm = /^\((\d+)\)(.*)$/.exec(gen) || /^(\d+)$/.exec(gen);
        if (gm) gen = (gm[2] && gm[2].trim()) || ID3_GENRES[+gm[1]] || '';
        t.genre = gen;
        if (g.APIC && g.APIC.bytes.length > 100) t.art = g.APIC;
      }
      const info = mp3Info(u.subarray(start), file.size, start);
      if (info) { t.duration = info.duration; t.bitrate = info.bitrate; t.sampleRate = info.sampleRate; t.channels = info.channels; }
      if (!t.title && file.size > 128) {
        const v1 = parseID3v1(new Uint8Array(await file.slice(file.size - 128).arrayBuffer()));
        if (v1) { t.title = v1.title; t.artist = t.artist || v1.artist; t.album = t.album || v1.album; t.year = t.year || v1.year; t.genre = t.genre || v1.genre; t.track = t.track || v1.track; }
      }
    } else if (ext === 'm4a' || ext === 'mp4' || ext === 'm4b') {
      const m = await mp4Tags(file);
      if (m) { t.title = m['©nam'] || ''; t.artist = m['©ART'] || m.aART || ''; t.album = m['©alb'] || ''; t.genre = m['©gen'] || m.gnre || ''; t.year = (m['©day'] || '').slice(0, 4); t.track = m.trkn || 0; t.duration = m.duration || 0; if (m.covr) t.art = m.covr; }
    } else if (ext === 'flac') {
      const m = await flacTags(file);
      if (m) { t.title = m.TITLE || ''; t.artist = m.ARTIST || m.ALBUMARTIST || ''; t.album = m.ALBUM || ''; t.genre = m.GENRE || ''; t.year = (m.DATE || '').slice(0, 4); t.track = parseInt(m.TRACKNUMBER, 10) || 0; t.duration = m.duration || 0; t.sampleRate = m.sampleRate; t.channels = m.channels; if (m.picture) t.art = m.picture; }
    } else if (ext === 'ogg' || ext === 'oga' || ext === 'opus') {
      const m = await oggTags(file);
      t.title = m.TITLE || ''; t.artist = m.ARTIST || ''; t.album = m.ALBUM || ''; t.genre = m.GENRE || ''; t.year = (m.DATE || '').slice(0, 4); t.track = parseInt(m.TRACKNUMBER, 10) || 0; t.duration = m.duration || 0;
    } else if (ext === 'mid' || ext === 'midi' || ext === 'kar' || ext === 'rmi') {
      const m = await midiInfo(file);
      if (m) { t.title = m.title || ''; t.duration = m.duration || 0; t.genre = m.karaoke ? 'Karaoke' : 'MIDI'; }
    } else if (ext === 'wav' || ext === 'wave') {
      const m = await wavInfo(file);
      if (m) Object.assign(t, { title: m.title || '', artist: m.artist || '', album: m.album || '', genre: m.genre || '', year: m.year || '', duration: m.duration || 0, sampleRate: m.sampleRate, channels: m.channels });
    }
  } catch (e) { /* fall back to the file name */ }
  // fall back to "Artist - Title" names and Artist/Album folders
  const parts = path.split('/');
  const base = name.replace(/\.[a-z0-9]+$/i, '').replace(/_/g, ' ');
  if (!t.title) {
    const m = /^(?:(\d{1,3})[\s.\-_]+)?(?:(.+?)\s+-\s+)?(.+)$/.exec(base);
    if (m) { t.track = t.track || (+m[1] || 0); if (m[2] && !t.artist) t.artist = m[2].trim(); t.title = m[3].trim(); }
    else t.title = base;
  }
  // Artist/Album/song folders, but not "Music" or "Downloads"
  const GENERIC = /^(my )?(music|mp3s?|audio|songs|tunes|itunes( media| music)?|media|downloads?|desktop|documents|files|misc|other|new folder|unsorted|various)$/i;
  const folder = i => (parts.length - i >= 1 && !GENERIC.test(parts[parts.length - i]) ? parts[parts.length - i] : '');
  if (!t.album) t.album = folder(2);
  if (!t.artist && t.album === parts[parts.length - 2]) t.artist = folder(3);
  t.artist = t.artist || 'Unknown Artist';
  t.album = t.album || 'Unknown Album';
  const desc = [t.artist, t.album].filter(Boolean).join(' — ') + (t.year ? ' (' + t.year + ')' : '') + (t.genre ? ' · ' + t.genre : '');
  const meta = baseMeta('audio', t.title, { desc, keywords: [t.artist, t.album, t.genre, t.year].filter(Boolean).join(', '), headings: folderWords(path), body: [t.title, t.artist, t.album, t.genre].join(' '), artist: t.artist, album: t.album, genre: t.genre, year: t.year, track: t.track, duration: t.duration || 0, bitrate: t.bitrate || 0, sampleRate: t.sampleRate || 0, channels: t.channels || 2, artKey: t.art ? albumKey(t.artist, t.album) : '' });
  return { meta, art: t.art };
}

/* ---------- video, pictures, everything else ---------- */
const RELEASE_TAGS = /\b(2160p|1080p|1080i|720p|480p|4k|uhd|x26[45]|h\.?26[45]|hevc|avc|bluray|blu-ray|brrip|bdrip|webrip|web-dl|webdl|web|hdtv|dvdrip|dvdscr|xvid|divx|aac\d?|ac3|dts|ddp?5\.1|hdr|hdr10|remux|proper|repack|extended|unrated|yify|rarbg|10bit|8bit)\b/i;
function cleanVideoTitle(name) {
  let s = name.replace(/\.[a-z0-9]{2,4}$/i, '');
  const ep = /\b[Ss](\d{1,2})[ ._-]?[Ee](\d{1,3})\b/.exec(s);
  const ym = /(?:^|[\s._(\[-])((?:19|20)\d{2})(?=[\s._)\]-]|$)/.exec(s);
  let cut = s.length;
  if (ep) cut = Math.min(cut, ep.index);
  if (ym && ym.index > 2) cut = Math.min(cut, ym.index);
  const rt = RELEASE_TAGS.exec(s.replace(/[._]/g, ' '));
  if (rt && rt.index > 2) cut = Math.min(cut, rt.index);
  let t = s.slice(0, cut).replace(/\[[^\]]*\]|\{[^}]*\}/g, ' ').replace(/[._]+/g, ' ').replace(/\s+-\s*$/, '').replace(/[(\-\s]+$/, '').replace(/\s+/g, ' ').trim();
  if (!t) t = s.replace(/[._]+/g, ' ').trim();
  if (t === t.toLowerCase() || t === t.toUpperCase()) t = titleCase(t.toLowerCase());
  return { title: t, year: ym ? ym[1] : '', season: ep ? +ep[1] : 0, episode: ep ? +ep[2] : 0 };
}
function extractVideo(name, path, size) {
  const v = cleanVideoTitle(name);
  const folder = path.split('/').slice(-2, -1)[0] || '';
  const label = v.title + (v.season ? ' S' + pad(v.season, 2) + 'E' + pad(v.episode, 2) : '');
  return baseMeta('video', label, { desc: [v.year, folder && folder !== path.split('/')[0] ? folder : '', fmtBytes(size)].filter(Boolean).join(' · '), keywords: [v.year, folder].filter(Boolean).join(', '), headings: folderWords(path), body: [v.title, folder, name.replace(/[._-]+/g, ' ')].join(' '), year: v.year, season: v.season, episode: v.episode, series: v.season ? v.title : '' });
}
function extractImage(name, path, size) {
  return baseMeta('image', prettyName(name), { desc: (extOf(name) || 'image').toUpperCase() + ' picture · ' + fmtBytes(size), headings: folderWords(path), body: prettyName(name) + ' ' + folderWords(path) });
}
async function extractArchive(file, name) {
  try {
    const zip = await zipOpen(file);
    const names = Array.from(zip.entries.keys());
    return baseMeta('archive', prettyName(name), { desc: names.length + ' files: ' + clip(names.filter(n => !n.endsWith('/')).slice(0, 8).map(n => n.split('/').pop()).join(', '), 220), body: names.join(' ').replace(/[\/._-]+/g, ' ').slice(0, 60000), entries: names.length });
  } catch (e) { return baseMeta('archive', prettyName(name), { desc: 'ZIP archive · ' + fmtBytes(file.size) }); }
}
function extractOther(name, path, size, kind) {
  // a page or document that wouldn't open still gets a readable title ("Trip Plan", not "trip_plan.html")
  const k = KINDS[kind] || KINDS.other, title = k.cls === 'page' || k.cls === 'document' ? prettyName(name) : name;
  return baseMeta(kind || 'other', title, { desc: (extOf(name) ? extOf(name).toUpperCase() + ' file' : 'File') + ' · ' + fmtBytes(size), headings: folderWords(path), body: prettyName(name) });
}
