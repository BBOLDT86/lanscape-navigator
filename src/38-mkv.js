/* ===================================================================
   MKV (Matroska) playback. Browsers' own players turn many .mkv files
   down: Safari takes none, and Chrome refuses some of the codecs inside
   them. This reads the Matroska file in JavaScript and repackages its
   picture and sound, exactly as they are, into fragmented MP4 for Media
   Source Extensions. Nothing is re-encoded, so it starts fast and the
   picture is untouched. Text subtitles stored in the file come along.
   =================================================================== */
const MKV = {
  EBML: 0x1A45DFA3, DocType: 0x4282, Segment: 0x18538067, SeekHead: 0x114D9B74, Seek: 0x4DBB, SeekID: 0x53AB, SeekPosition: 0x53AC,
  Info: 0x1549A966, TimecodeScale: 0x2AD7B1, Duration: 0x4489, Title: 0x7BA9,
  Tracks: 0x1654AE6B, TrackEntry: 0xAE, TrackNumber: 0xD7, TrackType: 0x83, FlagEnabled: 0xB9, FlagDefault: 0x88, FlagForced: 0x55AA,
  DefaultDuration: 0x23E383, Name: 0x536E, Language: 0x22B59C, LanguageIETF: 0x22B59D, CodecID: 0x86, CodecPrivate: 0x63A2,
  Video: 0xE0, PixelWidth: 0xB0, PixelHeight: 0xBA, DisplayWidth: 0x54B0, DisplayHeight: 0x54BA, DisplayUnit: 0x54B2,
  Audio: 0xE1, SamplingFrequency: 0xB5, OutputSamplingFrequency: 0x78B5, Channels: 0x9F, BitDepth: 0x6264,
  ContentEncodings: 0x6D80, ContentEncoding: 0x6240, ContentCompression: 0x5034, ContentCompAlgo: 0x4254, ContentCompSettings: 0x4255, ContentEncryption: 0x5035,
  Cues: 0x1C53BB6B, CuePoint: 0xBB, CueTime: 0xB3, CueTrackPositions: 0xB7, CueTrack: 0xF7, CueClusterPosition: 0xF1,
  Cluster: 0x1F43B675, Timecode: 0xE7, SimpleBlock: 0xA3, BlockGroup: 0xA0, Block: 0xA1, BlockDuration: 0x9B, ReferenceBlock: 0xFB
};
/** elements that only appear at the top of a file: an unknown-size cluster ends where one of them starts */
const MKV_TOP = new Set([MKV.Cluster, MKV.Cues, MKV.SeekHead, MKV.Info, MKV.Tracks, 0x1254C367, 0x1043A770, 0x1941A469]);
const MKV_EXT = /^(mkv|mk3d)$/i;

/* ---------------- EBML ---------------- */
/** an EBML variable-length number at u8[pos]: {len, val}. Sizes of all ones mean "unknown" (-1) */
function ebmlVint(u8, pos, keepMarker) {
  const b = u8[pos];
  if (b === undefined || b === 0) return null;
  let len = 1, mask = 0x80;
  while (!(b & mask)) { len++; mask >>= 1; }
  if (pos + len > u8.length) return null;
  let val = keepMarker ? b : b & (mask - 1), ones = (b & (mask - 1)) === mask - 1;
  for (let i = 1; i < len; i++) { const x = u8[pos + i]; val = val * 256 + x; if (x !== 255) ones = false; }
  return { len, val: !keepMarker && ones ? -1 : val };
}
/** an element header: {id, size, hlen} */
function ebmlHead(u8, pos) {
  const id = ebmlVint(u8, pos, true);
  if (!id || id.len > 4) return null;
  const sz = ebmlVint(u8, pos + id.len, false);
  if (!sz) return null;
  return { id: id.val, size: sz.val, hlen: id.len + sz.len };
}
const ebmlUint = (u8, p, n) => { let v = 0; for (let i = 0; i < n; i++) v = v * 256 + u8[p + i]; return v; };
const ebmlFloat = (u8, p, n) => { const dv = new DataView(u8.buffer, u8.byteOffset + p, n); return n === 4 ? dv.getFloat32(0) : n === 8 ? dv.getFloat64(0) : 0; };
const ebmlStr = (u8, p, n) => new TextDecoder().decode(u8.subarray(p, p + n)).replace(/\0+$/, '');
/** the children of an element: [{id, pos, dpos, size}] */
function ebmlKids(u8, start, end) {
  const out = [];
  let p = start;
  while (p < end) {
    const h = ebmlHead(u8, p);
    if (!h || h.size < 0 || p + h.hlen + h.size > end) break;
    out.push({ id: h.id, pos: p, dpos: p + h.hlen, size: h.size });
    p += h.hlen + h.size;
  }
  return out;
}
function mkvJoin(...parts) {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
async function mkvRead(m, pos, len) {
  const end = Math.min(m.size, pos + len);
  if (end <= pos) return new Uint8Array(0);
  return new Uint8Array(await m.blob.slice(pos, end).arrayBuffer());
}

/* ---------------- the file: header, tracks, index ---------------- */
function mkvTracks(u8) {
  const out = [];
  for (const e of ebmlKids(u8, 0, u8.length)) {
    if (e.id !== MKV.TrackEntry) continue;
    const t = { number: 0, type: 0, codec: '', priv: null, dur: 0, name: '', lang: 'eng', def: true, enabled: true, forced: false, video: null, audio: null, strip: null, encoded: false };
    for (const k of ebmlKids(u8, e.dpos, e.dpos + e.size)) {
      const n = () => ebmlUint(u8, k.dpos, k.size), s = () => ebmlStr(u8, k.dpos, k.size);
      switch (k.id) {
        case MKV.TrackNumber: t.number = n(); break;
        case MKV.TrackType: t.type = n(); break;
        case MKV.FlagEnabled: t.enabled = !!n(); break;
        case MKV.FlagDefault: t.def = !!n(); break;
        case MKV.FlagForced: t.forced = !!n(); break;
        case MKV.DefaultDuration: t.dur = n(); break;
        case MKV.Name: t.name = s(); break;
        case MKV.Language: t.lang = s(); break;
        case MKV.LanguageIETF: t.ietf = s(); break;
        case MKV.CodecID: t.codec = s(); break;
        case MKV.CodecPrivate: t.priv = u8.slice(k.dpos, k.dpos + k.size); break;
        case 0x56AA: t.delay = n(); break;                 // CodecDelay (ns): taken off every block time
        case MKV.Video: {
          t.video = { w: 0, h: 0, dw: 0, dh: 0, du: 0 };
          for (const v of ebmlKids(u8, k.dpos, k.dpos + k.size)) {
            const vn = ebmlUint(u8, v.dpos, v.size);
            if (v.id === MKV.PixelWidth) t.video.w = vn; else if (v.id === MKV.PixelHeight) t.video.h = vn;
            else if (v.id === MKV.DisplayWidth) t.video.dw = vn; else if (v.id === MKV.DisplayHeight) t.video.dh = vn; else if (v.id === MKV.DisplayUnit) t.video.du = vn;
          }
          break;
        }
        case MKV.Audio: {
          t.audio = { rate: 8000, out: 0, channels: 1, bits: 0 };
          for (const a of ebmlKids(u8, k.dpos, k.dpos + k.size)) {
            if (a.id === MKV.SamplingFrequency) t.audio.rate = ebmlFloat(u8, a.dpos, a.size);
            else if (a.id === MKV.OutputSamplingFrequency) t.audio.out = ebmlFloat(u8, a.dpos, a.size);
            else if (a.id === MKV.Channels) t.audio.channels = ebmlUint(u8, a.dpos, a.size);
            else if (a.id === MKV.BitDepth) t.audio.bits = ebmlUint(u8, a.dpos, a.size);
          }
          break;
        }
        case MKV.ContentEncodings:
          for (const ce of ebmlKids(u8, k.dpos, k.dpos + k.size)) if (ce.id === MKV.ContentEncoding) for (const c of ebmlKids(u8, ce.dpos, ce.dpos + ce.size)) {
            if (c.id === MKV.ContentCompression) {
              let algo = 0, set = null;
              for (const cc of ebmlKids(u8, c.dpos, c.dpos + c.size)) { if (cc.id === MKV.ContentCompAlgo) algo = ebmlUint(u8, cc.dpos, cc.size); else if (cc.id === MKV.ContentCompSettings) set = u8.slice(cc.dpos, cc.dpos + cc.size); }
              // "header stripping" just leaves off the first bytes of every frame; anything else is real compression
              if (algo === 3 && set) t.strip = set; else t.encoded = true;
            } else if (c.id === MKV.ContentEncryption) t.encoded = true;
          }
          break;
        default: break;
      }
    }
    out.push(t);
  }
  return out;
}
function mkvCues(u8) {
  const out = [];
  for (const cp of ebmlKids(u8, 0, u8.length)) {
    if (cp.id !== MKV.CuePoint) continue;
    let time = 0;
    const at = [];
    for (const k of ebmlKids(u8, cp.dpos, cp.dpos + cp.size)) {
      if (k.id === MKV.CueTime) time = ebmlUint(u8, k.dpos, k.size);
      else if (k.id === MKV.CueTrackPositions) {
        let track = 0, cl = -1;
        for (const x of ebmlKids(u8, k.dpos, k.dpos + k.size)) { if (x.id === MKV.CueTrack) track = ebmlUint(u8, x.dpos, x.size); else if (x.id === MKV.CueClusterPosition) cl = ebmlUint(u8, x.dpos, x.size); }
        if (cl >= 0) at.push({ track, cl });
      }
    }
    for (const a of at) out.push({ time, track: a.track, cl: a.cl });
  }
  return out.sort((a, b) => a.time - b.time);
}
/** open an MKV file: tracks, timing, the keyframe index (Cues) and where the first cluster starts */
async function mkvOpen(blob) {
  const m = { blob, size: blob.size, info: { scale: 1e6, duration: 0, title: '' }, tracks: [], cues: null, first: -1, docType: 'matroska' };
  const head = await mkvRead(m, 0, 4096);
  const eh = ebmlHead(head, 0);
  if (!eh || eh.id !== MKV.EBML) throw new Error('This isn\'t a Matroska (MKV) file.');
  for (const k of ebmlKids(head, eh.hlen, eh.hlen + eh.size)) if (k.id === MKV.DocType) m.docType = ebmlStr(head, k.dpos, k.size);
  const segPos = eh.hlen + eh.size;
  const sh = ebmlHead(await mkvRead(m, segPos, 16), 0);
  if (!sh || sh.id !== MKV.Segment) throw new Error('This MKV file is damaged.');
  m.seg = segPos + sh.hlen;
  m.segEnd = sh.size < 0 ? m.size : Math.min(m.size, m.seg + sh.size);
  const seek = {};
  let p = m.seg;
  for (let guard = 0; p < m.segEnd && guard < 4096; guard++) {
    const h = ebmlHead(await mkvRead(m, p, 16), 0);
    if (!h) break;
    if (h.id === MKV.Cluster) { m.first = p; break; }
    if (h.size < 0) break;
    const body = p + h.hlen;
    if (h.id === MKV.Info || h.id === MKV.Tracks || h.id === MKV.SeekHead || h.id === MKV.Cues) {
      const u8 = await mkvRead(m, body, h.size);
      if (h.id === MKV.Info) {
        for (const k of ebmlKids(u8, 0, u8.length)) {
          if (k.id === MKV.TimecodeScale) m.info.scale = ebmlUint(u8, k.dpos, k.size) || 1e6;
          else if (k.id === MKV.Duration) m.info.duration = ebmlFloat(u8, k.dpos, k.size);
          else if (k.id === MKV.Title) m.info.title = ebmlStr(u8, k.dpos, k.size);
        }
      } else if (h.id === MKV.Tracks) m.tracks = mkvTracks(u8);
      else if (h.id === MKV.SeekHead) {
        for (const s of ebmlKids(u8, 0, u8.length)) if (s.id === MKV.Seek) {
          let id = 0, at = -1;
          for (const k of ebmlKids(u8, s.dpos, s.dpos + s.size)) { if (k.id === MKV.SeekID) id = ebmlUint(u8, k.dpos, k.size); else if (k.id === MKV.SeekPosition) at = ebmlUint(u8, k.dpos, k.size); }
          if (id && at >= 0 && seek[id] == null) seek[id] = at;
        }
      } else m.cues = mkvCues(u8);
    }
    p = body + h.size;
  }
  // the index is usually at the end of the file
  const element = async (id, max) => {
    if (seek[id] == null) return null;
    const at = m.seg + seek[id];
    const h = ebmlHead(await mkvRead(m, at, 16), 0);
    if (!h || h.id !== id || h.size < 0 || h.size > max) return null;
    return mkvRead(m, at + h.hlen, h.size);
  };
  if (!m.cues) { const u8 = await element(MKV.Cues, 64e6); if (u8) m.cues = mkvCues(u8); }
  if (!m.tracks.length) { const u8 = await element(MKV.Tracks, 16e6); if (u8) m.tracks = mkvTracks(u8); }
  if (m.first < 0) throw new Error('This MKV file has no video in it.');
  m.sc = m.info.scale / 1e9;                       // timecode units -> seconds
  m.duration = m.info.duration * m.sc;
  if (!m.duration) m.duration = await mkvTailTime(m);
  return m;
}
/** files written live don't say how long they are: look at the last cluster */
async function mkvTailTime(m) {
  const from = Math.max(m.first, m.segEnd - 4e6);
  const tail = await mkvRead(m, from, m.segEnd - from);
  for (let i = tail.length - 4; i >= 0; i--) {
    if (tail[i] !== 0x1F || tail[i + 1] !== 0x43 || tail[i + 2] !== 0xB6 || tail[i + 3] !== 0x75) continue;
    try {
      const cl = await mkvReadCluster(m, from + i);
      if (cl && cl.blocks.length) return Math.max(...cl.blocks.map(b => b.time)) * m.sc;
    } catch (e) { /* not really a cluster */ }
  }
  return 0;
}

/* ---------------- clusters and blocks ---------------- */
function mkvBlock(u8, p, len, simple) {
  const end = p + len;
  const tn = ebmlVint(u8, p, false);
  if (!tn) return null;
  let q = p + tn.len;
  const rel = ((u8[q] << 8) | u8[q + 1]) << 16 >> 16;
  const flags = u8[q + 2];
  q += 3;
  const lacing = (flags >> 1) & 3;
  const b = { track: tn.val, time: rel, key: simple ? !!(flags & 0x80) : true, frames: [], dur: null };
  if (!lacing) { b.frames.push(u8.subarray(q, end)); return b; }
  const n = u8[q++] + 1, sizes = [];
  if (lacing === 1) {                                // Xiph lacing
    for (let i = 0; i < n - 1; i++) { let s = 0, x; do { x = u8[q++]; s += x; } while (x === 255 && q < end); sizes.push(s); }
  } else if (lacing === 3) {                         // EBML lacing
    const f = ebmlVint(u8, q, false); q += f.len; sizes.push(f.val);
    // later sizes are signed differences: the number without its length marker, minus a bias
    for (let i = 1; i < n - 1; i++) { const d = ebmlVint(u8, q, true); q += d.len; const raw = d.val - Math.pow(2, 7 * d.len); sizes.push(sizes[i - 1] + raw - (Math.pow(2, 7 * d.len - 1) - 1)); }
  } else {                                           // fixed-size lacing
    const each = Math.floor((end - q) / n);
    for (let i = 0; i < n - 1; i++) sizes.push(each);
  }
  let used = 0;
  for (const s of sizes) used += s;
  sizes.push(end - q - used);
  for (const s of sizes) { if (s < 0 || q + s > end) break; b.frames.push(u8.subarray(q, q + s)); q += s; }
  return b;
}
/** one cluster: {pos, end, time, blocks: [{track, time, key, frames, dur}]} (times in timecode units) */
async function mkvReadCluster(m, pos) {
  let buf = await mkvRead(m, pos, 64 * 1024);
  const h = ebmlHead(buf, 0);
  if (!h || h.id !== MKV.Cluster) return null;
  let end = -1;
  if (h.size >= 0) {
    end = Math.min(pos + h.hlen + h.size, m.segEnd);
    if (end - pos > buf.length) buf = await mkvRead(m, pos, end - pos);
  }
  const cl = { pos, end, time: 0, blocks: [] };
  const more = async need => { if (pos + buf.length >= m.segEnd) return false; buf = mkvJoin(buf, await mkvRead(m, pos + buf.length, Math.max(4 << 20, need))); return true; };
  let p = h.hlen;
  for (;;) {
    if (end >= 0 && pos + p >= end) break;
    if (p + 16 > buf.length && end < 0) await more(16);
    const k = ebmlHead(buf, p);
    if (!k) break;
    if (end < 0 && MKV_TOP.has(k.id)) { cl.end = pos + p; break; }
    if (k.size < 0) break;
    if (p + k.hlen + k.size > buf.length && !(await more(p + k.hlen + k.size - buf.length))) break;
    const dp = p + k.hlen;
    if (k.id === MKV.Timecode) cl.time = ebmlUint(buf, dp, k.size);
    else if (k.id === MKV.SimpleBlock) { const b = mkvBlock(buf, dp, k.size, true); if (b) cl.blocks.push(b); }
    else if (k.id === MKV.BlockGroup) {
      let blk = null, ref = false, dur = null;
      for (const g of ebmlKids(buf, dp, dp + k.size)) {
        if (g.id === MKV.Block) blk = mkvBlock(buf, g.dpos, g.size, false);
        else if (g.id === MKV.ReferenceBlock) ref = true;
        else if (g.id === MKV.BlockDuration) dur = ebmlUint(buf, g.dpos, g.size);
      }
      if (blk) { blk.key = !ref; blk.dur = dur; cl.blocks.push(blk); }
    }
    p = dp + k.size;
  }
  if (cl.end < 0) cl.end = Math.min(pos + p, m.segEnd);
  for (const b of cl.blocks) b.time += cl.time;
  return cl;
}

/* ---------------- MP4 boxes ---------------- */
const mp4U8 = (...b) => new Uint8Array(b);
const mp4U16 = v => mp4U8(v >> 8 & 255, v & 255);
const mp4U32 = v => mp4U8(v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255);
const mp4U64 = v => mkvJoin(mp4U32(Math.floor(v / 4294967296)), mp4U32(v % 4294967296));
const mp4Str = s => new Uint8Array(Array.from(s, c => c.charCodeAt(0) & 255));
const mp4Zero = n => new Uint8Array(n);
function mp4Box(type, ...parts) {
  const body = mkvJoin(...parts);
  const out = new Uint8Array(8 + body.length);
  new DataView(out.buffer).setUint32(0, out.length);
  out.set(mp4Str(type), 4);
  out.set(body, 8);
  return out;
}
const mp4Full = (type, version, flags, ...parts) => mp4Box(type, mp4U8(version, flags >> 16 & 255, flags >> 8 & 255, flags & 255), ...parts);
const MP4_MATRIX = mkvJoin(mp4U32(0x00010000), mp4U32(0), mp4U32(0), mp4U32(0), mp4U32(0x00010000), mp4U32(0), mp4U32(0), mp4U32(0), mp4U32(0x40000000));
/** an MP4 header (moov) for one track; each kind goes in a SourceBuffer of its own */
function mp4Init(s) {
  const video = s.kind === 'video';
  const ftyp = mp4Box('ftyp', mp4Str('isom'), mp4U32(0x200), mp4Str('isom'), mp4Str('iso6'), mp4Str('mp41'));
  const mvhd = mp4Full('mvhd', 0, 0, mp4U32(0), mp4U32(0), mp4U32(1000), mp4U32(0), mp4U32(0x00010000), mp4U16(0x0100), mp4Zero(10), MP4_MATRIX, mp4Zero(24), mp4U32(2));
  const tkhd = mp4Full('tkhd', 0, 3, mp4U32(0), mp4U32(0), mp4U32(1), mp4U32(0), mp4U32(0), mp4Zero(8), mp4U16(0), mp4U16(0), mp4U16(video ? 0 : 0x0100), mp4U16(0), MP4_MATRIX, mp4U32((s.dw || 0) * 65536), mp4U32((s.dh || 0) * 65536));
  const mdhd = mp4Full('mdhd', 0, 0, mp4U32(0), mp4U32(0), mp4U32(s.scale), mp4U32(0), mp4U16(0x55C4), mp4U16(0));
  const hdlr = mp4Full('hdlr', 0, 0, mp4U32(0), mp4Str(video ? 'vide' : 'soun'), mp4Zero(12), mp4Str('LANscape\0'));
  const xmhd = video ? mp4Full('vmhd', 0, 1, mp4Zero(8)) : mp4Full('smhd', 0, 0, mp4Zero(4));
  const dinf = mp4Box('dinf', mp4Full('dref', 0, 0, mp4U32(1), mp4Full('url ', 0, 1)));
  const stbl = mp4Box('stbl', mp4Full('stsd', 0, 0, mp4U32(1), s.entry), mp4Full('stts', 0, 0, mp4U32(0)), mp4Full('stsc', 0, 0, mp4U32(0)), mp4Full('stsz', 0, 0, mp4U32(0), mp4U32(0)), mp4Full('stco', 0, 0, mp4U32(0)));
  const trak = mp4Box('trak', tkhd, mp4Box('mdia', mdhd, hdlr, mp4Box('minf', xmhd, dinf, stbl)));
  const mvex = mp4Box('mvex', mp4Full('trex', 0, 0, mp4U32(1), mp4U32(1), mp4U32(0), mp4U32(0), mp4U32(0)));
  return mkvJoin(ftyp, mp4Box('moov', mvhd, trak, mvex));
}
/** one fragment (moof + mdat). samples: [{dur, flags, cto, data}] in decode order, base = first decode time */
function mp4Fragment(seq, base, samples) {
  const n = samples.length;
  const trun = new Uint8Array(20 + n * 16), dv = new DataView(trun.buffer);
  dv.setUint32(0, trun.length); trun.set(mp4Str('trun'), 4); dv.setUint32(8, 0x01000F01); dv.setUint32(12, n);
  let o = 20, bytes = 0;
  for (const s of samples) { dv.setUint32(o, s.dur); dv.setUint32(o + 4, s.data.length); dv.setUint32(o + 8, s.flags); dv.setInt32(o + 12, s.cto); o += 16; bytes += s.data.length; }
  const moof = mp4Box('moof', mp4Full('mfhd', 0, 0, mp4U32(seq)), mp4Box('traf', mp4Full('tfhd', 0, 0x020000, mp4U32(1)), mp4Full('tfdt', 1, 0, mp4U64(base)), trun));
  new DataView(moof.buffer).setUint32(moof.length - trun.length + 16, moof.length + 8);
  const out = new Uint8Array(moof.length + 8 + bytes);
  out.set(moof, 0);
  new DataView(out.buffer).setUint32(moof.length, 8 + bytes);
  out.set(mp4Str('mdat'), moof.length + 4);
  let q = moof.length + 8;
  for (const s of samples) { out.set(s.data, q); q += s.data.length; }
  return out;
}
const mp4Visual = (type, w, h, ...boxes) => mp4Box(type, mp4Zero(6), mp4U16(1), mp4Zero(16), mp4U16(w), mp4U16(h), mp4U32(0x00480000), mp4U32(0x00480000), mp4U32(0), mp4U16(1), mp4Zero(32), mp4U16(0x18), mp4U16(0xFFFF), ...boxes);
const mp4Sound = (type, ch, rate, bits, ...boxes) => mp4Box(type, mp4Zero(6), mp4U16(1), mp4Zero(8), mp4U16(ch), mp4U16(bits || 16), mp4U16(0), mp4U16(0), mp4U32(Math.min(65535, Math.round(rate)) * 65536), ...boxes);
function mp4Desc(tag, body) { const n = body.length; return mkvJoin(mp4U8(tag, 0x80 | (n >> 21 & 127), 0x80 | (n >> 14 & 127), 0x80 | (n >> 7 & 127), n & 127), body); }
function mp4Esds(oti, dsi) {
  const dcd = mp4Desc(4, mkvJoin(mp4U8(oti, 0x15, 0, 0, 0), mp4U32(0), mp4U32(0), dsi ? mp4Desc(5, dsi) : mp4Zero(0)));
  return mp4Full('esds', 0, 0, mp4Desc(3, mkvJoin(mp4U16(1), mp4U8(0), dcd, mp4Desc(6, mp4U8(2)))));
}
function mp4Gcd(a, b) { while (b) [a, b] = [b, a % b]; return a || 1; }
class MkvBits {
  constructor(u8, bit) { this.u8 = u8; this.b = bit || 0; }
  read(n) { let v = 0; for (let i = 0; i < n; i++, this.b++) v = v * 2 + ((this.u8[this.b >> 3] >> (7 - (this.b & 7))) & 1); return v; }
}
class MkvBitWriter {
  constructor() { this.bits = []; }
  put(v, n) { for (let i = n - 1; i >= 0; i--) this.bits.push((v / Math.pow(2, i)) & 1); return this; }
  bytes() { const out = new Uint8Array(Math.ceil(this.bits.length / 8)); this.bits.forEach((b, i) => { if (b) out[i >> 3] |= 0x80 >> (i & 7); }); return out; }
}
const hex2 = v => (v & 255).toString(16).padStart(2, '0');

/* ---------------- codecs ---------------- */
const MKV_VIDEO_NAMES = { 'V_MPEG4/ISO/AVC': 'H.264', 'V_MPEGH/ISO/HEVC': 'H.265 (HEVC)', V_VP9: 'VP9', V_AV1: 'AV1', V_VP8: 'VP8', 'V_MPEG4/ISO/ASP': 'MPEG-4 (DivX or Xvid)', 'V_MPEG4/ISO/SP': 'MPEG-4', 'V_MPEG4/ISO/AP': 'MPEG-4', V_MPEG2: 'MPEG-2', V_MPEG1: 'MPEG-1', V_THEORA: 'Theora', 'V_MS/VFW/FOURCC': 'an old Windows codec', 'V_REAL/RV40': 'RealVideo', V_PRORES: 'ProRes' };
const MKV_AUDIO_NAMES = { A_AAC: 'AAC', A_AC3: 'Dolby Digital (AC-3)', A_EAC3: 'Dolby Digital Plus (E-AC-3)', A_DTS: 'DTS', A_TRUEHD: 'Dolby TrueHD', A_OPUS: 'Opus', A_VORBIS: 'Vorbis', A_FLAC: 'FLAC', 'A_MPEG/L3': 'MP3', 'A_MPEG/L2': 'MP2', A_MLP: 'MLP', 'A_PCM/INT/LIT': 'PCM', 'A_PCM/INT/BIG': 'PCM', 'A_PCM/FLOAT/IEEE': 'PCM', A_ALAC: 'Apple Lossless', 'A_REAL/COOK': 'RealAudio' };
const mkvCodecName = t => (t.type === 1 ? MKV_VIDEO_NAMES : MKV_AUDIO_NAMES)[t.codec] || (t.codec.startsWith('A_AAC') ? 'AAC' : t.codec.startsWith('A_DTS') ? 'DTS' : t.codec.replace(/^[AVS]_/, '') || 'an unknown codec');
/** what MP4 needs for a video track: sample entry, codec string, or why it can't be done */
function mkvVideoStream(t) {
  const v = t.video || { w: 0, h: 0 };
  const w = v.w || 640, h = v.h || 360;
  let dw = w, dh = h;
  if (v.dw && v.dh && !v.du) { dw = v.dw; dh = v.dh; }
  const extra = [];
  if (dw * h !== dh * w) { const hs = dw * h, vs = dh * w, g = mp4Gcd(hs, vs); extra.push(mp4Box('pasp', mp4U32(hs / g), mp4U32(vs / g))); }
  const c = t.priv;
  let entry = null, codec = '';
  if (t.codec === 'V_MPEG4/ISO/AVC' && c && c.length > 6) {
    codec = 'avc1.' + hex2(c[1]) + hex2(c[2]) + hex2(c[3]);
    entry = mp4Visual('avc1', w, h, mp4Box('avcC', c), ...extra);
  } else if (t.codec === 'V_MPEGH/ISO/HEVC' && c && c.length > 22) {
    let compat = ((c[2] << 24) | (c[3] << 16) | (c[4] << 8) | c[5]) >>> 0, rev = 0;
    for (let i = 0; i < 32; i++) { rev = (rev * 2) + (compat & 1); compat >>>= 1; }
    const cons = [c[6], c[7], c[8], c[9], c[10], c[11]];
    while (cons.length && !cons[cons.length - 1]) cons.pop();
    const space = c[1] >> 6;
    codec = 'hvc1.' + (space ? String.fromCharCode(64 + space) : '') + (c[1] & 31) + '.' + rev.toString(16) + '.' + ((c[1] >> 5) & 1 ? 'H' : 'L') + c[12] + cons.map(b => '.' + b.toString(16)).join('');
    entry = mp4Visual('hvc1', w, h, mp4Box('hvcC', c), ...extra);
  } else if (t.codec === 'V_VP9') {
    const f = { 1: 0, 2: 10, 3: 8, 4: 1 };
    if (c) for (let i = 0; i + 2 < c.length; i += 2 + c[i + 1]) f[c[i]] = c[i + 2];
    codec = 'vp09.' + String(f[1]).padStart(2, '0') + '.' + String(f[2] || 10).padStart(2, '0') + '.' + String(f[3] || 8).padStart(2, '0');
    entry = mp4Visual('vp09', w, h, mp4Full('vpcC', 1, 0, mp4U8(f[1], f[2] || 10, ((f[3] || 8) << 4) | ((f[4] || 1) << 1), 2, 2, 2), mp4U16(0)), ...extra);
  } else if (t.codec === 'V_AV1' && c && c.length >= 4) {
    const depth = (c[2] >> 6) & 1 ? ((c[2] >> 5) & 1 ? 12 : 10) : 8;
    codec = 'av01.' + (c[1] >> 5) + '.' + String(c[1] & 31).padStart(2, '0') + (c[2] >> 7 ? 'H' : 'M') + '.' + String(depth).padStart(2, '0');
    entry = mp4Visual('av01', w, h, mp4Box('av1C', c), ...extra);
  }
  if (!entry) return { error: mkvCodecName(t) };
  return { kind: 'video', t, entry, codec, mime: 'video/mp4; codecs="' + codec + '"', scale: 90000, dw, dh, w, h, name: mkvCodecName(t) };
}
const AAC_RATES = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
function aacConfig(t) {
  let c = t.priv;
  if (!c || c.length < 2) {
    // old MKV files name the profile in the codec ID instead
    const aot = /MAIN/.test(t.codec) ? 1 : /SSR/.test(t.codec) ? 3 : /LTP/.test(t.codec) ? 4 : 2;
    const rate = t.audio ? t.audio.rate : 44100;
    let sfi = AAC_RATES.indexOf(Math.round(rate));
    if (sfi < 0) sfi = 4;
    const ch = t.audio ? t.audio.channels : 2;
    c = mp4U8((aot << 3) | (sfi >> 1), ((sfi & 1) << 7) | (ch << 3));
  }
  const br = new MkvBits(c, 0);
  let aot = br.read(5);
  if (aot === 31) aot = 32 + br.read(6);
  const sfi = br.read(4);
  const rate = sfi === 15 ? br.read(24) : AAC_RATES[sfi] || 44100;
  const ch = br.read(4);
  return { asc: c, aot, rate, ch: ch || (t.audio ? t.audio.channels : 2) };
}
function ac3Info(f) {
  if (!f || f.length < 8 || f[0] !== 0x0B || f[1] !== 0x77) return null;
  const fscod = f[4] >> 6, frmsizecod = f[4] & 63, bsid = f[5] >> 3, bsmod = f[5] & 7;
  const br = new MkvBits(f, 48);
  const acmod = br.read(3);
  if ((acmod & 1) && acmod !== 1) br.read(2);
  if (acmod & 4) br.read(2);
  if (acmod === 2) br.read(2);
  const lfeon = br.read(1);
  const dac3 = new MkvBitWriter().put(fscod, 2).put(bsid, 5).put(bsmod, 3).put(acmod, 3).put(lfeon, 1).put(frmsizecod >> 1, 5).put(0, 5).bytes();
  return { rate: [48000, 44100, 32000][fscod] || 48000, ch: [2, 1, 2, 3, 3, 4, 4, 5][acmod] + lfeon, samples: 1536, box: mp4Box('dac3', dac3) };
}
function eac3Info(f) {
  if (!f || f.length < 8 || f[0] !== 0x0B || f[1] !== 0x77) return null;
  const br = new MkvBits(f, 16);
  br.read(2); br.read(3);
  const frmsiz = br.read(11), fscod = br.read(2);
  let fscod2 = 0, numblkscod = 3;
  if (fscod === 3) fscod2 = br.read(2); else numblkscod = br.read(2);
  const acmod = br.read(3), lfeon = br.read(1), bsid = br.read(5);
  const rate = fscod === 3 ? [24000, 22050, 16000][fscod2] || 24000 : [48000, 44100, 32000][fscod];
  const samples = 256 * [1, 2, 3, 6][numblkscod];
  const kbps = Math.round(((frmsiz + 1) * 2 * 8 * rate) / samples / 1000);
  const dec3 = new MkvBitWriter().put(kbps, 13).put(0, 3).put(fscod === 3 ? 0 : fscod, 2).put(bsid, 5).put(0, 1).put(0, 1).put(0, 3).put(acmod, 3).put(lfeon, 1).put(0, 3).put(0, 4).put(0, 1).bytes();
  return { rate, ch: [2, 1, 2, 3, 3, 4, 4, 5][acmod] + lfeon, samples, box: mp4Box('dec3', dec3) };
}
function mkvMp3Info(f) {
  if (!f || f.length < 4 || f[0] !== 0xFF || (f[1] & 0xE0) !== 0xE0) return null;
  const ver = (f[1] >> 3) & 3, layer = (f[1] >> 1) & 3, sri = (f[2] >> 2) & 3;
  const rates = ver === 3 ? [44100, 48000, 32000] : ver === 2 ? [22050, 24000, 16000] : [11025, 12000, 8000];
  return { rate: rates[sri] || 44100, ch: (f[3] >> 6) === 3 ? 1 : 2, samples: layer === 1 ? (ver === 3 ? 1152 : 576) : layer === 2 ? 1152 : 384, oti: ver === 3 ? 0x6B : 0x69 };
}
function opusSamples(f) {
  if (!f || !f.length) return 960;
  const cfg = f[0] >> 3, c = f[0] & 3;
  const size = cfg < 12 ? [480, 960, 1920, 2880][cfg & 3] : cfg < 16 ? [480, 960][cfg & 1] : [120, 240, 480, 960][cfg & 3];
  return size * (c === 0 ? 1 : c === 3 ? (f[1] & 63) || 1 : 2);
}
function flacSamples(f, fallback) {
  if (!f || f.length < 6 || f[0] !== 0xFF || (f[1] & 0xFE) !== 0xF8) return fallback;
  const bs = f[2] >> 4;
  if (bs === 1) return 192;
  if (bs >= 2 && bs <= 5) return 576 << (bs - 2);
  if (bs >= 8) return 256 << (bs - 8);
  if (bs !== 6 && bs !== 7) return fallback;
  const b = f[4];
  const n = b < 0x80 ? 1 : b < 0xE0 ? 2 : b < 0xF0 ? 3 : b < 0xF8 ? 4 : b < 0xFC ? 5 : b < 0xFE ? 6 : 7;
  const p = 4 + n;
  return bs === 6 ? f[p] + 1 : ((f[p] << 8) | f[p + 1]) + 1;
}
/** what MP4 needs for a sound track (first = the track's first frame, for codecs that describe themselves there) */
function mkvAudioStream(t, first) {
  const a = t.audio || { rate: 48000, channels: 2 };
  const fr = t.strip && first ? mkvJoin(t.strip, first) : first;
  let entry = null, codec = '', rate = Math.round(a.rate) || 48000, samples = () => 1024;
  if (t.codec.startsWith('A_AAC')) {
    const c = aacConfig(t);
    rate = c.rate;
    codec = 'mp4a.40.' + c.aot;
    entry = mp4Sound('mp4a', c.ch, rate, 16, mp4Esds(0x40, c.asc));
  } else if (t.codec === 'A_AC3') {
    const i = ac3Info(fr);
    if (i) { rate = i.rate; codec = 'ac-3'; entry = mp4Sound('ac-3', i.ch, rate, 16, i.box); samples = () => 1536; }
  } else if (t.codec === 'A_EAC3') {
    const i = eac3Info(fr);
    if (i) { rate = i.rate; codec = 'ec-3'; entry = mp4Sound('ec-3', i.ch, rate, 16, i.box); samples = () => i.samples; }
  } else if (t.codec === 'A_MPEG/L3' || t.codec === 'A_MPEG/L2') {
    const i = mkvMp3Info(fr);
    if (i) { rate = i.rate; codec = 'mp4a.' + i.oti.toString(16).toUpperCase(); entry = mp4Sound('mp4a', i.ch, rate, 16, mp4Esds(i.oti, null)); samples = () => i.samples; }
  } else if (t.codec === 'A_OPUS' && t.priv && t.priv.length >= 19) {
    const h = t.priv, ch = h[9], fam = h[18];
    const dops = mp4Box('dOps', mp4U8(0, ch), mp4U16(h[10] | (h[11] << 8)), mp4U32((h[12] | (h[13] << 8) | (h[14] << 16) | (h[15] << 24)) >>> 0), mp4U16(h[16] | (h[17] << 8)), mp4U8(fam), fam ? h.subarray(19, 21 + ch) : mp4Zero(0));
    rate = 48000; codec = 'opus'; entry = mp4Sound('Opus', ch, 48000, 16, dops); samples = opusSamples;
  } else if (t.codec === 'A_FLAC' && t.priv && t.priv.length >= 42 && t.priv[0] === 0x66) {
    const si = t.priv.slice(4, 8 + 34);
    si[0] = 0x80;                                          // STREAMINFO, and the last block we pass on
    const d = si.subarray(4);
    rate = (d[10] << 12) | (d[11] << 4) | (d[12] >> 4);
    const ch = ((d[12] >> 1) & 7) + 1, bits = (((d[12] & 1) << 4) | (d[13] >> 4)) + 1;
    const fallback = t.dur ? Math.round((t.dur / 1e9) * rate) : 4096;
    codec = 'flac'; entry = mp4Sound('fLaC', ch, rate, bits, mp4Full('dfLa', 0, 0, si)); samples = f => flacSamples(f, fallback);
  }
  if (!entry) return { error: mkvCodecName(t) };
  return { kind: 'audio', t, entry, codec, mime: 'audio/mp4; codecs="' + codec + '"', scale: rate, rate, samples, name: mkvCodecName(t) };
}
const MKV_LANGS = { eng: 'en', spa: 'es', fre: 'fr', fra: 'fr', ger: 'de', deu: 'de', ita: 'it', por: 'pt', jpn: 'ja', chi: 'zh', zho: 'zh', kor: 'ko', rus: 'ru', dut: 'nl', nld: 'nl', swe: 'sv', nor: 'no', nob: 'no', dan: 'da', fin: 'fi', pol: 'pl', tur: 'tr', ara: 'ar', heb: 'he', hin: 'hi', gre: 'el', ell: 'el', cze: 'cs', ces: 'cs', hun: 'hu', rum: 'ro', ron: 'ro', tha: 'th', vie: 'vi', ind: 'id', ukr: 'uk' };
const MKV_LANG_NAMES = { en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian', pt: 'Portuguese', ja: 'Japanese', zh: 'Chinese', ko: 'Korean', ru: 'Russian', nl: 'Dutch', sv: 'Swedish', no: 'Norwegian', da: 'Danish', fi: 'Finnish', pl: 'Polish', tr: 'Turkish', ar: 'Arabic', he: 'Hebrew', hi: 'Hindi', el: 'Greek', cs: 'Czech', hu: 'Hungarian', ro: 'Romanian', th: 'Thai', vi: 'Vietnamese', id: 'Indonesian', uk: 'Ukrainian' };
const mkvLang = t => (t.ietf ? t.ietf.split('-')[0] : MKV_LANGS[t.lang] || (t.lang && t.lang !== 'und' ? t.lang : '')) || '';
/** subtitles stored as text in the file become cues */
function mkvSubStream(t) {
  if (!/^S_TEXT\/(UTF8|ASCII|ASS|SSA|WEBVTT)$/.test(t.codec)) return null;
  const ass = /ASS|SSA/.test(t.codec);
  // players pick subtitle tracks by language code, so a track without one still needs a code of its own
  const lang = mkvLang(t) || 'und-' + t.number;
  const text = f => {
    let s = new TextDecoder().decode(t.strip ? mkvJoin(t.strip, f) : f);
    if (ass) s = s.split(',').slice(8).join(',').replace(/\{[^}]*\}/g, '').replace(/\\[Nn]/g, '\n').replace(/\\h/g, ' ');
    return s.replace(/\r/g, '').trim();
  };
  return { kind: 'sub', t, lang, label: (t.name || MKV_LANG_NAMES[lang] || (/^und/.test(lang) ? 'Subtitles' : lang.toUpperCase())) + (t.forced && !/forced/i.test(t.name) ? ' (forced)' : ''), text };
}

/* ---------------- repackaging: clusters in, MP4 fragments out ---------------- */
class MkvMux {
  /** opts.supports(mime): can this browser play it through Media Source Extensions? */
  constructor(m, opts = {}) {
    this.m = m; this.sc = m.sc; this.supports = opts.supports || (() => true);
    this.v = null; this.a = null; this.subs = new Map(); this.problem = ''; this.note = '';
    this.seq = 1; this.index = []; this.T0 = 0; this.D = 0; this.fdT = 3600;
  }
  get duration() { return this.m.duration; }
  async setup() {
    const m = this.m;
    // the first few clusters show how the video is ordered and what the sound looks like
    const peek = [];
    let pos = m.first;
    for (let i = 0; i < 4 && pos < m.segEnd; i++) {
      const cl = await mkvReadCluster(m, pos);
      if (!cl) break;
      peek.push(cl); this.learn(cl); pos = cl.end;
      if (peek.reduce((n, c) => n + c.blocks.length, 0) > 400) break;
    }
    const firstFrame = num => { for (const cl of peek) for (const b of cl.blocks) if (b.track === num && b.frames.length) return b.frames[0]; return null; };
    const usable = t => t.enabled && !t.encoded;
    const byPref = list => list.slice().sort((x, y) => (y.def - x.def) || (x.number - y.number));
    // picture
    const vids = byPref(m.tracks.filter(t => t.type === 1 && usable(t)));
    for (const t of vids) {
      const s = mkvVideoStream(t);
      if (s.error) { this.problem = this.problem || 'This video is ' + s.error + ', which browsers can\'t play. Download it to watch it in another player.'; continue; }
      if (!this.supports(s.mime)) { this.problem = 'This video is ' + s.name + ', and this browser can\'t decode ' + s.name.replace(/ \(.*\)$/, '') + '.' + (/HEVC/.test(s.name) ? ' Safari usually can, and so can Chrome and Edge on computers with H.265 hardware decoding.' : ''); continue; }
      this.v = s; this.problem = ''; break;
    }
    if (!vids.length && m.tracks.some(t => t.type === 1 && t.encoded)) this.problem = 'This MKV file is compressed or encrypted in a way LANscape can\'t read.';
    // sound: the main track if this browser can play it; otherwise another in the same language, commentary last
    const auds = m.tracks.filter(t => t.type === 2 && usable(t));
    const main = auds.find(t => t.def) || auds[0];
    const score = t => (t === main ? 8 : 0) + (main && t.lang === main.lang ? 2 : 0) - (/comment/i.test(t.name) ? 4 : 0);
    const refused = [];
    for (const t of auds.slice().sort((x, y) => score(y) - score(x) || x.number - y.number)) {
      const s = mkvAudioStream(t, firstFrame(t.number));
      if (s.error || !this.supports(s.mime)) { refused.push(s.name || s.error); continue; }
      this.a = s; break;
    }
    if (!this.a && refused.length) this.note = 'Playing without sound: this browser can\'t play ' + uniqFrom(refused).join(' or ') + ' sound' + (refused.some(r => /Dolby/.test(r)) ? ' (Safari can)' : '') + '.';
    else if (this.a && main && this.a.t !== main) this.note = 'This browser can\'t play the main sound track (' + mkvCodecName(main) + '), so you\'re hearing ' + (this.a.t.name ? '"' + this.a.t.name + '"' : 'another one') + ' (' + this.a.name + ') instead.';
    if (!this.v && !this.problem && !this.a) this.problem = 'LANscape couldn\'t find anything it can play in this MKV file.';
    for (const t of m.tracks) if (t.type === 17 && !t.encoded) { const s = mkvSubStream(t); if (s) this.subs.set(t.number, s); }
    // video stored out of display order (B-frames) needs decode times ahead of display times
    if (this.v) {
      const num = this.v.t.number, ts = [];
      for (const cl of peek) for (const b of cl.blocks) if (b.track === num) ts.push(b.time * this.sc);
      let depth = 0;
      for (let i = 0; i < ts.length; i++) { let c = 0; for (let j = Math.max(0, i - 24); j < i; j++) if (ts[j] > ts[i] + 1e-6) c++; if (c > depth) depth = c; }
      let fd = this.v.t.dur ? this.v.t.dur / 1e9 : 0;
      if (!fd) { const s = Array.from(new Set(ts)).sort((x, y) => x - y), d = []; for (let i = 1; i < s.length; i++) d.push(s[i] - s[i - 1]); d.sort((x, y) => x - y); fd = d.length ? d[d.length >> 1] : 0.04; }
      fd = Math.min(Math.max(fd || 0.04, 0.001), 1);
      this.fdS = fd; this.fdT = Math.max(1, Math.round(fd * 90000));
      this.D = depth ? depth + 1 : 0;
      this.T0 = this.D ? (this.D + 1) * fd : 0;
    }
    // nothing may start before zero: sound with a codec delay or blocks stamped a little early move everything along
    let minT = 0;
    for (const cl of peek) for (const b of cl.blocks) {
      if (this.v && b.track === this.v.t.number) minT = Math.min(minT, b.time * this.sc);
      else if (this.a && b.track === this.a.t.number) minT = Math.min(minT, b.time * this.sc - (this.a.t.delay || 0) / 1e9);
    }
    this.T0 = Math.max(this.T0, -minT);
    this.cueList = (m.cues || []).filter(c => !this.v || !c.track || c.track === this.v.t.number);
    if (!this.cueList.length) this.cueList = null;
    this.restart(0);
    return this;
  }
  init(kind) { const s = kind === 'video' ? this.v : this.a; return s ? mp4Init(s) : null; }
  /** start over at file time t (seconds): after a jump, video waits for a keyframe */
  restart(t) {
    this.vs = { needKey: true, win: null, last: null, lead: false, lastDur: this.fdT };
    this.as = { next: null };
    this.target = t;
    this.snapTo = null;
  }
  /** remember where clusters start, for jumping around in files without an index */
  learn(cl) {
    const idx = this.index;
    let lo = 0, hi = idx.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (idx[mid].pos < cl.pos) lo = mid + 1; else hi = mid; }
    if (idx[lo] && idx[lo].pos === cl.pos) return;
    idx.splice(lo, 0, { pos: cl.pos, end: cl.end, time: cl.time });
  }
  /** where to start reading for file time t */
  async posFor(t) {
    const m = this.m;
    if (t <= 0.01) return m.first;
    const units = t / this.sc;
    if (this.cueList) {
      let best = null;
      for (const c of this.cueList) { if (c.time <= units) best = c; else break; }
      return best ? m.seg + best.cl : m.first;
    }
    // no index in the file: walk the cluster headers (cheap) until we pass t
    let last = this.index[this.index.length - 1];
    let pos = last ? last.end : m.first;
    while ((!last || last.time <= units) && pos < m.segEnd) {
      const buf = await mkvRead(m, pos, 256);
      const h = ebmlHead(buf, 0);
      if (!h || h.id !== MKV.Cluster || h.size < 0) break;
      let time = null;
      for (const k of ebmlKids(buf, h.hlen, buf.length)) if (k.id === MKV.Timecode) { time = ebmlUint(buf, k.dpos, k.size); break; }
      if (time == null) break;
      last = { pos, end: pos + h.hlen + h.size, time };
      this.index.push(last);
      pos = last.end;
    }
    let best = null;
    for (const c of this.index) { if (c.time <= units) best = c; else break; }
    return best ? best.pos : m.first;
  }
  /** decode times for video stored out of order: the smallest of the last D+1 display times */
  vDts(pts) {
    const st = this.vs;
    let dts = pts;
    if (this.D) {
      if (!st.win) { st.win = []; for (let k = this.D + 1; k >= 1; k--) st.win.push(pts - k * this.fdT); }
      st.win[0] = pts;
      for (let i = 0; i < this.D && st.win[i] > st.win[i + 1]; i++) { const x = st.win[i]; st.win[i] = st.win[i + 1]; st.win[i + 1] = x; }
      dts = st.win[0];
    }
    if (st.last != null && dts <= st.last) dts = st.last + 1;
    st.last = dts;
    return dts;
  }
  /** one cluster -> {video, audio} fragments, subtitle cues, and how far it reaches (media seconds) */
  mux(cl) {
    const out = { video: null, audio: null, cues: [], until: 0, keyAt: null };
    const V = this.v, A = this.a, sc = this.sc, T0 = this.T0;
    const vs = [], as = [];
    for (const b of cl.blocks) {
      if (V && b.track === V.t.number) {
        const st = this.vs;
        for (let k = 0; k < b.frames.length; k++) {
          const sec = b.time * sc + k * (this.fdS || 0);
          const key = b.key && k === 0;
          if (st.needKey) {
            if (!key) continue;
            st.needKey = false; st.keyPts = sec; st.lead = true;
            out.keyAt = sec;
            if (!this.cueList && sec > this.target + 0.25) this.snapTo = sec + T0;
          } else if (key) st.lead = false;
          if (st.lead && !key && sec < st.keyPts) continue;   // pictures of an open GOP that lean on what came before the jump
          const pts = Math.round((sec + T0) * 90000);
          if (pts < 0) continue;
          const data = V.t.strip ? mkvJoin(V.t.strip, b.frames[k]) : b.frames[k];
          vs.push({ pts, dts: this.vDts(pts), key, data });
        }
      } else if (A && b.track === A.t.number) {
        const st = this.as;
        let t = b.time * sc - (A.t.delay || 0) / 1e9 + T0;
        for (const f0 of b.frames) {
          const f = A.t.strip ? mkvJoin(A.t.strip, f0) : f0;
          const n = A.samples(f);
          let tick = Math.round(t * A.rate);
          // sound stays sample-exact from frame to frame; a real gap starts the clock again
          if (st.next != null && Math.abs(tick - st.next) <= Math.max(2 * n, A.rate * 0.06)) tick = st.next;
          st.next = tick + n;
          t = (tick + n) / A.rate;
          if (tick < 0) continue;
          as.push({ pts: tick, dur: n, data: f });
        }
      } else if (this.subs.has(b.track)) {
        const s = this.subs.get(b.track);
        const start = b.time * sc + T0, end = start + (b.dur != null ? b.dur * sc : 4);
        for (const f of b.frames) { const text = s.text(f); if (text) out.cues.push({ track: b.track, start, end, text }); }
      }
    }
    if (vs.length) {
      const st = this.vs;
      const samples = vs.map((s, i) => {
        const dur = i + 1 < vs.length ? Math.max(1, vs[i + 1].dts - s.dts) : st.lastDur;
        if (i + 1 < vs.length) st.lastDur = dur;
        return { dur, flags: s.key ? 0x02000000 : 0x01010000, cto: s.pts - s.dts, data: s.data };
      });
      out.video = mp4Fragment(this.seq++, vs[0].dts, samples);
      out.until = Math.max(...vs.map(s => s.pts)) / 90000 + (this.fdS || 0);
    }
    if (as.length) {
      out.audio = mp4Fragment(this.seq++, as[0].pts, as.map(s => ({ dur: s.dur, flags: 0x02000000, cto: 0, data: s.data })));
      const last = as[as.length - 1];
      out.until = Math.max(out.until, (last.pts + last.dur) / A.rate);
    }
    if (!vs.length && !as.length) out.until = cl.time * sc + T0;
    return out;
  }
}
const uniqFrom = arr => Array.from(new Set(arr));

/* ---------------- playing: Media Source Extensions ---------------- */
function mkvSupports(mime) {
  try {
    const MS = window.MediaSource || window.ManagedMediaSource;
    return !!(MS && MS.isTypeSupported(mime));
  } catch (e) { return false; }
}
const mkvCan = () => typeof window !== 'undefined' && !!(window.MediaSource || window.ManagedMediaSource);
const mkvOnce = (t, ev, ms) => new Promise(res => { const done = () => { t.removeEventListener(ev, done); res(); }; t.addEventListener(ev, done); if (ms) setTimeout(done, ms); });
class MkvPlayer {
  static async open(blob) {
    const m = await mkvOpen(blob);
    const x = new MkvMux(m, { supports: mkvSupports });
    await x.setup();
    return new MkvPlayer(x);
  }
  constructor(x) { this.x = x; this.gen = 0; this.waiters = []; this.seen = new Set(); this.maxAhead = 40; this.sbs = []; this.video = null; }
  get problem() { return this.x.problem; }
  get note() { return this.x.note; }
  get duration() { return this.x.duration; }
  get T0() { return this.x.T0; }
  get info() { const x = this.x; return { video: x.v ? x.v.name : '', audio: x.a ? x.a.name : '', subs: x.subs.size, width: x.v ? x.v.dw : 0, height: x.v ? x.v.dh : 0 }; }
  /** play through a video element, starting at media time `at` (seconds) */
  async attach(video, at) {
    const W = (video.ownerDocument && video.ownerDocument.defaultView) || window;
    const MS = W.MediaSource || W.ManagedMediaSource;
    if (!MS) throw new Error('This browser can\'t stream video from a page.');
    const x = this.x;
    this.video = video; this.W = W;
    const ms = this.ms = new MS();
    if (W.ManagedMediaSource && ms instanceof W.ManagedMediaSource) video.disableRemotePlayback = true;
    this.url = W.URL.createObjectURL(ms);
    const opened = mkvOnce(ms, 'sourceopen', 8000);
    video.src = this.url;
    await opened;
    if (ms.readyState !== 'open') throw new Error('The video couldn\'t be opened.');
    try { if (x.duration) ms.duration = x.duration + x.T0; } catch (e) { /* fine */ }
    // every SourceBuffer has to exist before the first one gets data (Chrome won't add one after that)
    if (x.v) { this.vsb = ms.addSourceBuffer(x.v.mime); this.sbs.push(this.vsb); }
    if (x.a) { this.asb = ms.addSourceBuffer(x.a.mime); this.sbs.push(this.asb); }
    if (x.v) await this.push(this.vsb, x.init('video'));
    if (x.a) await this.push(this.asb, x.init('audio'));
    this.tracks = new Map();
    for (const s of x.subs.values()) {
      try { const tr = video.addTextTrack('subtitles', s.label, s.lang); tr.mode = 'disabled'; this.tracks.set(s.t.number, tr); } catch (e) { /* no text tracks here */ }
    }
    this.onSeeking = () => this.seeking();
    this.onTick = () => this.wake();
    video.addEventListener('seeking', this.onSeeking);
    for (const ev of ['timeupdate', 'playing', 'waiting', 'progress', 'play', 'pause']) video.addEventListener(ev, this.onTick);
    const start = Math.max(0, (at || 0) - x.T0);
    this.restart(start);
    // the picture starts a moment after zero when decode times run ahead of display times
    if (!at && x.T0) video.addEventListener('loadedmetadata', () => { if (video.currentTime < x.T0) { try { video.currentTime = x.T0; } catch (e) { /* fine */ } } }, { once: true });
    return this;
  }
  detach() {
    this.gen++;
    this.wake();
    const v = this.video;
    if (v) { v.removeEventListener('seeking', this.onSeeking); for (const ev of ['timeupdate', 'playing', 'waiting', 'progress', 'play', 'pause']) v.removeEventListener(ev, this.onTick); }
    if (this.url) { try { this.W.URL.revokeObjectURL(this.url); } catch (e) { /* gone */ } this.url = null; }
  }
  wake() { const w = this.waiters; this.waiters = []; for (const f of w) f(); }
  wait(ms) { return new Promise(res => { this.waiters.push(res); setTimeout(res, ms); }); }
  /** seconds buffered ahead of the playhead */
  ahead() {
    const t = this.video.currentTime;
    let best = Infinity;
    for (const sb of this.sbs) {
      let e = 0;
      try { const b = sb.buffered; for (let i = 0; i < b.length; i++) if (b.start(i) <= t + 0.3 && b.end(i) > t) e = b.end(i) - t; } catch (err) { e = 0; }
      best = Math.min(best, e);
    }
    return best === Infinity ? 0 : best;
  }
  covered(t) {
    // just ahead of where we're reading: it'll be there in a moment
    if (t >= Math.max(this.feedFrom - 0.05, this.feedAt - 1) && t <= this.feedAt + 6) return true;
    if (!this.sbs.length) return false;
    return this.sbs.every(sb => { try { const b = sb.buffered; for (let i = 0; i < b.length; i++) if (b.start(i) <= t + 0.05 && b.end(i) > t + 0.5) return true; } catch (e) { /* removed */ } return false; });
  }
  seeking() {
    const t = this.video.currentTime;
    if (this.covered(t)) { this.wake(); return; }
    this.restart(Math.max(0, t - this.x.T0));
  }
  async restart(t) {
    const gen = ++this.gen;
    this.wake();
    this.ended = false;
    this.feedFrom = t + this.x.T0; this.feedAt = this.feedFrom;
    let pos;
    try { pos = await this.x.posFor(t); } catch (e) { pos = this.x.m.first; }
    if (gen !== this.gen) return;
    this.x.restart(t);
    this.loop(gen, pos);
  }
  async loop(gen, pos) {
    const x = this.x, v = this.video;
    try {
      while (gen === this.gen && pos != null && pos < x.m.segEnd) {
        while (gen === this.gen && this.ahead() > this.maxAhead) await this.wait(1000);
        if (gen !== this.gen) return;
        const cl = await mkvReadCluster(x.m, pos);
        if (gen !== this.gen) return;
        if (!cl) break;
        x.learn(cl);
        const f = x.mux(cl);
        await this.trim(gen);
        if (f.video) await this.push(this.vsb, f.video, gen);
        if (f.audio) await this.push(this.asb, f.audio, gen);
        if (gen !== this.gen) return;
        for (const c of f.cues) this.cue(c);
        this.feedAt = Math.max(this.feedAt, f.until);
        // without an index in the file, a jump lands on the next keyframe
        if (x.snapTo != null) { const s = x.snapTo; x.snapTo = null; if (v.currentTime < s - 0.05) { this.feedFrom = Math.min(this.feedFrom, s); try { v.currentTime = s + 0.001; } catch (e) { /* fine */ } } }
        pos = cl.end;
      }
      if (gen !== this.gen) return;
      this.ended = true;
      for (const sb of this.sbs) if (sb.updating) await mkvOnce(sb, 'updateend', 5000);
      if (gen === this.gen && this.ms.readyState === 'open') { try { this.ms.endOfStream(); } catch (e) { /* fine */ } }
    } catch (e) {
      if (gen !== this.gen) return;
      console.warn('MKV playback:', e);
      if (this.onerror) this.onerror(e);
    }
  }
  /** append, making room when the browser's buffer is full */
  async push(sb, data, gen) {
    if (!sb || !data) return;
    for (let tries = 0; tries < 8; tries++) {
      if (sb.updating) await mkvOnce(sb, 'updateend', 10000);
      if (gen != null && gen !== this.gen) return;
      try {
        sb.appendBuffer(data);
        await mkvOnce(sb, 'updateend', 20000);
        return;
      } catch (e) {
        if (!e || e.name !== 'QuotaExceededError') throw e;
        this.maxAhead = Math.max(6, this.maxAhead * 0.6);
        await this.trim(gen, true);
        if (this.ahead() > 4) await this.wait(1500);
      }
    }
    throw new Error('The browser ran out of room for this video.');
  }
  /** let go of what has already played */
  async trim(gen, hard) {
    const t = this.video.currentTime, keep = hard ? 2 : 25;
    for (const sb of this.sbs) {
      try {
        const b = sb.buffered;
        if (!b.length || b.start(0) >= t - keep - 2) continue;
        if (sb.updating) await mkvOnce(sb, 'updateend', 10000);
        if (gen != null && gen !== this.gen) return;
        sb.remove(0, Math.max(0.1, t - keep));
        await mkvOnce(sb, 'updateend', 10000);
      } catch (e) { /* nothing to trim */ }
    }
  }
  cue(c) {
    const tr = this.tracks && this.tracks.get(c.track);
    if (!tr) return;
    const key = c.track + ':' + Math.round(c.start * 1000) + ':' + c.text;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    try { tr.addCue(new this.W.VTTCue(c.start, Math.max(c.end, c.start + 0.3), c.text)); } catch (e) { /* skip this one */ }
  }
}
