'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const enginePath = path.join(ROOT, 'engine.js');
const indexPath = path.join(ROOT, 'index.html');
const testsPath = path.join(ROOT, 'tests', 'regression.cjs');

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count === 0) {
    if (source.includes(after)) return source;
    throw new Error('Missing anchor: ' + label);
  }
  if (count !== 1) throw new Error('Non-unique anchor (' + count + '): ' + label);
  return source.replace(before, after);
}

let engine = fs.readFileSync(enginePath, 'utf8');
engine = replaceOnce(
  engine,
  "  { id:'nine-ride', name:'The Nine Ride', desc:'Add 1 Nazgûl to Mordor at setup.', extraNazgul:{ mordor:1 } },",
  "  { id:'nine-ride', name:'The Nine Ride', desc:'One of the Nine rides west early: move 1 Nazgûl from Mordor to Enedwaith.', moveNazgul:{ from:'mordor', to:'enedwaith', count:1 } },",
  'replace tenth nazgul burden'
);
engine = replaceOnce(
  engine,
  "    for (const [regionId, count] of Object.entries(burden.extraNazgul || {})) {\n      if (G.nazgul[regionId] === undefined) continue;\n      G.nazgul[regionId] += Math.max(0, Number(count) || 0);\n    }",
  "    if (burden.moveNazgul) {\n      const from = burden.moveNazgul.from, to = burden.moveNazgul.to;\n      const requested = Math.max(0, Number(burden.moveNazgul.count) || 0);\n      if (G.nazgul[from] !== undefined && G.nazgul[to] !== undefined) {\n        const move = Math.min(requested, G.nazgul[from]);\n        G.nazgul[from] -= move;\n        G.nazgul[to] += move;\n      }\n    }",
  'apply nazgul redistribution'
);
engine = replaceOnce(
  engine,
  "  if (!Number.isFinite(s.savedAt)) s.savedAt = 0;",
  "  if (!Number.isFinite(s.savedAt)) s.savedAt = 0;\n  if (typeof s.rogueRunRecorded !== 'boolean') s.rogueRunRecorded = false;",
  'migrate rogue marker'
);
engine = replaceOnce(
  engine,
  "    shadowBurdens: activeBurdenIds,",
  "    shadowBurdens: activeBurdenIds,\n    rogueRunRecorded: false,",
  'new run marker'
);
fs.writeFileSync(enginePath, engine);

let index = fs.readFileSync(indexPath, 'utf8');
index = replaceOnce(
  index,
  "const BURDEN_PREF_KEY = 'fof-shadow-burden-prefs';",
  "const BURDEN_PREF_KEY = 'fof-shadow-burden-prefs';\nconst ROGUE_HISTORY_KEY = 'fof-rogue-history';",
  'rogue history key'
);

const historyFns = [
"function getRogueHistory() {",
"  try {",
"    const rows = JSON.parse(localStorage.getItem(ROGUE_HISTORY_KEY) || '[]');",
"    return Array.isArray(rows) ? rows : [];",
"  } catch { return []; }",
"}",
"",
"function saveRogueHistory(rows) {",
"  localStorage.setItem(ROGUE_HISTORY_KEY, JSON.stringify((rows || []).slice(-50)));",
"}",
"",
"function getBurdenOfferIds(difficulty) {",
"  const slots = burdenSlotsForDifficulty(difficulty);",
"  if (slots <= 0) return [];",
"  const history = getRogueHistory().filter(r => (r.plusLevel || 0) > 0);",
"  const usage = {};",
"  for (const b of SHADOW_BURDENS) usage[b.id] = 0;",
"  for (const run of history) for (const id of (run.burdens || [])) if (usage[id] !== undefined) usage[id]++;",
"  const rotation = history.length % Math.max(1, SHADOW_BURDENS.length);",
"  const ordered = SHADOW_BURDENS.map((b, i) => ({ id:b.id, used:usage[b.id] || 0, tie:(i - rotation + SHADOW_BURDENS.length) % SHADOW_BURDENS.length }))",
"    .sort((a,b) => a.used - b.used || a.tie - b.tie);",
"  return ordered.slice(0, Math.min(SHADOW_BURDENS.length, slots + 2)).map(x => x.id);",
"}",
"",
"function recordRoguelikeRunIfNeeded() {",
"  if (!G || G.phase !== 'gameover' || G.rogueRunRecorded) return null;",
"  G.rogueRunRecorded = true;",
"  if (!String(G.difficulty || '').startsWith('legendary')) return null;",
"  const objectivesDone = (G.objectives || []).filter(o => o.done).length;",
"  const row = {",
"    id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,7),",
"    endedAt: Date.now(),",
"    result: G.winner === 'players' ? 'win' : 'loss',",
"    difficulty: G.difficulty,",
"    plusLevel: G.plusLevel || 0,",
"    burdens: Array.isArray(G.shadowBurdens) ? [...G.shadowBurdens] : [],",
"    hope: G.hope || 0,",
"    maxHope: G.maxHope || 0,",
"    objectivesDone,",
"    objectivesTotal: (G.objectives || []).length,",
"    capturedStrongholds: [...(G.capturedStrongholds || [])],",
"    frodoLocation: G.charState?.['frodo-sam']?.location || null,",
"    characters: (G.players || []).flatMap(p => p.chars || []),",
"  };",
"  const history = getRogueHistory();",
"  history.push(row);",
"  saveRogueHistory(history);",
"  G.lastRogueRunId = row.id;",
"  renderRogueHistoryPanel();",
"  return row;",
"}",
"",
"function rogueRunSummaryHtml(run) {",
"  if (!run) return '<em>No Legendary campaign runs recorded yet.</em>';",
"  const burdenNames = (run.burdens || []).map(id => SHADOW_BURDENS.find(b => b.id === id)?.name || id);",
"  const strongholds = (run.capturedStrongholds || []).map(id => LOCS[id]?.name || id);",
"  return '<strong>' + (run.result === 'win' ? 'Victory' : 'Defeat') + ' — ' + escapeHtml(run.difficulty || 'Legendary') + '</strong><br>' +",
"    'Hope: ' + (run.hope ?? 0) + '/' + (run.maxHope ?? 0) + '<br>' +",
"    'Objectives: ' + (run.objectivesDone ?? 0) + '/' + (run.objectivesTotal ?? 0) + '<br>' +",
"    'Burdens: ' + (burdenNames.length ? burdenNames.map(escapeHtml).join(', ') : 'none') + '<br>' +",
"    'Strongholds taken: ' + (strongholds.length ? strongholds.map(escapeHtml).join(', ') : 'none') + '<br>' +",
"    'Frodo: ' + escapeHtml(LOCS[run.frodoLocation]?.name || run.frodoLocation || 'unknown');",
"}",
"",
"function showCampaignChronicle() {",
"  const history = getRogueHistory();",
"  const last = history[history.length - 1];",
"  const wins = history.filter(r => r.result === 'win').length;",
"  const plusRuns = history.filter(r => (r.plusLevel || 0) > 0);",
"  const best = plusRuns.reduce((m,r) => Math.max(m, r.result === 'win' ? (r.plusLevel || 0) : 0), 0);",
"  let html = '<div style=\"margin-bottom:10px\"><strong>' + history.length + ' runs</strong> · ' + wins + ' wins · highest Legendary+ victory: +' + best + '</div>';",
"  if (last) html += rogueRunSummaryHtml(last);",
"  if (history.length > 1) {",
"    html += '<hr><div style=\"font-size:.82em;color:#907850\">Recent runs</div>';",
"    for (const run of history.slice(-6).reverse()) {",
"      const d = new Date(run.endedAt || 0).toLocaleDateString();",
"      html += '<div style=\"padding:4px 0;border-bottom:1px solid #2a2010;font-size:.8em\">' + (run.result === 'win' ? '✓' : '✗') + ' ' + escapeHtml(run.difficulty) + ' · ' + d + ' · ' + (run.objectivesDone || 0) + '/' + (run.objectivesTotal || 0) + ' objectives</div>';",
"    }",
"  }",
"  showModal('📜 Campaign Chronicle', html);",
"}",
"",
"function renderRogueHistoryPanel() {",
"  const panel = document.getElementById('rogue-history-panel');",
"  const summary = document.getElementById('rogue-history-summary');",
"  if (!panel || !summary) return;",
"  const history = getRogueHistory();",
"  if (!history.length) { panel.style.display = 'none'; return; }",
"  panel.style.display = 'block';",
"  const wins = history.filter(r => r.result === 'win').length;",
"  const best = history.reduce((m,r) => Math.max(m, r.result === 'win' ? (r.plusLevel || 0) : 0), 0);",
"  const last = history[history.length - 1];",
"  summary.textContent = history.length + ' Legendary campaign run' + (history.length===1?'':'s') + ' · ' + wins + ' win' + (wins===1?'':'s') + ' · best +' + best + ' · last: ' + (last.result === 'win' ? 'victory' : 'defeat') + ' on ' + last.difficulty;",
"}",
""
].join('\n');

index = replaceOnce(
  index,
  "function buildDifficultySelect() {",
  historyFns + "\nfunction buildDifficultySelect() {",
  'roguelike history helpers'
);

index = replaceOnce(
  index,
  "  const prefs = getBurdenPrefs();\n  const used = new Set();",
  "  const prefs = getBurdenPrefs();\n  const offeredIds = getBurdenOfferIds(difficulty);\n  const offered = offeredIds.map(id => SHADOW_BURDENS.find(b => b.id === id)).filter(Boolean);\n  const used = new Set();",
  'burden offer pool'
);
index = replaceOnce(
  index,
  "    if (!SHADOW_BURDENS.some(b => b.id === selected) || used.has(selected)) selected = SHADOW_BURDENS.find(b => !used.has(b.id))?.id;\n    for (const b of SHADOW_BURDENS) {",
  "    if (!offered.some(b => b.id === selected) || used.has(selected)) selected = offered.find(b => !used.has(b.id))?.id;\n    for (const b of offered) {",
  'use evolving burden offers'
);
index = replaceOnce(
  index,
  "  summary.textContent = slots + ' burden' + (slots===1?'':'s') + ' active at this tier. New slots unlock at Legendary +2, +5 and +8.';",
  "  const offers = getBurdenOfferIds(difficulty);\n  summary.textContent = slots + ' burden' + (slots===1?'':'s') + ' active at this tier. Choose from ' + offers.length + ' campaign offer' + (offers.length===1?'':'s') + '; offers rotate toward less-used burdens after each completed Legendary run.';",
  'burden offer summary'
);

const panelHtml = [
"  <div class=\"setup-card\" id=\"rogue-history-panel\" style=\"display:none\">",
"    <h3>Campaign Chronicle</h3>",
"    <p id=\"rogue-history-summary\" style=\"font-size:.78em;color:#806850;margin:0 0 8px\"></p>",
"    <button class=\"btn btn-sm\" onclick=\"showCampaignChronicle()\">📜 View Chronicle</button>",
"  </div>"
].join('\n');
index = replaceOnce(
  index,
  "  <div class=\"setup-card\" id=\"shadow-burden-panel\" style=\"display:none\">\n    <h3>Shadow Burdens <span style=\"font-size:.7em;font-weight:normal;color:#706050\">Legendary+ campaign modifiers</span></h3>\n    <p id=\"shadow-burden-summary\" style=\"font-size:.76em;color:#706050;margin:0 0 8px\"></p>\n    <div id=\"shadow-burden-choices\"></div>\n  </div>",
  "  <div class=\"setup-card\" id=\"shadow-burden-panel\" style=\"display:none\">\n    <h3>Shadow Burdens <span style=\"font-size:.7em;font-weight:normal;color:#706050\">Legendary+ campaign modifiers</span></h3>\n    <p id=\"shadow-burden-summary\" style=\"font-size:.76em;color:#706050;margin:0 0 8px\"></p>\n    <div id=\"shadow-burden-choices\"></div>\n  </div>\n" + panelHtml,
  'campaign chronicle setup panel'
);

index = replaceOnce(
  index,
  "  if (G.phase === 'gameover') showGameover();",
  "  if (G.phase === 'gameover') { recordRoguelikeRunIfNeeded(); showGameover(); }",
  'record completed run'
);
index = replaceOnce(
  index,
  "      <button class=\"btn btn-sm\" style=\"color:#507050;border-color:#507050;margin-left:auto\" onclick=\"devTools()\">🔧</button>",
  "      <button class=\"btn btn-sm\" onclick=\"showCampaignChronicle()\">📜</button>\n      <button class=\"btn btn-sm\" style=\"color:#507050;border-color:#507050;margin-left:auto\" onclick=\"devTools()\">🔧</button>",
  'in-game chronicle button'
);
index = replaceOnce(
  index,
  "  buildDifficultySelect();\n  if (localStorage.getItem(SAVE_KEY)) {",
  "  buildDifficultySelect();\n  renderRogueHistoryPanel();\n  if (localStorage.getItem(SAVE_KEY)) {",
  'initial campaign panel render'
);
fs.writeFileSync(indexPath, index);

let tests = fs.readFileSync(testsPath, 'utf8');
const testAnchor = "test('free-people lieutenant boon state is wired into newGame', () => {";
const addedTests = [
"test('The Nine Ride redistributes an existing Nazgul instead of creating a tenth', () => {",
"  const ctx = makeContext();",
"  const g = startGame(ctx, { numPlayers:1, playerNames:['Tester'], charAssignment:[['frodo-sam','aragorn']], difficulty:'legendary+2', cardPrefs:{}, boons:{}, shadowBurdens:['nine-ride'] });",
"  assert.equal(Object.values(g.nazgul).reduce((a,b)=>a+b,0), 9);",
"  assert.equal(g.nazgul.mordor, 3);",
"  assert.equal(g.nazgul.enedwaith, 1);",
"});",
"",
"test('roguelike history and evolving burden offers are wired into the UI', () => {",
"  assert.ok(indexSource.includes(\"const ROGUE_HISTORY_KEY = 'fof-rogue-history';\"));",
"  assert.ok(indexSource.includes('function recordRoguelikeRunIfNeeded()'));",
"  assert.ok(indexSource.includes('function getBurdenOfferIds(difficulty)'));",
"  assert.ok(indexSource.includes('offers rotate toward less-used burdens'));",
"  assert.ok(indexSource.includes('showCampaignChronicle()'));",
"});",
"",
"test('save migration adds the roguelike run-record marker', () => {",
"  const ctx = makeContext();",
"  startGame(ctx, { numPlayers:1, playerNames:['Old'], charAssignment:[['frodo-sam','aragorn']], difficulty:'legendary+2', cardPrefs:{}, boons:{}, shadowBurdens:[] });",
"  vm.runInContext('delete G.rogueRunRecorded; __rr = migrateGameState(G)', ctx);",
"  assert.equal(evalIn(ctx, '__rr.rogueRunRecorded'), false);",
"});",
""
].join('\n');
if (!tests.includes("test('The Nine Ride redistributes")) {
  if (!tests.includes(testAnchor)) throw new Error('Regression anchor missing');
  tests = tests.replace(testAnchor, addedTests + testAnchor);
}
fs.writeFileSync(testsPath, tests);
console.log('Richer roguelike patch applied.');
