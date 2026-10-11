/* ===================================================================
   Demo files: one of everything, made on the spot. Documents, a
   spreadsheet with formulas, a PDF, slides, a ZIP, pictures, songs
   synthesized in the browser (with album art), a MIDI file, and
   screen-saver "TV episodes" recorded from a canvas. Nothing here is
   stored in the HTML except the recipes.
   =================================================================== */
function seeded(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
/* ---------- a tiny chiptune synthesizer ---------- */
function demoSong(sp) {
  const SR = 22050, spb = 60 / sp.bpm, bars = sp.bars || 16, len = bars * 4 * spb + 1.2;
  const N = Math.floor(SR * len), mix = new Float32Array(N);
  const rnd = seeded(sp.seed || 7);
  const scale = sp.minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  const deg2midi = d => sp.key + scale[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
  const osc = (w, ph, duty) => { const p = ph - Math.floor(ph); if (w === 'tri') return 1 - 4 * Math.abs(p - 0.5); if (w === 'saw') return 2 * p - 1; if (w === 'sine') return Math.sin(p * 2 * Math.PI); return p < (duty || 0.5) ? 1 : -1; };
  function note(midi, t0, dur, vol, wave, duty, vib) {
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const i0 = Math.floor(t0 * SR), n = Math.floor((dur + 0.05) * SR);
    let ph = 0;
    for (let i = 0; i < n && i0 + i < N; i++) {
      const t = i / SR;
      const env = t < 0.004 ? t / 0.004 : t < dur ? 0.65 + 0.35 * Math.exp(-(t - 0.004) / 0.09) : Math.max(0, 0.65 * (1 - (t - dur) / 0.05));
      ph += (f * (vib ? 1 + 0.004 * Math.sin(t * 34) : 1)) / SR;
      mix[i0 + i] += osc(wave, ph, duty) * env * vol;
    }
  }
  function drum(kind, t0, vol) {
    const i0 = Math.floor(t0 * SR);
    if (kind === 'k') { let ph = 0; for (let i = 0; i < SR * 0.28 && i0 + i < N; i++) { const t = i / SR, f = 45 + 110 * Math.exp(-t / 0.035); ph += f / SR; mix[i0 + i] += Math.sin(ph * 2 * Math.PI) * Math.exp(-t / 0.11) * vol; } }
    else if (kind === 's') { for (let i = 0; i < SR * 0.18 && i0 + i < N; i++) { const t = i / SR; mix[i0 + i] += ((rnd() * 2 - 1) * 0.8 + Math.sin(t * 190 * 2 * Math.PI) * 0.5) * Math.exp(-t / 0.05) * vol; } }
    else { let prev = 0; for (let i = 0; i < SR * 0.05 && i0 + i < N; i++) { const t = i / SR, x = rnd() * 2 - 1; mix[i0 + i] += (x - prev) * 0.5 * Math.exp(-t / 0.012) * vol; prev = x; } }
  }
  // the hook: a two-bar motif, re-pitched over each chord
  const rhythm = sp.rhythm || [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0];
  const motif = [];
  let deg = 4;
  for (let i = 0; i < 16; i++) { if (rhythm[i]) { deg = Math.max(0, Math.min(9, deg + [-2, -1, -1, 1, 1, 2, 0][Math.floor(rnd() * 7)])); motif.push([i, deg]); } }
  for (let bar = 0; bar < bars; bar++) {
    const ch = sp.prog[bar % sp.prog.length], t = bar * 4 * spb;
    const chord = [0, 2, 4].map(k => deg2midi(ch + k));
    const intro = bar < 2, outro = bar >= bars - 1;
    for (let i = 0; i < 8; i++) note(deg2midi(ch) - 24 + (i % 4 === 3 ? 7 : 0), t + (i * spb) / 2, spb * 0.42, 0.24, 'tri');
    if (!intro) for (let i = 0; i < 16; i++) note(chord[[0, 1, 2, 1][i % 4]] + 12, t + (i * spb) / 4, spb * 0.2, 0.05, 'pulse', 0.25);
    for (let b = 0; b < 4; b++) {
      drum('h', t + b * spb, 0.25); drum('h', t + (b + 0.5) * spb, 0.18);
      if (!outro) { if (b % 2 === 0) drum('k', t + b * spb, 0.9); else drum('s', t + b * spb, 0.42); }
    }
    if (!intro && !outro) {
      const half = bar % 2;
      for (const [step, dg] of motif) {
        if ((step >> 3) !== half) continue;
        const st = step % 8;
        const variation = bar >= bars / 2 && rnd() < 0.25 ? 2 : 0;
        note(deg2midi(ch + dg + variation) + 12, t + (st * spb) / 2, spb * 0.45, 0.13, sp.lead || 'sq', 0.5, true);
      }
    }
  }
  note(deg2midi(sp.prog[0]) + 12, bars * 4 * spb - spb, spb * 1.6, 0.12, sp.lead || 'sq');
  let peak = 0;
  for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(mix[i]));
  const g = peak > 0 ? 0.92 / peak : 1;
  const pcm = new Int16Array(N);
  for (let i = 0; i < N; i++) pcm[i] = Math.round(Math.tanh(mix[i] * g * 1.1) * 30000);
  return wavWithTags(pcm, SR, { INAM: sp.title, IART: sp.artist, IPRD: sp.album, ICRD: sp.year, IGNR: sp.genre, ITRK: String(sp.track || '') });
}
function wavWithTags(pcm, sr, tags) {
  const enc = s => { const b = []; for (const ch of String(s)) b.push(ch.charCodeAt(0) & 255); b.push(0); if (b.length & 1) b.push(0); return b; };
  let info = [];
  for (const k in tags) { if (!tags[k]) continue; const v = enc(tags[k]); info = info.concat([...k].map(c => c.charCodeAt(0)), [v.length & 255, (v.length >> 8) & 255, 0, 0], v); }
  const list = [...'LIST'].map(c => c.charCodeAt(0)).concat([(info.length + 4) & 255, ((info.length + 4) >> 8) & 255, 0, 0], [...'INFO'].map(c => c.charCodeAt(0)), info);
  const dataLen = pcm.length * 2;
  const head = new DataView(new ArrayBuffer(36));
  const w = (o, s) => { for (let i = 0; i < 4; i++) head.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); head.setUint32(4, 4 + 24 + list.length + 8 + dataLen, true); w(8, 'WAVE'); w(12, 'fmt ');
  head.setUint32(16, 16, true); head.setUint16(20, 1, true); head.setUint16(22, 1, true); head.setUint32(24, sr, true); head.setUint32(28, sr * 2, true); head.setUint16(32, 2, true); head.setUint16(34, 16, true);
  const dh = new DataView(new ArrayBuffer(8)); dh.setUint32(0, 0x61746164, true); dh.setUint32(4, dataLen, true);
  return new Blob([head.buffer, new Uint8Array(list), dh.buffer, pcm.buffer], { type: 'audio/wav' });
}
function demoCover(a, b, title, sub, motif) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 300;
  const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 300, 300); g.addColorStop(0, a); g.addColorStop(1, b);
  c.fillStyle = g; c.fillRect(0, 0, 300, 300);
  if (motif === 'grid') { c.strokeStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i <= 12; i++) { c.beginPath(); c.moveTo(150, 170); c.lineTo(i * 25, 300); c.stroke(); } for (let y = 180; y < 300; y += (y - 160) / 4) { c.beginPath(); c.moveTo(0, y); c.lineTo(300, y); c.stroke(); } c.fillStyle = '#ffcc33'; c.beginPath(); c.arc(150, 150, 46, Math.PI, 0); c.fill(); }
  else { c.fillStyle = 'rgba(255,255,255,.9)'; for (let i = 0; i < 70; i++) { const x = (i * 97) % 300, y = (i * 53) % 190; c.fillRect(x, y, 2, 2); } c.fillStyle = '#e8e8ff'; c.beginPath(); c.arc(220, 80, 34, 0, Math.PI * 2); c.fill(); c.fillStyle = b; c.beginPath(); c.arc(206, 72, 30, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = '#fff'; c.font = 'bold 30px "Arial Black",Arial,sans-serif'; c.textBaseline = 'top';
  c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 6;
  c.fillText(title, 18, 196); c.font = 'italic 18px Georgia,serif'; c.fillStyle = '#ffe9a8'; c.fillText(sub, 20, 238);
  return cv.toDataURL('image/jpeg', 0.85);
}
/* ---------- a MIDI file, written note by note ---------- */
function demoMidi() {
  const vlq = n => { const out = [n & 127]; while ((n >>= 7)) out.unshift((n & 127) | 128); return out; };
  const track = evs => { const data = []; for (const [dt, ...b] of evs) data.push(...vlq(dt), ...b); data.push(0, 0xff, 0x2f, 0); return [77, 84, 114, 107, (data.length >>> 24) & 255, (data.length >> 16) & 255, (data.length >> 8) & 255, data.length & 255, ...data]; };
  const T = 96;
  const name = [...'Under Construction Theme'].map(c => c.charCodeAt(0));
  const t0 = [[0, 0xff, 0x03, name.length, ...name], [0, 0xff, 0x51, 3, 0x07, 0xa1, 0x20]];
  const mel = [[0, 0xc0, 80], [0, 0xb0, 7, 96]];
  const tune = [72, 76, 79, 76, 74, 77, 81, 77, 72, 76, 79, 84, 83, 79, 74, 79, 72, 76, 79, 76, 74, 77, 81, 77, 76, 74, 72, 71, 72, 0, 72, 0];
  for (const n of tune) { if (n) { mel.push([0, 0x90, n, 96], [T / 2, 0x80, n, 0]); } else mel.push([T / 2, 0x90, 60, 0]); }
  const bass = [[0, 0xc1, 38]];
  for (const n of [48, 48, 50, 50, 48, 48, 43, 43, 48, 48, 50, 50, 45, 43, 48, 48]) bass.push([0, 0x91, n, 104], [T, 0x81, n, 0]);
  const drums = [];
  for (let i = 0; i < 32; i++) { drums.push([0, 0x99, i % 4 === 0 ? 36 : i % 4 === 2 ? 38 : 42, i % 2 ? 70 : 110], [T / 2, 0x89, i % 4 === 0 ? 36 : i % 4 === 2 ? 38 : 42, 0]); }
  const head = [77, 84, 104, 100, 0, 0, 0, 6, 0, 1, 0, 4, 0, T];
  return new Blob([new Uint8Array([...head, ...track(t0), ...track(mel), ...track(bass), ...track(drums)])], { type: 'audio/midi' });
}
/* ---------- screen savers, recorded from a canvas ---------- */
const DEMO_DRAW = {
  starfield(c, t, w, h) {
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, 0, w, h);
    const rnd = seeded(42);
    for (let i = 0; i < 260; i++) {
      const a = rnd() * Math.PI * 2, sp = 0.15 + rnd() * 0.85, z = (rnd() + t * sp * 0.35) % 1;
      const r = Math.pow(z, 2.2) * Math.hypot(w, h) * 0.6;
      const x = w / 2 + Math.cos(a) * r, y = h / 2 + Math.sin(a) * r, s = 0.4 + z * 2.6;
      c.fillStyle = 'rgba(255,255,255,' + Math.min(1, z * 1.6).toFixed(2) + ')'; c.fillRect(x, y, s, s);
    }
  },
  lines(c, t, w, h) {
    c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(0, 0, w, h);
    for (let k = 0; k < 2; k++) {
      c.strokeStyle = k ? 'hsl(' + ((t * 40 + 180) % 360) + ',100%,60%)' : 'hsl(' + ((t * 40) % 360) + ',100%,60%)';
      c.lineWidth = 2; c.beginPath();
      for (let i = 0; i < 4; i++) {
        const fx = (Math.sin(t * (0.7 + i * 0.23 + k * 0.11) + i * 2.1) + 1) / 2, fy = (Math.cos(t * (0.9 + i * 0.17 + k * 0.13) + i * 1.3) + 1) / 2;
        const x = 20 + fx * (w - 40), y = 20 + fy * (h - 40);
        if (i) c.lineTo(x, y); else c.moveTo(x, y);
      }
      c.closePath(); c.stroke();
    }
  },
  intro(c, t, w, h) {
    const sky = c.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#05052e'); sky.addColorStop(0.7, '#3b2a7c'); sky.addColorStop(1, '#c2477d');
    c.fillStyle = sky; c.fillRect(0, 0, w, h);
    const rnd = seeded(9);
    for (let i = 0; i < 90; i++) { const x = rnd() * w, y = rnd() * h * 0.6; c.fillStyle = 'rgba(255,255,255,' + (0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i))).toFixed(2) + ')'; c.fillRect(x, y, 1.5, 1.5); }
    const sunY = h * 0.72 - Math.min(1, t / 4) * h * 0.18;
    const sun = c.createLinearGradient(0, sunY - 50, 0, sunY + 50); sun.addColorStop(0, '#fff2a8'); sun.addColorStop(1, '#ff8c42');
    c.fillStyle = sun; c.beginPath(); c.arc(w * 0.62, sunY, 48, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#1d4d3a'; c.beginPath(); c.moveTo(0, h); c.lineTo(0, h * 0.7); c.lineTo(w * 0.25, h * 0.55); c.lineTo(w * 0.45, h * 0.72); c.lineTo(w * 0.7, h * 0.58); c.lineTo(w, h * 0.74); c.lineTo(w, h); c.fill();
    c.fillStyle = '#2a2a2a'; c.beginPath(); c.moveTo(w * 0.44, h); c.lineTo(w * 0.5, h * 0.72); c.lineTo(w * 0.52, h * 0.72); c.lineTo(w * 0.62, h); c.fill();
    c.strokeStyle = '#ffd400'; c.setLineDash([8, 10]); c.lineDashOffset = -t * 60; c.lineWidth = 2; c.beginPath(); c.moveTo(w * 0.53, h); c.lineTo(w * 0.51, h * 0.72); c.stroke(); c.setLineDash([]);
    const a = Math.max(0, Math.min(1, (t - 1) / 1.5));
    c.globalAlpha = a; c.fillStyle = '#ffcc33'; c.font = 'italic bold 52px Georgia,serif'; c.textAlign = 'center'; c.shadowColor = '#000'; c.shadowBlur = 8;
    c.fillText('LANscape', w / 2, h * 0.36);
    c.font = '15px Arial,sans-serif'; c.fillStyle = '#fff'; c.fillText('YOUR LOCAL INFORMATION SUPERHIGHWAY', w / 2, h * 0.36 + 30);
    c.shadowBlur = 0; c.globalAlpha = 1; c.textAlign = 'start';
  }
};
async function demoVideo(kind, seconds) {
  const w = 480, h = 270;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
  if (!cv.captureStream || typeof MediaRecorder === 'undefined') throw new Error('This browser can\'t record the demo videos.');
  const type = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find(x => MediaRecorder.isTypeSupported(x));
  if (!type) throw new Error('This browser can\'t record the demo videos.');
  const rec = new MediaRecorder(cv.captureStream(30), { mimeType: type, videoBitsPerSecond: 1200000 });
  const chunks = [];
  rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise(r => { rec.onstop = r; });
  setStatus('Recording the ' + kind + ' demo video...');
  rec.start(500);
  const t0 = performance.now();
  await new Promise(res => {
    const tick = () => { const t = (performance.now() - t0) / 1000; DEMO_DRAW[kind](c, t, w, h); if (t < seconds) setTimeout(tick, 33); else res(); };
    tick();
  });
  rec.stop();
  await stopped;
  setStatus('Document: Done');
  return new Blob(chunks, { type: type.split(';')[0] });
}
function demoPoster(kind, t, w = 384, h = 216) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d'); c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
  if (kind === 'intro') DEMO_DRAW.intro(c, t, w, h);
  else for (let i = 0; i <= 30; i++) DEMO_DRAW[kind](c, t - 1 + i / 30, w, h);
  return cv.toDataURL('image/jpeg', 0.8);
}
/* ---------- pictures ---------- */
const DEMO_SVG = {
  construction: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="#ffd400"/><g fill="#111">' + Array.from({ length: 12 }, (_, i) => '<path d="M' + (i * 40 - 60) + ' 0h22l-60 300h-22z"/>').join('') + '</g><rect x="40" y="70" width="320" height="160" rx="10" fill="#ffd400" stroke="#111" stroke-width="8"/><text x="200" y="135" font-family="Arial Black,Arial" font-weight="900" font-size="34" text-anchor="middle">UNDER</text><text x="200" y="180" font-family="Arial Black,Arial" font-weight="900" font-size="34" text-anchor="middle">CONSTRUCTION</text><g transform="translate(200 212)"><circle r="12" fill="#111"/><path d="M-30 4h60" stroke="#111" stroke-width="6"/></g></svg>',
  email: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="#000080"/><g><animateTransform attributeName="transform" type="translate" values="0 0;0 -8;0 0" dur="1s" repeatCount="indefinite"/><rect x="70" y="50" width="160" height="100" fill="#fff" stroke="#000" stroke-width="4"/><path d="M70 50l80 60 80-60" fill="none" stroke="#000" stroke-width="4"/></g><text x="150" y="185" fill="#ffff66" font-family="Comic Sans MS,cursive" font-size="22" text-anchor="middle">E-mail me!</text></svg>',
  wallpaper: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400"><defs><radialGradient id="g" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#2b1a66"/><stop offset="1" stop-color="#05030f"/></radialGradient><radialGradient id="p" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#ffd27a"/><stop offset=".6" stop-color="#e8862a"/><stop offset="1" stop-color="#7a2e08"/></radialGradient></defs><rect width="640" height="400" fill="url(#g)"/>' + Array.from({ length: 80 }, (_, i) => '<circle cx="' + ((i * 137) % 640) + '" cy="' + ((i * 71) % 400) + '" r="' + (1 + (i % 3) * 0.5) + '" fill="#fff" opacity="' + (0.3 + (i % 5) / 7).toFixed(2) + '"/>').join('') + '<ellipse cx="320" cy="210" rx="170" ry="36" fill="none" stroke="#3cff7a" stroke-width="6" opacity=".5" transform="rotate(-14 320 210)"/><circle cx="320" cy="210" r="90" fill="url(#p)"/><path d="M152 230A170 36-14 0 0 488 190" fill="none" stroke="#3cff7a" stroke-width="6"/><circle cx="470" cy="160" r="6" fill="#ff66ff"/></svg>'
};
async function demoPNG() {
  const cv = document.createElement('canvas'); cv.width = 800; cv.height = 600;
  const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, 600); g.addColorStop(0, '#008080'); g.addColorStop(1, '#004848');
  c.fillStyle = g; c.fillRect(0, 0, 800, 600);
  // a 3D logo, the way every 1998 desktop had one
  for (let i = 14; i >= 0; i--) { c.fillStyle = i ? 'rgb(0,' + (40 + i * 4) + ',' + (60 + i * 4) + ')' : '#ffd400'; c.font = 'italic bold 96px Georgia,serif'; c.fillText('LANscape', 150 + i, 300 + i); }
  c.fillStyle = '#fff'; c.font = '22px Arial,sans-serif'; c.fillText('Best viewed at 800 × 600 in 256 colors', 200, 380);
  return new Promise(r => cv.toBlob(r, 'image/png'));
}
/* ---------- office files ---------- */
async function demoDocx() {
  const div = document.createElement('div');
  div.innerHTML = '<h1>Y2K Readiness Memo</h1><p><b>To:</b> All LAN users &nbsp; <b>From:</b> The Sysop &nbsp; <b>Date:</b> November 12, 1999</p><h2>What is the Year 2000 problem?</h2><p>Some older programs store the year with two digits. When the clock rolls over to <b>01/01/00</b>, they may think it is 1900. Our LAN is ready, but please check your own machines.</p><h2>Checklist</h2><ul><li>Back up your documents to floppy or Zip disk</li><li>Write down your dial-up settings</li><li>Print your address book</li><li>Do not schedule a LAN party for midnight on New Year\'s Eve</li></ul><h2>Status of our systems</h2><table border="1"><tr><th>System</th><th>Status</th><th>Owner</th></tr><tr><td>File server</td><td><span style="color:#008000">Compliant</span></td><td>Sysop</td></tr><tr><td>Web server</td><td><span style="color:#008000">Compliant</span></td><td>Webmaster</td></tr><tr><td>Coffee maker</td><td><span style="color:#c00000">Unknown</span></td><td>Everyone</td></tr></table><p>Questions? Post them on the BBS or sign the guestbook.</p>';
  return htmlToDocx(div, { title: 'Y2K Readiness Memo', author: 'The Sysop' });
}
async function demoXlsx() {
  const wb = newWorkbook();
  const sh = wb.sheets[0]; sh.name = 'Budget';
  const put = (r, c, v, o) => sh.cells.set(ck(r, c), Object.assign(typeof v === 'string' && v[0] === '=' ? { f: v.slice(1), v: null } : { v }, o || {}));
  put(0, 0, 'LAN Party Budget', { b: true, sz: 14 });
  ['Item', 'Qty', 'Cost', 'Total'].forEach((t, c) => put(1, c, t, { b: true, bg: '#217346', fg: '#ffffff' }));
  const items = [['Pizza (large)', 6, 12.99], ['Soda (2 liter)', 10, 1.49], ['Ethernet cables', 8, 4.5], ['Hub, 8 port', 1, 39.95], ['Snacks', 1, 25], ['Extension cords', 3, 7.99]];
  items.forEach(([n, q, p], i) => { const r = i + 2; put(r, 0, n); put(r, 1, q); put(r, 2, p, { fmt: '$#,##0.00' }); put(r, 3, '=B' + (r + 1) + '*C' + (r + 1), { fmt: '$#,##0.00' }); });
  const last = items.length + 2;
  put(last + 1, 0, 'Total', { b: true }); put(last + 1, 3, '=SUM(D3:D' + last + ')', { fmt: '$#,##0.00', b: true });
  put(last + 2, 0, 'Per gamer (8 people)'); put(last + 2, 3, '=D' + (last + 2) + '/8', { fmt: '$#,##0.00' });
  put(last + 3, 0, 'Most expensive line'); put(last + 3, 3, '=INDEX(A3:A' + last + ',MATCH(MAX(D3:D' + last + '),D3:D' + last + ',0))');
  sh.colW.set(0, 160); sh.colW.set(3, 90);
  recalc(wb);
  return xlsxWrite(wb, { title: 'LAN Party Budget', creator: 'LANscape' });
}
async function demoPdf() {
  const PL = await Libs.pdflib();
  const pdf = await PL.PDFDocument.create();
  pdf.setTitle('LANscape Quick Start'); pdf.setAuthor('LANscape'); pdf.setSubject('Getting around your own little Internet');
  const font = await pdf.embedFont(PL.StandardFonts.Helvetica), bold = await pdf.embedFont(PL.StandardFonts.HelveticaBold);
  const pages = [
    ['LANscape Quick Start', ['Welcome to your local information superhighway. LANscape turns a folder of files into a whole 1990s Internet: every page gets a domain name, similar pages join web rings, and HyperHound searches all of it.', 'Open a folder with the Open button. Web pages become sites. Documents open in Write, Ledger and Reader. Songs play in the Jukebox and LANamp, videos in Rewind, pictures in the Photo Album.', 'Every file has an address. Type it in the Location bar, bookmark it, or find it with HyperHound.']],
    ['Keyboard Shortcuts', ['Ctrl+L  go to the Location bar', 'Alt+Left / Alt+Right  back and forward', 'Ctrl+D  bookmark this page', 'F5  reload', 'In Reader: M highlight, P pen, N sticky note, S stamp, Ctrl+S save a marked-up copy', 'In the Jukebox: Space plays and pauses, Ctrl+I shows song info', 'In Pinball: Z and / flip, Space launches']]
  ];
  for (const [title, paras] of pages) {
    const pg = pdf.addPage([612, 792]);
    pg.drawRectangle({ x: 0, y: 742, width: 612, height: 50, color: PL.rgb(0, 0, 0.5) });
    pg.drawText('LANscape', { x: 40, y: 760, size: 18, font: bold, color: PL.rgb(1, 0.8, 0.2) });
    pg.drawText(title, { x: 40, y: 690, size: 26, font: bold });
    let y = 650;
    for (const p of paras) {
      const words = p.split(' '); let line = '';
      for (const w2 of words) { const next = line ? line + ' ' + w2 : w2; if (font.widthOfTextAtSize(next, 12) > 530) { pg.drawText(line, { x: 40, y, size: 12, font }); y -= 17; line = w2; } else line = next; }
      if (line) { pg.drawText(line, { x: 40, y, size: 12, font }); y -= 17; }
      y -= 12;
    }
    pg.drawText('Page ' + (pdf.getPageCount()) + ' of 2', { x: 500, y: 30, size: 9, font, color: PL.rgb(0.4, 0.4, 0.4) });
  }
  return new Blob([await pdf.save()], { type: 'application/pdf' });
}
function demoPptx() {
  const slides = [['Welcome to LANscape', ['Your files, as a 1990s Internet', 'Every file gets an address'], 'Say hi, then open a folder.'], ['What\'s Inside', ['Write, Ledger and Calculator', 'Reader for PDFs, with mark-up', 'Jukebox, LANamp, Rewind and Photos', 'RingHub Pinball'], ''], ['Surf the Rings', ['Similar sites join web rings', 'Use the ring bar to hop between them', 'HyperHound searches everything'], 'Demo the Random button.']];
  const esc2 = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const P = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
  const sp = (type, paras) => '<p:sp><p:nvSpPr><p:cNvPr id="2" name="' + type + '"/><p:cNvSpPr/><p:nvPr><p:ph type="' + type + '"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/>' + paras.map(t => '<a:p><a:r><a:t>' + esc2(t) + '</a:t></a:r></a:p>').join('') + '</p:txBody></p:sp>';
  const files = [
    { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>' + slides.map((_, i) => '<Override PartName="/ppt/slides/slide' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>').join('') + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>' },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>' },
    { name: 'docProps/core.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>LANscape Tour</dc:title><dc:creator>LANscape</dc:creator></cp:coreProperties>' },
    { name: 'ppt/presentation.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation ' + P + '><p:sldIdLst>' + slides.map((_, i) => '<p:sldId id="' + (256 + i) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</p:sldIdLst><p:sldSz cx="9144000" cy="6858000"/></p:presentation>' },
    { name: 'ppt/_rels/presentation.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + slides.map((_, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide' + (i + 1) + '.xml"/>').join('') + '</Relationships>' }
  ];
  slides.forEach(([title, bullets, notes], i) => {
    files.push({ name: 'ppt/slides/slide' + (i + 1) + '.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld ' + P + '><p:cSld><p:spTree>' + sp('title', [title]) + sp('body', bullets) + '</p:spTree></p:cSld></p:sld>' });
    if (notes) files.push({ name: 'ppt/notesSlides/notesSlide' + (i + 1) + '.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:notes ' + P + '><p:cSld><p:spTree>' + sp('body', [notes]) + '</p:spTree></p:cSld></p:notes>' });
  });
  return zipWrite(files, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
}
function demoZip() {
  return zipWrite([
    { name: 'homepage/index.html', data: '<html><head><title>My Homepage</title></head><body bgcolor="#000080" text="#ffff00"><center><h1>Welcome to My Homepage!</h1><img src="construction.svg" width="200"><p>This page is under construction. Come back soon!</p></center></body></html>' },
    { name: 'homepage/construction.svg', data: DEMO_SVG.construction },
    { name: 'homepage/style.css', data: 'body { font-family: "Comic Sans MS", cursive; }\nblink { color: red; }\n' },
    { name: 'README.TXT', data: 'HOMEPAGE STARTER KIT v1.0\r\n=========================\r\nUnzip into your web folder and edit index.html in Notepad.\r\nDon\'t forget to sign up for a web ring!\r\n' }
  ]);
}
const DEMO_TEXT = {
  readme: 'LANSCAPE DEMO FILES\r\n===================\r\n\r\n   _       _    _   _\r\n  | |     /_\\  | \\ | |  scape\r\n  | |__  / _ \\ |  \\| |\r\n  |____|/_/ \\_\\|_|\\__|\r\n\r\nThese files show off every program in LANscape Navigator:\r\n\r\n  * Documents ........ Write (Word files, RTF, Markdown)\r\n  * Spreadsheets ..... Ledger (Excel files and CSV, with formulas)\r\n  * PDFs ............. Reader (highlight, draw, stamp, comment)\r\n  * Slides ........... Slide Show (press F5!)\r\n  * Songs ............ Jukebox and LANamp (the songs were synthesized just for you)\r\n  * Videos ........... Rewind\r\n  * Pictures ......... Photo Album\r\n  * ZIP files ........ ZIP Viewer\r\n\r\nOpen your own folder to make your own Internet.\r\n',
  checklist: '# Webmaster Checklist\n\nEverything a 1998 homepage needs before you submit it to the search engines.\n\n## Must have\n\n- [x] A **hit counter** (start it at 1,000 so it looks popular)\n- [x] An *Under Construction* sign\n- [ ] A guestbook\n- [ ] A web ring banner at the bottom\n\n## Nice to have\n\n1. A MIDI file that plays when the page opens\n2. A \"Best viewed in LANscape Navigator\" button\n3. Animated GIF flames\n\n## Meta tags\n\n| Tag | Example |\n|---|---|\n| description | Klaus\'s air-cooled garage |\n| keywords | flat-six, valves, oil |\n\n> Remember: the more `<blink>`, the better.\n',
  topsites: 'Rank,Site,Visitors,Category,Has guestbook\n1,Klaus\'s Flat-Six Garage,48211,Cars,Yes\n2,The Sourdough Starter Page,39950,Food,Yes\n3,Comet Watchers Club,35112,Space,No\n4,Retro LAN Party HQ,29874,Games,Yes\n5,Grandma\'s Quilt Patterns,21033,Crafts,Yes\n6,Dial-Up Tips & Tricks,18450,Computers,No\n7,Tide Pool Kids,12907,Nature,Yes\n8,The Mini-Golf Database,9841,Sports,No\n',
  rtf: '{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Times New Roman;}{\\f1 Arial;}}{\\colortbl;\\red0\\green0\\blue128;\\red192\\green0\\blue0;}\n\\f1\\fs32\\cf1\\b Dial-Up Troubleshooting\\b0\\cf0\\fs22\\par\n\\par\n\\f0 If your modem won\'t connect, try these steps in order:\\par\n\\par\n1. Listen for the dial tone. No tone means the phone cord is loose.\\par\n2. Make sure nobody picked up the phone in the kitchen.\\par\n3. Turn the modem off and on again.\\par\n4. Lower the connection speed to 28.8k in the settings.\\par\n\\par\n\\cf2\\b Never\\b0\\cf0  download a big file while someone is waiting for a phone call.\\par\n}',
  perl: '#!/usr/bin/perl\n# guestbook.pl - the classic CGI guestbook, circa 1997\nuse strict;\nuse CGI qw(:standard);\n\nmy $book = "guestbook.txt";\nprint header, start_html(-title => "Sign My Guestbook", -bgcolor => "#000080", -text => "#ffff00");\n\nif (param("name")) {\n    open(my $fh, ">>", $book) or die "Cannot open $book: $!";\n    print $fh join("|", param("name"), param("email"), param("comments"), scalar localtime), "\\n";\n    close $fh;\n    print h2("Thanks for signing, " . escapeHTML(param("name")) . "!");\n}\n\nprint start_form, "Name: ", textfield("name"), br, "E-mail: ", textfield("email"), br,\n      "Comments: ", textarea("comments", "", 5, 40), br, submit("Sign it!"), end_form;\nprint end_html;\n',
  counter: '// counter.js - fake hit counter (shh!)\nfunction showCounter(start) {\n  var hits = start + Math.floor((new Date().getTime() / 86400000) % 1000);\n  var s = String(hits);\n  while (s.length < 6) s = "0" + s;\n  document.write("<b>You are visitor number " + s + "!</b>");\n}\nshowCounter(1000);\n'
};
const DEMO_SONGS = [
  { file: 'The Hypertext Kids/Under Construction/01 Dial Tone Serenade.wav', title: 'Dial Tone Serenade', artist: 'The Hypertext Kids', album: 'Under Construction', year: '1997', genre: 'Chiptune', track: 1, bpm: 124, key: 60, prog: [0, 4, 5, 3], seed: 11, lead: 'sq' },
  { file: 'The Hypertext Kids/Under Construction/02 Packet Loss.wav', title: 'Packet Loss', artist: 'The Hypertext Kids', album: 'Under Construction', year: '1997', genre: 'Chiptune', track: 2, bpm: 140, key: 57, minor: true, prog: [0, 5, 2, 6], seed: 23, lead: 'saw', rhythm: [1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 1] },
  { file: 'The Hypertext Kids/Under Construction/03 404 Lullaby.wav', title: '404 Lullaby', artist: 'The Hypertext Kids', album: 'Under Construction', year: '1997', genre: 'Chiptune', track: 3, bpm: 92, key: 65, prog: [0, 3, 4, 0], seed: 5, lead: 'tri', rhythm: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0] },
  { file: 'Modem Moonlight/56K Nights/01 Handshake at Midnight.wav', title: 'Handshake at Midnight', artist: 'Modem Moonlight', album: '56K Nights', year: '1999', genre: 'Electronic', track: 1, bpm: 112, key: 62, minor: true, prog: [0, 3, 4, 0], seed: 77, lead: 'pulse' },
  { file: 'Modem Moonlight/56K Nights/02 Ring Around the Hub.wav', title: 'Ring Around the Hub', artist: 'Modem Moonlight', album: '56K Nights', year: '1999', genre: 'Electronic', track: 2, bpm: 128, key: 55, prog: [0, 5, 3, 4], seed: 31, lead: 'sq', rhythm: [1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 1] }
];
const DEMO_COVERS = { 'Under Construction': () => demoCover('#ffb000', '#d03000', 'UNDER CONST.', 'The Hypertext Kids', 'grid'), '56K Nights': () => demoCover('#101040', '#4a1a7a', '56K NIGHTS', 'Modem Moonlight', 'moon') };
const textMeta = (kind, src, name, path) => (kind === 'md' ? extractMarkdown(src, name) : kind === 'code' ? extractCode(src, name) : kind === 'rtf' ? extractRtf(src, name) : kind === 'sheet' ? extractCsv(src, name) : kind === 'image' ? extractImage(name, path, src.length) : extractText(src, name));
const DEMO_FILES = [
  { path: 'demo/files/README.TXT', src: DEMO_TEXT.readme, days: 1 },
  { path: 'demo/files/docs/Webmaster Checklist.md', src: DEMO_TEXT.checklist, days: 3 },
  { path: 'demo/files/docs/Top Sites 1998.csv', src: DEMO_TEXT.topsites, days: 4 },
  { path: 'demo/files/docs/Dial-Up Troubleshooting.rtf', src: DEMO_TEXT.rtf, days: 6 },
  { path: 'demo/files/docs/Y2K Readiness Memo.docx', gen: demoDocx, size: 9000, days: 2, meta: { title: 'Y2K Readiness Memo', author: 'The Sysop', desc: 'Some older programs store the year with two digits. Our LAN is ready, but please check your own machines.', headings: 'What is the Year 2000 problem? · Checklist · Status of our systems', body: 'Y2K Readiness Memo year 2000 problem two digits back up documents floppy Zip disk dial-up settings address book LAN party file server web server coffee maker compliant', words: 120 } },
  { path: 'demo/files/docs/LAN Party Budget.xlsx', gen: demoXlsx, size: 7000, days: 2, meta: { title: 'LAN Party Budget', desc: '1 sheet: Budget · Pizza, Soda, Ethernet cables, Hub, Snacks, Extension cords', headings: 'Budget', body: 'LAN Party Budget Item Qty Cost Total Pizza Soda Ethernet cables Hub 8 port Snacks Extension cords per gamer', sheets: ['Budget'], words: 30 } },
  { path: 'demo/files/docs/LANscape Quick Start.pdf', gen: demoPdf, size: 3500, days: 1, meta: { title: 'LANscape Quick Start', pages: 2, author: 'LANscape', desc: 'Getting around your own little Internet · 2 pages', body: 'LANscape Quick Start local information superhighway folder domain name web rings HyperHound Write Ledger Reader Jukebox LANamp Rewind Photo Album keyboard shortcuts Location bar bookmark reload highlight pen sticky note stamp pinball', words: 160 } },
  { path: 'demo/files/docs/LANscape Tour.pptx', gen: demoPptx, size: 4000, days: 1, meta: { title: 'LANscape Tour', slides: 3, desc: '3 slides · Welcome to LANscape · What\'s Inside · Surf the Rings', headings: 'Welcome to LANscape · What\'s Inside · Surf the Rings', body: 'Welcome to LANscape files 1990s Internet address Write Ledger Calculator Reader Jukebox LANamp Rewind Photos RingHub Pinball web rings ring bar HyperHound', words: 50 } },
  { path: 'demo/files/code/guestbook.pl', src: DEMO_TEXT.perl, days: 9 },
  { path: 'demo/files/code/counter.js', src: DEMO_TEXT.counter, days: 9 },
  { path: 'demo/files/downloads/homepage-kit.zip', gen: demoZip, size: 2500, days: 5, meta: { title: 'Homepage Kit', desc: '4 files: index.html, construction.svg, style.css, README.TXT', body: 'homepage index html construction svg style css readme', entries: 4 } },
  { path: 'demo/pictures/Web Graphics/Under Construction.svg', src: DEMO_SVG.construction, days: 8 },
  { path: 'demo/pictures/Web Graphics/Email Me.svg', src: DEMO_SVG.email, days: 8 },
  { path: 'demo/pictures/Wallpapers/RingHub Planet.svg', src: DEMO_SVG.wallpaper, days: 2 },
  { path: 'demo/pictures/Wallpapers/LANscape Desktop.png', gen: demoPNG, size: 30000, days: 2 },
  ...DEMO_SONGS.map(s => ({ path: 'demo/music/' + s.file, gen: () => demoSong(s), size: Math.round(22050 * 2 * (16 * 4 * 60 / s.bpm + 1.2)), days: 3, song: s, art: DEMO_COVERS[s.album] })),
  { path: 'demo/music/MIDI/Under Construction Theme.mid', gen: () => demoMidi(), size: 1200, days: 4, meta: { title: 'Under Construction Theme', artist: 'Unknown Artist', album: 'MIDI', genre: 'MIDI', duration: 8, channels: 2, sampleRate: 32000, desc: 'Unknown Artist — MIDI · MIDI', body: 'Under Construction Theme MIDI', track: 0, year: '', bitrate: 0, artKey: '' } },
  { path: 'demo/videos/LANscape Intro (1998).webm', gen: () => demoVideo('intro', 6), size: 400000, days: 1, video: { kind: 'intro', dur: 6, at: 4 } },
  { path: 'demo/videos/Screen Savers/Screen Savers S01E01.webm', gen: () => demoVideo('starfield', 8), size: 500000, days: 2, video: { kind: 'starfield', dur: 8, at: 3 } },
  { path: 'demo/videos/Screen Savers/Screen Savers S01E02.webm', gen: () => demoVideo('lines', 8), size: 500000, days: 2, video: { kind: 'lines', dur: 8, at: 3 } }
];
function demoFileMeta(f, kind, name) {
  if (f.song) {
    const s = f.song, dur = 16 * 4 * 60 / s.bpm + 1.2;
    return baseMeta('audio', s.title, { desc: s.artist + ' — ' + s.album + ' (' + s.year + ') · ' + s.genre, keywords: [s.artist, s.album, s.genre, s.year].join(', '), headings: folderWords(f.path), body: [s.title, s.artist, s.album, s.genre].join(' '), artist: s.artist, album: s.album, genre: s.genre, year: s.year, track: s.track, duration: dur, bitrate: 352, sampleRate: 22050, channels: 1, artKey: albumKey(s.artist, s.album) });
  }
  if (f.video) { const m = extractVideo(name, f.path, f.size || 0); Object.assign(m, { duration: f.video.dur, width: 480, height: 270, playable: typeof MediaRecorder !== 'undefined' }); return m; }
  if (f.meta) return baseMeta(kind, f.meta.title || prettyName(name), f.meta);
  if (typeof f.src === 'string') return textMeta(kind, f.src, name, f.path);
  if (kind === 'image') return extractImage(name, f.path, f.size || 0);
  return extractOther(name, f.path, f.size || 0, kind);
}
/** after a demo file is registered: posters for the videos */
function demoFileAfter(f, doc) {
  if (f.video) {
    doc.meta.probedFor = doc.mtime;
    const { kind, at } = f.video;
    MThumbs.get('poster:' + doc.path, doc.mtime).then(hit => { if (!hit) return MThumbs.set('poster:' + doc.path, demoPoster(kind, at), doc.mtime); }).catch(() => {});
    MThumbs.get('frame:' + doc.path, doc.mtime).then(hit => { if (!hit) return MThumbs.set('frame:' + doc.path, demoPoster(kind, at, 960, 540), doc.mtime); }).catch(() => {});
  }
}
