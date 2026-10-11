// The MKV converter, checked against ffmpeg: every file is repackaged into MP4 fragments,
// then ffprobe counts the frames and ffmpeg decodes every one of them.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const DIR = path.join(__dirname, 'Movies');
const OUT = require('path').join(require('os').tmpdir(), 'lanscape-mkv-out');
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const ok = (name, cond, extra) => results.push((cond ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  — ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : ''));

const ctx = vm.createContext({ Blob, TextDecoder, console, Math, setTimeout, clearTimeout, Promise });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/38-mkv.js'), 'utf8') + '\n;this.M = { mkvOpen, mkvReadCluster, MkvMux, ebmlHead, ebmlKids, ebmlVint };', ctx);
const { mkvOpen, mkvReadCluster, MkvMux } = ctx.M;

const probe = (file, sel, entries) => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', sel, '-show_entries', entries, '-of', 'json', file]).toString());
const countFrames = (file, sel) => { const j = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-count_packets', '-select_streams', sel, '-show_entries', 'stream=codec_name,nb_read_packets,width,height,sample_rate,channels', '-of', 'json', file]).toString()); return j.streams[0] || null; };
const decodeErrors = file => { try { return execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'null', '-'], { stdio: ['ignore', 'pipe', 'pipe'] }).toString(); } catch (e) { return String(e.stderr || e.message); } };
const firstPts = (file, sel) => { const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', sel, '-show_entries', 'packet=pts_time', '-of', 'csv=p=0', file]).toString().trim().split('\n').map(Number).filter(x => !isNaN(x)); return out.length ? Math.min(...out) : null; };
const ptsList = (file, sel) => execFileSync('ffprobe', ['-v', 'error', '-select_streams', sel, '-show_entries', 'packet=pts_time', '-of', 'csv=p=0', file]).toString().trim().split('\n').map(Number).filter(x => !isNaN(x)).sort((a, b) => a - b);

/* ---------- rewrite a file with laced audio and header stripping (what older mkvmerge versions wrote) ---------- */
function ebmlId(id) { const b = []; while (id > 0) { b.unshift(id & 255); id = Math.floor(id / 256); } return Buffer.from(b); }
function ebmlSize(n) { const b = Buffer.alloc(8); b[0] = 0x01; let v = n; for (let i = 7; i >= 1; i--) { b[i] = v % 256; v = Math.floor(v / 256); } return b; }
const el = (id, payload) => Buffer.concat([ebmlId(id), ebmlSize(payload.length), payload]);
function vintU(n) { for (let len = 1; len <= 8; len++) { if (n < Math.pow(2, 7 * len) - 1) { const b = Buffer.alloc(len); let v = n; for (let i = len - 1; i >= 0; i--) { b[i] = v % 256; v = Math.floor(v / 256); } b[0] |= 0x80 >> (len - 1); return b; } } }
function vintS(d) { for (let len = 1; len <= 8; len++) { const bias = Math.pow(2, 7 * len - 1) - 1; if (d >= -bias && d <= bias) { const raw = d + bias; const b = Buffer.alloc(len); let v = raw; for (let i = len - 1; i >= 0; i--) { b[i] = v % 256; v = Math.floor(v / 256); } b[0] |= 0x80 >> (len - 1); return b; } } }
function lacedFile(src, dst, opts) {
  const u8 = new Uint8Array(fs.readFileSync(src));
  const { ebmlHead, ebmlKids } = ctx.M;
  const eh = ebmlHead(u8, 0), segPos = eh.hlen + eh.size, sh = ebmlHead(u8, segPos), seg = segPos + sh.hlen;
  const parts = [];
  let p = seg, audio = opts.track, laceKind = 0;
  while (p < u8.length) {
    const h = ebmlHead(u8, p);
    if (!h) break;
    const body = p + h.hlen, end = body + h.size;
    if (h.id === 0x1549A966) parts.push(Buffer.from(u8.subarray(p, end)));                   // Info
    else if (h.id === 0x1654AE6B) {                                                       // Tracks: add header stripping to the sound track
      const out = [];
      for (const te of ebmlKids(u8, body, end)) {
        if (te.id !== 0xAE) continue;                                                     // (checksums would be wrong now)
        let entry = Buffer.from(u8.subarray(te.dpos, te.dpos + te.size));
        const num = ebmlKids(u8, te.dpos, te.dpos + te.size).find(k => k.id === 0xD7);
        if (opts.strip && num && u8[num.dpos] === audio) entry = Buffer.concat([entry, el(0x6D80, el(0x6240, el(0x5034, Buffer.concat([el(0x4254, Buffer.from([3])), el(0x4255, Buffer.from(opts.strip))]))))]);
        out.push(el(0xAE, entry));
      }
      parts.push(el(0x1654AE6B, Buffer.concat(out)));
    } else if (h.id === 0x1F43B675) {                                                     // Cluster: lace runs of sound frames
      const kids = ebmlKids(u8, body, end), out = [];
      let run = [];
      const flush = () => {
        if (!run.length) return;
        const frames = run.map(r => r.data);
        const head = Buffer.concat([vintU(audio), Buffer.from([(run[0].rel >> 8) & 255, run[0].rel & 255])]);
        if (frames.length === 1) out.push(el(0xA3, Buffer.concat([head, Buffer.from([0x80]), frames[0]])));
        else {
          const kind = [1, 3, 2][laceKind++ % 3];
          const equal = frames.every(f => f.length === frames[0].length);
          const k = kind === 2 && !equal ? 1 : kind;
          let lace;
          if (k === 1) { const b = []; for (const f of frames.slice(0, -1)) { let s = f.length; while (s >= 255) { b.push(255); s -= 255; } b.push(s); } lace = Buffer.from(b); }
          else if (k === 3) { const b = [vintU(frames[0].length)]; for (let i = 1; i < frames.length - 1; i++) b.push(vintS(frames[i].length - frames[i - 1].length)); lace = Buffer.concat(b); }
          else lace = Buffer.alloc(0);
          out.push(el(0xA3, Buffer.concat([head, Buffer.from([0x80 | (k << 1), frames.length - 1]), lace, ...frames])));
        }
        run = [];
      };
      for (const k of kids) {
        if (k.id === 0xBF) continue;                                                      // CRC-32 of the old cluster
        if (k.id === 0xA3 && u8[k.dpos] === (0x80 | audio)) {
          const rel = (u8[k.dpos + 1] << 8) | u8[k.dpos + 2];
          let data = Buffer.from(u8.subarray(k.dpos + 4, k.dpos + k.size));
          if (opts.strip) data = data.subarray(opts.strip.length);
          run.push({ rel, data });
          if (run.length === 4) flush();
          continue;
        }
        flush();
        out.push(Buffer.from(u8.subarray(k.pos, k.dpos + k.size)));
      }
      flush();
      parts.push(el(0x1F43B675, Buffer.concat(out)));
    }
    p = end;
  }
  const segment = el(0x18538067, Buffer.concat(parts));
  fs.writeFileSync(dst, Buffer.concat([Buffer.from(u8.subarray(0, segPos)), segment]));
}

async function convert(file) {
  const buf = fs.readFileSync(file);
  const m = await mkvOpen(new Blob([buf]));
  const x = new MkvMux(m, {});
  await x.setup();
  const v = [], a = [], cues = [];
  if (x.v) v.push(x.init('video'));
  if (x.a) a.push(x.init('audio'));
  let pos = m.first, n = 0;
  while (pos < m.segEnd && n++ < 100000) {
    const cl = await mkvReadCluster(m, pos);
    if (!cl) break;
    const f = x.mux(cl);
    if (f.video) v.push(f.video);
    if (f.audio) a.push(f.audio);
    cues.push(...f.cues);
    pos = cl.end;
  }
  const base = path.join(OUT, path.basename(file, '.mkv'));
  if (x.v) fs.writeFileSync(base + '.video.mp4', Buffer.concat(v.map(b => Buffer.from(b))));
  if (x.a) fs.writeFileSync(base + '.audio.mp4', Buffer.concat(a.map(b => Buffer.from(b))));
  return { m, x, cues, vfile: x.v && base + '.video.mp4', afile: x.a && base + '.audio.mp4' };
}

(async () => {
  lacedFile(path.join(DIR, 'h264_aac.mkv'), path.join(DIR, 'laced_aac.mkv'), { track: 2 });
  lacedFile(path.join(DIR, 'hevc_ac3.mkv'), path.join(DIR, 'stripped_ac3.mkv'), { track: 2, strip: [0x0B, 0x77] });
  const cases = [
    ['h264_aac.mkv', 'h264', 'aac', 'mp4a.40.2'], ['hevc_ac3.mkv', 'hevc', 'ac3', 'ac-3'], ['h264_eac3.mkv', 'h264', 'eac3', 'ec-3'],
    ['h264_mp3.mkv', 'h264', 'mp3', 'mp4a.6B'], ['h264_flac.mkv', 'h264', 'flac', 'flac'], ['vp9_opus.mkv', 'vp9', 'opus', 'opus'],
    ['av1_opus.mkv', 'av1', 'opus', 'opus'], ['live.mkv', 'h264', 'aac', 'mp4a.40.2'], ['laced_aac.mkv', 'h264', 'aac', 'mp4a.40.2'], ['stripped_ac3.mkv', 'hevc', 'ac3', 'ac-3'],
    ['long_live.mkv', 'vp9', 'opus', 'opus']
  ];
  for (const [name, vc, ac, codec] of cases) {
    const file = path.join(DIR, name);
    let r;
    try { r = await convert(file); } catch (e) { ok(name + ' converts', false, e.stack.split('\n').slice(0, 3).join(' | ')); continue; }
    const srcV = countFrames(file, 'v:0'), srcA = countFrames(file, 'a:0');
    const outV = countFrames(r.vfile, 'v:0'), outA = countFrames(r.afile, 'a:0');
    ok(name + ': picture is ' + vc + ' with every frame (' + (srcV && srcV.nb_read_packets) + ')', outV && srcV && outV.codec_name === vc && outV.nb_read_packets === srcV.nb_read_packets && outV.width === srcV.width, { out: outV, src: srcV && srcV.nb_read_packets, codec: r.x.v && r.x.v.codec });
    ok(name + ': sound is ' + ac + ' with every frame (' + (srcA && srcA.nb_read_packets) + '), codec "' + codec + '"', outA && srcA && outA.codec_name === ac && outA.nb_read_packets === srcA.nb_read_packets && r.x.a.codec === codec, { out: outA && outA.nb_read_packets, src: srcA && srcA.nb_read_packets, codec: r.x.a && r.x.a.codec });
    const ev = decodeErrors(r.vfile), ea = decodeErrors(r.afile);
    ok(name + ': ffmpeg decodes the repackaged picture and sound without errors', !ev.trim() && !ea.trim(), (ev + ea).slice(0, 300));
    // timing: display times match the original (shifted by T0), and the sound starts with the picture
    const sp = ptsList(file, 'v:0'), op = ptsList(r.vfile, 'v:0');
    let worst = 0;
    for (let i = 0; i < Math.min(sp.length, op.length); i++) worst = Math.max(worst, Math.abs(op[i] - r.x.T0 - sp[i]));
    ok(name + ': every picture keeps its display time (T0 ' + r.x.T0.toFixed(3) + 's, D ' + r.x.D + ')', sp.length === op.length && worst < 0.0015, { worst, n: [sp.length, op.length] });
    const sa = firstPts(file, 'a:0'), oa = firstPts(r.afile, 'a:0');
    ok(name + ': sound starts in step with the picture', Math.abs((oa - r.x.T0) - sa) < 0.002, { src: sa, out: oa, T0: r.x.T0 });
  }
  // subtitles inside the file
  let r = await convert(path.join(DIR, 'h264_aac.mkv'));
  ok('SRT subtitles in the file become cues at the right times', r.cues.length === 3 && Math.abs(r.cues[0].start - r.x.T0 - 1) < 0.01 && Math.abs(r.cues[0].end - r.cues[0].start - 2) < 0.01 && /LANscape/.test(r.cues[0].text) && r.x.subs.get(r.cues[0].track).lang === 'en', r.cues.slice(0, 2));
  r = await convert(path.join(DIR, 'vp9_opus.mkv'));
  ok('ASS subtitles lose their styling codes and keep their commas', r.cues.length === 2 && r.cues[0].text === 'Hello, world\nsecond line' && r.cues[1].text === 'Commas, in, text', r.cues.map(c => c.text));
  // DTS sound: the picture plays, the sound is explained
  r = await convert(path.join(DIR, 'h264_dts.mkv'));
  ok('a film with DTS sound plays its picture and says why there is no sound', r.x.v && !r.x.a && /without sound.*DTS/.test(r.x.note) && !r.x.problem, r.x.note);
  // no index in the file: the duration comes from the last cluster, and jumping walks the cluster headers
  const live = await mkvOpen(new Blob([fs.readFileSync(path.join(DIR, 'long_live.mkv'))]));
  const lx = new MkvMux(live, {}); await lx.setup();
  const p40 = await lx.posFor(40);
  const c40 = await mkvReadCluster(live, p40);
  ok('a file without an index still knows its length and can jump', !live.cues && live.duration > 74 && live.duration < 75.5 && c40.time * live.sc <= 40 && c40.time * live.sc > 30, { dur: live.duration, at: c40.time * live.sc });
  const long = await mkvOpen(new Blob([fs.readFileSync(path.join(DIR, 'long_vp9.mkv'))]));
  const gx = new MkvMux(long, {}); await gx.setup();
  const g40 = await mkvReadCluster(long, await gx.posFor(40));
  const firstKey = g40.blocks.find(b => b.track === gx.v.t.number && b.key);
  ok('with an index, a jump lands on the keyframe at or before the spot', long.cues && firstKey && firstKey.time * long.sc <= 40 && firstKey.time * long.sc > 37, { key: firstKey && firstKey.time * long.sc });
  // several sound tracks: when the main one can't play here, pick another in the same language, commentary last
  const multi = await mkvOpen(new Blob([fs.readFileSync(path.join(DIR, 'multi_audio.mkv'))]));
  const mx = new MkvMux(multi, { supports: mime => !/ac-3/.test(mime) }); await mx.setup();
  ok('a film whose main sound can\'t play here gets the other English track, not the commentary', mx.a && mx.a.t.name === 'Stereo' && /main sound track \(Dolby Digital \(AC-3\)\).*"Stereo"/.test(mx.note), { pick: mx.a && mx.a.t.name, note: mx.note });
  const mx2 = new MkvMux(multi, {}); await mx2.setup();
  ok('…and when it can, the main track plays', mx2.a && mx2.a.t.name === 'Surround' && !mx2.note, { pick: mx2.a && mx2.a.t.name, note: mx2.note });
  // a codec browsers can't play at all
  console.log(results.join('\n'));
  console.log(results.filter(x => x.startsWith('PASS')).length + ' passed, ' + results.filter(x => x.startsWith('FAIL')).length + ' failed');
})().catch(e => { console.log(results.join('\n')); console.error(e); process.exit(1); });
