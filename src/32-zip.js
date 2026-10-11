/* ===================================================================
   ZIP read/write on top of the browser's own (De)CompressionStream,
   plus small XML helpers. Enough for .docx/.xlsx/.pptx and .zip listings.
   =================================================================== */
const UTF8 = new TextDecoder('utf-8');
const UTF8E = new TextEncoder();
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
async function streamBytes(u8, ts) { return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(ts)).arrayBuffer()); }
const inflateRaw = u8 => streamBytes(u8, new DecompressionStream('deflate-raw'));
const deflateRaw = u8 => streamBytes(u8, new CompressionStream('deflate-raw'));
const canDeflate = (() => { try { new CompressionStream('deflate-raw'); return true; } catch (e) { return false; } })();

/** open a ZIP from a Blob/File/ArrayBuffer; only the needed byte ranges are read */
async function zipOpen(src) {
  const blob = src instanceof Blob ? src : new Blob([src]);
  const size = blob.size;
  const tailLen = Math.min(size, 65557 + 22);
  const tail = new Uint8Array(await blob.slice(size - tailLen).arrayBuffer());
  const tdv = new DataView(tail.buffer);
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) if (tdv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('This is not a ZIP-based file.');
  const count = tdv.getUint16(eocd + 10, true), cdSize = tdv.getUint32(eocd + 12, true), cdOff = tdv.getUint32(eocd + 16, true);
  const cd = new Uint8Array(await blob.slice(cdOff, cdOff + cdSize).arrayBuffer());
  const dv = new DataView(cd.buffer);
  const entries = new Map();
  let p = 0;
  for (let i = 0; i < count && p + 46 <= cd.length; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const flags = dv.getUint16(p + 8, true), method = dv.getUint16(p + 10, true);
    const time = dv.getUint16(p + 12, true), date = dv.getUint16(p + 14, true);
    const csize = dv.getUint32(p + 20, true), usize = dv.getUint32(p + 24, true);
    const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const name = UTF8.decode(cd.subarray(p + 46, p + 46 + nlen));
    const mtime = new Date(1980 + (date >> 9), ((date >> 5) & 15) - 1, date & 31, time >> 11, (time >> 5) & 63, (time & 31) * 2).getTime();
    entries.set(name, { name, method, csize, usize, lho, mtime, crc: dv.getUint32(p + 16, true), dir: name.endsWith('/'), encrypted: !!(flags & 1) });
    p += 46 + nlen + xlen + clen;
  }
  const lower = new Map(Array.from(entries.keys(), k => [k.toLowerCase(), k]));
  const find = name => entries.get(name) || entries.get(lower.get(String(name).toLowerCase()));
  const zip = {
    entries, size,
    has: name => !!find(name),
    async bytes(name) {
      const e = find(name);
      if (!e) return null;
      if (e.encrypted) throw new Error('Encrypted ZIP entries are not supported.');
      const lh = new DataView(await blob.slice(e.lho, e.lho + 30).arrayBuffer());
      const start = e.lho + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
      const raw = new Uint8Array(await blob.slice(start, start + e.csize).arrayBuffer());
      if (e.method === 0) return raw;
      if (e.method === 8) return inflateRaw(raw);
      throw new Error('Unsupported ZIP compression method ' + e.method + '.');
    },
    async text(name) { const b = await zip.bytes(name); return b ? UTF8.decode(b) : null; },
    async xml(name) { const t = await zip.text(name); return t == null ? null : parseXML(t); }
  };
  return zip;
}
/** build a ZIP Blob from [{name, data: string|Uint8Array}] */
async function zipWrite(files, mime) {
  const chunks = [], central = [];
  let offset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  for (const f of files) {
    const nameB = UTF8E.encode(f.name);
    const data = typeof f.data === 'string' ? UTF8E.encode(f.data) : f.data;
    const crc = crc32(data);
    let comp = data, method = 0;
    if (canDeflate && data.length > 64 && !f.store) {
      try { const d = await deflateRaw(data); if (d.length < data.length) { comp = d; method = 8; } } catch (e) { /* store */ }
    }
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, method, true);
    lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, comp.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, nameB.length, true); lh.setUint16(28, 0, true);
    chunks.push(new Uint8Array(lh.buffer), nameB, comp);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, method, true);
    ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true); ch.setUint32(20, comp.length, true); ch.setUint32(24, data.length, true);
    ch.setUint16(28, nameB.length, true); ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), nameB);
    offset += 30 + nameB.length + comp.length;
  }
  const cdSize = central.reduce((a, c) => a + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: mime || 'application/zip' });
}

/* ---------------- XML ---------------- */
function parseXML(text) {
  const d = new DOMParser().parseFromString(String(text || '').replace(/^﻿/, ''), 'application/xml');
  return d.getElementsByTagName('parsererror').length ? null : d;
}
const xmlEsc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const kids = (el, name) => (el ? Array.from(el.childNodes).filter(n => n.nodeType === 1 && (!name || n.nodeName === name)) : []);
const kid = (el, name) => kids(el, name)[0] || null;
const attr = (el, name) => (el ? el.getAttribute(name) : null);
function parseRels(doc) {
  const m = new Map();
  if (!doc) return m;
  for (const r of doc.getElementsByTagName('Relationship')) m.set(r.getAttribute('Id'), { target: r.getAttribute('Target'), type: r.getAttribute('Type') || '', external: r.getAttribute('TargetMode') === 'External' });
  return m;
}
function resolveZipPath(base, target) {
  if (!target) return '';
  if (target.startsWith('/')) return target.slice(1);
  const parts = (base.replace(/[^/]*$/, '') + target).split('/');
  const out = [];
  for (const p of parts) { if (p === '..') out.pop(); else if (p && p !== '.') out.push(p); }
  return out.join('/');
}
function u8ToBase64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
function base64ToU8(b64) { const s = atob(b64); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
function dataUrlToU8(url) { const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(url); if (!m) return null; return { mime: m[1] || 'application/octet-stream', bytes: m[2] ? base64ToU8(m[3]) : UTF8E.encode(decodeURIComponent(m[3])) }; }
const latin1 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return s; };
