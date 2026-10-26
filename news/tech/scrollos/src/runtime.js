/* ScrollOS runtime — shared by every tool. One local model at localhost:11434 (Ollama's REST API), streamed into the page.
   Nothing here talks to any other host. Settings live in this browser under localStorage "scrollos.llm". */
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const HUB = 'https://bboldt86.github.io/lanscape-navigator/news/tech/scrollos/';
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
};
const uid = () => Math.random().toString(36).slice(2, 10);
const fmtN = n => n == null ? '—' : Math.round(n).toLocaleString();
function toast(msg, ms = 2400) { let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); } t.textContent = msg; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), ms); }
function download(name, text, type = 'text/plain') { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
async function copyText(t) { try { await navigator.clipboard.writeText(t); toast('Copied'); } catch (e) { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('Copied'); } }
function hashParam(k) { const m = location.hash.match(new RegExp('[#&]' + k + '=([^&]*)')); return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : ''; }
function parseJSONLoose(s) { // the model's JSON, with fences or chatter around it
  if (!s) return null;
  let t = String(s).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(t); } catch (e) { /* fall through */ }
  const a = t.indexOf('{'), b = t.lastIndexOf('}'), c = t.indexOf('['), d = t.lastIndexOf(']');
  const cands = [];
  if (a >= 0 && b > a) cands.push(t.slice(a, b + 1));
  if (c >= 0 && d > c) cands.push(t.slice(c, d + 1));
  cands.sort((x, y) => y.length - x.length);
  for (const x of cands) { try { return JSON.parse(x); } catch (e) { /* next */ } }
  return null;
}
/* a small Markdown renderer: headings, lists, code, quotes, tables, emphasis, links */
function md(src) {
  const lines = String(src || '').replace(/\r/g, '').split('\n');
  let html = '', i = 0, para = [];
  const inline = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>').replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  const flush = () => { if (para.length) { html += `<p>${inline(para.join(' '))}</p>`; para = []; } };
  while (i < lines.length) {
    const l = lines[i];
    if (/^```/.test(l)) { flush(); let j = i + 1, code = []; while (j < lines.length && !/^```/.test(lines[j])) code.push(lines[j++]); html += `<pre><code>${esc(code.join('\n'))}</code></pre>`; i = j + 1; continue; }
    const h = l.match(/^(#{1,6})\s+(.*)/); if (h) { flush(); html += `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`; i++; continue; }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { flush(); html += '<hr>'; i++; continue; }
    if (/^\s*>/.test(l)) { flush(); let q = []; while (i < lines.length && /^\s*>/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, '')); html += `<blockquote>${md(q.join('\n'))}</blockquote>`; continue; }
    if (/^\s*\|/.test(l) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) { flush(); const rows = []; while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]); const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => inline(c.trim())); const head = cells(rows[0]); html += `<table><thead><tr>${head.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.slice(2).map(r => `<tr>${cells(r).map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`; continue; }
    const li = l.match(/^\s*([-*+]|\d+[.)])\s+(.*)/);
    if (li) { flush(); const ord = /\d/.test(li[1]); let items = []; while (i < lines.length) { const m = lines[i].match(/^\s*([-*+]|\d+[.)])\s+(.*)/); if (!m) { if (/^\s{2,}\S/.test(lines[i]) && items.length) { items[items.length - 1] += ' ' + lines[i].trim(); i++; continue; } break; } items.push(m[2]); i++; } html += `<${ord ? 'ol' : 'ul'}>${items.map(x => `<li>${inline(x)}</li>`).join('')}</${ord ? 'ol' : 'ul'}>`; continue; }
    if (!l.trim()) { flush(); i++; continue; }
    para.push(l.trim()); i++;
  }
  flush(); return html;
}

/* ================= the model ================= */
const SOS = {
  KEY: 'scrollos.llm',
  cfg: null, models: [], state: 'idle', lastError: '', version: '', current: null,
  defaults() { return { host: 'http://localhost:11434', model: '', temp: 0.7, ctx: 16384 }; },
  load() { this.cfg = Object.assign(this.defaults(), store.get(this.KEY, {})); return this.cfg; },
  save() { store.set(this.KEY, this.cfg); },
  host() { return (this.cfg.host || 'http://localhost:11434').replace(/\/+$/, ''); },
  prompts() { return store.get('scrollos.prompts', {}); },
  system(fallback) { const p = this.prompts()[TOOL.scroll]; return (p && p.trim()) || fallback || TOOL.system; },
  async tags() {
    const r = await fetch(this.host() + '/api/tags', { signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return ((await r.json()).models || []).map(m => ({ name: m.name, size: m.size, family: m.details && m.details.family, params: m.details && m.details.parameter_size, quant: m.details && m.details.quantization_level }));
  },
  async probe() {
    this.setState('busy');
    try {
      this.models = await this.tags();
      try { const v = await fetch(this.host() + '/api/version', { signal: AbortSignal.timeout(3000) }); if (v.ok) this.version = (await v.json()).version || ''; } catch (e) { /* older servers */ }
      if (!this.models.length) { this.lastError = 'Ollama is running but has no models yet. Pull one: ollama pull gpt-oss:20b'; this.setState('no'); return false; }
      if (!this.models.find(m => m.name === this.cfg.model)) { this.cfg.model = this.pickDefault(); this.save(); }
      this.lastError = ''; this.setState('ok'); return true;
    } catch (e) {
      this.lastError = this.explain(e); this.setState('no'); return false;
    }
  },
  pickDefault() { const pref = ['gpt-oss', 'gemma4', 'qwen3.6', 'qwen3', 'llama3', 'mistral', 'gemma']; for (const p of pref) { const m = this.models.find(x => x.name.startsWith(p)); if (m) return m.name; } return this.models[0] ? this.models[0].name : ''; },
  explain(e) {
    const o = location.origin === 'null' || location.protocol === 'file:' ? 'this file' : location.origin;
    if (e && e.name === 'TimeoutError') return `No answer from ${this.host()} in 5 seconds. Is Ollama running?`;
    if (e && (e.name === 'TypeError' || /fetch/i.test(e.message))) return `Couldn't reach ${this.host()} from ${o}. Either Ollama isn't running, or it hasn't been told to accept pages from here: set OLLAMA_ORIGINS="*" (or "${location.origin === 'null' ? 'file://*' : location.origin}") and restart it. The hub's Connect section has the exact commands.`;
    return (e && e.message) || String(e);
  },
  setState(s) { this.state = s; document.dispatchEvent(new CustomEvent('sos:state', { detail: s })); },
  ready() { return this.state === 'ok' && !!this.cfg.model; },
  whenReady(fn) { // run once the first probe has settled, if a model is there
    if (this.ready()) { fn(); return; }
    const run = () => { if (SOS.state === 'busy' || SOS.state === 'idle') return; document.removeEventListener('sos:state', run); if (SOS.ready()) fn(); };
    document.addEventListener('sos:state', run);
  },
  require() { if (this.ready()) return true; toast(this.state === 'busy' ? 'Still looking for the model…' : 'No local model connected yet'); openSheet(); return false; },
  stop() { if (this.current) { try { this.current.abort(); } catch (e) { /* done */ } this.current = null; } },
  async chat(o) {
    const sys = o.system === undefined ? this.system() : o.system;
    const body = { model: o.model || this.cfg.model, stream: true, messages: [...(sys ? [{ role: 'system', content: sys }] : []), ...o.messages], options: Object.assign({ temperature: o.temperature == null ? this.cfg.temp : o.temperature, num_ctx: o.ctx || this.cfg.ctx }, o.options || {}) };
    if (o.json) body.format = 'json';
    if (o.keepAlive) body.keep_alive = o.keepAlive;
    const ctrl = new AbortController(); this.current = ctrl;
    const t0 = performance.now(); let first = 0, text = '', think = '', last = null;
    this.setState('busy');
    try {
      const r = await fetch(this.host() + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
      if (!r.ok) { const t = await r.text().catch(() => ''); throw new Error('Ollama answered ' + r.status + (t ? ': ' + t.slice(0, 240) : '')); }
      const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '';
      for (;;) {
        const { value, done } = await rd.read(); if (done) break;
        buf += dec.decode(value, { stream: true }); let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!line) continue;
          let j; try { j = JSON.parse(line); } catch (e) { continue; }
          if (j.error) throw new Error(j.error);
          const m = j.message || {};
          if (m.thinking) { think += m.thinking; if (o.onThink) o.onThink(think); }
          if (m.content) { if (!first) first = performance.now(); text += m.content; if (o.onToken) o.onToken(text, m.content); }
          if (j.done) last = j;
        }
      }
      const total = (performance.now() - t0) / 1000;
      const stats = { total, tokens: last ? last.eval_count || 0 : 0, prompt: last ? last.prompt_eval_count || 0 : 0, tps: last && last.eval_duration ? (last.eval_count || 0) / (last.eval_duration / 1e9) : null, pps: last && last.prompt_eval_duration ? (last.prompt_eval_count || 0) / (last.prompt_eval_duration / 1e9) : null, load: last && last.load_duration ? last.load_duration / 1e9 : 0, ttft: first ? (first - t0) / 1000 : null, model: body.model };
      this.setState('ok');
      return { text, think, stats, aborted: false };
    } catch (e) {
      if (e.name === 'AbortError') { this.setState('ok'); return { text, think, stats: { total: (performance.now() - t0) / 1000, model: body.model }, aborted: true }; }
      this.lastError = this.explain(e); this.setState(this.models.length ? 'ok' : 'no'); throw e;
    } finally { if (this.current === ctrl) this.current = null; }
  }
};
function statsLine(s) { if (!s) return ''; const p = []; if (s.model) p.push(`<b>${esc(s.model)}</b>`); if (s.tps) p.push(`<b>${s.tps.toFixed(1)}</b> tok/s`); if (s.tokens) p.push(`<b>${fmtN(s.tokens)}</b> tokens`); if (s.prompt) p.push(`<b>${fmtN(s.prompt)}</b> in`); if (s.ttft != null) p.push(`first token <b>${s.ttft.toFixed(1)}s</b>`); if (s.total) p.push(`<b>${s.total.toFixed(1)}s</b>`); return p.join(' · '); }

/* ================= chrome: top bar, status pill, settings sheet ================= */
function mountChrome() {
  SOS.load();
  if (window.self !== window.top) document.documentElement.classList.add('framed');
  const top = document.createElement('header'); top.className = 'top';
  top.innerHTML = `<a class="brand" href="${HUB}" title="ScrollOS hub"><span class="glyph" aria-hidden="true">${TOOL.glyph}</span><span class="name">${esc(TOOL.name)}<small>${esc(TOOL.scrollName)} · ScrollOS</small></span></a><span class="sp"></span>
    <button type="button" class="pill" id="sosPill" data-st="idle" title="Local model"><span class="dot"></span><span class="m">Looking for a model…</span></button>
    <button type="button" class="gear" id="sosGear" aria-label="Settings" title="Settings">⚙</button>
    <a class="hub" href="${HUB}">ScrollOS ⟐</a>`;
  document.body.prepend(top);
  const bg = document.createElement('div'); bg.className = 'sheet-bg'; bg.id = 'sosBg';
  const sh = document.createElement('aside'); sh.className = 'sheet'; sh.id = 'sosSheet'; sh.setAttribute('aria-label', 'Model settings');
  document.body.append(bg, sh);
  bg.onclick = closeSheet;
  $('#sosGear').onclick = openSheet; $('#sosPill').onclick = openSheet;
  const foot = document.createElement('footer'); foot.className = 'foot';
  foot.innerHTML = `ScrollOS · ${esc(TOOL.scrollName)} · ${esc(TOOL.name)} · runs in your browser against your own model · <a href="${HUB}">the hub on The Watch</a>`;
  document.body.append(foot);
  document.addEventListener('sos:state', paintPill);
  paintPill(); SOS.probe();
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); if ((e.metaKey || e.ctrlKey) && e.key === ',') { e.preventDefault(); openSheet(); } });
}
function paintPill() {
  const p = $('#sosPill'); if (!p) return; p.dataset.st = SOS.state;
  const m = $('.m', p);
  m.textContent = SOS.state === 'ok' ? (SOS.cfg.model || 'Pick a model') : SOS.state === 'busy' ? (SOS.cfg.model ? SOS.cfg.model : 'Connecting…') : SOS.state === 'no' ? 'No local model' : 'Looking for a model…';
  if ($('#sosSheet').classList.contains('open')) renderSheet();
}
function openSheet() { renderSheet(); $('#sosBg').classList.add('open'); $('#sosSheet').classList.add('open'); }
function closeSheet() { $('#sosBg').classList.remove('open'); $('#sosSheet').classList.remove('open'); }
function renderSheet() {
  const s = $('#sosSheet'), c = SOS.cfg, cur = SOS.prompts()[TOOL.scroll] || '';
  const ctxs = [4096, 8192, 16384, 32768, 65536, 131072];
  s.innerHTML = `<button type="button" class="btn ghost sm close" id="sosClose">✕</button>
    <h2>Your model</h2><p class="sub">Every tool on this page talks to the model running on your own machine. Nothing is sent anywhere else.</p>
    <label class="f">Ollama address</label>
    <div class="row" style="margin-bottom:10px"><input class="inp" id="sosHost" value="${esc(c.host)}" placeholder="http://localhost:11434" style="flex:1;min-width:0"><button type="button" class="btn" id="sosTest">Test</button></div>
    ${SOS.state === 'ok' ? `<div class="banner ok"><span class="i">●</span><span><b>Connected</b>${SOS.version ? ` · Ollama ${esc(SOS.version)}` : ''} · ${SOS.models.length} model${SOS.models.length === 1 ? '' : 's'}</span></div>` : SOS.state === 'no' ? `<div class="banner warn"><span class="i">!</span><span><b>Not connected.</b> ${esc(SOS.lastError)} <a href="${HUB}#connect">Set-up steps ›</a></span></div>` : `<div class="banner"><span class="i">…</span><span>Looking for a model at ${esc(c.host)}</span></div>`}
    <label class="f">Model</label>
    <div class="models" id="sosModels">${SOS.models.length ? SOS.models.map(m => `<button type="button" data-m="${esc(m.name)}" aria-pressed="${m.name === c.model}"><span style="font-family:var(--font);font-size:13px;color:var(--ink)">${esc(m.name)}</span><span>${esc(m.params || '')}${m.quant ? ' · ' + esc(m.quant) : ''}${m.size ? ' · ' + (m.size / 1e9).toFixed(1) + ' GB' : ''}</span></button>`).join('') : `<div class="note">No models listed yet. On the machine running Ollama: <code>ollama pull gpt-oss:20b</code></div>`}</div>
    <label class="f">Temperature · <span id="sosTempV">${c.temp}</span></label>
    <input type="range" id="sosTemp" min="0" max="1.5" step="0.05" value="${c.temp}">
    <p class="note" style="margin:4px 0 12px">Low is careful and repeatable; high is loose and surprising. 0.7 suits most writing.</p>
    <label class="f">Context window</label>
    <select class="sel" id="sosCtx" style="margin-bottom:4px">${ctxs.map(n => `<option value="${n}" ${n === c.ctx ? 'selected' : ''}>${n >= 1024 ? (n / 1024) + 'K tokens' : n}</option>`).join('')}</select>
    <p class="note" style="margin:0 0 12px">How much the model can hold at once. Bigger is slower to start and uses more memory; 16K covers most tasks, 128K holds a whole book.</p>
    <label class="f">${esc(TOOL.scrollName)}'s system prompt</label>
    <textarea class="ta" id="sosSys" placeholder="${esc(TOOL.system)}">${esc(cur)}</textarea>
    <p class="note" style="margin:4px 0 14px">Blank uses the default above. Shared by every ${esc(TOOL.scrollName)} tool in this browser; the AI Lab edits all seven at once.</p>
    <div class="row"><button type="button" class="btn pri" id="sosSave">Save</button><button type="button" class="btn ghost" id="sosReset">Reset</button><span class="sp"></span><a class="btn ghost sm" href="${HUB}#connect">Help ›</a></div>
    <hr class="rule"><div class="kv"><span>origin</span><b>${esc(location.origin === 'null' ? 'file (opened from disk)' : location.origin)}</b><span>storage</span><b>this browser only</b><span>endpoint</span><b>${esc(SOS.host())}/api/chat</b></div>`;
  $('#sosClose').onclick = closeSheet;
  $('#sosTest').onclick = async () => { SOS.cfg.host = $('#sosHost').value.trim() || 'http://localhost:11434'; SOS.save(); await SOS.probe(); renderSheet(); };
  $$('#sosModels button').forEach(b => b.onclick = () => { SOS.cfg.model = b.dataset.m; SOS.save(); paintPill(); renderSheet(); });
  $('#sosTemp').oninput = e => { $('#sosTempV').textContent = e.target.value; };
  $('#sosSave').onclick = () => { SOS.cfg.host = $('#sosHost').value.trim() || 'http://localhost:11434'; SOS.cfg.temp = +$('#sosTemp').value; SOS.cfg.ctx = +$('#sosCtx').value; SOS.save(); const P = SOS.prompts(); const v = $('#sosSys').value.trim(); if (v) P[TOOL.scroll] = v; else delete P[TOOL.scroll]; store.set('scrollos.prompts', P); toast('Saved'); closeSheet(); if (SOS.state !== 'ok') SOS.probe(); };
  $('#sosReset').onclick = () => { SOS.cfg = SOS.defaults(); SOS.save(); const P = SOS.prompts(); delete P[TOOL.scroll]; store.set('scrollos.prompts', P); renderSheet(); SOS.probe(); };
}
/* a banner for pages that can do something without the model */
function offlineBanner(what) {
  return `<div class="banner warn" id="sosOff" hidden><span class="i">⟐</span><span><b>No local model yet.</b> ${esc(what)} <a href="#" data-open-sheet>Connect one</a> or read <a href="${HUB}#build">how to build the machine</a>.</span></div>`;
}
document.addEventListener('click', e => { const a = e.target.closest('[data-open-sheet]'); if (a) { e.preventDefault(); openSheet(); } });
document.addEventListener('sos:state', () => { const b = $('#sosOff'); if (b) b.hidden = SOS.state !== 'no'; });
