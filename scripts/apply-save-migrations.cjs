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
`let G = null; // the live game state\n\nfunction newGame(cfg) {`,
`let G = null; // the live game state\nconst GAME_STATE_VERSION = 2;\n\n// Upgrade older local/cloud saves in place. Migrations are intentionally\n// additive: old games keep their exact board/deck state while newly-required\n// fields receive safe defaults.\nfunction migrateGameState(state) {\n  if (!state || typeof state !== 'object') throw new Error('Invalid game state');\n  const s = state;\n  const fromVersion = Number.isInteger(s.saveVersion) ? s.saveVersion : 0;\n  if (fromVersion > GAME_STATE_VERSION) throw new Error(\`Save is from newer game version \${fromVersion}\`);\n\n  if (!Array.isArray(s.players)) s.players = [];\n  for (const p of s.players) {\n    p.hand = Array.isArray(p.hand) ? p.hand : [];\n    p.chars = Array.isArray(p.chars) ? p.chars : [];\n    p.tokens = Object.assign({ friendship:0, valor:0, stealth:0, resistance:0 }, p.tokens || {});\n    if (!Number.isFinite(p.actionsPerChar)) p.actionsPerChar = p.chars.length === 1 ? 5 : 4;\n  }\n  s.charState = s.charState || {};\n  s.locState = s.locState || {};\n  s.playerDeck = Array.isArray(s.playerDeck) ? s.playerDeck : [];\n  s.playerDiscard = Array.isArray(s.playerDiscard) ? s.playerDiscard : [];\n  s.shadowDeck = Array.isArray(s.shadowDeck) ? s.shadowDeck : [];\n  s.shadowDiscard = Array.isArray(s.shadowDiscard) ? s.shadowDiscard : [];\n  s.objectives = Array.isArray(s.objectives) ? s.objectives : [];\n  s.capturedStrongholds = Array.isArray(s.capturedStrongholds) ? s.capturedStrongholds : [];\n  s.extraHavens = Array.isArray(s.extraHavens) ? s.extraHavens : [];\n  s.skiesBuffer = Array.isArray(s.skiesBuffer) ? s.skiesBuffer : [];\n  s.shadowLieutenants = Array.isArray(s.shadowLieutenants) ? s.shadowLieutenants : [];\n  s.log = Array.isArray(s.log) ? s.log : [];\n  s.freeLtBoons = s.freeLtBoons || {};\n  s.freeLtState = s.freeLtState || {};\n  s.legacySetup = Object.assign({ extraCharacters:[], startTokens:[], deployTroops:[] }, s.legacySetup || {});\n  s.legacyReshufflesLeft = Math.max(0, Number(s.legacyReshufflesLeft) || 0);\n  s.ui = Object.assign({ selectedChar:null, pendingAction:null, validTargets:[], ignoreNextOrder:false, freeSearchThisTurn:false }, s.ui || {});\n  s.turn = s.turn || makeTurn(s.players[s.currentPlayer || 0]?.chars || [], s.players[s.currentPlayer || 0]?.actionsPerChar || 4);\n  s.turn.charActions = s.turn.charActions || {};\n  s.turn.actionsUsed = s.turn.actionsUsed || {};\n  s.turn.doneChars = Array.isArray(s.turn.doneChars) ? s.turn.doneChars : [];\n  if (s.turn.primaryChar === undefined) s.turn.primaryChar = null;\n  if (!Number.isFinite(s.plusLevel)) {\n    const m = String(s.difficulty || '').match(/^legendary\\+(\\d+)$/);\n    s.plusLevel = m ? parseInt(m[1]) : 0;\n  }\n  if (!Number.isFinite(s.savedAt)) s.savedAt = 0;\n  s.saveVersion = GAME_STATE_VERSION;\n  return s;\n}\n\nfunction newGame(cfg) {`, 'migration helper');
engine = replaceOnce(engine,
`  G = {\n    players,`,
`  G = {\n    saveVersion: GAME_STATE_VERSION,\n    players,`, 'new game save version');
fs.writeFileSync(enginePath, engine);

let index = fs.readFileSync(indexPath, 'utf8');
index = replaceOnce(index,
`  const DEV_MODE = true; // set false in production to gate behind wins`,
`  const DEV_MODE = false; // progression is gated by completed Legendary tiers`, 'disable dev progression bypass');
index = index.replace(`        <button class="btn btn-sm" style="color:#507050;border-color:#507050;font-size:.72em" onclick="grantTestLP(10)">+10 LP (test)</button>\n`, '');
index = replaceOnce(index,
`    localStorage.setItem(SAVE_KEY, JSON.stringify(G));`,
`    G = migrateGameState(G);\n    localStorage.setItem(SAVE_KEY, JSON.stringify(G));`, 'version local save');
index = replaceOnce(index,
`    G = JSON.parse(raw);`,
`    G = migrateGameState(JSON.parse(raw));`, 'migrate local load');
index = replaceOnce(index,
`    return await res.json(); // G directly`,
`    return migrateGameState(await res.json());`, 'migrate cloud load');
index = replaceOnce(index,
`      const incoming = JSON.parse(e.data)?.data;\n      if (!incoming?.savedAt || incoming.savedAt <= (G?.savedAt || 0)) return;`,
`      const incomingRaw = JSON.parse(e.data)?.data;\n      if (!incomingRaw?.savedAt || incomingRaw.savedAt <= (G?.savedAt || 0)) return;\n      const incoming = migrateGameState(incomingRaw);`, 'migrate cloud stream');
index = replaceOnce(index,
`      G = roomData.state;`,
`      G = migrateGameState(roomData.state);`, 'migrate direct room join');
fs.writeFileSync(indexPath, index);

let tests = fs.readFileSync(testsPath, 'utf8');
const anchor = `test('map connections only reference known locations', () => {`;
const addition = `test('old save states migrate additively to the current schema', () => {\n  const ctx = makeContext();\n  startGame(ctx, { numPlayers:1, playerNames:['Old'], charAssignment:[['frodo-sam','aragorn']], difficulty:'standard', cardPrefs:{}, boons:{} });\n  vm.runInContext(\`\n    __old = JSON.parse(JSON.stringify(G));\n    delete __old.saveVersion;\n    delete __old.legacySetup;\n    delete __old.legacyReshufflesLeft;\n    delete __old.freeLtBoons;\n    delete __old.freeLtState;\n    delete __old.turn.actionsUsed;\n    delete __old.ui.freeSearchThisTurn;\n    __migrated = migrateGameState(__old);\n  \`, ctx);\n  assert.equal(evalIn(ctx, '__migrated.saveVersion'), evalIn(ctx, 'GAME_STATE_VERSION'));\n  assert.ok(evalIn(ctx, '__migrated.legacySetup'));\n  assert.equal(evalIn(ctx, '__migrated.legacyReshufflesLeft'), 0);\n  assert.ok(evalIn(ctx, '__migrated.freeLtBoons'));\n  assert.ok(evalIn(ctx, '__migrated.turn.actionsUsed'));\n  assert.equal(evalIn(ctx, '__migrated.ui.freeSearchThisTurn'), false);\n  assert.equal(evalIn(ctx, '__migrated.charState["frodo-sam"].location'), evalIn(ctx, 'G.charState["frodo-sam"].location'));\n});\n\ntest('migration rejects saves from a newer schema version', () => {\n  const ctx = makeContext();\n  ctx.__future = { saveVersion: 999 };\n  assert.throws(() => vm.runInContext('migrateGameState(__future)', ctx), /newer game version/);\n});\n\n`;
if (!tests.includes("test('old save states migrate additively")) {
  if (!tests.includes(anchor)) throw new Error('test anchor missing');
  tests = tests.replace(anchor, addition + anchor);
}
fs.writeFileSync(testsPath, tests);
console.log('Save migration patch applied.');
