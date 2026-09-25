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
  let seed = 0x5eed1234;
  const testMath = Object.create(Math);
  testMath.random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  const sandbox = {
    console,
    Math: testMath,
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
  assert.equal(g.shadowDiscard.length, 11, 'standard setup should draw 9 ordinary shadow cards and seed 2 specials in discard');
  assert.equal(g.shadowDeck.length, 39, '48 ordinary cards minus 9 setup draws should leave 39');
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
  assert.equal(g.shadowDiscard.length, 13, 'Legendary+4 should have 11 setup draws plus 2 seeded specials');
  assert.equal(g.shadowLieutenants.length, 2, 'Legendary+4 should spawn 2 shadow lieutenants');
});

test('reconstructed Shadow deck has 48 ordinary cards split evenly by back', () => {
  const ctx=makeContext();
  assert.equal(evalIn(ctx,'NORMAL_SHADOW_CARDS.length'),48);
  assert.equal(evalIn(ctx,"NORMAL_SHADOW_CARDS.filter(c=>c.back==='red').length"),24);
  assert.equal(evalIn(ctx,"NORMAL_SHADOW_CARDS.filter(c=>c.back==='black').length"),24);
  assert.equal(evalIn(ctx,'SPECIAL_SHADOW_CARDS.length'),2);
  assert.equal(evalIn(ctx,"SPECIAL_SHADOW_CARDS.find(c=>c.effect==='drums').back"),'black');
  assert.equal(evalIn(ctx,"SPECIAL_SHADOW_CARDS.find(c=>c.effect==='wheels').back"),'red');
});

test('standard setup seeds two specials in discard and leaves 39 ordinary cards', () => {
  const ctx=makeContext(); const g=startGame(ctx,{numPlayers:1,playerNames:['Tester'],charAssignment:[['frodo-sam','aragorn']],difficulty:'standard',cardPrefs:{},boons:{}});
  assert.equal(g.shadowDeck.filter(c=>c.type==='special-shadow').length,0);
  assert.deepEqual(Array.from(g.shadowDiscard.filter(c=>c.type==='special-shadow').map(c=>c.effect).sort()),['drums','wheels']);
  assert.equal(g.shadowDeck.length,39); assert.equal(g.shadowSupply,21);
});

test('newly exposed Shadow-card back selects advance versus reinforce', () => {
  const ctx=makeContext(); startGame(ctx,{numPlayers:1,playerNames:['Tester'],charAssignment:[['frodo-sam','aragorn']],difficulty:'standard',cardPrefs:{},boons:{}});
  vm.runInContext("G.phase='draw-shadow';G.threatRate=1;Object.values(G.locState).forEach(ls=>ls.shadowTroops=0);G.locState.isengard.shadowTroops=1;__drawn={...NORMAL_SHADOW_CARDS.find(c=>c.location==='isengard'&&c.lineId==='orange-b')};__selector={...NORMAL_SHADOW_CARDS.find(c=>c.back==='red')};G.shadowDeck=[__selector,__drawn];G.shadowDiscard=[];drawShadowCards();",ctx);
  assert.equal(evalIn(ctx,'G.locState.isengard.shadowTroops'),0); assert.equal(evalIn(ctx,"G.locState['fords-of-isen'].shadowTroops"),1);
  const ctx2=makeContext(); startGame(ctx2,{numPlayers:1,playerNames:['Tester'],charAssignment:[['frodo-sam','aragorn']],difficulty:'standard',cardPrefs:{},boons:{}});
  vm.runInContext("G.phase='draw-shadow';G.threatRate=1;G.shadowSupply=10;Object.values(G.locState).forEach(ls=>ls.shadowTroops=0);__drawn={...NORMAL_SHADOW_CARDS.find(c=>c.location==='isengard'&&c.lineId==='orange-b')};__selector={...NORMAL_SHADOW_CARDS.find(c=>c.back==='black')};G.shadowDeck=[__selector,__drawn];G.shadowDiscard=[];drawShadowCards();",ctx2);
  assert.equal(evalIn(ctx2,'G.locState.isengard.shadowTroops'),1);
});

test('Dunland reconstructed routes use purple, yellow and orange', () => {
  const ctx=makeContext();
  const rows=evalIn(ctx,"NORMAL_SHADOW_CARDS.filter(c=>c.location==='dunland').map(c=>c.lineColor).sort()");
  assert.deepEqual(Array.from(rows),['orange','purple','yellow']);
});

test('Fangorn and Edoras have a white player-only connection', () => {
  const ctx=makeContext();
  assert.equal(evalIn(ctx,"CONNECTIONS.some(c=>((c.a==='fangorn'&&c.b==='edoras')||(c.a==='edoras'&&c.b==='fangorn'))&&c.type==='normal')"),true);
  assert.equal(evalIn(ctx,"BATTLE_LINES.some(bl=>bl.locs.some((x,i)=>x==='fangorn'&&bl.locs[i+1]==='edoras'))"),false);
});

test('clarified Shadow extras include Udun yellow and omit Udun green', () => {
  const ctx=makeContext();
  assert.equal(evalIn(ctx,"NORMAL_SHADOW_CARDS.some(c=>c.location==='udun'&&c.lineColor==='yellow')"),true);
  assert.equal(evalIn(ctx,"NORMAL_SHADOW_CARDS.some(c=>c.location==='udun'&&c.lineColor==='green')"),false);
});

test('Drums of War dynamically reinforces current Mordor Shadow strongholds', () => {
  const ctx=makeContext();startGame(ctx,{numPlayers:1,playerNames:['Tester'],charAssignment:[['frodo-sam','aragorn']],difficulty:'standard',cardPrefs:{},boons:{}});
  vm.runInContext("G.locState.udun.shadowTroops=0;G.locState['barad-dur'].shadowTroops=0;G.locState['minas-morgul'].shadowTroops=0;G.locState['barad-dur'].isShadowStronghold=false;G.shadowSupply=10;resolveSpecialShadow(SPECIAL_SHADOW_CARDS.find(c=>c.effect==='drums'));",ctx);
  assert.equal(evalIn(ctx,'G.locState.udun.shadowTroops'),1);
  assert.equal(evalIn(ctx,"G.locState['minas-morgul'].shadowTroops"),1);
  assert.equal(evalIn(ctx,"G.locState['barad-dur'].shadowTroops"),0);
});

test('Wheels of Saruman allows legal hope, troop, and mixed resource choices', () => {
  const ctx=makeContext();startGame(ctx,{numPlayers:1,playerNames:['Tester'],charAssignment:[['frodo-sam','aragorn']],difficulty:'standard',cardPrefs:{},boons:{}});
  vm.runInContext("G.ui.pendingWheels=true;__h=G.hope;__r=resolveWheelsOfSaruman('hope')",ctx);assert.equal(evalIn(ctx,'__r.ok'),true);assert.equal(evalIn(ctx,'G.hope'),evalIn(ctx,'__h')-1);
  vm.runInContext("G.phase='actions';G.ui.pendingWheels=true;G.locState['minas-tirith'].friendly.gondor=2;__r2=resolveWheelsOfSaruman('troops',{picks:[{locId:'minas-tirith',type:'gondor'},{locId:'minas-tirith',type:'gondor'}]})",ctx);assert.equal(evalIn(ctx,'__r2.ok'),true);assert.equal(evalIn(ctx,"G.locState['minas-tirith'].friendly.gondor"),0);
  vm.runInContext("G.ui.pendingWheels=true;G.players[0].tokens.valor=1;G.players[0].hand=[{id:'x',name:'X'}];G.playerDiscard=[];__r3=resolveWheelsOfSaruman('resources',{cardIds:['x'],tokenCounts:{valor:1}})",ctx);assert.equal(evalIn(ctx,'__r3.ok'),true);assert.equal(evalIn(ctx,'G.players[0].hand.length'),0);assert.equal(evalIn(ctx,'G.players[0].tokens.valor'),0);
});

test('Wheels hides impossible consequences in the UI', () => {
  assert.ok(indexSource.includes("if(wheelsFriendlyTroopCount()>=2)"));
  assert.ok(indexSource.includes("if(wheelsDiscardableCount()>=2)"));
  assert.ok(indexSource.includes("buttons.push({label:'Lose 1 Hope'"));
});

test('Shadow third effects preserve known cards and balance unknowns 16/16/16', () => {
  const ctx=makeContext();
  assert.equal(evalIn(ctx,"NORMAL_SHADOW_CARDS.filter(c=>shadowOrderFamily(c.specialOrder)==='eye').length"),16);
  assert.equal(evalIn(ctx,"NORMAL_SHADOW_CARDS.filter(c=>shadowOrderFamily(c.specialOrder)==='move').length"),16);
  assert.equal(evalIn(ctx,"NORMAL_SHADOW_CARDS.filter(c=>shadowOrderFamily(c.specialOrder)==='deploy').length"),16);
  assert.equal(evalIn(ctx,"NORMAL_SHADOW_CARDS.filter(c=>c.orderKnown).length"),12);
  assert.equal(evalIn(ctx,"KNOWN_SHADOW_ORDER_SEQUENCES['moria-teal'][0]"),'search');
  assert.equal(evalIn(ctx,"KNOWN_SHADOW_ORDER_SEQUENCES['dol-guldur-yellow'][0]"),'move-closest');
  assert.equal(evalIn(ctx,"KNOWN_SHADOW_ORDER_SEQUENCES['dunland-purple-extra'][0]"),'search');
  assert.equal(evalIn(ctx,"KNOWN_SHADOW_ORDER_SEQUENCES['dol-guldur-teal'][0]"),'move-closest');
  assert.equal(evalIn(ctx,"KNOWN_SHADOW_ORDER_SEQUENCES['rhun-pink'][0]"),'deploy-recall');
  assert.equal(evalIn(ctx,"KNOWN_SHADOW_ORDER_SEQUENCES['moria-green'][0]"),'deploy-recall');
  assert.equal(evalIn(ctx,"KNOWN_SHADOW_ORDER_SEQUENCES['nurn-yellow'][0]"),'move-closest');
  assert.equal(evalIn(ctx,"KNOWN_SHADOW_ORDER_SEQUENCES['nurn-purple'][0]"),'search');
  assert.deepEqual(Array.from(evalIn(ctx,"KNOWN_SHADOW_ORDER_SEQUENCES['umbar-orange']")),['deploy-recall','eye-to-frodo']);
  assert.equal(evalIn(ctx,"KNOWN_SHADOW_ORDER_SEQUENCES['isengard-orange'][0]"),'eye-to-frodo');
  assert.equal(evalIn(ctx,"KNOWN_SHADOW_ORDER_SEQUENCES['umbar-purple'][0]"),'move-2-nazgul');
});

test('two newly identified Event cards are catalogued', () => {
  const ctx=makeContext();
  assert.equal(evalIn(ctx,"EVENT_CARDS.length"),8);
  assert.equal(evalIn(ctx,"EVENT_CARDS.find(c=>c.effect==='red-arrow').name"),'The Red Arrow');
  assert.equal(evalIn(ctx,"EVENT_CARDS.find(c=>c.effect==='palantir').name"),'Gaze into a Palantír');
});

test('The Red Arrow moves 1-3 troops between havens and optional battle shifts Eye', () => {
  const ctx=makeContext();startGame(ctx,{numPlayers:1,playerNames:['Tester'],charAssignment:[['frodo-sam','aragorn']],difficulty:'standard',cardPrefs:{},boons:{}});
  vm.runInContext("G.players[0].hand.push({...EVENT_CARDS.find(c=>c.effect==='red-arrow')});G.locState['the-shire'].friendly.elven=2;G.locState.rivendell.friendly.elven=0;G.locState.rivendell.shadowTroops=0;playEvent('ev6',{fromLocId:'the-shire',toLocId:'rivendell',picks:['elven','elven'],battle:true});",ctx);
  assert.equal(evalIn(ctx,"G.locState['the-shire'].friendly.elven"),0);
  assert.equal(evalIn(ctx,"G.locState.rivendell.friendly.elven"),2);
  assert.equal(evalIn(ctx,"G.eyeRegion"),'rhudaur');
});

test('Gaze into a Palantir shifts Eye and moves selected Nazgul', () => {
  const ctx=makeContext();startGame(ctx,{numPlayers:1,playerNames:['Tester'],charAssignment:[['frodo-sam','aragorn']],difficulty:'standard',cardPrefs:{},boons:{}});
  vm.runInContext("G.players[0].hand.push({...EVENT_CARDS.find(c=>c.effect==='palantir')});G.nazgul={eriador:2,rhudaur:1,'misty-mountains':1,gondor:1,mordor:4};playEvent('ev7',{charId:'aragorn',nazgulOrigins:['eriador','mordor','mordor']});",ctx);
  assert.equal(evalIn(ctx,"G.eyeRegion"),'rhudaur');
  assert.equal(evalIn(ctx,"G.nazgul.rhudaur"),4);
  assert.equal(evalIn(ctx,"G.nazgul.eriador"),1);
  assert.equal(evalIn(ctx,"G.nazgul.mordor"),2);
});

test('Shadow Burdens are tier-gated, unique and modify setup state', () => {
  const baseCtx = makeContext();
  const base = startGame(baseCtx, { numPlayers:1, playerNames:['Base'], charAssignment:[['frodo-sam','aragorn']], difficulty:'legendary+5', cardPrefs:{}, boons:{}, shadowBurdens:[] });
  const ctx = makeContext();
  const g = startGame(ctx, { numPlayers:1, playerNames:['Burdened'], charAssignment:[['frodo-sam','aragorn']], difficulty:'legendary+5', cardPrefs:{}, boons:{}, shadowBurdens:['war-in-rohan','hope-wanes','darkening-skies'] });
  assert.deepEqual(Array.from(g.shadowBurdens), ['war-in-rohan','hope-wanes']);
  assert.equal(g.hope, base.hope - 1);
  assert.equal(g.maxHope, base.maxHope - 1);
  assert.equal(g.locState.isengard.shadowTroops, base.locState.isengard.shadowTroops + 1);
  assert.equal(g.locState['fords-of-isen'].shadowTroops, base.locState['fords-of-isen'].shadowTroops + 1);
  assert.equal(g.shadowSupply, base.shadowSupply - 2);
});

test('Darkening Skies burden adds one setup draw when a burden slot exists', () => {
  const baseCtx = makeContext();
  const base = startGame(baseCtx, { numPlayers:1, playerNames:['Base'], charAssignment:[['frodo-sam','aragorn']], difficulty:'legendary+2', cardPrefs:{}, boons:{}, shadowBurdens:[] });
  const ctx = makeContext();
  const g = startGame(ctx, { numPlayers:1, playerNames:['Dark'], charAssignment:[['frodo-sam','aragorn']], difficulty:'legendary+2', cardPrefs:{}, boons:{}, shadowBurdens:['darkening-skies'] });
  assert.equal(g.shadowDiscard.length, base.shadowDiscard.length + 1);
});

test('old save migration supplies an empty Shadow Burden list', () => {
  const ctx = makeContext();
  ctx.__old = { saveVersion:2, players:[], currentPlayer:0 };
  vm.runInContext('__m = migrateGameState(__old)', ctx);
  assert.deepEqual(Array.from(evalIn(ctx, '__m.shadowBurdens')), []);
  assert.equal(evalIn(ctx, '__m.saveVersion'), evalIn(ctx, 'GAME_STATE_VERSION'));
});

test('Shadow Burden setup UI is wired into local and cloud game creation', () => {
  assert.ok(indexSource.includes('function buildShadowBurdenChoices()'));
  assert.ok(indexSource.includes('const shadowBurdens = getSelectedShadowBurdens();'));
  assert.ok(indexSource.includes('settings: { difficulty, cardPrefs, boons, legacySetup, shadowBurdens, selectedObjectiveIds }'));
});

test('The Nine Ride redistributes an existing Nazgul instead of creating a tenth', () => {
  const ctx = makeContext();
  const g = startGame(ctx, { numPlayers:1, playerNames:['Tester'], charAssignment:[['frodo-sam','aragorn']], difficulty:'legendary+2', cardPrefs:{}, boons:{}, shadowBurdens:['nine-ride'] });
  assert.equal(Object.values(g.nazgul).reduce((a,b)=>a+b,0), 9);
  assert.equal(g.nazgul.mordor, 3);
  assert.equal(g.nazgul.rhudaur, 2);
});

test('roguelike history and evolving burden offers are wired into the UI', () => {
  assert.ok(indexSource.includes("const ROGUE_HISTORY_KEY = 'fof-rogue-history';"));
  assert.ok(indexSource.includes('function recordRoguelikeRunIfNeeded()'));
  assert.ok(indexSource.includes('function getBurdenOfferIds(difficulty)'));
  assert.ok(indexSource.includes('offers rotate toward less-used burdens'));
  assert.ok(indexSource.includes('showCampaignChronicle()'));
});

test('save migration adds the roguelike run-record marker', () => {
  const ctx = makeContext();
  startGame(ctx, { numPlayers:1, playerNames:['Old'], charAssignment:[['frodo-sam','aragorn']], difficulty:'legendary+2', cardPrefs:{}, boons:{}, shadowBurdens:[] });
  vm.runInContext('delete G.rogueRunRecorded; __rr = migrateGameState(G)', ctx);
  assert.equal(evalIn(ctx, '__rr.rogueRunRecorded'), false);
});




test('active location objectives render as tappable map markers', () => {
  assert.ok(indexSource.includes('id="objective-layer"'));
  assert.ok(indexSource.includes('function objectiveMapLocations(obj)'));
  assert.ok(indexSource.includes('function renderObjectiveMarkers()'));
  assert.ok(indexSource.includes("'destroy-ring':['mount-doom']"));
  assert.ok(indexSource.includes("'secure-osgiliath':['osgiliath']"));
  assert.ok(indexSource.includes("obj.id === 'oathbreakers-duty'"));
  assert.ok(indexSource.includes("class:'objective-marker'"));
  assert.ok(indexSource.includes('showObjectiveDetails(objs[0])'));
});

test('current player characters have persistent map highlight', () => {
  assert.ok(indexSource.includes("if (isCurrentPlayer) {"));
  assert.ok(indexSource.includes("stroke:'#c8a050','stroke-width':0.45,opacity:0.88"));
  assert.ok(indexSource.includes("stroke:isCurrentPlayer?'#f0d080':'#00000088'"));
  assert.ok(indexSource.includes("r:2.25,fill:'none',stroke:'#ffffff'"));
});

test('compact portrait hand wiring is present', () => {
  assert.ok(indexSource.includes('grid-template-columns:repeat(auto-fit,minmax(132px,1fr))'));
  assert.ok(indexSource.includes('.card-item{padding:6px 8px;min-height:40px;font-size:.74em;justify-content:flex-start;gap:6px;line-height:1.15;overflow:hidden}'));
});

test('compact iPhone drawer and touch Nazgul wiring are present', () => {
  assert.ok(indexSource.includes('grid-template-columns:repeat(auto-fit,minmax(118px,1fr))'));
  assert.ok(indexSource.includes('grid-template-columns:repeat(3,minmax(0,1fr))'));
  assert.ok(indexSource.includes('function showNazgulDistribution()'));
  assert.ok(indexSource.includes("g.onclick = e => { e.stopPropagation(); showNazgulDistribution(); };"));
  assert.ok(!indexSource.includes('id="nazgul-row"'));
  assert.ok(indexSource.includes('#action-hint{min-height:0!important;margin-bottom:1px!important;line-height:1.15}'));
});

test('iPhone map-first UI wiring is present', () => {
  assert.ok(indexSource.includes('id="mobile-status-hud"'));
  assert.ok(indexSource.includes('height:min(52dvh,480px)'));
  assert.ok(indexSource.includes('function visibleMapViewportHeight(panel)'));
  assert.ok(indexSource.includes("h -= sidebar.getBoundingClientRect().height;"));
  assert.ok(indexSource.includes("if ((a.key === 'muster' || a.key === 'capture') && !a.ok) continue;"));
  assert.ok(indexSource.includes('id="action-footer"'));
  assert.ok(indexSource.includes('env(safe-area-inset-bottom)'));
  assert.ok(indexSource.includes('function showLocationDetails(locId)'));
  assert.ok(indexSource.includes('function explainUnavailableAction(label, tip)'));
  assert.ok(indexSource.includes("buttons.slice(0,4).join('')"));
  assert.ok(indexSource.includes("class:'touch-hit'"));
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

test('straightforward Legacy boons change starting game state', () => {
  const baseCtx = makeContext();
  const base = startGame(baseCtx, {
    numPlayers: 1, playerNames: ['Base'], charAssignment: [['frodo-sam', 'aragorn']],
    difficulty: 'standard', cardPrefs: {}, boons: {},
  });

  const boonCtx = makeContext();
  const boosted = startGame(boonCtx, {
    numPlayers: 1, playerNames: ['Boosted'], charAssignment: [['frodo-sam', 'aragorn']],
    difficulty: 'standard', cardPrefs: {},
    boons: { 'extra-event': 1, 'gondor-troop': 1, 'elf-troop': 1, 'dwarf-troop': 1, 'rohan-troop': 1, 'shadow-troop': 1, 'more-hope': 1, reshuffle: 1 },
  });

  assert.equal(boosted.hope, base.hope + 1);
  assert.equal(boosted.maxHope, base.maxHope + 1);
  assert.equal(boosted.troopSupply.gondor, base.troopSupply.gondor + 1);
  assert.equal(boosted.troopSupply.elven, base.troopSupply.elven + 1);
  assert.equal(boosted.troopSupply.dwarven, base.troopSupply.dwarven + 1);
  assert.equal(boosted.troopSupply.rohirrim, base.troopSupply.rohirrim + 1);
  assert.equal(boosted.shadowSupply, base.shadowSupply - 1);
  assert.equal(boosted.legacyReshufflesLeft, 1);
  assert.equal(boosted.unusedEventCards.length, base.unusedEventCards.length - 1);
});

test('setup-choice Legacy boons apply explicit character, token and troop choices', () => {
  const ctx = makeContext();
  const g = startGame(ctx, {
    numPlayers: 2, playerNames: ['One','Two'], charAssignment: [['frodo-sam','aragorn'], ['legolas','gimli']],
    difficulty: 'standard', cardPrefs: {},
    boons: { 'extra-char': 1, 'start-token': 2, 'deploy-troop': 1 },
    legacySetup: {
      extraCharacters: [{ playerIdx: 1, charId: 'eowyn' }],
      startTokens: ['valor','stealth'],
      deployTroops: [{ type:'gondor', locId:'minas-tirith' }],
    },
  });
  assert.ok(g.players[1].chars.includes('eowyn'));
  assert.equal(g.charState.eowyn.player, 1);
  assert.equal(g.players[0].tokens.valor, 1);
  assert.equal(g.players[1].tokens.valor, 1);
  assert.equal(g.players[0].tokens.stealth, 1);
  assert.equal(g.players[1].tokens.stealth, 1);
  assert.equal(g.locState['minas-tirith'].friendly.gondor, 3);
});

test('setup-choice Legacy boon limits and deployment legality are enforced', () => {
  const ctx = makeContext();
  const g = startGame(ctx, {
    numPlayers: 1, playerNames: ['One'], charAssignment: [['frodo-sam','aragorn']],
    difficulty: 'standard', cardPrefs: {},
    boons: { 'extra-char': 1, 'start-token': 1, 'deploy-troop': 1 },
    legacySetup: {
      extraCharacters: [{ playerIdx:0, charId:'eowyn' }, { playerIdx:0, charId:'gimli' }],
      startTokens: ['friendship','valor'],
      deployTroops: [{ type:'elven', locId:'nurn' }, { type:'elven', locId:'rivendell' }],
    },
  });
  assert.ok(g.players[0].chars.includes('eowyn'));
  assert.ok(!g.players[0].chars.includes('gimli'));
  assert.equal(g.players[0].tokens.friendship, 1);
  assert.equal(g.players[0].tokens.valor, 0);
  assert.equal(g.locState.nurn.friendly.elven, 0, 'illegal deployment should be ignored');
});

test('Legacy reshuffle is consumed before empty-deck hope loss', () => {
  const ctx = makeContext();
  startGame(ctx, {
    numPlayers: 1, playerNames: ['Tester'], charAssignment: [['frodo-sam', 'aragorn']],
    difficulty: 'standard', cardPrefs: {}, boons: { reshuffle: 1 },
  });
  vm.runInContext(`
    G.playerDeck = [];
    G.playerDiscard = [{ id:'recycle-1', name:'Recycle One', type:'region', symbol:'valor' }, { id:'recycle-2', name:'Recycle Two', type:'region', symbol:'stealth' }];
    G.players[0].hand = [];
    G.phase = 'draw-player';
  `, ctx);
  const beforeHope = evalIn(ctx, 'G.hope');
  vm.runInContext('drawPlayerCards()', ctx);
  assert.equal(evalIn(ctx, 'G.legacyReshufflesLeft'), 0);
  assert.equal(evalIn(ctx, 'G.hope'), beforeHope);
  assert.equal(evalIn(ctx, 'G.players[0].hand.length'), 2);
});

test('old save states migrate additively to the current schema', () => {
  const ctx = makeContext();
  startGame(ctx, { numPlayers:1, playerNames:['Old'], charAssignment:[['frodo-sam','aragorn']], difficulty:'standard', cardPrefs:{}, boons:{} });
  vm.runInContext(`
    __old = JSON.parse(JSON.stringify(G));
    delete __old.saveVersion;
    delete __old.legacySetup;
    delete __old.legacyReshufflesLeft;
    delete __old.freeLtBoons;
    delete __old.freeLtState;
    delete __old.turn.actionsUsed;
    delete __old.ui.freeSearchThisTurn;
    __migrated = migrateGameState(__old);
  `, ctx);
  assert.equal(evalIn(ctx, '__migrated.saveVersion'), evalIn(ctx, 'GAME_STATE_VERSION'));
  assert.ok(evalIn(ctx, '__migrated.legacySetup'));
  assert.equal(evalIn(ctx, '__migrated.legacyReshufflesLeft'), 0);
  assert.ok(evalIn(ctx, '__migrated.freeLtBoons'));
  assert.ok(evalIn(ctx, '__migrated.turn.actionsUsed'));
  assert.equal(evalIn(ctx, '__migrated.ui.freeSearchThisTurn'), false);
  assert.equal(evalIn(ctx, '__migrated.charState["frodo-sam"].location'), evalIn(ctx, 'G.charState["frodo-sam"].location'));
});

test('migration rejects saves from a newer schema version', () => {
  const ctx = makeContext();
  ctx.__future = { saveVersion: 999 };
  assert.throws(() => vm.runInContext('migrateGameState(__future)', ctx), /newer game version/);
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

test('local hot-seat UI follows the active player and lobby rendering escapes names', () => {
  assert.ok(indexSource.includes('if (!G?.playerIds) return G?.currentPlayer ?? 0;'));
  assert.ok(indexSource.includes('function escapeHtml(value)'));
  assert.ok(indexSource.includes('escapeHtml(p.name)'));
});

test('generated room codes use a longer non-confusable random suffix', () => {
  assert.ok(indexSource.includes("const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';"));
  assert.ok(indexSource.includes('new Uint8Array(6)'));
  assert.ok(indexSource.includes("suffix.slice(0,3) + '-' + suffix.slice(3)"));
});

test('UI render keeps static map layers cached and autosave debounced', () => {
  assert.ok(indexSource.includes('let mapStaticBuilt = false;'));
  assert.ok(indexSource.includes('if (!mapStaticBuilt)'));
  assert.ok(indexSource.includes('_localSaveTimer = setTimeout(saveGame, 250)'));
  assert.ok(indexSource.includes('renderMobileActionSheet()'));
  assert.ok(indexSource.includes('centerOnActiveCharacter()'));
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
