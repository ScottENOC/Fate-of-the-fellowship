'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const enginePath = path.join(ROOT, 'engine.js');
const testsPath = path.join(ROOT, 'tests', 'regression.cjs');

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count === 0) {
    if (source.includes(after)) return source; // already applied
    throw new Error(`Patch anchor not found: ${label}`);
  }
  if (count !== 1) throw new Error(`Patch anchor was not unique (${count} matches): ${label}`);
  return source.replace(before, after);
}

let engine = fs.readFileSync(enginePath, 'utf8');

engine = replaceOnce(
  engine,
  `  const eventCountByPlayers = { 1:4, 2:6, 3:7, 4:8, 5:9, 6:10, 7:11 };\n  const numEventCards = eventCountByPlayers[numPlayers] ?? EVENT_CARDS.length;\n  const { cardPrefs = {} } = cfg;\n  const eventCards  = selectByPriority(EVENT_CARDS, cardPrefs, numEventCards);`,
  `  const eventCountByPlayers = { 1:4, 2:6, 3:7, 4:8, 5:9, 6:10, 7:11 };\n  const baseEventCards = eventCountByPlayers[numPlayers] ?? EVENT_CARDS.length;\n  const extraEventCards = Math.max(0, boons['extra-event'] || 0);\n  const numEventCards = Math.min(EVENT_CARDS.length, baseEventCards + extraEventCards);\n  const { cardPrefs = {} } = cfg;\n  const eventCards  = selectByPriority(EVENT_CARDS, cardPrefs, numEventCards);`,
  'extra event cards'
);

engine = replaceOnce(
  engine,
  `    hope: 6,\n    maxHope: 8,`,
  `    hope: 6 + Math.max(0, boons['more-hope'] || 0),\n    maxHope: 8 + Math.max(0, boons['more-hope'] || 0),`,
  'more hope'
);

engine = replaceOnce(
  engine,
  `    troopSupply: {\n      dwarven:  Math.max(0, 5 - (troopReserved.dwarven  || 0)),\n      elven:    Math.max(0, 5 - (troopReserved.elven    || 0)),\n      rohirrim: Math.max(0, 5 - (troopReserved.rohirrim || 0)),\n      gondor:   Math.max(0, 5 - (troopReserved.gondor   || 0)),\n    },\n    shadowSupply: 45 - 18 - (9 + extraSetupDraws), // 45 total minus normal+extra setup draws`,
  `    troopSupply: {\n      dwarven:  Math.max(0, 5 - (troopReserved.dwarven  || 0) + Math.max(0, boons['dwarf-troop']  || 0)),\n      elven:    Math.max(0, 5 - (troopReserved.elven    || 0) + Math.max(0, boons['elf-troop']    || 0)),\n      rohirrim: Math.max(0, 5 - (troopReserved.rohirrim || 0) + Math.max(0, boons['rohan-troop']  || 0)),\n      gondor:   Math.max(0, 5 - (troopReserved.gondor   || 0) + Math.max(0, boons['gondor-troop'] || 0)),\n    },\n    shadowSupply: Math.max(0, 45 - 18 - (9 + extraSetupDraws) - Math.max(0, boons['shadow-troop'] || 0)), // legacy boon removes reserve troops`,
  'troop reserve boons'
);

engine = replaceOnce(
  engine,
  `    freeLtBoons: boons,        // which free lt boons are purchased (id → count)\n    freeLtState: {},           // per-lt state: { active, location }`,
  `    freeLtBoons: boons,        // purchased Legacy boons (id → count)\n    legacyReshufflesLeft: Math.max(0, boons.reshuffle || 0),\n    freeLtState: {},           // per-lt state: { active, location }`,
  'reshuffle state'
);

engine = replaceOnce(
  engine,
  `    if (G.playerDeck.length === 0) {\n      loseHope(1, 'Player deck empty');\n      continue;\n    }`,
  `    if (G.playerDeck.length === 0) {\n      if ((G.legacyReshufflesLeft || 0) > 0 && G.playerDiscard.length > 0) {\n        G.playerDeck = shuffle(G.playerDiscard);\n        G.playerDiscard = [];\n        G.legacyReshufflesLeft--;\n        addLog(\`Legacy boon: player discard reshuffled into a new deck (\${G.legacyReshufflesLeft} reshuffle(s) left).\`);\n      }\n      if (G.playerDeck.length === 0) {\n        loseHope(1, 'Player deck empty');\n        continue;\n      }\n    }`,
  'player deck reshuffle boon'
);

fs.writeFileSync(enginePath, engine);

let tests = fs.readFileSync(testsPath, 'utf8');
tests = replaceOnce(
  tests,
  `function makeContext() {\n  const sandbox = {\n    console,\n    Math,`,
  `function makeContext() {\n  let seed = 0x5eed1234;\n  const testMath = Object.create(Math);\n  testMath.random = () => {\n    seed = (1664525 * seed + 1013904223) >>> 0;\n    return seed / 0x100000000;\n  };\n  const sandbox = {\n    console,\n    Math: testMath,`,
  'seeded regression RNG'
);

const testAnchor = `test('map connections only reference known locations', () => {`;
const newTests = `test('straightforward Legacy boons change starting game state', () => {\n  const baseCtx = makeContext();\n  const base = startGame(baseCtx, {\n    numPlayers: 1, playerNames: ['Base'], charAssignment: [['frodo-sam', 'aragorn']],\n    difficulty: 'standard', cardPrefs: {}, boons: {},\n  });\n\n  const boonCtx = makeContext();\n  const boosted = startGame(boonCtx, {\n    numPlayers: 1, playerNames: ['Boosted'], charAssignment: [['frodo-sam', 'aragorn']],\n    difficulty: 'standard', cardPrefs: {},\n    boons: { 'extra-event': 1, 'gondor-troop': 1, 'elf-troop': 1, 'dwarf-troop': 1, 'rohan-troop': 1, 'shadow-troop': 1, 'more-hope': 1, reshuffle: 1 },\n  });\n\n  assert.equal(boosted.hope, base.hope + 1);\n  assert.equal(boosted.maxHope, base.maxHope + 1);\n  assert.equal(boosted.troopSupply.gondor, base.troopSupply.gondor + 1);\n  assert.equal(boosted.troopSupply.elven, base.troopSupply.elven + 1);\n  assert.equal(boosted.troopSupply.dwarven, base.troopSupply.dwarven + 1);\n  assert.equal(boosted.troopSupply.rohirrim, base.troopSupply.rohirrim + 1);\n  assert.equal(boosted.shadowSupply, base.shadowSupply - 1);\n  assert.equal(boosted.legacyReshufflesLeft, 1);\n  assert.equal(boosted.unusedEventCards.length, base.unusedEventCards.length - 1);\n});\n\ntest('Legacy reshuffle is consumed before empty-deck hope loss', () => {\n  const ctx = makeContext();\n  startGame(ctx, {\n    numPlayers: 1, playerNames: ['Tester'], charAssignment: [['frodo-sam', 'aragorn']],\n    difficulty: 'standard', cardPrefs: {}, boons: { reshuffle: 1 },\n  });\n  vm.runInContext(\`\n    G.playerDeck = [];\n    G.playerDiscard = [{ id:'recycle-1', name:'Recycle One', type:'region', symbol:'valor' }, { id:'recycle-2', name:'Recycle Two', type:'region', symbol:'stealth' }];\n    G.players[0].hand = [];\n    G.phase = 'draw-player';\n  \`, ctx);\n  const beforeHope = evalIn(ctx, 'G.hope');\n  vm.runInContext('drawPlayerCards()', ctx);\n  assert.equal(evalIn(ctx, 'G.legacyReshufflesLeft'), 0);\n  assert.equal(evalIn(ctx, 'G.hope'), beforeHope);\n  assert.equal(evalIn(ctx, 'G.players[0].hand.length'), 2);\n});\n\n`;
if (!tests.includes("test('straightforward Legacy boons change starting game state'")) {
  if (!tests.includes(testAnchor)) throw new Error('Regression insertion anchor not found');
  tests = tests.replace(testAnchor, newTests + testAnchor);
}
fs.writeFileSync(testsPath, tests);

console.log('Legacy boon wiring patch applied.');
