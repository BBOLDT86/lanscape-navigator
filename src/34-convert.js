/* ===================================================================
   Converters: CSV · RTF · Markdown · DOCX  (to and from editor HTML)
   =================================================================== */

/* ---------------- CSV ---------------- */
function sniffDelim(sample) {
  const lines = sample.split(/\r?\n/).slice(0, 12).filter(Boolean);
  let best = ',', bestScore = -1;
  for (const d of [',', '\t', ';', '|']) {
    const counts = lines.map(l => l.split(d).length - 1);
    if (!counts.length || !counts[0]) continue;
    const same = counts.filter(c => c === counts[0]).length;
    const score = same * 10 + counts[0];
    if (score > bestScore) { bestScore = score; best = d; }
  }
  return best;
}
function parseCSV(text, maxRows = Infinity, delim) {
  text = String(text).replace(/^\uFEFF/, '');
  delim = delim || sniffDelim(text.slice(0, 20000));
  const rows = [];
  let row = [], field = '', q = false, i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i += 2; continue; } q = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"' && field === '') { q = true; i++; continue; }
    if (c === delim) { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; if (rows.length >= maxRows) return rows; continue; }
    field += c; i++;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}
function toCSV(rows, delim = ',') {
  const q = v => { const s = v == null ? '' : String(v); return /["\r\n]|^\s|\s$/.test(s) || s.includes(delim) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return rows.map(r => r.map(q).join(delim)).join('\r\n') + '\r\n';
}

/* ---------------- RTF ---------------- */
const CP1252 = (() => { try { return new TextDecoder('windows-1252'); } catch (e) { return null; } })();
function rtfParse(rtf, onText, onCtrl) {
  // minimal RTF tokenizer: groups, control words, hex escapes, \uN unicode
  const SKIP = new Set(['fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'header', 'footer', 'headerl', 'headerr', 'headerf', 'footerl', 'footerr', 'footerf', 'object', 'xmlnstbl', 'listtable', 'listoverridetable', 'rsidtbl', 'generator', 'themedata', 'colorschememapping', 'datastore', 'latentstyles', 'fldinst', 'pgdsctbl', 'mmathPr', 'nonshppict', 'bkmkstart', 'bkmkend', 'xe', 'tc', 'filetbl', 'revtbl', 'userprops', 'docvar', 'wgrffmtfilter', 'pnseclvl']);
  const stack = [];
  let st = { skip: false, uc: 1, dest: '' };
  let i = 0, skipChars = 0;
  const colors = [];
  let curColor = [0, 0, 0], inColortbl = false;
  while (i < rtf.length) {
    const c = rtf[i];
    if (c === '{') { stack.push(st); st = Object.assign({}, st, { dest: '', first: true }); i++; continue; }
    if (c === '}') { if (st.dest === 'colortbl') inColortbl = false; st = stack.pop() || st; i++; continue; }
    if (c === '\\') {
      const n = rtf[i + 1];
      if (/[a-zA-Z]/.test(n)) {
        const m = /^\\([a-zA-Z]+)(-?\d+)? ?/.exec(rtf.slice(i, i + 40));
        const word = m[1], param = m[2] != null ? parseInt(m[2], 10) : null;
        i += m[0].length;
        if (st.first) { st.first = false; if (SKIP.has(word) || st.star) { st.skip = true; st.dest = word; if (word === 'colortbl') { st.skip = true; inColortbl = true; } continue; } }
        if (inColortbl) { if (word === 'red') curColor[0] = param; else if (word === 'green') curColor[1] = param; else if (word === 'blue') curColor[2] = param; continue; }
        if (st.skip) continue;
        if (word === 'uc') { st.uc = param == null ? 1 : param; continue; }
        if (word === 'u') { let cp = param; if (cp < 0) cp += 65536; onText(String.fromCharCode(cp), st); skipChars = st.uc; continue; }
        onCtrl(word, param, st, colors);
        continue;
      }
      if (n === '*') { st.star = true; if (st.first) { st.skip = true; } i += 2; continue; }
      if (n === "'") {
        const hex = parseInt(rtf.substr(i + 2, 2), 16);
        i += 4;
        if (inColortbl || st.skip) continue;
        if (skipChars > 0) { skipChars--; continue; }
        onText(CP1252 ? CP1252.decode(new Uint8Array([hex])) : String.fromCharCode(hex), st);
        continue;
      }
      if (n === '\n' || n === '\r') { i += 2; if (!st.skip) onCtrl('par', null, st, colors); continue; }
      if (n === '~') { i += 2; if (!st.skip) onText('\u00a0', st); continue; }
      if (n === '-' || n === '_') { i += 2; continue; }
      i += 2;
      if (!st.skip) onText(n, st);
      continue;
    }
    if (c === '\r' || c === '\n') { i++; continue; }
    if (inColortbl) { if (c === ';') { colors.push('#' + curColor.map(v => (v || 0).toString(16).padStart(2, '0')).join('')); curColor = [0, 0, 0]; } i++; continue; }
    st.first = false;
    if (st.skip) { i++; continue; }
    if (skipChars > 0) { skipChars--; i++; continue; }
    let j = i;
    while (j < rtf.length && !/[{}\\\r\n]/.test(rtf[j])) j++;
    onText(rtf.slice(i, j), st);
    i = j;
  }
}
function rtfToText(rtf) {
  let out = '';
  rtfParse(rtf, t => { out += t; }, w => { if (w === 'par' || w === 'line' || w === 'page' || w === 'row') out += '\n'; else if (w === 'tab' || w === 'cell') out += '\t'; });
  return out;
}
function rtfToHtml(rtf) {
  const paras = [];
  let cur = { align: '', runs: [] };
  rtfParse(rtf, (t, st) => {
    const f = st.fmt || {};
    const last = cur.runs[cur.runs.length - 1];
    const key = JSON.stringify(f);
    if (last && last.key === key) last.text += t; else cur.runs.push({ key, f: Object.assign({}, f), text: t });
  }, (w, p, st, colors) => {
    st.fmt = Object.assign({}, st.fmt || {});
    const on = p == null || p !== 0;
    switch (w) {
      case 'par': case 'sect': paras.push(cur); cur = { align: cur.align, runs: [] }; break;
      case 'page': paras.push(cur); paras.push({ pageBreak: true, runs: [] }); cur = { align: cur.align, runs: [] }; break;
      case 'line': cur.runs.push({ key: 'br', br: true, text: '' }); break;
      case 'tab': cur.runs.push({ key: 'tab', f: st.fmt, text: '\u2003' }); break;
      case 'pard': cur.align = ''; break;
      case 'qc': cur.align = 'center'; break;
      case 'qr': cur.align = 'right'; break;
      case 'qj': cur.align = 'justify'; break;
      case 'ql': cur.align = ''; break;
      case 'plain': st.fmt = {}; break;
      case 'b': st.fmt.b = on; break;
      case 'i': st.fmt.i = on; break;
      case 'ul': st.fmt.u = on; break;
      case 'ulnone': st.fmt.u = false; break;
      case 'strike': st.fmt.s = on; break;
      case 'super': st.fmt.sup = true; break;
      case 'sub': st.fmt.sub = true; break;
      case 'nosupersub': st.fmt.sup = st.fmt.sub = false; break;
      case 'fs': st.fmt.pt = p ? p / 2 : null; break;
      case 'cf': st.fmt.color = p && colors[p] ? colors[p] : null; break;
      case 'highlight': case 'cb': st.fmt.bg = p && colors[p] ? colors[p] : null; break;
      case 'bullet': cur.runs.push({ key: 'txt', f: st.fmt, text: '•' }); break;
      case 'emdash': cur.runs.push({ key: 'txt', f: st.fmt, text: '—' }); break;
      case 'endash': cur.runs.push({ key: 'txt', f: st.fmt, text: '–' }); break;
      case 'lquote': cur.runs.push({ key: 'txt', f: st.fmt, text: '‘' }); break;
      case 'rquote': cur.runs.push({ key: 'txt', f: st.fmt, text: '’' }); break;
      case 'ldblquote': cur.runs.push({ key: 'txt', f: st.fmt, text: '“' }); break;
      case 'rdblquote': cur.runs.push({ key: 'txt', f: st.fmt, text: '”' }); break;
      default: break;
    }
  });
  if (cur.runs.length) paras.push(cur);
  return paras.map(p => {
    if (p.pageBreak) return '<hr class="pagebreak">';
    const inner = p.runs.map(r => {
      if (r.br) return '<br>';
      let h = esc(r.text);
      const f = r.f || {};
      const css = [];
      if (f.color) css.push('color:' + f.color);
      if (f.bg) css.push('background-color:' + f.bg);
      if (f.pt) css.push('font-size:' + f.pt + 'pt');
      if (css.length) h = '<span style="' + css.join(';') + '">' + h + '</span>';
      if (f.sup) h = '<sup>' + h + '</sup>';
      if (f.sub) h = '<sub>' + h + '</sub>';
      if (f.s) h = '<s>' + h + '</s>';
      if (f.u) h = '<u>' + h + '</u>';
      if (f.i) h = '<i>' + h + '</i>';
      if (f.b) h = '<b>' + h + '</b>';
      return h;
    }).join('');
    return '<p' + (p.align ? ' style="text-align:' + p.align + '"' : '') + '>' + (inner || '<br>') + '</p>';
  }).join('\n');
}
function htmlToRtf(root) {
  const colors = ['#000000'];
  const colorIdx = c => { const hex = cssColorHex(c); if (!hex) return 0; let i = colors.indexOf(hex); if (i < 0) { colors.push(hex); i = colors.length - 1; } return i + 1; };
  const escT = s => s.replace(/[\\{}]/g, m => '\\' + m).replace(/[^\x00-\x7f]/g, ch => '\\u' + (ch.charCodeAt(0) > 32767 ? ch.charCodeAt(0) - 65536 : ch.charCodeAt(0)) + '?').replace(/\n/g, '\\line ');
  let out = '';
  const inline = (n, fmt) => {
    for (const c of n.childNodes) {
      if (c.nodeType === 3) { if (c.nodeValue) out += '{' + fmt + ' ' + escT(c.nodeValue) + '}'; continue; }
      if (c.nodeType !== 1) continue;
      const t = c.nodeName;
      if (t === 'BR') { out += '\\line '; continue; }
      let f = fmt;
      if (t === 'B' || t === 'STRONG') f += '\\b';
      if (t === 'I' || t === 'EM') f += '\\i';
      if (t === 'U') f += '\\ul';
      if (t === 'S' || t === 'STRIKE' || t === 'DEL') f += '\\strike';
      if (t === 'SUP') f += '\\super';
      if (t === 'SUB') f += '\\sub';
      const st = c.style || {};
      const col = c.getAttribute('color') || st.color;
      if (col) f += '\\cf' + colorIdx(col);
      if (st.backgroundColor) f += '\\highlight' + colorIdx(st.backgroundColor);
      const pt = cssFontPt(c);
      if (pt) f += '\\fs' + Math.round(pt * 2);
      if (st.fontWeight === 'bold' || +st.fontWeight >= 600) f += '\\b';
      if (st.fontStyle === 'italic') f += '\\i';
      if ((st.textDecoration || st.textDecorationLine || '').includes('underline')) f += '\\ul';
      if (t === 'A') f += '\\ul\\cf' + colorIdx('#0000ff');
      if (t === 'CODE' || t === 'TT' || /mono|courier/i.test(c.getAttribute('face') || st.fontFamily || '')) f += '\\f1';
      inline(c, f);
    }
  };
  const block = (n, listDepth) => {
    for (const c of n.childNodes) {
      if (c.nodeType === 3) { if (c.nodeValue.trim()) { out += '\\pard '; inline({ childNodes: [c] }, ''); out += '\\par\n'; } continue; }
      if (c.nodeType !== 1) continue;
      const t = c.nodeName;
      const align = (c.style && c.style.textAlign) || c.getAttribute('align') || '';
      const q = align === 'center' ? '\\qc' : align === 'right' ? '\\qr' : align === 'justify' ? '\\qj' : '\\ql';
      if (/^H[1-6]$/.test(t)) { out += '\\pard' + q + '\\sb240\\sa120 '; inline(c, '\\b\\fs' + [48, 36, 28, 26, 24, 22][+t[1] - 1]); out += '\\par\n'; }
      else if (t === 'P' || t === 'DIV') { if (c.querySelector && c.querySelector('p,div,h1,h2,h3,ul,ol,table,blockquote,pre')) block(c, listDepth); else { out += '\\pard' + q + '\\sa120 '; inline(c, ''); out += '\\par\n'; } }
      else if (t === 'BLOCKQUOTE') { out += '\\pard\\li720\\ri720\\sa120 '; inline(c, '\\i'); out += '\\par\n'; }
      else if (t === 'PRE') { for (const line of c.textContent.split('\n')) out += '\\pard{\\f1\\fs20 ' + escT(line) + '}\\par\n'; }
      else if (t === 'UL' || t === 'OL') {
        let k = 1;
        for (const li of kids(c, 'LI')) {
          out += '\\pard\\li' + (360 * (listDepth + 1) + 360) + '\\fi-360 ' + (t === 'OL' ? (k++) + '.' : '\\bullet') + '\\tab ';
          const nested = Array.from(li.children).filter(x => x.nodeName === 'UL' || x.nodeName === 'OL');
          const clone = li.cloneNode(true);
          clone.querySelectorAll('ul,ol').forEach(x => x.remove());
          inline(clone, '');
          out += '\\par\n';
          for (const nl of nested) block({ childNodes: [nl] }, listDepth + 1);
        }
      }
      else if (t === 'TABLE') { for (const tr of c.querySelectorAll('tr')) { out += '\\pard '; Array.from(tr.children).forEach((td, j) => { if (j) out += '\\tab '; inline(td, ''); }); out += '\\par\n'; } }
      else if (t === 'HR') out += '\\pard\\brdrb\\brdrs\\brdrw10\\brsp20 \\par\n';
      else if (t === 'IMG') { /* images are not exported to RTF */ }
      else { out += '\\pard' + q + ' '; inline(c, ''); out += '\\par\n'; }
    }
  };
  block(root, 0);
  return '{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0\\froman Times New Roman;}{\\f1\\fmodern Courier New;}{\\f2\\fswiss Arial;}}\n{\\colortbl;' + colors.map(h => '\\red' + parseInt(h.slice(1, 3), 16) + '\\green' + parseInt(h.slice(3, 5), 16) + '\\blue' + parseInt(h.slice(5, 7), 16) + ';').join('') + '}\n\\viewkind4\\uc1\\f0\\fs24\n' + out + '}';
}
function cssColorHex(c) {
  if (!c) return null;
  c = String(c).trim();
  let m = /^#([0-9a-f]{3})$/i.exec(c);
  if (m) return '#' + m[1].split('').map(x => x + x).join('').toLowerCase();
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
  m = /^rgba?\((\d+)\D+(\d+)\D+(\d+)(?:\D+([\d.]+))?/i.exec(c);
  if (m) { if (m[4] != null && +m[4] === 0) return null; return '#' + [m[1], m[2], m[3]].map(v => (+v).toString(16).padStart(2, '0')).join(''); }
  const named = { black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff', yellow: '#ffff00', gray: '#808080', grey: '#808080', navy: '#000080', maroon: '#800000', purple: '#800080', teal: '#008080', olive: '#808000', orange: '#ffa500', silver: '#c0c0c0', lime: '#00ff00', aqua: '#00ffff', fuchsia: '#ff00ff' };
  return named[c.toLowerCase()] || null;
}
const FONT_SIZE_PT = [0, 8, 10, 12, 14, 18, 24, 36];
function cssFontPt(el) {
  if (!el || el.nodeType !== 1) return null;
  const sz = el.getAttribute && el.getAttribute('size');
  if (el.nodeName === 'FONT' && sz) return FONT_SIZE_PT[clamp(+sz, 1, 7)] || null;
  const fs = el.style && el.style.fontSize;
  if (!fs) return null;
  const m = /([\d.]+)(px|pt|em|rem)?/.exec(fs);
  if (!m) return { 'x-small': 8, small: 10, medium: 12, large: 14, 'x-large': 18, 'xx-large': 24 }[fs] || null;
  const v = +m[1];
  return m[2] === 'px' ? v * 0.75 : m[2] === 'em' || m[2] === 'rem' ? v * 12 : v;
}

/* ---------------- Markdown ---------------- */
function mdInline(s) {
  let h = esc(s);
  const codes = [];
  h = h.replace(/`([^`]+)`/g, (m, c) => { codes.push('<code>' + c + '</code>'); return '\u0000' + (codes.length - 1) + '\u0000'; });
  h = h.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, '<img alt="$1" src="$2">');
  h = h.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, '<a href="$2">$1</a>');
  h = h.replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, '<a href="$1">$1</a>');
  h = h.replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '<b>$2</b>');
  h = h.replace(/(\*|_)(?=\S)([\s\S]*?\S)\1/g, (m, d, t) => (d === '_' && /\w_\w/.test(m) ? m : '<i>' + t + '</i>'));
  h = h.replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<s>$1</s>');
  h = h.replace(/\u0000(\d+)\u0000/g, (m, i) => codes[+i]);
  return h;
}
function mdToHtml(md) {
  const lines = String(md).replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;
  const isBlank = l => !l.trim();
  const listRe = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
  while (i < lines.length) {
    const l = lines[i];
    if (isBlank(l)) { i++; continue; }
    let m;
    if ((m = /^\s*(```|~~~)\s*(\S*)/.exec(l))) {
      const fence = m[1], code = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence)) code.push(lines[i++]);
      i++;
      out.push('<pre><code>' + esc(code.join('\n')) + '</code></pre>');
      continue;
    }
    if ((m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(l))) { out.push('<h' + m[1].length + '>' + mdInline(m[2]) + '</h' + m[1].length + '>'); i++; continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
    if (/^\s*>/.test(l)) {
      const q = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, ''));
      out.push('<blockquote>' + mdToHtml(q.join('\n')) + '</blockquote>');
      continue;
    }
    if (/\|/.test(l) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
      const cells = s => s.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const head = cells(l);
      i += 2;
      const body = [];
      while (i < lines.length && /\|/.test(lines[i]) && !isBlank(lines[i])) body.push(cells(lines[i++]));
      out.push('<table border="1" cellpadding="4"><tr>' + head.map(h => '<th>' + mdInline(h) + '</th>').join('') + '</tr>' + body.map(r => '<tr>' + r.map(c => '<td>' + mdInline(c) + '</td>').join('') + '</tr>').join('') + '</table>');
      continue;
    }
    if (listRe.test(l)) {
      const items = [];
      while (i < lines.length && (listRe.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && items.length))) {
        const mm = listRe.exec(lines[i]);
        if (mm) items.push({ indent: mm[1].replace(/\t/g, '    ').length, ordered: /\d/.test(mm[2]), text: mm[3] });
        else items[items.length - 1].text += ' ' + lines[i].trim();
        i++;
      }
      const build = (start, indent) => {
        let html = '', j = start;
        const ordered = items[start].ordered;
        html += ordered ? '<ol>' : '<ul>';
        while (j < items.length && items[j].indent >= indent) {
          if (items[j].indent > indent) { const r = build(j, items[j].indent); html = html.replace(/<\/li>$/, '') + r.html + '</li>'; j = r.next; continue; }
          const t = items[j].text.replace(/^\[( |x)\]\s*/i, (mm, c) => (c.trim() ? '☑ ' : '☐ '));
          html += '<li>' + mdInline(t) + '</li>';
          j++;
        }
        html += ordered ? '</ol>' : '</ul>';
        return { html, next: j };
      };
      let j = 0;
      while (j < items.length) { const r = build(j, items[j].indent); out.push(r.html); j = r.next; }
      continue;
    }
    const para = [];
    while (i < lines.length && !isBlank(lines[i]) && !/^(#{1,6}\s|\s*```|\s*>|\s*([-*_])(\s*\2){2,}\s*$)/.test(lines[i]) && !listRe.test(lines[i])) para.push(lines[i++]);
    if (!para.length) { out.push('<p>' + mdInline(lines[i++]) + '</p>'); continue; }
    out.push('<p>' + para.map((p, k) => mdInline(p.replace(/\s+$/, '')) + (k < para.length - 1 ? (/ {2,}$/.test(p) ? '<br>' : ' ') : '')).join('') + '</p>');
  }
  return out.join('\n');
}
function htmlToMd(root) {
  const inline = n => {
    let s = '';
    for (const c of n.childNodes) {
      if (c.nodeType === 3) { s += c.nodeValue.replace(/\s+/g, ' ').replace(/([*_`\[\]])/g, '\\$1'); continue; }
      if (c.nodeType !== 1) continue;
      const t = c.nodeName, inner = inline(c);
      if (t === 'BR') s += '  \n';
      else if (t === 'B' || t === 'STRONG') s += inner.trim() ? '**' + inner.trim() + '**' : '';
      else if (t === 'I' || t === 'EM') s += inner.trim() ? '*' + inner.trim() + '*' : '';
      else if (t === 'S' || t === 'STRIKE' || t === 'DEL') s += '~~' + inner + '~~';
      else if (t === 'CODE' || t === 'TT') s += '`' + c.textContent + '`';
      else if (t === 'A') s += '[' + inner + '](' + (c.getAttribute('href') || '') + ')';
      else if (t === 'IMG') s += '![' + (c.getAttribute('alt') || '') + '](' + (/^data:/.test(c.getAttribute('src') || '') ? 'image' : c.getAttribute('src') || '') + ')';
      else s += inner;
    }
    return s;
  };
  const blocks = (n, depth) => {
    const out = [];
    for (const c of n.childNodes) {
      if (c.nodeType === 3) { if (c.nodeValue.trim()) out.push(c.nodeValue.trim()); continue; }
      if (c.nodeType !== 1) continue;
      const t = c.nodeName;
      if (/^H[1-6]$/.test(t)) out.push('#'.repeat(+t[1]) + ' ' + inline(c).trim());
      else if (t === 'P' || t === 'DIV') { if (c.querySelector('p,div,h1,h2,h3,ul,ol,table,blockquote,pre')) out.push(blocks(c, depth)); else { const s = inline(c).trim(); if (s) out.push(s); } }
      else if (t === 'BLOCKQUOTE') out.push(blocks(c, depth).split('\n').map(x => '> ' + x).join('\n'));
      else if (t === 'PRE') out.push('```\n' + c.textContent.replace(/\n$/, '') + '\n```');
      else if (t === 'HR') out.push('---');
      else if (t === 'UL' || t === 'OL') {
        let k = 1;
        const items = [];
        for (const li of kids(c, 'LI')) {
          const nested = Array.from(li.children).filter(x => x.nodeName === 'UL' || x.nodeName === 'OL');
          const clone = li.cloneNode(true);
          clone.querySelectorAll('ul,ol').forEach(x => x.remove());
          items.push('  '.repeat(depth) + (t === 'OL' ? (k++) + '. ' : '- ') + inline(clone).trim());
          for (const nl of nested) items.push(blocks({ childNodes: [nl] }, depth + 1));
        }
        out.push(items.join('\n'));
      }
      else if (t === 'TABLE') {
        const rows = Array.from(c.querySelectorAll('tr')).map(tr => Array.from(tr.children).map(td => inline(td).trim().replace(/\|/g, '\\|')));
        if (rows.length) {
          const w = Math.max(...rows.map(r => r.length));
          const line = r => '| ' + Array.from({ length: w }, (_, j) => r[j] || '').join(' | ') + ' |';
          out.push([line(rows[0]), '| ' + Array.from({ length: w }, () => '---').join(' | ') + ' |', ...rows.slice(1).map(line)].join('\n'));
        }
      }
      else if (t === 'IMG') out.push(inline({ childNodes: [c] }));
      else { const s = inline(c).trim(); if (s) out.push(s); }
    }
    return out.join(depth ? '\n' : '\n\n');
  };
  return blocks(root, 0).replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/* ---------------- DOCX → HTML ---------------- */
async function docxToHtml(src) {
  const zip = await zipOpen(src);
  const doc = await zip.xml('word/document.xml');
  if (!doc) throw new Error('This file has no Word document inside.');
  const rels = parseRels(await zip.xml('word/_rels/document.xml.rels'));
  const stylesDoc = await zip.xml('word/styles.xml');
  const styleName = new Map();
  if (stylesDoc) for (const s of stylesDoc.getElementsByTagName('w:style')) { const n = s.getElementsByTagName('w:name')[0]; styleName.set(s.getAttribute('w:styleId'), (n ? n.getAttribute('w:val') : '') || s.getAttribute('w:styleId')); }
  const numDoc = await zip.xml('word/numbering.xml');
  const numFmt = new Map();
  if (numDoc) {
    const abs = new Map();
    for (const a of numDoc.getElementsByTagName('w:abstractNum')) {
      const lv = new Map();
      for (const l of a.getElementsByTagName('w:lvl')) { const f = l.getElementsByTagName('w:numFmt')[0]; lv.set(l.getAttribute('w:ilvl'), f ? f.getAttribute('w:val') : 'decimal'); }
      abs.set(a.getAttribute('w:abstractNumId'), lv);
    }
    for (const n of numDoc.getElementsByTagName('w:num')) { const ab = n.getElementsByTagName('w:abstractNumId')[0]; if (ab) numFmt.set(n.getAttribute('w:numId'), abs.get(ab.getAttribute('w:val')) || new Map()); }
  }
  const imgCache = new Map();
  const imageData = async rid => {
    const r = rels.get(rid);
    if (!r) return null;
    if (imgCache.has(rid)) return imgCache.get(rid);
    const p = resolveZipPath('word/document.xml', r.target);
    const b = await zip.bytes(p);
    const url = b ? 'data:' + (MIME[extOf(p)] || 'image/png') + ';base64,' + u8ToBase64(b) : null;
    imgCache.set(rid, url);
    return url;
  };
  const val = (el, tag) => { const e = el ? el.getElementsByTagName(tag)[0] : null; return e ? (e.getAttribute('w:val') == null ? true : e.getAttribute('w:val')) : null; };
  const runHtml = async r => {
    const rPr = kid(r, 'w:rPr');
    let html = '';
    for (const c of kids(r)) {
      const t = c.nodeName;
      if (t === 'w:t') html += esc(c.textContent);
      else if (t === 'w:tab') html += '&emsp;';
      else if (t === 'w:br') html += c.getAttribute('w:type') === 'page' ? '</p><hr class="pagebreak"><p>' : '<br>';
      else if (t === 'w:noBreakHyphen') html += '‑';
      else if (t === 'w:sym') html += '&#x' + (c.getAttribute('w:char') || '25A1').replace(/^F0/i, '') + ';';
      else if (t === 'w:drawing' || t === 'w:pict') {
        const blip = c.getElementsByTagName('a:blip')[0] || c.getElementsByTagName('v:imagedata')[0];
        const rid = blip && (blip.getAttribute('r:embed') || blip.getAttribute('r:id'));
        const ext = c.getElementsByTagName('wp:extent')[0];
        const w = ext ? Math.round(+ext.getAttribute('cx') / 9525) : 0;
        const url = rid ? await imageData(rid) : null;
        if (url) html += '<img src="' + url + '"' + (w ? ' style="width:' + Math.min(w, 624) + 'px;max-width:100%"' : '') + '>';
      }
    }
    if (!html || !rPr) return html;
    const css = [];
    const color = val(rPr, 'w:color');
    if (color && color !== true && color !== 'auto') css.push('color:#' + color);
    const hl = val(rPr, 'w:highlight');
    if (hl && hl !== true && hl !== 'none') css.push('background-color:' + hl.replace(/^dark/, 'dark').toLowerCase());
    const shd = rPr.getElementsByTagName('w:shd')[0];
    if (shd && /^[0-9a-f]{6}$/i.test(shd.getAttribute('w:fill') || '')) css.push('background-color:#' + shd.getAttribute('w:fill'));
    const sz = val(rPr, 'w:sz');
    if (sz && sz !== true && +sz !== 24 && +sz !== 22) css.push('font-size:' + (+sz / 2) + 'pt');
    const rf = rPr.getElementsByTagName('w:rFonts')[0];
    const face = rf && (rf.getAttribute('w:ascii') || rf.getAttribute('w:hAnsi'));
    if (face && /courier|consol|mono/i.test(face)) css.push('font-family:\'Courier New\',monospace');
    if (css.length) html = '<span style="' + css.join(';') + '">' + html + '</span>';
    const va = val(rPr, 'w:vertAlign');
    if (va === 'superscript') html = '<sup>' + html + '</sup>';
    if (va === 'subscript') html = '<sub>' + html + '</sub>';
    const on = tag => { const v = val(rPr, tag); return v === true || (v != null && v !== '0' && v !== 'false' && v !== 'none'); };
    if (on('w:strike') || on('w:dstrike')) html = '<s>' + html + '</s>';
    if (on('w:u')) html = '<u>' + html + '</u>';
    if (on('w:i')) html = '<i>' + html + '</i>';
    if (on('w:b')) html = '<b>' + html + '</b>';
    return html;
  };
  const inlineHtml = async el => {
    let out = '';
    for (const c of kids(el)) {
      const t = c.nodeName;
      if (t === 'w:r') out += await runHtml(c);
      else if (t === 'w:hyperlink') {
        const r = rels.get(c.getAttribute('r:id'));
        const href = r ? r.target : c.getAttribute('w:anchor') ? '#' + c.getAttribute('w:anchor') : '';
        out += href ? '<a href="' + esc(href) + '">' + (await inlineHtml(c)) + '</a>' : await inlineHtml(c);
      }
      else if (t === 'w:ins' || t === 'w:smartTag' || t === 'w:fldSimple' || t === 'w:sdt' || t === 'w:sdtContent' || t === 'w:customXml') out += await inlineHtml(c);
    }
    return out;
  };
  const paraInfo = p => {
    const pPr = kid(p, 'w:pPr');
    const sid = pPr ? val(pPr, 'w:pStyle') : null;
    const sname = sid ? String(styleName.get(sid) || sid) : '';
    let tag = 'p';
    const hm = /heading\s*(\d)/i.exec(sname);
    if (hm) tag = 'h' + clamp(+hm[1], 1, 6);
    else if (/^title$/i.test(sname)) tag = 'h1';
    else if (/^subtitle$/i.test(sname)) tag = 'h2';
    else if (/quote/i.test(sname)) tag = 'blockquote';
    else if (/code|preformatted|html pre/i.test(sname)) tag = 'pre';
    const jc = pPr ? val(pPr, 'w:jc') : null;
    const align = jc === 'center' ? 'center' : jc === 'right' || jc === 'end' ? 'right' : jc === 'both' || jc === 'distribute' ? 'justify' : '';
    let css = '';
    if (pPr) {
      const ind = kid(pPr, 'w:ind');
      const left = ind ? +(ind.getAttribute('w:left') || ind.getAttribute('w:start') || 0) : 0;
      const sp = kid(pPr, 'w:spacing');
      const line = sp && (sp.getAttribute('w:lineRule') || 'auto') === 'auto' ? +(sp.getAttribute('w:line') || 0) : 0;
      if (left > 0 && !kid(pPr, 'w:numPr')) css += 'margin-left:' + (left / 1440).toFixed(2) + 'in;';
      if (line && Math.abs(line - 240) > 10 && Math.abs(line - 264) > 10) css += 'line-height:' + (line / 240).toFixed(2) + ';';
    }
    let list = null;
    const numPr = pPr ? pPr.getElementsByTagName('w:numPr')[0] : null;
    if (numPr) {
      const numId = val(numPr, 'w:numId'), ilvl = +(val(numPr, 'w:ilvl') || 0);
      if (numId && numId !== '0') { const fmt = (numFmt.get(numId) || new Map()).get(String(ilvl)) || 'bullet'; list = { numId, ilvl, ordered: fmt !== 'bullet' && fmt !== 'none' }; }
    } else if (/list bullet/i.test(sname)) list = { numId: 'b', ilvl: 0, ordered: false };
    else if (/list number/i.test(sname)) list = { numId: 'n', ilvl: 0, ordered: true };
    return { tag, align, list, css };
  };
  const blocksHtml = async container => {
    const out = [];
    const stack = [];
    const closeLists = depth => { while (stack.length > depth) out.push(stack.pop().ordered ? '</ol>' : '</ul>'); };
    for (const c of kids(container)) {
      const t = c.nodeName;
      if (t === 'w:p') {
        const info = paraInfo(c);
        const inner = await inlineHtml(c);
        if (info.list) {
          const lvl = info.list.ilvl;
          closeLists(lvl + 1);
          while (stack.length < lvl + 1) { stack.push(info.list); out.push(info.list.ordered ? '<ol>' : '<ul>'); }
          if (stack[lvl].ordered !== info.list.ordered) { closeLists(lvl); stack.push(info.list); out.push(info.list.ordered ? '<ol>' : '<ul>'); }
          out.push('<li' + (info.align ? ' style="text-align:' + info.align + '"' : '') + '>' + (inner || '<br>') + '</li>');
          continue;
        }
        closeLists(0);
        const css = (info.align ? 'text-align:' + info.align + ';' : '') + info.css;
        out.push('<' + info.tag + (css ? ' style="' + css + '"' : '') + '>' + (inner || '<br>') + '</' + info.tag + '>');
      } else if (t === 'w:tbl') {
        closeLists(0);
        let h = '<table border="1" cellpadding="4" style="border-collapse:collapse">';
        for (const tr of kids(c, 'w:tr')) {
          h += '<tr>';
          for (const tc of kids(tr, 'w:tc')) {
            const tcPr = kid(tc, 'w:tcPr');
            const span = tcPr ? +(val(tcPr, 'w:gridSpan') || 1) : 1;
            if (tcPr && tcPr.getElementsByTagName('w:vMerge')[0] && val(tcPr, 'w:vMerge') !== 'restart') { h += '<td></td>'; continue; }
            h += '<td' + (span > 1 ? ' colspan="' + span + '"' : '') + '>' + (await blocksHtml(tc)) + '</td>';
          }
          h += '</tr>';
        }
        out.push(h + '</table>');
      } else if (t === 'w:sdt') { const sc = kid(c, 'w:sdtContent'); if (sc) out.push(await blocksHtml(sc)); }
    }
    closeLists(0);
    return out.join('\n');
  };
  const body = doc.getElementsByTagName('w:body')[0];
  const html = await blocksHtml(body);
  const cp = await coreProps(zip);
  return { html: html.replace(/<p><\/p>/g, ''), title: cp.title || '' };
}

/* ---------------- HTML → DOCX ---------------- */
const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
async function htmlToDocx(root, opts = {}) {
  const rels = [], media = [];
  let relN = 10, picN = 1, numN = 2;
  const nums = [];
  const addRel = (type, target, external) => { const id = 'rId' + (relN++); rels.push('<Relationship Id="' + id + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/' + type + '" Target="' + xmlEsc(target) + '"' + (external ? ' TargetMode="External"' : '') + '/>'); return id; };
  const win = root.ownerDocument.defaultView;
  const imgSize = img => {
    let w = img.naturalWidth || img.width || 300, h = img.naturalHeight || img.height || 200;
    const cw = img.getBoundingClientRect ? img.getBoundingClientRect().width : 0;
    if (cw) { h = Math.round(h * cw / w); w = Math.round(cw); }
    if (w > 624) { h = Math.round(h * 624 / w); w = 624; }
    return [w, h];
  };
  const runProps = f => {
    let p = '';
    if (f.font) p += '<w:rFonts w:ascii="' + xmlEsc(f.font) + '" w:hAnsi="' + xmlEsc(f.font) + '" w:cs="' + xmlEsc(f.font) + '"/>';
    if (f.b) p += '<w:b/>';
    if (f.i) p += '<w:i/>';
    if (f.s) p += '<w:strike/>';
    if (f.color) p += '<w:color w:val="' + f.color.slice(1).toUpperCase() + '"/>';
    if (f.pt) p += '<w:sz w:val="' + Math.round(f.pt * 2) + '"/><w:szCs w:val="' + Math.round(f.pt * 2) + '"/>';
    if (f.u) p += '<w:u w:val="single"/>';
    if (f.bg) p += '<w:shd w:val="clear" w:color="auto" w:fill="' + f.bg.slice(1).toUpperCase() + '"/>';
    if (f.sup) p += '<w:vertAlign w:val="superscript"/>';
    if (f.sub) p += '<w:vertAlign w:val="subscript"/>';
    if (f.link) p = '<w:rStyle w:val="Hyperlink"/>' + p;
    return p ? '<w:rPr>' + p + '</w:rPr>' : '';
  };
  const textRun = (text, f) => {
    let out = '';
    const parts = text.split(/(\t|\u2003)/);
    for (const part of parts) {
      if (part === '\t' || part === '\u2003') out += '<w:r>' + runProps(f) + '<w:tab/></w:r>';
      else if (part) out += '<w:r>' + runProps(f) + '<w:t xml:space="preserve">' + xmlEsc(part) + '</w:t></w:r>';
    }
    return out;
  };
  const fmtOf = (el, f) => {
    f = Object.assign({}, f);
    const t = el.nodeName;
    if (t === 'B' || t === 'STRONG') f.b = true;
    if (t === 'I' || t === 'EM') f.i = true;
    if (t === 'U') f.u = true;
    if (t === 'S' || t === 'STRIKE' || t === 'DEL') f.s = true;
    if (t === 'SUP') f.sup = true;
    if (t === 'SUB') f.sub = true;
    if (t === 'CODE' || t === 'TT' || t === 'KBD') f.font = 'Courier New';
    const st = el.style || {};
    if (st.fontWeight === 'bold' || +st.fontWeight >= 600) f.b = true;
    if (st.fontStyle === 'italic') f.i = true;
    if ((st.textDecorationLine || st.textDecoration || '').includes('underline')) f.u = true;
    if ((st.textDecorationLine || st.textDecoration || '').includes('line-through')) f.s = true;
    const col = cssColorHex(el.getAttribute && (el.getAttribute('color') || st.color));
    if (col) f.color = col;
    const bg = cssColorHex(st.backgroundColor);
    if (bg && bg !== '#ffffff') f.bg = bg;
    const pt = cssFontPt(el);
    if (pt) f.pt = pt;
    const face = (el.getAttribute && el.getAttribute('face')) || st.fontFamily;
    if (face) f.font = face.split(',')[0].replace(/['"]/g, '').trim();
    return f;
  };
  const inlineXml = async (el, f) => {
    let out = '';
    for (const c of el.childNodes) {
      if (c.nodeType === 3) { const t = c.nodeValue.replace(/[\r\n]+/g, ' '); if (t) out += textRun(t, f); continue; }
      if (c.nodeType !== 1) continue;
      const t = c.nodeName;
      if (t === 'BR') { out += '<w:r><w:br/></w:r>'; continue; }
      if (t === 'IMG') {
        const src = c.getAttribute('src') || '';
        const d = dataUrlToU8(src);
        let bytes = d && d.bytes, mime = d && d.mime;
        if (!bytes && /^blob:/.test(src)) { try { const r = await fetch(src); const b = await r.blob(); bytes = new Uint8Array(await b.arrayBuffer()); mime = b.type; } catch (e) { bytes = null; } }
        if (!bytes) continue;
        const ext = /png/.test(mime) ? 'png' : /gif/.test(mime) ? 'gif' : 'jpeg';
        const name = 'image' + picN + '.' + ext;
        media.push({ name: 'word/media/' + name, data: bytes });
        const rid = addRel('image', 'media/' + name);
        const [w, h] = imgSize(c);
        const cx = w * 9525, cy = h * 9525, id = picN++;
        out += '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:docPr id="' + id + '" name="Picture ' + id + '"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="' + id + '" name="' + name + '"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="' + rid + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
        continue;
      }
      if (t === 'A' && c.getAttribute('href') && !/^javascript:/i.test(c.getAttribute('href'))) {
        const href = c.getAttribute('href');
        const inner = await inlineXml(c, Object.assign(fmtOf(c, f), { link: true }));
        if (href.startsWith('#')) out += '<w:hyperlink w:anchor="' + xmlEsc(href.slice(1)) + '">' + inner + '</w:hyperlink>';
        else out += '<w:hyperlink r:id="' + addRel('hyperlink', href, true) + '">' + inner + '</w:hyperlink>';
        continue;
      }
      if (/^(P|DIV|H[1-6]|UL|OL|TABLE|BLOCKQUOTE|PRE)$/.test(t)) { out += await inlineXml(c, f); continue; }
      out += await inlineXml(c, fmtOf(c, f));
    }
    return out;
  };
  const alignOf = el => { const a = (el.style && el.style.textAlign) || el.getAttribute('align') || ''; return a === 'center' ? 'center' : a === 'right' ? 'right' : a === 'justify' ? 'both' : ''; };
  const lineOf = el => { const lh = el.style && el.style.lineHeight; if (!lh || /px|pt|em|%/.test(lh)) return 0; const v = parseFloat(lh); return v > 0.5 && v < 5 ? Math.round(v * 240) : 0; };
  const indentOf = el => { const m = el.style && (el.style.marginLeft || el.style.paddingLeft); if (!m) return 0; const v = parseFloat(m); return /in/.test(m) ? Math.round(v * 1440) : /pt/.test(m) ? Math.round(v * 20) : /px/.test(m) ? Math.round(v * 15) : 0; };
  const para = (inner, o = {}) => {
    let pPr = '';
    if (o.style) pPr += '<w:pStyle w:val="' + o.style + '"/>';
    if (o.num) pPr += '<w:numPr><w:ilvl w:val="' + o.num.ilvl + '"/><w:numId w:val="' + o.num.id + '"/></w:numPr>';
    if (o.border) pPr += '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/></w:pBdr>';
    if (o.line) pPr += '<w:spacing w:line="' + o.line + '" w:lineRule="auto"/>';
    if (o.indent) pPr += '<w:ind w:left="' + o.indent + '"/>';
    if (o.align) pPr += '<w:jc w:val="' + o.align + '"/>';
    return '<w:p>' + (pPr ? '<w:pPr>' + pPr + '</w:pPr>' : '') + inner + '</w:p>';
  };
  const blockXml = async (el, ctx) => {
    let out = '';
    let loose = [];
    const flushLoose = async () => {
      if (!loose.length) return;
      const wrap = root.ownerDocument.createElement('span');
      for (const n of loose) wrap.appendChild(n.cloneNode(true));
      const inner = await inlineXml(wrap, ctx.f || {});
      if (inner) out += para(inner, { style: ctx.style, num: ctx.num, indent: ctx.indent });
      loose = [];
    };
    for (const c of Array.from(el.childNodes)) {
      const t = c.nodeType === 1 ? c.nodeName : '';
      const isBlock = /^(P|DIV|H[1-6]|UL|OL|LI|TABLE|BLOCKQUOTE|PRE|HR|SECTION|ARTICLE|HEADER|FOOTER)$/.test(t);
      if (!isBlock) { if (c.nodeType === 3 && !c.nodeValue.trim() && !loose.length) continue; loose.push(c); continue; }
      await flushLoose();
      if (/^H[1-6]$/.test(t)) out += para(await inlineXml(c, fmtOf(c, {})), { style: 'Heading' + t[1], align: alignOf(c) });
      else if (t === 'P' || t === 'DIV' || t === 'SECTION' || t === 'ARTICLE' || t === 'HEADER' || t === 'FOOTER') {
        if (c.classList && c.classList.contains('pagebreak')) { out += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'; continue; }
        if (c.querySelector('p,div,h1,h2,h3,h4,ul,ol,table,blockquote,pre')) out += await blockXml(c, ctx);
        else out += para(await inlineXml(c, fmtOf(c, ctx.f || {})), { style: ctx.style, align: alignOf(c), indent: (ctx.indent || 0) + indentOf(c) || undefined, line: lineOf(c) });
      }
      else if (t === 'BLOCKQUOTE') {
        // Write's Indent button makes <blockquote style="margin..."> - that's indentation, not a quotation
        if (/margin/.test(c.getAttribute('style') || '') && !c.className) out += await blockXml(c, Object.assign({}, ctx, { indent: (ctx.indent || 0) + 720 }));
        else out += await blockXml(c, { style: 'Quote' });
      }
      else if (t === 'PRE') { for (const line of c.textContent.replace(/\n$/, '').split('\n')) out += para(textRun(line || ' ', { font: 'Courier New', pt: 10 })); }
      else if (t === 'HR') out += c.classList && c.classList.contains('pagebreak') ? '<w:p><w:r><w:br w:type="page"/></w:r></w:p>' : para('', { border: true });
      else if (t === 'UL' || t === 'OL') {
        let id = 1;
        if (t === 'OL') { id = ++numN; nums.push(id); }
        else if (ctx.level >= 0 && ctx.numId && ctx.ordered === false) id = 1;
        const level = (ctx.level == null ? -1 : ctx.level) + 1;
        for (const li of kids(c, 'LI')) {
          const nested = Array.from(li.children).filter(x => x.nodeName === 'UL' || x.nodeName === 'OL');
          const clone = li.cloneNode(true);
          clone.querySelectorAll('ul,ol').forEach(x => x.remove());
          out += para(await inlineXml(clone, {}), { style: 'ListParagraph', num: { id, ilvl: Math.min(level, 8) }, align: alignOf(li) });
          for (const nl of nested) { const w = root.ownerDocument.createElement('div'); w.appendChild(nl.cloneNode(true)); out += await blockXml(w, { level, numId: id, ordered: t === 'OL' }); }
        }
      }
      else if (t === 'TABLE') {
        const rows = Array.from(c.querySelectorAll('tr')).filter(tr => tr.closest('table') === c);
        const ncol = Math.max(1, ...rows.map(tr => Array.from(tr.children).reduce((a, td) => a + (+td.getAttribute('colspan') || 1), 0)));
        const colW = Math.floor(9360 / ncol);
        let x = '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(s => '<w:' + s + ' w:val="single" w:sz="4" w:space="0" w:color="auto"/>').join('') + '</w:tblBorders><w:tblLook w:val="04A0"/></w:tblPr><w:tblGrid>' + Array.from({ length: ncol }, () => '<w:gridCol w:w="' + colW + '"/>').join('') + '</w:tblGrid>';
        for (const tr of rows) {
          x += '<w:tr>';
          for (const td of Array.from(tr.children)) {
            const span = +td.getAttribute('colspan') || 1;
            const inner = await blockXml(td, { f: td.nodeName === 'TH' ? { b: true } : {} });
            x += '<w:tc><w:tcPr><w:tcW w:w="' + colW * span + '" w:type="dxa"/>' + (span > 1 ? '<w:gridSpan w:val="' + span + '"/>' : '') + '</w:tcPr>' + (inner || '<w:p/>') + '</w:tc>';
          }
          x += '</w:tr>';
        }
        out += x + '</w:tbl>' + para('');
      }
      else out += await blockXml(c, ctx);
    }
    await flushLoose();
    return out;
  };
  const body = await blockXml(root, {});
  const title = opts.title || '';
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const lvlBullet = i => '<w:lvl w:ilvl="' + i + '"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="' + ['•', 'o', '▪'][i % 3] + '"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="' + (720 + 360 * i) + '" w:hanging="360"/></w:pPr>' + (i % 3 === 1 ? '<w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/></w:rPr>' : '') + '</w:lvl>';
  const lvlDec = i => '<w:lvl w:ilvl="' + i + '"><w:start w:val="1"/><w:numFmt w:val="' + ['decimal', 'lowerLetter', 'lowerRoman'][i % 3] + '"/><w:lvlText w:val="%' + (i + 1) + '."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="' + (720 + 360 * i) + '" w:hanging="360"/></w:pPr></w:lvl>';
  const numbering = XML_HEAD + '<w:numbering ' + W_NS + '><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>' + Array.from({ length: 9 }, (_, i) => lvlBullet(i)).join('') + '</w:abstractNum><w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>' + Array.from({ length: 9 }, (_, i) => lvlDec(i)).join('') + '</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>' + nums.map(n => '<w:num w:numId="' + n + '"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>').join('') + '</w:numbering>';
  const font = opts.font || 'Times New Roman';
  const st = (id, name, ppr, rpr, extra) => '<w:style w:type="paragraph" w:styleId="' + id + '"><w:name w:val="' + name + '"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/>' + (extra || '') + '<w:qFormat/>' + (ppr ? '<w:pPr>' + ppr + '</w:pPr>' : '') + (rpr ? '<w:rPr>' + rpr + '</w:rPr>' : '') + '</w:style>';
  const styles = XML_HEAD + '<w:styles ' + W_NS + '><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="' + font + '" w:hAnsi="' + font + '" w:cs="' + font + '" w:eastAsia="' + font + '"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
    st('Heading1', 'heading 1', '<w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="0"/>', '<w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:b/><w:sz w:val="36"/>') +
    st('Heading2', 'heading 2', '<w:keepNext/><w:spacing w:before="200" w:after="100"/><w:outlineLvl w:val="1"/>', '<w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:b/><w:sz w:val="30"/>') +
    st('Heading3', 'heading 3', '<w:keepNext/><w:spacing w:before="160" w:after="80"/><w:outlineLvl w:val="2"/>', '<w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:b/><w:sz w:val="26"/>') +
    st('Heading4', 'heading 4', '<w:keepNext/><w:outlineLvl w:val="3"/>', '<w:b/><w:i/>') + st('Heading5', 'heading 5', '<w:outlineLvl w:val="4"/>', '<w:b/>') + st('Heading6', 'heading 6', '<w:outlineLvl w:val="5"/>', '<w:i/>') +
    st('Title', 'Title', '<w:spacing w:after="240"/>', '<w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:b/><w:sz w:val="48"/>') +
    st('Quote', 'Quote', '<w:ind w:left="720" w:right="720"/>', '<w:i/><w:color w:val="404040"/>') +
    st('ListParagraph', 'List Paragraph', '<w:ind w:left="720"/><w:contextualSpacing/>', '') +
    '<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="0000FF"/><w:u w:val="single"/></w:rPr></w:style>' +
    '<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(s => '<w:' + s + ' w:val="single" w:sz="4" w:space="0" w:color="auto"/>').join('') + '</w:tblBorders></w:tblPr></w:style></w:styles>';
  const docXml = XML_HEAD + '<w:document ' + W_NS + '><w:body>' + body + '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>';
  const files = [
    { name: '[Content_Types].xml', data: XML_HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>' },
    { name: '_rels/.rels', data: XML_HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>' },
    { name: 'word/document.xml', data: docXml },
    { name: 'word/styles.xml', data: styles },
    { name: 'word/numbering.xml', data: numbering },
    { name: 'word/_rels/document.xml.rels', data: XML_HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>' + rels.join('') + '</Relationships>' },
    { name: 'docProps/core.xml', data: XML_HEAD + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>' + xmlEsc(title) + '</dc:title><dc:creator>' + xmlEsc(opts.author || 'LANscape Write') + '</dc:creator><cp:lastModifiedBy>LANscape Write</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">' + (opts.created || now) + '</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">' + now + '</dcterms:modified></cp:coreProperties>' },
    { name: 'docProps/app.xml', data: XML_HEAD + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>LANscape Write</Application></Properties>' },
    ...media
  ];
  void win;
  return zipWrite(files, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}
