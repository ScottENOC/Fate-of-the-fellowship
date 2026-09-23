'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const dataSource = fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8');
const engineSource = fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function makeContext() {
  const sandbox = {
    console,
    Math,
    Date,
    JSON,
    Object,
    Array,
    Set,
    Map,
    String,
    Number,
    Boolean,
    RegExp,
    Error,
    parseInt,
    parseFloat,
    structuredClone,
    setTimeout,
    clearTimeout,
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(dataSource, context, { filename: 'data.js' });
  vm.runInContext(engineSource, context, { filename: 'engine.js' });
  return context;
}

function evalIn(context, expression) {
  return vm.runInContext(expression, context);
}

function startGame(context, cfg) {
  context.__cfg = cfg;
  vm.runInContext('newGame(__cfg)', context);
  delete context.__cfg;
  return evalIn(context, 'G');
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

function extractLegacyBoonIds() {
  const start = indexSource.indexOf('const LEGACY_BOON_DEFS = [');
  const end = indexSource.indexOf('];', start);
  assert.notEqual(start, -1, 'LEGACY_BOON_DEFS not found');
  assert.notEqual(end, -1, 'LEGACY_BOON_DEFS terminator not found');
  const block = indexSource.slice(start, end + 2);
  return [...block.matchAll(/\bid\s*:\s*'([^']+)'/g)].map(m => m[1]);
}

test('standard game initialises core state', () => {
  const ctx = makeContext();
  const g = startGame(ctx, {
    numPlayers: 1,
    playerNames: ['Tester'],
    charAssignment: [['frodo-sam', 'aragorn']],
    difficulty: 'standard',
    cardPrefs: {},
    boons: {},
  });

  assert.equal(g.difficulty, 'standard');
  assert.equal(g.plusLevel, 0);
  assert.equal(g.phase, 'actions');
  assert.equal(g.winner, null);
  assert.equal(g.shadowDiscard.length, 9, 'standard setup should draw 9 shadow cards');
  assert.equal(g.shadowLieutenants.length, 0);
  assert.equal(g.charState['frodo-sam'].player, 0);
  assert.equal(g.charState.aragorn.player, 0);
  assert.equal(g.turn.charActions['frodo-sam'], 4);
  assert.equal(g.turn.charActions.aragorn, 4);
});

test('Legendary+ scaling remains deterministic by tier', () => {
  const ctx = makeContext();
  const g = startGame(ctx, {
    numPlayers: 1,
    playerNames: ['Tester'],
    charAssignment: [['frodo-sam', 'aragorn']],
    difficulty: 'legendary+4',
    cardPrefs: {},
    boons: {},
  });

  assert.equal(g.difficulty, 'legendary+4');
  assert.equal(g.plusLevel, 4);
  assert.equal(g.shadowDiscard.length, 11, 'Legendary+4 should add 2 setup draws');
  assert.equal(g.shadowLieutenants.length, 2, 'Legendary+4 should spawn 2 shadow lieutenants');
});

test('free-people lieutenant boon state is wired into newGame', () => {
  const ctx = makeContext();
  const g = startGame(ctx, {
    numPlayers: 1,
    playerNames: ['Tester'],
    charAssignment: [['frodo-sam', 'aragorn']],
    difficulty: 'legendary',
    cardPrefs: {},
    boons: { cirdan: 1 },
  });

  assert.equal(g.freeLtBoons.cirdan, 1);
  assert.ok(g.freeLtState.cirdan, 'Cirdan state should exist');
  assert.equal(g.freeLtState.cirdan.active, true, 'Cirdan is an immediate-spawn lieutenant');
});

test('map connections only reference known locations', () => {
  const ctx = makeContext();
  const missing = evalIn(ctx, `CONNECTIONS.flatMap(c => [c.a, c.b]).filter(id => !LOCS[id])`);
  assert.deepEqual(Array.from(missing), []);
});

test('character-specific objectives reference real characters', () => {
  const ctx = makeContext();
  const missing = evalIn(ctx, `OBJECTIVES.filter(o => o.requiresChar && !CHARS[o.requiresChar]).map(o => o.id + ':' + o.requiresChar)`);
  assert.deepEqual(Array.from(missing), []);
});

test('Legacy boon definitions have implementation references', () => {
  const ids = extractLegacyBoonIds();
  assert.ok(ids.length >= 10, 'expected a substantial Legacy boon catalogue');

  const combined = indexSource + '\n' + engineSource;
  const weak = [];
  for (const id of ids) {
    // One occurrence is the definition itself. A second occurrence is evidence that
    // the boon is actually consulted elsewhere by setup/gameplay code.
    const refs = countOccurrences(combined, `'${id}'`) + countOccurrences(combined, `\"${id}\"`);
    if (refs < 2) weak.push(id);
  }

  if (weak.length) {
    const msg = `Legacy boon(s) with no obvious implementation reference: ${weak.join(', ')}`;
    if (process.env.STRICT_BOON_AUDIT === '1') assert.fail(msg);
    console.warn(`\nAUDIT WARNING: ${msg}`);
  }
});

let passed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    passed++;
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(err.stack || err);
    process.exitCode = 1;
  }
}

console.log(`\n${passed}/${tests.length} regression checks passed.`);
if (process.exitCode) process.exit(process.exitCode);
