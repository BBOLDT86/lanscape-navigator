/* ===================================================================
   Embedded libraries (pdf.js for Reader, pdf-lib for mark-up export).
   They ship gzipped + base64 inside this file and unpack on first use.
   =================================================================== */
const Libs = (() => {
  const cache = new Map();
  async function unpack(id) {
    const holder = document.getElementById(id);
    if (!holder) throw new Error('Part of LANscape is missing (' + id + '). Download the file again.');
    if (typeof DecompressionStream !== 'function') throw new Error('This browser is too old to unpack LANscape Reader. Try a current Chrome, Edge, Firefox or Safari.');
    const u8 = base64ToU8(holder.textContent.replace(/\s+/g, ''));
    return new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  }
  function inject(code) { const s = document.createElement('script'); s.textContent = code; document.head.append(s); s.remove(); }
  const once = (key, fn) => { if (!cache.has(key)) cache.set(key, fn().catch(e => { cache.delete(key); throw e; })); return cache.get(key); };
  return {
    pdfjs: () => once('pdfjs', async () => {
      if (!window.pdfjsLib) inject(await unpack('lib-pdfjs'));
      const lib = window.pdfjsLib;
      if (!lib) throw new Error('PDF.js didn\'t start.');
      const url = URL.createObjectURL(new Blob([await unpack('lib-pdfjs-worker')], { type: 'text/javascript' }));
      lib.GlobalWorkerOptions.workerSrc = url;
      // pdf.js won't start a worker itself from a file:// page (its origin is "null"), so hand it one
      try { lib.GlobalWorkerOptions.workerPort = new Worker(url); } catch (e) { /* pdf.js falls back to the main thread */ }
      return lib;
    }),
    pdflib: () => once('pdflib', async () => {
      if (!window.PDFLib) inject(await unpack('lib-pdflib'));
      if (!window.PDFLib) throw new Error('pdf-lib didn\'t start.');
      return window.PDFLib;
    })
  };
})();
