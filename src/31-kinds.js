/* ===================================================================
   File kinds: what every extension is, how it's addressed, which app opens it
   cls: page (html sites) · document (own domain, joins rings) · media (app hosts) · file (ftp)
   =================================================================== */
const KINDS = {
  html:    { cls: 'page',     app: 'browser',  label: 'Web page',      badge: '' },
  text:    { cls: 'document', app: 'notepad',  label: 'Text document', badge: 'TXT' },
  md:      { cls: 'document', app: 'write',    label: 'Markdown document', badge: 'MD' },
  rtf:     { cls: 'document', app: 'write',    label: 'Rich Text document', badge: 'RTF' },
  docx:    { cls: 'document', app: 'write',    label: 'Word document', badge: 'DOC' },
  legacy:  { cls: 'document', app: 'write',    label: 'Older Office document', badge: 'DOC' },
  sheet:   { cls: 'document', app: 'ledger',   label: 'Spreadsheet',   badge: 'XLS' },
  pdf:     { cls: 'document', app: 'reader',   label: 'PDF document',  badge: 'PDF' },
  slides:  { cls: 'document', app: 'slides',   label: 'Presentation',  badge: 'PPT' },
  code:    { cls: 'file',     app: 'notepad',  label: 'Source file',   badge: 'CODE' },
  image:   { cls: 'media',    app: 'photos',   label: 'Picture',       badge: 'IMG' },
  audio:   { cls: 'media',    app: 'jukebox',  label: 'Song',          badge: 'MP3' },
  video:   { cls: 'media',    app: 'rewind',   label: 'Video',         badge: 'VIDEO' },
  font:    { cls: 'file',     app: 'fontview', label: 'Font',          badge: 'FONT' },
  archive: { cls: 'file',     app: 'zipview',  label: 'ZIP archive',   badge: 'ZIP' },
  other:   { cls: 'file',     app: 'fileinfo', label: 'File',          badge: 'FILE' }
};
const EXT_KIND = {};
const setKind = (kind, list) => list.split(' ').forEach(e => { EXT_KIND[e] = kind; });
setKind('html', 'html htm xhtml shtml');
setKind('text', 'txt text log nfo diz me 1st');
setKind('md', 'md markdown mdown mkd');
setKind('rtf', 'rtf');
setKind('docx', 'docx docm dotx');
setKind('legacy', 'doc xls ppt wpd wps');
setKind('sheet', 'csv tsv xlsx xlsm xltx');
setKind('pdf', 'pdf');
setKind('slides', 'pptx ppsx potx');
setKind('code', 'js mjs cjs ts tsx jsx css scss sass less json jsonc xml xsl yaml yml toml ini cfg conf properties env py pyw rb php java c h cpp cc hpp cs go rs swift kt kts sh bash zsh fish bat cmd ps1 sql r m mm pl pm lua vb vbs asm s tex bib gradle make mk cmake dockerfile gitignore htaccess srt vtt ics vcf');
setKind('image', 'png jpg jpeg jpe jfif gif webp bmp ico avif svg tif tiff heic heif');
setKind('audio', 'mp3 m4a aac wav wave ogg oga flac opus weba mid midi kar rmi wma aif aiff');
setKind('video', 'mp4 m4v webm mov mkv ogv avi wmv flv mpg mpeg 3gp m2ts');
setKind('font', 'ttf otf woff woff2');
setKind('archive', 'zip');
function kindOf(name) {
  const ext = extOf(name);
  if (!ext && /^(makefile|dockerfile|readme|license|changelog|authors|copying)$/i.test(name)) return /^readme|license|changelog|authors|copying/i.test(name) ? 'text' : 'code';
  return EXT_KIND[ext] || 'other';
}
const K = d => KINDS[d.kind] || KINDS.other;
const isSiteKind = d => !d.asset && (K(d).cls === 'page' || K(d).cls === 'document');
function badgeFor(d) {
  const k = K(d);
  if (d.kind === 'audio' || d.kind === 'image') return (d.ext || k.badge).toUpperCase().slice(0, 4);
  if (d.kind === 'sheet') return d.ext === 'csv' || d.ext === 'tsv' ? d.ext.toUpperCase() : 'XLS';
  if (d.kind === 'code') return (d.ext || 'code').toUpperCase().slice(0, 4);
  return k.badge;
}
// file types whose content LANscape keeps a copy of in IndexedDB
function cacheable(d, size) {
  if (d.kind === 'html' || d.kind === 'text' || d.kind === 'md' || d.kind === 'rtf' || d.kind === 'code') return size <= 12e6;
  if (d.kind === 'docx' || d.kind === 'sheet' || d.kind === 'slides' || d.kind === 'pdf' || d.kind === 'legacy') return size <= 40e6;
  if (d.asset) return size <= 8e6;
  if (d.kind === 'image' || d.kind === 'font') return size <= 1.5e6;
  return false;
}
const TEXTUAL = new Set(['html', 'text', 'md', 'rtf', 'code']);
const isTextual = d => TEXTUAL.has(d.kind) || (d.kind === 'sheet' && (d.ext === 'csv' || d.ext === 'tsv'));

/* ---------------- small icons for listings (16px inline SVG) ---------------- */
const FILE_ICON = (() => {
  const doc = (fill, mark) => '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 1h7l3 3v11H3z" fill="#fff" stroke="#555"/><path d="M10 1v3h3" fill="none" stroke="#555"/>' + (mark || '') + '<rect x="2" y="9" width="9" height="5" fill="' + fill + '"/></svg>';
  return {
    folder: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M1 4h5l1 1.5h8V14H1z" fill="#f2c94c" stroke="#8a6d00"/></svg>',
    parent: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2 3 8h3v6h4V8h3z" fill="#4a90d9" stroke="#1d4f8a"/></svg>',
    html: doc('#2f6fdc'), text: doc('#888'), md: doc('#555'), rtf: doc('#6b4fbb'), docx: doc('#2b579a'), legacy: doc('#2b579a'),
    sheet: doc('#217346'), pdf: doc('#d32f2f'), slides: doc('#d24726'), code: doc('#00838f'),
    image: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="1" y="2" width="14" height="12" fill="#bfe3ff" stroke="#3a6ea5"/><circle cx="11" cy="6" r="1.8" fill="#ffd34d"/><path d="M1 13 6 7l4 4 2-2 3 4z" fill="#3c9a50"/></svg>',
    audio: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3v8.2A2.3 2.3 0 1 0 7.4 13V6l5-1.2v4.4A2.3 2.3 0 1 0 13.8 11V2z" fill="#7b3fbf"/></svg>',
    video: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="1" y="3" width="14" height="10" fill="#222" stroke="#000"/><path d="M6.5 6v4l3.5-2z" fill="#fff"/><path d="M2 4h1v1H2zM2 7h1v1H2zM2 10h1v1H2zM13 4h1v1h-1zM13 7h1v1h-1zM13 10h1v1h-1z" fill="#888"/></svg>',
    font: doc('#444', '<text x="5" y="8" font-size="6" font-family="serif" font-weight="bold">A</text>'),
    archive: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2" width="12" height="12" fill="#e8d28a" stroke="#7a6420"/><path d="M8 2v12" stroke="#7a6420" stroke-dasharray="1.5 1.5"/></svg>',
    other: doc('#999')
  };
})();
const iconFor = d => FILE_ICON[d.kind] || FILE_ICON.other;
