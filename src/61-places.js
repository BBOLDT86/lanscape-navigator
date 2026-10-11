/* ===================================================================
   FTP servers, Apache "Index of" listings, and the Program Manager
   =================================================================== */
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function ftpDate(ts) {
  const d = new Date(ts || 0);
  return DOW[d.getDay()] + ' ' + MONTHS[d.getMonth()] + ' ' + pad(d.getDate(), 2) + ' ' + pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2) + ':' + pad(d.getSeconds(), 2) + ' ' + d.getFullYear();
}
function apacheDate(ts) {
  const d = new Date(ts || 0);
  return pad(d.getDate(), 2) + '-' + MONTHS[d.getMonth()] + '-' + d.getFullYear() + ' ' + pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2);
}
const FTP_TYPE = { html: 'HTML Document', text: 'Plain Text', md: 'Markdown Text', rtf: 'Rich Text', docx: 'Word Document', legacy: 'Office Document', sheet: 'Spreadsheet', pdf: 'PDF Document', slides: 'Presentation', code: 'Source Code', image: 'Image', audio: 'Sound', video: 'Movie', font: 'Font', archive: 'ZIP Archive', other: 'Binary File' };
function readmeOf(node) {
  if (!node) return null;
  return node.files.find(d => /^(readme|read\.me|00readme|index)(\.(txt|md|1st|nfo))?$/i.test(d.name) && (d.kind === 'text' || d.kind === 'md')) ||
    node.files.find(d => /^readme/i.test(d.name) && (d.kind === 'text' || d.kind === 'md')) || null;
}
async function readmeText(d) {
  if (!d) return '';
  try { return (await getText(d)).slice(0, 4000); } catch (e) { return ''; }
}
function sortListing(node, how) {
  const dirs = Array.from(node.dirs).map(p => ({ dir: true, path: p, name: p.slice(0, -1).split('/').pop(), size: 0, mtime: 0 }));
  for (const x of dirs) { const n = S.tree.get(x.path); x.mtime = n ? Math.max(0, ...n.files.map(f => f.mtime || 0)) : 0; }
  const files = node.files.map(d => ({ dir: false, d, name: d.name, size: d.size || 0, mtime: d.mtime || 0 }));
  const key = (how || 'n').charAt(0), desc = /d$/.test(how || '');
  const cmp = (a, b) => key === 's' ? a.size - b.size : key === 'm' ? a.mtime - b.mtime : a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  dirs.sort(cmp); files.sort(cmp);
  if (desc) { dirs.reverse(); files.reverse(); }
  return dirs.concat(files);
}
const FTP_CSS = `body{background:#fff;color:#000;font:14px/1.4 "Times New Roman",Times,serif;margin:10px 14px}
h1{font:bold 22px "Times New Roman",serif;margin:6px 0 12px}
pre.banner{background:#000;color:#c0c0c0;font:12px/1.35 "Courier New",monospace;padding:8px 10px;margin:0 0 12px;white-space:pre-wrap;max-width:860px}
pre.banner b{color:#fff;font-weight:normal}
table.ftp{border-collapse:collapse;font:13px/1.5 "Courier New",Courier,monospace}
table.ftp td{padding:1px 14px 1px 0;white-space:nowrap;vertical-align:middle}
table.ftp td.sz{text-align:right}
table.ftp svg{vertical-align:-3px}
table.ftp th{text-align:left;font:bold 13px "Courier New",monospace;padding:0 14px 4px 0}
table.ftp th a{color:#000}
.up{display:inline-flex;gap:6px;align-items:center;margin:0 0 8px}
.foot{margin-top:18px;font:11px Arial,sans-serif;color:#555}`;
/** Netscape's FTP view: "Current directory is /pub" */
async function ftpListing(host, root, dir, rel, q) {
  const node = S.tree.get(dir);
  const how = (q && q.get('sort')) || 'n';
  const items = sortListing(node, how);
  const base = 'ftp://' + host + '/';
  const shown = '/' + rel;
  let banner = '';
  if (!rel) {
    const all = Array.from(S.tree.keys()).filter(p => p.startsWith(root + '/'));
    const files = all.reduce((a, p) => a + S.tree.get(p).files.length, 0);
    const bytes = all.reduce((a, p) => a + S.tree.get(p).files.reduce((b, d) => b + (d.size || 0), 0), 0);
    banner = '220 ' + host + ' FTP server (LANscape wu-2.4.2-academ[BETA-18](1)) ready.\n331 Guest login ok, send your complete e-mail address as password.\n230-Welcome to <b>' + esc(host) + '</b>, the FTP server for your <b>' + esc(root) + '</b> folder.\n230-There are ' + files.toLocaleString() + ' files in ' + all.length + ' directories (' + fmtBytes(bytes) + ').\n230-All transfers are logged. If you don\'t like this policy, disconnect now.\n230 Guest login ok, access restrictions apply.';
  }
  const rd = readmeOf(node);
  const rtext = await readmeText(rd);
  if (rtext) banner += (banner ? '\n' : '') + '250-' + esc(rd.name) + ':\n' + esc(rtext).split('\n').map(l => '250-' + l).join('\n') + '\n250 CWD command successful.';
  const parent = rel ? rel.slice(0, -1).split('/').slice(0, -1).join('/') : null;
  const sortLink = (k, label) => '<a href="' + base + encPath(rel) + '?sort=' + k + (how === k ? 'd' : '') + '">' + label + '</a>';
  const rows = items.map(x => {
    if (x.dir) {
      const name = x.name + '/';
      return '<tr><td>' + FILE_ICON.folder + ' <a href="' + base + encPath(x.path.slice(root.length + 1)) + '">' + esc(name) + '</a></td><td class="sz"></td><td>' + (x.mtime ? esc(ftpDate(x.mtime)) : '') + '</td><td>Directory</td></tr>';
    }
    const d = x.d;
    return '<tr><td>' + iconFor(d) + ' <a href="' + esc(d.ftp) + '">' + esc(d.name) + '</a></td><td class="sz">' + Math.max(1, Math.round((d.size || 0) / 1024)) + ' Kb</td><td>' + esc(ftpDate(d.mtime)) + '</td><td>' + esc(FTP_TYPE[d.kind] || 'File') + '</td></tr>';
  }).join('');
  return page('Directory of ' + shown, `${banner ? '<pre class="banner">' + banner + '</pre>' : ''}<h1>Current directory is ${esc(shown)}</h1>
${parent != null ? '<div class="up">' + FILE_ICON.parent + ' <a href="' + base + encPath(parent ? parent + '/' : '') + '">Up to higher level directory</a></div>' : ''}
<table class="ftp"><tr><th>${sortLink('n', 'Name')}</th><th style="text-align:right">${sortLink('s', 'Size')}</th><th>${sortLink('m', 'Date')}</th><th>Type</th></tr>${rows || '<tr><td colspan="4"><i>This directory is empty.</i></td></tr>'}</table>
<p class="foot">${items.length} item${items.length === 1 ? '' : 's'} &middot; ${A('http://home.lanscape.net/programs', 'Programs')} &middot; ${A('http://home.lanscape.net/', 'LANscape Home')}</p>`, { css: FTP_CSS });
}
function ftpError(host, path) {
  return page('FTP Error', `<h1>FTP Error</h1><pre class="banner">550 ${esc(path)}: No such file or directory.</pre><p>${A('ftp://' + host + '/', 'Go to the top of ' + esc(host))}</p>`, { css: FTP_CSS });
}
/** Apache's listing for a website folder that has no index page */
async function indexOfPage(site, dir, rel, q) {
  const node = S.tree.get(dir);
  const how = ({ N: 'n', M: 'm', S: 's' })[(q.get('C') || 'N').toUpperCase()] + ((q.get('O') || 'A').toUpperCase() === 'D' ? 'd' : '');
  const items = sortListing(node, how);
  const here = site.url.replace(/\/$/, '') + '/' + encPath(rel);
  const rd = readmeOf(node), rtext = await readmeText(rd);
  const col = (c, label) => '<a href="' + here + '?C=' + c + '&amp;O=' + ((q.get('C') || 'N').toUpperCase() === c && (q.get('O') || 'A').toUpperCase() === 'A' ? 'D' : 'A') + '">' + label + '</a>';
  const up = rel.replace(/[^/]+\/$/, '');
  const rows = '<tr><td>' + FILE_ICON.parent + ' <a href="' + site.url.replace(/\/$/, '') + '/' + encPath(up) + '">Parent Directory</a></td><td></td><td class="sz">-</td><td></td></tr>' + items.map(x => {
    if (x.dir) return '<tr><td>' + FILE_ICON.folder + ' <a href="' + here + encodeURIComponent(x.name) + '/">' + esc(x.name) + '/</a></td><td>' + (x.mtime ? apacheDate(x.mtime) : '') + '</td><td class="sz">-</td><td></td></tr>';
    const d = x.d;
    return '<tr><td>' + iconFor(d) + ' <a href="' + here + encodeURIComponent(d.name) + '">' + esc(d.name) + '</a></td><td>' + apacheDate(d.mtime) + '</td><td class="sz">' + fmtK(d.size) + '</td><td>' + esc(clip(d.meta.title !== d.name ? d.meta.title : (FTP_TYPE[d.kind] || ''), 40)) + '</td></tr>';
  }).join('');
  return page('Index of /' + rel, `<h1>Index of /${esc(rel)}</h1>
<table class="ftp"><tr><th>${col('N', 'Name')}</th><th>${col('M', 'Last modified')}</th><th style="text-align:right">${col('S', 'Size')}</th><th>Description</th></tr><tr><td colspan="4"><hr></td></tr>${rows}<tr><td colspan="4"><hr></td></tr></table>
${rtext ? '<pre style="font:13px/1.4 Courier New,monospace;white-space:pre-wrap;max-width:860px">' + esc(rtext) + '</pre>' : ''}
<address style="font:italic 13px Times New Roman,serif">Apache/1.3.6 Server at ${esc(site.host)} Port 80</address>`, { css: FTP_CSS });
}

/* ---------------- Program Manager ---------------- */
const PM_CSS = `body{margin:0;background:#008080;font:12px/1.3 "MS Sans Serif",Tahoma,Arial,sans-serif;padding:14px}
.pm{max-width:980px;margin:0 auto;background:#c0c0c0;border:2px solid #000;box-shadow:4px 4px 0 rgba(0,0,0,.35)}
.pm-t{background:#000080;color:#fff;font-weight:bold;padding:3px 6px;display:flex;justify-content:space-between;align-items:center}
.pm-t span.b{display:inline-block;width:16px;height:14px;background:#c0c0c0;border:1px solid #fff;border-right-color:#000;border-bottom-color:#000;margin-left:2px}
.pm-m{padding:2px 6px;border-bottom:1px solid #808080}
.pm-m u{margin-right:14px;text-decoration:none}.pm-m u::first-letter{text-decoration:underline}
.pm-b{background:#fff;margin:4px;border:2px inset #c0c0c0;padding:10px;display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;min-height:320px;align-items:start}
.grp{border:1px solid #000;background:#fff}
.grp .gt{background:#000080;color:#fff;font-weight:bold;padding:2px 6px;text-align:center}
.grp.ia .gt{background:#808080;color:#c0c0c0}
.icons{display:flex;flex-wrap:wrap;gap:6px;padding:10px}
.ic{width:84px;text-align:center;text-decoration:none;color:#000;padding:4px 2px}
.ic svg{width:32px;height:32px;display:block;margin:0 auto 4px}
.ic span{display:block;font-size:11px;line-height:1.2;overflow-wrap:anywhere}
.ic:focus span,.ic:hover span{background:#000080;color:#fff}
.ic small{display:block;color:#666;font-size:10px}
.rec{list-style:none;margin:0;padding:8px 10px;font-size:12px}
.rec li{display:flex;gap:6px;align-items:center;padding:2px 0}
.rec li span{color:#666;margin-left:auto;font-size:11px;white-space:nowrap}
.pm-s{padding:4px 8px;font-size:11px;color:#000}`;
function programsPage() {
  const icon = (svg, label, url, sub, title) => '<a class="ic" href="' + esc(url) + '" title="' + esc(title || label) + '">' + svg + '<span>' + esc(label) + '</span>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</a>';
  const progs = PROGRAMS.map(p => icon(PROG_ICON[p.id], progName(p), p.url, '', progBlurb(p))).join('');
  const c = libraryCounts();
  const recent = (S.recentDocs || []).map(r => S.docs.get(r.path)).filter(d => d && d.active).slice(0, 12);
  const ftp = Array.from(S.ftpHosts.entries()).map(([h, r]) => icon(PROG_ICON[r === VROOT ? 'docs' : 'ftp'], r, 'ftp://' + h + '/', h)).join('');
  return page('Program Manager', `<div class="pm"><div class="pm-t">Program Manager<span><span class="b"></span><span class="b"></span></span></div>
<div class="pm-m"><u>File</u><u>Options</u><u>Window</u><u>Help</u></div>
<div class="pm-b">
<div class="grp"><div class="gt">LANscape Programs</div><div class="icons">${progs}</div></div>
<div class="grp ia"><div class="gt">Accessories &amp; New Files</div><div class="icons">
${icon(PROG_ICON.write, 'New Document', 'http://write.lanscape.net/')}${icon(PROG_ICON.ledger, 'New Spreadsheet', 'http://ledger.lanscape.net/')}${icon(PROG_ICON.notepad, 'New Text File', 'http://notepad.lanscape.net/')}${icon(PROG_ICON.ftp, 'Add Folder...', 'lanscape:add-folder')}${icon(PROG_ICON.docs, 'Manage Folders', 'lanscape:folders', '', 'Turn folders and subfolders on and off, re-sync, remove')}</div></div>
<div class="grp ia"><div class="gt">FTP Sites</div><div class="icons">${ftp || '<p style="padding:8px">Open a folder and it gets its own FTP server here.</p>'}</div></div>
<div class="grp ia"><div class="gt">Recent Documents</div>${recent.length ? '<ul class="rec">' + recent.map(d => '<li>' + iconFor(d) + A(d.url, esc(clip(d.meta.title || d.name, 46))) + '<span>' + esc(ago((S.recentDocs.find(r => r.path === d.path) || {}).ts || d.mtime)) + '</span></li>').join('') + '</ul>' : '<p style="padding:8px 10px">Files you open show up here.</p>'}</div>
</div>
<div class="pm-s">${c.documents} documents &middot; ${c.songs} songs &middot; ${c.videos} videos &middot; ${c.pictures} pictures &middot; ${c.files} other files &middot; ${A('http://home.lanscape.net/', 'LANscape Home')}</div></div>`, { css: PM_CSS });
}
function libraryCounts() {
  const c = { pages: 0, documents: 0, songs: 0, videos: 0, pictures: 0, files: 0 };
  for (const d of docsShown()) {
    if (d.kind === 'html') c.pages++;
    else if (K(d).cls === 'document') c.documents++;
    else if (d.kind === 'audio') c.songs++;
    else if (d.kind === 'video') c.videos++;
    else if (d.kind === 'image' && !d.asset) c.pictures++;
    else c.files++;
  }
  return c;
}
