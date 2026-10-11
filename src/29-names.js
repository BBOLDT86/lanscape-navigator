/* ===================================================================
   Names: reading version marks out of file names and titles ("Rev 3",
   "v2.1", "_final", "(1)", "Copy of", dated saves), tidy display names,
   and which words make a good name for a ring or a site
   =================================================================== */
const VER_LABEL = { v: 'v', ver: 'v', version: 'v', rev: 'Rev ', revision: 'Rev ', r: 'Rev ', release: 'Release ', rel: 'Release ', build: 'Build ', iteration: 'Iteration ', iter: 'Iteration ', draft: 'Draft ' };
const VER_RE = /(^|[\s_\-.(\[#,])(version|revision|release|iteration|build|draft|iter|rev|ver|rel|v|r)[\s_\-.]?(\d{1,4}(?:\.\d{1,3}){0,3})([a-z]?)(?=$|[\s_\-.)\],;:])/gi;
const STATE_LABEL = { final: 'Final', latest: 'Latest', current: 'Current', updated: 'Updated', update: 'Updated', newest: 'Newest', new: 'New', older: 'Old', old: 'Old', original: 'Original', orig: 'Original', backup: 'Backup', bak: 'Backup', draft: 'Draft', wip: 'Work in progress', working: 'Working copy', edited: 'Edited', edit: 'Edited', fixed: 'Fixed', cleaned: 'Cleaned up', clean: 'Cleaned up', revised: 'Revised', tmp: 'Temp', temp: 'Temp' };
const STATE_END_RE = /[\s_\-.(\[]+(final(?:[\s_\-]*final)*(?:[\s_\-]*\d{1,2})?|latest|current|updated|update|newest|new|older|old|original|orig|backup|bak|draft|wip|working|edited|edit|fixed|cleaned|clean|revised|tmp|temp)[)\]]?\s*$/i;
// a number after one of these words names a thing in a series ("Week 5", "Part 2"), not a version
const SEQ_WORD = /^(part|pt|chapter|chap|ch|episode|ep|day|week|wk|lesson|unit|step|page|pg|section|sec|vol|volume|book|track|disc|disk|cd|round|level|lvl|hand|game|match|session|module|room|table|cabin|deck|no|num|number|item|issue|phase|stage|sprint|season|tab|sheet|slide|fig|figure|exhibit|attachment|appendix|lot|lap|leg|q|quarter|year|month|class|grade|model|mark|mk|gen|series|type|size|floor|suite|unit|lane|bay|row|seat|zone|area|site|lab|test)$/i;
const DATE_YMD = /(^|[\s_\-.(\[])((?:19|20)\d{2})[-_.]?(0[1-9]|1[0-2])[-_.]?(0[1-9]|[12]\d|3[01])(?:[T_\s\-]+([01]?\d|2[0-3])[-_.:h]([0-5]\d)(?:[-_.:m]([0-5]\d))?)?(?=$|[\s_\-.)\]])/;
const DATE_MDY = /(^|[\s_\-.(\[])(0?[1-9]|1[0-2])[-_.](0?[1-9]|[12]\d|3[01])[-_.]((?:19|20)\d{2}|\d{2})(?=$|[\s_\-.)\]])/;
const normName = s => normText(s).replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
const verLabel = (word, num, suffix) => (VER_LABEL[String(word).toLowerCase()] || 'v') + num + (suffix || '');
/**
 * Read the version marks out of a file name (isFile) or a title.
 * -> { clean: what's left, in its own casing; base: clean, normalized; skel: base with numbers as '#';
 *      num, label ("Rev 3", "v2.1", "Final", "Copy 2", a date), copy, date, state, marked }
 */
function parseVersion(raw, isFile) {
  let s = String(raw || '').replace(/\s+/g, ' ').trim();
  const out = { num: null, label: '', copy: 0, date: 0, state: '', marked: false };
  if (isFile) s = s.replace(/\.[a-z0-9]{1,5}$/i, '');
  // "Copy of X", "Copy (2) of X", "Backup of X"
  s = s.replace(/^\s*(copy|backup)(?:\s*\((\d{1,3})\))?\s+of\s+/i, (m, w, n) => { out.copy = n ? +n + 1 : 1; if (/backup/i.test(w)) out.state = 'Backup'; out.marked = true; return ''; });
  const takeDate = (m, pre, y, mo, d, hh, mm, ss) => {
    if (!out.date) {
      const t = new Date(+y, +mo - 1, +d, +(hh || 12), +(mm || 0), +(ss || 0)).getTime();
      if (t > 0) out.date = t;
    }
    out.marked = true;
    return pre;
  };
  // marks at the end come off one at a time: "Tracker v2 - Copy (2)", "Plan_final_FINAL"
  for (let guard = 0, changed = true; changed && guard < 8; guard++) {
    changed = false;
    s = s.replace(/[\s_]*\((\d{1,3})\)\s*$/, (m, n) => { changed = true; out.copy = out.copy || +n; out.marked = true; return ''; });
    s = s.replace(/[\s_\-]+copy(?:[\s_\-]*\(?(\d{1,3})\)?)?\s*$/i, (m, n) => { changed = true; out.copy = out.copy || (n ? +n : 1); out.marked = true; return ''; });
    s = s.replace(STATE_END_RE, (m, w) => {
      changed = true;
      const k = String(w).toLowerCase().replace(/[\s_\-]*\d+$/, '').replace(/[\s_\-]*final$/, '').replace(/^final.*/, 'final');
      out.state = out.state || STATE_LABEL[k] || 'Final';
      out.marked = true;
      return '';
    });
  }
  // dates anywhere: "2026-09-15", "20260915", "9.15.26"
  s = s.replace(DATE_YMD, takeDate);
  s = s.replace(DATE_MDY, (m, pre, mo, d, y) => takeDate(m, pre, y.length === 2 ? '20' + y : y, mo, d));
  // version marks anywhere after the first word ("V8 Engine" is a name, "Engine Notes v8" a version)
  s = s.replace(VER_RE, (m, pre, word, num, suffix, offset, whole) => {
    if (!/[A-Za-z]{2,}/.test(whole.slice(0, offset))) return m;
    if (out.num == null) { out.num = parseFloat(num) || 0; out.label = verLabel(word, num, suffix); }
    out.marked = true;
    return pre;
  });
  // "Study_4": a trailing number joined by _ or - (file names only, and not "Week_5")
  if (isFile && out.num == null) {
    s = s.replace(/^(.*[A-Za-z].*?)[_\-](\d{1,2})$/, (m, a, n) => {
      const prev = a.split(/[\s_\-.]+/).filter(Boolean).pop() || '';
      if (SEQ_WORD.test(prev) || /\d$/.test(a) || a.replace(/[^A-Za-z]/g, '').length < 4) return m;
      out.num = +n; out.label = '#' + n; out.marked = true;
      return a;
    });
  }
  const clean = s.replace(/[\s_\-–—:|·•,.(\[]+$/g, '').replace(/^[\s_\-–—:|·•,.)\]]+/, '').replace(/[_]+/g, ' ').replace(/\s{2,}/g, ' ').replace(/\(\s*\)/g, '').trim();
  out.clean = clean;
  out.base = normName(clean);
  out.skel = out.base.replace(/\b\d+\b/g, '#');
  if (!out.label) out.label = out.state || (out.copy ? (out.copy > 1 ? 'Copy ' + out.copy : 'Copy') : out.date ? fmtDate(out.date) : '');
  return out;
}
/** a title without its version marks, for display: "Cayenne 958 Tracker — Rev 3" -> "Cayenne 958 Tracker" */
function cleanTitle(t) { const c = parseVersion(t, false).clean; return c || String(t || '').trim(); }

/* ---------------- tidy names from file names ---------------- */
const NAME_ACRONYMS = new Set(('ups dc ac pdf html css js ai api gpu cpu ram ssd hdd usb tv dvd cd mp3 mp4 mkv hevc aac dts vp9 av1 h264 h265 x264 x265 hdr 4k 8k 1080p 720p 2160p ' +
  'nfl nba mlb nhl ncaa wsop mspt wpt gto icm faq diy bbq uk usa eu nyc rv suv ev vdc vac kva kw kwh ul nec ieee epc lng ccgt pjm hvac ess bms ats mcc rfq po pdu ' +
  'kpi roi crm erp sql ui ux ios pc id vip rsvp tbd eta llm mph mpg rpm ecu obd led lcd gps vin nas lan wan isp vpn ip url www ocr csv xml json svg png jpg gif').split(' '));
const SMALL_WORDS = new Set('a an the and or of in on at to for by with vs via from per'.split(' '));
function nameToken(t, i, allCaps) {
  if (!t) return t;
  const low = t.toLowerCase();
  if (NAME_ACRONYMS.has(low)) return low === 'vs' ? 'vs' : t.toUpperCase();
  if (/^v\d+(\.\d+)*$/i.test(t)) return 'v' + t.slice(1);                                                   // v2, v2.1
  if (/^(rev|ver)(\d+)$/i.test(t)) return t.replace(/^(rev|ver)(\d+)$/i, (m, w, n) => (w.toLowerCase() === 'rev' ? 'Rev ' : 'v') + n);
  if (/^[a-z]+\d+[a-z]*$/i.test(t) && t.length <= 6) return t.toUpperCase();                                  // vp9, p40, b210, r7
  if (/^\d+[a-z]+$/i.test(t)) return t.toUpperCase().replace(/(\d)(ST|ND|RD|TH)$/, (m, d, x) => d + x.toLowerCase());   // 256GB, 5th
  if (!allCaps && /[A-Z]/.test(t.slice(1)) && /[a-z]/.test(t)) return t;   // MoE, iPhone, LANscape keep their own casing
  if (i > 0 && SMALL_WORDS.has(low)) return low;
  return low.charAt(0).toUpperCase() + low.slice(1);
}
/** "MoE_256GB_build_study_4.html" -> "MoE 256GB Build Study 4", "vp9_opus" -> "VP9 Opus", "myToolName" -> "My Tool Name" */
function prettyName(file) {
  let base = String(file || '').replace(/\.[a-z0-9]{1,5}$/i, '');
  // camelCase file names ("myToolName"), but not "iPhone", "eBay" or "PowerPoint"
  base = base.split(/([\s_.-]+)/).map(t => (/^[a-z]{2,}[A-Z]/.test(t) ? t.replace(/([a-z])([A-Z])/g, '$1 $2') : t)).join('');
  base = base.replace(/_+/g, ' ').replace(/([A-Za-z0-9])[-.](?=[A-Za-z])/g, '$1 ').replace(/([A-Za-z])[-.](?=\d)/g, '$1 ').replace(/\s+/g, ' ').trim();
  if (!base) return String(file || '');
  const letters = base.replace(/[^A-Za-z]/g, '');
  const allCaps = letters.length > 3 && letters === letters.toUpperCase();
  return base.split(' ').map((t, i) => nameToken(t, i, allCaps)).join(' ');
}
function titleCase(s) { return String(s).replace(/(^|[\s\-/(\["'])([a-z])/g, (m, a, b) => a + b.toUpperCase()); }

/* ---------------- words that make (and don't make) good names ---------------- */
const NAME_STOP = new Set(Array.from(STOP).concat(('rev revision version ver v r final draft copy new old my your our his her their interactive serverless single file html htm page pages web site ' +
  'untitled document doc index default home welcome the a an of and or to for in on at by with from vs via edition update updated latest current backup').split(' ')));
// these name a kind of thing, not a topic: fine inside a phrase ("Cruise Planner"), weak on their own
const GENERIC_NAME = new Set(('tool tools app apps application dashboard dashboards tracker trackers planner planners board boards guide guides report reports notes note list lists ' +
  'schedule schedules plan plans planning summary summaries overview analysis analyzer study studies brief briefs catalog catalogue module modules sheet sheets spec specs ' +
  'review reviews calculator calculators viewer editor builder generator simulator trainer manager template templates workspace hub center centre system systems project ' +
  'projects data info information main test demo sample example examples options option worksheet checklist log logs journal cheat cheatsheet menu form forms chart charts ' +
  'map maps timeline calendar matrix table tables memo memos letter letters presentation deck slides draft tracker dossier explorer browser finder console portal panel ' +
  'kit pack packet binder book handbook manual reference sheet workbook scorecard scoresheet ledger diary scratch scratchpad playground sandbox prototype mockup concept').split(' '));
// identifiers that leak out of scripts ("cssText", "innerHTML"): never a topic
const CODE_WORDS = new Set(('csstext innertext outerhtml innerhtml textcontent classname classlist offsetwidth offsetheight clientwidth clientheight scrollheight scrolltop ' +
  'getboundingclientrect appendchild removechild insertbefore createelement createtextnode queryselector queryselectorall getelementbyid getelementsbyclassname ' +
  'addeventlistener removeeventlistener preventdefault stoppropagation setattribute getattribute removeattribute hasattribute localstorage sessionstorage ' +
  'settimeout setinterval cleartimeout clearinterval requestanimationframe tolocaledatestring tolocalestring tolocaletimestring todatestring toisostring tofixed ' +
  'parseint parsefloat isnan json stringify foreach findindex indexof includes tolowercase touppercase startswith endswith padstart padend fromcharcode charcodeat ' +
  'createobjecturl revokeobjecturl filereader readasdataurl readastext onload onclick onchange oninput onsubmit onkeydown onkeyup innerwidth innerheight ' +
  'devicepixelratio getcontext fillstyle strokestyle linewidth fillrect strokerect beginpath closepath moveto lineto drawimage todataurl dataset nodename ' +
  'parentnode parentelement childnodes nextsibling firstchild lastchild textalign fontsize fontweight fontfamily backgroundcolor zindex boxshadow borderradius ' +
  'flexdirection justifycontent alignitems gridtemplatecolumns webkit moz xmlns viewbox href src img div span btn px rgba hsla const var let async await ' +
  'undefined null typeof instanceof prototype constructor console doctype charset viewport utf stylesheet nbsp onerror onmessage postmessage fetch xhr ajax ' +
  'math floor ceil round abs sqrt pow min max keyframes webkitbackdropfilter backdropfilter transform translate rotate scale opacity svgns').split(' '));
/** a word that can stand in a ring or site name */
function isNameWord(w, fromTitle) {
  w = String(w || '').toLowerCase();
  if (!w || NAME_STOP.has(w) || CODE_WORDS.has(w)) return false;
  if (/^\d+(am|pm|st|nd|rd|th|h|hr|hrs|m|min|mins|s|sec|secs|k|x|px|pt|em|mm|cm|in|ft|lb|lbs|kg|g|oz|ms|fps)$/.test(w)) return false;   // "00pm", "5th", "5h"
  if (/^\d+$/.test(w)) return !!fromTitle && w.length >= 3 && w.length <= 4 && !/^(19|20)\d\d$/.test(w);   // model numbers from titles (958, 911); never years
  if (/\d/.test(w)) return !!fromTitle && /^[a-z]{1,3}\d{1,4}[a-z]?$|^\d{2,4}[a-z]{1,3}$/.test(w);   // P40, B210, 480V in titles only
  return w.length >= 3 && /^[a-z][a-z'-]*$/.test(w);
}
/** the 2-3 word phrases (and single words) in a title, keyed by their normalized form */
function titleGrams(title) {
  const clean = cleanTitle(title);
  const segs = clean.split(/\s+[-–—|·•:]\s+|\s*[|·•:()\[\]{}\/\\]\s*|\s+[–—]|[–—]\s+/);
  const grams = new Map();
  for (const seg of segs) {
    const words = (seg.match(/[A-Za-z0-9][A-Za-z0-9'’&+-]*/g) || []).map(t => t.replace(/[’']s$/i, '').replace(/[-+&]+$/, '')).filter(Boolean);
    const norm = words.map(w => normText(w).replace(/[^a-z0-9]+/g, ''));
    for (let i = 0; i < words.length; i++) {
      for (let n = 1; n <= 3 && i + n <= words.length; n++) {
        const ns = norm.slice(i, i + n);
        if (ns.some(x => !x)) break;
        if (NAME_STOP.has(ns[0]) || NAME_STOP.has(ns[n - 1])) continue;
        if (!ns.some(x => isNameWord(x, true) && /[a-z]{3}/.test(x))) continue;
        if (ns.some(x => !isNameWord(x, true) && !NAME_STOP.has(x))) continue;
        const key = ns.join(' ');
        if (!grams.has(key)) grams.set(key, words.slice(i, i + n).join(' '));
      }
    }
  }
  return grams;
}
/** how a phrase should look in a name: its most common spelling in the titles, tidied */
function displayPhrase(surfaces) {
  let best = '', bc = -1;
  for (const [s, c] of surfaces) if (c > bc || (c === bc && s < best)) { bc = c; best = s; }
  const letters = best.replace(/[^A-Za-z]/g, '');
  if (letters.length > 3 && (letters === letters.toUpperCase() || letters === letters.toLowerCase())) return best.split(' ').map((t, i) => nameToken(t.toLowerCase(), i, false)).join(' ');
  return best.split(' ').map((t, i) => (/^[a-z]/.test(t) && !(i > 0 && SMALL_WORDS.has(t)) ? nameToken(t, i, false) : t)).join(' ');
}
/** the text on an 88x31 button: whole words only, 11 characters at most */
function badgeLabel(phrase) {
  const p = String(phrase || '').toUpperCase().replace(/[^A-Z0-9&' -]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!p) return 'MYSTERY';
  if (p.length <= 11) return p;
  const words = p.split(' ');
  let out = '';
  for (const w of words) { const next = out ? out + ' ' + w : w; if (next.length > 11) break; out = next; }
  if (out && out.length >= 4) return out;
  // one long word: squeeze the vowels out after the first letter, 90s style
  const w = words.sort((a, b) => b.length - a.length)[0];
  let sq = w[0] + w.slice(1).replace(/[AEIOU]/g, '');
  if (sq.length > 11) sq = sq.slice(0, 11);
  return sq;
}
/** the two lines of a ring's 88x31 button: the whole name when it fits on two lines, else the badge and "WEB RING" */
function badgeLines(phrase, sub) {
  const p = String(phrase || '').toUpperCase().replace(/[^A-Z0-9&' -]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!p) return ['MYSTERY', sub];
  if (p.length <= 11) return [p, sub];
  const words = p.split(' ');
  let best = null;
  if (words.length > 1 && words.every(w => w.length <= 11)) {
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
      if (a.length <= 11 && b.length <= 11 && (!best || Math.max(a.length, b.length) < Math.max(best[0].length, best[1].length))) best = [a, b];
    }
  }
  return best || [badgeLabel(phrase), sub];
}

/* ---------------- directory categories ---------------- */
const CATEGORIES = [
  { id: 'games', name: 'Games & Poker', glyph: '♠', re: /\b(poker|hold.?em|holdem|casino|tournament|wsop|mspt|wpt|chips?|blinds?|bluff|flop|turn|river|bet|bets|betting|odds|gambl\w*|cards?|satellite|bankroll|gto|icm|pinball|chess|game|games|gaming|slots?|blackjack)\b/ },
  { id: 'sports', name: 'Sports', glyph: '⚑', re: /\b(football|fantasy|nfl|nba|mlb|nhl|ncaa|league|baseball|basketball|hockey|soccer|golf|matchup|playoffs?|quarterback|touchdown|roster|sox|yankees|futures)\b/ },
  { id: 'travel', name: 'Travel & Vacations', glyph: '✈', re: /\b(travel|trip|trips|cruise|cruises|ship|flight|flights|hotel|hotels|resort|resorts|itinerary|vacation|vacations|beach|beaches|island|islands|port|ports|airport|airline|tour|tours|italy|rome|venice|florence|caribbean|cancun|tulum|cozumel|princess|cabin|sailing|voyage|passport|luggage|packing|excursion|snorkel)\b/ },
  { id: 'autos', name: 'Autos', glyph: '⚙', re: /\b(car|cars|porsche|cayenne|911|diesel|auto|autos|salvage|garage|turbo|tires?|brakes?|vehicle|vehicles|motor|truck|auction|copart|vin|mileage|transmission|coolant|exhaust|bumper|hatch|tdi|convertible)\b/ },
  { id: 'work', name: 'Business & Engineering', glyph: '⚡', re: /\b(ups|battery|batteries|charger|chargers|vdc|vac|inverter|rectifier|switchgear|transformer|xfmr|panelboard|breaker|spec|specs|specification|bid|bids|quote|quotes|rfq|proposal|vendor|vendors|supplier|suppliers|epc|lng|ccgt|pjm|substation|electrical|kva|kw|ul|nec|one.?line|clarification|exceptions?|customer|sales|engineering|procurement|schedule|lead.?time|production|factory)\b/ },
  { id: 'tech', name: 'Computers & Internet', glyph: '⌘', re: /\b(html|web|software|server|servers|network|code|coding|program|programming|api|database|schema|authentication|gpu|cpu|llm|model|models|inference|ubuntu|linux|ai|agent|agents|app|apps|browser|javascript|python|cloud|azure|computer|computers|tech|moe|vram|ram)\b/ },
  { id: 'home', name: 'Home & Garden', glyph: '⌂', re: /\b(home|house|kitchen|cabinet|cabinets|paint|painting|pantry|garden|gardening|courtyard|remodel|renovation|furniture|decor|nook|storage|closet|bathroom|floor|flooring|deck|patio|yard|lawn|receiver|speakers?|marantz)\b/ },
  { id: 'food', name: 'Food & Drink', glyph: '♨', re: /\b(recipe|recipes|cook|cooking|bake|baking|food|foods|meal|meals|dining|restaurant|restaurants|menu|menus|wine|coffee|bbq|brisket|grill|bread|sourdough|mise|kitchen|chef|dinner|lunch|breakfast|smoothie|cocktail)\b/ },
  { id: 'money', name: 'Money & Investing', glyph: '$', re: /\b(money|invest|investing|investment|stock|stocks|budget|budgets|finance|financial|price|prices|cost|costs|market|markets|dividend|portfolio|hedge|savings|points|miles|amex|credit|card|fees|tax|taxes|s&p|m2)\b/ },
  { id: 'health', name: 'Health & Fitness', glyph: '♥', re: /\b(health|fitness|workout|workouts|exercise|gym|diet|nutrition|training|tb12|running|yoga|sleep|wellness|water|purification)\b/ },
  { id: 'animals', name: 'Horses & Animals', glyph: '♞', re: /\b(horse|horses|dressage|equine|equestrian|barn|saddle|pony|riding|stable|hoof|farrier|dog|dogs|cat|cats|pet|pets)\b/ },
  { id: 'arts', name: 'Arts & Entertainment', glyph: '✿', re: /\b(art|arts|canvas|gallery|painting|print|prints|music|movie|movies|film|films|video|videos|tv|photo|photos|photography|book|books|design|abstract|oil)\b/ },
  { id: 'learn', name: 'Science & Learning', glyph: '✎', re: /\b(study|research|science|lesson|lessons|course|courses|learn|learning|tutorial|guide|manual|reference|history|math|physics|chemistry)\b/ }
];
/** the directory category for some words (a ring's name and keywords) */
function categoryFor(text) {
  const t = String(text || '').toLowerCase();
  let best = null, bs = 0;
  for (const c of CATEGORIES) {
    const m = t.match(new RegExp(c.re.source, 'g'));
    const n = m ? m.length : 0;
    if (n > bs) { bs = n; best = c; }
  }
  return best || { id: 'misc', name: 'Miscellaneous', glyph: '★' };
}
