/* Organize · the reel scenes. Every picture here is drawn for The Watch (no frames from the reels themselves).
   Each scene is a 360×640 SVG. Classes drive one shared 9-second loop (see reels.css):
   .bef = the "before" clutter, fades out · .mvA/.mvB/.mvC = things that move into place (--x0 --y0 --r0 --s0 are where they start)
   .pA….pD = things that pop in · dim(…, n) = a tape-measure line and label, drawn late in the loop. */
(function () {
  const INK = '#1B1B1F';
  const R = (x, y, w, h, f, a = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}" ${a}/>`;
  const C = (x, y, r, f, a = '') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}" ${a}/>`;
  const P = (d, a = '') => `<path d="${d}" ${a}/>`;
  const G = (cls, inner, style = '') => `<g class="${cls}"${style ? ` style="${style}"` : ''}>${inner}</g>`;
  function dim(x1, y1, x2, y2, t, n, o) {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), nx = -dy / L * 7, ny = dx / L * 7, w = t.length * 6.3 + 20; o = o || [0, 0];
    return `<g class="dim d${n}"><path pathLength="1" d="M${x1} ${y1}L${x2} ${y2}M${x1 - nx} ${y1 - ny}l${2 * nx} ${2 * ny}M${x2 - nx} ${y2 - ny}l${2 * nx} ${2 * ny}"/><g class="lab"><g transform="translate(${mx + o[0]} ${my + o[1]})"><rect x="${-w / 2}" y="-12" width="${w}" height="24" rx="12"/><text y="4.5" text-anchor="middle">${t}</text></g></g></g>`;
  }
  const tiles = (id, s, c, o = .5) => `<defs><pattern id="${id}" width="${s}" height="${s}" patternUnits="userSpaceOnUse"><path d="M${s} 0H0V${s}" fill="none" stroke="${c}" stroke-opacity="${o}" stroke-width="2"/></pattern></defs>`;
  const bottle = (x, y, w, h, f, pump) => R(x, y, w, h, f, 'rx="7"') + (pump ? R(x + w / 2 - 4, y - 12, 8, 13, pump) + P(`M${x + w / 2 - 2} ${y - 13}h14l2 5`, `fill="none" stroke="${pump}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"`) : '');
  const S = {};

  /* 1 · under-sink pull-out */
  S.sink = { bot: '#B7A58D', svg: tiles('tA', 40, '#fff') + R(0, 0, 360, 640, '#CFE3DF') + R(0, 0, 360, 640, 'url(#tA)') + R(0, 530, 360, 110, '#B7A58D') +
    P('M168 132v-34a22 22 0 0 1 44 0v6', 'fill="none" stroke="#9AA7B1" stroke-width="10" stroke-linecap="round"') + R(14, 132, 332, 20, '#F4EAD9', 'rx="4"') +
    P('M30 152L6 172V548L30 530z', 'fill="#F3E3C6"') + P('M330 152L354 172V548L330 530z', 'fill="#F3E3C6"') + R(30, 152, 300, 378, '#E6CCA3') + R(46, 166, 268, 350, '#B58A58') + R(46, 488, 268, 28, '#9C7445') +
    P('M180 166V300a24 24 0 0 0 48 0V272H314', 'fill="none" stroke="#F7F7F3" stroke-width="18" stroke-linejoin="round"') + R(168, 196, 24, 10, '#DADFE2', 'rx="3"') + R(216, 262, 24, 10, '#DADFE2', 'rx="3"') + C(104, 212, 11, '#C8CED3', 'stroke="#8D979F" stroke-width="3"') + R(100, 196, 8, 12, '#8D979F', 'rx="2"') +
    G('bef', bottle(70, 420, 24, 68, '#F4F1EA', '#F4F1EA') + R(104, 452, 60, 36, '#3D6FB6', 'rx="3" transform="rotate(-14 134 470)"') + R(176, 440, 70, 48, '#fff', 'rx="20" transform="rotate(9 210 464)"') + bottle(262, 410, 26, 78, '#D9E8C5') + R(238, 468, 50, 20, '#E88', 'rx="3" transform="rotate(20 262 478)"')) +
    G('pA', R(50, 246, 58, 50, 'none', `stroke="${INK}" stroke-width="3.5"`) + P('M50 262h58M50 278h58', `stroke="${INK}" stroke-width="2"`) + R(56, 226, 20, 36, '#fff') + R(56, 244, 20, 10, '#3D6FB6') + R(80, 222, 20, 40, '#fff') + R(80, 242, 20, 10, '#3D6FB6')) +
    G('pB', R(254, 330, 58, 50, 'none', `stroke="${INK}" stroke-width="3.5"`) + P('M254 346h58M254 362h58', `stroke="${INK}" stroke-width="2"`) + R(260, 300, 20, 46, '#F4F1EA', 'rx="6"') + R(284, 308, 22, 38, '#EADBB8', 'rx="6"')) +
    G('mvB', R(58, 484, 244, 26, INK, 'rx="4"') + bottle(74, 408, 26, 78, '#F4F1EA', '#F4F1EA') + bottle(106, 416, 26, 70, '#F4F1EA', '#F4F1EA') + R(140, 440, 40, 46, 'rgba(255,255,255,.5)', 'rx="7" stroke="#fff" stroke-width="2.5"') + C(160, 462, 12, '#fff') + R(190, 424, 104, 30, '#fff', 'rx="15"') + R(190, 456, 104, 30, '#fff', 'rx="15"') + P('M278 439a6 6 0 1 0 6-6M278 471a6 6 0 1 0 6-6', 'fill="none" stroke="#D5D9DC" stroke-width="2.5"'), '--y0:-2px;--y1:26px;--s0:1;--s1:1.04') +
    dim(46, 182, 314, 182, 'door opening, not the cabinet', 1, [-36, 0]) + dim(250, 326, 250, 486, 'pipe to floor', 2, [0, -40]) + dim(46, 212, 92, 212, 'valve stays in reach', 3, [70, 26]) };

  /* 2 · lids on the door */
  const cont = (x, y, w, lid) => R(x, y, w, 26, 'rgba(255,255,255,.5)', 'rx="5" stroke="#fff" stroke-width="2.5"') + (lid ? R(x - 4, y - 8, w + 8, 9, '#BFDCE3', 'rx="3"') + R(x + w / 2 - 12, y - 4, 24, 5, '#EAF4F6', 'rx="2"') : '');
  const stack = (x, y, w, n) => Array.from({ length: n }, (_, i) => cont(x, y - i * 36, w, 1)).join('');
  const nest = (x, y, w, n) => Array.from({ length: n }, (_, i) => R(x + i * 1.5, y - i * 9, w - i * 3, 26, 'rgba(255,255,255,.4)', 'rx="5" stroke="#fff" stroke-width="2.5"')).join('');
  const lid = (x, y) => `<ellipse cx="${x}" cy="${y}" rx="10" ry="26" fill="#BFDCE3" stroke="#EAF4F6" stroke-width="2.5"/>` + C(x, y, 3.5, '#8FB7C0');
  S.lids = { bot: '#D9C6A6', svg: R(0, 0, 360, 640, '#EADFCB') + R(0, 520, 360, 120, '#D9C6A6') + R(98, 100, 240, 400, '#E7CFA6', 'rx="4"') + R(110, 112, 216, 376, '#C29A66') + R(110, 228, 216, 9, '#E1C493') + R(110, 352, 216, 9, '#E1C493') + R(110, 479, 216, 9, '#E1C493') +
    P('M98 100L28 122V522L98 500z', 'fill="#F1DFC0" stroke="#E1C493" stroke-width="2"') +
    G('bef', stack(122, 200, 84, 2) + stack(226, 200, 88, 1) + stack(122, 324, 92, 2) + stack(232, 324, 80, 3) + stack(120, 451, 86, 3) + stack(224, 451, 92, 2)) +
    G('pB', nest(118, 451, 62, 5)) + G('pC', nest(190, 451, 62, 5)) + G('pD', nest(262, 451, 58, 4)) +
    G('pA', lid(48, 190) + lid(76, 182)) + G('pB', lid(48, 258) + lid(76, 250)) + G('pC', lid(48, 326) + lid(76, 318)) + G('pD', lid(48, 394) + lid(76, 386) + lid(48, 456) + lid(76, 448)) +
    dim(62, 150, 62, 484, 'flat door area', 1, [56, -150]) + dim(100, 92, 118, 92, 'door-to-shelf gap', 2, [150, 0]) + dim(66, 290, 86, 290, 'biggest lid', 3, [72, 0]) };

  /* 3 · sheet pan under the board */
  S.board = { bot: '#E9E4DB', svg: tiles('tC', 36, '#fff', .35) + `<defs><pattern id="eg" width="34" height="22" patternUnits="userSpaceOnUse"><rect width="34" height="22" fill="#A8743F"/><rect width="17" height="11" fill="#8E5E30"/><rect x="17" y="11" width="17" height="11" fill="#BC8850"/></pattern></defs>` +
    R(0, 0, 360, 640, '#9FB7A6') + R(0, 0, 360, 400, 'url(#tC)') + R(0, 396, 360, 244, '#E9E4DB') + P('M0 430c80-16 150 14 230 0s90 6 130-4M0 500c60 10 140-18 220-4s100-6 140 2', 'fill="none" stroke="#D6CFC3" stroke-width="3"') +
    G('mvA', R(56, 380, 196, 14, '#B4BBC2', 'rx="5"') + R(62, 376, 184, 6, '#D9DEE2', 'rx="3"'), '--x0:-240px') +
    R(108, 364, 16, 32, '#7A4F27', 'rx="3"') + R(300, 364, 16, 32, '#7A4F27', 'rx="3"') + R(96, 322, 232, 44, 'url(#eg)', 'rx="6"') + R(96, 322, 232, 44, 'none', 'rx="6" stroke="#6E4521" stroke-width="2.5"') +
    P('M250 316l60-40 8 10-56 36z', 'fill="#DADFE2"') + P('M310 276l22-16 8 10-22 16z', `fill="${INK}"`) +
    G('mvC', C(128, 314, 8, '#EE8A2E') + C(146, 316, 6, '#EE8A2E') + R(110, 310, 12, 8, '#6FA35A', 'rx="3"') + C(160, 314, 5, '#6FA35A'), '--x0:34px;--y0:0px;--x1:-48px;--y1:60px') +
    G('pD', R(170, 300, 30, 20, '#EE8A2E', 'rx="10"') + R(204, 302, 26, 18, '#EE8A2E', 'rx="9"')) +
    dim(270, 366, 270, 396, 'clearance under the board', 1, [-10, -66]) + dim(124, 420, 300, 420, 'between the feet', 2, [0, 24]) + dim(40, 372, 40, 396, 'pan rim', 3, [10, 40]) };

  /* 4 · lid and ladle rest */
  S.ladle = { bot: '#2E333B', svg: tiles('tD', 44, '#fff', .45) + R(0, 0, 360, 640, '#E3C7A4') + R(0, 0, 360, 440, 'url(#tD)') + R(0, 96, 360, 26, '#6B4A2E') + R(0, 122, 360, 6, '#4E351F') + R(0, 436, 360, 204, '#2E333B') + R(0, 436, 360, 8, '#444B55') +
    R(22, 356, 130, 80, '#E8842C', 'rx="10"') + R(8, 372, 20, 12, '#C96B1D', 'rx="4"') + R(146, 372, 20, 12, '#C96B1D', 'rx="4"') + `<ellipse cx="87" cy="358" rx="62" ry="9" fill="#B5471B"/>` +
    P('M196 368h96l-8 62a8 8 0 0 1-8 6h-64a8 8 0 0 1-8-6z', 'fill="#C9CFD4"') + P('M196 368h96l-3 20h-90z', 'fill="#E4E8EB"') + R(204, 430, 80, 8, '#8D979F', 'rx="4"') +
    G('mvA', C(232, 268, 98, 'rgba(255,255,255,.28)', 'stroke="#E8A13A" stroke-width="12"') + C(232, 268, 78, 'none', 'stroke="rgba(255,255,255,.5)" stroke-width="2"') + R(222, 258, 20, 20, INK, 'rx="10"') + P('M176 220a70 70 0 0 1 40-26', 'fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="5" stroke-linecap="round"'), '--x0:-150px;--y0:70px;--r0:-70deg') +
    G('mvB', P('M300 196l-34 176', 'fill="none" stroke="#6B3F2A" stroke-width="13" stroke-linecap="round"') + P('M246 372h40a20 20 0 0 1-40 0z', 'fill="#6B3F2A"'), '--x0:90px;--y0:-60px;--r0:24deg') +
    G('drip', C(262, 398, 4.5, '#D9531E')) +
    dim(134, 268, 330, 268, 'lid diameter', 1, [0, -22]) + dim(326, 128, 326, 436, 'height under the shelf', 2, [-62, -110]) + dim(176, 462, 310, 462, 'free counter', 3, [0, 24]) };

  /* 5 · the bamboo plate rack */
  const peg = x => R(x, 300, 9, 112, '#E7CB93', 'rx="4.5"') + R(x + 5, 300, 3, 112, '#D2B273', 'rx="1.5"');
  S.rack = { bot: '#B58A58', svg: R(0, 0, 360, 640, '#CFA873') + R(0, 0, 24, 640, '#E6CCA3') + R(336, 0, 24, 640, '#E6CCA3') + R(24, 196, 312, 14, '#E6CCA3') + R(24, 210, 312, 5, '#B58A58') + R(24, 428, 312, 212, '#B58A58') + R(24, 428, 312, 10, '#E6CCA3') +
    G('mvA', R(88, 250, 13, 160, '#B4BBC2', 'rx="3"') + R(84, 250, 21, 6, '#D9DEE2', 'rx="3"'), '--y0:-260px') +
    G('mvB', R(126, 232, 18, 178, '#A8743F', 'rx="5"') + C(135, 248, 4, '#6E4521'), '--y0:-270px') +
    G('mvB', R(168, 272, 12, 138, '#BFDCE3', 'rx="6"') + R(180, 332, 12, 18, INK, 'rx="5"'), '--y0:-300px') +
    G('mvC', R(206, 262, 12, 148, '#BFDCE3', 'rx="6"') + R(218, 326, 12, 18, INK, 'rx="5"'), '--y0:-300px') +
    G('mvC', R(244, 286, 15, 124, '#F1EDE4', 'rx="4"') + R(248, 286, 4, 124, '#D9D3C6'), '--y0:-320px') +
    [70, 110, 150, 190, 230, 270].map(peg).join('') + R(56, 408, 244, 12, '#E7CB93', 'rx="4"') + R(56, 418, 244, 10, '#D2B273', 'rx="4"') +
    G('pD', `<g transform="rotate(-8 286 270)">` + R(254, 252, 66, 34, '#fff', 'rx="5"') + C(264, 269, 3.5, '#CFA873') + `<text x="292" y="275" text-anchor="middle" style="font:700 15px system-ui;fill:#15243B">€4.99</text></g>`) +
    dim(318, 214, 318, 408, 'tallest thing vs. shelf above', 1, [-92, -74]) + dim(56, 452, 300, 452, 'rack length vs. cabinet depth', 2, [0, 24]) + dim(119, 318, 150, 318, 'peg gap', 3, [-56, -36]) };

  /* 6 · hanging shelf over shower glass */
  S.shower = { bot: '#9FB0B3', svg: tiles('tF', 60, '#fff', .55) + R(0, 0, 360, 640, '#B6C6C8') + R(0, 0, 360, 640, 'url(#tF)') + P('M0 0H360V70L0 150z', 'fill="#F3F1EC"') +
    R(86, 168, 250, 472, 'rgba(255,255,255,.2)') + P('M86 640V168H336V640', 'fill="none" stroke="#fff" stroke-width="4"') + P('M300 190l-40 60M318 214l-26 40', 'stroke="#fff" stroke-opacity=".6" stroke-width="4" stroke-linecap="round"') +
    G('mvA', R(128, 150, 200, 20, INK, 'rx="3"') + P('M136 170V358H320V170', `fill="none" stroke="${INK}" stroke-width="10" stroke-linejoin="round"`) + R(136, 346, 184, 12, INK) + R(170, 170, 12, 16, INK) + R(274, 170, 12, 16, INK) +
      G('pB', bottle(158, 268, 34, 80, INK, INK)) + G('pC', bottle(202, 276, 34, 72, INK, INK)) + G('pD', R(246, 310, 40, 38, '#EDEBE6', 'rx="6"') + R(246, 310, 40, 10, '#fff', 'rx="5"') + R(290, 256, 22, 92, '#F7F7F3', 'rx="10"')), '--y0:-300px') +
    G('mvC', P('M96 172c-22 60 6 150-14 250l56 20c24-90-4-190 20-270z', 'fill="#E5CDB8"') + P('M112 180c-14 70 8 150-4 240', 'fill="none" stroke="#D3B69D" stroke-width="3"'), '--x0:-190px;--y0:20px;--r0:-12deg') +
    dim(60, 160, 60, 176, 'glass thickness', 1, [44, -30]) + dim(344, 74, 344, 168, 'glass to ceiling', 2, [-58, 0]) + dim(86, 420, 336, 420, 'fixed panel width', 3, [30, 24]) };

  /* 7 · drawer dividers */
  const roll = (x, y, w, f, stripe) => R(x, y, w, 30, f, 'rx="13"') + (stripe ? P(`M${x + 12} ${y + 6}v18M${x + 24} ${y + 6}v18M${x + 36} ${y + 6}v18M${x + 48} ${y + 6}v18`, `stroke="${INK}" stroke-width="2" stroke-opacity=".7"`) : '') + C(x + w - 13, y + 15, 6, 'none', 'stroke="rgba(0,0,0,.18)" stroke-width="2.5"');
  const lane = (x, cols) => cols.map((c, i) => roll(x, 172 + i * 38, 74, c[0], c[1])).join('');
  S.drawer = { bot: '#D6BA8C', svg: R(0, 0, 360, 640, '#E3C89B') + R(0, 96, 360, 16, '#D0B282') + R(0, 474, 360, 14, '#D0B282') + P('M0 520h360', 'stroke="#D0B282" stroke-width="3"') + R(34, 146, 292, 300, '#F3E3C6', 'rx="8"') + R(48, 160, 264, 272, '#B58A58')  +
    G('bef', P('M62 180c40-20 80 30 120 4s70 20 110-6l10 70c-50 30-90-10-130 16s-80-16-112 6z', 'fill="#F4F1EA"') + P('M70 300c50-24 90 20 130-2s70 14 100-8l-4 96c-60 24-90-12-130 8s-70-10-100 6z', 'fill="#27344F"') + P('M150 240c30-10 60 20 90 0l6 60c-30 16-66-8-96 6z', 'fill="#C9D5E2"')) +
    G('pA', lane(54, [['#F4F1EA'], ['#F4F1EA'], ['#EDE6D8'], ['#F4F1EA'], ['#EDE6D8'], ['#F4F1EA'], ['#EDE6D8']])) +
    G('pB', lane(143, [['#F4F1EA', 1], ['#F4F1EA', 1], ['#F4F1EA', 1], ['#C9D5E2'], ['#C9D5E2'], ['#F4F1EA', 1], ['#C9D5E2']])) +
    G('pC', lane(232, [['#27344F'], ['#27344F'], ['#3A4A6B'], ['#27344F'], ['#3A4A6B'], ['#27344F'], ['#27344F']])) +
    G('mvA', R(132, 160, 7, 272, '#fff', 'rx="3"'), '--y0:-330px') + G('mvB', R(221, 160, 7, 272, '#fff', 'rx="3"'), '--y0:-330px') +
    dim(48, 132, 312, 132, 'inside width', 1) + dim(338, 160, 338, 432, 'inside depth', 2, [-52, 0]) + dim(60, 466, 130, 466, 'and the height of the sides', 3, [112, 0]) };

  /* 8 · pull-out trays for jeans */
  const jean = (y, f) => R(86, y, 150, 30, f, 'rx="9"') + P(`M98 ${y + 9}h118M98 ${y + 20}h118`, 'stroke="#fff" stroke-opacity=".22" stroke-width="2"');
  const tray = y => R(72, y + 30, 178, 8, '#fff', 'rx="3"') + P(`M236 ${y + 34}c0-22 6-30 14-30v30z`, 'fill="#DDE1E4"');
  const JB = ['#3E5F8A', '#2F4A70', '#4A6D99', '#27405F', '#3E5F8A'];
  S.trays = { bot: '#D9DDDA', svg: R(0, 0, 360, 640, '#EDF0EE') + R(0, 0, 28, 640, '#fff') + P('M28 0V640', 'stroke="#D5DAD7" stroke-width="3"') + R(28, 132, 332, 16, '#fff') + R(28, 148, 332, 5, '#D5DAD7') + R(28, 446, 332, 16, '#fff') + R(28, 462, 332, 5, '#D5DAD7') + R(28, 467, 332, 173, '#D9DDDA') +
    G('bef', `<g transform="rotate(7 160 446)">` + [0, 1, 2, 3, 4, 5].map(i => jean(414 - i * 31, JB[i % 5])).join('') + `</g>`) +
    [0, 1, 2, 3].map(i => G(['pA', 'pB', 'pC', 'pD'][i], tray(408 - i * 50) + jean(408 - i * 50, JB[i]))).join('') +
    G('pD', G('mvC', tray(208) + jean(208, JB[4]), '--x0:0px;--x1:-44px')) +
    dim(72, 170, 250, 170, 'shelf width and depth', 1, [0, 22]) + dim(300, 153, 300, 446, 'to the shelf above', 2, [-10, -40]) + dim(268, 358, 268, 396, 'one folded pair + tray', 3, [14, 44]) };

  /* 9 · jewelry cabinet */
  const chain = (x, len, c, w = 3.5) => P(`M${x - 9} 168c-6 ${len * .7} -4 ${len} 9 ${len}s15 ${-len * .3} 9 ${-len}`, `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"`);
  S.jewel = { bot: '#D8C2BA', svg: R(0, 0, 360, 640, '#EAD9D3') + R(0, 540, 360, 100, '#D8C2BA') + R(56, 104, 214, 396, '#fff', 'rx="5"') + R(68, 116, 190, 372, '#17171B') + R(68, 150, 190, 12, '#fff') + P('M270 104L338 128V524L270 500z', 'fill="#C9D9DE" stroke="#fff" stroke-width="5" stroke-linejoin="round"') + P('M292 190l26 16M288 222l34 22', 'stroke="#fff" stroke-opacity=".7" stroke-width="4" stroke-linecap="round"') +
    [90, 126, 162, 198, 234].map(x => P(`M${x} 160v10a5 5 0 0 0 10 0`, 'fill="none" stroke="#B9BEC3" stroke-width="3" stroke-linecap="round"')).join('') +
    G('pA sway', chain(100, 150, '#E2B84B', 5)) + G('pB sway', chain(136, 110, '#C9CFD4')) + G('pC sway', chain(172, 176, '#E2B84B') + C(172, 348, 7, '#E2B84B')) + G('pD sway', chain(208, 92, '#E2B84B', 2.5)) + G('pB sway', chain(244, 130, '#C9CFD4', 4.5)) +
    R(68, 392, 190, 8, '#fff') + R(68, 430, 190, 8, '#fff') + G('pC', [84, 108, 132, 156, 180, 204, 228].map((x, i) => C(x, 408, 5, i % 2 ? '#E2B84B' : '#C9CFD4') + C(x + 6, 446, 4.5, i % 3 ? '#C9CFD4' : '#E2B84B')).join('')) +
    R(76, 462, 174, 22, 'rgba(255,255,255,.22)', 'rx="4" stroke="#fff" stroke-opacity=".6" stroke-width="2"') +
    dim(152, 168, 152, 350, 'longest necklace', 1, [-30, 30]) + dim(270, 516, 338, 540, 'room for the door to swing', 2, [-76, -40]) + dim(40, 112, 40, 492, 'wall space, and a stud', 3, [66, -110]) };

  /* 10 · ornament chest */
  const orn = (x, y, f, s) => C(x, y, 24, f) + R(x - 6, y - 32, 12, 10, '#E2B84B', 'rx="2"') + C(x, y - 34, 4, 'none', 'stroke="#E2B84B" stroke-width="2"') + (s ? P(`M${x - 14} ${y - 6}c8-10 20-10 28 0`, 'fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="3" stroke-linecap="round"') : C(x - 8, y - 8, 4, '#fff', 'fill-opacity=".55"'));
  const OC = ['#B5262E', '#E2B84B', '#7E8F5E', '#E2B84B', '#B5262E', '#7E8F5E', '#7E8F5E', '#B5262E', '#E2B84B'];
  S.ornament = { bot: '#24392F', svg: R(0, 0, 360, 640, '#2F4A3F') + P('M0 60c60 30 120-20 180 6s120-10 180 10M0 560c80-20 140 16 220 0s100 10 140-4', 'fill="none" stroke="#3B5C4E" stroke-width="5"') + [[40, 120], [320, 100], [300, 540], [50, 520], [180, 70]].map(p => P(`M${p[0]} ${p[1] - 9}v18M${p[0] - 9} ${p[1]}h18`, 'stroke="#E2B84B" stroke-opacity=".7" stroke-width="2.5" stroke-linecap="round"')).join('') +
    G('mvC', R(46, 196, 268, 268, '#0E0E11', 'rx="14"') + R(58, 208, 244, 244, '#1E1E24', 'rx="8"'), '--y0:0px;--y1:36px') +
    R(46, 168, 268, 268, '#17171B', 'rx="14"') + R(58, 180, 244, 244, '#26262D', 'rx="8"') + P('M139 180v244M221 180v244M58 261h244M58 343h244', 'stroke="#0E0E11" stroke-width="5"') + R(314, 266, 16, 72, '#17171B', 'rx="6"') +
    OC.map((f, i) => G(['pA', 'pB', 'pC', 'pD'][(i * 3) % 4], orn(98 + (i % 3) * 82, 226 + Math.floor(i / 3) * 82, f, i % 2))).join('') +
    dim(58, 150, 139, 150, 'one cell', 1, [0, -22]) + dim(156, 308, 204, 308, 'your biggest ornament', 2, [0, -34]) + dim(46, 452, 314, 452, 'the shelf it lives on', 3, [0, 0]) };

  /* 11 · wall phone dock */
  S.phone = { bot: '#4B4A59', svg: R(0, 0, 360, 640, '#5F5E6E') + R(0, 0, 70, 640, '#F3F1EC') + R(0, 0, 54, 640, '#DCE4EA') + P('M0 80h54M0 150h54M0 220h54M0 290h54M0 360h54', 'stroke="#fff" stroke-width="6"') + R(0, 560, 360, 80, '#4B4A59') + R(0, 548, 360, 14, '#F3F1EC') +
    R(140, 176, 100, 150, '#E3C24A', 'rx="14"') + R(140, 300, 100, 26, '#CDAA33', 'rx="10"') + R(160, 318, 60, 14, '#E3C24A', 'rx="6"') +
    G('mvA', R(156, 150, 68, 138, '#15151A', 'rx="12"') + R(162, 156, 56, 126, '#2B2B36', 'rx="8"') + C(190, 166, 3, '#55556A') + G('pD', R(170, 196, 40, 6, '#E3C24A', 'rx="3"') + R(176, 210, 28, 5, '#fff', 'rx="2.5" fill-opacity=".6"')), '--y0:-260px;--r0:-8deg') +
    G('sway2', P('M190 332' + Array.from({ length: 13 }, (_, i) => `q${i % 2 ? -16 : 16} 6 0 12`).join('') + 'c0 30 60 30 90 16', 'fill="none" stroke="#E3C24A" stroke-width="6" stroke-linecap="round"')) +
    R(272, 478, 46, 62, '#F3F1EC', 'rx="6"') + R(286, 490, 5, 12, '#5F5E6E', 'rx="2"') + R(299, 490, 5, 12, '#5F5E6E', 'rx="2"') + R(286, 514, 5, 12, '#5F5E6E', 'rx="2"') + R(299, 514, 5, 12, '#5F5E6E', 'rx="2"') +
    dim(156, 128, 224, 128, 'phone width, in its case', 1, [20, -22]) + dim(252, 300, 296, 470, 'reach to the outlet', 2, [-8, -40]) + dim(108, 176, 108, 326, 'screws or adhesive?', 3, [10, 110]) };

  window.SCENES = S;
})();
