/* ===================================================================
   Jukebox: your music library, brushed-metal style. Library, Now
   Playing, smart playlists and your own playlists; browse by genre,
   artist and album; ratings, play counts, Get Info, an equalizer, a
   visualizer and a "Burn" button that writes a playlist to a ZIP disc.
   It plays through the shell's Player, so music keeps going while you surf.
   =================================================================== */
const JB_HOST = 'http://music.lanscape.net';
const JB_METAL = (() => {
  const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='640' height='260'><filter id='a'><feTurbulence type='fractalNoise' baseFrequency='0.0016 0.85' numOctaves='3' seed='7'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 1.7 0 0 0 -0.8'/></filter><filter id='b'><feTurbulence type='fractalNoise' baseFrequency='0.0021 0.7' numOctaves='2' seed='23'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -1.5 0 0 0 0.66'/></filter><rect width='640' height='260' filter='url(%23a)' opacity='.6'/><rect width='640' height='260' filter='url(%23b)' opacity='.45'/></svg>";
  return 'url("data:image/svg+xml,' + svg.replace(/</g, '%3C').replace(/>/g, '%3E').replace(/"/g, '%22').replace(/ /g, '%20') + '")';
})();
const JB_COLS = {
  num: { label: '', w: 34, r: 1 }, play: { label: '', w: 18 }, title: { label: 'Song Name', w: 230 }, time: { label: 'Time', w: 48, r: 1 },
  artist: { label: 'Artist', w: 160 }, album: { label: 'Album', w: 170 }, track: { label: 'Track #', w: 54, r: 1 }, genre: { label: 'Genre', w: 90 },
  year: { label: 'Year', w: 42, r: 1 }, rating: { label: 'My Rating', w: 72 }, plays: { label: 'Play Count', w: 76, r: 1 }, last: { label: 'Last Played', w: 118 },
  kind: { label: 'Kind', w: 112 }, bitrate: { label: 'Bit Rate', w: 64, r: 1 }, size: { label: 'Size', w: 60, r: 1 }, added: { label: 'Date Added', w: 118 }, comment: { label: 'Comment', w: 140 }
};
const JB_OPTIONAL = ['track', 'year', 'genre', 'rating', 'plays', 'last', 'kind', 'bitrate', 'size', 'added', 'comment'];
const JB_DEFAULT_COLS = ['title', 'time', 'artist', 'album', 'genre', 'rating', 'plays', 'last'];
const AUDIO_KIND = { mp3: 'MPEG audio file', m4a: 'AAC audio file', aac: 'AAC audio file', wav: 'WAV audio file', wave: 'WAV audio file', flac: 'FLAC audio file', ogg: 'Ogg Vorbis file', oga: 'Ogg audio file', opus: 'Opus audio file', weba: 'WebM audio file', mid: 'MIDI file', midi: 'MIDI file', kar: 'Karaoke MIDI file', rmi: 'RIFF MIDI file', aif: 'AIFF audio file', aiff: 'AIFF audio file', wma: 'Windows Media audio' };
const JB_SMART = [
  { id: 'recently-added', name: 'Recently Added', test: (s, now) => now - (S.firstSeen[s.path] || s.d.mtime || 0) < 30 * 864e5, by: s => -(S.firstSeen[s.path] || s.d.mtime || 0), limit: 100 },
  { id: 'recently-played', name: 'Recently Played', test: (s, now) => s.last && now - s.last < 14 * 864e5, by: s => -s.last, limit: 100 },
  { id: 'top-25-most-played', name: 'Top 25 Most Played', test: s => s.plays > 0, by: s => -s.plays * 1e13 - s.last, limit: 25 },
  { id: 'my-top-rated', name: 'My Top Rated', test: s => s.rating >= 4, by: s => -s.rating },
  { id: '90s-music', name: '90\'s Music', test: s => +s.year >= 1990 && +s.year <= 1999, by: s => +s.year }
];
const JB_SVG = {
  prev: '<svg viewBox="0 0 20 12" width="18" height="11"><path d="M10 0v12L2 6zM18 0v12l-8-6z" fill="#222"/><path d="M1 0h1.6v12H1z" fill="#222"/></svg>',
  next: '<svg viewBox="0 0 20 12" width="18" height="11"><path d="M2 0v12l8-6zM10 0v12l8-6z" fill="#222"/><path d="M17.4 0H19v12h-1.6z" fill="#222"/></svg>',
  play: '<svg viewBox="0 0 14 16" width="14" height="16"><path d="M1 0v16l13-8z" fill="#222"/></svg>',
  pause: '<svg viewBox="0 0 14 16" width="13" height="15"><path d="M1 0h4.5v16H1zM8.5 0H13v16H8.5z" fill="#222"/></svg>',
  spkLo: '<svg viewBox="0 0 12 12" width="11" height="11"><path d="M1 4h3l4-3v10L4 8H1z" fill="#333"/></svg>',
  spkHi: '<svg viewBox="0 0 16 12" width="15" height="11"><path d="M1 4h3l4-3v10L4 8H1z" fill="#333"/><path d="M10 3.5q2 2.5 0 5M12 2q3.5 4 0 8" fill="none" stroke="#333" stroke-width="1.2"/></svg>',
  speaker: '<svg viewBox="0 0 16 12" width="14" height="11"><path d="M1 4h3l4-3v10L4 8H1z" fill="currentColor"/><path d="M10 3.5q2 2.5 0 5M12 2q3.5 4 0 8" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>',
  eye: '<svg viewBox="0 0 22 14" width="20" height="13"><path d="M1 7q10-11 20 0-10 11-20 0z" fill="#fff" stroke="#333" stroke-width="1.3"/><circle cx="11" cy="7" r="3.6" fill="#3b6fb6"/><circle cx="11" cy="7" r="1.6" fill="#111"/></svg>',
  plus: '<svg viewBox="0 0 12 12" width="11" height="11"><path d="M5 0h2v5h5v2H7v5H5V7H0V5h5z" fill="#333"/></svg>',
  shuffle: '<svg viewBox="0 0 18 14" width="16" height="12"><path d="M1 3h3.5l7 8H15M1 11h3.5l2.4-2.7M9.6 5.7 11.5 3H15" fill="none" stroke="#333" stroke-width="1.6"/><path d="M14 0l4 3-4 3zM14 8l4 3-4 3z" fill="#333"/></svg>',
  repeat: '<svg viewBox="0 0 18 14" width="16" height="12"><path d="M3 9V5.5Q3 3 5.5 3H14M15 5v3.5Q15 11 12.5 11H4" fill="none" stroke="#333" stroke-width="1.6"/><path d="M12.5 0l3.5 3-3.5 3zM5.5 8 2 11l3.5 3z" fill="#333"/></svg>',
  art: '<svg viewBox="0 0 16 14" width="15" height="13"><rect x=".7" y=".7" width="14.6" height="12.6" fill="#fff" stroke="#333" stroke-width="1.2"/><path d="M2 12 6 7l3 3 2-2 3 4z" fill="#3b6fb6"/><circle cx="11" cy="4.5" r="1.5" fill="#e0a000"/></svg>',
  eq: '<svg viewBox="0 0 16 14" width="15" height="13"><path d="M3 1v12M8 1v12M13 1v12" stroke="#333" stroke-width="1.2"/><rect x="1" y="7" width="4" height="2.4" fill="#333"/><rect x="6" y="3" width="4" height="2.4" fill="#333"/><rect x="11" y="9" width="4" height="2.4" fill="#333"/></svg>',
  vis: '<svg viewBox="0 0 16 16" width="15" height="15"><g fill="none" stroke="#333" stroke-width="1.2"><ellipse cx="8" cy="8" rx="7" ry="2.6"/><ellipse cx="8" cy="8" rx="7" ry="2.6" transform="rotate(60 8 8)"/><ellipse cx="8" cy="8" rx="7" ry="2.6" transform="rotate(120 8 8)"/></g><circle cx="8" cy="8" r="1.6" fill="#333"/></svg>',
  amp: '<svg viewBox="0 0 18 12" width="17" height="11"><rect x=".6" y=".6" width="16.8" height="10.8" rx="1.5" fill="#2a2d33" stroke="#111"/><path d="M3 8V6M5 8V4M7 8V5M9 8V3M11 8V5" stroke="#5f5" stroke-width="1.2"/><circle cx="14" cy="6" r="1.8" fill="#888"/></svg>',
  burn: '<svg viewBox="0 0 16 16" width="15" height="15"><circle cx="8" cy="8" r="7" fill="#ffd400" stroke="#333"/><path d="M8 8 4.2 1.9A7 7 0 0 1 11.8 1.9zM8 8l7 .2a7 7 0 0 1-3.6 6zM8 8 4.6 14.1A7 7 0 0 1 1 8.2z" fill="#222"/><circle cx="8" cy="8" r="1.8" fill="#ffd400" stroke="#222"/></svg>',
  lib: '<svg viewBox="0 0 16 16" width="16" height="16"><rect x="1" y="1" width="14" height="14" rx="2" fill="#8a5a2b" stroke="#4d2f12"/><path d="M6 4v6.2A1.8 1.8 0 1 0 7.2 12V6.2l4-1v3.9A1.8 1.8 0 1 0 12.4 11V3z" fill="#fff"/></svg>',
  now: '<svg viewBox="0 0 16 16" width="16" height="16"><rect x="1" y="1" width="14" height="14" rx="2" fill="#2f6bd1" stroke="#163f86"/><path d="M4 6h2.2L9 4v8L6.2 10H4z" fill="#fff"/><path d="M10.6 5.6q1.6 2.4 0 4.8" fill="none" stroke="#fff" stroke-width="1.1"/></svg>',
  smart: '<svg viewBox="0 0 16 16" width="16" height="16"><rect x="1" y="1" width="14" height="14" rx="2" fill="#7a4fc6" stroke="#46238a"/><circle cx="8" cy="8" r="3.4" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="2 1.4"/><circle cx="8" cy="8" r="1.3" fill="#fff"/></svg>',
  list: '<svg viewBox="0 0 16 16" width="16" height="16"><rect x="1" y="1" width="14" height="14" rx="2" fill="#4b8de0" stroke="#22589e"/><path d="M6 4v6.2A1.8 1.8 0 1 0 7.2 12V6.2l4-1v3.9A1.8 1.8 0 1 0 12.4 11V3z" fill="#fff"/></svg>',
  note: '<svg viewBox="0 0 64 64" width="64" height="64"><path d="M24 12v30.5A8 8 0 1 0 29 50V24l20-5v17.5A8 8 0 1 0 54 44V6z" fill="rgba(255,255,255,.85)"/></svg>'
};
const JUKEBOX_CSS = `body.app-jukebox{--jbfont:"Lucida Grande","Lucida Sans Unicode","Lucida Sans","DejaVu Sans",Geneva,Verdana,sans-serif;font:11px/1.3 var(--jbfont);background:${JB_METAL},linear-gradient(#d7d7d7,#b6b6b6 70%,#aaa);color:#111}
.jb-top{flex:none;display:flex;align-items:center;gap:12px;padding:8px 12px 6px;min-height:68px}
.jb-tr{display:flex;align-items:center;gap:6px;flex:none}
.jb-rb{width:30px;height:30px;border-radius:50%;border:1px solid #5f5f5f;padding:0;display:grid;place-items:center;cursor:default;
 background:radial-gradient(circle at 50% 24%,#fff 0,#f3f3f3 26%,#c9c9c9 62%,#e9e9e9 100%);box-shadow:0 1px 0 rgba(255,255,255,.75),inset 0 -2px 3px rgba(0,0,0,.18)}
.jb-rb:active,.jb-rb.on{background:radial-gradient(circle at 50% 70%,#cfd9e8 0,#a7b6cc 60%,#c7d2e2 100%);box-shadow:inset 0 1px 3px rgba(0,0,0,.45)}
.jb-rb.big{width:40px;height:40px}
.jb-rb.sm{width:24px;height:24px}
.jb-rb:focus-visible{outline:2px solid #3875d7;outline-offset:1px}
.jb-volw{display:flex;align-items:center;gap:4px;flex:none}
.jb-vol{width:92px;-webkit-appearance:none;appearance:none;background:transparent;height:16px;margin:0}
.jb-vol::-webkit-slider-runnable-track{height:5px;border-radius:3px;background:linear-gradient(#777,#c9c9c9);border:1px solid #555}
.jb-vol::-moz-range-track{height:5px;border-radius:3px;background:linear-gradient(#777,#c9c9c9);border:1px solid #555}
.jb-vol::-webkit-slider-thumb{-webkit-appearance:none;width:13px;height:13px;border-radius:50%;margin-top:-5px;border:1px solid #444;background:radial-gradient(circle at 50% 30%,#fff,#bbb 70%,#ddd)}
.jb-vol::-moz-range-thumb{width:12px;height:12px;border-radius:50%;border:1px solid #444;background:radial-gradient(circle at 50% 30%,#fff,#bbb 70%,#ddd)}
.jb-lcd{flex:1 1 380px;min-width:170px;max-width:560px;height:50px;border-radius:10px;border:1px solid #6e6f5e;background:linear-gradient(#f7f9ea,#e2e7c6 55%,#d6dcb6);box-shadow:inset 0 1px 4px rgba(0,0,0,.45),0 1px 0 rgba(255,255,255,.75);display:flex;align-items:stretch;overflow:hidden;position:relative}
.jb-lcd .side{width:28px;border:0;background:none;display:grid;place-items:center;color:#333;cursor:default;padding:0}
.jb-lcd .side:hover{color:#000}
.jb-lcd .mid{flex:1;min-width:0;text-align:center;padding:4px 2px 0;display:flex;flex-direction:column;align-items:stretch}
.jb-lcd .l1{font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11px}
.jb-lcd .l2{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11px;transition:opacity .35s;min-height:14px}
.jb-lcd .pr{display:flex;align-items:center;gap:6px;font-size:10px;margin-top:1px}
.jb-lcd .pr span{min-width:34px;cursor:default}
.jb-lcd .bar{flex:1;height:8px;border:1px solid #333;background:#f4f6e4;position:relative;cursor:default}
.jb-lcd .bar i{position:absolute;left:0;top:0;bottom:0;background:#9aa07c}
.jb-lcd .bar b{position:absolute;top:50%;width:9px;height:9px;margin:-5px 0 0 -5px;background:#111;transform:rotate(45deg)}
.jb-lcd .idle{position:absolute;inset:0;display:grid;place-items:center;font:bold 15px/1 var(--jbfont);color:#444;letter-spacing:.5px;pointer-events:none}
.jb-lcd .idle small{display:block;font:10px var(--jbfont);color:#666;letter-spacing:0;margin-top:3px;text-align:center}
.jb-srch{display:flex;flex-direction:column;align-items:center;gap:2px;flex:0 1 170px;min-width:100px}
.jb-srch input{width:100%;height:21px;border-radius:11px;border:1px solid #6d6d6d;padding:0 10px 0 22px;font:11px var(--jbfont);box-shadow:inset 0 1px 2px rgba(0,0,0,.35);background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12'%3E%3Ccircle cx='5' cy='5' r='3.6' fill='none' stroke='%23555' stroke-width='1.4'/%3E%3Cpath d='M7.6 7.6 11 11' stroke='%23555' stroke-width='1.6'/%3E%3C/svg%3E") 6px 50% no-repeat;outline:none}
.jb-srch input:focus{box-shadow:inset 0 1px 2px rgba(0,0,0,.35),0 0 0 3px rgba(80,140,230,.55)}
.jb-lbl{font-size:10px;color:#222;text-shadow:0 1px 0 rgba(255,255,255,.6);white-space:nowrap}
.jb-btnw{display:flex;flex-direction:column;align-items:center;gap:2px;flex:none}
.jb-mid{flex:1;min-height:0;display:flex;gap:7px;padding:0 10px}
.jb-left{width:178px;flex:none;display:flex;flex-direction:column;gap:7px;min-height:0}
.jb-src{flex:1;min-height:60px;overflow:auto;background:#fff;border:1px solid #6d6d6d;box-shadow:0 1px 0 rgba(255,255,255,.6);outline:none}
.jb-src .it{display:flex;align-items:center;gap:6px;height:21px;padding:0 6px;white-space:nowrap;cursor:default;font-size:11px}
.jb-src .it span{overflow:hidden;text-overflow:ellipsis;flex:1}
.jb-src .it em{font-style:normal;color:#777;font-size:10px}
.jb-src .it svg{flex:none}
.jb-src .it.on{background:#d4d4d4}
.jb-src:focus .it.on{background:linear-gradient(#5a98e6,#2c6ccd);color:#fff}
.jb-src:focus .it.on em{color:#dde}
.jb-src .it.drop{outline:2px solid #3875d7;outline-offset:-2px;background:#dbe8fb}
.jb-src .it input{flex:1;min-width:0;font:11px var(--jbfont);border:1px solid #3875d7;padding:0 2px;height:16px}
.jb-src .grp{height:6px}
.jb-art{flex:none;background:#fff;border:1px solid #6d6d6d;display:flex;flex-direction:column}
.jb-art .ah{font-size:10px;text-align:center;padding:1px 0;background:linear-gradient(#fefefe,#dcdcdc);border-bottom:1px solid #9a9a9a;cursor:default}
.jb-art .ai{aspect-ratio:1;display:grid;place-items:center;background:#fff;position:relative;overflow:hidden}
.jb-art .ai img{width:100%;height:100%;object-fit:cover;display:block}
.jb-art .ai.drop{outline:3px dashed #3875d7;outline-offset:-4px}
.jb-art .ph{width:100%;height:100%;display:grid;place-items:center;text-align:center;font-size:10px;color:#666;background:linear-gradient(135deg,#eef2f8,#d8e0ec)}
.jb-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:7px;min-height:0;position:relative}
.jb-br{flex:none;height:132px;display:flex;gap:7px}
.jb-br[hidden]{display:none}
.jb-bc{flex:1;min-width:0;display:flex;flex-direction:column;background:#fff;border:1px solid #6d6d6d}
.jb-bc .h{height:17px;line-height:16px;padding:0 6px;background:linear-gradient(#fdfdfd,#e8e8e8 50%,#dcdcdc 51%,#f0f0f0);border-bottom:1px solid #9a9a9a;font-size:11px}
.jb-bc .l{flex:1;overflow:auto;outline:none}
.jb-bc .l div{height:17px;line-height:17px;padding:0 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:default}
.jb-bc .l div:nth-child(even){background:#edf3fe}
.jb-bc .l div.on{background:#d4d4d4}
.jb-bc .l:focus div.on{background:#3875d7;color:#fff}
.jb-list{flex:1;min-height:0;overflow:auto;background:#fff;border:1px solid #6d6d6d;outline:none;position:relative}
.jb-hdr{position:sticky;top:0;z-index:2;display:grid;grid-template-columns:var(--cols);height:18px;min-width:max-content;background:linear-gradient(#fdfdfd,#e8e8e8 50%,#dcdcdc 51%,#f0f0f0);border-bottom:1px solid #9a9a9a}
.jb-hdr span{position:relative;border-right:1px solid #b4b4b4;padding:0 5px;line-height:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:default;font-size:11px}
.jb-hdr span.r{text-align:right}
.jb-hdr span.s{background:linear-gradient(#cfe2f9,#9cc2f2 50%,#84b1ec 51%,#bcd8f8);padding-right:14px}
.jb-hdr span.s::after{content:"";position:absolute;right:4px;top:6px;border:4px solid transparent;border-top:5px solid #234}
.jb-hdr span.s.up::after{top:2px;border-top-color:transparent;border-bottom:5px solid #234}
.jb-hdr .rz{position:absolute;right:0;top:0;bottom:0;width:5px;cursor:col-resize}
.jb-rows{position:relative;min-width:max-content}
.jb-rows .jr{position:absolute;left:0;right:0;height:17px;display:grid;grid-template-columns:var(--cols);align-items:center;cursor:default;font-size:11px}
.jb-rows .jr.z{background:#edf3fe}
.jb-rows .jr.sel{background:#d4d4d4}
.jb-list:focus .jb-rows .jr.sel{background:#3875d7;color:#fff}
.jb-rows .jr.off{color:#888}
.jb-rows .jr.drop{box-shadow:inset 0 2px 0 #1e5bc6}
.jb-rows .jr span{padding:0 5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.jb-rows .jr span.r{text-align:right}
.jb-rows .jr span.pl{padding:0;display:grid;place-items:center;color:#1e5bc6}
.jb-list:focus .jb-rows .jr.sel span.pl{color:#fff}
.jb-rows .jr .ck{display:inline-block;width:11px;height:11px;border:1px solid #777;border-radius:2px;background:linear-gradient(#fff,#e2e2e2);vertical-align:-2px;margin-right:5px;position:relative}
.jb-rows .jr .ck.on::after{content:"";position:absolute;left:3px;top:0;width:3px;height:7px;border:solid #1a1a1a;border-width:0 2px 2px 0;transform:rotate(40deg)}
.jb-rows .jr .st{letter-spacing:1px;color:#333}
.jb-list:focus .jb-rows .jr.sel .st{color:#fff}
.jb-rows .jr .st i{font-style:normal;opacity:.45}
.jb-rows .jr .bad{color:#c00;font-weight:bold}
.jb-empty{position:absolute;inset:24px 10px auto;text-align:center;color:#666;font-size:12px;pointer-events:none}
.jb-bot{flex:none;display:flex;align-items:center;gap:7px;padding:7px 12px 8px;min-height:44px}
.jb-bot .grow{flex:1;text-align:center;font-size:11px;color:#222;text-shadow:0 1px 0 rgba(255,255,255,.6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:default}
.jb-rb .badge{position:absolute;font:bold 8px/1 var(--jbfont);margin:9px 0 0 12px;color:#1e5bc6}
.jb-vis{position:absolute;inset:0;z-index:5;background:#000;border:1px solid #333;cursor:none}
.jb-vis canvas{width:100%;height:100%;display:block}
.jb-sheet-bg{position:fixed;inset:0;z-index:50;background:rgba(40,40,40,.25);display:grid;place-items:start center;padding-top:24px}
.jb-sheet{width:min(520px,94vw);max-height:calc(100vh - 48px);overflow:auto;background:linear-gradient(#f4f4f4,#e3e3e3);border:1px solid #666;border-radius:0 0 8px 8px;box-shadow:0 8px 28px rgba(0,0,0,.45);padding:14px 16px 12px;font:12px/1.4 var(--jbfont)}
.jb-sheet h3{margin:0 0 10px;font:bold 13px var(--jbfont)}
.jb-sheet .tabsx{display:flex;justify-content:center;margin-bottom:10px}
.jb-sheet .tabsx button{border:1px solid #777;background:linear-gradient(#fff,#ddd);padding:2px 14px;font:11px var(--jbfont);margin-left:-1px}
.jb-sheet .tabsx button:first-child{border-radius:10px 0 0 10px}.jb-sheet .tabsx button:last-child{border-radius:0 10px 10px 0}
.jb-sheet .tabsx button.on{background:linear-gradient(#7fb0f0,#3f7fdc);color:#fff;border-color:#2b5ea8}
.jb-sheet .sum{display:flex;gap:12px}
.jb-sheet .sum .cov{width:110px;height:110px;flex:none;border:1px solid #888;background:#ddd;display:grid;place-items:center;overflow:hidden}
.jb-sheet .sum .cov img{width:100%;height:100%;object-fit:cover}
.jb-sheet table{border-collapse:collapse;font-size:11px}
.jb-sheet td{padding:1px 6px 1px 0;vertical-align:top}
.jb-sheet td:first-child{color:#555;text-align:right;white-space:nowrap}
.jb-sheet .fg{display:grid;grid-template-columns:auto 1fr auto 1fr;gap:6px 8px;align-items:center}
.jb-sheet .fg label{text-align:right;color:#333;font-size:11px}
.jb-sheet .fg input,.jb-sheet .fg textarea{font:12px var(--jbfont);border:1px solid #888;padding:2px 4px;box-shadow:inset 0 1px 2px rgba(0,0,0,.2);min-width:0}
.jb-sheet .fg .wide{grid-column:2 / 5}
.jb-sheet .btns{display:flex;justify-content:flex-end;gap:8px;margin-top:14px;align-items:center}
.jb-sheet .btns .left{margin-right:auto;display:flex;gap:6px}
.jb-pill{border:1px solid #666;border-radius:11px;padding:2px 14px;min-width:70px;font:12px var(--jbfont);background:linear-gradient(#fff,#e6e6e6 50%,#d8d8d8 51%,#f2f2f2);cursor:default}
.jb-pill.def{background:linear-gradient(#bcd8fb,#6aa1ec 50%,#4b8be6 51%,#a9cdf8);border-color:#2b5ea8}
.jb-pill:disabled{opacity:.5}
.jb-stars{font-size:15px;letter-spacing:2px;cursor:default;color:#333;user-select:none}
.jb-eq{position:absolute;right:10px;bottom:52px;z-index:40;width:min(460px,96vw);border:1px solid #555;border-radius:6px;background:${JB_METAL},linear-gradient(#d4d4d4,#b8b8b8);box-shadow:0 6px 22px rgba(0,0,0,.45);padding:0 10px 10px}
.jb-eq .t{display:flex;align-items:center;justify-content:center;position:relative;height:20px;font-size:11px;font-weight:bold;text-shadow:0 1px 0 rgba(255,255,255,.6)}
.jb-eq .t button{position:absolute;left:0;top:4px;width:12px;height:12px;border-radius:50%;border:1px solid #8a1d14;background:radial-gradient(circle at 50% 35%,#ffb0a8,#e2463a 70%);padding:0}
.jb-eq .row1{display:flex;align-items:center;gap:10px;margin:4px 0 8px}
.jb-eq .row1 select{font:11px var(--jbfont)}
.jb-eq .sl{display:flex;gap:4px;align-items:flex-end}
.jb-eq .band{display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;font-size:9px}
.jb-eq .scale{display:flex;flex-direction:column;justify-content:space-between;height:110px;font-size:9px;text-align:right;padding-bottom:14px;color:#222}
.vsl{width:16px;height:110px;position:relative;cursor:default;touch-action:none}
.vsl::before{content:"";position:absolute;left:6px;width:4px;top:4px;bottom:4px;border-radius:2px;background:linear-gradient(90deg,#555,#999);box-shadow:0 1px 0 rgba(255,255,255,.6)}
.vsl::after{content:"";position:absolute;left:0;right:0;top:50%;border-top:1px dotted rgba(0,0,0,.35)}
.vsl b{position:absolute;left:0;width:16px;height:9px;margin-top:-5px;border:1px solid #444;border-radius:3px;background:linear-gradient(#fff,#bbb);z-index:1}
.jb-left .srcsel{display:none}
@media (max-width:700px){.jb-left{display:none}.jb-volw{display:none}.jb-top{gap:8px;padding:6px}.jb-mid{padding:0 6px}.jb-srcsel{display:block!important}.jb-br{height:100px}}
.jb-srcsel{display:none;font:11px var(--jbfont);max-width:140px}
@media (max-width:480px){.jb-srch{display:none}.jb-btnw.br{display:none}.jb-btnw{display:none}.jb-top{flex-wrap:wrap}.jb-lcd{flex-basis:160px}.jb-srcsel{max-width:100%;flex:1 1 100%}}`;

function jukeboxRoute(path, q) {
  let m;
  if ((m = /^\/song\/([^/]+)\/?$/.exec(path))) {
    const key = decodeURIComponent(m[1]).toLowerCase();
    const d = S.slugs.get('song:' + key);
    if (!d) return { type: 'gen', url: JB_HOST + path, title: '404 Not Found', html: notFoundPage(JB_HOST + path, 'music.lanscape.net'), status: 404 };
    return { type: 'app', doc: d, url: d.url, view: { song: d.path } };
  }
  if ((m = /^\/(album|artist|genre|playlist|smart)\/([^/]+)\/?$/.exec(path))) {
    const v = decodeURIComponent(m[2]);
    return { type: 'app', url: JB_HOST + path, view: { [m[1]]: v }, title: jbViewTitle(m[1], v) };
  }
  if (path === '/now-playing' || path === '/now-playing/') return { type: 'app', url: JB_HOST + '/now-playing', view: { now: true }, title: 'Now Playing - Jukebox' };
  if (path === '/search') return { type: 'app', url: JB_HOST + '/search?q=' + encodeURIComponent(q.get('q') || ''), view: { q: q.get('q') || '' }, title: 'Search: ' + (q.get('q') || '') + ' - Jukebox' };
  return null;
}
function jbSongs() { return docsShown().filter(d => d.kind === 'audio' && d.active !== false); }
function jbViewTitle(kind, v) {
  const songs = jbSongs().map(songInfo);
  if (kind === 'album') { const s = songs.find(x => albumKey(x.artist, x.album) === v); return (s ? s.album + ' by ' + s.artist : 'Album') + ' - Jukebox'; }
  if (kind === 'artist') { const s = songs.find(x => slug(x.artist) === v); return (s ? s.artist : 'Artist') + ' - Jukebox'; }
  if (kind === 'genre') { const s = songs.find(x => slug(x.genre) === v); return (s ? s.genre : 'Genre') + ' - Jukebox'; }
  if (kind === 'playlist') { const p = S.playlists.find(x => x.id === v); return (p ? p.name : 'Playlist') + ' - Jukebox'; }
  if (kind === 'smart') { const p = JB_SMART.find(x => x.id === v); return (p ? p.name : 'Playlist') + ' - Jukebox'; }
  return 'Jukebox';
}
const jbAlbumUrl = s => JB_HOST + '/album/' + albumKey(s.artist, s.album);
const jbArtistUrl = s => JB_HOST + '/artist/' + slug(s.artist);
function fmtTotal(sec, exact) {
  if (exact) { const d = Math.floor(sec / 86400), r = sec % 86400; return (d ? d + ':' + pad(Math.floor(r / 3600), 2) + ':' + pad(Math.floor((r % 3600) / 60), 2) + ':' + pad(Math.floor(r % 60), 2) : fmtTime(sec)) + ' total time'; }
  if (sec < 3600) return (sec / 60).toFixed(1) + ' minutes';
  if (sec < 86400) return (sec / 3600).toFixed(1) + ' hours';
  return (sec / 86400).toFixed(1) + ' days';
}
const cmpVal = (a, b) => (typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }));
const sortArtist = a => String(a || '').replace(/^the\s+/i, '');

async function mountJukebox(ctx) {
  const { h, doc, win } = ctx;
  const saved = (await ctx.kv.get('jukebox:view')) || {};
  const V = Object.assign({ cols: JB_DEFAULT_COLS.slice(), widths: {}, browse: false, art: true, artNow: false, sorts: {}, src: { kind: 'library' }, vis: false }, saved);
  const route = Object.assign({}, ctx.route.view || {});
  if (ctx.file && ctx.file.kind === 'audio' && !route.song) route.song = ctx.file.path;
  let src = V.src && V.src.kind ? V.src : { kind: 'library' };
  let search = '', brSel = { genre: null, artist: null, album: null };
  let rows = [], selKeys = new Set(), anchor = -1, lastClick = -1, showTotalExact = false;
  const saveView = debounce(() => { V.src = src; ctx.kv.set('jukebox:view', V); }, 300);
  /* ---------- DOM ---------- */
  const btn = (cls, svg, title, act) => { const b = h('button', { class: 'jb-rb ' + cls, type: 'button', title, 'aria-label': title, html: svg }); b.addEventListener('click', act); return b; };
  const playBtn = btn('big', JB_SVG.play, 'Play / Pause (Space)', () => Player.toggle() );
  const vol = h('input', { class: 'jb-vol', type: 'range', min: '0', max: '1', step: '0.01', 'aria-label': 'Volume', title: 'Volume' });
  vol.value = String(S.prefs.vol == null ? 0.8 : S.prefs.vol);
  vol.addEventListener('input', () => Player.setVolume(+vol.value));
  const lcd = {
    l1: h('div', { class: 'l1' }), l2: h('div', { class: 'l2' }), el: h('span', { text: '0:00', title: 'Elapsed time' }), rem: h('span', { text: '', title: 'Click for total time', style: { textAlign: 'right' } }),
    fill: h('i'), dia: h('b'), idle: h('div', { class: 'idle', html: '<div>&#9835; LANscape Jukebox<small>Double-click a song to play it</small></div>' })
  };
  lcd.bar = h('div', { class: 'bar', title: 'Drag to move through the song' }, lcd.fill, lcd.dia);
  const lcdBox = h('div', { class: 'jb-lcd', role: 'status' },
    h('button', { class: 'side', type: 'button', title: 'Show the playing song', 'aria-label': 'Show the playing song', html: JB_SVG.speaker, onclick: () => showCurrent() }),
    h('div', { class: 'mid' }, lcd.l1, lcd.l2, h('div', { class: 'pr' }, lcd.el, lcd.bar, lcd.rem)),
    h('button', { class: 'side', type: 'button', title: 'Open LANamp', 'aria-label': 'Open LANamp', html: '<svg viewBox="0 0 12 12" width="11" height="11"><path d="M2 10 10 2M4 2h6v6" fill="none" stroke="#333" stroke-width="1.5"/></svg>', onclick: () => { if (typeof LANamp !== 'undefined') LANamp.toggle(true); } }),
    lcd.idle);
  const searchIn = h('input', { type: 'search', placeholder: '', 'aria-label': 'Search the music', spellcheck: 'false' });
  const browseBtn = btn('', JB_SVG.eye, 'Browse by genre, artist and album (Ctrl+B)', () => setBrowse(!V.browse));
  const top = h('div', { class: 'jb-top' },
    h('div', { class: 'jb-tr' }, btn('', JB_SVG.prev, 'Previous song', () => Player.prev()), playBtn, btn('', JB_SVG.next, 'Next song', () => Player.next())),
    h('div', { class: 'jb-volw' }, h('span', { html: JB_SVG.spkLo }), vol, h('span', { html: JB_SVG.spkHi })),
    lcdBox,
    h('div', { class: 'jb-srch' }, searchIn, h('span', { class: 'jb-lbl', text: 'Search' })),
    h('div', { class: 'jb-btnw br' }, browseBtn, h('span', { class: 'jb-lbl', text: 'Browse' })),
    h('div', { class: 'jb-btnw' }, btn('', JB_SVG.burn, 'Burn this playlist to a ZIP "disc"', () => burn()), h('span', { class: 'jb-lbl', text: 'Burn Disc' })));
  const srcList = h('div', { class: 'jb-src', tabindex: '0', role: 'listbox', 'aria-label': 'Source' });
  const srcSel = h('select', { class: 'jb-srcsel', 'aria-label': 'Source' });
  const artImg = h('div', { class: 'ai' });
  const artHead = h('div', { class: 'ah', text: 'Selected Song', title: 'Click to switch between the selected song and the playing song' });
  const artBox = h('div', { class: 'jb-art' }, artHead, artImg);
  artBox.hidden = !V.art;
  const left = h('div', { class: 'jb-left' }, srcList, artBox);
  const brCols = ['genre', 'artist', 'album'].map(k => { const l = h('div', { class: 'l', tabindex: '0', 'data-k': k }); return { k, l, box: h('div', { class: 'jb-bc' }, h('div', { class: 'h', text: k === 'genre' ? 'Genre' : k === 'artist' ? 'Artist' : 'Album' }), l) }; });
  const brBox = h('div', { class: 'jb-br' }, ...brCols.map(c => c.box));
  brBox.hidden = !V.browse;
  const hdr = h('div', { class: 'jb-hdr' });
  const body = h('div', { class: 'jb-rows' });
  const empty = h('div', { class: 'jb-empty', hidden: true });
  const list = h('div', { class: 'jb-list', tabindex: '0', role: 'grid', 'aria-label': 'Songs' }, hdr, body, empty);
  const main = h('div', { class: 'jb-main' }, brBox, list);
  const shuffleBtn = btn('sm', JB_SVG.shuffle, 'Shuffle', () => Player.setShuffle(!S.prefs.shuffle));
  const repeatBtn = btn('sm', JB_SVG.repeat, 'Repeat: off', () => Player.cycleRepeat());
  repeatBtn.style.position = 'relative';
  const stat = h('div', { class: 'grow', title: 'Click to switch between rounded and exact total time' });
  stat.addEventListener('click', () => { showTotalExact = !showTotalExact; updateStat(); });
  const artBtn = btn('sm', JB_SVG.art, 'Show or hide song artwork (Ctrl+G)', () => { V.art = !V.art; artBox.hidden = !V.art; artBtn.classList.toggle('on', V.art); saveView(); updateArt(); });
  const eqBtn = btn('sm', JB_SVG.eq, 'Equalizer', () => toggleEq());
  const visBtn = btn('sm', JB_SVG.vis, 'Visualizer (Ctrl+T)', () => setVis(!visOn));
  const bot = h('div', { class: 'jb-bot' },
    btn('sm', JB_SVG.plus, 'New playlist (Ctrl+N)', () => newPlaylist()), shuffleBtn, repeatBtn, artBtn,
    stat,
    eqBtn, visBtn, btn('sm', JB_SVG.amp, 'LANamp mini player', () => { if (typeof LANamp !== 'undefined') LANamp.toggle(); }));
  artBtn.classList.toggle('on', V.art);
  ctx.root.append(top, h('div', { class: 'jb-mid' }, left, main), bot);
  lcdBox.after(srcSel);
  /* ---------- the song list model ---------- */
  const allSongs = () => jbSongs().map(songInfo);
  let lib = allSongs();
  const libByPath = () => { const m = new Map(); for (const s of lib) m.set(s.path, s); return m; };
  let byPath = libByPath();
  const sortKey = () => (src.kind === 'playlist' || src.kind === 'now' ? 'num' : 'artist');
  const sortOf = () => { const k = src.kind + ':' + (src.id || ''); return V.sorts[k] || (V.sorts[src.kind] ? V.sorts[src.kind] : [sortKey(), 1]); };
  const setSort = (col, dir) => { V.sorts[src.kind + ':' + (src.id || '')] = [col, dir]; saveView(); };
  const visibleCols = () => {
    const base = (src.kind === 'playlist' || src.kind === 'now' ? ['num', 'play'] : ['play']);
    return base.concat(V.cols.filter(c => JB_COLS[c] && c !== 'num' && c !== 'play'));
  };
  const colW = c => V.widths[c] || JB_COLS[c].w;
  function sourceSongs() {
    const now = Date.now();
    if (src.kind === 'now') return Player.queue.map((p, i) => { const s = byPath.get(p) || (S.docs.get(p) ? songInfo(S.docs.get(p)) : null); return s ? { key: 'q' + i, s, pos: i } : null; }).filter(Boolean);
    if (src.kind === 'playlist') {
      const pl = S.playlists.find(p => p.id === src.id);
      if (!pl) { src = { kind: 'library' }; return sourceSongs(); }
      return pl.paths.map((p, i) => { const s = byPath.get(p); return s ? { key: 'p' + i, s, pos: i } : null; }).filter(Boolean);
    }
    if (src.kind === 'smart') {
      const sp = JB_SMART.find(x => x.id === src.id);
      if (!sp) { src = { kind: 'library' }; return sourceSongs(); }
      let list = lib.filter(s => sp.test(s, now));
      list.sort((a, b) => sp.by(a) - sp.by(b));
      if (sp.limit) list = list.slice(0, sp.limit);
      return list.map((s, i) => ({ key: s.path, s, pos: i }));
    }
    return lib.map((s, i) => ({ key: s.path, s, pos: i }));
  }
  const matches = (s, toks) => { if (!toks.length) return true; const hay = (s.title + ' ' + s.artist + ' ' + s.album + ' ' + s.genre + ' ' + s.comment + ' ' + s.year).toLowerCase(); return toks.every(t => hay.includes(t)); };
  const SORTS = {
    num: r => r.pos, play: r => (r.s.path === Player.currentPath() ? 0 : 1), title: r => r.s.title, time: r => r.s.duration, artist: r => [sortArtist(r.s.artist), r.s.album, r.s.track, r.s.title],
    album: r => [r.s.album, r.s.track, r.s.title], track: r => [r.s.track, r.s.album], genre: r => [r.s.genre || '￿', sortArtist(r.s.artist), r.s.album, r.s.track], year: r => [+r.s.year || 0, r.s.album, r.s.track],
    rating: r => [r.s.rating, r.s.title], plays: r => [r.s.plays, r.s.last], last: r => r.s.last, kind: r => r.s.d.ext, bitrate: r => r.s.bitrate, size: r => r.s.d.size || 0,
    added: r => S.firstSeen[r.s.path] || r.s.d.mtime || 0, comment: r => r.s.comment
  };
  function compute() {
    const toks = search.toLowerCase().split(/\s+/).filter(Boolean);
    let base = sourceSongs().filter(r => matches(r.s, toks));
    // browser columns
    if (V.browse) {
      const gset = new Map(), aset = new Map(), alset = new Map();
      for (const r of base) gset.set(r.s.genre || '', 1);
      const g1 = base.filter(r => brSel.genre == null || (r.s.genre || '') === brSel.genre);
      for (const r of g1) aset.set(r.s.artist, 1);
      const a1 = g1.filter(r => brSel.artist == null || r.s.artist === brSel.artist);
      for (const r of a1) alset.set(r.s.album, 1);
      const al1 = a1.filter(r => brSel.album == null || r.s.album === brSel.album);
      fillBrowser('genre', Array.from(gset.keys()).sort(cmpVal), 'Genres');
      fillBrowser('artist', Array.from(aset.keys()).sort((a, b) => cmpVal(sortArtist(a), sortArtist(b))), 'Artists');
      fillBrowser('album', Array.from(alset.keys()).sort(cmpVal), 'Albums');
      base = al1;
    }
    const [col, dir] = sortOf();
    const key = SORTS[col] || SORTS.artist;
    const keyed = base.map(r => [key(r), r]);
    keyed.sort((a, b) => {
      const x = a[0], y = b[0];
      if (Array.isArray(x)) { for (let i = 0; i < x.length; i++) { const c = cmpVal(x[i], y[i]); if (c) return c * dir; } return 0; }
      return cmpVal(x, y) * dir;
    });
    rows = keyed.map(k => k[1]);
  }
  function fillBrowser(k, values, plural) {
    const c = brCols.find(x => x.k === k);
    if (brSel[k] != null && !values.includes(brSel[k])) brSel[k] = null;
    const label = v => (k === 'genre' && v === '' ? '(No Genre)' : v);
    c.l.innerHTML = '<div data-v="" class="' + (brSel[k] == null ? 'on' : '') + '">All (' + values.length + ' ' + (values.length === 1 ? plural.slice(0, -1) : plural) + ')</div>' + values.map(v => '<div data-v="' + esc(v) + '" data-x="1" class="' + (brSel[k] === v ? 'on' : '') + '" title="' + esc(label(v)) + '">' + esc(label(v)) + '</div>').join('');
  }
  /* ---------- painting ---------- */
  const ROW = 17;
  function layoutCols() {
    const cols = visibleCols();
    list.style.setProperty('--cols', cols.map(c => colW(c) + 'px').join(' ') + ' minmax(0,1fr)');
    const [col, dir] = sortOf();
    hdr.innerHTML = cols.map(c => '<span data-c="' + c + '" class="' + (JB_COLS[c].r ? 'r ' : '') + (c === col ? 's' + (dir < 0 ? ' up' : '') : '') + '" title="' + esc(JB_COLS[c].label || (c === 'num' ? 'Playlist order' : 'Playing')) + '">' + esc(JB_COLS[c].label || (c === 'num' ? '#' : '')) + (c !== 'play' ? '<i class="rz" data-rz="' + c + '"></i>' : '') + '</span>').join('') + '<span></span>';
  }
  const stars = (n, show) => { let o = ''; for (let i = 1; i <= 5; i++) o += i <= n ? '★' : show ? '<i>·</i>' : ''; return o || '&nbsp;'; };
  function cell(c, r, isSel) {
    const s = r.s;
    switch (c) {
      case 'num': return r.pos + 1;
      case 'play': return r.s.path === Player.currentPath() && (src.kind !== 'now' || r.pos === Player.index) ? JB_SVG.speaker : (S.music[s.path] && S.music[s.path].bad ? '<b class="bad" title="' + esc(Player.error() || 'This song couldn\'t be played') + '">!</b>' : '');
      case 'title': return '<i class="ck' + (s.off ? '' : ' on') + '" data-ck="1"></i>' + esc(s.title);
      case 'time': return s.duration ? fmtTime(s.duration) : '';
      case 'artist': return esc(s.artist);
      case 'album': return esc(s.album);
      case 'track': return s.track || '';
      case 'genre': return esc(s.genre);
      case 'year': return esc(s.year);
      case 'rating': return '<span class="st" data-rate="1">' + stars(s.rating, isSel) + '</span>';
      case 'plays': return s.plays || '';
      case 'last': return s.last ? esc(fmtShort(s.last) + ' ' + new Date(s.last).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })) : '';
      case 'kind': return esc(AUDIO_KIND[s.d.ext] || (s.d.ext || '').toUpperCase() + ' audio file');
      case 'bitrate': return s.bitrate ? s.bitrate + ' kbps' : '';
      case 'size': return esc(fmtBytes(s.d.size || 0));
      case 'added': return esc(fmtShort(S.firstSeen[s.path] || s.d.mtime || Date.now()));
      case 'comment': return esc(s.comment);
    }
    return '';
  }
  let painted = [-1, -1];
  function paint(force) {
    const top0 = list.scrollTop, hh = list.clientHeight;
    const first = Math.max(0, Math.floor((top0 - 18) / ROW) - 8), last = Math.min(rows.length, Math.ceil((top0 + hh) / ROW) + 8);
    if (!force && painted[0] === first && painted[1] === last) return;
    painted = [first, last];
    const cols = visibleCols();
    let html = '';
    for (let i = first; i < last; i++) {
      const r = rows[i], isSel = selKeys.has(r.key);
      html += '<div class="jr' + (i % 2 ? ' z' : '') + (isSel ? ' sel' : '') + (r.s.off ? ' off' : '') + '" data-i="' + i + '" draggable="true" style="top:' + i * ROW + 'px">' +
        cols.map(c => '<span class="' + (c === 'play' ? 'pl' : JB_COLS[c].r ? 'r' : '') + '"' + (c === 'title' ? ' title="' + esc(r.s.title) + '"' : '') + '>' + cell(c, r, isSel) + '</span>').join('') + '<span></span></div>';
    }
    body.innerHTML = html;
  }
  /** selection changes restyle the rows in place, so a double-click lands on the same element */
  function restyle() {
    for (const rowEl of body.children) {
      const r = rows[+rowEl.dataset.i];
      if (!r) continue;
      const isSel = selKeys.has(r.key);
      rowEl.classList.toggle('sel', isSel);
      rowEl.classList.toggle('off', !!r.s.off);
      const ck = rowEl.querySelector('.ck'); if (ck) ck.classList.toggle('on', !r.s.off);
      const st = rowEl.querySelector('[data-rate]'); if (st) st.innerHTML = stars(r.s.rating, isSel);
    }
  }
  function render() {
    compute();
    layoutCols();
    body.style.height = rows.length * ROW + 'px';
    empty.hidden = !!rows.length;
    if (!rows.length) empty.textContent = search ? 'No songs match “' + search + '”.' : src.kind === 'playlist' ? 'This playlist is empty. Drag songs from your Library onto it.' : src.kind === 'now' ? 'Nothing is lined up. Double-click a song, or choose Play Next from a song\'s menu.' : src.kind === 'smart' ? 'No songs fit this playlist yet.' : 'No music yet. Open a folder with MP3, AAC, WAV, FLAC, Ogg or MIDI files.';
    // drop selection that went away
    const keys = new Set(rows.map(r => r.key));
    for (const k of Array.from(selKeys)) if (!keys.has(k)) selKeys.delete(k);
    paint(true);
    updateStat();
    updateArt();
  }
  function updateStat() {
    const n = rows.length, secs = rows.reduce((a, r) => a + (r.s.duration || 0), 0), bytes = rows.reduce((a, r) => a + (r.s.d.size || 0), 0);
    stat.textContent = n ? n.toLocaleString() + ' song' + (n === 1 ? '' : 's') + ', ' + fmtTotal(secs, showTotalExact) + ', ' + fmtBytes(bytes) : '';
  }
  /* ---------- sources ---------- */
  function renderSources() {
    const it = (kind, id, name, icon, extra) => '<div class="it' + (src.kind === kind && (src.id || '') === (id || '') ? ' on' : '') + '" role="option" data-kind="' + kind + '" data-id="' + esc(id || '') + '">' + icon + '<span>' + esc(name) + '</span>' + (extra ? '<em>' + extra + '</em>' : '') + '</div>';
    const q = Player.queue.length;
    srcList.innerHTML = it('library', '', 'Library', JB_SVG.lib) + it('now', '', 'Now Playing', JB_SVG.now, q ? String(q) : '') + '<div class="grp"></div>' +
      JB_SMART.map(sp => it('smart', sp.id, sp.name, JB_SVG.smart)).join('') +
      S.playlists.map(p => it('playlist', p.id, p.name, JB_SVG.list)).join('');
    srcSel.innerHTML = '<option value="library|">Library</option><option value="now|">Now Playing</option>' + JB_SMART.map(sp => '<option value="smart|' + sp.id + '">' + esc(sp.name) + '</option>').join('') + S.playlists.map(p => '<option value="playlist|' + esc(p.id) + '">' + esc(p.name) + '</option>').join('');
    srcSel.value = src.kind + '|' + (src.id || '');
  }
  function srcUrl() {
    if (src.kind === 'playlist') return JB_HOST + '/playlist/' + src.id;
    if (src.kind === 'smart') return JB_HOST + '/smart/' + src.id;
    if (src.kind === 'now') return JB_HOST + '/now-playing';
    return JB_HOST + '/';
  }
  function srcTitle() {
    if (src.kind === 'playlist') { const p = S.playlists.find(x => x.id === src.id); return (p ? p.name : 'Playlist') + ' - Jukebox'; }
    if (src.kind === 'smart') { const p = JB_SMART.find(x => x.id === src.id); return (p ? p.name : 'Playlist') + ' - Jukebox'; }
    if (src.kind === 'now') return 'Now Playing - Jukebox';
    return 'Jukebox';
  }
  function setSource(kind, id, noUrl) {
    src = { kind, id: id || '' };
    brSel = { genre: null, artist: null, album: null };
    selKeys.clear(); anchor = -1;
    list.scrollTop = 0;
    renderSources();
    render();
    saveView();
    if (!noUrl) ctx.replaceUrl(srcUrl(), srcTitle());
  }
  srcList.addEventListener('mousedown', e => {
    const it = e.target.closest('.it');
    if (!it || e.target.tagName === 'INPUT') return;
    if (it.dataset.kind !== src.kind || it.dataset.id !== (src.id || '')) setSource(it.dataset.kind, it.dataset.id);
  });
  srcSel.addEventListener('change', () => { const [k, id] = srcSel.value.split('|'); setSource(k, id); });
  srcList.addEventListener('dblclick', e => { const it = e.target.closest('.it'); if (it && it.dataset.kind === 'playlist') renamePlaylist(it.dataset.id); });
  srcList.addEventListener('contextmenu', e => {
    const it = e.target.closest('.it');
    if (!it) return;
    e.preventDefault();
    const { kind, id } = it.dataset;
    if (kind !== src.kind || id !== (src.id || '')) setSource(kind, id);
    const items = [{ label: 'Play', act: () => { if (rows.length) playRow(0); } }, { label: 'Shuffle Play', act: () => { if (rows.length) { Player.setShuffle(true); Player.playPaths(rows.map(r => r.s.path)); } } }];
    if (kind === 'playlist') items.push({ sep: 1 }, { label: 'Rename', act: () => renamePlaylist(id) }, { label: 'Export Playlist (.m3u)...', act: () => exportM3U() }, { label: 'Burn Playlist to Disc...', act: () => burn() }, { sep: 1 }, { label: 'Delete Playlist', act: () => deletePlaylist(id) });
    else if (kind === 'now') items.push({ sep: 1 }, { label: 'Save as Playlist', act: () => newPlaylist(Player.queue) }, { label: 'Clear Now Playing', act: () => Player.clear() });
    else items.push({ sep: 1 }, { label: 'Export as .m3u...', act: () => exportM3U() }, { label: 'New Playlist (Ctrl+N)', act: () => newPlaylist() });
    appPopup(ctx, e.clientX, e.clientY, items);
  });
  // drag songs onto playlists
  const DT = 'application/x-lanscape-songs';
  srcList.addEventListener('dragover', e => {
    if (!e.dataTransfer.types.includes(DT)) return;
    const it = e.target.closest('.it');
    for (const x of srcList.querySelectorAll('.drop')) x.classList.remove('drop');
    if (it && (it.dataset.kind === 'playlist' || it.dataset.kind === 'now')) { it.classList.add('drop'); e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }
    else if (!it || it.dataset.kind === 'library') { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }
  });
  srcList.addEventListener('dragleave', () => { for (const x of srcList.querySelectorAll('.drop')) x.classList.remove('drop'); });
  srcList.addEventListener('drop', e => {
    for (const x of srcList.querySelectorAll('.drop')) x.classList.remove('drop');
    let paths = [];
    try { paths = JSON.parse(e.dataTransfer.getData(DT) || '[]'); } catch (er) { return; }
    if (!paths.length) return;
    e.preventDefault();
    const it = e.target.closest('.it');
    if (it && it.dataset.kind === 'playlist') addToPlaylist(it.dataset.id, paths);
    else if (it && it.dataset.kind === 'now') { Player.enqueue(paths); toast(paths.length + ' song' + (paths.length === 1 ? '' : 's') + ' added to Now Playing'); }
    else newPlaylist(paths);
  });
  /* ---------- playlists ---------- */
  function uniqueName(base) { let n = base, k = 2; while (S.playlists.some(p => p.name === n)) n = base + ' ' + k++; return n; }
  function newPlaylist(paths, name) {
    const p = { id: 'pl' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: uniqueName(name || 'untitled playlist'), paths: (paths || []).slice() };
    S.playlists.push(p); saveState();
    setSource('playlist', p.id);
    if (!name) setTimeout(() => renamePlaylist(p.id), 30);
    return p;
  }
  function addToPlaylist(id, paths) {
    const p = S.playlists.find(x => x.id === id);
    if (!p) return;
    p.paths.push(...paths); saveState();
    toast(paths.length + ' song' + (paths.length === 1 ? '' : 's') + ' added to “' + p.name + '”');
    renderSources();
    if (src.kind === 'playlist' && src.id === id) render();
  }
  function renamePlaylist(id) {
    const p = S.playlists.find(x => x.id === id);
    const it = srcList.querySelector('.it[data-kind="playlist"][data-id="' + CSS.escape(id) + '"]');
    if (!p || !it) return;
    const inp = h('input', { value: p.name, 'aria-label': 'Playlist name' });
    it.querySelector('span').replaceWith(inp);
    inp.focus(); inp.select();
    let done = false;
    const finish = ok => { if (done) return; done = true; const v = inp.value.trim(); if (ok && v && v !== p.name) { p.name = v.slice(0, 80); saveState(); if (src.kind === 'playlist' && src.id === id) ctx.replaceUrl(srcUrl(), srcTitle()); } renderSources(); };
    inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') finish(true); else if (e.key === 'Escape') finish(false); });
    inp.addEventListener('blur', () => finish(true));
  }
  async function deletePlaylist(id) {
    const p = S.playlists.find(x => x.id === id);
    if (!p) return;
    if (!(await confirmSheet('Delete the playlist “' + p.name + '”?', 'The songs stay in your Library.', 'Delete'))) return;
    S.playlists = S.playlists.filter(x => x !== p); saveState();
    if (src.kind === 'playlist' && src.id === id) setSource('library'); else renderSources();
  }
  /* ---------- selection & playing ---------- */
  const selRows = () => rows.filter(r => selKeys.has(r.key));
  const selPaths = () => selRows().map(r => r.s.path);
  function selectIdx(i, mode) {
    if (i < 0 || i >= rows.length) return;
    const k = rows[i].key;
    if (mode === 'toggle') { if (selKeys.has(k)) selKeys.delete(k); else selKeys.add(k); anchor = i; }
    else if (mode === 'range' && anchor >= 0) { selKeys.clear(); for (let j = Math.min(anchor, i); j <= Math.max(anchor, i); j++) selKeys.add(rows[j].key); }
    else { selKeys.clear(); selKeys.add(k); anchor = i; }
    lastClick = i;
    restyle();
    updateArt();
  }
  function scrollToRow(i) {
    const y = 18 + i * ROW;
    if (y < list.scrollTop + 18) list.scrollTop = y - 18;
    else if (y + ROW > list.scrollTop + list.clientHeight) list.scrollTop = y + ROW - list.clientHeight;
    paint();
  }
  function playRow(i) {
    if (i < 0 || i >= rows.length) return;
    if (src.kind === 'now') Player.jump(rows[i].pos);
    else Player.playPaths(rows.map(r => r.s.path), i);
  }
  function showCurrent() {
    const p = Player.currentPath();
    if (!p) return;
    let i = rows.findIndex(r => r.s.path === p && (src.kind !== 'now' || r.pos === Player.index));
    if (i < 0) { search = ''; searchIn.value = ''; brSel = { genre: null, artist: null, album: null }; if (src.kind !== 'library') setSource('library'); else render(); i = rows.findIndex(r => r.s.path === p); }
    if (i >= 0) { selectIdx(i); scrollToRow(i); list.focus(); }
  }
  const rowAt = e => { const r = e.target.closest('.jr'); return r ? +r.dataset.i : -1; };
  body.addEventListener('mousedown', e => {
    const i = rowAt(e);
    if (i < 0) return;
    if (e.button === 2) { if (!selKeys.has(rows[i].key)) selectIdx(i); return; }
    if (e.target.dataset.ck) { const s = rows[i].s; s.off = !s.off; if (s.off) songStats(s.path).off = true; else delete songStats(s.path).off; saveState(); restyle(); e.preventDefault(); return; }
    const rate = e.target.closest('[data-rate]');
    if (rate && selKeys.has(rows[i].key) && !e.shiftKey && !(e.ctrlKey || e.metaKey)) {
      const rc = rate.getBoundingClientRect(), n = clamp(Math.ceil(((e.clientX - rc.left) / Math.max(1, rc.width)) * 5), 0, 5);
      const s = rows[i].s, v = s.rating === n && n === 1 ? 0 : n;
      Player.rate(s.path, v); s.rating = v; restyle(); e.preventDefault(); return;
    }
    if (e.shiftKey) selectIdx(i, 'range');
    else if (e.ctrlKey || e.metaKey) selectIdx(i, 'toggle');
    else if (!selKeys.has(rows[i].key) || selKeys.size === 1) selectIdx(i);
    else lastClick = i;
  });
  body.addEventListener('click', e => { const i = rowAt(e); if (i >= 0 && !e.shiftKey && !(e.ctrlKey || e.metaKey) && selKeys.size > 1 && selKeys.has(rows[i].key) && lastClick === i && !e.target.dataset.ck) selectIdx(i); });
  body.addEventListener('dblclick', e => { const i = rowAt(e); if (i >= 0 && !e.target.dataset.ck && !e.target.closest('[data-rate]')) playRow(i); });
  body.addEventListener('contextmenu', e => {
    const i = rowAt(e);
    if (i < 0) return;
    e.preventDefault();
    const s = rows[i].s, paths = selPaths();
    const items = [
      { label: 'Play', act: () => playRow(i) }, { label: 'Play Next', act: () => { Player.enqueue(paths, true); toast('Playing next: ' + (paths.length === 1 ? s.title : paths.length + ' songs')); renderSources(); } },
      { label: 'Add to Now Playing', act: () => { Player.enqueue(paths); toast(paths.length + ' song' + (paths.length === 1 ? '' : 's') + ' added to Now Playing'); renderSources(); } }, { sep: 1 },
      ...S.playlists.filter(p => !(src.kind === 'playlist' && src.id === p.id)).slice(0, 12).map(p => ({ label: 'Add to “' + clip(p.name, 28) + '”', act: () => addToPlaylist(p.id, paths) })),
      { label: 'New Playlist from Selection', key: 'Ctrl+Shift+N', act: () => newPlaylist(paths) }, { sep: 1 },
      ...[5, 4, 3, 2, 1, 0].map(n => ({ label: 'My Rating: ' + (n ? '★'.repeat(n) : 'None'), check: () => s.rating === n, act: () => { for (const r of selRows()) { Player.rate(r.s.path, n); r.s.rating = n; } restyle(); } })), { sep: 1 },
      { label: 'Get Info', key: 'Ctrl+I', act: () => getInfo() }, { label: 'Show Album: ' + clip(s.album, 30), act: () => { setBrowse(true); brSel = { genre: null, artist: s.artist, album: s.album }; render(); ctx.replaceUrl(jbAlbumUrl(s), s.album + ' - Jukebox'); } },
      { label: 'Show in Folder', act: () => ctx.go(s.d.ftp.replace(/[^/]*$/, '')) }, { label: 'Download Song', act: async () => { try { ctx.download(s.d.name, await ctx.blob(s.d)); } catch (er) { toast(er.message); } } },
      src.kind === 'playlist' || src.kind === 'now' ? { sep: 1 } : null,
      src.kind === 'playlist' ? { label: 'Remove from Playlist', key: 'Del', act: () => removeSelected() } : null,
      src.kind === 'now' ? { label: 'Remove from Now Playing', key: 'Del', act: () => removeSelected() } : null
    ];
    appPopup(ctx, e.clientX, e.clientY, items);
  });
  // dragging songs
  let dragFrom = null;
  body.addEventListener('dragstart', e => {
    const i = rowAt(e);
    if (i < 0) return;
    if (!selKeys.has(rows[i].key)) selectIdx(i);
    const paths = selPaths();
    dragFrom = { src: src.kind + ':' + (src.id || ''), idx: selRows().map(r => r.pos) };
    e.dataTransfer.setData(DT, JSON.stringify(paths));
    e.dataTransfer.setData('text/plain', selRows().map(r => r.s.d.url).join('\n'));
    e.dataTransfer.effectAllowed = 'copyMove';
  });
  body.addEventListener('dragend', () => { dragFrom = null; for (const x of body.querySelectorAll('.drop')) x.classList.remove('drop'); });
  const canReorder = () => (src.kind === 'playlist' || src.kind === 'now') && sortOf()[0] === 'num' && sortOf()[1] === 1 && !search && !V.browse;
  list.addEventListener('dragover', e => {
    if (!e.dataTransfer.types.includes(DT) || !(src.kind === 'playlist' || src.kind === 'now')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = dragFrom && dragFrom.src === src.kind + ':' + (src.id || '') ? 'move' : 'copy';
    for (const x of body.querySelectorAll('.drop')) x.classList.remove('drop');
    const r = e.target.closest('.jr');
    if (r && canReorder()) r.classList.add('drop');
  });
  list.addEventListener('drop', e => {
    if (!e.dataTransfer.types.includes(DT) || !(src.kind === 'playlist' || src.kind === 'now')) return;
    e.preventDefault();
    const r = e.target.closest('.jr');
    const at = r && canReorder() ? rows[+r.dataset.i].pos : (src.kind === 'now' ? Player.queue.length : (S.playlists.find(p => p.id === src.id) || { paths: [] }).paths.length);
    const same = dragFrom && dragFrom.src === src.kind + ':' + (src.id || '');
    let paths = [];
    try { paths = JSON.parse(e.dataTransfer.getData(DT) || '[]'); } catch (er) { return; }
    if (src.kind === 'now') {
      if (same) Player.move(dragFrom.idx, at);
      else { Player.enqueue(paths); if (at < Player.queue.length - paths.length) Player.move(paths.map((_, k) => Player.queue.length - paths.length + k), at); }
    } else {
      const pl = S.playlists.find(p => p.id === src.id);
      if (!pl) return;
      if (same) {
        const set = new Set(dragFrom.idx), moving = pl.paths.filter((_, k) => set.has(k)), rest = pl.paths.filter((_, k) => !set.has(k));
        rest.splice(pl.paths.slice(0, at).filter((_, k) => !set.has(k)).length, 0, ...moving);
        pl.paths = rest;
      } else pl.paths.splice(at, 0, ...paths);
      saveState();
    }
    selKeys.clear();
    render(); renderSources();
  });
  async function removeSelected() {
    const sel = selRows();
    if (!sel.length) return;
    if (src.kind === 'now') { Player.remove(sel.map(r => r.pos)); return; }
    if (src.kind === 'playlist') {
      const pl = S.playlists.find(p => p.id === src.id);
      const kill = new Set(sel.map(r => r.pos));
      pl.paths = pl.paths.filter((_, k) => !kill.has(k));
      saveState(); selKeys.clear(); render(); renderSources();
      return;
    }
    toast('Songs stay in your folders. To leave one out, untick its box.');
  }
  /* ---------- header: sort & resize ---------- */
  hdr.addEventListener('pointerdown', e => {
    const rz = e.target.dataset.rz;
    if (rz) {
      e.preventDefault();
      const x0 = e.clientX, w0 = colW(rz);
      const mv = ev => { V.widths[rz] = clamp(w0 + ev.clientX - x0, 24, 600); layoutColsOnly(); };
      const up = () => { win.removeEventListener('pointermove', mv); win.removeEventListener('pointerup', up); saveView(); paint(true); };
      win.addEventListener('pointermove', mv); win.addEventListener('pointerup', up);
      return;
    }
    const sp = e.target.closest('span[data-c]');
    if (!sp || e.button !== 0) return;
    const c = sp.dataset.c;
    if (c === 'play' && src.kind !== 'library') return;
    const [col, dir] = sortOf();
    setSort(c, col === c ? -dir : 1);
    render();
  });
  hdr.addEventListener('contextmenu', e => {
    e.preventDefault();
    appPopup(ctx, e.clientX, e.clientY, JB_OPTIONAL.map(c => ({ label: JB_COLS[c].label, check: () => V.cols.includes(c), act: () => { if (V.cols.includes(c)) V.cols = V.cols.filter(x => x !== c); else { const order = ['title', 'time', 'artist', 'album'].concat(JB_OPTIONAL); V.cols = order.filter(x => x === c || V.cols.includes(x)); } saveView(); render(); } })).concat([{ sep: 1 }, { label: 'Reset Columns', act: () => { V.cols = JB_DEFAULT_COLS.slice(); V.widths = {}; saveView(); render(); } }]));
  });
  function layoutColsOnly() { list.style.setProperty('--cols', visibleCols().map(c => colW(c) + 'px').join(' ') + ' minmax(0,1fr)'); }
  list.addEventListener('scroll', () => paint(), { passive: true });
  ctx.on(win, 'resize', debounce(() => paint(true), 80));
  /* ---------- browser ---------- */
  function setBrowse(on) {
    V.browse = !!on; brBox.hidden = !V.browse; browseBtn.classList.toggle('on', V.browse);
    if (!on) brSel = { genre: null, artist: null, album: null };
    saveView(); render();
  }
  for (const c of brCols) {
    c.l.addEventListener('mousedown', e => {
      const it = e.target.closest('div[data-v]');
      if (!it) return;
      const v = it.dataset.x ? it.dataset.v : null;
      brSel[c.k] = v;
      if (c.k === 'genre') { brSel.artist = null; brSel.album = null; }
      if (c.k === 'artist') brSel.album = null;
      selKeys.clear(); list.scrollTop = 0;
      render();
      if (c.k !== 'genre' && v != null) {
        const s = rows[0] && rows[0].s;
        if (s && c.k === 'album') ctx.replaceUrl(jbAlbumUrl(s), s.album + ' - Jukebox');
        else if (s && c.k === 'artist') ctx.replaceUrl(jbArtistUrl(s), s.artist + ' - Jukebox');
      }
    });
    c.l.addEventListener('dblclick', e => { if (e.target.closest('div[data-v]') && rows.length) playRow(0); });
  }
  browseBtn.classList.toggle('on', V.browse);
  /* ---------- search ---------- */
  searchIn.addEventListener('input', debounce(() => { search = searchIn.value.trim(); selKeys.clear(); list.scrollTop = 0; render(); }, 120));
  searchIn.addEventListener('keydown', e => { if (e.key === 'Enter' && rows.length) { e.preventDefault(); selectIdx(0); list.focus(); } if (e.key === 'Escape') { searchIn.value = ''; search = ''; render(); } e.stopPropagation(); });
  /* ---------- LCD ---------- */
  let rot = 0, showTotal = false;
  function updateLcd() {
    const d = Player.current();
    const has = !!d;
    lcd.idle.hidden = has;
    lcdBox.querySelector('.mid').style.visibility = has ? '' : 'hidden';
    playBtn.innerHTML = Player.playing() ? JB_SVG.pause : JB_SVG.play;
    if (!has) return;
    const s = songInfo(d);
    lcd.l1.textContent = s.title;
    const lines = [s.artist, s.album].filter(x => x && !/^Unknown/.test(x));
    lcd.l2.textContent = Player.error() ? '⚠ ' + Player.error() : lines.length ? lines[rot % lines.length] : '';
    updateTime();
  }
  function updateTime() {
    const t = Player.time(), dd = Player.duration();
    lcd.el.textContent = fmtTime(t);
    lcd.rem.textContent = showTotal ? fmtTime(dd) : '-' + fmtTime(Math.max(0, dd - t));
    const f = dd > 0 ? clamp(t / dd, 0, 1) : 0;
    lcd.fill.style.width = f * 100 + '%';
    lcd.dia.style.left = f * 100 + '%';
  }
  lcd.rem.addEventListener('click', () => { showTotal = !showTotal; updateTime(); });
  ctx.every(4000, () => { rot++; if (lcd.l2.style) { lcd.l2.style.opacity = '0'; ctx.after(300, () => { updateLcd(); lcd.l2.style.opacity = '1'; }); } });
  lcd.bar.addEventListener('pointerdown', e => {
    const seekTo = ev => { const r = lcd.bar.getBoundingClientRect(); Player.seek(clamp((ev.clientX - r.left) / r.width, 0, 1) * Player.duration()); };
    seekTo(e);
    const up = () => { win.removeEventListener('pointermove', seekTo); win.removeEventListener('pointerup', up); };
    win.addEventListener('pointermove', seekTo); win.addEventListener('pointerup', up);
  });
  /* ---------- art ---------- */
  let artFor = null;
  async function updateArt() {
    if (!V.art) return;
    artHead.textContent = V.artNow ? 'Now Playing' : 'Selected Song';
    const s = V.artNow ? (Player.current() ? songInfo(Player.current()) : null) : (selRows()[0] || {}).s || null;
    const key = s ? s.path : '';
    if (key === artFor && artImg.firstChild) return;
    artFor = key;
    if (!s) { artImg.innerHTML = '<div class="ph">' + (V.artNow ? 'Nothing Playing' : 'No Song Selected') + '</div>'; return; }
    const url = await artURL(s.d) || S.thumbs.get('art:' + albumKey(s.artist, s.album));
    if (artFor !== key) return;
    if (url) { artImg.replaceChildren(h('img', { src: url, alt: s.album + ' artwork' })); }
    else artImg.innerHTML = '<div class="ph"><div>' + JB_SVG.note.replace('rgba(255,255,255,.85)', '#a9b6c9') + '<br>Drag album art here</div></div>';
  }
  artHead.addEventListener('click', () => { V.artNow = !V.artNow; artFor = null; saveView(); updateArt(); });
  artImg.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); artImg.classList.add('drop'); } });
  artImg.addEventListener('dragleave', () => artImg.classList.remove('drop'));
  artImg.addEventListener('drop', async e => {
    artImg.classList.remove('drop');
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (!f || !/^image\//.test(f.type)) return;
    e.preventDefault();
    const s = V.artNow ? (Player.current() ? songInfo(Player.current()) : null) : (selRows()[0] || {}).s;
    if (!s) return;
    try {
      const data = await imageThumb(f, 400, 0.88);
      const key = 'art:' + (s.artKey || albumKey(s.artist, s.album));
      S.thumbs.set(key, data); DB.put('thumbs', { path: key, data, mtime: Date.now() });
      artCache.clear(); artFor = null; updateArt();
      toast('Artwork set for ' + s.album);
    } catch (er) { toast(er.message); }
  });
  /* ---------- player events ---------- */
  ctx.cleanup(Player.on(t => {
    if (!ctx.alive()) return;
    if (t === 'time') { updateTime(); if (Player.error()) updateLcd(); return; }
    if (t === 'track' || t === 'state' || t === 'error' || t === 'blocked') { updateLcd(); if (t !== 'state') { paint(true); if (V.artNow) { artFor = null; updateArt(); } } if (t === 'blocked') toast('Click Play to start the music.'); }
    if (t === 'queue') { renderSources(); if (src.kind === 'now') render(); }
    if (t === 'stats') { const keep = list.scrollTop; lib = allSongs(); byPath = libByPath(); if (src.kind === 'smart' || src.kind === 'library' || src.kind === 'playlist' || src.kind === 'now') { compute(); body.style.height = rows.length * ROW + 'px'; list.scrollTop = keep; paint(true); updateStat(); } }
    if (t === 'mode') syncModes();
    if (t === 'volume') vol.value = String(S.prefs.vol);
    if (t === 'eq') syncEq();
  }));
  function syncModes() {
    shuffleBtn.classList.toggle('on', !!S.prefs.shuffle);
    const r = S.prefs.repeat || 'off';
    repeatBtn.classList.toggle('on', r !== 'off');
    repeatBtn.title = 'Repeat: ' + (r === 'one' ? 'one song' : r === 'all' ? 'all' : 'off');
    repeatBtn.innerHTML = JB_SVG.repeat + (r === 'one' ? '<span class="badge">1</span>' : '');
  }
  /* ---------- keyboard ---------- */
  let typed = '', typedAt = 0;
  ctx.on(doc, 'keydown', e => {
    const t = e.target, editing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
    const mod = e.ctrlKey || e.metaKey, k = e.key;
    if (doc.querySelector('.jb-sheet-bg')) return;
    if (mod && k.toLowerCase() === 'f') { e.preventDefault(); searchIn.focus(); searchIn.select(); return; }
    if (editing) return;
    if (mod && k.toLowerCase() === 'n') { e.preventDefault(); newPlaylist(e.shiftKey ? selPaths() : null); return; }
    if (mod && k.toLowerCase() === 'i') { e.preventDefault(); getInfo(); return; }
    if (mod && k.toLowerCase() === 'b') { e.preventDefault(); setBrowse(!V.browse); return; }
    if (mod && k.toLowerCase() === 't') { e.preventDefault(); setVis(!visOn); return; }
    if (mod && k.toLowerCase() === 'g') { e.preventDefault(); artBtn.click(); return; }
    if (mod && k.toLowerCase() === 'a' && (doc.activeElement === list || doc.activeElement === doc.body)) { e.preventDefault(); for (const r of rows) selKeys.add(r.key); restyle(); return; }
    if (mod && k === 'ArrowUp') { e.preventDefault(); Player.setVolume((S.prefs.vol || 0) + 0.1); return; }
    if (mod && k === 'ArrowDown') { e.preventDefault(); Player.setVolume((S.prefs.vol || 0) - 0.1); return; }
    if (mod && k === 'ArrowRight') { e.preventDefault(); Player.next(); return; }
    if (mod && k === 'ArrowLeft') { e.preventDefault(); Player.prev(); return; }
    if (k === ' ') { e.preventDefault(); Player.toggle(); return; }
    if (visOn && k === 'Escape') { setVis(false); return; }
    const inList = doc.activeElement === list || doc.activeElement === doc.body;
    if (k === 'Enter' && inList) { e.preventDefault(); const r = selRows()[0]; if (r) playRow(rows.indexOf(r)); return; }
    if ((k === 'Delete' || k === 'Backspace') && inList) { e.preventDefault(); removeSelected(); return; }
    if (inList && (k === 'ArrowDown' || k === 'ArrowUp' || k === 'PageDown' || k === 'PageUp' || k === 'Home' || k === 'End')) {
      e.preventDefault();
      if (!rows.length) return;
      const page = Math.max(1, Math.floor((list.clientHeight - 18) / ROW) - 1);
      const cur = lastClick >= 0 ? lastClick : -1;
      const ni = clamp(k === 'ArrowDown' ? cur + 1 : k === 'ArrowUp' ? cur - 1 : k === 'PageDown' ? cur + page : k === 'PageUp' ? cur - page : k === 'Home' ? 0 : rows.length - 1, 0, rows.length - 1);
      selectIdx(ni, e.shiftKey ? 'range' : null);
      if (e.shiftKey) lastClick = ni;
      scrollToRow(ni);
      return;
    }
    if (k === 'ArrowRight' && !mod && inList) { e.preventDefault(); Player.next(); return; }
    if (k === 'ArrowLeft' && !mod && inList) { e.preventDefault(); Player.prev(); return; }
    if (inList && k.length === 1 && !mod && !e.altKey && /\S/.test(k)) {
      const now = Date.now();
      typed = now - typedAt > 900 ? k.toLowerCase() : typed + k.toLowerCase();
      typedAt = now;
      const col = sortOf()[0], val = r => String(col === 'album' ? r.s.album : col === 'artist' ? sortArtist(r.s.artist) : col === 'genre' ? r.s.genre : r.s.title).toLowerCase();
      const i = rows.findIndex(r => val(r).startsWith(typed));
      if (i >= 0) { selectIdx(i); scrollToRow(i); }
    }
  });
  /* ---------- sheets (Get Info, confirmations) ---------- */
  function sheet(title, content, buttons, extraLeft) {
    return new Promise(res => {
      const box = h('div', { class: 'jb-sheet', role: 'dialog', 'aria-label': title }, title ? h('h3', { text: title }) : null, content);
      const bar = h('div', { class: 'btns' }, extraLeft ? h('div', { class: 'left' }, ...extraLeft) : null);
      const bg = h('div', { class: 'jb-sheet-bg' }, box);
      const close = v => { bg.remove(); doc.removeEventListener('keydown', key, true); res(v); };
      for (const b of buttons) { const el2 = h('button', { class: 'jb-pill' + (b.def ? ' def' : ''), type: 'button', text: b.label }); el2.addEventListener('click', () => { if (b.act && b.act() === false) return; close(b.value); }); bar.append(el2); }
      box.append(bar);
      const key = e => { if (e.key === 'Escape') { e.preventDefault(); close(null); } else if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { const d = buttons.find(b => b.def); if (d) { e.preventDefault(); if (d.act && d.act() === false) return; close(d.value); } } };
      doc.addEventListener('keydown', key, true);
      ctx.root.append(bg);
      setTimeout(() => { const f = box.querySelector('input,textarea,.jb-pill.def'); if (f) f.focus(); }, 20);
      sheet.close = close;
    });
  }
  const confirmSheet = (q, sub, okLabel) => sheet('', h('div', {}, h('p', { style: { fontWeight: 'bold', margin: '0 0 6px' }, text: q }), sub ? h('p', { style: { margin: 0, fontSize: '11px' }, text: sub }) : null), [{ label: 'Cancel', value: false }, { label: okLabel || 'OK', value: true, def: true }]);
  async function getInfo(start) {
    let sel = selRows();
    if (!sel.length && rows.length) { selectIdx(0); sel = selRows(); }
    if (!sel.length) return;
    if (sel.length > 1 && start == null) return multiInfo(sel);
    let i = start != null ? start : rows.indexOf(sel[0]);
    const r = rows[i], s = r.s, d = s.d;
    const f = {};
    const field = (k, label, val, wide, type) => { f[k] = h(type === 'area' ? 'textarea' : 'input', { value: val == null ? '' : String(val), 'aria-label': label, rows: type === 'area' ? '2' : null }); if (type === 'area') f[k].value = val || ''; return [h('label', { text: label }), wide ? h('div', { class: 'wide' }, f[k]) : f[k]]; };
    f.title = null;
    const cover = h('div', { class: 'cov' });
    artURL(d).then(u => { if (u) cover.replaceChildren(h('img', { src: u, alt: '' })); else cover.innerHTML = JB_SVG.note.replace('rgba(255,255,255,.85)', '#999'); });
    let rating = s.rating;
    const st = h('span', { class: 'jb-stars', role: 'slider', 'aria-label': 'My rating', tabindex: '0' });
    const drawStars = () => { st.innerHTML = [1, 2, 3, 4, 5].map(n => (n <= rating ? '★' : '☆')).join(''); st.setAttribute('aria-valuenow', rating); };
    drawStars();
    st.addEventListener('click', e => { const rc = st.getBoundingClientRect(); const n = clamp(Math.ceil(((e.clientX - rc.left) / rc.width) * 5), 0, 5); rating = rating === n ? n - 1 : n; drawStars(); });
    const fmtHz = s.sampleRate ? (s.sampleRate / 1000).toFixed(1) + ' kHz' : '';
    const sum = h('div', { class: 'sum' }, cover, h('table', {}, ...[
      ['Kind', AUDIO_KIND[d.ext] || d.ext], ['Size', fmtBytes(d.size || 0)], ['Length', s.duration ? fmtTime(s.duration) : '—'], ['Bit Rate', s.bitrate ? s.bitrate + ' kbps' : '—'], ['Sample Rate', fmtHz || '—'],
      ['Date Modified', fmtDate(d.mtime, true)], ['Play Count', String(s.plays || 0)], ['Last Played', s.last ? fmtDate(s.last, true) : '—'], ['Where', d.path], ['Web Address', d.url], ['FTP', d.ftp]
    ].map(([a, b]) => h('tr', {}, h('td', { text: a + ':' }), h('td', { text: b })))));
    const info = h('div', { class: 'fg' }, ...field('title', 'Name', s.title, true), ...field('artist', 'Artist', s.artist, true), ...field('album', 'Album', s.album, true),
      ...field('genre', 'Genre', s.genre), ...field('year', 'Year', s.year), ...field('track', 'Track #', s.track || ''), h('label', { text: 'My Rating' }), st,
      ...field('comment', 'Comments', s.comment, true, 'area'));
    info.hidden = true;
    const tb = h('div', { class: 'tabsx' }, h('button', { type: 'button', class: 'on', text: 'Summary' }), h('button', { type: 'button', text: 'Info' }));
    tb.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; for (const x of tb.children) x.classList.toggle('on', x === b); sum.hidden = b.textContent !== 'Summary'; info.hidden = !sum.hidden; if (!info.hidden) f.title.focus(); });
    const apply = () => {
      const m = d.meta || {}, x = songStats(d.path), e2 = {};
      const want = { title: f.title.value.trim(), artist: f.artist.value.trim(), album: f.album.value.trim(), genre: f.genre.value.trim(), year: f.year.value.trim(), track: f.track.value.trim(), comment: f.comment.value.trim() };
      const orig = { title: m.title || d.name, artist: m.artist || 'Unknown Artist', album: m.album || 'Unknown Album', genre: m.genre || '', year: m.year || '', track: String(m.track || ''), comment: '' };
      for (const k in want) if (want[k] !== orig[k] && !(k === 'track' && +want[k] === +orig[k])) e2[k] = want[k];
      if (Object.keys(e2).length) x.edit = e2; else delete x.edit;
      if (rating !== s.rating) x.rating = rating;
      saveState();
      lib = allSongs(); byPath = libByPath(); render(); updateLcd();
    };
    const nav = dir => { apply(); sheet.close('nav'); const ni = clamp(i + dir, 0, rows.length - 1); selectIdx(ni); scrollToRow(ni); setTimeout(() => getInfo(ni), 30); };
    const prevB = h('button', { class: 'jb-pill', type: 'button', text: 'Previous', disabled: i <= 0 }), nextB = h('button', { class: 'jb-pill', type: 'button', text: 'Next', disabled: i >= rows.length - 1 });
    prevB.addEventListener('click', () => nav(-1)); nextB.addEventListener('click', () => nav(1));
    await sheet(s.title, h('div', {}, tb, sum, info), [{ label: 'Cancel', value: null }, { label: 'OK', def: true, value: 'ok', act: () => { apply(); } }], [prevB, nextB]);
  }
  async function multiInfo(sel) {
    const f = {};
    const common = k => { const v = sel[0].s[k]; return sel.every(r => r.s[k] === v) ? v : ''; };
    const field = (k, label) => { f[k] = h('input', { value: String(common(k) || ''), placeholder: common(k) === '' && sel.some(r => r.s[k]) ? 'Mixed' : '', 'aria-label': label }); return [h('label', { text: label }), h('div', { class: 'wide' }, f[k])]; };
    let rating = common('rating') || 0;
    const st = h('span', { class: 'jb-stars' });
    const draw = () => { st.innerHTML = [1, 2, 3, 4, 5].map(n => (n <= rating ? '★' : '☆')).join(''); };
    draw();
    let rTouched = false;
    st.addEventListener('click', e => { const rc = st.getBoundingClientRect(); rating = clamp(Math.ceil(((e.clientX - rc.left) / rc.width) * 5), 0, 5); rTouched = true; draw(); });
    const box = h('div', { class: 'fg' }, ...field('artist', 'Artist'), ...field('album', 'Album'), ...field('genre', 'Genre'), ...field('year', 'Year'), h('label', { text: 'My Rating' }), st);
    const ok = await sheet('Multiple Song Information (' + sel.length + ' songs)', box, [{ label: 'Cancel', value: false }, { label: 'OK', value: true, def: true }]);
    if (!ok) return;
    for (const r of sel) {
      const x = songStats(r.s.path), e2 = Object.assign({}, x.edit || {});
      for (const k of ['artist', 'album', 'genre', 'year']) { const v = f[k].value.trim(); if (v && v !== String(common(k) || '')) e2[k] = v; }
      if (Object.keys(e2).length) x.edit = e2;
      if (rTouched) x.rating = rating;
    }
    saveState(); lib = allSongs(); byPath = libByPath(); render();
  }
  /* ---------- toast ---------- */
  let toastT = null;
  function toast(msg) {
    lcd.l2.textContent = msg; lcd.idle.hidden = true; lcdBox.querySelector('.mid').style.visibility = '';
    if (!Player.current()) { lcd.l1.textContent = 'LANscape Jukebox'; }
    clearTimeout(toastT); toastT = setTimeout(() => { if (ctx.alive()) updateLcd(); }, 2600);
  }
  /* ---------- export & burn ---------- */
  const relName = d => d.path.split('/').slice(1).join('/');
  function m3uText(list) {
    return '#EXTM3U\n' + list.map(r => '#EXTINF:' + Math.round(r.s.duration || -1) + ',' + r.s.artist + ' - ' + r.s.title + '\n' + relName(r.s.d)).join('\n') + '\n';
  }
  const listName = () => (src.kind === 'playlist' ? (S.playlists.find(p => p.id === src.id) || {}).name : src.kind === 'smart' ? (JB_SMART.find(p => p.id === src.id) || {}).name : src.kind === 'now' ? 'Now Playing' : 'Library') || 'Playlist';
  function exportM3U() { ctx.download(listName() + '.m3u', new Blob([m3uText(rows)], { type: 'audio/x-mpegurl' })); }
  async function burn() {
    const list2 = selKeys.size > 1 ? selRows() : rows;
    if (!list2.length) { toast('Nothing to burn. Pick a playlist first.'); return; }
    const bytes = list2.reduce((a, r) => a + (r.s.d.size || 0), 0), CD = 700 * 1048576;
    if (bytes > CD) { await sheet('This disc is full', h('p', { text: 'These ' + list2.length + ' songs need ' + fmtBytes(bytes) + ', but a CD holds 700 MB. Pick fewer songs (select some first) or make a smaller playlist.' }), [{ label: 'OK', def: true }]); return; }
    const ok = await confirmSheet('Burn “' + listName() + '”?', list2.length + ' songs, ' + fmtTotal(list2.reduce((a, r) => a + (r.s.duration || 0), 0)) + ', ' + fmtBytes(bytes) + '. LANscape writes them to a ZIP “disc” with an .m3u playlist.', 'Burn');
    if (!ok) return;
    const files = [], burned = [];
    let k = 0;
    for (const r of list2) {
      k++;
      lcd.l1.textContent = 'Burning disc...'; lcd.l2.textContent = 'Track ' + k + ' of ' + list2.length + ': ' + r.s.title; lcd.fill.style.width = (k / list2.length) * 100 + '%';
      try {
        const name = pad(burned.length + 1, 2) + ' ' + r.s.d.name.replace(/[\\/:*?"<>|]/g, '_');
        files.push({ name, data: new Uint8Array(await (await ctx.blob(r.s.d)).arrayBuffer()), store: true });
        burned.push({ name, r });
      } catch (e) { /* skip unreadable songs */ }
      await sleep(30);
    }
    files.push({ name: listName().replace(/[\\/:*?"<>|]/g, '_') + '.m3u', data: '#EXTM3U\n' + burned.map(x => '#EXTINF:' + Math.round(x.r.s.duration || -1) + ',' + x.r.s.artist + ' - ' + x.r.s.title + '\n' + x.name).join('\n') + '\n' });
    const zip = await zipWrite(files);
    ctx.download(listName().replace(/[\\/:*?"<>|]/g, '_') + '.zip', zip);
    toast('Disc burned: ' + (files.length - 1) + ' songs');
    updateLcd();
  }
  /* ---------- equalizer panel ---------- */
  let eqPanel = null;
  function vslider(val, onInput, title) {
    const s = h('div', { class: 'vsl', role: 'slider', 'aria-label': title, tabindex: '0', 'aria-valuemin': '-12', 'aria-valuemax': '12' });
    const thumb = h('b');
    s.append(thumb);
    const set = v => { s._v = clamp(v, -12, 12); thumb.style.top = (4 + (1 - (s._v + 12) / 24) * 102) + 'px'; s.setAttribute('aria-valuenow', s._v.toFixed(1)); s.title = title + ': ' + (s._v > 0 ? '+' : '') + s._v.toFixed(1) + ' dB'; };
    set(val);
    const from = e => { const r = s.getBoundingClientRect(); return 12 - clamp((e.clientY - r.top - 4) / (r.height - 8), 0, 1) * 24; };
    s.addEventListener('pointerdown', e => { s.setPointerCapture(e.pointerId); const v = Math.abs(from(e)) < 0.7 ? 0 : from(e); set(v); onInput(s._v); const mv = ev => { const v2 = from(ev); set(Math.abs(v2) < 0.7 ? 0 : v2); onInput(s._v); }; s.addEventListener('pointermove', mv); s.addEventListener('pointerup', () => s.removeEventListener('pointermove', mv), { once: true }); });
    s.addEventListener('keydown', e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); set(s._v + (e.key === 'ArrowUp' ? 1 : -1)); onInput(s._v); } });
    s.set = set;
    return s;
  }
  function toggleEq() {
    if (eqPanel) { eqPanel.remove(); eqPanel = null; eqBtn.classList.remove('on'); return; }
    const on = h('input', { type: 'checkbox', id: 'jbEqOn' });
    const pre = h('select', { 'aria-label': 'Preset' }, h('option', { value: '', text: 'Manual' }), ...Object.keys(EQ_PRESETS).map(n => h('option', { value: n, text: n })));
    on.addEventListener('change', () => Player.eq.setOn(on.checked));
    pre.addEventListener('change', () => { if (pre.value) Player.eq.load(pre.value); });
    const preS = vslider(Player.eq.pre(), v => Player.eq.setPre(v), 'Preamp');
    const bands = EQ_FREQS.map((f, i) => vslider(Player.eq.bands()[i], v => Player.eq.setBand(i, v), EQ_LABELS[i] + ' Hz'));
    eqPanel = h('div', { class: 'jb-eq', role: 'dialog', 'aria-label': 'Equalizer' },
      h('div', { class: 't' }, h('button', { type: 'button', title: 'Close', 'aria-label': 'Close equalizer', onclick: () => toggleEq() }), 'Equalizer'),
      h('div', { class: 'row1' }, h('label', { for: 'jbEqOn' }, on, ' On'), pre),
      h('div', { class: 'sl' }, h('div', { class: 'band' }, preS, 'Preamp'), h('div', { class: 'scale' }, h('span', { text: '+12 dB' }), h('span', { text: '0 dB' }), h('span', { text: '-12 dB' })), ...bands.map((b, i) => h('div', { class: 'band' }, b, EQ_LABELS[i]))));
    eqPanel._sync = () => { on.checked = Player.eq.on(); pre.value = Player.eq.preset() || ''; preS.set(Player.eq.pre()); const bb = Player.eq.bands(); bands.forEach((b, i) => b.set(bb[i])); };
    eqPanel._sync();
    ctx.root.append(eqPanel);
    eqBtn.classList.add('on');
  }
  function syncEq() { if (eqPanel) eqPanel._sync(); }
  /* ---------- visualizer ---------- */
  let visOn = false, visRaf = 0, visBox = null;
  function setVis(on) {
    visOn = !!on;
    visBtn.classList.toggle('on', visOn);
    V.vis = visOn; saveView();
    if (!visOn) { if (visBox) visBox.remove(); visBox = null; win.cancelAnimationFrame(visRaf); return; }
    const cv = h('canvas'), back = doc.createElement('canvas');
    visBox = h('div', { class: 'jb-vis', title: 'Click or press Esc to close the visualizer' }, cv);
    visBox.addEventListener('click', () => setVis(false));
    main.append(visBox);
    const c = cv.getContext('2d'), b = back.getContext('2d');
    const wave = new Uint8Array(1024), spec = new Uint8Array(1024);
    let t = 0, hue = Math.random() * 360, lastTrack = null, trackAt = 0;
    const frame = () => {
      if (!ctx.alive() || !visBox) return;
      const W = cv.clientWidth, H = cv.clientHeight, dpr = Math.min(win.devicePixelRatio || 1, 1.5);
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = back.width = Math.max(2, Math.round(W * dpr)); cv.height = back.height = Math.max(2, Math.round(H * dpr)); }
      const w = cv.width, hgt = cv.height;
      const real = Player.wave(wave);
      Player.spectrum(spec);
      t += 1;
      if (!real) for (let i = 0; i < wave.length; i++) wave[i] = 128 + Math.sin(i / 37 + t / 23) * 30 * Math.sin(t / 61) + Math.sin(i / 11 + t / 7) * 8;
      let bass = 0; for (let i = 2; i < 24; i++) bass += real ? spec[i] : 90; bass /= 22 * 255;
      hue = (hue + 0.6 + bass * 2) % 360;
      // feedback: zoom and twist the last frame
      b.globalCompositeOperation = 'copy'; b.drawImage(cv, 0, 0);
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(0, 0, w, hgt);
      c.save(); c.globalAlpha = 0.9; c.translate(w / 2, hgt / 2); c.rotate(0.006 + bass * 0.01); const z = 1.018 + bass * 0.03; c.scale(z, z); c.drawImage(back, -w / 2, -hgt / 2); c.restore();
      c.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 3; k++) {
        c.beginPath();
        const rad = Math.min(w, hgt) * (0.16 + k * 0.07 + bass * 0.12);
        for (let i = 0; i <= 256; i++) {
          const v = (wave[(i * 4 + k * 37) % wave.length] - 128) / 128;
          const a = (i / 256) * Math.PI * 2 + t / (90 - k * 20);
          const r2 = rad * (1 + v * (0.55 + bass));
          const x = w / 2 + Math.cos(a) * r2, y = hgt / 2 + Math.sin(a) * r2 * (0.75 + k * 0.1);
          if (i) c.lineTo(x, y); else c.moveTo(x, y);
        }
        c.strokeStyle = 'hsla(' + ((hue + k * 70) % 360) + ',100%,' + (55 + k * 8) + '%,0.75)';
        c.lineWidth = (1.5 + k) * dpr;
        c.shadowColor = c.strokeStyle; c.shadowBlur = 14 * dpr;
        c.stroke();
      }
      c.shadowBlur = 0;
      // the song's name, like the old visualizers did at the start of a song
      const cur = Player.currentPath();
      if (cur !== lastTrack) { lastTrack = cur; trackAt = t; }
      if (cur && t - trackAt < 300) {
        const s = songInfo(Player.current()), a = Math.min(1, (t - trackAt) / 30, (300 - (t - trackAt)) / 40);
        c.globalCompositeOperation = 'source-over';
        c.fillStyle = 'rgba(255,255,255,' + a.toFixed(2) + ')';
        c.font = 'bold ' + Math.round(18 * dpr) + 'px "Lucida Grande",sans-serif';
        c.fillText(s.title, 20 * dpr, hgt - 46 * dpr);
        c.font = Math.round(13 * dpr) + 'px "Lucida Grande",sans-serif';
        c.fillText([s.artist, s.album].filter(x => !/^Unknown/.test(x)).join(' — '), 20 * dpr, hgt - 24 * dpr);
      }
      visRaf = win.requestAnimationFrame(frame);
    };
    visRaf = win.requestAnimationFrame(frame);
  }
  ctx.cleanup(() => { win.cancelAnimationFrame(visRaf); });
  /* ---------- go ---------- */
  if (route.playlist && S.playlists.some(p => p.id === route.playlist)) src = { kind: 'playlist', id: route.playlist };
  else if (route.smart && JB_SMART.some(p => p.id === route.smart)) src = { kind: 'smart', id: route.smart };
  else if (route.now) src = { kind: 'now', id: '' };
  else if (route.album || route.artist || route.genre || route.song || route.q != null || ctx.url === JB_HOST + '/') src = { kind: 'library', id: '' };
  if (route.q != null) { search = route.q; searchIn.value = route.q; }
  if (route.album || route.artist || route.genre) {
    const pick = lib.find(s => (route.album && albumKey(s.artist, s.album) === route.album) || (route.artist && slug(s.artist) === route.artist) || (route.genre && slug(s.genre) === route.genre));
    if (pick) { V.browse = true; brBox.hidden = false; browseBtn.classList.add('on'); brSel = { genre: route.genre ? pick.genre || '' : null, artist: route.album || route.artist ? pick.artist : null, album: route.album ? pick.album : null }; }
  }
  renderSources();
  syncModes();
  render();
  updateLcd();
  if (V.vis) setVis(true);
  if (route.song) {
    const i = rows.findIndex(r => r.s.path === route.song);
    if (i >= 0) { selectIdx(i); ctx.after(30, () => { list.scrollTop = Math.max(0, i * ROW - list.clientHeight / 3); paint(); }); }
    if (Player.currentPath() !== route.song) { if (i >= 0) playRow(i); else Player.playPaths([route.song]); }
  }
  list.focus({ preventScroll: true });
  return { title: route.song ? songInfo(S.docs.get(route.song)).title + ' - Jukebox' : srcTitle() };
}
