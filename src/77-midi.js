/* ===================================================================
   MIDI: the background music of the 90s web. A Standard MIDI File is
   parsed, played by a small synthesizer in an OfflineAudioContext,
   and handed to the Player as a WAV it can stream and seek.
   =================================================================== */
const MIDI_EXT = /\.(mid|midi|kar|rmi)$/i;
function parseMidi(u8) {
  let off = 0;
  if (ascii(u8, 0, 4) === 'RIFF' && ascii(u8, 8, 4) === 'RMID') {
    for (let p = 12; p + 8 <= u8.length;) { const len = u32le(u8, p + 4); if (ascii(u8, p, 4) === 'data') { off = p + 8; break; } p += 8 + len + (len & 1); }
  }
  if (ascii(u8, off, 4) !== 'MThd') throw new Error('This isn\'t a MIDI file.');
  const hlen = u32be(u8, off + 4);
  const format = (u8[off + 8] << 8) | u8[off + 9], ntrks = (u8[off + 10] << 8) | u8[off + 11], division = (u8[off + 12] << 8) | u8[off + 13];
  let p = off + 8 + hlen, seq = 0, name = '', copyright = '', lyrics = 0;
  const events = [];
  for (let t = 0; t < ntrks && p + 8 <= u8.length;) {
    const id = ascii(u8, p, 4), len = u32be(u8, p + 4);
    const end = Math.min(u8.length, p + 8 + len);
    if (id !== 'MTrk') { p = end; continue; }
    let q = p + 8, tick = 0, status = 0;
    const vlq = () => { let v = 0, c; do { c = u8[q++]; v = (v * 128) + (c & 127); } while (c & 128 && q < end); return v; };
    while (q < end) {
      tick += vlq();
      let st = u8[q];
      if (st & 0x80) { q++; if (st < 0xf0) status = st; } else st = status;
      if (!st) break;
      if (st === 0xff) {
        const type = u8[q++], l = vlq(), data = u8.subarray(q, q + l);
        q += l;
        if (type === 0x51 && l === 3) events.push({ tick, k: 'tempo', v: (data[0] << 16) | (data[1] << 8) | data[2], seq: seq++ });
        else if (type === 0x03 && !name && t < 2) name = decodeText(data).replace(/[\u0000-\u001f]/g, '').trim();
        else if (type === 0x02 && !copyright) copyright = decodeText(data).trim();
        else if (type === 0x05) lyrics++;
        else if (type === 0x2f) break;
        continue;
      }
      if (st === 0xf0 || st === 0xf7) { q += vlq(); continue; }
      const hi = st & 0xf0, ch = st & 15;
      const a = u8[q++], b = hi === 0xc0 || hi === 0xd0 ? 0 : u8[q++];
      events.push({ tick, k: hi, ch, a, b, seq: seq++ });
    }
    p = end; t++;
  }
  events.sort((x, y) => x.tick - y.tick || x.seq - y.seq);
  const smpte = division & 0x8000, tps = smpte ? (256 - (division >> 8)) * (division & 0xff) : 0;
  let tempo = 500000, last = 0, sec = 0;
  for (const e of events) {
    const dt = e.tick - last;
    sec += smpte ? dt / tps : (dt * tempo) / 1e6 / (division || 96);
    last = e.tick;
    e.t = sec;
    if (e.k === 'tempo') tempo = e.v || 500000;
  }
  return { format, events, duration: sec, name, copyright, lyrics };
}
async function midiInfo(file) {
  try {
    const m = parseMidi(new Uint8Array(await file.slice(0, Math.min(file.size, 4e6)).arrayBuffer()));
    const notes = m.events.filter(e => e.k === 0x90 && e.b > 0).length;
    return { title: /^(untitled|track ?\d*|sequence|new song)$/i.test(m.name) ? '' : m.name, duration: m.duration, notes, copyright: m.copyright, karaoke: m.lyrics > 10 };
  } catch (e) { return null; }
}
function midiVoice(prog) {
  if (prog < 8) return { type: 'triangle', a: 0.004, d: 1.2, s: 0.18, r: 0.3, g: 0.5, lp: 5200 };       // pianos
  if (prog < 16) return { type: 'sine', a: 0.002, d: 0.6, s: 0, r: 0.5, g: 0.5, lp: 9000 };              // bells & mallets
  if (prog < 24) return { type: 'square', a: 0.012, d: 0.1, s: 0.85, r: 0.06, g: 0.16, lp: 3800 };      // organs
  if (prog < 32) return { type: 'sawtooth', a: 0.003, d: 0.7, s: 0.12, r: 0.18, g: 0.24, lp: 2600 };    // guitars
  if (prog < 40) return { type: 'triangle', a: 0.004, d: 0.4, s: 0.55, r: 0.08, g: 0.75, lp: 1400 };    // basses
  if (prog < 56) return { type: 'sawtooth', a: 0.11, d: 0.3, s: 0.8, r: 0.45, g: 0.15, lp: 2900 };      // strings & choirs
  if (prog < 64) return { type: 'sawtooth', a: 0.035, d: 0.2, s: 0.75, r: 0.12, g: 0.2, lp: 3300 };     // brass
  if (prog < 80) return { type: 'square', a: 0.03, d: 0.15, s: 0.8, r: 0.1, g: 0.15, lp: 3600 };        // reeds & pipes
  if (prog < 88) return { type: 'square', a: 0.004, d: 0.12, s: 0.7, r: 0.08, g: 0.15, lp: 6000 };      // synth leads
  if (prog < 96) return { type: 'sawtooth', a: 0.35, d: 0.6, s: 0.7, r: 0.9, g: 0.12, lp: 1800 };       // pads
  if (prog < 104) return { type: 'sine', a: 0.05, d: 0.6, s: 0.5, r: 0.6, g: 0.3, lp: 5000 };           // effects
  return { type: 'triangle', a: 0.005, d: 0.35, s: 0.4, r: 0.25, g: 0.35, lp: 4500 };
}
async function renderMidi(u8, onProgress) {
  const m = parseMidi(u8);
  const SR = 32000, dur = Math.min(m.duration, 900) + 2.5;
  if (dur < 0.5) throw new Error('This MIDI file has no notes.');
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OAC) throw new Error('This browser can\'t synthesize MIDI.');
  const ac = new OAC(2, Math.ceil(SR * dur), SR);
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.2;
  const master = ac.createGain(); master.gain.value = 0.55;
  master.connect(comp); comp.connect(ac.destination);
  // 16 channel buses with automated volume, pan and tone
  const bus = Array.from({ length: 16 }, (_, ch) => {
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4000; lp.Q.value = 0.5;
    const vol = ac.createGain(); vol.gain.value = 100 / 127;
    const pan = ac.createStereoPanner ? ac.createStereoPanner() : null;
    lp.connect(vol);
    if (pan) { vol.connect(pan); pan.connect(master); } else vol.connect(master);
    return { lp, vol, pan, prog: 0, v: 100, x: 127, sus: false, held: [] };
  });
  const noise = ac.createBuffer(1, SR, SR);
  { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const on = new Map();
  const notes = [];
  for (const e of m.events) {
    if (e.t > 900) break;
    const b = bus[e.ch];
    if (e.k === 0xc0) { b.prog = e.a; if (e.ch !== 9) b.lp.frequency.setValueAtTime(midiVoice(e.a).lp, e.t); }
    else if (e.k === 0xb0) {
      if (e.a === 7) { b.v = e.b; b.vol.gain.setTargetAtTime((b.v / 127) * (b.x / 127), e.t, 0.01); }
      else if (e.a === 11) { b.x = e.b; b.vol.gain.setTargetAtTime((b.v / 127) * (b.x / 127), e.t, 0.01); }
      else if (e.a === 10 && b.pan) b.pan.pan.setValueAtTime(clamp((e.b - 64) / 63, -1, 1), e.t);
      else if (e.a === 64) { const down = e.b >= 64; if (b.sus && !down) { for (const n of b.held) n.t1 = Math.max(n.t1 || 0, e.t); b.held = []; } b.sus = down; }
      else if (e.a === 121) { b.v = 100; b.x = 127; }
      else if (e.a === 123 || e.a === 120) { for (const [k, n] of on) if (n.ch === e.ch) { n.t1 = e.t; on.delete(k); } }
    } else if (e.k === 0x90 && e.b > 0) {
      const key = e.ch * 128 + e.a;
      const prev = on.get(key);
      if (prev) prev.t1 = e.t;
      const n = { ch: e.ch, note: e.a, vel: e.b, t0: e.t, t1: 0, prog: b.prog };
      on.set(key, n); notes.push(n);
    } else if (e.k === 0x80 || (e.k === 0x90 && e.b === 0)) {
      const key = e.ch * 128 + e.a, n = on.get(key);
      if (n) { on.delete(key); if (b.sus) b.held.push(n); else n.t1 = e.t; }
    }
  }
  for (const n of notes) if (!n.t1) n.t1 = Math.min(n.t0 + 6, dur - 1);
  const list = notes.length > 30000 ? notes.slice().sort((a, b) => b.vel - a.vel).slice(0, 30000) : notes;
  let made = 0;
  for (const n of list) {
    const b = bus[n.ch], v = n.vel / 127;
    if (n.ch === 9) { drum(ac, b.lp, noise, n.note, n.t0, v); continue; }
    const V = midiVoice(n.prog);
    const f = 440 * Math.pow(2, (n.note - 69) / 12);
    const len = Math.max(0.03, n.t1 - n.t0);
    const osc = ac.createOscillator(); osc.type = V.type; osc.frequency.value = f;
    const env = ac.createGain();
    const peak = V.g * (0.25 + 0.75 * v * v) * (n.note < 40 ? 1.2 : 1);
    const a = Math.min(V.a, len * 0.5);
    env.gain.setValueAtTime(0, n.t0);
    env.gain.linearRampToValueAtTime(peak, n.t0 + a);
    if (n.t0 + a < n.t1) env.gain.setTargetAtTime(peak * V.s, n.t0 + a, V.d / 3 + 0.001);
    env.gain.setTargetAtTime(0, n.t1, V.r / 3 + 0.005);
    osc.connect(env); env.connect(b.lp);
    osc.start(n.t0); osc.stop(Math.min(dur, n.t1 + V.r * 1.6 + 0.05));
    if (++made % 4000 === 0 && onProgress) { onProgress(made / list.length); await sleep(0); }
  }
  let buf = await ac.startRendering();
  // trim the silent tail
  const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
  let end = buf.length - 1;
  while (end > SR && Math.abs(L[end]) < 0.0015 && Math.abs(R[end]) < 0.0015) end--;
  end = Math.min(buf.length, end + Math.round(SR * 0.15));
  return { wav: wavFromBuffer(buf, end), info: m };
}
function drum(ac, out, noise, note, t, v) {
  const env = (node, g, d) => { const e = ac.createGain(); e.gain.setValueAtTime(g * v, t); e.gain.setTargetAtTime(0, t + 0.002, d / 3); node.connect(e); e.connect(out); return e; };
  const hiss = (type, f, g, d, q) => { const s = ac.createBufferSource(); s.buffer = noise; const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; if (q) fl.Q.value = q; s.connect(fl); env(fl, g, d); s.start(t); s.stop(t + d * 2 + 0.05); };
  const thump = (f0, f1, g, d) => { const o = ac.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d * 0.6); env(o, g, d); o.start(t); o.stop(t + d * 2 + 0.05); };
  if (note === 35 || note === 36) thump(130, 42, 1.3, 0.32);
  else if (note === 38 || note === 40) { hiss('highpass', 1200, 0.55, 0.17); thump(220, 160, 0.4, 0.09); }
  else if (note === 37 || note === 39) hiss('bandpass', 1600, 0.7, 0.12, 1.2);
  else if (note === 42 || note === 44) hiss('highpass', 7500, 0.32, 0.05);
  else if (note === 46) hiss('highpass', 7000, 0.3, 0.32);
  else if (note === 49 || note === 52 || note === 55 || note === 57) hiss('highpass', 5200, 0.34, 1.3);
  else if (note === 51 || note === 53 || note === 59) hiss('bandpass', 8000, 0.25, 0.6, 0.8);
  else if (note >= 41 && note <= 50) { const f = 70 + (note - 41) * 18; thump(f * 1.6, f, 0.8, 0.3); }
  else if (note === 54 || note === 69 || note === 70) hiss('bandpass', 6000, 0.25, 0.08, 2);
  else if (note === 56) { const o = ac.createOscillator(); o.type = 'square'; o.frequency.value = 800; env(o, 0.12, 0.12); o.start(t); o.stop(t + 0.3); }
  else hiss('bandpass', 2500 + (note % 12) * 300, 0.25, 0.1, 1.5);
}
function wavFromBuffer(buf, len) {
  const ch = buf.numberOfChannels, n = Math.min(buf.length, len || buf.length), sr = buf.sampleRate;
  const out = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const w = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true); out.setUint32(24, sr, true);
  out.setUint32(28, sr * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true);
  w(36, 'data'); out.setUint32(40, n * ch * 2, true);
  const data = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const s = Math.max(-1, Math.min(1, data[c][i])); out.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2; }
  return new Blob([out.buffer], { type: 'audio/wav' });
}
const midiCache = new Map();
/** a playable WAV for a MIDI file (rendered once per session) */
async function midiURL(d) {
  const hit = midiCache.get(d.path);
  if (hit && hit.mtime === d.mtime) return hit.url;
  if (hit) URL.revokeObjectURL(hit.url);
  setStatus('Synthesizing ' + d.name + '...');
  const u8 = new Uint8Array(await (await getBlob(d)).arrayBuffer());
  const { wav } = await renderMidi(u8, f => setStatus('Synthesizing ' + d.name + '... ' + Math.round(f * 100) + '%'));
  const url = URL.createObjectURL(wav);
  midiCache.set(d.path, { mtime: d.mtime, url });
  setStatus('Document: Done');
  return url;
}
