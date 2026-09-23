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
    throw new Error(`Patch anchor not found: ${label}`);
  }
  if (count !== 1) throw new Error(`Patch anchor was not unique (${count}): ${label}`);
  return source.replace(before, after);
}

let engine = fs.readFileSync(enginePath, 'utf8');
engine = replaceOnce(
  engine,
  `  const { numPlayers, playerNames, boons = {} } = cfg;`,
  `  const { numPlayers, playerNames, boons = {}, legacySetup = {} } = cfg;`,
  'legacy setup config'
);

engine = replaceOnce(
  engine,
  `  // Build player deck\n  const regionCards = makeRegionCards();`,
  `  // Apply setup-choice Legacy boons before decks/objectives are built so\n  // bonus characters count for character-specific objectives. Invalid or stale\n  // choices are ignored safely (for example, after changing player count).\n  const assignedChars = new Set(players.flatMap(p => p.chars));\n  const bonusCharChoices = Array.isArray(legacySetup.extraCharacters) ? legacySetup.extraCharacters : [];\n  const bonusCharLimit = Math.max(0, boons['extra-char'] || 0);\n  for (const choice of bonusCharChoices.slice(0, bonusCharLimit)) {\n    const playerIdx = Number(choice?.playerIdx);\n    const charId = choice?.charId;\n    if (!Number.isInteger(playerIdx) || !players[playerIdx] || !CHARS[charId] || assignedChars.has(charId)) continue;\n    players[playerIdx].chars.push(charId);\n    charState[charId].player = playerIdx;\n    assignedChars.add(charId);\n  }\n\n  const tokenChoices = Array.isArray(legacySetup.startTokens) ? legacySetup.startTokens : [];\n  const tokenLimit = Math.max(0, boons['start-token'] || 0);\n  const validTokenKeys = new Set(['friendship','valor','stealth','resistance']);\n  for (const sym of tokenChoices.slice(0, tokenLimit)) {\n    if (!validTokenKeys.has(sym)) continue;\n    for (const p of players) p.tokens[sym] = (p.tokens[sym] || 0) + 1;\n  }\n\n  // Build player deck\n  const regionCards = makeRegionCards();`,
  'extra character and token setup'
);

engine = replaceOnce(
  engine,
  `    legacyReshufflesLeft: Math.max(0, boons.reshuffle || 0),\n    freeLtState: {},           // per-lt state: { active, location }`,
  `    legacyReshufflesLeft: Math.max(0, boons.reshuffle || 0),\n    legacySetup: JSON.parse(JSON.stringify(legacySetup || {})),\n    freeLtState: {},           // per-lt state: { active, location }`,
  'persist legacy setup'
);

engine = replaceOnce(
  engine,
  `  // Initialize free peoples lieutenant state\n  for (const lt of FREE_PEOPLES_LIEUTENANTS) {`,
  `  // Deploy setup-choice friendly troops after G exists. A legal deployment\n  // location must begin as a haven, already contain a friendly troop, or host\n  // one of the Fellowship's characters. Each placement consumes reserve supply.\n  const deployChoices = Array.isArray(legacySetup.deployTroops) ? legacySetup.deployTroops : [];\n  const deployLimit = Math.max(0, boons['deploy-troop'] || 0);\n  const validTroopTypes = new Set(['dwarven','elven','rohirrim','gondor']);\n  for (const choice of deployChoices.slice(0, deployLimit)) {\n    const type = choice?.type;\n    const locId = choice?.locId;\n    const loc = G.locState[locId];\n    if (!validTroopTypes.has(type) || !loc || (G.troopSupply[type] || 0) <= 0) continue;\n    const hasFriendly = Object.values(loc.friendly || {}).some(n => n > 0);\n    const hasCharacter = Object.values(G.charState).some(c => c.player !== null && c.alive && c.location === locId);\n    if (!loc.isHaven && !hasFriendly && !hasCharacter) continue;\n    loc.friendly[type] = (loc.friendly[type] || 0) + 1;\n    G.troopSupply[type]--;\n  }\n\n  // Initialize free peoples lieutenant state\n  for (const lt of FREE_PEOPLES_LIEUTENANTS) {`,
  'deploy troop setup'
);
fs.writeFileSync(enginePath, engine);

let index = fs.readFileSync(indexPath, 'utf8');
index = replaceOnce(
  index,
  `    <div id="legacy-boons"></div>\n  </div>`,
  `    <div id="legacy-boons"></div>\n    <div id="legacy-setup-choices" style="display:none;margin-top:14px;padding-top:12px;border-top:1px solid #3a2810"></div>\n  </div>`,
  'legacy choices container'
);

index = replaceOnce(
  index,
  `function updatePlayerFields() {\n  const n = parseInt(document.getElementById('num-players').value);`,
  `function updatePlayerFields() {\n  const n = parseInt(document.getElementById('num-players').value);`,
  'player fields anchor'
);
index = replaceOnce(
  index,
  `    container.appendChild(wrap);\n  }\n}\n\nfunction makeSetupCharSelect`,
  `    container.appendChild(wrap);\n  }\n  if (typeof buildLegacySetupChoices === 'function') buildLegacySetupChoices();\n}\n\nfunction makeSetupCharSelect`,
  'refresh legacy choices after player count change'
);

index = replaceOnce(
  index,
  `  changed.dataset.prev = newVal;\n}\nupdatePlayerFields();`,
  `  changed.dataset.prev = newVal;\n  buildLegacySetupChoices();\n}\nupdatePlayerFields();`,
  'refresh choices after character swap'
);

const legacyHelpers = `\nfunction getCurrentSetupAssignments() {\n  const n = parseInt(document.getElementById('num-players')?.value || '1');\n  const out = [];\n  for (let i = 0; i < n; i++) {\n    const chars = i === 0 ? ['frodo-sam'] : [];\n    const a = document.getElementById(\`pchar\${i}a\`)?.value;\n    const b = document.getElementById(\`pchar\${i}b\`)?.value;\n    if (a) chars.push(a);\n    if (b) chars.push(b);\n    out.push(chars);\n  }\n  return out;\n}\n\nfunction buildLegacySetupChoices() {\n  const el = document.getElementById('legacy-setup-choices');\n  if (!el) return;\n  const boons = getBoons();\n  const extraN = Math.max(0, boons['extra-char'] || 0);\n  const tokenN = Math.max(0, boons['start-token'] || 0);\n  const troopN = Math.max(0, boons['deploy-troop'] || 0);\n  if (extraN + tokenN + troopN === 0) { el.style.display = 'none'; el.innerHTML = ''; return; }\n\n  el.style.display = 'block';\n  el.innerHTML = '<div style="color:#c8a050;font-size:.82em;font-weight:bold;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Starting choices</div>';\n  const assignments = getCurrentSetupAssignments();\n  const assigned = new Set(assignments.flat());\n  const nPlayers = assignments.length;\n\n  for (let i = 0; i < extraN; i++) {\n    const row = document.createElement('div');\n    row.style.cssText = 'display:grid;grid-template-columns:1fr 1.4fr;gap:6px;margin-bottom:6px;align-items:center';\n    const pSel = document.createElement('select');\n    pSel.id = \`legacy-extra-player-\${i}\`;\n    for (let p = 0; p < nPlayers; p++) {\n      const o = document.createElement('option'); o.value = String(p); o.textContent = document.getElementById(\`pname\${p}\`)?.value.trim() || \`Player \${p+1}\`; pSel.appendChild(o);\n    }\n    const cSel = document.createElement('select');\n    cSel.id = \`legacy-extra-char-\${i}\`;\n    for (const [cid, c] of Object.entries(CHARS)) {\n      if (assigned.has(cid)) continue;\n      const o = document.createElement('option'); o.value = cid; o.textContent = c.name; cSel.appendChild(o);\n    }\n    row.appendChild(pSel); row.appendChild(cSel); el.appendChild(row);\n  }\n\n  const tokenLabels = { friendship:'♥ Friendship', valor:'⚔ Valor', stealth:'★ Stealth', resistance:'◎ Resistance' };\n  for (let i = 0; i < tokenN; i++) {\n    const row = document.createElement('div');\n    row.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:6px;font-size:.8em';\n    row.innerHTML = '<span style="flex:1;color:#907850">Token for every player</span>';\n    const sel = document.createElement('select'); sel.id = \`legacy-start-token-\${i}\`;\n    for (const [k,label] of Object.entries(tokenLabels)) { const o=document.createElement('option'); o.value=k; o.textContent=label; sel.appendChild(o); }\n    row.appendChild(sel); el.appendChild(row);\n  }\n\n  const troopLabels = { gondor:'Gondor', rohirrim:'Rohirrim', elven:'Elven', dwarven:'Dwarven' };\n  for (let i = 0; i < troopN; i++) {\n    const row = document.createElement('div');\n    row.style.cssText = 'display:grid;grid-template-columns:.8fr 1.4fr;gap:6px;margin-bottom:6px';\n    const tSel = document.createElement('select'); tSel.id = \`legacy-deploy-type-\${i}\`;\n    for (const [k,label] of Object.entries(troopLabels)) { const o=document.createElement('option'); o.value=k; o.textContent=label; tSel.appendChild(o); }\n    const lSel = document.createElement('select'); lSel.id = \`legacy-deploy-loc-\${i}\`;\n    const charLocs = new Set(assignments.flat().map(cid => CHARS[cid]?.start).filter(Boolean));\n    for (const [lid, loc] of Object.entries(LOCS)) {\n      const baseFriendly = !!loc.musterType || ['grey-havens','rivendell','lorien','woodland-realm','ered-luin','erebor','iron-hills','helms-deep','edoras','eastemnet','minas-tirith','dol-amroth','pelargir'].includes(lid);\n      if (!loc.isHaven && !baseFriendly && !charLocs.has(lid)) continue;\n      const o=document.createElement('option'); o.value=lid; o.textContent=loc.name; lSel.appendChild(o);\n    }\n    row.appendChild(tSel); row.appendChild(lSel); el.appendChild(row);\n  }\n  const note = document.createElement('div');\n  note.style.cssText = 'font-size:.7em;color:#706050;margin-top:6px';\n  note.textContent = 'Cloud rooms use these choices too; bonus characters join the host unless changed in local play.';\n  el.appendChild(note);\n}\n\nfunction getLegacySetupChoices(forCloudRoom = false) {\n  const boons = getBoons();\n  const extraCharacters = [];\n  const seen = new Set(getCurrentSetupAssignments().flat());\n  for (let i = 0; i < Math.max(0, boons['extra-char'] || 0); i++) {\n    const charId = document.getElementById(\`legacy-extra-char-\${i}\`)?.value;\n    const rawPlayer = parseInt(document.getElementById(\`legacy-extra-player-\${i}\`)?.value || '0');\n    if (!charId || seen.has(charId)) continue;\n    seen.add(charId);\n    extraCharacters.push({ playerIdx: forCloudRoom ? 0 : rawPlayer, charId });\n  }\n  const startTokens = [];\n  for (let i = 0; i < Math.max(0, boons['start-token'] || 0); i++) {\n    const sym = document.getElementById(\`legacy-start-token-\${i}\`)?.value;\n    if (sym) startTokens.push(sym);\n  }\n  const deployTroops = [];\n  for (let i = 0; i < Math.max(0, boons['deploy-troop'] || 0); i++) {\n    const type = document.getElementById(\`legacy-deploy-type-\${i}\`)?.value;\n    const locId = document.getElementById(\`legacy-deploy-loc-\${i}\`)?.value;\n    if (type && locId) deployTroops.push({ type, locId });\n  }\n  return { extraCharacters, startTokens, deployTroops };\n}\n`;

index = replaceOnce(
  index,
  `function buildLegacyBoons() {`,
  legacyHelpers + `\nfunction buildLegacyBoons() {`,
  'legacy setup helpers'
);
index = replaceOnce(
  index,
  `      buildDifficultySelect();\n    };`,
  `      buildDifficultySelect();\n      buildLegacySetupChoices();\n    };`,
  'refresh after boon purchase'
);
index = replaceOnce(
  index,
  `    buildLegacyBoons();\n  }\n}`,
  `    buildLegacyBoons();\n    buildLegacySetupChoices();\n  }\n}`,
  'difficulty builds setup choices'
);

index = replaceOnce(
  index,
  `  const boons = getBoons();\n  newGame({ numPlayers:n, playerNames:names, difficulty:diff, charAssignment, cardPrefs, boons });`,
  `  const boons = getBoons();\n  const legacySetup = getLegacySetupChoices(false);\n  newGame({ numPlayers:n, playerNames:names, difficulty:diff, charAssignment, cardPrefs, boons, legacySetup });`,
  'local setup choices'
);
index = replaceOnce(
  index,
  `  const boons = getBoons();\n  const selectedObjectiveIds = pickLobbyObjectives(difficulty, cardPrefs);\n  const lobby = {\n    host: myId,\n    status: 'waiting',\n    settings: { difficulty, cardPrefs, boons, selectedObjectiveIds },`,
  `  const boons = getBoons();\n  const legacySetup = getLegacySetupChoices(true);\n  const selectedObjectiveIds = pickLobbyObjectives(difficulty, cardPrefs);\n  const lobby = {\n    host: myId,\n    status: 'waiting',\n    settings: { difficulty, cardPrefs, boons, legacySetup, selectedObjectiveIds },`,
  'cloud lobby setup choices'
);
index = replaceOnce(
  index,
  `  const { difficulty: rawDiff, cardPrefs, boons, selectedObjectiveIds } = authLobby.settings || {};`,
  `  const { difficulty: rawDiff, cardPrefs, boons, legacySetup, selectedObjectiveIds } = authLobby.settings || {};`,
  'lobby legacy config destructure'
);
index = replaceOnce(
  index,
  `  newGame({ numPlayers: sorted.length, playerNames: sorted.map(([,p])=>p.name), charAssignment, difficulty, cardPrefs, boons, selectedObjectiveIds });`,
  `  newGame({ numPlayers: sorted.length, playerNames: sorted.map(([,p])=>p.name), charAssignment, difficulty, cardPrefs, boons, legacySetup, selectedObjectiveIds });`,
  'lobby new game setup choices'
);
fs.writeFileSync(indexPath, index);

let tests = fs.readFileSync(testsPath, 'utf8');
const anchor = `test('Legacy reshuffle is consumed before empty-deck hope loss', () => {`;
const additions = `test('setup-choice Legacy boons apply explicit character, token and troop choices', () => {\n  const ctx = makeContext();\n  const g = startGame(ctx, {\n    numPlayers: 2, playerNames: ['One','Two'], charAssignment: [['frodo-sam','aragorn'], ['legolas','gimli']],\n    difficulty: 'standard', cardPrefs: {},\n    boons: { 'extra-char': 1, 'start-token': 2, 'deploy-troop': 1 },\n    legacySetup: {\n      extraCharacters: [{ playerIdx: 1, charId: 'eowyn' }],\n      startTokens: ['valor','stealth'],\n      deployTroops: [{ type:'gondor', locId:'minas-tirith' }],\n    },\n  });\n  assert.ok(g.players[1].chars.includes('eowyn'));\n  assert.equal(g.charState.eowyn.player, 1);\n  assert.equal(g.players[0].tokens.valor, 1);\n  assert.equal(g.players[1].tokens.valor, 1);\n  assert.equal(g.players[0].tokens.stealth, 1);\n  assert.equal(g.players[1].tokens.stealth, 1);\n  assert.equal(g.locState['minas-tirith'].friendly.gondor, 3);\n});\n\ntest('setup-choice Legacy boon limits and deployment legality are enforced', () => {\n  const ctx = makeContext();\n  const g = startGame(ctx, {\n    numPlayers: 1, playerNames: ['One'], charAssignment: [['frodo-sam','aragorn']],\n    difficulty: 'standard', cardPrefs: {},\n    boons: { 'extra-char': 1, 'start-token': 1, 'deploy-troop': 1 },\n    legacySetup: {\n      extraCharacters: [{ playerIdx:0, charId:'eowyn' }, { playerIdx:0, charId:'gimli' }],\n      startTokens: ['friendship','valor'],\n      deployTroops: [{ type:'elven', locId:'nurn' }, { type:'elven', locId:'rivendell' }],\n    },\n  });\n  assert.ok(g.players[0].chars.includes('eowyn'));\n  assert.ok(!g.players[0].chars.includes('gimli'));\n  assert.equal(g.players[0].tokens.friendship, 1);\n  assert.equal(g.players[0].tokens.valor, 0);\n  assert.equal(g.locState.nurn.friendly.elven, 0, 'illegal deployment should be ignored');\n});\n\n`;
if (!tests.includes("test('setup-choice Legacy boons apply explicit character")) {
  if (!tests.includes(anchor)) throw new Error('tests insertion anchor missing');
  tests = tests.replace(anchor, additions + anchor);
}
fs.writeFileSync(testsPath, tests);
console.log('Legacy setup-choice patch applied.');
