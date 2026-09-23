'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const enginePath = path.join(ROOT, 'engine.js');
const indexPath = path.join(ROOT, 'index.html');
const testsPath = path.join(ROOT, 'tests', 'regression.cjs');

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count === 0) { if (source.includes(after)) return source; throw new Error(`Missing anchor: ${label}`); }
  if (count !== 1) throw new Error(`Non-unique anchor (${count}): ${label}`);
  return source.replace(before, after);
}

let engine = fs.readFileSync(enginePath, 'utf8');
engine = replaceOnce(engine,
"const GAME_STATE_VERSION = 2;",
"const GAME_STATE_VERSION = 3;\n\nconst SHADOW_BURDENS = [\n  { id:'war-in-rohan', name:'War in Rohan', desc:'The war starts closer to the Mark: +1 shadow troop at Isengard and Fords of Isen.', setupShadow:{ isengard:1, 'fords-of-isen':1 } },\n  { id:'mordor-musters', name:'Mordor Musters', desc:'The Black Land is already mobilising: +1 shadow troop at Minas Morgul and Barad-dûr.', setupShadow:{ 'minas-morgul':1, 'barad-dur':1 } },\n  { id:'darkening-skies', name:'Darkening Skies', desc:'Draw 1 additional Shadow card during setup.', extraSetupDraws:1 },\n  { id:'hope-wanes', name:'Hope Wanes', desc:'Start with 1 less Hope and reduce maximum Hope by 1.', hopePenalty:1 },\n  { id:'nine-ride', name:'The Nine Ride', desc:'Add 1 Nazgûl to Mordor at setup.', extraNazgul:{ mordor:1 } },\n];",
'game state version and burden definitions');
engine = replaceOnce(engine,
"  s.shadowLieutenants = Array.isArray(s.shadowLieutenants) ? s.shadowLieutenants : [];",
"  s.shadowLieutenants = Array.isArray(s.shadowLieutenants) ? s.shadowLieutenants : [];\n  s.shadowBurdens = Array.isArray(s.shadowBurdens) ? s.shadowBurdens : [];",
'migrate shadow burdens');
engine = replaceOnce(engine,
"function newGame(cfg) {\n  const { numPlayers, playerNames, boons = {}, legacySetup = {} } = cfg;\n  const difficulty = cfg.difficulty || 'standard';\n  const plusMatch = difficulty.match(/^legendary\\+(\\d+)$/);\n  const plusLevel = plusMatch ? parseInt(plusMatch[1]) : 0;",
"function newGame(cfg) {\n  const { numPlayers, playerNames, boons = {}, legacySetup = {}, shadowBurdens = [] } = cfg;\n  const difficulty = cfg.difficulty || 'standard';\n  const plusMatch = difficulty.match(/^legendary\\+(\\d+)$/);\n  const plusLevel = plusMatch ? parseInt(plusMatch[1]) : 0;\n  const burdenSlots = plusLevel > 0 ? Math.min(3, Math.floor((plusLevel + 1) / 3)) : 0;\n  const activeBurdenIds = [...new Set(Array.isArray(shadowBurdens) ? shadowBurdens : [])]\n    .filter(id => SHADOW_BURDENS.some(b => b.id === id))\n    .slice(0, burdenSlots);\n  const activeBurdens = activeBurdenIds.map(id => SHADOW_BURDENS.find(b => b.id === id));\n  const burdenHopePenalty = activeBurdens.reduce((n,b) => n + (b.hopePenalty || 0), 0);\n  const burdenExtraDraws = activeBurdens.reduce((n,b) => n + (b.extraSetupDraws || 0), 0);",
'newGame burden setup');
engine = replaceOnce(engine,
"  const extraSetupDraws = Math.ceil(plusLevel / 2); // +1 per odd + level",
"  const extraSetupDraws = Math.ceil(plusLevel / 2) + burdenExtraDraws; // Legendary+ scaling plus active burdens",
'extra burden setup draws');
engine = replaceOnce(engine,
"    hope: 6 + Math.max(0, boons['more-hope'] || 0),\n    maxHope: 8 + Math.max(0, boons['more-hope'] || 0),",
"    hope: Math.max(1, 6 + Math.max(0, boons['more-hope'] || 0) - burdenHopePenalty),\n    maxHope: Math.max(1, 8 + Math.max(0, boons['more-hope'] || 0) - burdenHopePenalty),",
'burden hope penalty');
engine = replaceOnce(engine,
"    shadowLieutenants: [],     // active lieutenant ids from legendary+",
"    shadowLieutenants: [],     // active lieutenant ids from legendary+\n    shadowBurdens: activeBurdenIds,",
'persist burdens');
engine = replaceOnce(engine,
"  // Initialize free peoples lieutenant state\n  for (const lt of FREE_PEOPLES_LIEUTENANTS) {",
"  // Apply selected Shadow Burdens after the core state exists. Setup troops\n  // come from the finite shadow reserve, preserving the physical-piece total.\n  for (const burden of activeBurdens) {\n    for (const [locId, count] of Object.entries(burden.setupShadow || {})) {\n      if (!G.locState[locId]) continue;\n      const add = Math.max(0, Math.min(Number(count) || 0, G.shadowSupply));\n      G.locState[locId].shadowTroops += add;\n      G.shadowSupply -= add;\n    }\n    for (const [regionId, count] of Object.entries(burden.extraNazgul || {})) {\n      if (G.nazgul[regionId] === undefined) continue;\n      G.nazgul[regionId] += Math.max(0, Number(count) || 0);\n    }\n    addLog(`Shadow Burden: ${burden.name} — ${burden.desc}`);\n  }\n\n  // Initialize free peoples lieutenant state\n  for (const lt of FREE_PEOPLES_LIEUTENANTS) {",
'apply burden effects');
fs.writeFileSync(enginePath, engine);

let index = fs.readFileSync(indexPath, 'utf8');
index = replaceOnce(index,
`  <div class="setup-card">\n    <h3>Difficulty</h3>\n    <div class="setup-row">\n      <label>Level</label>\n      <select id="difficulty"></select>\n    </div>\n  </div>`,
`  <div class="setup-card">\n    <h3>Difficulty</h3>\n    <div class="setup-row">\n      <label>Level</label>\n      <select id="difficulty"></select>\n    </div>\n  </div>\n  <div class="setup-card" id="shadow-burden-panel" style="display:none">\n    <h3>Shadow Burdens <span style="font-size:.7em;font-weight:normal;color:#706050">Legendary+ campaign modifiers</span></h3>\n    <p id="shadow-burden-summary" style="font-size:.76em;color:#706050;margin:0 0 8px"></p>\n    <div id="shadow-burden-choices"></div>\n  </div>`,
'shadow burden setup panel');
index = replaceOnce(index,
"const SAVE_KEY   = 'fof-save';",
"const SAVE_KEY   = 'fof-save';\nconst BURDEN_PREF_KEY = 'fof-shadow-burden-prefs';",
'burden preference key');
index = replaceOnce(index,
`function setBoon(id, val) {\n  const b = getBoons(); b[id] = val; localStorage.setItem(BOONS_KEY, JSON.stringify(b));\n}\n\nfunction buildDifficultySelect() {`,
`function setBoon(id, val) {\n  const b = getBoons(); b[id] = val; localStorage.setItem(BOONS_KEY, JSON.stringify(b));\n}\n\nfunction burdenSlotsForDifficulty(difficulty) {\n  const m = String(difficulty || '').match(/^legendary\\+(\\d+)$/);\n  if (!m) return 0;\n  return Math.min(3, Math.floor((parseInt(m[1]) + 1) / 3)); // +2, +5, +8\n}\n\nfunction getBurdenPrefs() {\n  try { return JSON.parse(localStorage.getItem(BURDEN_PREF_KEY) || '[]'); } catch { return []; }\n}\n\nfunction getSelectedShadowBurdens() {\n  const slots = burdenSlotsForDifficulty(document.getElementById('difficulty')?.value);\n  const ids = [];\n  for (let i = 0; i < slots; i++) {\n    const id = document.getElementById(`shadow-burden-${i}`)?.value;\n    if (id && !ids.includes(id)) ids.push(id);\n  }\n  return ids;\n}\n\nfunction buildShadowBurdenChoices() {\n  const panel = document.getElementById('shadow-burden-panel');\n  const choices = document.getElementById('shadow-burden-choices');\n  const summary = document.getElementById('shadow-burden-summary');\n  if (!panel || !choices || !summary) return;\n  const difficulty = document.getElementById('difficulty')?.value || 'standard';\n  const slots = burdenSlotsForDifficulty(difficulty);\n  if (slots <= 0) { panel.style.display = 'none'; choices.innerHTML = ''; return; }\n  panel.style.display = 'block';\n  summary.textContent = `${slots} burden${slots===1?'':'s'} active at this tier. New slots unlock at Legendary +2, +5 and +8.`;\n  const prefs = getBurdenPrefs();\n  const used = new Set();\n  choices.innerHTML = '';\n  for (let i = 0; i < slots; i++) {\n    const wrap = document.createElement('div');\n    wrap.style.cssText = 'margin-bottom:8px';\n    const sel = document.createElement('select');\n    sel.id = `shadow-burden-${i}`;\n    sel.style.width = '100%';\n    let selected = prefs[i];\n    if (!SHADOW_BURDENS.some(b => b.id === selected) || used.has(selected)) selected = SHADOW_BURDENS.find(b => !used.has(b.id))?.id;\n    for (const b of SHADOW_BURDENS) {\n      if (used.has(b.id) && b.id !== selected) continue;\n      const o = document.createElement('option'); o.value = b.id; o.textContent = b.name; o.selected = b.id === selected; sel.appendChild(o);\n    }\n    if (selected) used.add(selected);\n    const desc = document.createElement('div');\n    desc.style.cssText = 'font-size:.72em;color:#806850;margin-top:3px';\n    desc.textContent = SHADOW_BURDENS.find(b => b.id === selected)?.desc || '';\n    sel.onchange = () => {\n      const current = Array.from(document.querySelectorAll('[id^="shadow-burden-"]')).filter(e => e.tagName === 'SELECT').map(e => e.value);\n      localStorage.setItem(BURDEN_PREF_KEY, JSON.stringify(current));\n      buildShadowBurdenChoices();\n    };\n    wrap.appendChild(sel); wrap.appendChild(desc); choices.appendChild(wrap);\n  }\n  localStorage.setItem(BURDEN_PREF_KEY, JSON.stringify(getSelectedShadowBurdens()));\n}\n\nfunction buildDifficultySelect() {`,
'burden selection helpers');
index = replaceOnce(index,
"      const extraObjs = i, extraDraws = Math.ceil(i/2), lieutenants = Math.min(Math.floor(i/2), 5);\n      opts.push({ v:key, label:`Legendary +${i} (${extraObjs} extra obj, ${extraDraws} extra draw${extraDraws!==1?'s':''}, ${lieutenants} lieutenant${lieutenants!==1?'s':''})` });",
"      const extraObjs = i, extraDraws = Math.ceil(i/2), lieutenants = Math.min(Math.floor(i/2), 5), burdens = burdenSlotsForDifficulty(key);\n      opts.push({ v:key, label:`Legendary +${i} (${extraObjs} extra obj, ${extraDraws} extra draw${extraDraws!==1?'s':''}, ${lieutenants} lieutenant${lieutenants!==1?'s':''}${burdens ? `, ${burdens} burden${burdens!==1?'s':''}` : ''})` });",
'difficulty burden label');
index = replaceOnce(index,
"  sel.innerHTML = opts.map((o,i) => `<option value=\"${o.v}\"${i===1?' selected':''}>${o.label}</option>`).join('');",
"  sel.innerHTML = opts.map((o,i) => `<option value=\"${o.v}\"${i===1?' selected':''}>${o.label}</option>`).join('');\n  sel.onchange = buildShadowBurdenChoices;\n  buildShadowBurdenChoices();",
'build burden UI with difficulty');
index = replaceOnce(index,
"  const boons = getBoons();\n  const legacySetup = getLegacySetupChoices(true);\n  const selectedObjectiveIds = pickLobbyObjectives(difficulty, cardPrefs);",
"  const boons = getBoons();\n  const legacySetup = getLegacySetupChoices(true);\n  const shadowBurdens = getSelectedShadowBurdens();\n  const selectedObjectiveIds = pickLobbyObjectives(difficulty, cardPrefs);",
'cloud burden selection');
index = replaceOnce(index,
"    settings: { difficulty, cardPrefs, boons, legacySetup, selectedObjectiveIds },",
"    settings: { difficulty, cardPrefs, boons, legacySetup, shadowBurdens, selectedObjectiveIds },",
'cloud burden settings');
index = replaceOnce(index,
"  const { difficulty: rawDiff, cardPrefs, boons, legacySetup, selectedObjectiveIds } = authLobby.settings || {};",
"  const { difficulty: rawDiff, cardPrefs, boons, legacySetup, shadowBurdens, selectedObjectiveIds } = authLobby.settings || {};",
'lobby burden destructure');
index = replaceOnce(index,
"  newGame({ numPlayers: sorted.length, playerNames: sorted.map(([,p])=>p.name), charAssignment, difficulty, cardPrefs, boons, legacySetup, selectedObjectiveIds });",
"  newGame({ numPlayers: sorted.length, playerNames: sorted.map(([,p])=>p.name), charAssignment, difficulty, cardPrefs, boons, legacySetup, shadowBurdens, selectedObjectiveIds });",
'lobby burden newGame');
index = replaceOnce(index,
"  const boons = getBoons();\n  const legacySetup = getLegacySetupChoices(false);\n  newGame({ numPlayers:n, playerNames:names, difficulty:diff, charAssignment, cardPrefs, boons, legacySetup });",
"  const boons = getBoons();\n  const legacySetup = getLegacySetupChoices(false);\n  const shadowBurdens = getSelectedShadowBurdens();\n  newGame({ numPlayers:n, playerNames:names, difficulty:diff, charAssignment, cardPrefs, boons, legacySetup, shadowBurdens });",
'local burden newGame');
index = replaceOnce(index,
"    `<strong>Shadow lieutenants:</strong> ${G.shadowLieutenants.join(', ') || 'none'}<br>` +",
"    `<strong>Shadow lieutenants:</strong> ${G.shadowLieutenants.join(', ') || 'none'}<br>` +\n    `<strong>Shadow burdens:</strong> ${(G.shadowBurdens||[]).join(', ') || 'none'}<br>` +",
'dev burden display');
fs.writeFileSync(indexPath, index);

let tests = fs.readFileSync(testsPath, 'utf8');
const anchor = "test('free-people lieutenant boon state is wired into newGame', () => {";
const addition = `test('Shadow Burdens are tier-gated, unique and modify setup state', () => {\n  const baseCtx = makeContext();\n  const base = startGame(baseCtx, { numPlayers:1, playerNames:['Base'], charAssignment:[['frodo-sam','aragorn']], difficulty:'legendary+5', cardPrefs:{}, boons:{}, shadowBurdens:[] });\n  const ctx = makeContext();\n  const g = startGame(ctx, { numPlayers:1, playerNames:['Burdened'], charAssignment:[['frodo-sam','aragorn']], difficulty:'legendary+5', cardPrefs:{}, boons:{}, shadowBurdens:['war-in-rohan','hope-wanes','darkening-skies'] });\n  assert.deepEqual(Array.from(g.shadowBurdens), ['war-in-rohan','hope-wanes']);\n  assert.equal(g.hope, base.hope - 1);\n  assert.equal(g.maxHope, base.maxHope - 1);\n  assert.equal(g.locState.isengard.shadowTroops, base.locState.isengard.shadowTroops + 1);\n  assert.equal(g.locState['fords-of-isen'].shadowTroops, base.locState['fords-of-isen'].shadowTroops + 1);\n  assert.equal(g.shadowSupply, base.shadowSupply - 2);\n});\n\ntest('Darkening Skies burden adds one setup draw when a burden slot exists', () => {\n  const baseCtx = makeContext();\n  const base = startGame(baseCtx, { numPlayers:1, playerNames:['Base'], charAssignment:[['frodo-sam','aragorn']], difficulty:'legendary+2', cardPrefs:{}, boons:{}, shadowBurdens:[] });\n  const ctx = makeContext();\n  const g = startGame(ctx, { numPlayers:1, playerNames:['Dark'], charAssignment:[['frodo-sam','aragorn']], difficulty:'legendary+2', cardPrefs:{}, boons:{}, shadowBurdens:['darkening-skies'] });\n  assert.equal(g.shadowDiscard.length, base.shadowDiscard.length + 1);\n});\n\ntest('old save migration supplies an empty Shadow Burden list', () => {\n  const ctx = makeContext();\n  ctx.__old = { saveVersion:2, players:[], currentPlayer:0 };\n  vm.runInContext('__m = migrateGameState(__old)', ctx);\n  assert.deepEqual(Array.from(evalIn(ctx, '__m.shadowBurdens')), []);\n  assert.equal(evalIn(ctx, '__m.saveVersion'), evalIn(ctx, 'GAME_STATE_VERSION'));\n});\n\ntest('Shadow Burden setup UI is wired into local and cloud game creation', () => {\n  assert.ok(indexSource.includes('function buildShadowBurdenChoices()'));\n  assert.ok(indexSource.includes('const shadowBurdens = getSelectedShadowBurdens();'));\n  assert.ok(indexSource.includes('settings: { difficulty, cardPrefs, boons, legacySetup, shadowBurdens, selectedObjectiveIds }'));\n});\n\n`;
if (!tests.includes("test('Shadow Burdens are tier-gated")) {
  if (!tests.includes(anchor)) throw new Error('test anchor missing');
  tests = tests.replace(anchor, addition + anchor);
}
fs.writeFileSync(testsPath, tests);
console.log('Shadow Burdens patch applied.');
