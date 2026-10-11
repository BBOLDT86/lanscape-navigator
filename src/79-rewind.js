/* ===================================================================
   Rewind Video: your movies, shows and home videos the way the big
   streaming sites show them — a hero, rows you scroll sideways,
   hover previews, a detail card, Continue Watching, My List — and a
   full player with resume, subtitles, speed, next episode and PiP.
   =================================================================== */
const RW_HOST = 'http://www.rewindvideo.com';
const RW_PLAY = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M6 3.5v17l14-8.5z" fill="currentColor"/></svg>';
const RW_PAUSE = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M5 3h5v18H5zM14 3h5v18h-5z" fill="currentColor"/></svg>';
const RW_INFO = '<svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M11 10h2v8h-2zM11 6h2v2h-2z" fill="currentColor"/></svg>';
const RW_PLUS = '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z" fill="currentColor"/></svg>';
const RW_CHECK = '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M4 12.5 9.5 18 20 6.5" fill="none" stroke="currentColor" stroke-width="2.6"/></svg>';
const RW_BACK10 = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 5V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z" fill="currentColor"/><text x="12" y="16.5" font-size="7" text-anchor="middle" fill="currentColor" font-family="Arial" font-weight="bold">10</text></svg>';
const RW_FWD10 = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 5V1l5 5-5 5V7a6 6 0 1 0 6 6h2a8 8 0 1 1-8-8z" fill="currentColor"/><text x="12" y="16.5" font-size="7" text-anchor="middle" fill="currentColor" font-family="Arial" font-weight="bold">10</text></svg>';
const RW_VOL = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M3 9h4l5-4v14l-5-4H3z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
const RW_MUTE = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M3 9h4l5-4v14l-5-4H3z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="1.8"/></svg>';
const RW_CC = '<svg viewBox="0 0 24 24" width="22" height="22"><rect x="2.5" y="5" width="19" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10.5 10.2a2.6 2.6 0 1 0 0 3.6M17.5 10.2a2.6 2.6 0 1 0 0 3.6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
const RW_FULL = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
const RW_PIP = '<svg viewBox="0 0 24 24" width="22" height="22"><rect x="2.5" y="4.5" width="19" height="15" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="12" y="11" width="7" height="6" fill="currentColor"/></svg>';
const RW_NEXT = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 4v16l11-8zM17 4h3v16h-3z" fill="currentColor"/></svg>';
const RW_LOGO = '<span class="rw-logo" aria-label="Rewind Video"><b>REWIND</b><i></i></span>';
const REWIND_CSS = `body.app-rewind{background:#111;color:#e5e5e5;font:14px/1.4 "Helvetica Neue",Helvetica,Arial,"Liberation Sans",sans-serif;overflow:hidden}
.rw{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;position:relative;scrollbar-color:#444 #111}
.rw a{color:inherit}
.rw-nav{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:22px;padding:14px 4%;background:linear-gradient(rgba(0,0,0,.85),rgba(0,0,0,0));transition:background .3s}
.rw-nav.solid{background:#111}
.rw-logo{display:inline-flex;flex-direction:column;cursor:pointer;user-select:none}
.rw-logo b{font:italic 900 26px/1 "Arial Black","Helvetica Neue",Arial,sans-serif;letter-spacing:1px;background:linear-gradient(180deg,#fff 0,#7fe3ff 45%,#0aa0ff 55%,#7c4dff);-webkit-background-clip:text;background-clip:text;color:transparent;transform:skewX(-8deg);filter:drop-shadow(0 2px 0 rgba(0,0,0,.6))}
.rw-logo i{height:4px;margin-top:2px;background:linear-gradient(90deg,#00e5ff 0 33%,#ff2bd6 33% 66%,#ffd400 66%);transform:skewX(-8deg)}
.rw-nav .lk{display:flex;gap:18px;font-size:14px}
.rw-nav .lk a{text-decoration:none;color:#e5e5e5;cursor:pointer}
.rw-nav .lk a.on{font-weight:bold;color:#fff}
.rw-nav .lk a:hover{color:#b3b3b3}
.rw-nav .sp{flex:1}
.rw-srch{display:flex;align-items:center;gap:6px;border:1px solid rgba(255,255,255,.5);background:rgba(0,0,0,.7);padding:4px 8px}
.rw-srch input{background:none;border:0;color:#fff;font:14px inherit;width:min(220px,30vw);outline:none}
.rw-hero{position:relative;height:min(56.25vw,78vh);min-height:300px;margin-top:-64px;display:flex;align-items:flex-end;padding:0 4% 12vh;background:#000 center/cover no-repeat}
.rw-hero::before{content:"";position:absolute;inset:0;background:linear-gradient(77deg,rgba(0,0,0,.75),rgba(0,0,0,0) 70%),linear-gradient(0deg,#111 0,rgba(17,17,17,0) 30%)}
.rw-hero .in{position:relative;max-width:min(560px,90%)}
.rw-hero h1{font:900 clamp(30px,5vw,64px)/1 "Arial Black","Helvetica Neue",Arial,sans-serif;margin:0 0 14px;text-shadow:2px 2px 6px rgba(0,0,0,.5);letter-spacing:-1px}
.rw-hero .meta{display:flex;gap:10px;align-items:center;font-size:14px;color:#ddd;margin-bottom:10px;flex-wrap:wrap}
.rw-hero p{font-size:clamp(13px,1.3vw,18px);text-shadow:1px 1px 3px rgba(0,0,0,.6);margin:0 0 18px}
.rw-btns{display:flex;gap:10px;flex-wrap:wrap}
.rw-b{display:inline-flex;align-items:center;gap:8px;border:0;border-radius:4px;padding:8px 22px 8px 16px;font:bold 16px Arial,sans-serif;cursor:pointer;color:#000;background:#fff}
.rw-b:hover{background:rgba(255,255,255,.75)}
.rw-b.gr{background:rgba(109,109,110,.7);color:#fff}
.rw-b.gr:hover{background:rgba(109,109,110,.45)}
.rw-b.sm{padding:6px 14px;font-size:14px}
.rw-badge{border:1px solid rgba(255,255,255,.4);padding:0 5px;font-size:11px;border-radius:2px;line-height:16px}
.rw-new{color:#46d369;font-weight:bold}
.rw-rows{position:relative;margin-top:-8vh;padding-bottom:60px;z-index:2}
.rw-rows.flat{margin-top:20px}
.rw-row{margin:0 0 3vw}
.rw-row h2{font-size:clamp(15px,1.4vw,22px);margin:0 4% 8px;color:#e5e5e5;font-weight:bold;display:flex;align-items:baseline;gap:10px}
.rw-row h2 a{font-size:12px;color:#54b9c5;text-decoration:none;font-weight:bold;opacity:0;transition:opacity .2s;cursor:pointer}
.rw-row:hover h2 a{opacity:1}
.rw-track{position:relative}
.rw-strip{display:flex;gap:6px;overflow-x:auto;overflow-y:visible;padding:26px 4%;margin:-26px 0;scroll-behavior:smooth;scrollbar-width:none}
.rw-strip::-webkit-scrollbar{display:none}
.rw-arr{position:absolute;top:0;bottom:0;width:4%;min-width:28px;z-index:6;border:0;background:rgba(20,20,20,.5);color:#fff;font-size:34px;cursor:pointer;opacity:0;transition:opacity .2s}
.rw-track:hover .rw-arr{opacity:1}
.rw-arr:hover{background:rgba(20,20,20,.75)}
.rw-arr.l{left:0}.rw-arr.r{right:0}
.rw-card{position:relative;flex:0 0 clamp(150px,17.5vw,300px);aspect-ratio:16/9;border-radius:4px;background:#2a2a2a center/cover no-repeat;cursor:pointer;transition:transform .3s .15s,box-shadow .3s .15s;transform-origin:center}
.rw-card:hover,.rw-card:focus-visible{transform:scale(1.22);z-index:5;box-shadow:0 8px 24px rgba(0,0,0,.75);outline:none}
.rw-strip .rw-card:first-child{transform-origin:left center}
.rw-strip .rw-card:last-child{transform-origin:right center}
.rw-card .ph{position:absolute;inset:0;display:flex;align-items:flex-end;padding:8px;border-radius:4px;font:bold 15px/1.15 Arial,sans-serif;color:#fff;text-shadow:0 1px 3px #000;background:linear-gradient(135deg,var(--c1,#2b3a67),var(--c2,#7c4dff))}
.rw-card .ph~.tt{display:none}
.rw-card .tt{position:absolute;left:0;right:0;bottom:0;padding:18px 8px 6px;font:bold 13px/1.15 Arial,sans-serif;color:#fff;text-shadow:0 1px 3px #000;background:linear-gradient(transparent,rgba(0,0,0,.8));border-radius:0 0 4px 4px}
.rw-card .pv{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:4px;background:#000}
.rw-card .prog{position:absolute;left:8px;right:8px;bottom:4px;height:3px;background:rgba(255,255,255,.35)}
.rw-card .prog i{display:block;height:100%;background:#e50914;background:#00b3ff}
.rw-card .du{position:absolute;right:6px;top:6px;font:bold 11px Arial,sans-serif;background:rgba(0,0,0,.7);padding:1px 5px;border-radius:2px}
.rw-card .no{position:absolute;left:6px;top:6px;font:bold 10px Arial,sans-serif;background:#b00;padding:1px 5px;border-radius:2px}
.rw-card .hov{position:absolute;left:0;right:0;top:100%;background:#181818;border-radius:0 0 4px 4px;padding:8px;display:none;box-shadow:0 8px 24px rgba(0,0,0,.75)}
.rw-card:hover .hov{display:block}
.rw-card .hov .ib{display:flex;gap:6px;margin-bottom:6px}
.rw-ic{width:28px;height:28px;border-radius:50%;border:2px solid rgba(255,255,255,.6);background:rgba(42,42,42,.6);color:#fff;display:grid;place-items:center;cursor:pointer;padding:0}
.rw-ic:hover{border-color:#fff}
.rw-ic.w{background:#fff;color:#000;border-color:#fff}
.rw-card .hov .m{font-size:11px;color:#bcbcbc;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.rw-top{display:flex;gap:6px;align-items:flex-end}
.rw-top .n{font:900 clamp(80px,9vw,150px)/.8 "Arial Black",Arial,sans-serif;color:#141414;-webkit-text-stroke:3px #595959;margin-right:-18px;letter-spacing:-8px;user-select:none}
.rw-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(clamp(150px,17vw,260px),1fr));gap:30px 6px;padding:20px 4% 60px}
.rw-grid .rw-card{flex:none;width:100%}
.rw-grid h1{grid-column:1/-1;margin:0;font-size:26px}
.rw-empty{padding:80px 4%;text-align:center;color:#999;font-size:16px}
.rw-modal-bg{position:fixed;inset:0;z-index:40;background:rgba(0,0,0,.7);overflow-y:auto;padding:30px 12px}
.rw-modal{position:relative;max-width:850px;margin:0 auto;background:#181818;border-radius:6px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.8)}
.rw-modal .bd{position:relative;aspect-ratio:16/9;background:#000 center/cover no-repeat}
.rw-modal .bd::after{content:"";position:absolute;inset:0;background:linear-gradient(0deg,#181818 0,rgba(24,24,24,0) 45%)}
.rw-modal .bd .in{position:absolute;left:4%;bottom:8%;z-index:2;max-width:70%}
.rw-modal .bd h2{font:900 clamp(22px,4vw,40px)/1.05 "Arial Black",Arial,sans-serif;margin:0 0 14px}
.rw-modal .x{position:absolute;right:12px;top:12px;z-index:3;width:36px;height:36px;border-radius:50%;border:0;background:#181818;color:#fff;font-size:22px;cursor:pointer}
.rw-modal .body{display:grid;grid-template-columns:2fr 1fr;gap:24px;padding:4px 4% 24px}
.rw-modal .body .m{display:flex;gap:8px;align-items:center;flex-wrap:wrap;color:#bcbcbc;margin-bottom:10px}
.rw-modal .body .side{font-size:13px;color:#777}
.rw-modal .body .side span{color:#ddd}
.rw-modal .body .side div{margin-bottom:8px;word-break:break-word}
.rw-modal h3{margin:6px 4% 12px;font-size:20px;display:flex;justify-content:space-between;align-items:center}
.rw-modal h3 select{background:#242424;color:#fff;border:1px solid #4d4d4d;font:15px Arial,sans-serif;padding:6px 10px;border-radius:3px}
.rw-ep{display:flex;gap:14px;align-items:center;padding:14px 4%;border-bottom:1px solid #404040;cursor:pointer;border-radius:4px}
.rw-ep:hover{background:#333}
.rw-ep.cur{background:#2a2a2a}
.rw-ep .n{font-size:22px;color:#d2d2d2;width:26px;text-align:center;flex:none}
.rw-ep .th{width:130px;flex:none;aspect-ratio:16/9;border-radius:4px;background:#333 center/cover no-repeat;position:relative}
.rw-ep .th .prog{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(255,255,255,.3)}
.rw-ep .th .prog i{display:block;height:100%;background:#00b3ff}
.rw-ep .t{flex:1;min-width:0}
.rw-ep .t b{display:flex;justify-content:space-between;gap:8px}
.rw-ep .t span{color:#999;font-size:13px}
.rw-more{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px;padding:0 4% 24px}
.rw-more .rw-card{flex:none;width:100%}
.rw-more .rw-card:hover{transform:none;box-shadow:0 0 0 2px #fff}
.rw-foot{padding:30px 4% 50px;color:#777;font-size:12px;text-align:center}
.rw-foot b{color:#00b3ff;letter-spacing:2px}
/* player */
.rwp{position:fixed;inset:0;background:#000;z-index:30;display:flex;align-items:center;justify-content:center;user-select:none}
.rwp video{width:100%;height:100%;object-fit:contain;background:#000}
.rwp .subs{position:absolute;left:5%;right:5%;bottom:7%;text-align:center;pointer-events:none;transition:bottom .25s;z-index:1}
.rwp:not(.idle) .subs{bottom:120px}
.rwp .subs span{display:inline-block;background:rgba(0,0,0,.6);color:#fff;font:clamp(16px,2.6vw,34px)/1.25 Arial,sans-serif;padding:2px 10px;white-space:pre-line;text-shadow:0 1px 2px #000}
.rwp.idle{cursor:none}
.rwp .ui{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;transition:opacity .4s;pointer-events:none}
.rwp.idle .ui{opacity:0}
.rwp .ui>*{pointer-events:auto}
.rwp .tb{display:flex;align-items:center;gap:16px;padding:18px 24px;border:0;flex-wrap:nowrap;background:linear-gradient(rgba(0,0,0,.7),transparent)}
.rwp .tb button{background:none;border:0;color:#fff;cursor:pointer;display:flex;align-items:center;gap:8px;font:15px Arial,sans-serif;padding:4px}
.rwp .tb .ti{font:bold 16px Arial,sans-serif;text-shadow:0 1px 2px #000}
.rwp .bb{padding:0 24px 18px;background:linear-gradient(transparent,rgba(0,0,0,.8))}
.rwp .sk{position:relative;height:16px;display:flex;align-items:center;cursor:pointer;margin-bottom:6px}
.rwp .sk .tr{position:relative;flex:1;height:4px;background:rgba(255,255,255,.3);transition:height .1s}
.rwp .sk:hover .tr{height:7px}
.rwp .sk .bf{position:absolute;left:0;top:0;bottom:0;background:rgba(255,255,255,.35)}
.rwp .sk .pl{position:absolute;left:0;top:0;bottom:0;background:#00b3ff}
.rwp .sk .th{position:absolute;top:50%;width:15px;height:15px;margin:-7.5px 0 0 -7.5px;border-radius:50%;background:#00b3ff;transform:scale(0);transition:transform .1s}
.rwp .sk:hover .th{transform:scale(1)}
.rwp .sk .tip{position:absolute;bottom:18px;transform:translateX(-50%);background:rgba(0,0,0,.85);padding:2px 6px;font:12px Arial,sans-serif;border-radius:2px;display:none;white-space:nowrap}
.rwp .sk:hover .tip{display:block}
.rwp .sk .rem{margin-left:12px;font:13px Arial,sans-serif;min-width:52px;text-align:right}
.rwp .ctl{display:flex;align-items:center;gap:14px}
.rwp .ctl button{background:none;border:0;color:#fff;cursor:pointer;padding:4px;display:grid;place-items:center;transition:transform .1s}
.rwp .ctl button:hover{transform:scale(1.2)}
.rwp .ctl .nm{flex:1;text-align:center;font:bold 15px Arial,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rwp .ctl .nm span{font-weight:normal;color:#bbb;margin-left:8px}
.rwp .vw{display:flex;align-items:center;gap:6px}
.rwp .vw input{width:0;opacity:0;transition:width .2s,opacity .2s;accent-color:#00b3ff}
.rwp .vw:hover input,.rwp .vw input:focus{width:80px;opacity:1}
.rwp .menu{position:absolute;right:24px;bottom:78px;background:#262626;border-radius:4px;padding:8px 0;min-width:200px;box-shadow:0 6px 20px rgba(0,0,0,.6);font:15px Arial,sans-serif;z-index:3}
.rwp .menu h4{margin:4px 16px 8px;font-size:16px}
.rwp .menu button{display:block;width:100%;text-align:left;background:none;border:0;color:#ccc;padding:7px 16px 7px 34px;cursor:pointer;font:inherit;position:relative}
.rwp .menu button:hover{color:#fff;background:#333}
.rwp .menu button.on{color:#fff}
.rwp .menu button.on::before{content:"✓";position:absolute;left:12px}
.rwp .flash{position:absolute;left:50%;top:50%;width:90px;height:90px;margin:-45px;border-radius:50%;background:rgba(0,0,0,.5);display:grid;place-items:center;color:#fff;opacity:0;pointer-events:none}
.rwp .flash.go{animation:rwflash .6s ease-out}
@keyframes rwflash{0%{opacity:1;transform:scale(.8)}100%{opacity:0;transform:scale(1.4)}}
.rwp .spin{position:absolute;left:50%;top:50%;width:54px;height:54px;margin:-27px;border:5px solid rgba(255,255,255,.2);border-top-color:#00b3ff;border-radius:50%;animation:rwspin .9s linear infinite;display:none}
.rwp.wait .spin{display:block}
@keyframes rwspin{to{transform:rotate(360deg)}}
.rwp .nextc{position:absolute;right:28px;bottom:110px;width:min(340px,80vw);background:rgba(20,20,20,.92);border-radius:6px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,.7);display:none}
.rwp .nextc.on{display:block}
.rwp .nextc .im{aspect-ratio:16/9;background:#333 center/cover no-repeat}
.rwp .nextc .tx{padding:10px 12px}
.rwp .nextc .tx small{color:#aaa;display:block}
.rwp .nextc .bt{display:flex;gap:8px;padding:0 12px 12px}
.rwp .bad{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:20px;background:#000 center/cover no-repeat}
.rwp .bad .in{background:rgba(0,0,0,.82);padding:28px 32px;border-radius:8px;max-width:520px}
.rwp .bad h2{margin:0 0 10px;font:900 26px "Arial Black",Arial,sans-serif}
.rwp .bad p{color:#ccc;margin:0 0 18px}
.rwp .bad .rw-btns{justify-content:center}
@media (max-width:640px){.rw-nav .lk{display:none}.rw-modal .body{grid-template-columns:1fr}.rwp .ctl .nm{display:none}.rw-top .n{display:none}}`;
/* ---------- the catalog ---------- */
function rwVideos() { return docsShown().filter(d => d.kind === 'video' && d.active !== false); }
const RW_SERIES = d => (d.meta.series || '').trim();
function rwInfo(d) {
  const m = d.meta || {}, vp = S.videoPos[d.path] || {};
  const series = RW_SERIES(d);
  const base = series || m.title || d.name;
  const parts = d.path.split('/');
  const folder = parts.length > 2 ? parts[parts.length - 2] : '';
  let epName = '';
  if (series) {
    const mm = /\b[Ss]\d{1,2}[ ._-]?[Ee]\d{1,3}\b(.*)$/.exec(d.name.replace(/\.[a-z0-9]+$/i, ''));
    if (mm) { let rest = mm[1].replace(/[._]+/g, ' '); const rt = RELEASE_TAGS.exec(rest); if (rt) rest = rest.slice(0, rt.index); epName = rest.replace(/^[\s-]+|[\s(\[-]+$/g, '').trim(); }
  }
  return {
    d, path: d.path, series, season: m.season || 0, episode: m.episode || 0, epName, year: m.year || '', dur: m.duration || vp.d || 0, w: m.width || 0, h: m.height || 0,
    title: series ? series : (m.title || prettyName(d.name)), epTitle: series ? 'S' + m.season + ':E' + m.episode : '', name: base,
    playable: (m.playable !== false || !videoProbed(d)) && rwCanPlay(d), folder, pos: vp.t || 0, plays: vp.n || 0, last: vp.ts || 0, done: !!vp.done, added: S.firstSeen[d.path] || d.mtime || 0
  };
}
const RW_MIME = { mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg', mov: 'video/quicktime', mkv: 'video/x-matroska', avi: 'video/x-msvideo', wmv: 'video/x-ms-wmv', flv: 'video/x-flv', mpg: 'video/mpeg', mpeg: 'video/mpeg', '3gp': 'video/3gpp', m2ts: 'video/mp2t' };
function rwCanPlay(d) {
  if (/^(avi|wmv|flv|mpg|mpeg|m2ts)$/.test(d.ext)) return false;
  try { const v = document.createElement('video'); const t = RW_MIME[d.ext]; return !t || v.canPlayType(t) !== '' || d.ext === 'mkv' || d.ext === 'mov'; } catch (e) { return true; }
}
const rwSeriesKey = s => slug(s);
/** has the viewer started this one (and not finished it)? */
const rwStarted = v => !v.done && v.dur > 0 && v.pos > Math.min(5, v.dur * 0.08);
function rwHue(str) { let h = 0; for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
/** pictures that sit next to a video: same name, poster.jpg, folder.jpg, fanart.jpg */
function rwArtFor(d, kind) {
  const node = S.tree && S.tree.get(d.dir);
  if (!node) return null;
  const base = d.name.replace(/\.[a-z0-9]+$/i, '').toLowerCase();
  const imgs = node.files.filter(f => f.kind === 'image');
  const by = re => imgs.find(f => re.test(f.name));
  if (kind === 'backdrop') return by(new RegExp('^' + base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[-._ ](fanart|backdrop|background)\\.', 'i')) || by(/^(fanart|backdrop|background)\./i) || null;
  return imgs.find(f => f.name.replace(/\.[a-z0-9]+$/i, '').toLowerCase() === base) || by(new RegExp('^' + base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[-._ ](poster|thumb|cover)\\.', 'i')) || by(/^(poster|folder|cover|thumb)\./i) || null;
}
async function rwThumb(d) {
  const p = await MThumbs.get('poster:' + d.path, d.mtime);
  if (p) return p;
  const art = rwArtFor(d) || rwArtFor(d, 'backdrop');
  if (art) { try { return await mediaThumbURL(art); } catch (e) { /* fall through */ } }
  return null;
}
async function rwBackdrop(d) {
  const fan = rwArtFor(d, 'backdrop');
  if (fan) { try { return await assetURL(fan.path); } catch (e) { /* fall through */ } }
  if (d.demo) { const fr = await MThumbs.get('frame:' + d.path, d.mtime); if (fr) return fr; }
  else if (d.meta.playable !== false && rwCanPlay(d)) { const big = await rwBigFrame(d); if (big) return big; }
  const art = rwArtFor(d);
  if (art) { try { return await assetURL(art.path); } catch (e) { /* fall through */ } }
  return MThumbs.get('poster:' + d.path, d.mtime);
}
/** a sharp frame for the big banner (kept with the posters) */
async function rwBigFrame(d) {
  const key = 'frame:' + d.path;
  const hit = await MThumbs.get(key, d.mtime);
  if (hit) return hit;
  const data = await videoFrame(d, 0.15, 90, 1280);
  if (data) await MThumbs.set(key, data, d.mtime);
  return data;
}
/** learn posters a couple at a time, in the background */
const rwLearnQ = [];
let rwLearning = 0;
function rwLearn(d, done) {
  if (videoProbed(d)) { done && done(); return; }
  rwLearnQ.push([d, done]);
  rwPump();
}
function rwPump() {
  while (rwLearning < 2 && rwLearnQ.length) {
    const [d, done] = rwLearnQ.shift();
    if (videoProbed(d)) { if (done) done(); continue; }
    rwLearning++;
    learnVideo(d).catch(() => {}).finally(() => { rwLearning--; if (done) try { done(); } catch (e) { /* gone */ } rwPump(); });
  }
}
function rewindRoute(path, q) {
  let m;
  if ((m = /^\/watch\/([^/]+)\/?$/.exec(path))) {
    const d = S.slugs.get('video:' + decodeURIComponent(m[1]).toLowerCase());
    if (!d) return { type: 'gen', url: RW_HOST + path, title: '404 Not Found', html: notFoundPage(RW_HOST + path, 'www.rewindvideo.com'), status: 404 };
    return { type: 'app', doc: d, url: d.url, view: { watch: d.path }, title: rwInfo(d).name + ' - Rewind' };
  }
  if ((m = /^\/title\/([^/]+)\/?$/.exec(path))) {
    const d = S.slugs.get('video:' + decodeURIComponent(m[1]).toLowerCase());
    if (!d) return { type: 'gen', url: RW_HOST + path, title: '404 Not Found', html: notFoundPage(RW_HOST + path, 'www.rewindvideo.com'), status: 404 };
    return { type: 'app', url: RW_HOST + path, view: { title: d.path }, title: rwInfo(d).name + ' - Rewind' };
  }
  if ((m = /^\/series\/([^/]+)\/?$/.exec(path))) return { type: 'app', url: RW_HOST + path, view: { series: decodeURIComponent(m[1]) }, title: 'Rewind' };
  if ((m = /^\/browse\/([^/]+)\/?$/.exec(path))) return { type: 'app', url: RW_HOST + path, view: { row: decodeURIComponent(m[1]) }, title: 'Rewind' };
  if (path === '/my-list') return { type: 'app', url: RW_HOST + '/my-list', view: { tab: 'list' }, title: 'My List - Rewind' };
  if (path === '/tv') return { type: 'app', url: RW_HOST + '/tv', view: { tab: 'tv' }, title: 'TV Shows - Rewind' };
  if (path === '/movies') return { type: 'app', url: RW_HOST + '/movies', view: { tab: 'movies' }, title: 'Movies - Rewind' };
  if (path === '/search') return { type: 'app', url: RW_HOST + '/search?q=' + encodeURIComponent(q.get('q') || ''), view: { q: q.get('q') || '' }, title: 'Search - Rewind' };
  return null;
}
async function mountRewind(ctx) {
  const route = Object.assign({}, ctx.route.view || {});
  if (ctx.file && ctx.file.kind === 'video' && !route.watch && !route.title) route.watch = ctx.file.path;
  if (typeof Player !== 'undefined' && Player.playing() && route.watch) Player.pause();
  const myList = new Set((await ctx.kv.get('rewind:mylist')) || []);
  const prefs = Object.assign({ vol: 1, muted: false, subs: '', speed: 1 }, (await ctx.kv.get('rewind:prefs')) || {});
  const shared = { myList, prefs, saveList: () => ctx.kv.set('rewind:mylist', Array.from(myList)), savePrefs: () => ctx.kv.set('rewind:prefs', prefs) };
  if (route.watch) { const d = S.docs.get(route.watch); if (d) return rewindPlayer(ctx, d, shared); }
  return rewindBrowse(ctx, route, shared);
}
/* ---------- browse ---------- */
async function rewindBrowse(ctx, route, shared) {
  const { h, doc, win } = ctx;
  const all = rwVideos().map(rwInfo);
  let tab = route.tab || 'home';
  const scroller = h('div', { class: 'rw' });
  ctx.root.append(scroller);
  const searchIn = h('input', { type: 'search', placeholder: 'Titles, folders, years', 'aria-label': 'Search videos' });
  const navLinks = [['home', 'Home', RW_HOST + '/'], ['tv', 'TV Shows', RW_HOST + '/tv'], ['movies', 'Movies', RW_HOST + '/movies'], ['list', 'My List', RW_HOST + '/my-list']];
  const nav = h('div', { class: 'rw-nav' }, h('span', { html: RW_LOGO, onclick: () => setTab('home') }),
    h('div', { class: 'lk' }, ...navLinks.map(([k, label]) => h('a', { 'data-tab': k, text: label, class: k === tab ? 'on' : '', tabindex: '0', onclick: () => setTab(k) }))),
    h('div', { class: 'sp' }), h('label', { class: 'rw-srch' }, h('span', { html: '<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="10" cy="10" r="6.5" fill="none" stroke="#fff" stroke-width="2"/><path d="M15 15l6 6" stroke="#fff" stroke-width="2.4"/></svg>' }), searchIn));
  const content = h('div');
  scroller.append(nav, content);
  ctx.on(scroller, 'scroll', () => nav.classList.toggle('solid', scroller.scrollTop > 30), { passive: true });
  const seriesOf = new Map();
  for (const v of all) if (v.series) { const k = rwSeriesKey(v.series); if (!seriesOf.has(k)) seriesOf.set(k, []); seriesOf.get(k).push(v); }
  for (const list of seriesOf.values()) list.sort((a, b) => a.season - b.season || a.episode - b.episode || cmpVal(a.d.name, b.d.name));
  const isNew = v => Date.now() - v.added < 14 * 864e5;
  const rwDur = s => (s >= 3600 ? Math.floor(s / 3600) + 'h ' + Math.round((s % 3600) / 60) + 'm' : s >= 60 ? Math.round(s / 60) + 'm' : s ? Math.round(s) + 's' : '');
  const res = v => (v.h >= 2000 ? '4K' : v.h >= 700 ? 'HD' : v.h ? 'SD' : '');
  /* posters arrive lazily */
  const io = new win.IntersectionObserver(entries => {
    for (const e of entries) { if (!e.isIntersecting) continue; io.unobserve(e.target); fillThumb(e.target); }
  }, { root: scroller, rootMargin: '300px 600px' });
  ctx.cleanup(() => io.disconnect());
  async function fillThumb(card) {
    const v = all.find(x => x.path === card.dataset.p);
    if (!v) return;
    let t = await rwThumb(v.d);
    if (!t && v.playable) { rwLearn(v.d, async () => { if (!ctx.alive()) return; const t2 = await rwThumb(v.d); if (t2) setThumb(card, t2); const dd = rwInfo(v.d); v.dur = dd.dur; v.w = dd.w; v.h = dd.h; v.playable = dd.playable; refreshCardMeta(card, v); }); }
    if (t) setThumb(card, t);
  }
  function setThumb(card, url) { card.style.backgroundImage = 'url("' + url + '")'; const ph = card.querySelector('.ph'); if (ph) ph.remove(); }
  function refreshCardMeta(card, v) { const du = card.querySelector('.du'); if (du) du.textContent = rwDur(v.dur); if (!v.playable && !card.querySelector('.no')) card.append(h('span', { class: 'no', text: 'CAN\'T PLAY HERE' })); }
  function card(v, opts = {}) {
    const hue = rwHue(v.title);
    const c = h('div', { class: 'rw-card', tabindex: '0', role: 'button', 'aria-label': v.name, 'data-p': v.path, style: { '--c1': 'hsl(' + hue + ',45%,22%)', '--c2': 'hsl(' + ((hue + 60) % 360) + ',55%,38%)' } },
      h('div', { class: 'ph', text: opts.label || (v.series ? v.series + ' ' + v.epTitle : v.title) }));
    if (!opts.noTitle) c.append(h('div', { class: 'tt', text: v.series ? v.series + (opts.epNames ? ' · ' + v.epTitle : '') : v.title }));
    if (v.dur) c.append(h('span', { class: 'du', text: rwDur(v.dur) }));
    if (!v.playable) c.append(h('span', { class: 'no', text: 'CAN\'T PLAY HERE' }));
    if (rwStarted(v)) c.append(h('div', { class: 'prog' }, h('i', { style: { width: clamp(v.pos / v.dur, 0, 1) * 100 + '%' } })));
    const inList = () => shared.myList.has(v.series ? 'series:' + rwSeriesKey(v.series) : v.path);
    const listBtn = h('button', { class: 'rw-ic', type: 'button', title: 'Add to My List', html: inList() ? RW_CHECK : RW_PLUS });
    listBtn.addEventListener('click', e => { e.stopPropagation(); toggleList(v); listBtn.innerHTML = inList() ? RW_CHECK : RW_PLUS; });
    const hov = h('div', { class: 'hov' },
      h('div', { class: 'ib' }, h('button', { class: 'rw-ic w', type: 'button', title: 'Play', html: RW_PLAY, onclick: e => { e.stopPropagation(); play(v); } }), listBtn, h('span', { style: { flex: 1 } }), h('button', { class: 'rw-ic', type: 'button', title: 'More info', html: RW_INFO, onclick: e => { e.stopPropagation(); detail(v); } })),
      h('div', { class: 'm' }, isNew(v) ? h('span', { class: 'rw-new', text: 'New' }) : null, v.year ? h('span', { text: v.year }) : null, v.dur ? h('span', { text: rwDur(v.dur) }) : null, res(v) ? h('span', { class: 'rw-badge', text: res(v) }) : null, h('span', { class: 'rw-badge', text: (v.d.ext || '').toUpperCase() })));
    c.append(hov);
    c.addEventListener('click', () => detail(v));
    c.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); detail(v); } });
    // a muted preview after a moment of hovering
    let t = null, pv = null;
    c.addEventListener('mouseenter', () => {
      // (demo videos are recorded the first time they play, so no hover preview before that)
      if (!v.playable || v.d.meta.via === 'mkv' || (v.d.demo && typeof S.demoSrc.get(v.d.path) === 'function')) return;
      t = setTimeout(async () => {
        const url = await ctx.objectURL(v.d);
        if (!url || !c.matches(':hover')) return;
        pv = h('video', { class: 'pv', muted: true, playsinline: true, src: url });
        pv.muted = true;
        pv.addEventListener('loadedmetadata', () => { try { pv.currentTime = Math.min((pv.duration || 0) * 0.15, 60); } catch (e) { /* fine */ } });
        pv.addEventListener('error', () => { if (pv) pv.remove(); });
        c.insertBefore(pv, c.querySelector('.tt') || c.firstChild.nextSibling);
        pv.play().catch(() => {});
      }, 1100);
    });
    c.addEventListener('mouseleave', () => { clearTimeout(t); if (pv) { pv.pause(); pv.removeAttribute('src'); pv.load(); pv.remove(); pv = null; } });
    io.observe(c);
    return c;
  }
  function row(title, items, opts = {}) {
    if (!items.length) return null;
    const strip = h('div', { class: 'rw-strip' });
    items.forEach((v, i) => {
      if (opts.top) strip.append(h('div', { class: 'rw-top' }, h('span', { class: 'n', text: String(i + 1) }), card(v)));
      else strip.append(card(v, opts));
    });
    const scrollBy = dir => { strip.scrollLeft += dir * strip.clientWidth * 0.85; };
    const r = h('section', { class: 'rw-row' },
      h('h2', {}, title, opts.more ? h('a', { text: 'Explore All ›', onclick: () => opts.more() }) : null),
      h('div', { class: 'rw-track' }, h('button', { class: 'rw-arr l', type: 'button', 'aria-label': 'Scroll left', text: '‹', onclick: () => scrollBy(-1) }), strip, h('button', { class: 'rw-arr r', type: 'button', 'aria-label': 'Scroll right', text: '›', onclick: () => scrollBy(1) })));
    return r;
  }
  /** one card per show, plus every film */
  const titleCards = list => {
    const out = [], seen = new Set();
    for (const v of list) {
      if (v.series) {
        const k = rwSeriesKey(v.series);
        if (seen.has(k)) continue;
        seen.add(k);
        const eps = seriesOf.get(k) || [v];
        const resume = eps.slice().filter(e => e.last).sort((a, b) => b.last - a.last)[0];
        out.push(resume || eps[0]);
      } else out.push(v);
    }
    return out;
  };
  function folderRows(list) {
    const groups = new Map();
    for (const v of list) {
      if (v.series) continue;
      const key = v.d.dir;
      if (!groups.has(key)) groups.set(key, { name: v.folder || 'Videos', items: [] });
      groups.get(key).items.push(v);
    }
    const out = [];
    let misc = [];
    for (const [key, g] of groups) {
      g.items.sort((a, b) => cmpVal(a.title, b.title));
      if (g.items.length < 2) misc = misc.concat(g.items);
      else out.push([g.name.replace(/[_]+/g, ' '), g.items, key]);
    }
    if (misc.length) out.push(['More Videos', misc.sort((a, b) => cmpVal(a.title, b.title)), '']);
    return out;
  }
  /* ---------- pages ---------- */
  function hero(v) {
    const hr = h('div', { class: 'rw-hero' });
    rwBackdrop(v.d).then(u => { if (u) hr.style.backgroundImage = 'url("' + u + '")'; else hr.style.background = 'linear-gradient(135deg,hsl(' + rwHue(v.title) + ',50%,18%),#000)'; });
    const eps = v.series ? seriesOf.get(rwSeriesKey(v.series)) || [] : [];
    const blurb = v.series ? eps.length + ' episode' + (eps.length === 1 ? '' : 's') + ' in ' + (v.folder || 'your folder') + '. Pick up where you left off.' : (v.folder ? 'From your ' + v.folder + ' folder' : 'From your LANscape') + (v.year ? ', ' + v.year : '') + '.' + (rwStarted(v) ? ' You stopped at ' + fmtTime(v.pos) + '.' : '');
    hr.append(h('div', { class: 'in' },
      h('h1', { text: v.title }),
      h('div', { class: 'meta' }, isNew(v) ? h('span', { class: 'rw-new', text: 'New on your LAN' }) : null, v.year ? h('span', { text: v.year }) : null, v.dur ? h('span', { text: rwDur(v.dur) }) : null, res(v) ? h('span', { class: 'rw-badge', text: res(v) }) : null, v.series ? h('span', { text: eps.length + ' Episodes' }) : null),
      h('p', { text: blurb }),
      h('div', { class: 'rw-btns' }, h('button', { class: 'rw-b', type: 'button', html: RW_PLAY + (rwStarted(v) ? 'Resume' : 'Play'), onclick: () => play(v) }), h('button', { class: 'rw-b gr', type: 'button', html: RW_INFO + 'More Info', onclick: () => detail(v) }))));
    return hr;
  }
  function render() {
    content.replaceChildren();
    for (const a of nav.querySelectorAll('.lk a')) a.classList.toggle('on', a.dataset.tab === tab);
    const q = searchIn.value.trim().toLowerCase();
    if (q) return renderGrid('Results for “' + searchIn.value.trim() + '”', all.filter(v => (v.title + ' ' + v.series + ' ' + v.folder + ' ' + v.year + ' ' + v.d.name).toLowerCase().includes(q)), 'No videos match. Try a folder name or a year.');
    if (!all.length) { content.append(h('div', { class: 'rw-empty', html: '<p style="font-size:22px;color:#fff">Nothing to watch yet.</p><p>Open a folder that has MP4, WebM, MOV or MKV files and they\'ll show up here with posters, rows and Continue Watching.</p>' })); return; }
    if (tab === 'list') return renderGrid('My List', titleCards(all.filter(v => shared.myList.has(v.path) || (v.series && shared.myList.has('series:' + rwSeriesKey(v.series))))), 'Add shows and videos to My List with the + button.');
    const pool = tab === 'tv' ? all.filter(v => v.series) : tab === 'movies' ? all.filter(v => !v.series) : all;
    if (!pool.length) return renderGrid(tab === 'tv' ? 'TV Shows' : 'Movies', [], tab === 'tv' ? 'No shows found. Episodes named like “Show S01E02.mp4” become shows.' : 'Everything here is a show.');
    const cont = pool.filter(rwStarted).sort((a, b) => b.last - a.last);
    const recent = pool.slice().sort((a, b) => b.added - a.added);
    const featured = cont[0] || titleCards(recent.filter(v => v.playable))[0] || titleCards(recent)[0];
    content.append(hero(featured));
    const rowsBox = h('div', { class: 'rw-rows' });
    const add = r => { if (r) rowsBox.append(r); };
    add(row('Continue Watching', cont, { epNames: true }));
    add(row('Recently Added', titleCards(recent).slice(0, 20)));
    const top = pool.filter(v => v.plays).sort((a, b) => b.plays - a.plays || b.last - a.last);
    if (top.length >= 3) add(row('Top 10 on Your LAN', titleCards(top).slice(0, 10), { top: true }));
    for (const [k, eps] of seriesOf) { if (pool.includes(eps[0])) add(row(eps[0].series, eps, { epNames: true, more: () => detail(eps[0]) })); }
    for (const [name, items, key] of folderRows(pool)) add(row(name, items, { more: () => renderGrid(name, items, '', key) }));
    const unplayable = pool.filter(v => !v.playable);
    if (unplayable.length) add(row('Needs a Different Player', unplayable));
    content.append(rowsBox, h('div', { class: 'rw-foot', html: '<b>BE KIND, REWIND</b><br>' + all.length + ' videos from your folders · ' + fmtBytes(all.reduce((a, v) => a + (v.d.size || 0), 0)) + ' · no late fees' }));
  }
  function renderGrid(title, items, emptyMsg, key) {
    content.replaceChildren();
    const g = h('div', { class: 'rw-grid', style: { paddingTop: '20px' } }, h('h1', { text: title }));
    if (!items.length) g.append(h('div', { class: 'rw-empty', style: { gridColumn: '1/-1' }, text: emptyMsg || 'Nothing here.' }));
    for (const v of items) g.append(card(v));
    content.append(g);
    if (key != null) ctx.replaceUrl(RW_HOST + '/browse/' + slug(title), title + ' - Rewind');
  }
  function setTab(t) {
    tab = t; searchIn.value = '';
    scroller.scrollTop = 0;
    render();
    const u = { home: RW_HOST + '/', tv: RW_HOST + '/tv', movies: RW_HOST + '/movies', list: RW_HOST + '/my-list' }[t];
    ctx.replaceUrl(u, { home: 'Rewind', tv: 'TV Shows - Rewind', movies: 'Movies - Rewind', list: 'My List - Rewind' }[t]);
  }
  searchIn.addEventListener('input', debounce(() => { render(); if (searchIn.value.trim()) ctx.replaceUrl(RW_HOST + '/search?q=' + encodeURIComponent(searchIn.value.trim()), 'Search - Rewind'); }, 200));
  searchIn.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') { searchIn.value = ''; render(); } });
  function toggleList(v) {
    const k = v.series ? 'series:' + rwSeriesKey(v.series) : v.path;
    if (shared.myList.has(k)) shared.myList.delete(k); else shared.myList.add(k);
    shared.saveList();
  }
  function play(v) { ctx.go(v.d.url); }
  /* ---------- detail card ---------- */
  function detail(v) {
    const old = doc.querySelector('.rw-modal-bg');
    if (old) old.remove();
    const eps = v.series ? seriesOf.get(rwSeriesKey(v.series)) || [v] : null;
    const bd = h('div', { class: 'bd' });
    rwBackdrop(v.d).then(u => { if (u) bd.style.backgroundImage = 'url("' + u + '")'; else bd.style.background = 'linear-gradient(135deg,hsl(' + rwHue(v.title) + ',50%,20%),#000)'; });
    const inList = () => shared.myList.has(v.series ? 'series:' + rwSeriesKey(v.series) : v.path);
    const listB = h('button', { class: 'rw-ic', type: 'button', title: 'My List', html: inList() ? RW_CHECK : RW_PLUS, style: { width: '40px', height: '40px' } });
    listB.addEventListener('click', () => { toggleList(v); listB.innerHTML = inList() ? RW_CHECK : RW_PLUS; });
    const resumeEp = eps ? eps.slice().filter(e => e.last && !e.done).sort((a, b) => b.last - a.last)[0] || eps[0] : v;
    bd.append(h('div', { class: 'in' }, h('h2', { text: v.title }),
      h('div', { class: 'rw-btns' }, h('button', { class: 'rw-b', type: 'button', html: RW_PLAY + (rwStarted(resumeEp) ? 'Resume' + (eps ? ' ' + resumeEp.epTitle : '') : 'Play' + (eps ? ' ' + resumeEp.epTitle : '')), onclick: () => play(resumeEp) }), listB)));
    const close = () => { bg.remove(); ctx.replaceUrl(tabUrl(), 'Rewind'); };
    const x = h('button', { class: 'x', type: 'button', 'aria-label': 'Close', text: '×', onclick: close });
    const info = h('div', { class: 'body' },
      h('div', {}, h('div', { class: 'm' }, isNew(v) ? h('span', { class: 'rw-new', text: 'New' }) : null, v.year ? h('span', { text: v.year }) : null, v.dur && !eps ? h('span', { text: rwDur(v.dur) }) : null, eps ? h('span', { text: eps.length + ' Episodes' }) : null, res(v) ? h('span', { class: 'rw-badge', text: res(v) }) : null),
        h('p', { text: v.playable ? (eps ? 'Every episode from your ' + (v.folder || '') + ' folder, in order.' : 'Playing from ' + v.d.path + '.') : (v.d.meta.why || 'This browser can\'t play .' + v.d.ext + ' files. You can still download it, or convert it to MP4 or WebM.') })),
      h('div', { class: 'side' },
        h('div', {}, 'Folder: ', h('span', { text: v.folder || v.d.root })),
        h('div', {}, 'File: ', h('span', { text: v.d.name + ' (' + fmtBytes(v.d.size || 0) + ')' })),
        v.w ? h('div', {}, 'Picture: ', h('span', { text: v.w + '×' + v.h })) : null,
        h('div', {}, 'Address: ', h('span', { text: displayUrl(v.d.url) })),
        h('div', {}, h('a', { href: '#', text: 'Download', onclick: async e => { e.preventDefault(); ctx.download(v.d.name, await ctx.blob(v.d)); } }), ' · ', h('a', { href: '#', text: 'Show in folder', onclick: e => { e.preventDefault(); ctx.go(v.d.ftp.replace(/[^/]*$/, '')); } }))));
    const modal = h('div', { class: 'rw-modal', role: 'dialog', 'aria-label': v.title }, x, bd, info);
    if (eps) {
      const seasons = uniq(eps.map(e => e.season)).sort((a, b) => a - b);
      const sel = h('select', { 'aria-label': 'Season' }, ...seasons.map(s => h('option', { value: String(s), text: 'Season ' + s })));
      sel.value = String(resumeEp.season);
      const list = h('div');
      const fill = () => {
        list.replaceChildren(...eps.filter(e => String(e.season) === sel.value).map(e => {
          const th = h('div', { class: 'th' });
          rwThumb(e.d).then(u => { if (u) th.style.backgroundImage = 'url("' + u + '")'; });
          if (rwStarted(e)) th.append(h('div', { class: 'prog' }, h('i', { style: { width: clamp(e.pos / e.dur, 0, 1) * 100 + '%' } })));
          const it = h('div', { class: 'rw-ep' + (e === resumeEp ? ' cur' : ''), tabindex: '0', role: 'button' }, h('span', { class: 'n', text: String(e.episode || '') }), th,
            h('div', { class: 't' }, h('b', {}, h('span', { text: e.epName || 'Episode ' + (e.episode || ''), style: { color: '#fff', fontSize: '15px' } }), h('span', { text: rwDur(e.dur) })), h('span', { text: e.playable ? e.d.name : 'Can\'t play .' + e.d.ext + ' in this browser' })));
          it.addEventListener('click', () => play(e));
          it.addEventListener('keydown', ev => { if (ev.key === 'Enter') play(e); });
          return it;
        }));
      };
      sel.addEventListener('change', fill);
      fill();
      modal.append(h('h3', {}, 'Episodes', seasons.length > 1 ? sel : h('span', { style: { fontSize: '15px', color: '#999' }, text: 'Season ' + seasons[0] })), list);
    } else {
      const more = all.filter(o => o !== v && !o.series && o.d.dir === v.d.dir).slice(0, 9);
      if (more.length) {
        const g = h('div', { class: 'rw-more' }, ...more.map(o => card(o)));
        modal.append(h('h3', { text: 'More Like This' }), g);
      }
    }
    const bg = h('div', { class: 'rw-modal-bg' }, modal);
    bg.addEventListener('click', e => { if (e.target === bg) close(); });
    ctx.root.append(bg);
    x.focus();
    ctx.replaceUrl(eps ? RW_HOST + '/series/' + rwSeriesKey(v.series) : RW_HOST + '/title/' + v.d.url.split('/watch/')[1], v.title + ' - Rewind');
  }
  const tabUrl = () => (searchIn.value.trim() ? RW_HOST + '/search?q=' + encodeURIComponent(searchIn.value.trim()) : { home: RW_HOST + '/', tv: RW_HOST + '/tv', movies: RW_HOST + '/movies', list: RW_HOST + '/my-list' }[tab]);
  ctx.on(doc, 'keydown', e => {
    if (e.key === 'Escape') { const m = doc.querySelector('.rw-modal-bg'); if (m) { m.remove(); ctx.replaceUrl(tabUrl(), 'Rewind'); } }
    if (e.key === '/' && e.target.tagName !== 'INPUT') { e.preventDefault(); searchIn.focus(); }
  });
  if (route.q) searchIn.value = route.q;
  render();
  if (route.title) { const v = all.find(x => x.path === route.title); if (v) detail(v); }
  if (route.series) { const eps = seriesOf.get(route.series); if (eps) detail(eps[0]); }
  if (route.row) { const fr = folderRows(all).find(([name]) => slug(name) === route.row); if (fr) renderGrid(fr[0], fr[1], '', fr[2]); else { const eps = seriesOf.get(route.row); if (eps) renderGrid(eps[0].series, eps, ''); } }
  return { title: tab === 'home' ? 'Rewind' : ({ tv: 'TV Shows', movies: 'Movies', list: 'My List' }[tab] || 'Rewind') + ' - Rewind' };
}
/* ---------- the player ---------- */
function srtToVtt(text) {
  return 'WEBVTT\n\n' + String(text).replace(/\r/g, '').replace(/^﻿/, '').replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2').replace(/^\d+\n(?=\d{2}:\d{2})/gm, '');
}
function rwSubtitles(d) {
  const node = S.tree && S.tree.get(d.dir);
  if (!node) return [];
  const base = d.name.replace(/\.[a-z0-9]+$/i, '').toLowerCase();
  const LANG = { en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch', it: 'Italiano', pt: 'Português', ja: '日本語', zh: '中文', ko: '한국어', nl: 'Nederlands', sv: 'Svenska', ru: 'Русский' };
  return node.files.filter(f => /\.(vtt|srt)$/i.test(f.name) && f.name.toLowerCase().startsWith(base)).map(f => {
    const mid = f.name.slice(base.length).replace(/\.(vtt|srt)$/i, '').replace(/^[._ -]+/, '').toLowerCase();
    const code = /^[a-z]{2}$/.test(mid) ? mid : 'en';
    return { doc: f, code, label: (LANG[mid] || (mid ? mid.toUpperCase() : 'Subtitles')) + (f.ext === 'srt' ? '' : '') };
  });
}
async function rewindPlayer(ctx, d, shared) {
  const { h, doc, win } = ctx;
  const v = rwInfo(d);
  const box = h('div', { class: 'rwp', tabindex: '-1' });
  const video = h('video', { playsinline: true, preload: 'auto' });
  const flash = h('div', { class: 'flash' });
  const spin = h('div', { class: 'spin' });
  const subsBox = h('div', { class: 'subs', 'aria-live': 'polite' });
  box.append(video, subsBox, spin, flash);
  ctx.root.append(box);
  const all = rwVideos().map(rwInfo);
  const siblings = v.series ? all.filter(o => o.series && rwSeriesKey(o.series) === rwSeriesKey(v.series)).sort((a, b) => a.season - b.season || a.episode - b.episode) : all.filter(o => !o.series && o.d.dir === d.dir).sort((a, b) => cmpVal(a.d.name, b.d.name));
  const next = siblings[siblings.findIndex(o => o.path === d.path) + 1] || null;
  const goBack = () => { if (S.tab && S.tab.idx > 0) back(); else ctx.go(RW_HOST + '/'); };
  const title = v.series ? v.series : v.title;
  const sub = v.series ? v.epTitle + (v.epName ? ' ' + v.epName : '') : (v.year || '');
  // can this browser play it?
  const showBad = async why => {
    const bad = h('div', { class: 'bad' }, h('div', { class: 'in' }, h('h2', { text: 'Can\'t play this one here' }),
      h('p', { text: why || ('This browser doesn\'t play .' + d.ext + ' video. Download it to watch it in another player, or convert it to MP4 or WebM.') }),
      h('div', { class: 'rw-btns' }, h('button', { class: 'rw-b', type: 'button', text: 'Download', onclick: async () => ctx.download(d.name, await ctx.blob(d)) }), h('button', { class: 'rw-b gr', type: 'button', text: 'Back to Browse', onclick: goBack }))));
    box.append(bad);
    const u = await rwBackdrop(d).catch(() => null);
    if (u) bad.style.backgroundImage = 'url("' + u + '")';
    d.meta.playable = false;
  };
  if (!rwCanPlay(d)) { await showBad(); return { title: title + ' - Rewind' }; }
  // MKV files go straight to LANscape's converter once we know the browser won't take them
  const isMkv = MKV_EXT.test(d.ext);
  const direct = isMkv && mkvCan() && (d.meta.via === 'mkv' || !!(window.LAN && window.LAN.mkvDirect));
  const url = direct ? null : await ctx.objectURL(d);
  if (!url && !direct) { await showBad('LANscape couldn\'t read this file. Open its folder again.'); return { title: title + ' - Rewind' }; }
  // subtitles
  const subs = rwSubtitles(d);
  for (const s of subs) {
    try {
      let text = await getText(s.doc);
      if (s.doc.ext === 'srt') text = srtToVtt(text);
      const tu = URL.createObjectURL(new Blob([text], { type: 'text/vtt' }));
      ctx.cleanup(() => URL.revokeObjectURL(tu));
      video.append(h('track', { kind: 'subtitles', label: s.label, srclang: s.code, src: tu }));
    } catch (e) { /* skip */ }
  }
  /* ---------- controls ---------- */
  const seek = h('div', { class: 'sk', role: 'slider', 'aria-label': 'Seek', tabindex: '0' });
  const tr = h('div', { class: 'tr' }), bf = h('div', { class: 'bf' }), pl = h('div', { class: 'pl' }), th = h('div', { class: 'th' }), tip = h('div', { class: 'tip' }), rem = h('span', { class: 'rem' });
  tr.append(bf, pl, th, tip);
  seek.append(tr, rem);
  const ppBtn = h('button', { type: 'button', 'aria-label': 'Play', html: RW_PLAY });
  const volBtn = h('button', { type: 'button', 'aria-label': 'Mute', html: RW_VOL });
  const volIn = h('input', { type: 'range', min: '0', max: '1', step: '0.05', 'aria-label': 'Volume' });
  const ccBtn = h('button', { type: 'button', 'aria-label': 'Subtitles and speed', title: 'Subtitles & speed', html: RW_CC });
  const nextBtn = next ? h('button', { type: 'button', 'aria-label': 'Next episode', title: 'Next: ' + (next.series ? next.epTitle : next.title), html: RW_NEXT }) : null;
  const pipBtn = doc.pictureInPictureEnabled ? h('button', { type: 'button', 'aria-label': 'Picture in picture', title: 'Picture in picture', html: RW_PIP }) : null;
  const fsBtn = h('button', { type: 'button', 'aria-label': 'Full screen', title: 'Full screen (F)', html: RW_FULL });
  const ui = h('div', { class: 'ui' },
    h('div', { class: 'tb' }, h('button', { type: 'button', 'aria-label': 'Back to browse', html: '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z" fill="currentColor"/></svg>', onclick: goBack }), h('span', { class: 'ti', text: title + (sub ? ' · ' + sub : '') })),
    h('div', { class: 'bb' }, seek, h('div', { class: 'ctl' }, ppBtn, h('button', { type: 'button', 'aria-label': 'Back 10 seconds', html: RW_BACK10, onclick: () => skip(-10) }), h('button', { type: 'button', 'aria-label': 'Forward 10 seconds', html: RW_FWD10, onclick: () => skip(10) }),
      h('div', { class: 'vw' }, volBtn, volIn), h('div', { class: 'nm' }, title, sub ? h('span', { text: sub }) : null), nextBtn, subs.length || true ? ccBtn : null, pipBtn, fsBtn)));
  box.append(ui);
  const nextCard = next ? h('div', { class: 'nextc' }) : null;
  if (nextCard) box.append(nextCard);
  /* ---------- behaviour ---------- */
  const vp = () => S.videoPos[d.path] || (S.videoPos[d.path] = {});
  let lastSave = 0, counted = false;
  const savePos = force => {
    if (!isFinite(video.duration) || !video.duration) return;
    const now = Date.now();
    if (!force && now - lastSave < 4000) return;
    lastSave = now;
    const x = vp();
    x.d = video.duration; x.ts = now;
    if (video.currentTime > video.duration * 0.94) { x.t = 0; x.done = true; } else { x.t = video.currentTime; if (video.currentTime > 30) x.done = false; }
    if (!counted && video.currentTime > Math.min(60, video.duration * 0.25)) { counted = true; x.n = (x.n || 0) + 1; }
    saveState();
  };
  video.volume = clamp(shared.prefs.vol, 0, 1); video.muted = !!shared.prefs.muted; video.playbackRate = shared.prefs.speed || 1;
  volIn.value = String(video.muted ? 0 : video.volume);
  const syncVol = () => { volBtn.innerHTML = video.muted || video.volume === 0 ? RW_MUTE : RW_VOL; volIn.value = String(video.muted ? 0 : video.volume); shared.prefs.vol = video.volume; shared.prefs.muted = video.muted; shared.savePrefs(); };
  volIn.addEventListener('input', () => { video.volume = +volIn.value; video.muted = +volIn.value === 0; syncVol(); });
  volBtn.addEventListener('click', () => { video.muted = !video.muted; if (!video.muted && video.volume === 0) video.volume = 0.6; syncVol(); });
  const toggle = () => { if (video.paused || video.ended) video.play().catch(() => {}); else video.pause(); };
  ppBtn.addEventListener('click', toggle);
  video.addEventListener('click', toggle);
  video.addEventListener('dblclick', () => fullscreen());
  const flashIcon = svg => { flash.innerHTML = svg; flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go'); };
  video.addEventListener('play', () => { ppBtn.innerHTML = RW_PAUSE; ppBtn.setAttribute('aria-label', 'Pause'); flashIcon(RW_PLAY); if (typeof Player !== 'undefined' && Player.playing()) Player.pause(); idleSoon(); });
  video.addEventListener('pause', () => { ppBtn.innerHTML = RW_PLAY; ppBtn.setAttribute('aria-label', 'Play'); flashIcon(RW_PAUSE); savePos(true); wake(); });
  video.addEventListener('waiting', () => box.classList.add('wait'));
  video.addEventListener('playing', () => box.classList.remove('wait'));
  video.addEventListener('canplay', () => box.classList.remove('wait'));
  function skip(s) { video.currentTime = clamp(video.currentTime + s, 0, (video.duration || 0) - 0.1); flashIcon(s < 0 ? RW_BACK10 : RW_FWD10); }
  const paint = () => {
    const D = video.duration || 0, t = video.currentTime || 0;
    pl.style.width = (D ? (t / D) * 100 : 0) + '%';
    th.style.left = (D ? (t / D) * 100 : 0) + '%';
    try { const b = video.buffered; if (b.length && D) bf.style.width = (b.end(b.length - 1) / D) * 100 + '%'; } catch (e) { /* fine */ }
    rem.textContent = D ? fmtTime(D - t) : '';
    seek.setAttribute('aria-valuenow', Math.round(t));
    if (nextCard && D && D - t < Math.min(20, Math.max(3, D * 0.12)) && !nextCard.dataset.dismissed && !video.paused) showNext(Math.ceil(D - t));
  };
  video.addEventListener('timeupdate', () => { paint(); savePos(false); });
  video.addEventListener('durationchange', paint);
  video.addEventListener('progress', paint);
  video.addEventListener('ended', () => { savePos(true); if (next && !(nextCard && nextCard.dataset.dismissed)) ctx.go(next.d.url); else wake(); });
  const timeAt = e => { const r = tr.getBoundingClientRect(); return clamp((e.clientX - r.left) / r.width, 0, 1) * (video.duration || 0); };
  seek.addEventListener('pointermove', e => { const t = timeAt(e); tip.textContent = fmtTime(t); tip.style.left = (video.duration ? (t / video.duration) * 100 : 0) + '%'; });
  seek.addEventListener('pointerdown', e => {
    seek.setPointerCapture(e.pointerId);
    const was = !video.paused;
    video.pause();
    video.currentTime = timeAt(e);
    const mv = ev => { video.currentTime = timeAt(ev); paint(); };
    seek.addEventListener('pointermove', mv);
    seek.addEventListener('pointerup', () => { seek.removeEventListener('pointermove', mv); if (was) video.play().catch(() => {}); }, { once: true });
  });
  // subtitles + speed menu
  let menu = null;
  ccBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (menu) { menu.remove(); menu = null; return; }
    const tracks = Array.from(video.textTracks);
    menu = h('div', { class: 'menu', role: 'menu' }, h('h4', { text: 'Subtitles' }),
      h('button', { type: 'button', class: tracks.every(t => !t._on) ? 'on' : '', text: 'Off', onclick: () => setSub('') }),
      ...tracks.map(t => h('button', { type: 'button', class: t._on ? 'on' : '', text: t.label || t.language, onclick: () => setSub(t.language) })),
      tracks.length ? null : h('div', { style: { color: '#777', padding: '0 16px 6px', fontSize: '12px' }, text: 'Put a .srt or .vtt with the same name next to the video.' }),
      h('h4', { text: 'Speed', style: { marginTop: '12px' } }),
      ...[0.5, 0.75, 1, 1.25, 1.5, 2].map(r => h('button', { type: 'button', class: video.playbackRate === r ? 'on' : '', text: r === 1 ? 'Normal' : r + '×', onclick: () => { video.playbackRate = r; shared.prefs.speed = r; shared.savePrefs(); closeMenu(); } })));
    box.append(menu);
  });
  const closeMenu = () => { if (menu) { menu.remove(); menu = null; } };
  box.addEventListener('pointerdown', e => { if (menu && !menu.contains(e.target) && e.target !== ccBtn && !ccBtn.contains(e.target)) closeMenu(); });
  // subtitles are drawn by Rewind (track mode "hidden"), so they can step above the controls
  const activeSub = () => Array.from(video.textTracks).find(t => t.mode === 'hidden' && t._on);
  const drawSub = () => { const t = activeSub(); const cues = t && t.activeCues ? Array.from(t.activeCues) : []; subsBox.replaceChildren(...cues.map(c => h('span', { text: String(c.text || '').replace(/<[^>]+>/g, '') }))); };
  function setSub(code) {
    for (const t of Array.from(video.textTracks)) { t._on = !!code && t.language === code; t.mode = t._on ? 'hidden' : 'disabled'; t.oncuechange = t._on ? drawSub : null; }
    drawSub();
    shared.prefs.subs = code; shared.savePrefs(); closeMenu();
  }
  video.addEventListener('loadedmetadata', () => { if (shared.prefs.subs) setSub(shared.prefs.subs); });
  if (nextBtn) nextBtn.addEventListener('click', () => ctx.go(next.d.url));
  if (pipBtn) pipBtn.addEventListener('click', async () => { try { if (doc.pictureInPictureElement) await doc.exitPictureInPicture(); else await video.requestPictureInPicture(); } catch (e) { ctx.status('Picture-in-picture isn\'t available here.'); } });
  function fullscreen() { try { if (doc.fullscreenElement) doc.exitFullscreen(); else box.requestFullscreen(); } catch (e) { /* not allowed */ } }
  fsBtn.addEventListener('click', fullscreen);
  function showNext(secs) {
    if (!nextCard.classList.contains('on')) {
      nextCard.replaceChildren(h('div', { class: 'im' }), h('div', { class: 'tx' }, h('small', { text: 'Next Episode' }), h('b', { text: next.series ? next.epTitle + (next.epName ? ' ' + next.epName : '') : next.title })),
        h('div', { class: 'bt' }, h('button', { class: 'rw-b sm', type: 'button', html: RW_PLAY + 'Play Now', onclick: () => ctx.go(next.d.url) }), h('button', { class: 'rw-b gr sm', type: 'button', text: 'Hide', onclick: () => { nextCard.dataset.dismissed = '1'; nextCard.classList.remove('on'); } })));
      rwThumb(next.d).then(u => { if (u) nextCard.querySelector('.im').style.backgroundImage = 'url("' + u + '")'; });
      nextCard.classList.add('on');
    }
    const s = nextCard.querySelector('small');
    if (s) s.textContent = 'Next Episode in ' + secs;
  }
  // hide the controls while watching
  let idleT = null;
  function wake() { box.classList.remove('idle'); clearTimeout(idleT); if (!video.paused) idleSoon(); }
  function idleSoon() { clearTimeout(idleT); idleT = setTimeout(() => { if (!video.paused && !menu) box.classList.add('idle'); }, 2800); }
  box.addEventListener('pointermove', wake);
  ctx.cleanup(() => clearTimeout(idleT));
  ctx.on(doc, 'keydown', e => {
    if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
    const k = e.key;
    wake();
    if (k === ' ' || k === 'k' || k === 'K') { e.preventDefault(); toggle(); }
    else if (k === 'ArrowLeft' || k === 'j' || k === 'J') { e.preventDefault(); skip(-10); }
    else if (k === 'ArrowRight' || k === 'l' || k === 'L') { e.preventDefault(); skip(10); }
    else if (k === 'ArrowUp') { e.preventDefault(); video.muted = false; video.volume = clamp(video.volume + 0.1, 0, 1); syncVol(); }
    else if (k === 'ArrowDown') { e.preventDefault(); video.volume = clamp(video.volume - 0.1, 0, 1); syncVol(); }
    else if (k === 'f' || k === 'F') { e.preventDefault(); fullscreen(); }
    else if (k === 'm' || k === 'M') { e.preventDefault(); video.muted = !video.muted; syncVol(); }
    else if (k === 'c' || k === 'C') { e.preventDefault(); const tracks = Array.from(video.textTracks); const on = tracks.find(t => t._on); setSub(on ? '' : (tracks[0] ? tracks[0].language : '')); }
    else if ((k === 'n' || k === 'N') && next) { e.preventDefault(); ctx.go(next.d.url); }
    else if (k === 'Escape' && !doc.fullscreenElement) { if (menu) closeMenu(); else goBack(); }
    else if (/^[0-9]$/.test(k) && video.duration) { video.currentTime = video.duration * (+k / 10); }
  });
  // MKV: the browser's own player takes some and not others. The rest are repackaged as MP4 while they play.
  let mkv = null, mkvTried = false;
  async function viaMkv() {
    if (mkvTried || !mkvCan()) return false;
    mkvTried = true;
    try { mkv = await MkvPlayer.open(await ctx.blob(d)); } catch (e) { console.warn(e); return false; }
    if (!ctx.alive()) return true;
    ctx.cleanup(() => mkv.detach());
    if (mkv.problem) { box.classList.remove('wait'); d.meta.why = mkv.problem; await showBad(mkv.problem); return true; }
    if (d.meta.via !== 'mkv') { d.meta.via = 'mkv'; if (isKnownDoc(d)) DB.put('meta', metaRecord(d)); }
    box.classList.add('wait');
    mkv.onerror = () => { box.classList.remove('wait'); showBad('LANscape couldn\'t keep converting this MKV file. Download it to watch it in another player.'); };
    try { await mkv.attach(video, resumeAt); } catch (e) { console.warn(e); box.classList.remove('wait'); await showBad(); return true; }
    if (mkv.note) ctx.status(mkv.note);
    video.play().catch(() => { box.classList.remove('wait'); wake(); });
    return true;
  }
  video.addEventListener('error', async () => {
    if (!video.getAttribute('src')) return;
    if (isMkv && !mkvTried && await viaMkv()) return;
    box.classList.remove('wait');
    showBad(video.error && video.error.code === 4 ? null : 'The video couldn\'t be read.');
  });
  // the browser opened it but can't show the picture (H.265 inside MKV, say)
  if (isMkv && !direct) video.addEventListener('loadedmetadata', () => { if (!video.videoWidth && !mkvTried) { video.pause(); viaMkv(); } }, { once: true });
  ctx.cleanup(() => { savePos(true); try { video.pause(); video.removeAttribute('src'); video.load(); } catch (e) { /* fine */ } });
  // recordings from a browser (MediaRecorder WebM) don't say how long they are until you seek to the end
  video.addEventListener('loadedmetadata', () => {
    if (video.duration !== Infinity) return;
    const back2 = video.currentTime;
    const learned = () => { if (!isFinite(video.duration)) return; video.removeEventListener('durationchange', learned); video.currentTime = back2; paint(); };
    video.addEventListener('durationchange', learned);
    try { video.currentTime = 1e101; } catch (e) { /* fine */ }
  }, { once: true });
  // start where we left off
  const resumeAt = rwStarted(v) ? v.pos : 0;
  box.classList.add('wait');
  if (direct) viaMkv();
  else {
    video.src = url;
    if (resumeAt) video.addEventListener('loadedmetadata', () => { if (mkvTried) return; try { video.currentTime = Math.min(resumeAt, video.duration - 2); } catch (e) { /* fine */ } }, { once: true });
    video.play().catch(() => { box.classList.remove('wait'); wake(); });
  }
  box.focus({ preventScroll: true });
  if (!videoProbed(d)) rwLearn(d);
  return { title: title + (sub ? ' ' + sub : '') + ' - Rewind' };
}
