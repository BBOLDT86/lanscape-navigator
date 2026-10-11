/* ===================================================================
   Player: the one music engine. It lives in the browser shell, so a
   song keeps playing while you surf. Jukebox and LANamp are two faces
   on the same engine: <audio> -> preamp -> 10-band EQ -> balance ->
   analyser (for the visualizers) -> volume -> speakers.
   =================================================================== */
const EQ_FREQS = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
const EQ_LABELS = ['60', '170', '310', '600', '1K', '3K', '6K', '12K', '14K', '16K'];
const EQ_PRESETS = {
  'Flat': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'Acoustic': [4, 4, 3, 1, 1.5, 2, 3, 3.5, 3, 2],
  'Bass Boost': [7, 6, 4.5, 2.5, 0.5, 0, 0, 0, 0, 0],
  'Bass Cut': [-6, -5, -4, -2, -0.5, 0, 0, 0, 0, 0],
  'Classical': [4.5, 3.5, 3, 2.5, -1.5, -1.5, 0, 2, 3, 3.5],
  'Club': [0, 0, 3, 5, 5, 5, 3, 0, 0, 0],
  'Dance': [6, 5, 2, 0, 0, -3, -4, -4, 0, 0],
  'Headphones': [3, 6, 3, -2, -1, 1.5, 3, 6, 7.5, 8],
  'Jazz': [4, 3, 1.5, 2, -1.5, -1.5, 0, 1.5, 3, 3.5],
  'Live': [-3, 0, 2.5, 3, 3, 3, 2.5, 1.5, 1.5, 1.5],
  'Loudness': [6, 4, 0, 0, -2, 0, -1, -5, 5, 1],
  'Party': [4.5, 4.5, 0, 0, 0, 0, 0, 0, 4.5, 4.5],
  'Pop': [-1.5, 3, 4.5, 5, 3.5, 0, -1.5, -1.5, -1, -1],
  'Rock': [5, 3, -3, -5, -2, 2.5, 5, 6, 6, 6],
  'Small Speakers': [5.5, 4, 3.5, 2.5, 1, 0, -1, -2.5, -3, -4],
  'Soft': [3, 1, 0, -1.5, 0, 2.5, 5, 6, 7, 7.5],
  'Spoken Word': [-3.5, -0.5, 0, 0.5, 3.5, 4.5, 4.5, 4, 2.5, 0],
  'Techno': [5, 3.5, 0, -3, -2.5, 0, 5, 6, 6, 5.5],
  'Treble Boost': [0, 0, 0, 0, 0, 1, 2.5, 4, 5, 6.5],
  'Vocal': [-1.5, -3, -3, 1.5, 3.5, 3.5, 3, 1.5, 0, -1.5]
};
const songStats = p => S.music[p] || (S.music[p] = {});
/** a song with any Get Info edits applied */
function songInfo(d) {
  const m = d.meta || {}, x = S.music[d.path] || {}, e = x.edit || {};
  return {
    path: d.path, d, title: e.title || m.title || d.name, artist: e.artist || m.artist || 'Unknown Artist', album: e.album || m.album || 'Unknown Album',
    genre: e.genre != null ? e.genre : m.genre || '', year: e.year != null ? e.year : m.year || '', track: +(e.track || m.track || 0), comment: e.comment || '',
    duration: m.duration || x.dur || 0, rating: x.rating || 0, plays: x.plays || 0, last: x.last || 0, skips: x.skips || 0, off: !!x.off,
    artKey: m.artKey || '', bitrate: m.bitrate || 0, sampleRate: m.sampleRate || 0, channels: m.channels || 2
  };
}
const ART_FILE = /^(cover|folder|front|albumart[^/]*|album ?art[^/]*|album|art)\.(jpe?g|png|gif|webp)$/i;
const artCache = new Map();
/** album art: embedded in the song, or a cover picture in its folder */
async function artURL(d) {
  if (!d) return null;
  const m = d.meta || {};
  if (m.artKey && S.thumbs.has('art:' + m.artKey)) return S.thumbs.get('art:' + m.artKey);
  const key = d.dir + '|' + (m.album || '');
  if (artCache.has(key)) return artCache.get(key);
  let url = null;
  const node = S.tree && S.tree.get(d.dir);
  const pic = node && node.files.find(f => f.kind === 'image' && ART_FILE.test(f.name));
  if (pic) { try { url = await mediaThumbURL(pic); } catch (e) { url = null; } }
  artCache.set(key, url);
  return url;
}
function fmtTime(s, neg) {
  if (!isFinite(s) || s < 0) s = 0;
  s = Math.floor(s);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return (neg ? '-' : '') + (h ? h + ':' + pad(m, 2) : m) + ':' + pad(sec, 2);
}
const Player = (() => {
  const audio = new Audio();
  audio.preload = 'auto';
  let ac = null, g = null;
  let queue = [], order = [], pos = -1;
  let tok = 0, counted = false, savedT = 0, pendingSeek = 0, lastErr = '', errRun = 0, loadedPath = null, playStart = 0;
  const subs = new Set();
  const emit = t => { for (const fn of Array.from(subs)) { try { fn(t); } catch (e) { console.warn(e); } } if (t === 'track' || t === 'state') statusBar(); };
  const P = () => S.prefs;
  const curIdx = () => (pos >= 0 && pos < order.length ? order[pos] : -1);
  const curPath = () => { const i = curIdx(); return i >= 0 ? queue[i] : null; };
  const curDoc = () => { const p = curPath(); return p ? S.docs.get(p) || null : null; };
  const live = p => { const d = S.docs.get(p); return !!(d && d.active !== false && d.kind === 'audio'); };
  /* ---------- the audio graph ---------- */
  function ensureGraph() {
    if (g !== null) return g;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { g = false; return g; }
      ac = new AC();
      const src = ac.createMediaElementSource(audio);
      const pre = ac.createGain();
      const bands = EQ_FREQS.map((f, i) => { const b = ac.createBiquadFilter(); b.type = i === 0 ? 'lowshelf' : i === EQ_FREQS.length - 1 ? 'highshelf' : 'peaking'; b.frequency.value = f; b.Q.value = 1.25; return b; });
      const pan = ac.createStereoPanner ? ac.createStereoPanner() : null;
      const an = ac.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0.6;
      const vol = ac.createGain();
      let n = src; n.connect(pre); n = pre;
      for (const b of bands) { n.connect(b); n = b; }
      if (pan) { n.connect(pan); n = pan; }
      n.connect(an); an.connect(vol); vol.connect(ac.destination);
      g = { src, pre, bands, pan, an, vol };
      applyEq(); applyVolume();
    } catch (e) { console.warn('WebAudio is not available; playing without the equalizer', e); g = false; applyVolume(); }
    return g;
  }
  const curve = v => clamp(v, 0, 1) ** 2;
  function applyVolume() {
    const v = P().vol == null ? 0.8 : P().vol;
    if (g) { audio.volume = 1; g.vol.gain.value = curve(v); if (g.pan) g.pan.pan.value = clamp(P().bal || 0, -1, 1); }
    else audio.volume = curve(v);
  }
  const eqBands = () => (Array.isArray(P().eqBands) && P().eqBands.length === 10 ? P().eqBands : (P().eqBands = EQ_PRESETS.Flat.slice()));
  function applyEq() {
    if (!g) return;
    const on = !!P().eqOn, b = eqBands();
    g.pre.gain.value = on ? Math.pow(10, (P().eqPre || 0) / 20) : 1;
    g.bands.forEach((f, i) => { f.gain.value = on ? clamp(b[i] || 0, -12, 12) : 0; });
  }
  /* ---------- queue & order ---------- */
  function shuffleOrder(first) {
    const rest = queue.map((_, i) => i).filter(i => i !== first);
    for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
    return first >= 0 ? [first].concat(rest) : rest;
  }
  function rebuildOrder(keep) {
    if (P().shuffle) { order = shuffleOrder(keep); pos = keep >= 0 ? 0 : -1; }
    else { order = queue.map((_, i) => i); pos = keep; }
  }
  const persist = debounce(() => { DB.put('kv', { k: 'player', v: { queue, order, pos, t: audio.currentTime || savedT || 0 } }).catch(() => {}); }, 800);
  /* ---------- loading & playing ---------- */
  async function load(autoplay, at) {
    const my = ++tok;
    counted = false; lastErr = ''; pendingSeek = at || 0; playStart = 0;
    const path = curPath();
    loadedPath = null;
    if (!path) { audio.removeAttribute('src'); try { audio.load(); } catch (e) { /* fine */ } emit('track'); emit('state'); return; }
    emit('track');
    const d = S.docs.get(path);
    let url = null;
    try { url = live(path) ? (MIDI_EXT.test(path) ? await midiURL(d) : await assetURL(path)) : null; } catch (e) { lastErr = e.message || String(e); }
    if (my !== tok) return;
    if (!url) { failed(lastErr || 'This song isn\'t on your LANscape right now. Open its folder again.'); return; }
    loadedPath = path;
    audio.src = url;
    session(d);
    persist();
    if (autoplay) await start(); else emit('state');
  }
  async function start() {
    ensureGraph();
    if (ac && ac.state === 'suspended') { try { await ac.resume(); } catch (e) { /* needs a click */ } }
    if (!loadedPath || loadedPath !== curPath()) {
      if (!curPath()) { if (queue.length) { pos = 0; } else return; }
      const t = savedT; savedT = 0;
      return load(true, t);
    }
    try { await audio.play(); }
    catch (e) {
      if (e && e.name === 'NotAllowedError') { lastErr = 'Click Play to start the music.'; emit('blocked'); }
      else if (e && e.name !== 'AbortError') failed(e.message);
    }
  }
  function failed(msg) {
    lastErr = msg || 'This browser can\'t play this kind of file.';
    const p = curPath();
    if (p) { songStats(p).bad = true; }
    emit('error'); emit('state');
    errRun++;
    if (errRun < Math.max(1, queue.length) && queue.length > 1) setTimeout(() => { if (curPath() === p) step(1, true); }, 1300);
  }
  function step(dir, auto) {
    if (!order.length) return;
    if (auto && P().repeat === 'one' && dir > 0 && !lastErr) { audio.currentTime = 0; start(); return; }
    let np = pos;
    for (let tries = 0; tries < order.length; tries++) {
      np += dir;
      if (np >= order.length || np < 0) {
        if (P().repeat === 'all' || (!auto && dir < 0)) { if (np >= order.length && P().shuffle) order = shuffleOrder(-1); np = np < 0 ? order.length - 1 : 0; }
        else { // end of the list
          pos = 0; savedT = 0; audio.pause(); try { audio.currentTime = 0; } catch (e) { /* fine */ } loadedPath = null; emit('track'); emit('state'); persist(); return;
        }
      }
      const p = queue[order[np]];
      if (!auto || (live(p) && !(S.music[p] && (S.music[p].off || S.music[p].bad)))) break;
    }
    pos = np;
    load(true);
  }
  function countPlay() {
    const p = curPath(); if (!p || counted) return;
    counted = true;
    const x = songStats(p);
    x.plays = (x.plays || 0) + 1; x.last = Date.now();
    errRun = 0;
    saveState();
    emit('stats');
  }
  function noteSkip() {
    const p = curPath();
    if (!p || counted || !audio.duration || audio.currentTime > audio.duration * 0.2 || audio.currentTime < 3) return;
    const x = songStats(p); x.skips = (x.skips || 0) + 1; saveState();
  }
  audio.addEventListener('loadedmetadata', () => {
    if (pendingSeek && isFinite(audio.duration)) { try { audio.currentTime = Math.min(pendingSeek, audio.duration - 1); } catch (e) { /* fine */ } }
    pendingSeek = 0;
    const d = curDoc();
    if (d && isFinite(audio.duration) && audio.duration > 0 && Math.abs((d.meta.duration || 0) - audio.duration) > 1) { songStats(d.path).dur = audio.duration; if (!d.meta.duration) d.meta.duration = audio.duration; }
    if (d && S.music[d.path] && S.music[d.path].bad) { delete S.music[d.path].bad; }
    emit('time');
  });
  let lastSave = 0;
  audio.addEventListener('timeupdate', () => {
    const d = audio.duration;
    if (!counted && isFinite(d) && d > 0 && audio.currentTime >= Math.min(d * 0.5, 240)) countPlay();
    if (Date.now() - lastSave > 5000) { lastSave = Date.now(); persist(); }
    emit('time');
    if ('mediaSession' in navigator && navigator.mediaSession.setPositionState && isFinite(d) && d > 0) { try { navigator.mediaSession.setPositionState({ duration: d, position: Math.min(audio.currentTime, d), playbackRate: 1 }); } catch (e) { /* old */ } }
  });
  audio.addEventListener('play', () => { errRun = 0; if (!playStart) playStart = Date.now(); emit('state'); if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing'; });
  audio.addEventListener('pause', () => { emit('state'); persist(); if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused'; });
  audio.addEventListener('ended', () => { countPlay(); step(1, true); });
  audio.addEventListener('error', () => { if (!audio.getAttribute('src')) return; const c = audio.error && audio.error.code; failed(c === 4 ? 'This browser can\'t play ' + (curDoc() ? '.' + curDoc().ext + ' files' : 'this file') + '.' : 'The song couldn\'t be read.'); });
  window.addEventListener('pagehide', () => { DB.put('kv', { k: 'player', v: { queue, order, pos, t: audio.currentTime || savedT || 0 } }).catch(() => {}); });
  /* ---------- the OS media keys / lock screen ---------- */
  async function session(d) {
    if (!('mediaSession' in navigator) || !d) return;
    const i = songInfo(d);
    const art = await artURL(d).catch(() => null);
    try { navigator.mediaSession.metadata = new MediaMetadata({ title: i.title, artist: i.artist, album: i.album, artwork: art ? [{ src: art, sizes: '300x300' }] : [] }); } catch (e) { /* old */ }
  }
  if ('mediaSession' in navigator) {
    const set = (a, fn) => { try { navigator.mediaSession.setActionHandler(a, fn); } catch (e) { /* unsupported */ } };
    set('play', () => api.play()); set('pause', () => api.pause()); set('stop', () => api.stop());
    set('previoustrack', () => api.prev()); set('nexttrack', () => api.next());
    set('seekto', e => api.seek(e.seekTime));
  }
  /* ---------- status bar: ♫ now playing ---------- */
  let sb = null;
  function statusBar() {
    if (!sb) {
      const net = document.getElementById('sbNet');
      if (!net) return;
      sb = el('span', { class: 'sb-music', id: 'sbMusic', hidden: true });
      sb.innerHTML = '<button class="sbm-pp" title="Play/Pause" aria-label="Play or pause"></button><a class="sbm-t" href="#" title="Show in Jukebox"></a><button class="sbm-amp" title="LANamp" aria-label="Show LANamp">amp</button>';
      net.before(sb);
      sb.querySelector('.sbm-pp').addEventListener('click', () => api.toggle());
      sb.querySelector('.sbm-t').addEventListener('click', e => { e.preventDefault(); const d = curDoc(); go(d ? d.url : 'http://music.lanscape.net/'); });
      sb.querySelector('.sbm-amp').addEventListener('click', () => { if (typeof LANamp !== 'undefined') LANamp.toggle(); });
    }
    const d = curDoc();
    sb.hidden = !d;
    if (!d) return;
    const i = songInfo(d);
    const playing = api.playing();
    sb.classList.toggle('on', playing);
    sb.querySelector('.sbm-pp').innerHTML = playing ? '<svg width="9" height="9" viewBox="0 0 9 9"><path d="M1 1h2.6v7H1zM5.4 1H8v7H5.4z" fill="currentColor"/></svg>' : '<svg width="9" height="9" viewBox="0 0 9 9"><path d="M1.5 1v7l6-3.5z" fill="currentColor"/></svg>';
    sb.querySelector('.sbm-t').textContent = '♫ ' + i.title + (i.artist && !/^Unknown/.test(i.artist) ? ' — ' + i.artist : '');
  }
  /* ---------- public face ---------- */
  const api = {
    on(fn) { subs.add(fn); return () => subs.delete(fn); },
    audio,
    get queue() { return queue.slice(); },
    get index() { return curIdx(); },
    current: curDoc, currentPath: curPath,
    playing: () => !!audio.getAttribute('src') && !audio.paused && !audio.ended,
    time: () => (loadedPath ? audio.currentTime || 0 : savedT || 0),
    duration: () => { if (loadedPath && isFinite(audio.duration) && audio.duration > 0) return audio.duration; const d = curDoc(); return d ? songInfo(d).duration : 0; },
    error: () => lastErr,
    /** play a list of songs (paths), starting with one of them */
    playPaths(paths, startAt) {
      queue = paths.filter(Boolean);
      const first = typeof startAt === 'string' ? queue.indexOf(startAt) : (startAt == null ? (P().shuffle ? -1 : 0) : startAt);
      rebuildOrder(first);
      if (pos < 0) pos = 0;
      savedT = 0; errRun = 0;
      emit('queue');
      return load(true);
    },
    /** add songs to the play list; next = right after the current song */
    enqueue(paths, next) {
      paths = paths.filter(Boolean);
      if (!paths.length) return;
      const wasEmpty = !queue.length;
      const at = next && curIdx() >= 0 ? curIdx() + 1 : queue.length;
      queue.splice(at, 0, ...paths);
      // shift order indexes at or after the insertion point, then place the new ones
      order = order.map(i => (i >= at ? i + paths.length : i));
      const added = paths.map((_, k) => at + k);
      if (P().shuffle && !next) { for (const a of added) order.splice(pos + 1 + Math.floor(Math.random() * (order.length - pos)), 0, a); }
      else if (next) order.splice(pos + 1, 0, ...added);
      else order.push(...added);
      if (wasEmpty) { pos = 0; }
      emit('queue'); persist();
    },
    /** take songs out of the play list (indexes into the queue) */
    remove(indexes) {
      const kill = new Set(indexes);
      if (!kill.size) return;
      const cur = curIdx();
      const map = new Map(); let n = 0;
      queue.forEach((p, i) => { if (!kill.has(i)) map.set(i, n++); });
      queue = queue.filter((_, i) => !kill.has(i));
      order = order.filter(i => !kill.has(i)).map(i => map.get(i));
      if (kill.has(cur)) { pos = Math.min(pos, order.length - 1); if (api.playing()) { load(order.length > 0); } else { loadedPath = null; savedT = 0; emit('track'); } }
      else pos = order.indexOf(map.get(cur));
      emit('queue'); persist();
    },
    /** move songs (queue indexes) so they sit before position `to` */
    move(indexes, to) {
      const set = new Set(indexes);
      const idx = queue.map((_, i) => i);
      const moving = idx.filter(i => set.has(i));
      if (!moving.length) return;
      const rest = idx.filter(i => !set.has(i));
      rest.splice(idx.slice(0, to).filter(i => !set.has(i)).length, 0, ...moving);
      const newOf = new Map(rest.map((oi, ni) => [oi, ni]));
      const cur = curIdx();
      queue = rest.map(oi => queue[oi]);
      if (P().shuffle) order = order.map(oi => newOf.get(oi));
      else { order = queue.map((_, i) => i); pos = cur >= 0 ? newOf.get(cur) : pos; }
      emit('queue'); persist();
    },
    /** put the whole play list in a new order (ix = old indexes in their new order) without stopping the song */
    reorder(ix) {
      if (ix.length !== queue.length) return;
      const newOf = new Map(ix.map((oi, ni) => [oi, ni]));
      const cur = curIdx();
      queue = ix.map(i => queue[i]);
      if (P().shuffle) order = order.map(o => newOf.get(o));
      else { order = queue.map((_, i) => i); pos = cur >= 0 ? newOf.get(cur) : pos; }
      emit('queue'); persist();
    },
    clear() { queue = []; order = []; pos = -1; savedT = 0; audio.pause(); loadedPath = null; audio.removeAttribute('src'); try { audio.load(); } catch (e) { /* fine */ } emit('queue'); emit('track'); emit('state'); persist(); },
    jump(queueIndex) { const k = order.indexOf(queueIndex); if (k < 0) return; noteSkip(); pos = k; savedT = 0; errRun = 0; load(true); },
    play: () => start(),
    pause: () => audio.pause(),
    toggle() { if (api.playing()) audio.pause(); else start(); },
    stop() { audio.pause(); if (loadedPath) { try { audio.currentTime = 0; } catch (e) { /* fine */ } } savedT = 0; emit('state'); emit('time'); persist(); },
    next() { noteSkip(); errRun = 0; step(1, false); },
    prev() { if (api.time() > 3 && loadedPath) { audio.currentTime = 0; emit('time'); return; } errRun = 0; step(-1, false); },
    seek(t) { if (!loadedPath) { savedT = Math.max(0, t); emit('time'); return; } try { audio.currentTime = clamp(t, 0, (isFinite(audio.duration) ? audio.duration : t) - 0.05); } catch (e) { /* not seekable */ } emit('time'); },
    setVolume(v) { P().vol = clamp(v, 0, 1); applyVolume(); saveState(); emit('volume'); },
    setBalance(b) { P().bal = clamp(b, -1, 1); if (Math.abs(P().bal) < 0.06) P().bal = 0; applyVolume(); saveState(); emit('volume'); },
    setShuffle(on) { P().shuffle = !!on; rebuildOrder(curIdx()); saveState(); emit('mode'); emit('queue'); persist(); },
    setRepeat(m) { P().repeat = m === 'all' || m === 'one' ? m : 'off'; saveState(); emit('mode'); },
    cycleRepeat() { api.setRepeat({ off: 'all', all: 'one', one: 'off' }[P().repeat || 'off']); },
    eq: {
      bands: () => eqBands().slice(), pre: () => P().eqPre || 0, on: () => !!P().eqOn, preset: () => P().eqPreset || '',
      setBand(i, db) { eqBands()[i] = Math.round(clamp(db, -12, 12) * 10) / 10; P().eqPreset = ''; applyEq(); saveState(); emit('eq'); },
      setPre(db) { P().eqPre = Math.round(clamp(db, -12, 12) * 10) / 10; applyEq(); saveState(); emit('eq'); },
      setOn(on) { P().eqOn = !!on; ensureGraph(); applyEq(); saveState(); emit('eq'); },
      load(name) { const b = EQ_PRESETS[name]; if (!b) return; P().eqBands = b.slice(); P().eqPreset = name; if (!P().eqOn) P().eqOn = true; ensureGraph(); applyEq(); saveState(); emit('eq'); },
      reset() { P().eqBands = EQ_PRESETS.Flat.slice(); P().eqPre = 0; P().eqPreset = 'Flat'; applyEq(); saveState(); emit('eq'); }
    },
    /** fill a byte array with the spectrum / waveform; false when there's no analyser */
    spectrum(u8) { if (!g || !api.playing()) return false; g.an.getByteFrequencyData(u8); return true; },
    wave(u8) { if (!g || !api.playing()) return false; g.an.getByteTimeDomainData(u8); return true; },
    get sampleRate() { return ac ? ac.sampleRate : 44100; },
    rate(path, stars) { const x = songStats(path); x.rating = clamp(Math.round(stars), 0, 5); saveState(); emit('stats'); },
    /** a folder moved inside a bigger one: the play list follows its songs to their new paths */
    remap(fn) { queue = queue.map(fn); if (loadedPath) loadedPath = fn(loadedPath); emit('queue'); emit('track'); persist(); },
    async restore() {
      applyVolume();
      try {
        const r = await DB.get('kv', 'player');
        const v = r && r.v;
        if (!v || !Array.isArray(v.queue)) return;
        queue = v.queue; order = Array.isArray(v.order) && v.order.length === queue.length ? v.order : queue.map((_, i) => i); pos = clamp(v.pos == null ? -1 : v.pos, -1, order.length - 1);
        savedT = v.t || 0;
        emit('queue'); emit('track');
      } catch (e) { /* nothing saved */ }
    }
  };
  return api;
})();
