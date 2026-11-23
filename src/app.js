const LET = ['P','Q','R','S','T','U','V','W'], DIG = ['x','y','z'];
const T = '⊤', F_ = '⊥', DAG = '†', DOT = '·', TITLE = 'Crack the Code!';
const KEY = 'ctc-v3';
const A32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ', CODE_VERSION = '1', NPRED_V1 = 95, PID0 = 101;
const app = document.getElementById('app'), modal = document.getElementById('modal');

// ---------- library ----------
const PRED = {}, CARD = {}, NUM2CARD = {};
LIB.preds.forEach(p => { PRED[p.id] = p; });
LIB.cards.forEach(c => { CARD[c[0]] = { nums: c[1], t: c[2] }; c[1].forEach(n => { NUM2CARD[n] = c[0]; }); });
const ALL = []; for (let x = 1; x <= 5; x++) for (let y = 1; y <= 5; y++) for (let z = 1; z <= 5; z++) ALL.push([x, y, z]);

let P = null, S = null, view = 'setup';
const ui = { pending: false, msg: '', bad: false, step: null, hint: false, menu: false };
const form = { gotd: null, note: '', gdate: '', code: '', codeBad: false, rows: [{ p: '', k: '' }, { p: '', k: '' }, { p: '', k: '' }, { p: '', k: '' }], report: null, show: false };
const LS = {   // every saved game and setting, under KEY; storage that is blocked reads as empty
  get(k) { try { return localStorage.getItem(KEY + ':' + k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(KEY + ':' + k, v); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(KEY + ':' + k); } catch (e) {} },
  flag(k, d) { const v = this.get(k); return v === null ? d : v === '1'; },
  setFlag(k, v) { this.set(k, v ? '1' : '0'); } };
let HL = LS.flag('hl', false), WORK = LS.flag('work', false);
// Theme: 'auto' follows the device; the rest force a palette from the stylesheet.
const THEMES = [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark'], ['black', 'Black']];
let THEME = LS.get('theme') || 'auto';
function applyTheme() {
  if (!THEMES.some(x => x[0] === THEME)) THEME = 'auto';
  const r = document.documentElement; if (THEME === 'auto') delete r.dataset.theme; else r.dataset.theme = THEME;
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = getComputedStyle(r).getPropertyValue('--paper').trim() || '#ffffff';
  // icons follow the page: dark icons whenever the page is dark (an icon added to a home screen keeps the one in use at that moment)
  const dk = THEME === 'dark' || THEME === 'black' || (THEME === 'auto' && !!window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches), sfx = dk ? '-dark' : '';
  [['ico-svg', 'favicon', '.svg'], ['ico-ico', 'favicon', '.ico'], ['ico-apple', 'apple-touch-icon', '.png']].forEach(([id, base, ext]) => {
    const l = document.getElementById(id); if (l && l.setAttribute && l.getAttribute('href') !== base + sfx + ext) l.setAttribute('href', base + sfx + ext);
  });
}
applyTheme();
if (window.matchMedia) { const mq = matchMedia('(prefers-color-scheme: dark)'); const f = () => { if (THEME === 'auto') applyTheme(); }; if (mq.addEventListener) mq.addEventListener('change', f); }
const MODE = { single: LS.flag('m-single', true), excl: LS.flag('m-excl', true), uniq: LS.flag('m-uniq', true) };

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ix = c => (c[0] - 1) * 25 + (c[1] - 1) * 5 + (c[2] - 1);
const cs = c => c.join('');
const optTrue = (i, k, c) => P.preds[i].options[k].t[ix(c)] === '1';
const predVal = (i, c) => P.preds[i].active.some(k => optTrue(i, k, c));
const nTrue = (i, c) => { let n = 0; for (const o of P.preds[i].options) if (o.t[ix(c)] === '1') n++; return n; };
// what the start screen says about the answer is evidence too: a code must agree with it
const fitsFlag = c => !P.overlap ? P.preds.every((p, i) => nTrue(i, c) === 1) : (P.solutions !== 1 || P.preds.some((p, i) => nTrue(i, c) > 1));
const optIdx = i => P.preds[i].options.map((o, k) => k);
const tf = v => v ? T : F_;
const plural = (n, w, pl) => n + ' ' + (n === 1 ? w : (pl || w + 's'));
const fmtCode = s => s.replace(/(.{4})(?=.)/g, '$1-');

// ---------- game codes: reversible, versioned ----------
function encodeGame(pids, masks) {
  let V = 0n, mult = 1n; const push = (d, r) => { V += BigInt(d) * mult; mult *= BigInt(r); };
  push(pids.length - 1, 8);
  pids.forEach((pid, i) => { push(pid - PID0, NPRED_V1); push(masks[i] - 1, (1 << PRED[pid].o.length) - 1); });
  const d = []; do { d.unshift(Number(V % 32n)); V /= 32n; } while (V > 0n);
  let chk = 7; d.forEach((v, i) => { chk = (chk + (2 * i + 1) * v) % 32; });
  return CODE_VERSION + d.map((v, i) => A32[(v + (i + 1) * (2 * chk + 1) + 13) % 32]).join('') + A32[(chk * 5 + 9) % 32];
}
// what a typed code may contain besides the code itself: lowercase, spaces, dashes, and I, L, or O for 1 or 0
const normCode = str => String(str).toUpperCase().replace(/[\s-]/g, '').replace(/[IL]/g, '1').replace(/O/g, '0');
function decodeGame(str) {
  const s = normCode(str);
  if (s.length < 3 || s[0] !== CODE_VERSION) return null;
  const idx = Array.from(s.slice(1)).map(ch => A32.indexOf(ch)); if (idx.some(v => v < 0)) return null;
  const c = idx.pop(), chk = ((c - 9 + 64) * 13) % 32;
  const d = idx.map((e, i) => (((e - (i + 1) * (2 * chk + 1) - 13) % 32) + 32) % 32);
  let sum = 7; d.forEach((v, i) => { sum = (sum + (2 * i + 1) * v) % 32; }); if (sum !== chk) return null;
  let V = 0n; d.forEach(v => { V = V * 32n + BigInt(v); });
  const n = Number(V % 8n) + 1; V /= 8n; const pids = [], masks = [];
  for (let i = 0; i < n; i++) {
    const pid = PID0 + Number(V % BigInt(NPRED_V1)); V /= BigInt(NPRED_V1);
    if (!PRED[pid] || pids.includes(pid)) return null;
    const r = BigInt((1 << PRED[pid].o.length) - 1); masks.push(Number(V % r) + 1); V /= r; pids.push(pid);
  }
  if (V !== 0n || encodeGame(pids, masks) !== s) return null;
  return { pids, masks };
}

// ---------- puzzle construction ----------
// Turing Machine verification numbers, decoded from build.py's tm_pack: which numbers are used (one bit each, in hex);
// in order they alternate between a rising and a falling sequence, except at the listed breaks; and the k-th pair of
// the rising sequence and the k-th pair of the falling one, from the top, are on the same card
function tmNumbers(p) {
  const used = [], up = [], down = [], out = {};
  for (let i = 0; i < p.used.length * 4; i++) if (parseInt(p.used[i >> 2], 16) >> (i & 3) & 1) used.push(p.from + i);
  used.forEach((n, r) => ((r % 2 === 0) !== p.breaks.includes(n) ? up : down).push(n));
  down.reverse();
  const card = r => parseInt(p.cards.substr((r >> 1) * 2, 2), 16);
  up.forEach((n, r) => { out[n] = card(r); }); down.forEach((n, r) => { out[n] = card(r); });
  return out;
}
TM.numbers = tmNumbers(TM.pack);
function resolvePred(str) {
  const s = String(str).trim(); if (!/^\d+$/.test(s)) return null; const n = +s;
  if (PRED[n]) return { id: n, via: null };
  if (TM.criteria[n]) return { id: TM.criteria[n], via: n };
  return null;
}
function resolveCard(str) {
  const s = String(str).trim(); if (!/^\d+$/.test(s)) return null; const n = +s;
  if (NUM2CARD[n]) return NUM2CARD[n];
  if (TM.numbers[n]) return TM.numbers[n];
  return null;
}
function buildPuzzle(pids, masks) {
  const preds = pids.map((pid, i) => {
    const lp = PRED[pid], options = lp.o.map(o => ({ l: o[0], c: o[1], f: o[2] || o[0], t: CARD[o[1]].t }));   // l: the chip's label, which may lean on its card's title; f: the full wording, for explanations and screen readers
    const active = options.map((o, k) => k).filter(k => masks[i] >> k & 1);
    if (!active.length || masks[i] >= (1 << options.length)) throw new Error('bad option mask');
    return { id: pid, text: lp.text, options, active };
  });
  const code = encodeGame(pids, masks);
  const pz = { gid: fmtCode(code), def: { p: pids.slice(), m: masks.slice() }, preds, singleOption: preds.every(p => p.active.length === 1) };
  const sols = ALL.filter(c => preds.every(p => p.active.some(k => p.options[k].t[ix(c)] === '1')));
  pz.solutions = sols.length;
  pz.overlap = sols.some(c => preds.some(p => p.options.filter(o => o.t[ix(c)] === '1').length > 1));
  return pz;
}
const rowsOf = pz => pz.preds.map(p => ({ p: String(p.id), k: p.active.map(k => CARD[p.options[k].c].nums[0]).join(' ') }));
const metaOf = (code, i) => { const g = decodeGame(code), pz = buildPuzzle(g.pids, g.masks); return { i, code: pz.gid, n: g.pids.length, single: pz.singleOption, overlap: pz.overlap, solutions: pz.solutions }; };
const BANKMETA = BANK.map(metaOf), TMMETA = TMBANK.map(metaOf);
const bankShown = () => BANKMETA.filter(g => (!MODE.single || g.single) && (!MODE.excl || !g.overlap) && (!MODE.uniq || g.solutions === 1));

// ---------- in-page generator ----------
function mulberry(a) { return function () { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function seedOf(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0; return h; }
function shuffled(arr, rng) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
const IDX = Array.from({ length: 125 }, (_, i) => i);
// Choose active options for the given predicates. want = { single, uniq: true|false, excl: true|false|null (null = either) }.
// Returns { masks, clean } where clean means no predicate could be dropped, or null if nothing fits within the budget.
function findActive(pids, want, rng, budget) {
  const n = pids.length, T = pids.map(pid => PRED[pid].o.map(o => CARD[o[1]].t));
  const overlapAt = c => T.some(ts => { let k = 0; for (const t of ts) if (t[c] === '1') k++; return k > 1; });
  let multi = [];
  if (!want.single) { const wide = shuffled(IDX.slice(0, n).filter(i => T[i].length >= 3), rng); if (!wide.length) return null; multi = wide.slice(0, 1 + Math.floor(rng() * Math.min(2, wide.length))); }
  const choices = T.map((ts, i) => {
    const out = [];
    if (multi.includes(i)) {   // every pair of options, unless together they allow every code
      for (let a = 0; a < ts.length; a++) for (let b = a + 1; b < ts.length; b++) {
        let u = '', full = true;
        for (let c = 0; c < 125; c++) { const on = ts[a][c] === '1' || ts[b][c] === '1'; u += on ? '1' : '0'; if (!on) full = false; }
        if (!full) out.push({ mask: 1 << a | 1 << b, t: u });
      }
    }
    else ts.forEach((t, k) => out.push({ mask: 1 << k, t }));
    return shuffled(out, rng);
  });
  const lo = want.uniq ? 1 : 2, hi = want.uniq ? 1 : 4, pick = []; let nodes = 0, found = null, fallback = null;
  (function rec(i, alive) {
    if (found || nodes++ > budget) return;
    if (i === n) {
      if (alive.length > hi || (want.excl !== null && alive.some(overlapAt) === want.excl) || new Set(pick.map(p => p.t)).size < n) return;
      const droppable = n > 1 && pick.some((_, j) => IDX.filter(c => pick.every((p, q) => q === j || p.t[c] === '1')).length === alive.length);
      if (!droppable) found = pick.map(p => p.mask); else if (!fallback) fallback = pick.map(p => p.mask);
      return;
    }
    for (const ch of choices[i]) { const next = alive.filter(c => ch.t[c] === '1'); if (next.length >= lo) { pick.push(ch); rec(i + 1, next); pick.pop(); if (found) return; } }
  })(0, IDX);
  return found ? { masks: found, clean: true } : fallback ? { masks: fallback, clean: false } : null;
}
function randomPuzzle(k, want, rng) {
  const pool = Object.keys(PRED).map(Number).filter(p => PRED[p].o.length <= 6);
  for (let tries = 0; tries < 800; tries++) { const pids = shuffled(pool, rng).slice(0, k).sort((a, b) => a - b), r = findActive(pids, want, rng, 3000); if (r && r.clean) return { pids, masks: r.masks }; }
  return null;
}
// a checked mode is a promise; an unchecked one leaves it to chance
function wantFromModes(rng) { const a = rng(), b = rng(); return { single: MODE.single ? true : a < 0.5, uniq: MODE.uniq ? true : b < 0.5, excl: MODE.excl ? true : null }; }
const pad2 = n => String(n).padStart(2, '0'), ymd = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const todayStr = () => ymd(new Date());
function gameOfDay(date) {
  const rng = mulberry(seedOf('gotd1|' + date + '|' + (MODE.single ? 1 : 0) + (MODE.excl ? 1 : 0) + (MODE.uniq ? 1 : 0))), want = wantFromModes(rng), k = [4, 5, 5, 6][Math.floor(rng() * 4)];
  return randomPuzzle(k, want, rng);
}

// ---------- storage ----------
// Games are kept by play-through, newest first, and only the last RECENT_MAX are kept: older ones are deleted.
// A game is listed once it has an evaluation; a game with none is kept only while it is the current game.
const RECENT_MAX = 5;
const gameId = s => s.id || (s.id = s.gid + '@' + s.startedAt);
function readGame(id) { try { const s = JSON.parse(LS.get('g:' + id) || 'null'); if (s && s.v === 3 && s.def && gameId(s) === id) return s; } catch (e) {} return null; }
function recentIds() { try { const a = JSON.parse(LS.get('recent') || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
function recentGames() { return recentIds().map(readGame).filter(Boolean); }
// first-time help: one-time tips, the first-visit block on the setup screen, and a small first puzzle
function tipOnce(name, msg) { if (LS.get('tip-' + name)) return ''; LS.set('tip-' + name, '1'); return msg; }
const newcomer = () => !recentGames().some(g => g.rows && g.rows.length);
const FIRST_PUZZLE = (BANKMETA.find(g => g.n === 4 && g.single && !g.overlap && g.solutions === 1) || BANKMETA[0]).code;
function continueGame() { if (S && P && !S.won) return S; return recentGames().find(s => !s.won && s.rows && s.rows.length) || null; }
function findGame(gid) { return recentGames().find(s => s.gid === gid) || null; }
function save() {
  const id = gameId(S), was = LS.get('last'); let ids = recentIds().filter(x => x !== id);
  if (S.rows.length) { ids.unshift(id); ids.slice(RECENT_MAX).forEach(x => LS.del('g:' + x)); ids = ids.slice(0, RECENT_MAX); LS.set('recent', JSON.stringify(ids)); }
  if (was && was !== id && !ids.includes(was)) LS.del('g:' + was);   // an untouched game you walked away from
  LS.set('g:' + id, JSON.stringify(S)); LS.set('last', id);
}
function lastState() { const g = LS.get('last'); return g ? readGame(g) : null; }
function fresh(pz, showCount, gotd) {
  const at = Date.now();
  return { v: 3, id: pz.gid + '@' + at, gid: pz.gid, def: pz.def, gotd: gotd || null, aids: { w: false, h: false }, showCount: !!showCount, startedAt: at, finishedAt: null, dial: [1, 1, 1], ticks: [], rows: [],
    marks: { d: [0, 1, 2].map(() => [0, 0, 0, 0, 0]), o: pz.preds.map(q => q.options.map(() => 0)) }, turns: 0, evals: 0, wrong: 0, contra: [], won: false };
}
function resetUi() { ui.msg = ''; ui.bad = false; ui.pending = false; ui.step = null; ui.hint = false; }
function noteAids() { if (!S.aids) S.aids = { w: false, h: false }; if (WORK) S.aids.w = true; if (HL) S.aids.h = true; }
function startGame(pz, showCount, forceNew, gotd) {
  P = pz; const old = forceNew ? null : findGame(pz.gid);
  S = old && !old.won ? old : fresh(pz, showCount, gotd);
  if (showCount) S.showCount = true; noteAids();
  resetUi(); view = 'play'; save(); render();
}
function resume(state) { try { P = buildPuzzle(state.def.p, state.def.m); S = state; noteAids(); view = 'play'; resetUi(); return true; } catch (e) { return false; } }

// ---------- play helpers ----------
function known(c) { const m = {}, key = cs(c); S.rows.forEach((r, ri) => { if (cs(r.code) === key) for (const i in r.res) if (!(i in m)) m[i] = { val: r.res[i], row: ri }; }); return m; }
function effTicks(k = known(S.dial)) {   // the checked predicates not already answered for this code
  return S.ticks.slice().sort((a, b) => a - b).filter(i => !(i in k)); }
function determined(i, k) { return HL && !S.won && optTrue(i, k, S.dial); }
// worksheet marks as displayed: in "workbook does work" mode a selected value crosses out its siblings
const markD = (d, v) => { const m = S.marks.d[d]; return WORK && m[v] !== 2 && m.includes(2) ? 1 : m[v]; };
const markO = (i, k) => { const m = S.marks.o[i]; return WORK && P.singleOption && m[k] !== 2 && m.includes(2) ? 1 : m[k]; };
function contraCells(g) {
  const out = [];
  S.rows.forEach((r, ri) => { for (const key in r.res) {
    const i = +key, val = r.res[key], opts = optIdx(i); let bad;
    if (P.singleOption) bad = !opts.some(k => optTrue(i, k, r.code) === val && optTrue(i, k, g));
    else { const go = opts.filter(k => optTrue(i, k, g)); bad = val ? go.length === 0 : go.every(k => optTrue(i, k, r.code)); }
    if (bad) out.push(ri + ':' + i);
  } });
  return out;
}
const rowKeys = r => r.guess ? r.fresh.slice().sort((a, b) => a - b) : Object.keys(r.res).map(Number).sort((a, b) => a - b);
const rowWon = r => r.guess && P.preds.every((p, i) => r.res[i]);
const rowTurns = r => r.guess ? (rowWon(r) ? 0 : Math.ceil(r.fresh.length / 3)) : 1;

// ---------- elimination engine: checks every code ----------
function exactCount(rows) {
  const surv = P.preds.map((p, i) => optIdx(i));
  rows.forEach(r => { for (const key in r.res) { const i = +key; if (P.singleOption) surv[i] = surv[i].filter(k => optTrue(i, k, r.code) === r.res[key]); else if (!r.res[key]) surv[i] = surv[i].filter(k => !optTrue(i, k, r.code)); } });
  const loose = ALL.filter(c => fitsFlag(c) && surv.every((ks, i) => ks.some(k => optTrue(i, k, c))));
  if (!(P.singleOption && P.solutions === 1)) return loose.length;
  // "One solution" is on the start screen, so it is evidence as well: keep only codes that are the single
  // solution of some choice of surviving options. (A choice that would allow two codes cannot be the real one.)
  const keep = new Set(); let nodes = 0;
  (function rec(i, alive) {
    if (nodes++ > 300000) return;
    if (i === P.preds.length) { if (alive.length === 1 && fitsFlag(alive[0])) keep.add(cs(alive[0])); return; }
    for (const k of surv[i]) { const next = alive.filter(c => optTrue(i, k, c)); if (next.length) rec(i + 1, next); }
  })(0, ALL);
  return nodes > 300000 ? loose.length : keep.size;
}

// ---------- predicate-solver: options and digit domains only (rules E1, D1, D2); one chart step per turn ----------
function solverRun(rows) {
  const opts = P.preds.map((p, i) => new Set(optIdx(i))), dom = [0, 1, 2].map(() => new Set([1, 2, 3, 4, 5]));
  const bound = () => dom[0].size * dom[1].size * dom[2].size;
  const vals = (d, fd, fv) => d === fd ? [fv] : Array.from(dom[d]);
  const support = (i, k, fd, fv, loose) => {   // can option k of predicate i be true with digit fd fixed to fv?
    for (const x of vals(0, fd, fv)) for (const y of vals(1, fd, fv)) for (const z of vals(2, fd, fv)) if (optTrue(i, k, [x, y, z]) && (loose || P.overlap || nTrue(i, [x, y, z]) === 1)) return true;
    return false;
  };
  const q = (i, k) => '“' + P.preds[i].options[k].f + '”', many = (a, one, more) => a.length > 1 ? more : one;
  function propagate(note) {
    let ch = true;
    while (ch) {
      ch = false;
      P.preds.forEach((p, i) => {   // D2: an option the remaining digit values cannot satisfy
        const gone = []; for (const k of Array.from(opts[i])) if (opts[i].size > 1 && !support(i, k, -1, 0)) { opts[i].delete(k); note.o.push(i + ':' + k); gone.push(q(i, k)); ch = true; }
        if (gone.length) note.why.push(LET[i] + ': ' + gone.join(', ') + many(gone, ' is', ' are') + ' out, because the digit values still possible cannot make ' + many(gone, 'it', 'them') + ' true.');
      });
      P.preds.forEach((p, i) => {   // D1: a digit value no remaining option allows
        if (!opts[i].size) return;
        for (let d = 0; d < 3; d++) {
          const gone = []; let flag = false, left = Array.from(opts[i]);
          for (const v of Array.from(dom[d])) if (dom[d].size > 1 && !left.some(k => support(i, k, d, v))) { if (left.some(k => support(i, k, d, v, true))) flag = true; dom[d].delete(v); note.d.push(d + ':' + v); gone.push(v); ch = true; }
          if (!gone.length) continue;
          const what = left.length === 1 ? LET[i] + ' must be ' + q(i, left[0]) : LET[i] + ' must be one of ' + left.map(k => q(i, k)).join(', ');
          note.why.push(DIG[d] + ' cannot be ' + gone.join(', ') + ': ' + what + (flag ? ', and the answer fits only one option on that card' : '') + '.');
        }
      });
    }
  }
  const snap = () => ({ opts: opts.map(s => Array.from(s)), dom: dom.map(s => Array.from(s)) });
  const steps = [Object.assign({ ev: 'Start', top: 'start', bot: '', before: 125, after: 125, why: ['Nothing is known yet. Every digit value and every option is still possible.'], o: [], d: [] }, snap())];
  let turns = 0, knew = null;
  const n0 = { why: [], o: [], d: [] }; propagate(n0);
  if (n0.o.length || n0.d.length) steps.push(Object.assign({ ev: 'The cards and the start-screen facts', top: 'cards', bot: '', before: 125, after: bound(), why: n0.why, o: n0.o, d: n0.d }, snap()));
  if (bound() === 1) knew = 0;
  rows.forEach(r => {
    const keys = rowKeys(r), before = bound(), note = { why: [], o: [], d: [] };
    keys.forEach(i => {   // E1: an option the answer contradicts
      const val = r.res[i], gone = [];
      for (const k of Array.from(opts[i])) { const hit = optTrue(i, k, r.code); if (opts[i].size > 1 && (P.singleOption ? hit !== val : (hit && !val))) { opts[i].delete(k); note.o.push(i + ':' + k); gone.push(q(i, k)); } }
      if (gone.length) note.why.push(LET[i] + '(' + cs(r.code) + ') = ' + tf(val) + ', and ' + cs(r.code) + (val ? ' does not satisfy ' : ' satisfies ') + gone.join(', ') + ', so ' + many(gone, 'that option is', 'those options are') + ' out.');
    });
    propagate(note);
    if (!note.why.length) note.why.push('Nothing new. These answers were already predictable from the worksheet.');
    if (keys.length) {
      const top = keys.map(i => LET[i]).join('') + '(' + cs(r.code) + ')', bot = keys.map(i => tf(r.res[i])).join('');
      steps.push(Object.assign({ ev: (r.guess ? DAG + ' ' : '') + top + ' = ' + bot, top, bot, before, after: bound(), why: note.why, o: note.o, d: note.d }, snap()));
    }
    turns += rowTurns(r);
    if (knew === null && bound() === 1) knew = turns;
  });
  return { steps, bound: bound(), knew };
}
// chart of the solver's count, its worksheet at one step, and why it changed
function solverPanel(sol, guess) {   // guess: the winning code, drawn as a last dotted drop to 0 bits
  const st = sol.steps, cur = Math.max(0, Math.min(st.length - 1, ui.step === null ? st.length - 1 : ui.step)), s = st[cur];
  return '<div class="sp"><div class="spchart">' + chartHtml(st, cur, guess) + '</div><div class="spside"><div class="spnav">'
    + '<button class="ghost" data-act="sp-prev" data-fk="spprev"' + (cur === 0 ? ' disabled' : '') + ' aria-label="previous step">‹ Back</button>'
    + '<span>' + (cur === 0 ? 'Start' : 'Step ' + cur + ' of ' + (st.length - 1)) + '</span>'
    + '<button class="ghost" data-act="sp-next" data-fk="spnext"' + (cur === st.length - 1 ? ' disabled' : '') + ' aria-label="next step">Next ›</button></div>'
    + '<div class="spws">' + stepSheetHtml(s) + '</div>'
    + '<div class="spwhy"><p><b>' + esc(s.ev) + '</b> · at most ' + plural(s.after, 'code') + '</p><ul>' + s.why.map(w => '<li>' + esc(w) + '</li>').join('') + '</ul></div></div></div>';
}
// the chart fills its column: points sit at the middle of equal slots, each slot between 75 and 110 px wide, so the line
// stretches with the width while the text stays its own size; below 75 px a slot the chart scrolls sideways
// log scale: height is bits of uncertainty left, log2(codes), so every halving of the codes is the same drop (125 codes is 7.0 bits, 1 code is 0)
function chartHtml(st, cur, guess) {
  const n = st.length + (guess ? 1 : 0), H = 150, bits = v => Math.log2(Math.max(1, v)), y = v => 40 + (1 - bits(v) / Math.log2(125)) * 72, X = i => (i + 0.5) * 1000 / n;
  const bw = v => { const b = bits(v); return (b < 0.05 ? '0' : b.toFixed(1)) + ' bits'; }, last = st[st.length - 1];
  const at = (cls, top, text) => '<span class="' + cls + '" style="top:' + top + 'px">' + text + '</span>';
  const slot = (i, cls, attrs, v, label, top, bot) => '<div class="slot' + cls + '"' + attrs + ' style="left:' + (i * 100 / n).toFixed(3) + '%;width:' + (100 / n).toFixed(3) + '%" aria-hidden="true">'
    + at('dot', y(v).toFixed(1), '') + (label ? at('v', (y(v) - 33).toFixed(1), label) + at('vc', (y(v) - 19).toFixed(1), '(' + plural(v, 'code') + ')') : '') + at('t', 122, top) + at('t', 136, bot) + '</div>';
  let h = '<div class="spc" style="width:min(100%,' + n * 110 + 'px);min-width:' + n * 75 + 'px" role="img" aria-label="Most codes still possible after each turn: ' + st.map(g => g.after).join(', ') + '. Height shows bits of uncertainty left, so each halving is the same drop.">'
    + '<svg viewBox="0 0 1000 ' + H + '" preserveAspectRatio="none" aria-hidden="true"><polyline class="ln" vector-effect="non-scaling-stroke" points="' + st.map((g, i) => X(i).toFixed(1) + ',' + y(g.after).toFixed(1)).join(' ') + '"/>'
    + (guess ? '<line class="ln guess" vector-effect="non-scaling-stroke" x1="' + X(st.length - 1).toFixed(1) + '" y1="' + y(last.after).toFixed(1) + '" x2="' + X(st.length).toFixed(1) + '" y2="' + y(1).toFixed(1) + '"/>' : '') + '</svg>';
  // a point's count is written only where it changes, at the start, and at the chosen step
  st.forEach((g, i) => { h += slot(i, i === cur ? ' on' : '', ' data-act="sp-go" data-i="' + i + '"', g.after, i === 0 || i === cur || g.after !== st[i - 1].after ? bw(g.after) : '', esc(g.top), esc(g.bot)); });
  if (guess) h += slot(st.length, ' guess', '', 1, '0 bits', DAG + cs(guess), 'your guess');
  return h + '</div>';
}
// the worksheet at one step, with the same look as the player's: a white key is still possible, bare and struck is ruled out,
// blue strike is ruled out at this step, bold is the only one left
function stepSheetHtml(s) {
  const gone = now => '<span class="sr">' + (now ? ' (ruled out at this step)' : ' (ruled out)') + '</span>';
  let h = '<div class="spgrid">' + DIG.map(d => '<i class="h">' + d + '</i>').join('');
  for (let v = 1; v <= 5; v++) for (let d = 0; d < 3; d++) {
    const left = s.dom[d].includes(v), now = s.d.includes(d + ':' + v);
    h += '<i class="' + (left ? '' : 'off') + (now ? ' new' : '') + '"><span class="sr">' + DIG[d] + ' </span>' + v + (left ? '' : gone(now)) + '</i>';
  }
  return h + '</div><div class="spopts">' + P.preds.map((p, i) => '<div><b class="letter">' + LET[i] + '</b><div class="spchips">' + p.options.map((o, k) => {
    const left = s.opts[i].includes(k), only = left && s.opts[i].length === 1, now = s.o.includes(i + ':' + k);
    return '<span class="' + (left ? (only ? 'only' : '') : 'off') + (now ? ' new' : '') + '">' + esc(o.l) + (only ? '<span class="sr"> (the only one left)</span>' : left ? '' : gone(now)) + '</span>';
  }).join('') + '</div></div>').join('') + '</div>';
}
// The worksheet's view and the full check depend only on the game and how many of its rows are counted, and rows are only
// ever added, so each is worked out once per game and row count; the end screen re-renders on every tap of the chart.
const memo = { s: null, sol: {}, v: {} };
function cached(kind, n, make) { if (memo.s !== S) { memo.s = S; memo.sol = {}; memo.v = {}; } return memo[kind][n] || (memo[kind][n] = make()); }
const solverAt = n => cached('sol', n, () => solverRun(S.rows.slice(0, n)));   // the worksheet's view of the first n rows
const verdict = () => cached('v', S.rows.length, verdictNow);
function verdictNow() {
  const before = S.rows.slice(0, -1), sol = solverAt(before.length), exact = exactCount(before), n = S.turns;
  let text, short;
  if (P.solutions > 1) { text = 'This puzzle has ' + P.solutions + ' solutions, and you found one of them.'; short = 'Puzzle has ' + P.solutions + ' solutions'; }
  else if (sol.knew !== null && sol.knew < n) { text = 'Crossing out on the worksheet alone would have found the code after turn ' + sol.knew + '. You guessed after turn ' + n + '.'; short = 'Lost to the worksheet'; }
  else if (sol.knew !== null) { text = 'You guessed as soon as the worksheet alone pinned down the code.'; short = 'Tied the worksheet'; }
  else if (exact === 1) { text = 'You found the code before the worksheet alone could. It still allowed up to ' + sol.bound + ' codes.'; short = 'Beat the worksheet'; }
  else { text = 'Did you cheat, or just get lucky? ' + exact + ' possibilities remained.'; short = 'Lucky guess (' + exact + ' left)'; }
  return { text, short, sol, exact };
}

// ---------- text outputs ----------
function fmtStart(ms) { const d = new Date(ms); return ymd(d) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
function fmtDur(ms) { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
const SETTINGS_KEY = 'S one secret option per predicate, E answer fits one option per card, U one solution, W workbook does work, H highlighter; + yes, - no.';
function settingsLine() { const a = S.aids || { w: false, h: false }, f = b => b ? '+' : '-'; return 'Settings S' + f(P.singleOption) + ' E' + f(!P.overlap) + ' U' + f(P.solutions === 1) + ' W' + f(a.w) + ' H' + f(a.h); }
function headLines(withTime) { return [TITLE + ' ' + P.gid + (withTime ? ' ' + fmtStart(S.startedAt) : '')].concat(S.gotd ? ['Game of the day ' + S.gotd] : [], [settingsLine()], S.hint ? ['Hint used'] : [], S.imported ? ['Imported table'] : []); }
function shareText(v) {
  let line = '';
  for (const r of S.rows) {
    if (!r.guess) line += rowKeys(r).map(i => tf(r.res[i])).join('');
    else if (rowWon(r)) line += ' ' + DAG + T.repeat(P.preds.length);
    else line += ' ' + DAG + r.fresh.map(i => tf(r.res[i])).join('');
  }
  const score = plural(S.turns, 'turn') + ', ' + plural(S.evals, 'evaluation') + ', ' + plural(S.wrong, 'wrong guess', 'wrong guesses');
  const friend = S.rival ? [(rivalDiff() < 0 ? 'Beat' : rivalDiff() > 0 ? 'Lost to' : 'Tied with') + ' a friend\u2019s ' + rivalWord(S.rival)] : [];
  return headLines(false).concat([line.trim(), score], friend, [v.short]).join('\n');
}
function exportText() {
  const n = P.preds.length, rows = S.rows.map(r => (cs(r.code) + (r.guess ? DAG : ' ')) + ' ' + Array.from({ length: n }, (_, i) => i in r.res ? tf(r.res[i]) : DOT).join(' '));
  return headLines(true).concat(['xyz  ' + LET.slice(0, n).join(' ')], rows).join('\n');
}

// read an exported table back into a game: {error} or {pz, state}
function importTable(text) {
  const lines = String(text).replace(/\r/g, '').split('\n'), rowRe = /^\s*([1-5]{3})\s*(†?)\s+(\S.*)$/;
  let g = null;
  for (const ln of lines) { if (rowRe.test(ln)) break; for (const tok of ln.split(/\s+/)) if (!g && tok) g = decodeGame(tok); if (g) break; }
  if (!g) return { error: 'No game code found. Paste the whole export, starting with its title line.' };
  const pz = buildPuzzle(g.pids, g.masks), n = pz.preds.length, st = fresh(pz, false, null), keep = P;
  const head = lines.find(l => l.includes(TITLE)) || '', tm = head.match(/(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d)/), gd = text.match(/Game of the day (\d{4}-\d\d-\d\d)/), se = text.match(/Settings .*W([+-]) H([+-])/);
  if (tm) { const d = new Date(+tm[1], +tm[2] - 1, +tm[3], +tm[4], +tm[5]).getTime(); if (!isNaN(d)) st.startedAt = d; }
  if (gd) st.gotd = gd[1]; if (se) st.aids = { w: se[1] === '+', h: se[2] === '+' }; if (/^\s*Hint used\s*$/m.test(text)) st.hint = true;
  st.imported = true;
  const seen = {}; let err = '', count = 0; P = pz;
  try {
    for (const ln of lines) {
      const m = ln.match(rowRe); if (!m) continue;
      if (st.won) break;
      const code = m[1].split('').map(Number), cells = m[3].trim().split(/\s+/), key = m[1]; count++;
      if (cells.length !== n) { err = 'Row ' + count + ' (' + key + ') has ' + plural(cells.length, 'cell') + '; this game has ' + plural(n, 'predicate') + '.'; break; }
      const res = {}; let bad = '';
      cells.forEach((c, i) => { if (c === T || c === 'T' || c === 't') res[i] = true; else if (c === F_ || c === 'F' || c === 'f') res[i] = false; else if (c !== DOT && c !== '.') bad = c; });
      if (bad) { err = 'Row ' + count + ' (' + key + ') has a cell that is not ' + T + ', ' + F_ + ', or ' + DOT + '.'; break; }
      const wrong = Object.keys(res).find(i => res[i] !== predVal(+i, code));
      if (wrong !== undefined) { err = 'Row ' + count + ' does not belong to this game: ' + LET[wrong] + '(' + key + ') is ' + tf(predVal(+wrong, code)) + ' here. Check the game code and that row.'; break; }
      const kn = seen[key] || (seen[key] = {}), fr = Object.keys(res).map(Number).filter(i => !(i in kn));
      if (m[2]) {
        if (Object.keys(res).length !== n) { err = 'Row ' + count + ' (' + key + ') is marked ' + DAG + ' as a guess, so every cell must be filled.'; break; }
        st.rows.push({ code, res, guess: true, fresh: fr });
        if (cells.every((c, i) => res[i])) { st.won = true; st.finishedAt = st.startedAt; }
        else { st.wrong += 1; st.evals += fr.length; st.turns += Math.ceil(fr.length / 3); }
      } else {
        if (!fr.length) continue;
        if (fr.length > 3) { err = 'Row ' + count + ' (' + key + ') has more than 3 new evaluations and is not marked ' + DAG + ' as a guess.'; break; }
        const only = {}; fr.forEach(i => { only[i] = res[i]; });
        st.rows.push({ code, res: only, guess: false, fresh: fr }); st.turns += 1; st.evals += fr.length;
      }
      fr.forEach(i => { kn[i] = true; });
    }
  } finally { P = keep; }
  if (err) return { error: err };
  if (st.rows.length) st.dial = st.rows[st.rows.length - 1].code.slice();
  return { pz, state: st };
}
function showImport() {
  openModal('<div class="dlg" role="dialog" aria-modal="true"><p>Paste an exported table, finished or not. An unfinished game continues from its last row; a finished one opens on its analysis.</p><textarea id="txtin" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea><small id="txtnote" class="bad"></small><div class="dlgb"><button class="ghost" data-m="0">Cancel</button><button class="primary" data-m="1">Import</button></div></div>', e => {
    const b = e.target.closest('[data-m]'); if (!b) { if (e.target === modal) closeModal(); return; }
    if (b.dataset.m !== '1') { closeModal(); return; }
    const area = modal.querySelector('textarea'), moved = loadSaves(area.value);
    if (moved >= 0) { closeModal(); view = 'setup'; render(); announce('Moved ' + plural(moved, 'saved game') + '.'); const g = document.querySelector('.recent'); if (g) g.scrollIntoView({ block: 'center' }); return; }
    const r = importTable(area.value); if (r.error) { modal.querySelector('#txtnote').textContent = r.error; return; }
    closeModal(); P = r.pz; S = r.state; noteAids(); resetUi(); view = 'play'; save(); render();
  }, 'textarea');
}

// ---------- setup screen ----------
function rowStatus(i) {
  const r = form.rows[i], ptxt = r.p.trim(), ktxt = r.k.trim(), p = ptxt ? resolvePred(ptxt) : null;
  if (!ptxt && !ktxt) return { ok: false, text: '', bad: false };
  if (ptxt && !p) return { ok: false, bad: true, text: 'No predicate has that number.' };
  if (p && form.rows.some((o, j) => j < i && o.p.trim() && (resolvePred(o.p) || {}).id === p.id)) return { ok: false, bad: true, text: 'That predicate is already in the puzzle.' };
  const name = p ? PRED[p.id].text + (p.via ? ' (' + p.id + ')' : '') : '';
  if (!ktxt) return { ok: false, bad: false, text: name };
  const cards = ktxt.split(/[\s,+]+/).filter(Boolean).map(resolveCard);
  if (cards.some(c => !c)) return { ok: false, bad: true, text: (name ? name + '. ' : '') + 'No checker card has that number.' };
  if (!p) return { ok: false, bad: false, text: '' };
  let mask = 0;
  for (const c of cards) { const k = PRED[p.id].o.findIndex(o => o[1] === c); if (k < 0) return { ok: false, bad: true, text: name + '. That checker number belongs to a different predicate.' }; mask |= 1 << k; }
  return { ok: true, bad: false, text: name + (cards.length > 1 ? ' (' + cards.length + ' secret options)' : ''), extra: cards.length > 1 ? cards.length + ' secret options' : '', pid: p.id, mask };
}
const rowMsg = st => st.bad ? st.text : (st.extra || '');
const GROUPS = [[101, 'One digit against a number'], [116, 'One digit: even, odd, or prime'], [122, 'Counting digits'], [132, 'Two digits'], [141, 'Sums and products'],
  [154, 'Shape of the whole code'], [168, 'Which digit or pair (the choice is hidden)']];
function predSelect(i) {
  const cur = resolvePred(form.rows[i].p), used = new Set(form.rows.map((r, j) => j === i ? null : (resolvePred(r.p) || {}).id));
  let h = '<select id="sel' + i + '" data-sel="' + i + '" aria-label="choose a predicate for ' + LET[i] + '"><option value="">Choose a predicate\u2026</option>';
  GROUPS.forEach((g, gi) => {
    const end = gi + 1 < GROUPS.length ? GROUPS[gi + 1][0] : Infinity;
    h += '<optgroup label="' + esc(g[1]) + '">' + LIB.preds.filter(p => p.id >= g[0] && p.id < end)
      .map(p => '<option value="' + p.id + '"' + (cur && cur.id === p.id ? ' selected' : '') + (used.has(p.id) ? ' disabled' : '') + '>' + p.id + ' \u00b7 ' + esc(p.text) + '</option>').join('') + '</optgroup>';
  });
  return h + '</select>';
}
function formPuzzle() { const st = form.rows.map((r, i) => rowStatus(i)); if (st.some(s => !s.ok)) return null; try { return buildPuzzle(st.map(s => s.pid), st.map(s => s.mask)); } catch (e) { return null; } }
function checkForm() { const pz = formPuzzle(); form.report = pz ? { pz } : { error: 'Every line needs a predicate number and a checker number that belongs to it.' }; }
function codeProblem(text) {   // a specific reason a code-box entry was refused
  const words = String(text).trim().split(/\s+/);
  if (words.length > 2) return 'No game code found in that text. A summary starts with a line like “' + TITLE + ' 1CJ0-A72C-7YVF”.';
  const s = normCode(words.join('')), bad = Array.from(s).find(ch => A32.indexOf(ch) < 0);
  if (bad) return '“' + bad + '” cannot appear in a game code. Codes use digits and letters, but never U.';
  if (s[0] !== CODE_VERSION) return 'Game codes start with ' + CODE_VERSION + ', like 1CJ0-A72C-7YVF.';
  return 'A character looks mistyped or missing: the code’s last character, its check, does not match. Compare it with the original.';
}
function clearCode(code) { form.code = code; form.codeBad = false; form.report = null; form.gotd = null; form.note = ''; }   // the lines changed: the code box follows them
function loadCode(code) {   // a valid code fills in the code box, the lines, and the report; anything from an earlier entry is dropped
  const g = decodeGame(code); if (!g) return false;
  const pz = buildPuzzle(g.pids, g.masks);
  form.rows = rowsOf(pz); form.code = pz.gid; form.codeBad = false; form.show = false; form.report = { pz }; form.gotd = null; form.note = ''; form.rival = null;
  return true;
}
// The code box also takes a friend's pasted summary: their game, with their score to beat.
function gotdModes(date, gid) {   // which mode set, if any, makes this code the game of that day: 'mine', a description, or null
  const keep = Object.assign({}, MODE); let found = null;
  try {
    for (let m = 0; m < 8 && !found; m++) {
      const mine = m === 0; if (!mine) { MODE.single = !!(m & 4); MODE.excl = !!(m & 2); MODE.uniq = !!(m & 1); if (MODE.single === keep.single && MODE.excl === keep.excl && MODE.uniq === keep.uniq) continue; }
      const g = gameOfDay(date); if (g && encodeGame(g.pids, g.masks).replace(/-/g, '') === gid.replace(/-/g, '')) found = mine ? 'mine' : MODES.filter(x => MODE[x[0]]).map(x => x[1].replace('?', '').toLowerCase()).join(', ') || 'no modes checked';
    }
  } finally { Object.assign(MODE, keep); }
  return found;
}
function loadEntry(text) {   // returns false, or 'code' | 'summary'
  const s = String(text).trim();
  let tok = null; for (const w of s.split(/\s+/)) if (decodeGame(w)) { tok = w; break; }
  if (!tok || !loadCode(tok)) return false;
  if (s === tok) return 'code';
  const gid = form.report.pz.gid, notes = [], sc = s.match(/(\d+) turns?, (\d+) evaluations?, (\d+) wrong guess/), se = s.match(/Settings S[+-] E[+-] U[+-] W([+-]) H([+-])/), gd = s.match(/Game of the day (\d{4}-\d\d-\d\d)/);
  if (gd) {
    const how = gotdModes(gd[1], gid);
    if (how) {
      form.gotd = { gid, date: gd[1], other: how !== 'mine' };
      if (how !== 'mine') notes.push('Your friend’s game of the day was made with different game modes from yours (theirs: ' + how + '). You will play their game, not the one your modes give for that day.');
    }
    else notes.push('The summary says game of the day ' + gd[1] + ', but its code is not that day’s game under any modes. It will be played as an ordinary game.');
  }
  if (sc) {
    form.rival = { gid, turns: +sc[1], evals: +sc[2], wrong: +sc[3], hint: /Hint used/.test(s), imported: /Imported table/.test(s) };
    if (se) { const d = []; if ((se[1] === '+') !== WORK) d.push('“Workbook does work” ' + (se[1] === '+' ? 'on' : 'off')); if ((se[2] === '+') !== HL) d.push('the highlighter ' + (se[2] === '+' ? 'on' : 'off'));
      if (d.length) notes.push('Your friend played with ' + d.join(' and ') + '; your aids are set differently.'); }
  }
  form.note = notes.join(' '); return 'summary';
}
function rivalDiff() { return S.turns - S.rival.turns || S.evals - S.rival.evals; }
function rivalWord(r) { return plural(r.turns, 'turn') + ', ' + plural(r.evals, 'evaluation') + (r.wrong ? ', ' + plural(r.wrong, 'wrong guess', 'wrong guesses') : '') + (r.hint ? ', with a hint' : ''); }
const MODES = [
  ['single', 'One secret option per predicate?', ' games where a predicate has more than one secret option'],
  ['excl', 'Exclusive predicates only?', ' games where the secret code fits more than one listed option on a card'],
  ['uniq', 'Unique answers only?', ' games with multiple answers']];
const modeText = m => (MODE[m[0]] ? 'Do not show' : 'Show') + m[2];
function optsHtml() {
  return '<div class="opts"><label class="opt"><input type="checkbox" id="work" data-fk="work"' + (WORK ? ' checked' : '') + '><span>Workbook does work: a circled digit crosses out the rest of its column'
    + (!P || P.singleOption || view !== 'play' ? ', and a circled option crosses out the rest of its card' : '') + (view !== 'play' ? ' (options only when each predicate has one secret option)' : '') + '</span></label>'
    + '<label class="opt"><input type="checkbox" id="hl" data-fk="hl"' + (HL ? ' checked' : '') + '><span>Highlight the options the current code satisfies</span></label>'
    + themeHtml() + '</div>';
}
function themeHtml() {
  return '<div class="theme" role="group" aria-label="Color theme"><span>Theme</span>'
    + THEMES.map(x => '<button class="ghost" data-act="theme" data-v="' + x[0] + '" aria-pressed="' + (THEME === x[0]) + '">' + x[1] + '</button>').join('') + '</div>';
}
function aidsWord() {   // the folded Aids row says what is on, so it need not be opened to check
  const on = [WORK ? 'Workbook' : '', HL ? (WORK ? 'highlighter' : 'Highlighter') : ''].filter(Boolean);
  return (on.length ? on.join(', ') : 'No aids') + ' \u00b7 ' + THEMES.find(x => x[0] === THEME)[1];   // the row's label already says Aids & theme
}
const canPlay = () => !!(form.report && form.report.pz && form.report.pz.solutions > 0);
function setReport() {
  const a = document.getElementById('report'), b = document.getElementById('report2'), p = document.getElementById('codeplay');
  if (a) a.innerHTML = reportHtml(false); if (b) b.innerHTML = reportHtml(true); if (p) p.disabled = !canPlay();
}
function reportHtml(play) {
  const rp = form.report; if (!rp) return '';
  if (rp.error) return '<p class="status bad">' + esc(rp.error) + '</p>';
  const pz = rp.pz, n = pz.solutions; let h = '';
  if (form.gotd && form.gotd.gid === pz.gid) h += '<p class="rep"><b>Game of the day for ' + esc(form.gotd.date) + '</b>' + (form.gotd.other ? ', as your friend played it.' : ', for your game modes.') + '</p>';
  if (form.rival && form.rival.gid === pz.gid) h += '<p class="rep"><b>Your friend’s score:</b> ' + rivalWord(form.rival) + '.</p>';
  if (form.note) h += '<p class="rep muted">' + esc(form.note) + '</p>';
  h += '<p class="rep">';
  h += n === 1 ? 'One solution.' : n === 0 ? 'No solution. No guess could be correct, so this puzzle cannot be played.' : 'More than one solution.' + (form.show ? ' There are ' + n + '.' : '');
  h += '</p><p class="rep">' + (pz.singleOption ? 'One secret option per predicate.' : 'Some predicates have more than one secret option.') + '</p>';
  if (n > 0) h += '<p class="rep">' + (pz.overlap ? 'On at least one predicate, the answer fits more than one of the listed options.' : 'On every predicate, the answer fits exactly one of the listed options.') + '</p>';
  const out = []; if (MODE.single && !pz.singleOption) out.push('one secret option per predicate'); if (MODE.excl && pz.overlap) out.push('exclusive predicates'); if (MODE.uniq && n > 1) out.push('unique answers');
  if (n > 0 && out.length) h += '<p class="rep muted">This puzzle is outside the game modes you checked (' + out.join(', ') + '). You can still play it.</p>';
  if (n > 0 && (play || (n > 1 && !form.show))) h += '<div class="endb">' + (play ? '<button class="primary" data-act="play">Play</button>' : '') + (n > 1 && !form.show ? '<button class="ghost" data-act="count">Show count</button>' : '') + '</div>';
  return h;
}
function rowsHtml() {
  let h = '';
  form.rows.forEach((r, i) => {
    const st = rowStatus(i);
    h += '<div class="srow"><span class="letter">' + LET[i] + '</span><input id="p' + i + '" data-row="' + i + '" data-f="p" inputmode="numeric" autocomplete="off" placeholder="predicate" aria-label="predicate number for ' + LET[i] + '" value="' + esc(r.p) + '">';
    h += '<input id="k' + i + '" data-row="' + i + '" data-f="k" autocomplete="off" placeholder="checker" aria-label="checker number for ' + LET[i] + '" value="' + esc(r.k) + '">';
    h += (form.rows.length > 1 ? '<button class="ghost" data-act="rm" data-i="' + i + '" aria-label="remove ' + LET[i] + '">Remove</button>' : '<span></span>') + predSelect(i) + '<span class="res' + (st.bad ? ' bad' : '') + '" id="res' + i + '">' + esc(rowMsg(st)) + '</span></div>';
  });
  return h;
}
function bankHtml() {
  const list = bankShown(), row = (g, v, name) => '<option value="' + v + g.i + '">' + name + ' · ' + g.n + ' predicates · ' + g.code + '</option>';
  return '<option value="">Choose a game</option><optgroup label="Starter puzzles (' + (list.length ? list.length + ' of ' + BANKMETA.length + ' fit the game modes' : 'none fit the game modes') + ')">' + list.map(g => row(g, 'm', String(g.i + 1).padStart(2, '0'))).join('')
    + '</optgroup><optgroup label="Turing Machine manual (legacy pack)">' + TMMETA.map(g => row(g, 't', 'Game ' + (g.i + 1))).join('') + '</optgroup>';
}

function gameRow(s, what, cls, label, attr) {   // a saved game: its code, its day, how far it got, and a button
  const d = new Date(s.startedAt), day = s.gotd ? 'Game of the day ' + s.gotd : isNaN(d) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return '<div class="start recent"><div class="recinfo"><span class="code">' + esc(s.gid) + '</span><span>' + esc(day + ' \u00b7 ' + what) + '</span></div><button class="' + cls + '" data-act="recent" data-id="' + esc(gameId(s)) + '"' + attr + '>' + label + '</button></div>';
}
function modesWord() { const on = MODES.filter(m => MODE[m[0]]).length; return 'Game modes (' + (on === 3 ? 'all three on' : on + ' of 3 on') + ')'; }
const fold = (open, label) => (open ? '▾ ' : '▸ ') + label;
const row = (label, inner) => '<div class="lbl">' + label + '</div><div class="start">' + inner + '</div>';   // one setup row: its name, then its controls
function renderSetup() {
  const cont = continueGame();
  let h = '<header class="top"><h1>' + TITLE + '</h1></header>';
  if (askInstall()) h += '<div class="install"><span>Add ' + TITLE + ' to your home screen? It opens like an app and works offline.</span><button class="primary" data-act="inst-yes" data-fk="instyes">Yes</button><button class="ghost" data-act="inst-no" data-fk="instno">No</button></div>';
  if (cont) h += '<section class="setup"><div class="lbl">Continue</div>' + gameRow(cont, 'turn ' + (cont.turns + 1), 'primary', 'Resume', ' data-fk="cont"') + '</section>';   // the one place to resume: the game open now, or else the newest unfinished one
  h += '<section class="setup">' + (newcomer() ? newcomerHtml() : '<div><button class="ghost big" data-act="tutorial" data-fk="tut">How to play</button></div>');
  h += startRowsHtml() + importRowHtml() + buildHtml();
  h += row('Aids &amp; theme', '<button class="foldsel" data-act="fold" data-f="faids" id="aidsfold" aria-expanded="' + !!form.faids + '">' + fold(form.faids, aidsWord()) + '</button>') + (form.faids ? optsHtml() : '');
  app.innerHTML = h + recentHtml(cont) + '</section>';   // recent games go last, below Aids, so the rows that start a game stay together
}
function newcomerHtml() {
  return '<div class="lbl">New here?</div><p class="newbie">How to play takes about three minutes. Then try a small first puzzle with four cards.'
    + (STANDALONE && IOS ? ' Moved from Safari? Bring your games with “Paste a table or saved games” below.' : '') + '</p>'
    + '<div class="start"><button class="' + (LS.get('tut-seen') ? 'ghost' : 'primary') + ' big" data-act="tutorial" data-fk="tut">How to play</button></div>'
    + row('First puzzle', '<span class="firstp">Four cards, one solution</span><button class="primary" data-act="first-play" data-fk="firstp">Play</button>');
}
function startRowsHtml() {   // every way to start is one row: its name, its setting, and Play in the same place
  let h = row('Game of the day', '<input type="date" id="gdate" aria-label="Day" value="' + esc(form.gdate || todayStr()) + '"><button class="primary" data-act="gotd-play">Play</button>');
  h += row('Random game', '<button class="foldsel" data-act="fold" data-f="fmodes" aria-expanded="' + !!form.fmodes + '">' + fold(form.fmodes, modesWord()) + '</button><button class="primary" data-act="rand-play">Play</button>');
  if (form.fmodes) {
    h += '<div class="opts">' + MODES.map(m => '<label class="opt"><input type="checkbox" id="mode-' + m[0] + '"' + (MODE[m[0]] ? ' checked' : '') + '><span><b>' + m[1] + '</b> <span id="modetxt-' + m[0] + '">' + modeText(m) + '</span></span></label>').join('') + '</div>';
    h += '<p class="hint">A checked mode is guaranteed; an unchecked one is left to chance. The modes also decide which game of the day you get, which starter puzzles the list shows, and what the New buttons make.</p>';
  }
  // always Play: Resume lives only in the Continue row, and Play on a puzzle partway through picks up where it left off
  h += row('Game code', '<input id="code" aria-label="Game code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="a code, or a friend’s summary" value="' + esc(form.code) + '"><button class="primary" id="codeplay" data-act="play"' + (canPlay() ? '' : ' disabled') + '>Play</button>');
  h += row('Game list <span class="note">fills in the code above</span>', '<select id="bank" aria-label="Game list">' + bankHtml() + '</select>');
  return h + '<span class="res' + (form.codeBad ? ' bad' : '') + '" id="codemsg">' + (form.codeBad ? esc(codeProblem(form.code)) : '') + '</span><div id="report">' + reportHtml(false) + '</div>';
}
const importRowHtml = () => row('Continue or review a game', '<button class="foldsel" data-act="import" data-fk="import">' + (STANDALONE ? 'Paste a table or saved games' : 'Paste its exported table') + '</button>');
function buildHtml() {
  let h = row('Build a puzzle', '<button class="foldsel" data-act="fold" data-f="fbuild" aria-expanded="' + !!form.fbuild + '">' + fold(form.fbuild, 'Predicates and checkers') + '</button>');
  if (!form.fbuild) return h;
  h += '<div id="rows">' + rowsHtml() + '</div>';
  h += '<div class="endb"><button class="ghost" data-act="add">Add a predicate</button><button class="ghost" data-act="rand-preds">New predicates</button><button class="ghost" data-act="rand-active">New secret options</button><button class="primary" data-act="check">Check puzzle</button></div>';
  h += '<div id="report2">' + reportHtml(true) + '</div>';
  return h + '<p class="hint">These lines and the game code are the same puzzle; changing either updates the other. Pick each predicate from its list or type its number (they run from 101); checker numbers run from 1000. '
    + 'Each line’s checker number names its secret option; for two secret options on one predicate, type both checker numbers in its box. New predicates uses as many predicates as there are lines. '
    + 'Turing Machine criteria numbers (1 to 48) and verification numbers (201 to 798) are converted automatically.</p>';
}
function recentHtml(cont) {
  const rec = recentGames().filter(s => !cont || gameId(s) !== gameId(cont));
  if (!rec.length) return '';
  return '<div class="lbl">Recent games <span class="note">only the last ' + RECENT_MAX + ' are kept</span></div>'
    + rec.map(s => s.won ? gameRow(s, 'won in ' + plural(s.turns, 'turn'), 'ghost', 'Review', '') : gameRow(s, 'turn ' + (s.turns + 1) + ', in progress', 'primary', 'Resume', '')).join('');
}
function syncFromRows() {   // rows edited by hand: refresh row messages and the game code
  form.rows.forEach((r, i) => {
    const st = rowStatus(i), out = document.getElementById('res' + i), sel = document.getElementById('sel' + i), cur = resolvePred(r.p);
    if (out) { out.textContent = rowMsg(st); out.className = 'res' + (st.bad ? ' bad' : ''); }
    if (sel) sel.value = cur ? String(cur.id) : '';
  });
  const pz = formPuzzle(); clearCode(pz ? pz.gid : '');
  const c = document.getElementById('code'); if (c) c.value = form.code;
  const m = document.getElementById('codemsg'); if (m) { m.textContent = ''; m.className = 'res'; }
  setReport();
}

// ---------- play screen ----------
function renderPlay() {
  const fk = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.fk : null;
  app.innerHTML = playHeader() + factsHtml() + tableHtml()
    + (!S.won && ui.hint ? hintHtml() : '') + (S.won ? endHtml() : worksheetHtml() + '<div class="lbl">Aids</div>' + optsHtml())
    + (S.won ? themeHtml() : '');   // a finished game has no aids to set, but the theme stays at the bottom
  if (fk) { const el = app.querySelector('[data-fk="' + fk + '"]'); if (el && !el.disabled) el.focus({ preventScroll: true }); }
  { // keep the chosen step in view when the chart scrolls
    const on = app.querySelector('.spc .slot.on'), box = on && on.closest('.spchart');
    if (box && box.scrollWidth > box.clientWidth) box.scrollLeft = Math.max(0, on.offsetLeft + on.offsetWidth / 2 - box.clientWidth / 2);
  }
}
const metaItem = (label, value, cls) => '<span' + (cls ? ' class="' + cls + '"' : '') + '><span class="lbl">' + label + '</span> <b>' + value + '</b></span>';
function playHeader() {
  let h = '<header class="top"><h1>' + TITLE + '</h1><div class="tools"><button class="ghost" data-act="tutorial" data-fk="tut">How to play</button>';
  if (S.won) {   // a finished game has only two of these, so they need no menu
    h += '<button class="ghost" data-act="export" data-fk="export">Export table</button><button class="ghost" data-act="setup" data-fk="setup">New puzzle</button>';
  } else {
    h += '<button class="ghost" data-act="hint" data-fk="hint">' + (ui.hint ? 'Hide hint' : 'Hint') + '</button>'
      + '<div class="menuwrap"><button class="ghost more" data-act="menu" data-fk="menu" aria-haspopup="true" aria-expanded="' + !!ui.menu + '" aria-label="More: export, restart, new puzzle">⋯</button>'
      + (ui.menu ? '<div class="menu" role="menu"><button role="menuitem" data-act="export" data-fk="export">Export table</button>'
        + '<button role="menuitem" data-act="restart" data-fk="restart">Restart this puzzle</button>'
        + '<button role="menuitem" data-act="setup" data-fk="setup">New puzzle</button></div>' : '') + '</div>';
  }
  h += '</div><div class="meta">' + metaItem('Game', P.gid) + (S.gotd ? metaItem('Game of the day', esc(S.gotd)) : '')
    + (S.won ? metaItem('Turns', S.turns) : metaItem('Turn', S.turns + 1)) + metaItem('Evaluations', S.evals)
    + (S.rival ? metaItem('Friend', rivalWord(S.rival), 'rival') : '') + '</div></header>';
  return h;
}
function factsHtml() {
  return '<section class="facts"><div class="lbl">Puzzle facts</div>'
    + '<p>' + (P.solutions === 1 ? 'One solution' : S.showCount ? P.solutions + ' solutions' : 'More than one solution') + '</p>'
    + '<p>' + (P.singleOption ? 'One secret option per predicate' : 'Some predicates have more than one secret option') + '</p>'
    + '<p>' + (P.overlap ? 'The answer fits more than one listed option on at least one predicate' : 'The answer fits exactly one listed option on every predicate') + '</p></section>';
}
function tableHtml() {   // the truth table: a heading row, one row per evaluation or guess, and the row for the next test
  const n = P.preds.length, kn = known(S.dial), eff = effTicks(kn);
  const echo = new Set(Object.keys(kn).map(i => kn[i].row + ':' + i)), contra = new Set(S.contra);
  let h = '<section class="board" style="--n:' + n + '" aria-label="Truth table"><div class="lbl">Truth table</div><div class="row head" aria-hidden="true">'
    + DIG.map(d => '<span class="c">' + d + '</span>').join('')
    + LET.slice(0, n).map((l, i) => '<span class="c"><button class="jump" data-act="tocard" data-i="' + i + '" id="col' + i + '" tabindex="-1">' + l + '</button></span>').join('')
    + '<span class="c"></span></div>';
  S.rows.forEach((r, ri) => {
    const said = P.preds.map((p, i) => LET[i] + (i in r.res ? (r.res[i] ? ' true' : ' false') + (contra.has(ri + ':' + i) ? ' (rules out your guess)' : '') : ' not tested')).join(', ');
    h += '<div class="row hist' + (r.guess ? ' guess' : '') + '" role="group" aria-label="' + (r.guess ? 'Guess ' : 'Code ') + cs(r.code) + ': ' + said + '">';
    r.code.forEach((v, d) => { h += '<span class="c d" aria-hidden="true">' + v + (d === 2 && r.guess ? '<span class="dag" title="guess">' + DAG + '</span>' : '') + '</span>'; });
    for (let i = 0; i < n; i++) {
      const id = ri + ':' + i;
      h += '<span class="c" aria-hidden="true">' + (i in r.res ? '<span class="r ' + (r.res[i] ? 't' : 'f') + (echo.has(id) ? ' echo' : '') + (contra.has(id) ? ' contra' : '') + '">' + tf(r.res[i]) + '</span>' : '') + '</span>';
    }
    h += '<span class="c" aria-hidden="true"></span></div>';
  });
  if (!S.won) h += inputRowHtml(kn, eff);
  return h + '</section>' + (S.won ? '' : '<p class="status slot' + (ui.bad ? ' bad' : '') + '">' + esc(ui.msg) + '</p>');
}
function inputRowHtml(kn, eff) {   // the code to test, a box per predicate, and the two ways to play it
  const canEval = eff.length >= 1 && eff.length <= 3, canKnow = eff.length === 0;
  let h = '<div class="zone next"><div class="row input">';
  for (let d = 0; d < 3; d++) {
    const v = S.dial[d];
    h += '<div class="c"><div class="stepper"><button class="pm" data-act="inc" data-d="' + d + '" aria-label="increase ' + DIG[d] + ', now ' + v + '" data-fk="inc' + d + '">+</button>'
      + '<span class="dv cur m' + markD(d, v - 1) + '" aria-hidden="true">' + v + '</span>'
      + '<button class="pm" data-act="dec" data-d="' + d + '" aria-label="decrease ' + DIG[d] + ', now ' + v + '" data-fk="dec' + d + '">−</button></div></div>';
  }
  for (let i = 0; i < P.preds.length; i++) {
    h += '<div class="c tickwrap">';
    if (i in kn) h += '<span class="r echo ' + (kn[i].val ? 't' : 'f') + '" title="already evaluated on this code"><span aria-hidden="true">' + tf(kn[i].val) + '</span><span class="sr">' + LET[i] + ' is already ' + (kn[i].val ? 'true' : 'false') + ' on this code</span></span>';
    else {
      const on = S.ticks.includes(i);
      h += '<button class="box' + (ui.pending ? ' pending' : on ? ' on' : '') + '" data-act="tick" data-i="' + i + '" aria-pressed="' + (on || ui.pending) + '" aria-label="evaluate ' + LET[i] + '" data-fk="tick' + i + '">' + (on || ui.pending ? '✓' : '') + '</button>';
    }
    h += '</div>';
  }
  return h + '<div class="c acts"><button class="go" data-act="eval" data-fk="eval"' + (canEval ? '' : ' disabled') + '>Evaluate</button>'
    + '<button class="know" data-act="know" data-fk="know" title="I Know The Answer"' + (canKnow ? '' : ' disabled') + '>I know the answer</button></div></div></div>';
}
function hintHtml() {
  return '<section class="end"><h2>What your answers show so far</h2>' + solverPanel(solverAt(S.rows.length))
    + '<p class="hint">This worksheet is filled in from the answers in your table and nothing else: an option is crossed out when an answer contradicts it, and a digit value when no remaining option allows it. Crossings in blue are new at that step; bold marks the only option left.</p></section>';
}
function endHtml() {   // a won game: the code, the score, how it compares, the summary, and the worksheet's view
  const win = S.rows[S.rows.length - 1], v = verdict(), stat = (t, d) => '<div><dt>' + t + '</dt><dd>' + d + '</dd></div>';
  let h = '<section class="end"><h2>' + cs(win.code) + ' is the code.</h2><dl class="stats">' + stat('Turns', S.turns) + stat('Evaluations', S.evals) + stat('Wrong guesses', S.wrong)
    + stat('Time', S.imported ? '—' : fmtDur(S.finishedAt - S.startedAt)) + '</dl>';
  if (S.rival) { const d = rivalDiff(); h += '<p class="verdict">' + (d < 0 ? 'You beat your friend' : d > 0 ? 'Your friend beat you' : 'You tied with your friend') + ': they took ' + rivalWord(S.rival) + '.</p>'; }
  h += '<p class="verdict">' + esc(v.text) + '</p>';
  h += '<div class="lbl">Summary to share</div><pre class="out">' + esc(shareText(v)) + '</pre>';
  h += '<div class="endb"><button class="primary" data-act="copyshare" data-fk="copyshare">Copy summary</button><button class="ghost" data-act="again" data-fk="again">Play again</button>'
    + '<button class="ghost" data-act="setup" data-fk="setup2">New puzzle</button><button class="ghost" data-act="export" data-fk="export2">Export table (spoiler)</button></div>';
  h += '<h2 class="sub">How the worksheet saw it</h2>' + solverPanel(v.sol, P.solutions === 1 ? win.code : null);
  return h + '<p class="hint">The line shows what crossing out on the worksheet alone had left after each turn, in bits: each bit halves the codes still possible, so 7.0 bits is all 125 codes and 0 bits is one. '
    + 'The codes counted are the remaining values for x, y, and z multiplied together. Tap a point, or use Back and Next, to see that worksheet at that moment and why it changed. '
    + 'Crossings in blue are new at that step; bold marks the only option left. Checking every code against your evaluations and the start-screen facts, ' + plural(v.exact, 'code') + ' remained possible when you guessed.</p></section>';
}
function worksheetHtml() {   // the player's scratch paper: digit values, then each card's options
  let h = '<section class="zone ws"><div class="lbl">Worksheet <span class="note">tap to cross out, hold to circle' + (WORK ? '; a circle crosses out the rest of its column' + (P.singleOption ? ' or card' : '') : '') + '</span></div>'
    + '<div class="sheet"><div class="digits" role="group" aria-label="Digit worksheet">' + DIG.map(d => '<span class="dh">' + d + '</span>').join('');
  for (let v = 1; v <= 5; v++) for (let d = 0; d < 3; d++) h += '<button class="mark m' + markD(d, v - 1) + '" data-mark="d:' + d + ':' + (v - 1) + '" data-fk="md' + d + v + '" aria-label="' + DIG[d] + ' ' + v + STATE_WORD[markD(d, v - 1)] + '">' + v + '</button>';
  h += '</div><div class="cards">';
  P.preds.forEach((p, i) => {
    h += '<article class="card" id="card' + i + '"><h3><button class="letter jump" data-act="tocol" data-i="' + i + '" tabindex="-1" aria-hidden="true">' + LET[i] + '</button><span>' + esc(p.text) + '</span></h3><div class="chips">';
    p.options.forEach((o, k) => { h += '<button class="chip mark m' + markO(i, k) + (determined(i, k) ? ' match' : '') + '" data-mark="o:' + i + ':' + k + '" data-fk="mo' + i + '_' + k + '" aria-label="' + LET[i] + ': ' + esc(o.f) + STATE_WORD[markO(i, k)] + '">' + esc(o.l) + '</button>'; });
    h += '</div></article>';
  });
  return h + '</div></div></section>';
}
function jumpTo(kind, i) {   // a quiet shortcut: a column letter scrolls to its card, a card letter back to its column
  const el = document.getElementById((kind === 'tocard' ? 'card' : 'col') + i); if (!el) return;
  const still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ block: kind === 'tocard' ? 'center' : 'start', behavior: still ? 'auto' : 'smooth' });
  if (kind === 'tocol') window.scrollBy(0, -60);
  const fl = kind === 'tocard' ? el : el.parentNode; fl.classList.remove('flash'); void fl.offsetWidth; fl.classList.add('flash');
}
function render() { if (view === 'play' && P && S) renderPlay(); else renderSetup(); }

// ---------- dialogs ----------
const TUTORIAL = '<h2>How to play</h2>'
  + '<p><b>Goal.</b> Find the secret code: three digits <i>x</i>, <i>y</i>, <i>z</i>, each from 1 to 5.</p>'
  + '<p><b>Predicates.</b> Each lettered card (P, Q, R…) asks one question about the code and lists a few options, such as “x &lt; 3”, “x = 3”, “x &gt; 3”.</p>'
  + '<p><b>Secret options.</b> On every card, one option is the <i>secret option</i>: the one that card is really checking. Which one is hidden, and finding out is the game. The secret code satisfies the secret option on every card. Usually each card has exactly one; if the puzzle facts say a predicate can have more than one, the secret code satisfies at least one of them.</p>'
  + '<p><b>A turn.</b> Set any code with + and −, check up to three predicates, and press Evaluate. Each checked predicate answers ⊤ (true) if <i>your</i> code satisfies its secret option, and ⊥ (false) if it does not.</p>'
  + '<p><b>Reading answers.</b> An answer is about the code you tried, not about how close you are. If “x compared to 3” says ⊤ for 425, the secret option is one that 425 satisfies, so it must be “x &gt; 3”. Work out each card’s secret option, then find the one code that fits them all.</p>'
  + '<p><b>Careful.</b> On some cards the options overlap (“x is prime”, “y is prime”…), so a code can satisfy several. Only the secret option counts, even if your code also satisfies another. The puzzle facts say whether the secret code itself fits more than one listed option anywhere.</p>'
  + '<p><b>Guessing.</b> With nothing checked, press “I know the answer”. A right guess wins. A wrong guess shows that code against every predicate (marked †) and costs the turns those evaluations would have cost.</p>'
  + '<p><b>Worksheet.</b> Below the table: tap a digit or option to cross it out, press and hold to circle it. It is your scratch paper; by default the game does no thinking for you. Two aids at the bottom of the screen can change that.</p>'
  + '<p><b>Score.</b> Fewer turns is better, then fewer evaluations. At the end you see how soon careful crossing-out on the worksheet would have found the code from the same answers.</p>'
  + '<p><b>Building a puzzle.</b> Under \u201cBuild a puzzle\u201d each line is one card: a predicate number and the checker number of its secret option. \u201cNew predicates\u201d swaps the cards and keeps nothing else; \u201cNew secret options\u201d keeps the cards and picks new secret options. Both follow the game modes. Typing two checker numbers on one line gives that card two secret options.</p>'
  + '<p><b>Hints and the review.</b> Hint shows a worksheet filled in from your answers so far, with the reason for each mark. It uses two rules: cross out an option that an answer contradicts, and cross out a digit value when some card has no remaining option that allows it. Your summary will then say \u201cHint used\u201d. After a game you can step through the same worksheet turn by turn.</p>'
  + '<p><b>Playing a friend\u2019s game.</b> Paste their summary into the Game code box. You get the same puzzle, and their score stays on screen to beat. Your own summary then says how you compared.</p>'
  + '<p><b>Passing a game on.</b> “Export table” works at any point in a game. “Continue or review a game” on the New puzzle screen loads one: an unfinished table continues from its last row, a finished one opens on its analysis. Worksheet marks do not travel, and an imported game says “Imported table” in its summary. The New puzzle screen lists your last ' + RECENT_MAX + ' games under Recent games; older ones are deleted, so export any game you want to keep.</p>';
let opener = null;   // data-fk of the control that opened the dialog, so focus can go back to it
// every dialog: its markup, what a click inside does, which control gets focus, and what Escape does (by default, close it)
function openModal(html, onclick, focus, onEscape) {
  modal.innerHTML = html; modal.hidden = false; modal.onclick = onclick; modal.onEscape = onEscape || closeModal;
  const f = modal.querySelector(focus); if (f) f.focus();
}
function closeModal() {
  modal.hidden = true; modal.innerHTML = ''; modal.onclick = null; modal.onEscape = null;
  const el = opener && document.querySelector('[data-fk="' + opener + '"]'); if (el && !el.disabled) el.focus({ preventScroll: true });
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !modal.hidden && modal.onEscape) { modal.onEscape(); return; }
  if (e.key !== 'Tab' || modal.hidden) return;
  const f = Array.from(modal.querySelectorAll('button,textarea,input,select,[tabindex]')).filter(x => !x.disabled); if (!f.length) return;
  const i = f.indexOf(document.activeElement);
  if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && (i === f.length - 1 || i < 0)) { e.preventDefault(); f[0].focus(); }
});
function ask(html, ok) {
  return new Promise(res => {
    const done = v => { closeModal(); res(v); };
    openModal('<div class="dlg" role="dialog" aria-modal="true"><p>' + html + '</p><div class="dlgb"><button class="ghost" data-m="0">Cancel</button><button class="primary" data-m="1">' + esc(ok) + '</button></div></div>',
      e => { const b = e.target.closest('[data-m]'); if (b) done(b.dataset.m === '1'); else if (e.target === modal) done(false); }, '.primary', () => done(false));
  });
}
function showTutorial() {
  LS.set('tut-seen', '1');
  openModal('<div class="dlg tut" role="dialog" aria-modal="true"><div class="tutbody">' + TUTORIAL + (SITE ? '<p class="fine"><button class="quiet" data-m="upd">Manually check for updates</button></p>' : '') + '</div><div class="dlgb"><button class="primary" data-m="0">Got it</button></div></div>', e => {
    const b = e.target.closest('[data-m]'); if (b && b.dataset.m === 'upd') { const p = b.parentNode; p.textContent = ''; checkUpdate(p); return; }
    if (b || e.target === modal) closeModal();
  }, '.primary', closeModal);
}
function showText(title, text) {
  openModal('<div class="dlg" role="dialog" aria-modal="true"><p>' + esc(title) + '</p><textarea id="txtout" readonly></textarea><small id="txtnote"></small><div class="dlgb"><button class="ghost" data-m="0">Close</button><button class="primary" data-m="1">Copy</button></div></div>',
    e => { const b = e.target.closest('[data-m]'); if (b && b.dataset.m === '1') copyInDialog(text, modal.querySelector('textarea')); else if (b || e.target === modal) closeModal(); }, '.primary');
  modal.querySelector('textarea').value = text;
}
// copy to the clipboard; resolves to whether it worked
function copy(text) { try { return navigator.clipboard.writeText(text).then(() => true, () => false); } catch (e) { return Promise.resolve(false); } }
function copyInDialog(text, area) {   // reports in the dialog's note; if copying is blocked, selects the text to copy by hand
  const note = modal.querySelector('#txtnote');
  copy(text).then(ok => { if (!ok && area) { area.focus(); area.select(); } if (note) note.textContent = ok ? 'Copied.' : 'Copying is blocked here. The text is selected; copy it by hand.'; });
}
const STATE_WORD = ['', ', crossed out', ', circled'];
// screen readers hear messages through one region that is never rebuilt
function announce(msg) { const l = document.getElementById('live'); if (!l) return; l.textContent = ''; if (msg) setTimeout(() => { l.textContent = msg; }, 60); }
function say(msg, bad) { ui.msg = msg; ui.bad = !!bad; announce(msg); }

// ---------- actions ----------
async function doEvaluate() {
  const t = effTicks(); if (S.won || !t.length || t.length > 3) return;
  const kn = known(S.dial), room = Math.min(3, P.preds.length - Object.keys(kn).length), code = S.dial.slice();
  if (t.length < room && !(await ask('Only ' + t.length + ' of 3 evaluations selected. Continue?', 'Continue'))) return;
  const name = t.map(i => LET[i]).join('') + '(' + cs(code) + ')';
  if (!(await ask('Evaluate <span class="math">' + name + '</span>?', 'Evaluate'))) return;
  const res = {}; t.forEach(i => { res[i] = predVal(i, code); });
  S.rows.push({ code, res, guess: false, fresh: t });
  S.turns += 1; S.evals += t.length; S.contra = []; S.ticks = []; ui.step = null; announce(name + ': ' + t.map(i => LET[i] + (res[i] ? ' true' : ' false')).join(', '));
  const anyF = t.some(i => !res[i]), anyT = t.some(i => res[i]);
  const tip = (anyF ? tipOnce('false', F_ + ' means the secret option is not one ' + cs(code) + ' satisfies: on that card, cross out every option ' + cs(code) + ' does satisfy. ') : '')
    + (anyT ? tipOnce('true', T + ' means ' + cs(code) + ' satisfies the secret option: on that card, cross out every option it does not satisfy' + (P.singleOption ? '' : ' (when the card has one secret option)') + '.') : '');
  say(tip ? 'Tip: ' + tip.trim() : ''); save(); render();
}
async function doKnow() {
  if (S.won || effTicks().length) return;
  const code = S.dial.slice(); ui.pending = true; render();
  const ok = await ask('Guess <span class="math">' + cs(code) + '</span> as the final code?', 'Guess');
  ui.pending = false; if (!ok) { render(); return; }
  const kn = known(code), res = {}, fr = [];
  P.preds.forEach((p, i) => { if (i in kn) res[i] = kn[i].val; else { res[i] = predVal(i, code); fr.push(i); } });
  const win = P.preds.every((p, i) => res[i]), contra = win ? [] : contraCells(code);
  S.rows.push({ code, res, guess: true, fresh: fr }); S.ticks = []; ui.step = null;
  if (win) { S.won = true; S.finishedAt = Date.now(); S.contra = []; say(''); }
  else {
    S.wrong += 1; S.evals += fr.length; S.turns += Math.ceil(fr.length / 3); S.contra = contra;
    say(cs(code) + ' is not the code.' + (contra.length ? ' ' + plural(contra.length, 'earlier cell') + ' already ruled it out.' : '')
      + (tipOnce('wrong', ' A wrong guess costs turns as if its new results were evaluations: one turn for every three.') || ''), true);
  }
  save(); render();
}
function toggleMark(key, s) {
  const [ty, a, b] = key.split(':'), arr = ty === 'd' ? S.marks.d[+a] : S.marks.o[+a]; arr[+b] = arr[+b] === s ? 0 : s;
  if (s === 1 && arr[+b] === 1) { const m = tipOnce('hold', 'Tip: press and hold a mark to circle it instead. On a keyboard, Shift+Enter.'); if (m) say(m); }
  else if (s === 2) LS.set('tip-hold', '1');
  save(); render();
}
function step(d, dir) { if (S.won) return; S.dial[d] = ((S.dial[d] - 1 + dir + 5) % 5) + 1; save(); render(); }

// what each data-act button does; b is the button
function makeGame(a) {   // Play on the game of the day or a random game
  const el = document.getElementById('gdate'), date = el && /^\d{4}-\d\d-\d\d$/.test(el.value) ? el.value : todayStr(); form.gdate = date;
  const g = a === 'gotd-play' ? gameOfDay(date) : randomPuzzle([4, 5, 5, 6][Math.floor(Math.random() * 4)], wantFromModes(Math.random), Math.random);
  if (g && loadCode(encodeGame(g.pids, g.masks))) startGame(form.report.pz, false, false, a === 'gotd-play' ? date : null);
  else { form.report = { error: 'No game could be made with these game modes. Try again, or change them.' }; render(); }
}
function newSecretOptions() {
  const pids = form.rows.map(r => resolvePred(r.p)).map(p => p && p.id);
  if (pids.some(p => !p) || new Set(pids).size < pids.length) form.report = { error: 'Give every line a different predicate number first.' };
  else {
    let r = null; for (let i = 0; i < 12 && !(r && r.clean); i++) { const x = findActive(pids, wantFromModes(Math.random), Math.random, 40000); if (x && (!r || x.clean)) r = x; }
    if (r) { loadCode(encodeGame(pids, r.masks)); if (!r.clean) form.note = 'With these predicates, at least one of them adds nothing to the puzzle.'; }
    else form.report = { error: 'No choice of secret options turns these predicates into a puzzle in the checked modes. Change a predicate or uncheck a mode.' };
  }
  render();
}
function tick(i) {
  const at = S.ticks.indexOf(i);
  if (at >= 0) S.ticks.splice(at, 1);
  else if (effTicks().length >= 3) say('Three predicates at most per turn.', true);
  else { S.ticks.push(i); const m = tipOnce('tick', 'Tip: check up to three cards to test on the code above. Together they cost one turn; each checked card is one evaluation.'); if (m) say(m); else if (ui.bad) say(''); }
  save(); render();
}
function chartStep(a, b) {   // Back, Next, or a tap on a point of the chart
  const n = solverAt(S.won ? S.rows.length - 1 : S.rows.length).steps.length, cur = ui.step === null ? n - 1 : ui.step;
  ui.step = Math.max(0, Math.min(n - 1, a === 'sp-go' ? +b.dataset.i : cur + (a === 'sp-next' ? 1 : -1))); render();
}
const ACTIONS = {
  // play screen
  inc: b => step(+b.dataset.d, 1),
  dec: b => step(+b.dataset.d, -1),
  tick: b => tick(+b.dataset.i),
  eval: () => doEvaluate(),
  know: () => doKnow(),
  tocard: b => jumpTo('tocard', +b.dataset.i),
  tocol: b => jumpTo('tocol', +b.dataset.i),
  menu: () => { ui.menu = !ui.menu; render(); if (ui.menu) { const f = app.querySelector('.menu button'); if (f) f.focus(); } },
  tutorial: () => showTutorial(),
  hint: async () => {
    if (ui.hint) ui.hint = false;
    else if (S.hint || await ask('Show a filled-in worksheet and the reasoning so far? Your summary and export will then say “Hint used”.', 'Show hint')) { S.hint = true; ui.hint = true; ui.step = null; save(); }
    render();
  },
  'sp-prev': b => chartStep('sp-prev', b),
  'sp-next': b => chartStep('sp-next', b),
  'sp-go': b => chartStep('sp-go', b),
  export: () => { render(); showText('Truth table' + (S.won ? '' : ' so far') + '. Spoiler: it contains every code you tried. Anyone can load it with “Continue or review a game” on the New puzzle screen. Settings line: ' + SETTINGS_KEY, exportText()); },
  copyshare: () => copy(shareText(verdict())).then(ok => { say(ok ? 'Summary copied.' : 'Copying is blocked here. Select the summary text and copy it by hand.'); render(); }),
  restart: async () => { render(); if (await ask('Restart this puzzle? Your table and marks will be cleared.', 'Restart')) startGame(P, S.showCount, true, S.gotd); },
  again: () => startGame(P, S.showCount, true, S.gotd),
  setup: () => { view = 'setup'; render(); },
  theme: b => { THEME = b.dataset.v; LS.set('theme', THEME); applyTheme(); render(); },
  // setup screen
  'first-play': () => { if (loadCode(FIRST_PUZZLE)) startGame(form.report.pz, false, false, null); },
  'gotd-play': () => makeGame('gotd-play'),
  'rand-play': () => makeGame('rand-play'),
  play: () => {
    const pz = form.report && form.report.pz; if (!(pz && pz.solutions > 0)) return;
    const rv = form.rival && form.rival.gid === pz.gid ? form.rival : null;
    startGame(pz, form.show, false, form.gotd && form.gotd.gid === pz.gid ? form.gotd.date : null);
    if (rv) { S.rival = rv; save(); render(); }
  },
  count: async () => { if (await ask('Show how many solutions this puzzle has? You can also play without knowing.', 'Show count')) { form.show = true; render(); } },
  recent: b => { const s = readGame(b.dataset.id); if (s && resume(s)) LS.set('last', gameId(s)); render(); },
  import: () => showImport(),
  fold: b => { form[b.dataset.f] = !form[b.dataset.f]; render(); },
  add: () => { if (form.rows.length < 8) form.rows.push({ p: '', k: '' }); form.report = null; form.code = ''; render(); },
  rm: b => { form.rows.splice(+b.dataset.i, 1); form.report = null; const pz = formPuzzle(); form.code = pz ? pz.gid : ''; render(); },
  check: () => { form.show = false; checkForm(); setReport(); },
  'rand-preds': () => {
    const k = Math.max(2, Math.min(8, form.rows.length)), g = randomPuzzle(k, wantFromModes(Math.random), Math.random);
    if (!g) form.report = { error: 'No puzzle turned up with these modes and this many predicates. Try again, or change them.' };
    else { form.rows = g.pids.map(p => ({ p: String(p), k: '' })); clearCode(''); }
    render();
  },
  'rand-active': () => newSecretOptions(),
  'inst-no': () => { LS.set('install-no', '1'); render(); },
  'inst-yes': () => { LS.set('install-yes', '1'); showInstall(); } };
app.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (ui.menu && (!b || b.dataset.act !== 'menu')) { ui.menu = false; if (!b || b.disabled) { render(); return; } }   // any click closes the menu
  if (!b || b.disabled) return;
  if (b.dataset.fk) opener = b.dataset.fk;
  const f = ACTIONS[b.dataset.act]; if (f) f(b);
});
app.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'code') {
    form.code = el.value; const blank = !el.value.trim(), kind = !blank && loadEntry(el.value), ok = !!kind;
    if (kind === 'summary') el.value = form.code;
    form.codeBad = !blank && !ok; if (!ok) form.report = null;
    const rw = document.getElementById('rows'); if (ok && rw) rw.innerHTML = rowsHtml();
    const m = document.getElementById('codemsg'); m.textContent = form.codeBad ? codeProblem(el.value) : ''; m.className = 'res' + (form.codeBad ? ' bad' : '');
    setReport();
  } else if (el.dataset && el.dataset.row !== undefined) { form.rows[+el.dataset.row][el.dataset.f] = el.value; syncFromRows(); }
});
app.addEventListener('paste', e => {
  if (e.target.id !== 'gdate') return;
  const m = ((e.clipboardData && e.clipboardData.getData('text')) || '').match(/\d{4}-\d\d-\d\d/); if (m) { e.preventDefault(); e.target.value = m[0]; form.gdate = e.target.value; }
});
app.addEventListener('change', e => {
  const id = e.target.id;
  if (id === 'hl' || id === 'work') {
    if (id === 'hl') HL = e.target.checked; else WORK = e.target.checked; LS.setFlag(id, e.target.checked);
    if (view === 'play') { noteAids(); save(); render(); } else { const f = document.getElementById('aidsfold'); if (f) f.textContent = fold(true, aidsWord()); }
  }
  else if (id === 'gdate') form.gdate = e.target.value;
  else if (e.target.dataset && e.target.dataset.sel !== undefined) {   // predicate picked from the list: its old checker no longer applies
    const i = +e.target.dataset.sel; form.rows[i] = { p: e.target.value, k: '' }; syncFromRows(); document.getElementById('rows').innerHTML = rowsHtml();
    const k = document.getElementById('k' + i); if (k && e.target.value) k.focus();
  }
  else if (id.indexOf('mode-') === 0) {
    const k = id.slice(5), m = MODES.find(x => x[0] === k); MODE[k] = e.target.checked; LS.setFlag('m-' + k, MODE[k]);
    document.getElementById('modetxt-' + k).textContent = modeText(m);
    { const bk = document.getElementById('bank'); if (bk) bk.innerHTML = bankHtml(); } setReport(); { const fb = document.querySelector('[data-f="fmodes"]'); if (fb) fb.textContent = fold(true, modesWord()); }
  }
  else if (id === 'bank' && e.target.value !== '') { const v = e.target.value; loadCode((v[0] === 't' ? TMBANK : BANK)[+v.slice(1)]); render(); }
  else if (id === 'code' && form.report && form.report.pz) { e.target.value = form.code; }
});
app.addEventListener('keydown', e => {
  if (e.key === 'Escape' && ui.menu) { ui.menu = false; render(); const m = app.querySelector('[data-act="menu"]'); if (m) m.focus(); return; }
  const mk = e.target.closest('[data-mark]');
  if (mk && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleMark(mk.dataset.mark, e.shiftKey ? 2 : 1); }
  else if (e.key === 'Enter' && e.target.dataset && e.target.dataset.row !== undefined) { form.show = false; checkForm(); setReport(); }
});
let press = null;
app.addEventListener('pointerdown', e => {
  if (e.button) return;
  const mk = e.target.closest('[data-mark]');
  if (mk) { const key = mk.dataset.mark; press = { key, x: e.clientX, y: e.clientY, done: false, timer: setTimeout(() => { if (press && press.key === key) { press.done = true; toggleMark(key, 2); } }, 450) }; }
});
window.addEventListener('pointermove', e => { if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) { clearTimeout(press.timer); press = null; } });
window.addEventListener('pointerup', () => { if (press) { clearTimeout(press.timer); if (!press.done) toggleMark(press.key, 1); press = null; } });
window.addEventListener('pointercancel', () => { if (press) { clearTimeout(press.timer); press = null; } });
app.addEventListener('contextmenu', e => {
  const mk = e.target.closest('[data-mark]'); if (!mk) return; e.preventDefault();
  if (press) { if (!press.done) { clearTimeout(press.timer); press.done = true; toggleMark(mk.dataset.mark, 2); } }
  else toggleMark(mk.dataset.mark, 2);
});

// ---------- home screen: offline copy, install prompt, moving saved games ----------
// Only on the real site: the artifact preview neither installs nor works offline.
const SITE = /(^|\.)crackthe\.xyz$|\.github\.io$|^localhost$|^127\.0\.0\.1$/.test(location.hostname);
const STANDALONE = (() => { try { return (!!window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; } catch (e) { return false; } })();
const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1), ANDROID = /Android/.test(navigator.userAgent);
const INSTALL_AFTER = 10;   // loads in the browser before the game offers the home screen
let installEvent = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvent = e; });
window.addEventListener('appinstalled', () => { LS.set('install-done', '1'); installEvent = null; if (view === 'setup') render(); });
if (SITE && !STANDALONE) LS.set('loads', String((+LS.get('loads') || 0) + 1));   // quiet when already running from the home screen
if (SITE && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
const askInstall = () => SITE && (IOS || ANDROID) && !STANDALONE && (+LS.get('loads') || 0) >= INSTALL_AFTER && !LS.get('install-no') && !LS.get('install-yes') && !LS.get('install-done');
const MOVE_HEAD = TITLE + ' saved games';
function savesText() {   // every saved game and setting, as one block of text to paste into the home-screen copy
  const items = {};
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(KEY + ':') && !/:(loads|install-)/.test(k)) items[k.slice(KEY.length + 1)] = localStorage.getItem(k); } } catch (e) {}
  return MOVE_HEAD + '\n' + btoa(unescape(encodeURIComponent(JSON.stringify({ v: 1, items })))).replace(/(.{64})/g, '$1\n').trim();
}
function loadSaves(text) {   // returns how many games were added, or -1 if the text is not a saved-games block
  const at = text.indexOf(MOVE_HEAD); if (at < 0) return -1;
  let d; try { d = JSON.parse(decodeURIComponent(escape(atob(text.slice(at + MOVE_HEAD.length).replace(/\s+/g, ''))))); } catch (e) { return -1; }
  if (!d || d.v !== 1 || !d.items) return -1;
  const before = new Set(recentIds());
  Object.keys(d.items).forEach(k => { if (k !== 'recent' && k !== 'last' && LS.get(k) === null) LS.set(k, d.items[k]); });
  let ids = []; try { ids = JSON.parse(d.items.recent || '[]'); } catch (e) {}
  const all = Array.from(new Set(recentIds().concat(ids))).map(readGame).filter(Boolean).sort((a, b) => b.startedAt - a.startedAt);
  all.slice(RECENT_MAX).forEach(s => LS.del('g:' + gameId(s)));
  const keep = all.slice(0, RECENT_MAX).map(gameId); LS.set('recent', JSON.stringify(keep));
  if (!LS.get('last') && d.items.last && readGame(d.items.last)) LS.set('last', d.items.last);
  return keep.filter(id => !before.has(id)).length;
}
function showInstall() {
  const games = recentGames().length;
  let body = '<h2>Add it to your home screen</h2>';
  if (IOS) {
    body += '<ol><li>In Safari, tap <b>Share</b> (the square with an arrow). On recent iPhones it may be inside the <b>\u2022\u2022\u2022</b> menu.</li><li>Choose <b>Add to Home Screen</b>. You may need to scroll down, or tap <b>More</b>.</li><li>Tap <b>Add</b>.</li></ol>'
      + '<p>The home-screen copy opens like an app, works offline, and its saved games are safe from Safari\u2019s seven-day clean-up.</p>'
      + '<p>It starts without your saved games: iPhone keeps them apart from Safari.' + (games ? ' To bring yours along, tap <b>Copy my games</b> now. In the new copy, tap <b>Paste a table or saved games</b> and paste.' : '') + '</p>';
  } else {
    body += installEvent ? '<p>Tap <b>Install</b> below, then confirm.</p>' : '<ol><li>Open your browser\u2019s menu (<b>\u22ee</b>).</li><li>Choose <b>Install app</b> or <b>Add to Home screen</b>.</li><li>Confirm.</li></ol>';
    body += '<p>It opens like an app and works offline. In Chrome, your saved games come along.</p>';
  }
  openModal('<div class="dlg tut" role="dialog" aria-modal="true"><div class="tutbody">' + body + '</div><small id="txtnote"></small><div class="dlgb">'
    + (IOS && games ? '<button class="ghost" data-m="copy">Copy my games</button>' : '') + (!IOS && installEvent ? '<button class="ghost" data-m="0">Not now</button><button class="primary" data-m="inst">Install</button>' : '<button class="primary" data-m="0">Done</button>') + '</div></div>', async e => {
    const b = e.target.closest('[data-m]'); if (!b) { if (e.target === modal) { closeModal(); render(); } return; }
    if (b.dataset.m === 'copy') { copyInDialog(savesText(), null); return; }
    if (b.dataset.m === 'inst' && installEvent) { const ev = installEvent; installEvent = null; try { await ev.prompt(); } catch (err) {} }
    closeModal(); render();
  }, '.primary, .ghost', () => { closeModal(); render(); });
}
const BUILD_RE = /const BUILD = "([0-9a-f]{8})"/;   // how the site's page names its build: written by build.py, checked by test.js
async function checkUpdate(el) {   // reached only from the very end of How to play
  el.textContent = 'Checking\u2026';
  try {
    const r = await fetch('./?check=' + Date.now(), { cache: 'no-store' }), m = (await r.text()).match(BUILD_RE);
    if (!r.ok || !m) throw new Error('no build');
    if (m[1] === BUILD) { el.textContent = 'You have the latest version (' + BUILD + ').'; return; }
    el.textContent = 'Updating\u2026';
    if ('serviceWorker' in navigator) { const reg = await navigator.serviceWorker.getRegistration(); if (reg) await reg.update(); }
    if (window.caches) for (const k of await caches.keys()) await caches.delete(k);
    location.reload();
  } catch (e) { el.textContent = 'Could not reach the site. Try again when you are online.'; }
}

function start() {
  const last = lastState();
  if (!(last && resume(last))) view = 'setup';
  render();
}
start();
