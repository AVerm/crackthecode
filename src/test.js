const fs = require('fs');
const el = () => ({ addEventListener() {}, innerHTML: '', hidden: true, querySelector() { return null; }, dataset: {}, value: '', textContent: '', className: '' });
global.document = { getElementById: el, addEventListener() {}, removeEventListener() {}, activeElement: null, documentElement: { dataset: {} }, querySelector: () => null };
global.getComputedStyle = () => ({ getPropertyValue: () => '' });
global.window = { addEventListener() {} };
global.location = { hostname: 'test.invalid', origin: 'https://test.invalid', reload() {} };
global.navigator = { userAgent: 'node', platform: 'node', maxTouchPoints: 0 };
global.__store = {}; const store = global.__store; global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; }, key: i => Object.keys(store)[i] ?? null, get length() { return Object.keys(store).length; } };
// Engine tests for the built page: node src/test.js [path to index.html]
const page = fs.readFileSync(process.argv[2] || require('path').join(__dirname, '..', 'www', 'index.html'), 'utf8');
const src = page.slice(page.indexOf('<script>') + 8, page.lastIndexOf('</script>')) + `
;(function () {
  let seed = 12345; const rnd = n => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return (seed >>> 8) % n; };
  const fail = m => { console.log('FAIL', m); process.exitCode = 1; };
  // 1. game codes: every bank code (made by the Python generator) decodes and re-encodes to itself
  BANK.concat(TMBANK).forEach(c => { const g = decodeGame(c); if (!g || fmtCode(encodeGame(g.pids, g.masks)) !== c) fail('bank code ' + c); });
  // random round trips, 1 to 8 predicates, any option masks; and corrupted codes are rejected
  let rejected = 0, tried = 0; const ids = Object.keys(PRED).map(Number);
  for (let r = 0; r < 3000; r++) {
    const n = 1 + rnd(8), pids = []; while (pids.length < n) { const p = ids[rnd(ids.length)]; if (!pids.includes(p)) pids.push(p); }
    const masks = pids.map(p => 1 + rnd((1 << PRED[p].o.length) - 1)), code = encodeGame(pids, masks), back = decodeGame(fmtCode(code).toLowerCase());
    if (!back || back.pids.join() !== pids.join() || back.masks.join() !== masks.join()) fail('round trip ' + code);
    const pos = 1 + rnd(code.length - 1), ch = A32[(A32.indexOf(code[pos]) + 1 + rnd(31)) % 32], bad = code.slice(0, pos) + ch + code.slice(pos + 1);
    tried++; const d = decodeGame(bad); if (!d) rejected++;
  }
  console.log('code round trips ok; single-character typos rejected:', rejected, 'of', tried);
  // the Turing Machine numbers decoded in the page match the source table exactly
  { const want = (${fs.readFileSync(require('path').join(__dirname, 'tm_compat.json'), 'utf8')}).numbers, got = TM.numbers;
    const bad = Object.keys(want).filter(k => got[k] !== want[k]).length + Object.keys(got).filter(k => !(k in want)).length;
    console.log('TM numbers decoded:', Object.keys(got).length, '| mismatches', bad); if (bad) fail('TM numbers decode'); }
  // 2. TM entry and two-way form
  form.rows = [6, 17, 11, 19, 36].map((n, i) => ({ p: String(n), k: String([481, 618, 723, 315, 582][i]) })); const tmz = formPuzzle();
  console.log('TM entry -> game', tmz.gid, 'solutions', tmz.solutions); if (tmz.solutions !== 1 || !loadCode(tmz.gid) || formPuzzle().gid !== tmz.gid) fail('TM/code two-way');
  form.rows = [{ p: '130', k: '2910 2636' }]; console.log('two checkers in one box:', rowStatus(0).text, '| mask', rowStatus(0).mask);
  // 3. bank metadata and filters
  const cnt = f => BANKMETA.filter(f).length;
  console.log('bank', BANKMETA.length, '| single-active', cnt(g => g.single), '| exclusive', cnt(g => !g.overlap), '| unique', cnt(g => g.solutions === 1), '| shown with all three modes on', bankShown().length);
  // 4. random play on every bank puzzle
  let games = 0, tied = 0, outs = 0; const verdicts = {};
  for (const code of BANK.concat(TMBANK)) for (let rep = 0; rep < 12; rep++) {
    if (!loadCode(code)) { fail('load ' + code); break; }
    startGame(form.report.pz, false, true);
    const answer = ALL.filter(c => P.preds.every((p, i) => predVal(i, c))); let proofTurn = null, guard = 0;
    if (answer.length !== P.solutions) fail('solution count');
    while (guard++ < 80) {
      const c = ALL[rnd(125)], kn = known(c), free = P.preds.map((p, i) => i).filter(i => !(i in kn)); if (!free.length) continue;
      const t = []; while (t.length < Math.min(3, free.length)) { const i = free[rnd(free.length)]; if (!t.includes(i)) t.push(i); } t.sort((a, b) => a - b);
      const res = {}; t.forEach(i => { res[i] = predVal(i, c); });
      S.rows.push({ code: c, res, guess: false, fresh: t }); S.turns++; S.evals += t.length;
      const ex = exactCount(S.rows), sv = solverRun(S.rows);
      if (!answer.every(fitsFlag)) fail('flag excludes a real solution');
      if (ex < answer.length) fail('elimination engine dropped a solution: ' + code);
      if (P.solutions === 1 && sv.bound < ex) fail('solver bound below exact count: ' + code);
      if (sv.steps.some(s => s.after > s.before)) fail('bound increased');
      if (ex === answer.length) { proofTurn = S.turns; break; }
    }
    const g = answer[0], kn = known(g), res = {}, fr = []; P.preds.forEach((p, i) => { if (i in kn) res[i] = kn[i].val; else { res[i] = true; fr.push(i); } });
    S.rows.push({ code: g, res, guess: true, fresh: fr }); S.won = true; S.finishedAt = Date.now();
    const v = verdict(); games++; const kind = v.short.replace(/[0-9]+/g, 'N'); verdicts[kind] = (verdicts[kind] || 0) + 1;
    if (P.solutions === 1 && v.sol.knew !== null && v.sol.knew !== proofTurn) fail('solver knew at the wrong time');
    if (shareText(v).split('\\n').length !== 5 || !exportText().includes(DAG) || !exportText().includes('Settings S')) fail('text outputs');
    WORK = rep % 2 === 0; HL = rep % 3 === 0; S.marks.d[0][2] = 2; S.marks.o[0][0] = 2; renderPlay();
  }
  console.log('games', games, JSON.stringify(verdicts));
  // 4b. in-page generator: every mode set, timing, and that a checked mode is always honored
  const combos = []; for (let m = 0; m < 8; m++) combos.push([!!(m & 4), !!(m & 2), !!(m & 1)]);
  let worst = 0, total = 0, made = 0; const gen = Math.random;
  for (const [s, x, u] of combos) for (const k of [4, 5, 6]) for (let r = 0; r < 12; r++) {
    MODE.single = s; MODE.excl = x; MODE.uniq = u; const t0 = process.hrtime.bigint(), g = randomPuzzle(k, wantFromModes(gen), gen), ms = Number(process.hrtime.bigint() - t0) / 1e6;
    worst = Math.max(worst, ms); total += ms; made++;
    if (!g) { fail('no random puzzle for ' + [s, x, u, k]); continue; }
    const pz = buildPuzzle(g.pids, g.masks); if ((s && !pz.singleOption) || (x && pz.overlap) || (u && pz.solutions !== 1) || pz.solutions < 1) fail('mode broken ' + [s, x, u, k, pz.gid]);
  }
  console.log('random games made', made, '| mean ms', (total / made).toFixed(1), '| slowest ms', worst.toFixed(0));
  // randomize active options for fixed predicates
  MODE.single = MODE.excl = MODE.uniq = true; let okA = 0, ta = 0;
  for (let r = 0; r < 60; r++) { const g = randomPuzzle(5, wantFromModes(gen), gen), t0 = process.hrtime.bigint(), x = findActive(g.pids, wantFromModes(gen), gen, 40000); ta = Math.max(ta, Number(process.hrtime.bigint() - t0) / 1e6); if (x && buildPuzzle(g.pids, x.masks).solutions === 1) okA++; }
  console.log('randomize active on 60 predicate sets known to work:', okA, 'succeeded | slowest ms', ta.toFixed(0));
  // game of the day: same date and modes give the same game; all 8 mode sets work for 120 dates
  const codes = new Set(); let gw = 0, bad = 0;
  for (const [s, x, u] of combos) for (let d = 0; d < 120; d++) {
    MODE.single = s; MODE.excl = x; MODE.uniq = u; const date = new Date(Date.UTC(2026, 10, 1 + d)).toISOString().slice(0, 10);
    const t0 = process.hrtime.bigint(), g = gameOfDay(date), ms = Number(process.hrtime.bigint() - t0) / 1e6, g2 = gameOfDay(date); gw = Math.max(gw, ms);
    if (!g || !g2 || encodeGame(g.pids, g.masks) !== encodeGame(g2.pids, g2.masks)) { bad++; continue; }
    const pz = buildPuzzle(g.pids, g.masks); if ((s && !pz.singleOption) || (x && pz.overlap) || (u && pz.solutions !== 1)) bad++; codes.add(pz.gid);
  }
  MODE.single = MODE.excl = MODE.uniq = true;
  console.log('game of the day: 960 date and mode pairs,', bad, 'problems,', codes.size, 'distinct games | slowest ms', gw.toFixed(0), '| 2026-11-15 all modes on:', (g => fmtCode(encodeGame(g.pids, g.masks)))(gameOfDay('2026-11-15')));
  // 5. old save carries over
  __store['ctc-v2:last'] = 'OLD'; __store['ctc-v2:OLD'] = JSON.stringify({ v: 2, gid: 'OLD', def: { p: [137, 141, 145, 190], c: [NUM2CARD[2386], NUM2CARD[2172], NUM2CARD[4009], NUM2CARD[1361]] }, rows: [], marks: { d: [[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0]], o: [[0,0,0],[0,0,0],[0,0,0],[0,0,0]] }, dial: [1,1,1], ticks: [], turns: 0, evals: 0, wrong: 0, contra: [], won: false, startedAt: 1 });
  delete __store['ctc-v3:last']; const o = lastState(); console.log('old save migrates to game', o && o.gid, '| decodes:', !!(o && decodeGame(o.gid)));
  console.log('manual pack', TMMETA.length, '| one solution', TMMETA.filter(g => g.solutions === 1).length, '| single-active', TMMETA.filter(g => g.single).length, '| exclusive', TMMETA.filter(g => !g.overlap).length, '| sizes', TMMETA.map(g => g.n).join(''));
  console.log('starter per mode set', [0,1,2,3,4,5,6,7].map(m => BANKMETA.filter(g => g.single === !(m & 4) && g.overlap === !!(m & 2) && (g.solutions === 1) === !(m & 1)).length).join(' '));
  // 6. export then import gives the same game back, partial or finished; damaged tables are refused
  { let rt = 0, badrt = 0, refused = 0, tried = 0; const rnd = mulberry(77);
    for (let gno = 0; gno < 300; gno++) {
      const g = randomPuzzle(4 + gno % 3, { single: gno % 2 === 0, excl: false, uniq: gno % 3 === 0 }, rnd); if (!g) continue;
      P = buildPuzzle(g.pids, g.masks); S = fresh(P, false, gno % 5 === 0 ? '2026-11-16' : null); if (gno % 4 === 0) S.hint = true; const n = P.preds.length;
      const guess = code => { const kn = known(code), res = {}, fr = []; P.preds.forEach((p, i) => { if (i in kn) res[i] = kn[i].val; else { res[i] = predVal(i, code); fr.push(i); } });
        S.rows.push({ code, res, guess: true, fresh: fr }); if (P.preds.every((p, i) => res[i])) S.won = true; else { S.wrong++; S.evals += fr.length; S.turns += Math.ceil(fr.length / 3); } };
      for (let s = 0, m = 1 + Math.floor(rnd() * 6); s < m && !S.won; s++) {
        const code = [1, 2, 3].map(() => 1 + Math.floor(rnd() * 5));
        if (rnd() < 0.2) { guess(code); continue; }
        const kn = known(code), free = shuffled(P.preds.map((p, i) => i).filter(i => !(i in kn)), rnd).slice(0, 1 + Math.floor(rnd() * 3)).sort((a, b) => a - b); if (!free.length) continue;
        const res = {}; free.forEach(i => { res[i] = predVal(i, code); }); S.rows.push({ code, res, guess: false, fresh: free }); S.turns++; S.evals += free.length;
      }
      if (gno % 2 && !S.won) { const ans = ALL.find(c => P.preds.every((p, i) => predVal(i, c))); if (ans) guess(ans); }
      const txt = exportText(), was = JSON.stringify([S.rows, S.turns, S.evals, S.wrong, S.won, !!S.hint, S.gotd, P.gid]), r = importTable(txt); rt++;
      if (r.error || JSON.stringify([r.state.rows, r.state.turns, r.state.evals, r.state.wrong, r.state.won, !!r.state.hint, r.state.gotd, r.pz.gid]) !== was) { badrt++; if (badrt < 3) console.log(txt, r.error); }
      const P0 = P, S0 = S; P = r.pz || P; if (!r.error) { S = r.state; const again = importTable(exportText()); if (again.error || JSON.stringify(again.state.rows) !== JSON.stringify(S0.rows)) badrt++; } P = P0; S = S0;
      if (S.rows.length) { tried++; const flip = txt.replace(/[⊤⊥](?=[^⊤⊥]*$)/, c => c === '⊤' ? '⊥' : '⊤'); if (importTable(flip).error) refused++; }
    }
    if (badrt) fail('table round trip ' + badrt);
    console.log('table round trips', rt, '| mismatches', badrt, '| tables with one flipped cell refused', refused, 'of', tried, '| no code:', !!importTable('244  ⊤ ⊤').error, '| ascii:', !importTable(['1TVV-H8F0-GY', '244  F . T F', '425' + DAG + ' T T T T'].join(String.fromCharCode(10))).error);
  }
  // 7. the code box: dates, summaries, and no date that is also a code
  { let clash = 0, old = 0; for (let y = 1000; y < 2100; y++) for (let mo = 1; mo <= 12; mo++) for (let d = 1; d <= 31; d++) { const s = y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0'); if (y >= 2000 && decodeGame(s)) clash++; if (y < 2000 && decodeGame(s)) old++; }
    const day = '2026-11-16', g = gameOfDay(day), gid = buildPuzzle(g.pids, g.masks).gid;
    const k1 = loadEntry(day), ok1 = k1 === false;
    P = buildPuzzle(g.pids, g.masks); S = fresh(P, false, day); S.turns = 4; S.evals = 9; S.wrong = 1; S.hint = true;
    const sum = headLines(false).concat(['⊤⊥⊤ †⊤⊤⊤⊤', '4 turns, 9 evaluations, 1 wrong guess', 'Solver: tied']).join(' ');
    const k2 = loadEntry(sum), ok2 = form.rival && form.rival.turns === 4 && form.rival.evals === 9 && form.rival.wrong === 1 && form.rival.hint && form.gotd && form.gotd.date === day && !form.gotd.other;
    MODE.uniq = !MODE.uniq; const k3 = loadEntry(sum), ok3 = form.gotd && form.gotd.other && /different game modes/.test(form.note); MODE.uniq = !MODE.uniq;
    const k4 = loadEntry(sum.replace(day, '2026-11-17')), ok4 = !form.gotd && /ordinary game/.test(form.note) && !!form.rival;
    S.won = true; S.rival = { turns: 5, evals: 9, wrong: 0 }; S.rows = []; const mine = shareText({ short: 'tied' }), k6 = loadEntry(mine.split('\\n').join(' ')), ok6 = /Beat a friend/.test(mine) && form.rival.turns === 4;
    const k5 = loadEntry(gid.toLowerCase()), ok5 = k5 === 'code' && !form.rival && !form.gotd;
    if (clash || !ok1 || !ok2 || !ok3 || !ok4 || !ok5 || !ok6 || loadEntry('hello 12')) fail('code box entry ' + [clash, ok1, ok2, ok3, ok4, ok5]);
    console.log('code box: dates from 2000 on that are also codes', clash, '| earlier dates', old, '| kinds', k1, k2, k3, k4, k5);
  }
  // 8. recent games: five kept, replays get their own entry, old per-code saves migrate
  { const games = Object.keys(__store).filter(k => k.indexOf('ctc-v3:') === 0); games.forEach(k => delete __store[k]);
    const codes = BANK.slice(0, 7).map(c => buildPuzzle(decodeGame(c).pids, decodeGame(c).masks)), play1 = () => { S.rows.push({ code: [1, 1, 1], res: { 0: predVal(0, [1, 1, 1]) }, guess: false, fresh: [0] }); S.turns++; S.evals++; save(); };
    let clock = 1000; const realNow = Date.now; Date.now = () => (clock += 1000);
    codes.forEach(pz => { startGame(pz, false, true); play1(); });
    const ids1 = recentIds(), kept = Object.keys(__store).filter(k => k.indexOf('ctc-v3:g:') === 0).length;
    startGame(codes[0], false, true); const idle = gameId(S); startGame(codes[1], false, true);   // two untouched games: neither listed, the first deleted
    const idleGone = !__store['ctc-v3:g:' + idle], notListed = recentIds().length === 5 && !recentIds().includes(gameId(S));
    const top = recentGames()[0]; resume(top); S.won = true; save(); startGame(P, false, false); play1();   // replaying a finished code adds a game
    const replay = recentGames().filter(s => s.gid === top.gid).length === 2;
    startGame(codes[6], false, false); const resumed = S.rows.length === 1;   // an unfinished game is resumed, not restarted
    Object.keys(__store).filter(k => k.indexOf('ctc-v3:') === 0).forEach(k => delete __store[k]);
    codes.forEach((pz, i) => { const s = fresh(pz, false, null); s.startedAt = 5000 + i; delete s.id; if (i !== 3) s.rows.push({ code: [1, 1, 1], res: {}, guess: false, fresh: [] }); __store['ctc-v3:' + pz.gid] = JSON.stringify(s); });
    __store['ctc-v3:last'] = codes[2].gid; __store['ctc-v3:hl'] = '1';
    const ls = lastState(), mig = recentIds(), oldGone = codes.every(pz => !('ctc-v3:' + pz.gid in __store));
    Date.now = realNow;
    const ok = ids1.length === 5 && kept === 5 && idleGone && notListed && replay && resumed && ls && ls.gid === codes[2].gid && mig.length === 5 && mig[0].indexOf(codes[2].gid) === 0 && oldGone && __store['ctc-v3:hl'] === '1';
    if (!ok) fail('recent games ' + JSON.stringify({ ids1: ids1.length, kept, idleGone, notListed, replay, resumed, ls: ls && ls.gid, mig: mig.length, first: mig[0], oldGone }));
    console.log('recent games: kept', kept, '| untouched game dropped', idleGone, '| replay kept separately', replay, '| resume', resumed, '| migrated', mig.length, 'of 6 played, old keys removed', oldGone);
  }
  // 8. moving saved games between copies of the site (Safari to the home screen on iPhone)
  { const snap = JSON.stringify(Object.keys(__store).sort().map(k => [k, __store[k]]));
    for (let gno = 0; gno < 7; gno++) { loadCode(BANK[gno]); startGame(form.report.pz, false, true); S.rows.push({ code: [1, 2, 3], res: { 0: predVal(0, [1, 2, 3]) }, guess: false, fresh: [0] }); S.turns = 1; S.evals = 1; S.startedAt += gno; save(); }
    const ids = recentIds(), text = savesText(); Object.keys(__store).forEach(k => delete __store[k]);
    const n1 = loadSaves(text), same = JSON.stringify(recentIds()) === JSON.stringify(ids), n2 = loadSaves(text), bad = loadSaves(TITLE + ' saved games' + String.fromCharCode(10) + 'not base64!'), none = loadSaves('hello');
    if (n1 !== ids.length || !same || n2 !== 0 || bad !== -1 || none !== -1) fail('saved games move ' + [n1, ids.length, same, n2, bad, none]);
    console.log('saved games moved', n1, 'of', ids.length, '| order kept', same, '| second paste adds', n2, '| text', text.length, 'chars');
  }
  view = 'setup'; renderSetup(); showTutorial;
})();`;
require('vm').runInThisContext(src, { filename: 'app.js' });
