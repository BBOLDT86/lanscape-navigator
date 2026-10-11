/* ===================================================================
   LANamp: a floating mini player in the 1998 style (an original
   gunmetal skin). Main window with LED time and a spectrum/scope,
   a 10-band equalizer, and a playlist editor. Lives in the browser
   shell, on top of whatever page you're looking at.
   =================================================================== */
const LANAMP_CSS = `.la{position:fixed;z-index:58;width:275px;user-select:none;-webkit-user-select:none;font:9px/1 Tahoma,Verdana,"DejaVu Sans",sans-serif;color:#cfd6e0;filter:drop-shadow(2px 3px 0 rgba(0,0,0,.35));touch-action:none}
.la[hidden]{display:none}
.la *{box-sizing:border-box}
.la-win{position:relative;background:linear-gradient(#3b4049,#262a31 60%,#1e2127);border:1px solid #0b0c0e;box-shadow:inset 1px 1px rgba(255,255,255,.18),inset -1px -1px rgba(0,0,0,.6)}
.la-win+.la-win{border-top:0}
.la-win[hidden]{display:none}
.la-tb{height:14px;display:flex;align-items:center;gap:3px;padding:0 3px;cursor:move;background:repeating-linear-gradient(#2a2e35 0 1px,#454b55 1px 2px);border-bottom:1px solid #0b0c0e}
.la:focus-within .la-tb,.la.act .la-tb{background:repeating-linear-gradient(#2d3c52 0 1px,#5470a0 1px 2px)}
.la-tb .t{flex:1;text-align:center;font:bold 8px/14px Tahoma,Verdana,sans-serif;letter-spacing:2px;color:#e5ebf3;text-shadow:0 1px 0 #000;white-space:nowrap;overflow:hidden}
.la-tb .t span{background:#30353d;padding:0 5px;box-shadow:0 0 0 1px #20242a}
.la:focus-within .la-tb .t span,.la.act .la-tb .t span{background:#33445e}
.la-tb button{width:9px;height:9px;padding:0;border:1px solid #0b0c0e;background:linear-gradient(#5c636e,#353a42);display:grid;place-items:center;cursor:default}
.la-tb button:active{background:#22262c}
.la-tb button svg{width:7px;height:7px;display:block}
.la-b{padding:3px 6px 6px;position:relative}
.la-top{display:flex;gap:6px}
.la-disp{width:93px;height:42px;display:block;background:#05080d;box-shadow:inset 1px 1px #000,inset -1px -1px #3b4049;cursor:default;flex:none}
.la-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.la-marq{width:100%;height:12px;display:block;background:#05080d;box-shadow:inset 1px 1px #000,inset -1px -1px #3b4049;cursor:default}
.la-meta{display:flex;align-items:center;gap:3px;height:10px}
.la-meta b{display:inline-block;min-width:17px;padding:0 1px;background:#05080d;color:#5ef2c2;font:bold 8px/10px "Courier New",monospace;text-align:right}
.la-meta i{font-style:normal;color:#9aa6b6;font-size:7px;margin-right:3px}
.la-meta .ms{margin-left:auto;display:flex;gap:3px}
.la-meta .ms span{font-size:7px;color:#47505d;letter-spacing:.5px}
.la-meta .ms span.on{color:#5ef2c2;text-shadow:0 0 3px rgba(94,242,194,.6)}
.la-sl{display:flex;align-items:center;gap:4px;height:13px}
.la-slider{position:relative;height:8px;border:1px solid #0b0c0e;cursor:default;flex:none}
.la-slider b{position:absolute;top:-2px;width:12px;height:10px;margin-left:-6px;background:linear-gradient(#e7ecf2,#9aa3b0);border:1px solid #0b0c0e;border-radius:2px;box-shadow:inset 0 1px #fff}
.la-slider b:active,.la-slider.drag b{background:linear-gradient(#b8c4d4,#7c8796)}
.la-vol{width:68px;background:linear-gradient(90deg,#103d24,#1d7a3f 35%,#b3a21b 70%,#b42a1f)}
.la-vol::after{content:"";position:absolute;inset:0;background:#0d0f12;left:var(--v,80%)}
.la-bal{width:38px;background:linear-gradient(90deg,#3c6b9d,#163150 50%,#3c6b9d)}
.la-tgl{height:12px;padding:0 3px;border:1px solid #0b0c0e;background:linear-gradient(#4a505b,#2c3037);color:#7f8996;font:bold 7px/10px Tahoma,sans-serif;letter-spacing:.5px;cursor:default;display:flex;align-items:center;gap:2px}
.la-tgl::before{content:"";width:3px;height:3px;background:#2a2f36;box-shadow:0 0 0 1px #111}
.la-tgl.on{color:#dfe6ee}
.la-tgl.on::before{background:#5ef2c2;box-shadow:0 0 4px #5ef2c2,0 0 0 1px #111}
.la-tgl:active{background:#22262c}
.la-seek{margin:5px 0 4px;width:100%;height:10px;background:linear-gradient(#0d0f12,#1d2127);border:1px solid #0b0c0e}
.la-seek b{width:28px;margin-left:-14px;top:-1px;height:10px}
.la-seek.off b{display:none}
.la-ctl{display:flex;align-items:center;gap:0}
.la-ctl .tp{width:22px;height:17px;padding:0;border:1px solid #0b0c0e;margin-right:-1px;background:linear-gradient(#545b66,#30353d);display:grid;place-items:center;cursor:default;box-shadow:inset 1px 1px rgba(255,255,255,.22)}
.la-ctl .tp:active{background:linear-gradient(#2a2e35,#3a4049);box-shadow:inset 1px 1px rgba(0,0,0,.5)}
.la-ctl .tp svg{width:10px;height:8px;display:block}
.la-ctl .ej{margin-left:6px;width:21px;height:15px}
.la-ctl .la-tgl{margin-left:6px;height:13px}
.la-logo{margin-left:auto;width:16px;height:16px;cursor:default;opacity:.9}
.la-logo:hover{opacity:1}
.la.shade .la-main .la-b{display:none}
.la.shade .la-main .la-tb .mini{display:flex}
.la-tb .mini{display:none;align-items:center;gap:3px;margin-right:2px}
.la-tb .mini canvas{width:34px;height:9px;display:block;background:#05080d}
.la-tb .mini .ms{width:36px;height:6px;background:#0d0f12;border:1px solid #0b0c0e;position:relative}
.la-tb .mini .ms i{position:absolute;left:0;top:0;bottom:0;background:#5ef2c2}
/* EQ */
.la-eqtop{display:flex;align-items:center;gap:5px;margin:2px 0 6px}
.la-eqtop .la-tgl{height:12px}
.la-eqtop canvas{margin-left:auto;width:113px;height:19px;background:#05080d;box-shadow:inset 1px 1px #000,inset -1px -1px #3b4049;display:block}
.la-eqs{display:flex;align-items:flex-end;gap:0;height:72px}
.la-eqs .db{display:flex;flex-direction:column;justify-content:space-between;height:63px;font-size:6px;color:#9aa6b6;padding:0 3px 0 2px;margin-bottom:9px;text-align:right}
.la-vs{display:flex;flex-direction:column;align-items:center;gap:2px;width:18px;flex:none}
.la-vs.pre{margin-right:6px}
.la-vs .tr{position:relative;width:12px;height:63px;background:linear-gradient(90deg,transparent 4px,#0d0f12 4px 8px,transparent 8px);cursor:default}
.la-vs .tr::before{content:"";position:absolute;left:4px;right:4px;bottom:0;height:var(--f,50%);background:linear-gradient(0deg,#1d7a3f,#b3a21b 60%,#b42a1f)}
.la-vs .tr b{position:absolute;left:0;width:12px;height:7px;margin-top:-4px;background:linear-gradient(#e7ecf2,#9aa3b0);border:1px solid #0b0c0e;border-radius:2px}
.la-vs span{font-size:6.5px;color:#9aa6b6;height:7px}
/* playlist */
.la-plw{display:flex;flex-direction:column}
.la-pll{position:relative;height:var(--plh,174px);overflow-y:auto;overflow-x:hidden;background:#05080d;margin:3px 4px 0;box-shadow:inset 1px 1px #000,inset -1px -1px #3b4049;outline:none;scrollbar-width:thin;scrollbar-color:#59616d #15181c}
.la-pll::-webkit-scrollbar{width:8px}
.la-pll::-webkit-scrollbar-track{background:#15181c}
.la-pll::-webkit-scrollbar-thumb{background:linear-gradient(90deg,#6c7480,#454b55);border:1px solid #0b0c0e}
.la-pli{position:absolute;left:0;right:0;height:13px;display:flex;gap:4px;padding:0 3px;font:9px/13px Tahoma,Verdana,sans-serif;color:#5ef2c2;white-space:nowrap;cursor:default}
.la-pli span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}
.la-pli.cur{color:#fff}
.la-pli.sel{background:#1a3b8a}
.la-pli.bad{color:#d06060}
.la-pli.drop{box-shadow:inset 0 1px 0 #fff}
.la-plf{display:flex;align-items:center;gap:2px;padding:4px 4px 5px;position:relative}
.la-plf .pb{height:14px;padding:0 4px;border:1px solid #0b0c0e;background:linear-gradient(#4a505b,#2c3037);color:#cfd6e0;font:bold 7px/12px Tahoma,sans-serif;letter-spacing:.4px;cursor:default}
.la-plf .pb:active{background:#22262c}
.la-plf .tot{margin:0 auto;font:8px/14px "Courier New",monospace;color:#5ef2c2;background:#05080d;padding:0 4px;min-width:84px;text-align:center;white-space:nowrap}
.la-plf .grip{position:absolute;right:1px;bottom:1px;width:9px;height:9px;cursor:ns-resize;background:linear-gradient(135deg,transparent 45%,#7c8796 45% 55%,transparent 55% 70%,#7c8796 70% 80%,transparent 80%)}
.la-pm{position:fixed;z-index:61;min-width:150px;background:#2b2f36;border:1px solid #0b0c0e;box-shadow:inset 1px 1px rgba(255,255,255,.15),3px 3px 0 rgba(0,0,0,.35);padding:2px;font:11px Tahoma,Verdana,sans-serif;color:#dfe6ee}
.la-pm button{display:flex;width:100%;border:0;background:none;color:inherit;font:inherit;text-align:left;padding:3px 16px 3px 18px;cursor:default;white-space:nowrap;position:relative;gap:14px}
.la-pm button:hover{background:#3d5f9e}
.la-pm button.chk::before{content:"✓";position:absolute;left:5px}
.la-pm button span.k{margin-left:auto;color:#9aa6b6}
.la-pm hr{border:0;border-top:1px solid #15181c;border-bottom:1px solid #454b55;margin:2px 0}
.la-pm button:disabled{color:#6b7480}
.la-jump .row{display:flex;gap:6px;margin-bottom:6px}
.la-jump .lst{height:240px;overflow:auto;background:var(--field);border:1px solid var(--shadow)}
.la-jump .lst div{padding:2px 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:default}
.la-jump .lst div.on{background:var(--sel);color:var(--sel-text,#fff)}`;
const LA_SVG = {
  min: '<svg viewBox="0 0 7 7"><path d="M1 5h5v1H1z" fill="#d7dde6"/></svg>',
  shade: '<svg viewBox="0 0 7 7"><path d="M1 1h5v5H1z" fill="none" stroke="#d7dde6"/><path d="M1 2h5" stroke="#d7dde6"/></svg>',
  x: '<svg viewBox="0 0 7 7"><path d="M1 1l5 5M6 1 1 6" stroke="#d7dde6" stroke-width="1.2"/></svg>',
  menu: '<svg viewBox="0 0 7 7"><path d="M1 1.5h5M1 3.5h5M1 5.5h5" stroke="#d7dde6"/></svg>',
  prev: '<svg viewBox="0 0 10 8"><path d="M0 0h1.5v8H0zM6 0v8L1.5 4zM10 0v8L5.5 4z" fill="#d7dde6"/></svg>',
  play: '<svg viewBox="0 0 10 8"><path d="M2 0v8l6.5-4z" fill="#d7dde6"/></svg>',
  pause: '<svg viewBox="0 0 10 8"><path d="M2 0h2.3v8H2zM5.8 0h2.3v8H5.8z" fill="#d7dde6"/></svg>',
  stop: '<svg viewBox="0 0 10 8"><path d="M1.5 0h7v8h-7z" fill="#d7dde6"/></svg>',
  next: '<svg viewBox="0 0 10 8"><path d="M0 0v8l4.5-4zM4 0v8l4.5-4zM8.5 0H10v8H8.5z" fill="#d7dde6"/></svg>',
  eject: '<svg viewBox="0 0 10 8"><path d="M5 0l4.5 4.6h-9zM.5 6h9v2h-9z" fill="#d7dde6"/></svg>',
  logo: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#15181c" stroke="#5ef2c2" stroke-width=".8"/><circle cx="8" cy="8" r="4.6" fill="none" stroke="#2c6b5a" stroke-width=".6"/><path d="M5.2 4.5v7h5.6" fill="none" stroke="#5ef2c2" stroke-width="1.5"/><circle cx="8" cy="8" r="1" fill="#5ef2c2"/></svg>'
};
const LANamp = (() => {
  let root = null, raf = 0, last = 0, marqX = 0, marqText = '', marqW = 0, plRows = [], plSel = new Set(), plAnchor = -1, unsub = null, autoEqFor = null;
  const P = () => S.prefs;
  const q = s => root.querySelector(s);
  function build() {
    if (!document.getElementById('lanampCSS')) document.head.append(el('style', { id: 'lanampCSS', text: LANAMP_CSS }));
    root = el('div', { class: 'la', id: 'lanamp', tabindex: '-1', role: 'region', 'aria-label': 'LANamp player', hidden: true });
    root.innerHTML = `
<section class="la-win la-main">
  <header class="la-tb" data-drag="1"><button class="la-menu" title="LANamp menu" aria-label="LANamp menu">${LA_SVG.menu}</button><div class="t"><span>LANAMP</span></div>
    <div class="mini"><canvas class="mt" width="68" height="18"></canvas><div class="ms"><i></i></div></div>
    <button class="la-min" title="Close" aria-label="Close">${LA_SVG.min}</button><button class="la-sh" title="Windowshade mode" aria-label="Windowshade mode">${LA_SVG.shade}</button><button class="la-x" title="Close LANamp" aria-label="Close LANamp">${LA_SVG.x}</button></header>
  <div class="la-b">
    <div class="la-top">
      <canvas class="la-disp" title="Click: elapsed / remaining time · click the analyzer: spectrum, scope, off"></canvas>
      <div class="la-info">
        <canvas class="la-marq" title="Double-click to show this song in the Jukebox"></canvas>
        <div class="la-meta"><b class="kb">&nbsp;</b><i>kbps</i><b class="kh">&nbsp;</b><i>kHz</i><div class="ms"><span class="mo">MONO</span><span class="st">STEREO</span></div></div>
        <div class="la-sl"><div class="la-slider la-vol" title="Volume" role="slider" aria-label="Volume" tabindex="0"><b></b></div><div class="la-slider la-bal" title="Balance" role="slider" aria-label="Balance" tabindex="0"><b></b></div>
          <button class="la-tgl eqb" title="Equalizer">EQ</button><button class="la-tgl plb" title="Playlist editor">PL</button></div>
      </div>
    </div>
    <div class="la-slider la-seek" title="Seek" role="slider" aria-label="Position" tabindex="0"><b></b></div>
    <div class="la-ctl">
      <button class="tp" data-a="prev" title="Previous (Z)" aria-label="Previous">${LA_SVG.prev}</button><button class="tp" data-a="play" title="Play (X)" aria-label="Play">${LA_SVG.play}</button><button class="tp" data-a="pause" title="Pause (C)" aria-label="Pause">${LA_SVG.pause}</button><button class="tp" data-a="stop" title="Stop (V)" aria-label="Stop">${LA_SVG.stop}</button><button class="tp" data-a="next" title="Next (B)" aria-label="Next">${LA_SVG.next}</button>
      <button class="tp ej" data-a="eject" title="Add songs / jump to song (L, J)" aria-label="Add songs">${LA_SVG.eject}</button>
      <button class="la-tgl shuf" data-a="shuffle" title="Shuffle (S)">SHUFFLE</button><button class="la-tgl rep" data-a="repeat" title="Repeat (R)">REPEAT</button>
      <span class="la-logo" title="About LANamp">${LA_SVG.logo}</span>
    </div>
  </div>
</section>
<section class="la-win la-eq" hidden>
  <header class="la-tb" data-drag="1"><div class="t"><span>LANAMP EQUALIZER</span></div><button class="la-x eqx" title="Close equalizer" aria-label="Close equalizer">${LA_SVG.x}</button></header>
  <div class="la-b">
    <div class="la-eqtop"><button class="la-tgl eqon" title="Turn the equalizer on or off">ON</button><button class="la-tgl eqauto" title="Pick a preset from each song's genre">AUTO</button><button class="la-tgl eqpre" title="Presets">PRESETS ▾</button><canvas class="eqg"></canvas></div>
    <div class="la-eqs"></div>
  </div>
</section>
<section class="la-win la-pl" hidden>
  <header class="la-tb" data-drag="1"><div class="t"><span>LANAMP PLAYLIST</span></div><button class="la-x plx" title="Close playlist" aria-label="Close playlist">${LA_SVG.x}</button></header>
  <div class="la-plw">
    <div class="la-pll" tabindex="0" role="listbox" aria-label="Playlist"><div class="rows" style="position:relative"></div></div>
    <div class="la-plf"><button class="pb" data-m="add">+ ADD</button><button class="pb" data-m="rem">- REM</button><button class="pb" data-m="sel">SEL</button><button class="pb" data-m="misc">MISC</button><span class="tot"></span><button class="pb" data-m="list">LIST</button><i class="grip" title="Drag to resize"></i></div>
  </div>
</section>`;
    document.body.append(root);
    // equalizer sliders
    const eqs = q('.la-eqs');
    const vs = (cls, label, title) => { const w = el('div', { class: 'la-vs ' + cls }); w.innerHTML = '<div class="tr" role="slider" tabindex="0" aria-label="' + esc(title) + '"><b></b></div><span>' + label + '</span>'; return w; };
    eqs.append(vs('pre', 'PRE', 'Preamp'));
    eqs.append(el('div', { class: 'db', html: '<span>+12db</span><span>+0db</span><span>-12db</span>' }));
    EQ_LABELS.forEach((l, i) => { const w = vs('b' + i, l, l + ' Hz'); w.dataset.i = i; eqs.append(w); });
    wire();
    place();
  }
  /* ---------- placement & dragging ---------- */
  function place() {
    const pos = P().ampPos;
    const W = window.innerWidth, H = window.innerHeight;
    const z = parseFloat(root.style.zoom || '1') || 1;
    const rr = root.getBoundingClientRect(), wid = rr.width || 275 * z, hgt = rr.height || 116 * z;
    let x = pos ? pos.x : W - wid - 24, y = pos ? pos.y : H - hgt - 64;
    x = clamp(x, 0, Math.max(0, W - wid)); y = clamp(y, 0, Math.max(0, H - hgt));
    root.style.left = x / z + 'px'; root.style.top = y / z + 'px';
  }
  function startDrag(e) {
    const z = parseFloat(root.style.zoom || '1') || 1;
    const r = root.getBoundingClientRect();
    const dx = e.clientX - r.left, dy = e.clientY - r.top;
    const mv = ev => {
      let x = ev.clientX - dx, y = ev.clientY - dy;
      // snap to the window edges, like the real thing
      if (Math.abs(x) < 10) x = 0; if (Math.abs(window.innerWidth - (x + r.width)) < 10) x = window.innerWidth - r.width;
      if (Math.abs(y) < 10) y = 0; if (Math.abs(window.innerHeight - (y + r.height)) < 10) y = window.innerHeight - r.height;
      root.style.left = x / z + 'px'; root.style.top = y / z + 'px';
    };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); const rr = root.getBoundingClientRect(); P().ampPos = { x: Math.round(rr.left), y: Math.round(rr.top) }; saveState(); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }
  /* ---------- sliders ---------- */
  function hslider(node, get, set, center) {
    const b = node.querySelector('b');
    const sync = () => { const f = clamp(get(), 0, 1); b.style.left = (6 + f * (node.clientWidth - 12)) + 'px'; node.style.setProperty('--v', f * 100 + '%'); node.setAttribute('aria-valuenow', Math.round(f * 100)); };
    const from = e => { const r = node.getBoundingClientRect(); return clamp((e.clientX - r.left - 6 * (r.width / node.clientWidth)) / (r.width - 12 * (r.width / node.clientWidth)), 0, 1); };
    node.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation(); node.setPointerCapture(e.pointerId); node.classList.add('drag');
      const go2 = ev => { let f = from(ev); if (center && Math.abs(f - 0.5) < 0.06) f = 0.5; set(f, true); sync(); };
      go2(e);
      const mv = ev => go2(ev);
      node.addEventListener('pointermove', mv);
      node.addEventListener('pointerup', () => { node.removeEventListener('pointermove', mv); node.classList.remove('drag'); set(null, false); }, { once: true });
    });
    node.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); set(clamp(get() + (e.key === 'ArrowRight' ? 0.05 : -0.05), 0, 1), true); set(null, false); sync(); } });
    return sync;
  }
  let seeking = null;
  let syncVol, syncBal, syncSeek;
  function vslider(w, get, set) {
    const tr = w.querySelector('.tr'), b = tr.querySelector('b');
    const sync = () => { const v = get(), f = (v + 12) / 24; b.style.top = (4 + (1 - f) * 55) + 'px'; tr.style.setProperty('--f', (f * 100).toFixed(1) + '%'); tr.setAttribute('aria-valuenow', v.toFixed(1)); tr.title = (v > 0 ? '+' : '') + v.toFixed(1) + ' dB'; };
    const from = e => { const r = tr.getBoundingClientRect(); return 12 - clamp((e.clientY - r.top - 4 * (r.height / tr.clientHeight)) / (r.height - 8 * (r.height / tr.clientHeight)), 0, 1) * 24; };
    tr.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation(); tr.setPointerCapture(e.pointerId);
      const go2 = ev => { const v = from(ev); set(Math.abs(v) < 0.8 ? 0 : v); sync(); };
      go2(e);
      tr.addEventListener('pointermove', go2);
      tr.addEventListener('pointerup', () => tr.removeEventListener('pointermove', go2), { once: true });
    });
    tr.addEventListener('dblclick', () => { set(0); sync(); });
    tr.addEventListener('keydown', e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); set(clamp(get() + (e.key === 'ArrowUp' ? 1 : -1), -12, 12)); sync(); } });
    return sync;
  }
  const eqSyncs = [];
  /* ---------- wiring ---------- */
  function wire() {
    root.addEventListener('pointerdown', e => {
      root.classList.add('act');
      const tb = e.target.closest('[data-drag]');
      if (tb && !e.target.closest('button') && e.button === 0) { e.preventDefault(); startDrag(e); }
    });
    document.addEventListener('pointerdown', e => { if (root && !root.contains(e.target) && !e.target.closest('.la-pm')) root.classList.remove('act'); }, true);
    q('.la-main .la-tb').addEventListener('dblclick', e => { if (!e.target.closest('button')) setShade(!P().ampShade); });
    q('.la-x:not(.eqx):not(.plx)').addEventListener('click', () => api.close());
    q('.la-min').addEventListener('click', () => api.close());
    q('.la-sh').addEventListener('click', () => setShade(!P().ampShade));
    q('.la-menu').addEventListener('click', e => mainMenu(e.currentTarget));
    q('.eqx').addEventListener('click', () => showEq(false));
    q('.plx').addEventListener('click', () => showPl(false));
    q('.eqb').addEventListener('click', () => showEq(!P().ampEq));
    q('.plb').addEventListener('click', () => showPl(!P().ampPl));
    q('.la-logo').addEventListener('click', () => about());
    for (const b of root.querySelectorAll('.la-ctl [data-a]')) b.addEventListener('click', () => act(b.dataset.a));
    q('.la-disp').addEventListener('click', e => {
      const r = e.currentTarget.getBoundingClientRect(), y = (e.clientY - r.top) / r.height;
      if (y > 0.55) { P().ampVis = ((P().ampVis || 0) + 1) % 3; } else P().ampRemain = !P().ampRemain;
      saveState();
    });
    q('.la-marq').addEventListener('dblclick', () => { const d = Player.current(); if (d) go(d.url); });
    let mDrag = null;
    q('.la-marq').addEventListener('pointerdown', e => { mDrag = { x: e.clientX, m: marqX }; e.currentTarget.setPointerCapture(e.pointerId); });
    q('.la-marq').addEventListener('pointermove', e => { if (mDrag) marqX = mDrag.m - (e.clientX - mDrag.x); });
    q('.la-marq').addEventListener('pointerup', () => { mDrag = null; });
    syncVol = hslider(q('.la-vol'), () => (P().vol == null ? 0.8 : P().vol), (f, live) => { if (f != null) Player.setVolume(f); if (live && f != null) flash('VOLUME: ' + Math.round(f * 100) + '%'); });
    syncBal = hslider(q('.la-bal'), () => ((P().bal || 0) + 1) / 2, (f, live) => { if (f != null) Player.setBalance(f * 2 - 1); if (live && f != null) { const b = Math.round((f * 2 - 1) * 100); flash('BALANCE: ' + (b === 0 ? 'CENTER' : Math.abs(b) + '% ' + (b < 0 ? 'LEFT' : 'RIGHT'))); } }, true);
    syncSeek = hslider(q('.la-seek'), () => (seeking != null ? seeking : Player.duration() ? Player.time() / Player.duration() : 0), (f, live) => {
      if (live) { seeking = f; flash('SEEK TO: ' + fmtTime(f * Player.duration()) + '/' + fmtTime(Player.duration()) + ' (' + Math.round(f * 100) + '%)'); }
      else { if (seeking != null) Player.seek(seeking * Player.duration()); seeking = null; }
    });
    // equalizer
    q('.eqon').addEventListener('click', () => Player.eq.setOn(!Player.eq.on()));
    q('.eqauto').addEventListener('click', () => { P().eqAuto = !P().eqAuto; saveState(); syncEqWin(); if (P().eqAuto) autoEq(true); });
    q('.eqpre').addEventListener('click', e => popMenu(e.currentTarget, Object.keys(EQ_PRESETS).map(n => ({ label: n, check: () => Player.eq.preset() === n, act: () => Player.eq.load(n) })).concat([{ sep: 1 }, { label: 'Reset all to 0 dB', act: () => Player.eq.reset() }])));
    root.querySelectorAll('.la-vs').forEach(w => {
      if (w.classList.contains('pre')) eqSyncs.push(vslider(w, () => Player.eq.pre(), v => Player.eq.setPre(v)));
      else { const i = +w.dataset.i; eqSyncs.push(vslider(w, () => Player.eq.bands()[i], v => Player.eq.setBand(i, v))); }
    });
    // playlist
    const pll = q('.la-pll');
    pll.addEventListener('scroll', () => paintPl(), { passive: true });
    pll.addEventListener('pointerdown', e => {
      const it = e.target.closest('.la-pli');
      pll.focus();
      if (!it) return;
      const i = +it.dataset.i;
      if (e.shiftKey && plAnchor >= 0) { plSel.clear(); for (let k = Math.min(plAnchor, i); k <= Math.max(plAnchor, i); k++) plSel.add(k); }
      else if (e.ctrlKey || e.metaKey) { if (plSel.has(i)) plSel.delete(i); else plSel.add(i); plAnchor = i; }
      else if (!plSel.has(i)) { plSel.clear(); plSel.add(i); plAnchor = i; }
      paintPl(true);
      // drag to reorder
      if (e.button !== 0 || e.shiftKey || e.ctrlKey || e.metaKey) return;
      const y0 = e.clientY;
      let moved = false, target = -1;
      const mv = ev => {
        if (Math.abs(ev.clientY - y0) < 4 && !moved) return;
        moved = true;
        const r = pll.getBoundingClientRect(), z = r.height / pll.clientHeight;
        target = clamp(Math.round(((ev.clientY - r.top) / z + pll.scrollTop) / 13), 0, plRows.length);
        for (const x of pll.querySelectorAll('.drop')) x.classList.remove('drop');
        const t = pll.querySelector('.la-pli[data-i="' + target + '"]');
        if (t) t.classList.add('drop');
      };
      const up = () => {
        window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
        if (!moved) { if (!e.shiftKey && !(e.ctrlKey || e.metaKey)) { plSel.clear(); plSel.add(i); plAnchor = i; paintPl(true); } return; }
        if (target >= 0) {
          const idx = Array.from(plSel).sort((a, b) => a - b);
          Player.move(idx, target);
          const before = idx.filter(k => k < target).length, start = target - before;
          plSel = new Set(idx.map((_, k) => start + k));
        }
        paintPl(true);
      };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    });
    pll.addEventListener('dblclick', e => { const it = e.target.closest('.la-pli'); if (it) Player.jump(+it.dataset.i); });
    pll.addEventListener('keydown', e => {
      const k = e.key;
      if (k === 'Delete') { e.preventDefault(); e.stopPropagation(); removeSel(); }
      else if (k === 'Enter') { e.preventDefault(); e.stopPropagation(); const i = Math.min(...plSel); if (isFinite(i)) Player.jump(i); }
      else if (k === 'ArrowDown' || k === 'ArrowUp') {
        e.preventDefault(); e.stopPropagation();
        const cur = plAnchor >= 0 ? plAnchor : -1, ni = clamp(cur + (k === 'ArrowDown' ? 1 : -1), 0, plRows.length - 1);
        if (e.shiftKey) plSel.add(ni); else { plSel.clear(); plSel.add(ni); }
        plAnchor = ni; scrollPlTo(ni); paintPl(true);
      } else if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'a') { e.preventDefault(); e.stopPropagation(); plSel = new Set(plRows.map((_, k2) => k2)); paintPl(true); }
    });
    // songs dragged out of the Jukebox
    pll.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('application/x-lanscape-songs')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
    pll.addEventListener('drop', e => { let p = []; try { p = JSON.parse(e.dataTransfer.getData('application/x-lanscape-songs') || '[]'); } catch (er) { return; } if (p.length) { e.preventDefault(); Player.enqueue(p); } });
    for (const b of root.querySelectorAll('.la-plf [data-m]')) b.addEventListener('click', () => plMenu(b));
    q('.grip').addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      const y0 = e.clientY, h0 = q('.la-pll').clientHeight, z = root.getBoundingClientRect().height / root.offsetHeight;
      const mv = ev => { const hh = clamp(h0 + (ev.clientY - y0) / z, 58, 900); root.style.setProperty('--plh', Math.round(hh / 13) * 13 + 'px'); paintPl(true); };
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); P().ampPlH = parseInt(root.style.getPropertyValue('--plh'), 10) || 174; saveState(); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    });
    root.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT') return;
      const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
      const map = { z: 'prev', x: 'play', c: 'pause', v: 'stop', b: 'next', s: 'shuffle', r: 'repeat', l: 'eject', j: 'jump' };
      if (!mod && !e.altKey && map[k]) { e.preventDefault(); e.stopPropagation(); act(map[k]); return; }
      if (mod && k === 'd') { e.preventDefault(); e.stopPropagation(); setZoom(zoomLevel() >= 2 ? 1 : 2); return; }
      if (k === 'arrowup' && !mod) { e.preventDefault(); e.stopPropagation(); Player.setVolume((P().vol || 0) + 0.05); flash('VOLUME: ' + Math.round(P().vol * 100) + '%'); }
      else if (k === 'arrowdown' && !mod) { e.preventDefault(); e.stopPropagation(); Player.setVolume((P().vol || 0) - 0.05); flash('VOLUME: ' + Math.round(P().vol * 100) + '%'); }
      else if (k === 'arrowright' && !mod) { e.preventDefault(); e.stopPropagation(); Player.seek(Player.time() + 5); }
      else if (k === 'arrowleft' && !mod) { e.preventDefault(); e.stopPropagation(); Player.seek(Player.time() - 5); }
      else if (k === 'escape') { root.blur(); }
    });
    window.addEventListener('resize', debounce(() => { if (api.isOpen()) place(); }, 150));
  }
  function act(a) {
    if (a === 'prev') Player.prev();
    else if (a === 'play') { if (Player.playing()) Player.seek(0); else Player.play(); }
    else if (a === 'pause') { if (Player.playing()) Player.pause(); else if (Player.current()) Player.play(); }
    else if (a === 'stop') Player.stop();
    else if (a === 'next') Player.next();
    else if (a === 'shuffle') Player.setShuffle(!P().shuffle);
    else if (a === 'repeat') Player.setRepeat(P().repeat === 'all' ? 'one' : P().repeat === 'one' ? 'off' : 'all');
    else if (a === 'eject' || a === 'jump') jumpDialog(a === 'eject');
  }
  const zoomLevel = () => parseFloat(root.style.zoom || '1') || 1;
  function setZoom(z) { P().ampZoom = z; root.style.zoom = String(z); saveState(); place(); }
  function setShade(on) { P().ampShade = !!on; root.classList.toggle('shade', !!on); saveState(); }
  function showEq(on) { P().ampEq = !!on; q('.la-eq').hidden = !on; q('.eqb').classList.toggle('on', !!on); saveState(); if (on) { syncEqWin(); } place(); }
  function showPl(on) { P().ampPl = !!on; q('.la-pl').hidden = !on; q('.plb').classList.toggle('on', !!on); saveState(); if (on) { refreshPl(); } place(); }
  /* ---------- menus ---------- */
  let pm = null;
  function closeMenu() { if (pm) { pm.remove(); pm = null; document.removeEventListener('pointerdown', outside, true); } }
  const outside = e => { if (pm && !pm.contains(e.target)) closeMenu(); };
  function popMenu(anchor, items, up) {
    closeMenu();
    pm = el('div', { class: 'la-pm', role: 'menu' });
    for (const it of items) {
      if (!it) continue;
      if (it.sep) { pm.append(el('hr')); continue; }
      const b = el('button', { type: 'button', class: it.check && it.check() ? 'chk' : '' }, el('span', { text: it.label }), it.key ? el('span', { class: 'k', text: it.key }) : null);
      if (it.disabled) b.disabled = true;
      b.addEventListener('click', () => { closeMenu(); it.act(); });
      pm.append(b);
    }
    document.body.append(pm);
    const r = anchor.getBoundingClientRect();
    const x = clamp(r.left, 0, window.innerWidth - pm.offsetWidth - 4);
    let y = up ? r.top - pm.offsetHeight : r.bottom;
    if (y + pm.offsetHeight > window.innerHeight - 4) y = r.top - pm.offsetHeight;
    pm.style.left = x + 'px'; pm.style.top = Math.max(0, y) + 'px';
    setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
  }
  function mainMenu(anchor) {
    popMenu(anchor, [
      { label: 'Jump to Song...', key: 'J', act: () => jumpDialog(false) }, { label: 'Add Songs...', key: 'L', act: () => jumpDialog(true) }, { sep: 1 },
      { label: 'Jukebox (Library)', act: () => go(Player.current() ? Player.current().url : 'http://music.lanscape.net/') },
      { label: 'Equalizer', check: () => !!P().ampEq, act: () => showEq(!P().ampEq) }, { label: 'Playlist Editor', check: () => !!P().ampPl, act: () => showPl(!P().ampPl) }, { sep: 1 },
      { label: 'Time Remaining', check: () => !!P().ampRemain, act: () => { P().ampRemain = !P().ampRemain; saveState(); } },
      { label: 'Visualization: Spectrum', check: () => (P().ampVis || 0) === 0, act: () => { P().ampVis = 0; saveState(); } },
      { label: 'Visualization: Oscilloscope', check: () => P().ampVis === 1, act: () => { P().ampVis = 1; saveState(); } },
      { label: 'Visualization: Off', check: () => P().ampVis === 2, act: () => { P().ampVis = 2; saveState(); } }, { sep: 1 },
      { label: 'Double Size', key: 'Ctrl+D', check: () => zoomLevel() >= 2, act: () => setZoom(zoomLevel() >= 2 ? 1 : 2) },
      { label: 'Windowshade Mode', check: () => !!P().ampShade, act: () => setShade(!P().ampShade) }, { sep: 1 },
      { label: 'About LANamp...', act: about }, { label: 'Close', act: () => api.close() }
    ]);
  }
  function plMenu(b) {
    const m = b.dataset.m;
    const cur = Player.current(), ci = cur ? songInfo(cur) : null;
    const lib = () => jbSongs().map(songInfo);
    const items = {
      add: [{ label: 'Add Songs from Library...', act: () => jumpDialog(true) },
        { label: 'Add This Album', disabled: !ci, act: () => Player.enqueue(lib().filter(s => s.album === ci.album && s.artist === ci.artist).sort((a, b2) => a.track - b2.track).map(s => s.path)) },
        { label: 'Add Everything by This Artist', disabled: !ci, act: () => Player.enqueue(lib().filter(s => s.artist === ci.artist).map(s => s.path)) },
        { label: 'Add Whole Library', act: () => Player.enqueue(lib().map(s => s.path)) }],
      rem: [{ label: 'Remove Selected', key: 'Del', act: removeSel }, { label: 'Crop (Keep Selected)', act: () => Player.remove(plRows.map((_, i) => i).filter(i => !plSel.has(i))) },
        { label: 'Remove Missing Songs', act: () => Player.remove(plRows.map((p, i) => (S.docs.get(p) && S.docs.get(p).active !== false ? -1 : i)).filter(i => i >= 0)) }, { sep: 1 }, { label: 'Clear Playlist', act: () => Player.clear() }],
      sel: [{ label: 'Select All', act: () => { plSel = new Set(plRows.map((_, i) => i)); paintPl(true); } }, { label: 'Select None', act: () => { plSel.clear(); paintPl(true); } }, { label: 'Invert Selection', act: () => { plSel = new Set(plRows.map((_, i) => i).filter(i => !plSel.has(i))); paintPl(true); } }],
      misc: [{ label: 'Sort by Title', act: () => sortQueue(s => s.title) }, { label: 'Sort by Artist', act: () => sortQueue(s => [s.artist, s.album, s.track]) }, { label: 'Sort by File Path', act: () => sortQueue(s => s.path) },
        { label: 'Reverse List', act: () => reorder(plRows.map((_, i) => i).reverse()) }, { label: 'Randomize List', act: () => { const ix = plRows.map((_, i) => i); for (let i = ix.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ix[i], ix[j]] = [ix[j], ix[i]]; } reorder(ix); } }],
      list: [{ label: 'Save as Jukebox Playlist...', disabled: !plRows.length, act: savePlaylist }, ...S.playlists.slice(0, 15).map(p => ({ label: 'Load “' + clip(p.name, 26) + '”', act: () => Player.playPaths(p.paths, 0) })), { sep: 1 }, { label: 'Export .m3u', disabled: !plRows.length, act: exportM3U }]
    }[m];
    popMenu(b, items, true);
  }
  function reorder(ix) { Player.reorder(ix); plSel.clear(); refreshPl(); }
  function sortQueue(key) {
    const recs = plRows.map((p, i) => { const d = S.docs.get(p); return { i, k: d ? key(songInfo(d)) : [p] }; });
    recs.sort((a, b) => { const x = [].concat(a.k), y = [].concat(b.k); for (let j = 0; j < x.length; j++) { const c = cmpVal(x[j] == null ? '' : x[j], y[j] == null ? '' : y[j]); if (c) return c; } return 0; });
    reorder(recs.map(r => r.i));
  }
  function removeSel() { if (plSel.size) { Player.remove(Array.from(plSel)); plSel.clear(); } }
  async function savePlaylist() {
    const name = await promptBox('Save Playlist', 'Playlist name:', 'LANamp mix ' + fmtShort(Date.now()));
    if (!name) return;
    S.playlists.push({ id: 'pl' + Date.now().toString(36), name: name.slice(0, 80), paths: plRows.slice() });
    saveState();
    setStatus('Saved “' + name + '” to your Jukebox playlists.');
  }
  function exportM3U() {
    const lines = ['#EXTM3U'];
    for (const p of plRows) { const d = S.docs.get(p); if (!d) continue; const s = songInfo(d); lines.push('#EXTINF:' + Math.round(s.duration || -1) + ',' + s.artist + ' - ' + s.title, p.split('/').slice(1).join('/')); }
    download('LANamp playlist.m3u', new Blob([lines.join('\n') + '\n'], { type: 'audio/x-mpegurl' }));
  }
  function about() {
    msgBox('info', 'About LANamp', '<p><b>LANamp</b> ' + esc(VERSION) + '</p><p>It really plays the songs on your LAN.</p><p>Keys: Z previous · X play · C pause · V stop · B next · J jump to song · L add songs · S shuffle · R repeat · arrows volume and seek · Ctrl+D double size. Double-click the title bar for windowshade mode.</p>');
  }
  /* ---------- jump to song / add songs ---------- */
  function jumpDialog(adding) {
    const all = jbSongs().map(songInfo).sort((a, b) => cmpVal(sortArtist(a.artist), sortArtist(b.artist)) || cmpVal(a.album, b.album) || a.track - b.track);
    const body = el('div', { class: 'la-jump', style: { width: 'min(460px, 86vw)' } });
    body.innerHTML = '<div class="row"><input class="field" style="flex:1" placeholder="Type part of a song, artist or album" aria-label="Find a song"></div><div class="lst" role="listbox"></div><p class="hint" style="margin:6px 0 0">Enter plays · double-click plays · Enqueue adds to the playlist</p>';
    const inp = body.querySelector('input'), lst = body.querySelector('.lst');
    let shown = [], sel = 0;
    const fill = () => {
      const toks = inp.value.toLowerCase().split(/\s+/).filter(Boolean);
      shown = all.filter(s => { const hay = (s.artist + ' ' + s.title + ' ' + s.album).toLowerCase(); return toks.every(t => hay.includes(t)); }).slice(0, 500);
      sel = Math.min(sel, Math.max(0, shown.length - 1));
      lst.innerHTML = shown.map((s, i) => '<div data-i="' + i + '" class="' + (i === sel ? 'on' : '') + '">' + esc(s.artist + ' - ' + s.title) + ' <span style="opacity:.6">(' + esc(s.album) + ')</span></div>').join('') || '<div>No songs match.</div>';
    };
    fill();
    const w = openWin({ title: adding ? 'Add Songs' : 'Jump to Song', body, width: 'min(500px, 94vw)', buttons: [{ label: 'Play', primary: true, value: 'play' }, { label: 'Enqueue', value: 'enq' }, { label: 'Close', value: null }] });
    inp.addEventListener('input', () => { sel = 0; fill(); });
    inp.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = clamp(sel + (e.key === 'ArrowDown' ? 1 : -1), 0, shown.length - 1); fill(); const on = lst.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest' }); }
      else if (e.key === 'Enter') { e.preventDefault(); w.close('play'); }
    });
    lst.addEventListener('click', e => { const it = e.target.closest('[data-i]'); if (it) { sel = +it.dataset.i; fill(); } });
    lst.addEventListener('dblclick', e => { const it = e.target.closest('[data-i]'); if (it) { sel = +it.dataset.i; w.close('play'); } });
    setTimeout(() => inp.focus(), 30);
    w.result.then(v => {
      const s = shown[sel];
      if (!v || !s) return;
      const qi = Player.queue.indexOf(s.path);
      if (v === 'enq') { Player.enqueue([s.path]); return; }
      if (qi >= 0) Player.jump(qi); else { Player.enqueue([s.path], true); Player.next(); }
    });
  }
  /* ---------- display painting ---------- */
  const spec = new Uint8Array(1024), wave = new Uint8Array(1024);
  const peaks = new Float32Array(19), bars = new Float32Array(19);
  let flashMsg = '', flashUntil = 0;
  function flash(m) { flashMsg = m; flashUntil = performance.now() + 1100; }
  function fitCanvas(cv) {
    const z = zoomLevel(), dpr = (window.devicePixelRatio || 1) * z;
    const w = Math.round(cv.clientWidth * dpr), hh = Math.round(cv.clientHeight * dpr);
    if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; }
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    return c;
  }
  const SEG = { '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg', '5': 'acdfg', '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', '-': 'g', ' ': '' };
  function digit(c, ch, x, y, w, hh, on, off) {
    const t = 1.6, segs = SEG[ch] || '';
    const R = (sx, sy, sw, sh, k) => { c.fillStyle = segs.includes(k) ? on : off; c.fillRect(x + sx, y + sy, sw, sh); };
    R(t, 0, w - 2 * t, t, 'a'); R(w - t, t, t, hh / 2 - t, 'b'); R(w - t, hh / 2 + 0.5, t, hh / 2 - t - 0.5, 'c'); R(t, hh - t, w - 2 * t, t, 'd');
    R(0, hh / 2 + 0.5, t, hh / 2 - t - 0.5, 'e'); R(0, t, t, hh / 2 - t, 'f'); R(t, hh / 2 - t / 2, w - 2 * t, t, 'g');
  }
  function paintDisp(now) {
    const cv = q('.la-disp'), c = fitCanvas(cv), W = cv.clientWidth, H = cv.clientHeight;
    c.clearRect(0, 0, W, H);
    const on = '#5ef2c2', off = '#0f2a24';
    const playing = Player.playing(), has = !!Player.current();
    // play state
    c.fillStyle = playing ? on : has ? '#c9b33a' : '#2b3a37';
    if (playing) { c.beginPath(); c.moveTo(4, 4); c.lineTo(10, 7.5); c.lineTo(4, 11); c.fill(); }
    else if (has && Player.time() > 0) { c.fillRect(4, 4, 2.2, 7); c.fillRect(7.6, 4, 2.2, 7); }
    else c.fillRect(4, 4.5, 6, 6);
    // time
    const t = Player.time(), d = Player.duration(), rem = !!P().ampRemain && d > 0;
    const secs = rem ? Math.max(0, d - t) : t;
    const mm = Math.min(99, Math.floor(secs / 60)), ss = Math.floor(secs % 60);
    const blinkOff = has && !playing && t > 0 && Math.floor(now / 500) % 2;
    const txt = (rem ? '-' : ' ') + pad(mm, 2) + pad(ss, 2);
    if (!blinkOff && has) {
      digit(c, txt[0], 15, 4, 6, 12, on, off);
      digit(c, txt[1], 24, 3, 8, 14, on, off); digit(c, txt[2], 34, 3, 8, 14, on, off);
      c.fillStyle = on; c.fillRect(44.5, 6.5, 1.6, 1.6); c.fillRect(44.5, 11.5, 1.6, 1.6);
      digit(c, txt[3], 48, 3, 8, 14, on, off); digit(c, txt[4], 58, 3, 8, 14, on, off);
    } else {
      for (const [x, w, y, hh] of [[24, 8, 3, 14], [34, 8, 3, 14], [48, 8, 3, 14], [58, 8, 3, 14]]) digit(c, ' ', x, y, w, hh, on, off);
    }
    // visualization (19 bars x 16 like the old analyzers, or a scope)
    const vy = 23, vh = 16, vx = 9, vw = 76;
    const mode = P().ampVis || 0;
    if (mode === 0) {
      const real = Player.spectrum(spec);
      const bins = spec.length;
      for (let i = 0; i < 19; i++) {
        let v = 0;
        if (real) {
          const lo = Math.floor(Math.pow(2, (i / 19) * Math.log2(bins / 2)) ), hi = Math.max(lo + 1, Math.floor(Math.pow(2, ((i + 1) / 19) * Math.log2(bins / 2))));
          for (let k = lo; k < hi && k < bins; k++) v = Math.max(v, spec[k]);
          v = v / 255;
        }
        bars[i] = Math.max(v, bars[i] - 0.06);
        peaks[i] = Math.max(bars[i], peaks[i] - 0.012);
        const bh = Math.round(bars[i] * vh);
        for (let y = 0; y < bh; y++) { const f = y / vh; c.fillStyle = f > 0.8 ? '#e0433a' : f > 0.55 ? '#d9c83a' : '#2fd17a'; c.fillRect(vx + i * 4, vy + vh - 1 - y, 3, 1); }
        if (peaks[i] > 0.02) { c.fillStyle = '#b8c4d4'; c.fillRect(vx + i * 4, vy + vh - 1 - Math.round(peaks[i] * (vh - 1)), 3, 1); }
      }
    } else if (mode === 1) {
      const real = Player.wave(wave);
      c.strokeStyle = '#5ef2c2'; c.lineWidth = 1; c.beginPath();
      for (let i = 0; i < vw; i++) { const v = real ? (wave[Math.floor((i / vw) * 512)] - 128) / 128 : 0; const y = vy + vh / 2 - v * (vh / 2); if (i) c.lineTo(vx + i, y); else c.moveTo(vx + i, y); }
      c.stroke();
    }
  }
  function paintMarquee(dt) {
    const cv = q('.la-marq'), c = fitCanvas(cv), W = cv.clientWidth, H = cv.clientHeight;
    c.clearRect(0, 0, W, H);
    c.font = '9px Tahoma, Verdana, sans-serif';
    c.textBaseline = 'middle';
    let text;
    if (flashMsg && performance.now() < flashUntil) { c.fillStyle = '#5ef2c2'; c.fillText(flashMsg, 3, H / 2 + 0.5); return; }
    const d = Player.current();
    if (d) {
      const s = songInfo(d), n = Player.index + 1;
      text = n + '. ' + (s.artist && !/^Unknown/.test(s.artist) ? s.artist + ' - ' : '') + s.title + ' (' + fmtTime(s.duration || Player.duration()) + ')';
      if (Player.error()) text = n + '. ' + s.title + ' — ' + Player.error();
    } else text = 'LANamp ' + VERSION + ' — Press L to add songs';
    if (text !== marqText) { marqText = text; marqW = c.measureText(text + '  ***  ').width; marqX = 0; }
    const tw = c.measureText(text).width;
    c.fillStyle = '#5ef2c2';
    if (tw <= W - 6) { c.fillText(text, 3, H / 2 + 0.5); return; }
    marqX = (marqX + dt * 0.028) % marqW;
    if (marqX < 0) marqX += marqW;
    c.fillText(text + '  ***  ' + text + '  ***  ', 3 - marqX, H / 2 + 0.5);
  }
  function paintMini() {
    if (!P().ampShade) return;
    const cv = q('.la-tb .mt'), c = fitCanvas(cv), W = cv.clientWidth, H = cv.clientHeight;
    c.clearRect(0, 0, W, H);
    const t = Player.time(), d = Player.duration(), rem = !!P().ampRemain && d > 0;
    c.fillStyle = '#5ef2c2'; c.font = 'bold 8px "Courier New", monospace'; c.textBaseline = 'middle';
    c.fillText((rem ? '-' : '') + fmtTime(rem ? d - t : t), 2, H / 2 + 0.5);
    q('.la-tb .ms i').style.width = (d ? clamp(t / d, 0, 1) * 100 : 0) + '%';
  }
  function updateMeta() {
    const d = Player.current();
    const s = d ? songInfo(d) : null;
    q('.kb').textContent = s && s.bitrate ? String(s.bitrate) : s ? (d.ext === 'wav' || MIDI_EXT.test(d.name) ? '1411' : '') || ' ' : ' ';
    q('.kh').textContent = s ? String(Math.round((s.sampleRate || 44100) / 1000)) : ' ';
    q('.mo').classList.toggle('on', !!s && s.channels === 1);
    q('.st').classList.toggle('on', !!s && s.channels !== 1);
    q('.la-seek').classList.toggle('off', !s);
  }
  function syncButtons() {
    q('.shuf').classList.toggle('on', !!P().shuffle);
    q('.rep').classList.toggle('on', (P().repeat || 'off') !== 'off');
    q('.rep').textContent = P().repeat === 'one' ? 'REPEAT 1' : 'REPEAT';
    q('.eqb').classList.toggle('on', !!P().ampEq);
    q('.plb').classList.toggle('on', !!P().ampPl);
    syncVol(); syncBal();
  }
  function syncEqWin() {
    q('.eqon').classList.toggle('on', Player.eq.on());
    q('.eqauto').classList.toggle('on', !!P().eqAuto);
    for (const f of eqSyncs) f();
    const cv = q('.eqg'), c = fitCanvas(cv), W = cv.clientWidth, H = cv.clientHeight, b = Player.eq.bands();
    c.clearRect(0, 0, W, H);
    c.strokeStyle = 'rgba(94,242,194,.25)'; c.beginPath(); c.moveTo(0, H / 2); c.lineTo(W, H / 2); c.stroke();
    c.strokeStyle = Player.eq.on() ? '#5ef2c2' : '#3c5c55'; c.lineWidth = 1.2; c.beginPath();
    const pts = b.map((v, i) => [3 + (i / 9) * (W - 6), H / 2 - (v / 12) * (H / 2 - 2)]);
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; c.bezierCurveTo((x0 + x1) / 2, y0, (x0 + x1) / 2, y1, x1, y1); }
    c.stroke();
    const pre = Player.eq.pre();
    c.fillStyle = '#d9c83a'; c.fillRect(0, H / 2 - (pre / 12) * (H / 2 - 2) - 0.5, W, 1);
  }
  function autoEq(force) {
    if (!P().eqAuto) return;
    const d = Player.current();
    if (!d || (!force && autoEqFor === d.path)) return;
    autoEqFor = d.path;
    const g = (songInfo(d).genre || '').toLowerCase();
    const name = Object.keys(EQ_PRESETS).find(n => n.toLowerCase() === g) || (/(hip.?hop|rap)/.test(g) ? 'Bass Boost' : /(metal|punk|grunge|alt)/.test(g) ? 'Rock' : /(house|trance|electro|disco)/.test(g) ? 'Dance' : /(speech|podcast|audiobook|talk)/.test(g) ? 'Spoken Word' : /(midi)/.test(g) ? 'Small Speakers' : 'Flat');
    Player.eq.load(name);
  }
  /* ---------- playlist ---------- */
  function refreshPl() {
    if (!root || q('.la-pl').hidden) return;
    plRows = Player.queue;
    for (const i of Array.from(plSel)) if (i >= plRows.length) plSel.delete(i);
    q('.la-pll .rows').style.height = plRows.length * 13 + 'px';
    paintPl(true);
    const tot = plRows.reduce((a, p) => { const d = S.docs.get(p); return a + (d ? songInfo(d).duration : 0); }, 0);
    q('.la-plf .tot').textContent = fmtTime(Player.time()) + '/' + fmtTime(tot);
  }
  let plPainted = '';
  function paintPl(force) {
    const pll = q('.la-pll'), rowsBox = pll.querySelector('.rows');
    const first = Math.max(0, Math.floor(pll.scrollTop / 13) - 5), last = Math.min(plRows.length, Math.ceil((pll.scrollTop + pll.clientHeight) / 13) + 5);
    const key = first + ':' + last + ':' + Player.index;
    if (!force && key === plPainted) return;
    plPainted = key;
    let html = '';
    for (let i = first; i < last; i++) {
      const p = plRows[i], d = S.docs.get(p), s = d ? songInfo(d) : null;
      const bad = !d || (S.music[p] && S.music[p].bad);
      html += '<div class="la-pli' + (i === Player.index ? ' cur' : '') + (plSel.has(i) ? ' sel' : '') + (bad ? ' bad' : '') + '" data-i="' + i + '" style="top:' + i * 13 + 'px"><span>' + (i + 1) + '. ' + esc(s ? (s.artist && !/^Unknown/.test(s.artist) ? s.artist + ' - ' : '') + s.title : p.split('/').pop()) + '</span><b style="font-weight:normal">' + (s && s.duration ? fmtTime(s.duration) : '') + '</b></div>';
    }
    rowsBox.innerHTML = html;
  }
  function scrollPlTo(i) { const pll = q('.la-pll'); const y = i * 13; if (y < pll.scrollTop) pll.scrollTop = y; else if (y + 13 > pll.scrollTop + pll.clientHeight) pll.scrollTop = y + 13 - pll.clientHeight; }
  /* ---------- the loop ---------- */
  function loop(now) {
    if (!root || root.hidden) { raf = 0; return; }
    const dt = last ? Math.min(100, now - last) : 16;
    last = now;
    paintDisp(now);
    paintMarquee(dt);
    paintMini();
    if (seeking == null) syncSeek();
    if (!q('.la-pl').hidden && now % 1000 < 20) q('.la-plf .tot').textContent = q('.la-plf .tot').textContent.replace(/^[^/]*/, fmtTime(Player.time()));
    raf = requestAnimationFrame(loop);
  }
  /* ---------- public ---------- */
  const api = {
    open(show = true) {
      if (!root) build();
      if (!unsub) unsub = Player.on(t => {
        if (!root || root.hidden) return;
        if (t === 'track') { updateMeta(); autoEq(); if (!q('.la-pl').hidden) { paintPl(true); scrollPlTo(Math.max(0, Player.index)); } }
        if (t === 'queue') refreshPl();
        if (t === 'mode' || t === 'volume') syncButtons();
        if (t === 'eq') syncEqWin();
        if (t === 'error') flash(Player.error().toUpperCase());
      });
      root.hidden = false;
      if (P().ampZoom) root.style.zoom = String(P().ampZoom);
      if (P().ampPlH) root.style.setProperty('--plh', P().ampPlH + 'px');
      root.classList.toggle('shade', !!P().ampShade);
      q('.la-eq').hidden = !P().ampEq;
      q('.la-pl').hidden = !P().ampPl;
      place();
      updateMeta(); syncButtons(); syncEqWin(); refreshPl();
      if (show !== false) { P().ampOpen = true; saveState(); try { root.focus({ preventScroll: true }); } catch (e) { /* fine */ } }
      if (!raf) { last = 0; raf = requestAnimationFrame(loop); }
    },
    close() { if (root) root.hidden = true; closeMenu(); P().ampOpen = false; saveState(); },
    toggle(force) { const want = force != null ? !!force : !api.isOpen(); if (want) api.open(true); else api.close(); },
    isOpen: () => !!root && !root.hidden,
    showEq: on => { api.open(true); showEq(on); },
    showPl: on => { api.open(true); showPl(on); }
  };
  return api;
})();
