/* ===================================================================
   Pictures and video: thumbnails, posters, probing. Thumbnails live in
   IndexedDB ('mthumbs') and are read on demand; there can be thousands.
   =================================================================== */
const MThumbs = (() => {
  const mem = new Map();
  const MAX = 800;
  const put = (k, v) => { mem.delete(k); mem.set(k, v); if (mem.size > MAX) mem.delete(mem.keys().next().value); };
  return {
    /** the thumbnail for key, if it was painted for this version of the file */
    async get(key, mtime) {
      const hit = mem.get(key);
      if (hit && (mtime == null || hit.mtime === mtime)) { put(key, hit); return hit.data; }
      const r = await DB.get('mthumbs', key);
      if (r && r.data && (mtime == null || r.mtime === mtime)) { put(key, { data: r.data, mtime: r.mtime }); return r.data; }
      return null;
    },
    peek(key) { const v = mem.get(key); return v ? v.data : null; },
    async set(key, data, mtime) { put(key, { data, mtime }); await DB.put('mthumbs', { path: key, data, mtime }); },
    clear() { mem.clear(); }
  };
})();
function loadImg(url) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('This picture can\'t be decoded.')); i.src = url; });
}
/** a small JPEG of any picture the browser can decode */
async function imageThumb(blob, max = 320, quality = 0.8, cover) {
  let src = null, w = 0, h = 0, bmp = null, url = null;
  try {
    bmp = await createImageBitmap(blob);
    src = bmp; w = bmp.width; h = bmp.height;
  } catch (e) {
    url = URL.createObjectURL(blob);
    const img = await loadImg(url);
    src = img; w = img.naturalWidth || 300; h = img.naturalHeight || 300;
  }
  try {
    const cv = document.createElement('canvas');
    if (cover) {
      cv.width = cover[0]; cv.height = cover[1];
      const k = Math.max(cv.width / w, cv.height / h);
      const c = cv.getContext('2d');
      c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height);
      c.drawImage(src, (cv.width - w * k) / 2, (cv.height - h * k) / 2, w * k, h * k);
    } else {
      const k = Math.min(1, max / Math.max(w, h));
      cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
      const c = cv.getContext('2d');
      c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height);
      c.drawImage(src, 0, 0, cv.width, cv.height);
    }
    return cv.toDataURL('image/jpeg', quality);
  } finally {
    if (bmp && bmp.close) bmp.close();
    if (url) setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}
/** something to show for a picture in a grid: a cached thumbnail, or the picture itself if it's small */
async function mediaThumbURL(d) {
  if (d.kind !== 'image') return null;
  const key = 'img:' + d.path;
  const hit = await MThumbs.get(key, d.mtime);
  if (hit) return hit;
  try {
    if (d.ext === 'svg' || d.ext === 'gif' || d.size < 350e3) return await assetURL(d.path);
    const data = await imageThumb(await getBlob(d), 320, 0.8);
    MThumbs.set(key, data, d.mtime);
    return data;
  } catch (e) { return assetURL(d.path); }
}
function waitEvent(elm, ev, ms) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => { done(); rej(new Error('timeout')); }, ms);
    const ok = () => { done(); res(); };
    const bad = () => { done(); rej(new Error('media error')); };
    const done = () => { clearTimeout(t); elm.removeEventListener(ev, ok); elm.removeEventListener('error', bad); };
    elm.addEventListener(ev, ok);
    elm.addEventListener('error', bad);
  });
}
/** has this video been looked at by this version of LANscape? (older ones gave up on MKV files the browser refused) */
const PROBE_V = 2;
const videoProbed = d => d.meta.probedFor === d.mtime && (d.meta.probeV >= PROBE_V || d.meta.playable !== false || !MKV_EXT.test(d.ext));
function waitReady(v, ms) {
  return new Promise((res, rej) => {
    const t0 = Date.now();
    const tick = () => {
      if (v.readyState >= 2 && !v.seeking) return res();
      if (v.error) return rej(new Error('media error'));
      if (Date.now() - t0 > ms) return rej(new Error('timeout'));
      setTimeout(tick, 60);
    };
    tick();
  });
}
function posterOf(v) {
  const cv = document.createElement('canvas');
  cv.width = 384; cv.height = 216;
  const c = cv.getContext('2d');
  c.fillStyle = '#000'; c.fillRect(0, 0, cv.width, cv.height);
  const k = Math.max(cv.width / v.videoWidth, cv.height / v.videoHeight);
  c.drawImage(v, (cv.width - v.videoWidth * k) / 2, (cv.height - v.videoHeight * k) / 2, v.videoWidth * k, v.videoHeight * k);
  return cv.toDataURL('image/jpeg', 0.78);
}
/** duration, size and a poster frame for a video (or tells us the browser can't play it) */
async function probeVideo(d, wantPoster = true) {
  const mkv = MKV_EXT.test(d.ext);
  if (!(mkv && d.meta.via === 'mkv')) {
    const info = await probeNative(d, wantPoster);
    // an MKV the browser refuses, or reads without a picture, goes through the converter
    if (!mkv || (info && info.playable && info.width)) return info;
  }
  return probeMkv(d, wantPoster);
}
async function probeNative(d, wantPoster) {
  let url;
  try { url = await assetURL(d.path); } catch (e) { url = null; }
  if (!url) return null;
  const v = document.createElement('video');
  v.muted = true; v.preload = 'auto'; v.playsInline = true;
  v.src = url;
  try {
    await waitEvent(v, 'loadedmetadata', 9000);
    const info = { duration: isFinite(v.duration) ? v.duration : 0, width: v.videoWidth, height: v.videoHeight, playable: true };
    if (wantPoster && v.videoWidth) {
      v.currentTime = Math.min(info.duration ? info.duration * 0.12 : 1, 40);
      await waitEvent(v, 'seeked', 9000);
      await sleep(30);
      info.poster = posterOf(v);
    }
    return info;
  } catch (e) {
    return { playable: false, duration: 0 };
  } finally {
    try { v.removeAttribute('src'); v.load(); } catch (e) { /* ignore */ }
  }
}
/** the same, through LANscape's MKV converter */
async function probeMkv(d, wantPoster) {
  if (typeof MkvPlayer === 'undefined' || !mkvCan()) return { playable: false, duration: 0, via: 'mkv', why: 'This browser can\'t stream video from a page.' };
  let p = null;
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto';
  try {
    p = await MkvPlayer.open(await getBlob(d));
    if (p.problem) return { playable: false, duration: p.duration, width: p.info.width, height: p.info.height, via: 'mkv', why: p.problem };
    const at = wantPoster ? Math.min(p.duration ? p.duration * 0.12 : 1, 40) + p.T0 : 0;
    await p.attach(v, at);
    await waitEvent(v, 'loadedmetadata', 12000);
    const info = { duration: p.duration || (isFinite(v.duration) ? v.duration : 0), width: v.videoWidth || p.info.width, height: v.videoHeight || p.info.height, playable: true, via: 'mkv', note: p.note };
    if (wantPoster) {
      v.currentTime = at;
      await waitReady(v, 12000);
      await sleep(40);
      if (v.videoWidth) info.poster = posterOf(v);
    }
    return info;
  } catch (e) {
    return { playable: false, duration: p ? p.duration : 0, via: 'mkv' };
  } finally {
    if (p) p.detach();
    try { v.removeAttribute('src'); v.load(); } catch (e) { /* ignore */ }
  }
}
/** a frame from a video, `frac` of the way in (at most `cap` seconds), up to `w` pixels wide */
async function videoFrame(d, frac, cap, w) {
  const mkv = MKV_EXT.test(d.ext);
  const grab = v => { const W = Math.min(w, v.videoWidth), H = Math.round((W * v.videoHeight) / v.videoWidth); const cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.getContext('2d').drawImage(v, 0, 0, W, H); return cv.toDataURL('image/jpeg', 0.82); };
  if (!(mkv && d.meta.via === 'mkv')) {
    let url = null;
    try { url = await assetURL(d.path); } catch (e) { url = null; }
    if (url) {
      const v = document.createElement('video');
      v.muted = true; v.preload = 'auto'; v.src = url;
      try {
        await waitEvent(v, 'loadedmetadata', 8000);
        if (v.videoWidth) {
          v.currentTime = Math.min(v.duration ? v.duration * frac : 1, cap);
          await waitEvent(v, 'seeked', 8000);
          await sleep(30);
          return grab(v);
        }
      } catch (e) { /* maybe the converter can */ } finally { try { v.removeAttribute('src'); v.load(); } catch (e) { /* fine */ } }
    }
    if (!mkv) return null;
  }
  if (typeof MkvPlayer === 'undefined' || !mkvCan()) return null;
  let p = null;
  const v = document.createElement('video');
  v.muted = true; v.preload = 'auto';
  try {
    p = await MkvPlayer.open(await getBlob(d));
    if (p.problem) return null;
    const at = Math.min(p.duration ? p.duration * frac : 1, cap) + p.T0;
    await p.attach(v, at);
    await waitEvent(v, 'loadedmetadata', 12000);
    v.currentTime = at;
    await waitReady(v, 12000);
    await sleep(40);
    return v.videoWidth ? grab(v) : null;
  } catch (e) { return null; } finally {
    if (p) p.detach();
    try { v.removeAttribute('src'); v.load(); } catch (e) { /* fine */ }
  }
}
/** probe a video once and remember what we learned (in its meta and the poster cache) */
async function learnVideo(d) {
  if (videoProbed(d)) return d.meta;
  const info = await probeVideo(d, true);
  if (!info) return d.meta;
  d.meta.duration = info.duration || d.meta.duration || 0;
  d.meta.width = info.width || 0; d.meta.height = info.height || 0;
  d.meta.playable = info.playable;
  d.meta.via = info.via || '';
  d.meta.why = info.why || '';
  d.meta.probedFor = d.mtime;
  d.meta.probeV = PROBE_V;
  if (info.poster) await MThumbs.set('poster:' + d.path, info.poster, d.mtime);
  if (isKnownDoc(d)) DB.put('meta', metaRecord(d));
  return d.meta;
}
