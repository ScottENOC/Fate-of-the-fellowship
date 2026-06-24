'use strict';

// ── GAME STATE ────────────────────────────────────────────────────────────────
let G = null; // the live game state

function newGame(cfg) {
  const { numPlayers, playerNames, difficulty } = cfg;
  const skiesCounts = { introductory:4, standard:5, heroic:5, epic:6, legendary:6 };
  const numSkies = skiesCounts[difficulty] || 5;

  // Build location state
  const locState = {};
  for (const id of Object.keys(LOCS)) {
    locState[id] = {
      shadowTroops: LOCS[id].startShadow,
      friendly: { dwarven:0, elven:0, rohirrim:0, gondor:0 },
      isHaven: LOCS[id].isHaven,
      isShadowStronghold: false,
    };
  }

  // Starting friendly troops (from rulebook setup)
  const friendlySetup = {
    'ered-luin':     { dwarven:1 },
    'erebor':        { dwarven:1 },
    'iron-hills':    { dwarven:1 },
    'grey-havens':   { elven:1 },
    'rivendell':     { elven:1 },
    'lorien':        { elven:1 },
    'woodland-realm':{ elven:1 },
    'helms-deep':    { rohirrim:1 },
    'edoras':        { rohirrim:1 },
    'eastemnet':     { rohirrim:1 },
    'minas-tirith':  { gondor:2 },
    'dol-amroth':    { gondor:2 },
    'pelargir':      { gondor:1 },
  };
  for (const [id, troops] of Object.entries(friendlySetup)) {
    Object.assign(locState[id].friendly, troops);
  }

  // Build character state
  const charState = {};
  for (const [id, c] of Object.entries(CHARS)) {
    charState[id] = { location: c.start, player: null, alive: true };
  }

  // Assign characters to players
  const { charAssignment } = cfg;
  const defaultAssign = [
    ['frodo-sam','legolas'],
    ['merry-pippin','eowyn'],
    ['arwen','aragorn'],
    ['gandalf','boromir'],
    ['gimli','eomer'],
    ['galadriel','faramir'],
    ['gollum'],
  ];
  const players = [];
  for (let i = 0; i < numPlayers; i++) {
    const cids = (charAssignment && charAssignment[i]) || (defaultAssign[i] || ['faramir','galadriel']);
    cids.forEach(cid => { if (charState[cid]) charState[cid].player = i; });
    players.push({
      name: playerNames[i] || `Player ${i+1}`,
      chars: cids,
      hand: [],
      tokens: { friendship:0, valor:0, stealth:0, resistance:0 },
      actionsPerChar: cids.length === 1 ? 5 : 4,
    });
  }

  // Build player deck
  const regionCards = makeRegionCards();
  const eventCountByPlayers = { 1:4, 2:6, 3:7, 4:8, 5:9, 6:10, 7:11 };
  const numEventCards = eventCountByPlayers[numPlayers] ?? EVENT_CARDS.length;
  const { cardPrefs = {} } = cfg;
  const eventCards  = selectByPriority(EVENT_CARDS, cardPrefs, numEventCards);
  const unusedEventCards = EVENT_CARDS.filter(c => !eventCards.some(e => e.id === c.id));
  let playerPool = shuffle([...regionCards, ...eventCards]);

  // Deal starting hands
  const handSizes = { 1:4, 2:4, 3:3, 4:2, 5:2, 6:1, 7:1 };
  const handSize = handSizes[numPlayers] ?? 2;
  for (const p of players) {
    for (let i = 0; i < handSize; i++) {
      if (playerPool.length) p.hand.push(playerPool.pop());
    }
  }

  // Split remainder into numSkies stacks + insert Skies Darken
  const stackCount = numSkies;
  const stackSize = Math.ceil(playerPool.length / stackCount);
  const skiesCards = SKIES_DARKEN.slice(0, numSkies);
  const stacks = [];
  for (let i = 0; i < stackCount; i++) {
    const chunk = playerPool.splice(0, stackSize);
    const sd = skiesCards[i];
    const pos = Math.floor(Math.random() * (chunk.length + 1));
    chunk.splice(pos, 0, sd);
    stacks.push(chunk);
  }
  const playerDeck = stacks.flat();

  // Pre-compute objectives (must happen before G to inform troopSupply)
  const allCharIds = players.flatMap(p => p.chars);
  const objCounts = { introductory:3, standard:3, heroic:4, epic:4, legendary:5 };
  const numOpt = objCounts[difficulty] ?? 3;
  const requiredObjs = OBJECTIVES.filter(o => o.required);
  const eligibleOptional = OBJECTIVES.filter(o => !o.required && (!o.requiresChar || allCharIds.includes(o.requiresChar)));
  const computedObjectives = [
    ...requiredObjs,
    ...selectByPriority(eligibleOptional, cardPrefs, numOpt),
  ].map(o => ({ ...o, done: false, reservedTroops: o.setupTroops || 0 }));

  const troopReserved = { dwarven:0, elven:0, rohirrim:0, gondor:0 };
  for (const obj of computedObjectives) {
    if (obj.setupTroops > 0 && obj.setupTroopType) {
      troopReserved[obj.setupTroopType] = (troopReserved[obj.setupTroopType] || 0) + obj.setupTroops;
    }
  }

  // Shadow deck — draw 9 for setup (troop placement only, no other effects)
  let shadowDeck = makeShadowDeck();
  const shadowSetupDiscard = [];
  for (let i = 0; i < 9; i++) {
    if (shadowDeck.length) {
      const card = shadowDeck.pop();
      const spawnId = card.spawnLoc || card.location;
      if (spawnId && locState[spawnId]) locState[spawnId].shadowTroops++;
      shadowSetupDiscard.push(card);
    }
  }

  G = {
    players,
    charState,
    locState,
    hope: 6,
    maxHope: 8,
    threatRate: 1,
    maxThreat: 5,
    eyeRegion: 'eriador',
    nazgul: { eriador:2, rhudaur:1, 'misty-mountains':1, gondor:1, mordor:4 },
    troopSupply: {
      dwarven:  Math.max(0, 5 - (troopReserved.dwarven  || 0)),
      elven:    Math.max(0, 5 - (troopReserved.elven    || 0)),
      rohirrim: Math.max(0, 5 - (troopReserved.rohirrim || 0)),
      gondor:   Math.max(0, 5 - (troopReserved.gondor   || 0)),
    },
    shadowSupply: 45 - 18 - 9, // approximate remaining after setup
    playerDeck,
    playerDiscard: [],
    shadowDeck,
    shadowDiscard: [...shadowSetupDiscard],
    currentPlayer: 0,
    phase: 'actions',     // 'actions' | 'draw-player' | 'draw-shadow' | 'gameover'
    winner: null,         // null | 'players' | 'shadow'
    // Per-turn tracking: each character gets 4 independent actions
    turn: makeTurn(players[0].chars, players[0].actionsPerChar),
    ui: { selectedChar: null, pendingAction: null, validTargets: [], ignoreNextOrder: false, freeSearchThisTurn: false },
    log: [],
    capturedStrongholds: [],
    objectives: computedObjectives,
    extraHavens: [],           // locations made into havens via objectives (e.g. Dunland)
    boromirRetired: false,     // true once Boromir's Honor completes
    boromirReplacementPending: false,
    boromirPlayerIdx: null,    // which player gets the replacement character
    unusedEventCards,
    skiesBuffer: [], // Skies Darken cards waiting to resolve between draws
    difficulty,
  };
  addLog(`Game started! ${numPlayers} players, ${difficulty} difficulty.`);
  return G;
}

// ── LOGGING ───────────────────────────────────────────────────────────────────
function addLog(msg) {
  G.log.unshift({ msg, time: Date.now() });
  if (G.log.length > 60) G.log.pop();
}

// ── HOPE ─────────────────────────────────────────────────────────────────────
function loseHope(n, reason) {
  G.hope = Math.max(0, G.hope - n);
  addLog(`Lost ${n} hope (${reason}). Hope: ${G.hope}`);
  if (G.hope <= 0) endGame('shadow');
}

function gainHope(n, reason) {
  if (G.hope >= G.maxHope) return;
  G.hope = Math.min(G.maxHope, G.hope + n);
  addLog(`Gained ${n} hope (${reason}). Hope: ${G.hope}`);
}

// ── END GAME ──────────────────────────────────────────────────────────────────
function endGame(winner) {
  G.phase = 'gameover';
  G.winner = winner;
  addLog(winner === 'players' ? '🎉 THE FELLOWSHIP TRIUMPHS! The Ring is destroyed!' : '💀 SAURON PREVAILS. All hope is lost.');
}

// ── SEARCH ROLL ───────────────────────────────────────────────────────────────
// Returns array of roll results and applies effects.
function rollSearch(frodoLocId) {
  const frodoChar = G.charState['frodo-sam'];
  const region = LOCS[frodoLocId].region;
  const nazgulInRegion = G.nazgul[region] || 0;
  const shadowAtDest = G.locState[frodoLocId].shadowTroops;
  let numDice = Math.min(7, nazgulInRegion + shadowAtDest);

  if (numDice === 0) {
    addLog('Search roll: no Nazgûl or shadow troops — Frodo slips by!');
    return [];
  }

  const faces = ['slip','slip','weary','weary','exposed','recall'];
  const rolls = [];
  for (let i = 0; i < numDice; i++) rolls.push(faces[Math.floor(Math.random() * 6)]);
  addLog(`Search roll (${numDice} dice): ${rolls.join(', ')}`);

  const atHaven = G.locState[frodoLocId].isHaven;
  for (const r of rolls) {
    if (r === 'slip') { /* no effect */ }
    else if (r === 'weary') loseHope(1, 'Weary (search)');
    else if (r === 'exposed') { if (!atHaven) loseHope(1, 'Exposed (search)'); }
    else if (r === 'recall') recallNazgul(region);
  }
  return rolls;
}

function recallNazgul(fromRegion) {
  if ((G.nazgul[fromRegion] || 0) > 0) {
    G.nazgul[fromRegion]--;
    G.nazgul.mordor = (G.nazgul.mordor || 0) + 1;
    addLog(`Nazgûl recalled from ${fromRegion} to Mordor.`);
  }
}

// ── BATTLE ROLL ───────────────────────────────────────────────────────────────
const BATTLE_FACES = ['rout','rout','exchange','exchange','overrun','nazgul'];

function genBattleRolls(n, maxDice = 3) {
  const count = Math.min(n, maxDice);
  return Array.from({length: count}, () => BATTLE_FACES[Math.floor(Math.random() * 6)]);
}

function applyBattleRolls(locId, rolls, charId) {
  const ls = G.locState[locId];
  const region = LOCS[locId].region;
  const nazgulPresent = (G.nazgul[region] || 0) > 0;
  const isEowyn = charId === 'eowyn';
  for (const r of rolls) {
    if (r === 'rout') {
      if (ls.shadowTroops > 0) { ls.shadowTroops--; addLog('  Rout: 1 shadow troop removed.'); }
    } else if (r === 'exchange') {
      if (ls.shadowTroops > 0) { ls.shadowTroops--; addLog('  Exchange: 1 shadow removed.'); }
      removeFriendlyTroop(locId, 1);
    } else if (r === 'overrun') {
      removeFriendlyTroop(locId, 1);
      addLog('  Overrun: 1 friendly troop removed.');
    } else if (r === 'nazgul') {
      if (isEowyn) {
        if (ls.shadowTroops > 0) { ls.shadowTroops--; addLog('  Éowyn: Nazgûl treated as Rout.'); }
      } else if (nazgulPresent) {
        removeFriendlyTroop(locId, 2); addLog('  Nazgûl! 2 friendly troops lost.');
      }
    }
  }
  checkHavenLost(locId);
  if (checkBoromirHonorTrigger(locId)) G.ui.boromirHonorPending = locId;
}

function rollBattle(locId, maxDice, charId) {
  const faces = ['rout','rout','exchange','exchange','overrun','nazgul'];
  const numDice = Math.min(maxDice, 3);
  const rolls = [];
  for (let i = 0; i < numDice; i++) rolls.push(faces[Math.floor(Math.random() * 6)]);
  addLog(`Battle roll at ${LOCS[locId].name} (${numDice} dice): ${rolls.join(', ')}`);

  const ls = G.locState[locId];
  const region = LOCS[locId].region;
  const nazgulPresent = (G.nazgul[region] || 0) > 0;
  const isEowyn = charId === 'eowyn';

  for (const r of rolls) {
    if (r === 'rout') {
      if (ls.shadowTroops > 0) { ls.shadowTroops--; addLog('Rout: 1 shadow troop removed.'); }
    } else if (r === 'exchange') {
      if (ls.shadowTroops > 0) { ls.shadowTroops--; addLog('Exchange: 1 shadow troop removed.'); }
      removeFriendlyTroop(locId, 1);
    } else if (r === 'overrun') {
      removeFriendlyTroop(locId, 1);
    } else if (r === 'nazgul') {
      if (isEowyn) {
        if (ls.shadowTroops > 0) { ls.shadowTroops--; addLog('Éowyn: Nazgûl result treated as Rout.'); }
      } else if (nazgulPresent) {
        removeFriendlyTroop(locId, 2);
        addLog('Nazgûl! 2 friendly troops lost.');
      }
    }
  }
  checkHavenLost(locId);
  if (checkBoromirHonorTrigger(locId)) G.ui.boromirHonorPending = locId;
  return rolls;
}

function removeFriendlyTroop(locId, n) {
  const f = G.locState[locId].friendly;
  let remaining = n;
  for (const t of ['gondor','rohirrim','elven','dwarven']) {
    while (remaining > 0 && f[t] > 0) {
      f[t]--; G.troopSupply[t]++;
      remaining--;
    }
  }
}

function checkHavenLost(locId) {
  const ls = G.locState[locId];
  const totalFriendly = Object.values(ls.friendly).reduce((a,b)=>a+b,0);
  if (ls.isHaven && ls.shadowTroops > 0 && totalFriendly === 0) {
    ls.isHaven = false;
    ls.isShadowStronghold = true;
    loseHope(3, `Haven lost: ${LOCS[locId].name}`);
    addLog(`⚠️ ${LOCS[locId].name} has fallen to shadow!`);
  }
}

// ── ACTIONS ───────────────────────────────────────────────────────────────────
function makeTurn(charIds, actionsEach = 4) {
  const charActions = {};
  for (const id of charIds) charActions[id] = actionsEach;
  return {
    charActions,
    doneChars: [],
    eomerBonusTravelLeft: charIds.includes('eomer') ? 1 : 0,
    eomerBonusForfeited: false,
  };
}

function canAct(charId) {
  if (G.phase !== 'actions') return false;
  const p = G.players[G.currentPlayer];
  if (!p.chars.includes(charId)) return false;
  if (!G.charState[charId].alive) return false;
  if (charId === 'boromir' && G.boromirRetired) return false;
  if (G.turn.doneChars.includes(charId)) return false;
  return (G.turn.charActions[charId] || 0) > 0;
}

function spendAction(charId) {
  G.turn.charActions[charId] = Math.max(0, (G.turn.charActions[charId] || 0) - 1);
  // Forfeit Éomer's bonus travel once any other character acts
  if (charId !== 'eomer' && G.turn.eomerBonusTravelLeft > 0) {
    G.turn.eomerBonusForfeited = true;
  }
}

function endCharActions(charId) {
  if (!G.turn.doneChars.includes(charId)) G.turn.doneChars.push(charId);
}

// TRAVEL
function actionTravel(charId, destId) {
  if (!canAct(charId)) return err('Cannot act with this character now.');
  const cs = G.charState[charId];
  const fromId = cs.location;
  if (!isConnected(fromId, destId)) return err(`${destId} is not reachable from ${fromId}.`);

  // Check special path cost (Faramir: Stealthy — 1 fewer symbol)
  const conn = getConnection(fromId, destId);
  if (conn && conn.type === 'special') {
    let costSyms = [...conn.cost];
    if (charId === 'faramir' && costSyms.length > 0) costSyms = costSyms.slice(1);
    const p = G.players[G.currentPlayer];
    for (const sym of costSyms) {
      if (p.tokens[sym] <= 0) return err(`Need 1 ${SYM[sym].name} (${SYM[sym].icon}) for this path.`);
    }
    for (const sym of costSyms) p.tokens[sym]--;
  }

  // Ambush: Faramir with friendly troops at origin, shadow troops at destination
  const ambushPending = charId === 'faramir'
    && totalFriendlyAt(fromId) >= 1
    && (G.locState[destId]?.shadowTroops || 0) > 0;

  cs.location = destId;
  spendAction(charId);
  addLog(`${CHARS[charId].name} travels to ${LOCS[destId].name}.`);

  if (ambushPending) G.ui.faramirAmbushPending = destId;

  // Frodo search
  if (charId === 'frodo-sam') {
    if (G.ui.freeSearchThisTurn) {
      addLog('Elven Rope: no search roll this turn.');
      G.ui.freeSearchThisTurn = false;
    } else {
      return { needsSearchDecision: true, destId };
    }
  }
  return { ok: true, ambushPending };
}

function performSearch(spend1Stealth) {
  const frodoLoc = G.charState['frodo-sam'].location;
  if (spend1Stealth) {
    const p = G.players[G.currentPlayer];
    if (p.tokens.stealth > 0) {
      p.tokens.stealth--;
      addLog('Spent ★ — no search roll.');
      return { rolls: [] };
    }
    addLog('No ★ to spend — must roll search.');
  }
  const rolls = rollSearch(frodoLoc);
  return { rolls };
}

function isConnected(a, b) {
  return CONNECTIONS.some(c => (c.a===a&&c.b===b)||(c.a===b&&c.b===a));
}

function getConnection(a, b) {
  return CONNECTIONS.find(c => (c.a===a&&c.b===b)||(c.a===b&&c.b===a));
}

// FELLOWSHIP
function actionFellowship(charId, targetPlayerId, cardId, give) {
  if (!canAct(charId)) return err('Cannot act now.');
  const cs = G.charState[charId];
  const p  = G.players[G.currentPlayer];
  const tp = G.players[targetPlayerId];
  if (targetPlayerId === G.currentPlayer) return err('Cannot fellowship with yourself.');
  // Check co-location
  const anyCharAtSameLoc = tp.chars.some(tc => G.charState[tc].location === cs.location);
  if (!anyCharAtSameLoc) return err('No character from that player is in your location.');

  if (give) {
    const idx = p.hand.findIndex(c => c.id === cardId);
    if (idx < 0) return err('Card not in hand.');
    const [card] = p.hand.splice(idx, 1);
    tp.hand.push(card);
    addLog(`${p.name} gave ${card.name} to ${tp.name}.`);
  } else {
    const idx = tp.hand.findIndex(c => c.id === cardId);
    if (idx < 0) return err('Card not in target hand.');
    const [card] = tp.hand.splice(idx, 1);
    p.hand.push(card);
    addLog(`${p.name} took ${card.name} from ${tp.name}.`);
  }
  if (p.hand.length > 7) return err('Hand limit! Discard down to 7.');
  spendAction(charId);
  return { ok: true };
}

// PREPARE
function actionPrepare(charId, cardId) {
  if (!canAct(charId)) return err('Cannot act now.');
  const cs = G.charState[charId];
  const loc = G.locState[cs.location];
  if (!loc.isHaven) return err('Must be at a haven to Prepare.');
  const p = G.players[G.currentPlayer];
  const idx = p.hand.findIndex(c => c.id === cardId);
  if (idx < 0) return err('Card not in hand.');
  const [card] = p.hand.splice(idx, 1);
  if (card.type !== 'region') return err('Can only Prepare with region cards.');
  G.playerDiscard.push(card);
  const sym = card.symbol;
  if (G.troopSupply[sym] !== undefined) {
    // It's a troop type, not symbol — actually symbols are tokens
  }
  p.tokens[sym] = (p.tokens[sym] || 0) + 1;
  // Galadriel bonus
  if (charId === 'galadriel') { p.tokens[sym]++; addLog('Galadriel gains an extra token!'); }
  addLog(`${CHARS[charId].name} prepares: gained 1 ${SYM[sym].icon} (${SYM[sym].name}).`);
  spendAction(charId);
  return { ok: true };
}

// MUSTER
function actionMuster(charId) {
  if (!canAct(charId)) return err('Cannot act now.');
  const cs = G.charState[charId];
  const locId = cs.location;
  const locData = LOCS[locId];
  if (!locData.musterType) return err('No muster location here (not a colored location).');
  const ls = G.locState[locId];
  if (ls.isShadowStronghold) return err('Cannot muster at a shadow stronghold.');
  const p = G.players[G.currentPlayer];
  const t = locData.musterType;

  let cost = 1;
  let freeEomer = false;
  if (charId === 'eomer' && t === 'rohirrim') { freeEomer = true; cost = 0; }

  if (cost > 0) {
    if ((p.tokens.friendship || 0) < 1) return err(`Need 1 ♥ (Friendship) to muster.`);
    p.tokens.friendship--;
  }
  if (G.troopSupply[t] <= 0) return err(`No ${t} troops left in supply.`);

  const add = (charId === 'boromir') ? 2 : 1;
  const actual = Math.min(add, G.troopSupply[t]);
  ls.friendly[t] += actual;
  G.troopSupply[t] -= actual;
  addLog(`${CHARS[charId].name} musters ${actual} ${t} troop(s) at ${LOCS[locId].name}.`);
  spendAction(charId);
  if (locId === 'dunland') checkFrecasHeirs();
  return { ok: true };
}

// ATTACK
function actionAttack(charId) {
  if (!canAct(charId)) return err('Cannot act now.');
  const cs = G.charState[charId];
  const locId = cs.location;
  const ls = G.locState[locId];
  const totalFriendly = Object.values(ls.friendly).reduce((a,b)=>a+b,0);
  if (totalFriendly === 0) return err('No friendly troops here to attack with.');
  if (ls.shadowTroops === 0) return err('No shadow troops to attack.');

  // Shift Eye of Sauron to this region
  G.eyeRegion = LOCS[locId].region;
  addLog(`Eye of Sauron shifts to ${REGIONS[G.eyeRegion].name}.`);

  const maxDice = (charId === 'faramir') ? Math.min(4, totalFriendly) : Math.min(3, totalFriendly);
  const rolls = rollBattle(locId, maxDice, charId);
  spendAction(charId);
  return { ok: true, rolls };
}

// CAPTURE
function actionCapture(charId) {
  if (!canAct(charId)) return err('Cannot act now.');
  const cs = G.charState[charId];
  const locId = cs.location;
  const ls = G.locState[locId];
  const locData = LOCS[locId];
  if (!locData.capturable) return err('This location cannot be captured.');
  if (ls.shadowTroops > 0) return err('Shadow troops still present — defeat them first.');
  const totalFriendly = Object.values(ls.friendly).reduce((a,b)=>a+b,0);
  if (totalFriendly === 0) return err('Need at least 1 friendly troop to capture.');
  const p = G.players[G.currentPlayer];
  const cost = (charId === 'gimli') ? 2 : 3;
  if ((p.tokens.valor || 0) < cost) return err(`Need ${cost} ✗ (Valor) to capture.`);
  p.tokens.valor -= cost;
  ls.isShadowStronghold = false;
  ls.isHaven = true;
  G.capturedStrongholds.push(locId);
  G.eyeRegion = LOCS[locId].region;
  gainHope(2, `Captured ${LOCS[locId].name}`);
  addLog(`✅ ${CHARS[charId].name} captures ${LOCS[locId].name}! It is now a haven.`);
  // Special captured locations stop spawning
  spendAction(charId);
  return { ok: true };
}

// DESTROY THE RING
function actionDestroyRing() {
  const frodo = G.charState['frodo-sam'];
  if (frodo.location !== 'mount-doom') return err('Frodo must be at Mount Doom.');
  if (!allNonRingObjectivesDone()) return err('All other objectives must be completed first.');
  const p = G.players[G.currentPlayer];
  const totalSymbols = Object.values(p.tokens).reduce((a,b)=>a+b,0);
  if (totalSymbols < 5) return err('Need 5 symbols (tokens) to attempt Destroy the Ring.');
  // Spend 5 (player chooses which — for now spend equally)
  let toSpend = 5;
  for (const sym of ['friendship','valor','stealth','resistance']) {
    while (toSpend > 0 && p.tokens[sym] > 0) { p.tokens[sym]--; toSpend--; }
  }
  // Roll: 1 die per Nazgûl + 1 per shadow troop at Mount Doom + 1 per missing hope
  const nazgul = G.nazgul['mordor'] || 0;
  const shadowAt = G.locState['mount-doom'].shadowTroops;
  const missingHope = G.maxHope - G.hope;
  const numDice = Math.min(7, nazgul + shadowAt + missingHope);
  const faces = ['hope','hope','hope','hope','shadow','shadow']; // 4/6 hope
  let hopeRemains = G.hope;
  const rolls = [];
  for (let i = 0; i < numDice; i++) {
    const r = faces[Math.floor(Math.random() * 6)];
    rolls.push(r);
    if (r === 'shadow') hopeRemains--;
  }
  addLog(`Ring destruction roll (${numDice} dice): ${rolls.join(', ')}`);
  if (hopeRemains > 0) {
    endGame('players');
  } else {
    loseHope(G.hope, 'Ring destruction failed');
    endGame('shadow');
  }
  return { ok: true, rolls, hopeRemains };
}

// COMPLETE OBJECTIVE
function actionCompleteObjective(charId, objectiveId) {
  if (!canAct(charId)) return err('Cannot act now.');
  const obj = G.objectives.find(o => o.id === objectiveId);
  if (!obj) return err('Unknown objective.');
  if (obj.done) return err('Objective already completed.');
  const cs = G.charState[charId];
  const p = G.players[G.currentPlayer];

  if (objectiveId === 'blessing-elves') {
    if (cs.location !== 'rivendell') return err('Must be in Rivendell.');
    // Check another character is also present
    const others = Object.entries(G.charState).filter(([cid, c]) => cid !== charId && c.location === 'rivendell' && c.alive);
    if (others.length === 0) return err('At least 1 other character must be in Rivendell.');
    if ((p.tokens.friendship || 0) < 3) return err('Need 3 ♥ (Friendship) to complete this objective.');
    p.tokens.friendship -= 3;
    obj.done = true;
    // Return reserved troops to supply
    G.troopSupply.elven += obj.reservedTroops || 0;
    obj.reservedTroops = 0;
    // Each player with a char at Rivendell gains 1 resistance
    for (const pl of G.players) {
      if (pl.chars.some(cid => G.charState[cid]?.location === 'rivendell')) {
        pl.tokens.resistance = (pl.tokens.resistance || 0) + 1;
      }
    }
    gainHope(1, 'Attain the Blessing of the Elves');
    addLog('✅ Attain the Blessing of the Elves completed!');
    spendAction(charId);
    return { ok: true };
  }

  if (objectiveId === 'saruman-staff') {
    if (cs.location !== 'isengard') return err('Must be in Isengard.');
    if (!G.capturedStrongholds.includes('isengard')) return err('Isengard must be captured first.');
    obj.done = true;
    gainHope(2, 'Saruman, Your Staff Is Broken');
    addLog('✅ Saruman, Your Staff Is Broken completed!');
    spendAction(charId);
    return { ok: true };
  }

  if (objectiveId === 'challenge-sauron') {
    if (cs.location !== 'barad-dur') return err('Must be in Barad-dûr.');
    if (!G.capturedStrongholds.includes('barad-dur')) return err('Barad-dûr must be captured first.');
    obj.done = true;
    gainHope(2, 'Challenge Sauron');
    addLog('✅ Challenge Sauron completed!');
    spendAction(charId);
    return { ok: true };
  }

  if (objectiveId === 'theodens-mind') {
    if (cs.location !== 'edoras') return err('Must be in Edoras.');
    const others = Object.entries(G.charState).filter(([cid,c]) => cid !== charId && c.location === 'edoras' && c.alive);
    if (others.length === 0) return err('At least 1 other character must also be in Edoras.');
    if ((p.tokens.friendship || 0) < 2) return err('Need 2 ♥ (Friendship).');
    if ((p.tokens.resistance || 0) < 1) return err('Need 1 ◎ (Resistance).');
    p.tokens.friendship -= 2;
    p.tokens.resistance -= 1;
    obj.done = true;
    G.troopSupply.rohirrim += obj.reservedTroops || 0;
    obj.reservedTroops = 0;
    gainHope(1, "Théoden's Mind");
    addLog("✅ Théoden's Mind completed! The King is free!");
    spendAction(charId);
    checkAfterObjectiveComplete();
    return { ok: true, addRohirrimMax: Math.min(2, G.troopSupply.rohirrim) };
  }

  return err('Cannot complete this objective yet.');
}

// ── OBJECTIVE HELPERS ─────────────────────────────────────────────────────────

function actionCaptureDunland(charId, payWith) {
  if (!canAct(charId)) return err('Cannot act.');
  if (G.charState[charId].location !== 'dunland') return err('Must be in Dunland.');
  const obj = G.objectives?.find(o => o.id === 'frecas-heirs' && !o.done);
  if (!obj) return err("Freca's Heirs objective is not active.");
  if ((G.extraHavens || []).includes('dunland')) return err('Dunland is already a haven.');
  const p = G.players[G.currentPlayer];
  if (payWith === 'valor') {
    if ((p.tokens.valor || 0) < 3) return err('Need 3 ⚔ Valor.');
    p.tokens.valor -= 3;
  } else {
    if ((p.tokens.friendship || 0) < 3) return err('Need 3 ♥ Friendship.');
    p.tokens.friendship -= 3;
  }
  if (!G.extraHavens) G.extraHavens = [];
  G.extraHavens.push('dunland');
  addLog(`${CHARS[charId].name} captures Dunland as a haven! (Freca's Heirs)`);
  spendAction(charId);
  checkFrecasHeirs();
  return { ok: true };
}

function checkFrecasHeirs() {
  const obj = G.objectives?.find(o => o.id === 'frecas-heirs' && !o.done);
  if (!obj) return;
  if (!(G.extraHavens || []).includes('dunland')) return;
  const rohirrim = G.locState['dunland']?.friendly?.rohirrim || 0;
  if (rohirrim >= 2) {
    obj.done = true;
    addLog("✅ Freca's Heirs completed! Dunland secured as a Rohirrim haven!");
    if (G.troopSupply.rohirrim > 0) {
      G.locState['dunland'].friendly.rohirrim++;
      G.troopSupply.rohirrim--;
      addLog('+1 Rohirrim added to Dunland.');
    }
    checkAfterObjectiveComplete();
  }
}

function checkDunlandShadowCapture() {
  if (!(G.extraHavens || []).includes('dunland')) return;
  const ls = G.locState['dunland'];
  if (!ls || ls.shadowTroops === 0) return;
  const totalF = Object.values(ls.friendly || {}).reduce((a,b) => a+b, 0);
  if (totalF === 0) {
    const idx = G.extraHavens.indexOf('dunland');
    if (idx >= 0) G.extraHavens.splice(idx, 1);
    loseHope(3, 'Dunland falls to shadow forces');
    addLog('Dunland overrun! -3 hope, haven token removed.');
  }
}

function checkBoromirHonorTrigger(locId) {
  const obj = G.objectives?.find(o => o.id === 'boromirs-honor' && !o.done);
  if (!obj || G.boromirRetired) return false;
  const boromir = G.charState['boromir'];
  if (!boromir || boromir.location !== locId || !boromir.alive) return false;
  const ls = G.locState[locId];
  const totalF = Object.values(ls?.friendly || {}).reduce((a,b) => a+b, 0);
  if (totalF > 0) return false;
  const charsHere = Object.values(G.charState).filter(c => c.location === locId && c.alive);
  return charsHere.length >= 2; // Boromir + at least 1 other
}

function completeBoromirHonor(locId, removeShadow) {
  const obj = G.objectives?.find(o => o.id === 'boromirs-honor' && !o.done);
  if (!obj) return;
  obj.done = true;
  // Remove shadow troops
  const n = Math.min(removeShadow, G.locState[locId]?.shadowTroops || 0);
  if (n > 0) { G.locState[locId].shadowTroops -= n; G.shadowSupply += n; }
  // Retire Boromir
  G.boromirRetired = true;
  const boromirPlayerIdx = G.players.findIndex(p => p.chars.includes('boromir'));
  if (G.players.length < 7) {
    G.boromirReplacementPending = true;
    G.boromirPlayerIdx = boromirPlayerIdx;
  }
  addLog(`✅ Boromir's Honor completed! -${n} shadow troops. Boromir's saga is complete.`);
  if (G.players.length < 7) addLog('When the next objective completes, a new hero will join the Fellowship.');
}

function checkAfterObjectiveComplete() {
  if (!G.boromirReplacementPending) return;
  const assignedChars = G.players.flatMap(p => p.chars);
  const candidates = Object.keys(CHARS).filter(cid => !assignedChars.includes(cid) && cid !== 'boromir');
  if (candidates.length === 0) {
    G.boromirReplacementPending = false;
    addLog('No unassigned characters to replace Boromir.');
    return;
  }
  G.ui.boromirReplacementReady = { playerIdx: G.boromirPlayerIdx, candidates };
  G.boromirReplacementPending = false;
}

function actionReplaceBoromir(newCharId) {
  const info = G.ui.boromirReplacementReady;
  if (!info) return err('No replacement pending.');
  if (!info.candidates.includes(newCharId)) return err('Invalid character selection.');
  const player = G.players[info.playerIdx];
  if (!player) return err('Invalid player.');
  player.chars.push(newCharId);
  G.charState[newCharId].player = info.playerIdx;
  G.charState[newCharId].location = CHARS[newCharId].start;
  G.ui.boromirReplacementReady = null;
  addLog(`${CHARS[newCharId].name} joins the Fellowship to replace Boromir! Placed at ${LOCS[CHARS[newCharId].start].name}.`);
  return { ok: true };
}

function allNonRingObjectivesDone() {
  return G.objectives.filter(o => o.id !== 'destroy-ring').every(o => o.done);
}

// ── ÉOMER ABILITY ────────────────────────────────────────────────────────────
function actionEomerBonusTravel(destLocId) {
  if (G.turn.eomerBonusTravelLeft <= 0) return err('Bonus travel already used this turn.');
  if (G.turn.eomerBonusForfeited) return err('Bonus travel forfeited — another character has already acted.');
  const cs = G.charState['eomer'];
  if (!cs || cs.player !== G.currentPlayer) return err('Éomer is not your character.');
  const valid = validTravelTargets('eomer');
  if (!valid.includes(destLocId)) return err('Cannot travel there.');
  G.turn.eomerBonusTravelLeft--;
  const from = cs.location;
  cs.location = destLocId;
  addLog(`Éomer bonus travel: ${LOCS[from].name} → ${LOCS[destLocId].name}`);
  return { ok: true };
}

// ── FARAMIR ABILITIES ─────────────────────────────────────────────────────────
function startFaramirAmbush() {
  const locId = G.ui.faramirAmbushPending;
  G.ui.faramirAmbushPending = null;
  if (!locId) return err('No pending ambush.');
  const ls = G.locState[locId];
  if (!ls || ls.shadowTroops === 0) return { ok: true, skipped: true };
  const maxDice = Math.min(4, totalFriendlyAt(locId) + 1); // +1 for Faramir
  const rolls = genBattleRolls(maxDice, 4);
  G.ui.pendingAmbushState = { locId, rolls };
  addLog(`Faramir Ambush at ${LOCS[locId].name}: ${rolls.join(', ')}`);
  return { ok: true, rolls, locId };
}

function confirmFaramirAmbush(stealthSpend) {
  if (!G.ui.pendingAmbushState) return err('No pending ambush state.');
  const { locId, rolls } = G.ui.pendingAmbushState;
  G.ui.pendingAmbushState = null;
  const p = G.players[G.currentPlayer];
  const actualSpend = Math.min(stealthSpend, p.tokens.stealth || 0);
  p.tokens.stealth = (p.tokens.stealth || 0) - actualSpend;
  let converted = 0;
  const finalRolls = rolls.map(r => (r !== 'rout' && converted < actualSpend) ? (converted++, 'rout') : r);
  applyBattleRolls(locId, finalRolls, 'faramir');
  if (actualSpend > 0) addLog(`  Ambush: converted ${actualSpend} dice to Rout via ★.`);
  return { ok: true, rolls: finalRolls };
}

function actionWisdomOfEldar(charId) {
  if (!canAct(charId)) return err('Cannot act now.');
  const cs = G.charState[charId];
  const locId = cs.location;
  if (!G.locState[locId].isHaven) return err('Must be at a haven.');
  const region = LOCS[locId].region;
  const matches = G.playerDiscard.filter(c =>
    c.type === 'region' && c.symbol === 'resistance' && LOCS[c.location]?.region === region
  );
  if (matches.length === 0) return err(`No ◎ cards in discard for ${REGIONS[region]?.name || region}.`);
  spendAction(charId);
  return { ok: true, matches };
}

function takeDiscardCard(cardId) {
  const idx = G.playerDiscard.findIndex(c => c.id === cardId);
  if (idx === -1) return err('Card not found in discard pile.');
  const [card] = G.playerDiscard.splice(idx, 1);
  G.players[G.currentPlayer].hand.push(card);
  addLog(`Took "${card.name}" from discard pile.`);
  return { ok: true, card };
}

// ── GALADRIEL ABILITIES ───────────────────────────────────────────────────────
function actionLadyOfLight(charId) {
  const cs = G.charState[charId];
  if (!cs || cs.player !== G.currentPlayer) return err('Not your character.');
  if (!G.locState[cs.location]?.isHaven) return err('Must be at a haven.');
  const p = G.players[G.currentPlayer];
  if ((p.tokens.stealth || 0) < 1) return err('Need 1 stealth token.');
  if (!G.unusedEventCards || G.unusedEventCards.length === 0) return err('No unused event cards remain.');
  p.tokens.stealth--;
  const idx = Math.floor(Math.random() * G.unusedEventCards.length);
  const card = G.unusedEventCards.splice(idx, 1)[0];
  p.hand.push(card);
  addLog(`Lady of Light: drew "${card.name}".`);
  return { ok: true, card };
}

// Returns the top N cards for the UI to display and reorder; commits nothing yet.
function actionMirrorOfGaladriel(charId) {
  if (!canAct(charId)) return err('No actions left.');
  const n = Math.min(4, G.playerDeck.length);
  if (n === 0) return err('Player deck is empty.');
  spendAction(charId);
  // Top n cards: G.playerDeck.slice(-n) in draw order (last element = next drawn)
  const revealed = [...G.playerDeck.slice(-n)].reverse();
  addLog(`Mirror of Galadriel: revealed top ${n} card(s).`);
  return { ok: true, revealed };
}

// Called by UI with card ids in desired draw order (first = next drawn).
function confirmMirrorOrder(orderedIds) {
  const n = orderedIds.length;
  if (n === 0 || n > 4) return err('Invalid order.');
  const top = G.playerDeck.slice(-n);
  const reordered = orderedIds.map(id => top.find(c => c.id === id)).filter(Boolean);
  if (reordered.length !== n) return err('Card mismatch.');
  G.playerDeck = [...G.playerDeck.slice(0, -n), ...reordered.reverse()];
  addLog('Mirror of Galadriel: deck reordered.');
  return { ok: true };
}

// ── DRAW PLAYER CARDS ─────────────────────────────────────────────────────────
function drawPlayerCards() {
  if (G.phase !== 'draw-player') return;
  const p = G.players[G.currentPlayer];
  const drawn = [];
  for (let i = 0; i < 2; i++) {
    if (G.playerDeck.length === 0) {
      loseHope(1, 'Player deck empty');
      continue;
    }
    const card = G.playerDeck.pop();
    drawn.push(card);
    if (card.type === 'skies-darken') {
      addLog(`☁️ SKIES DARKEN: ${card.name}`);
      G.skiesBuffer.push(card);
    } else {
      p.hand.push(card);
      addLog(`Drew: ${card.name}`);
    }
  }
  // Resolve Skies Darken cards
  for (const sd of G.skiesBuffer) resolveSkiesDarken(sd);
  G.skiesBuffer = [];
  // Hand limit
  while (p.hand.length > 7) {
    const disc = p.hand.pop();
    G.playerDiscard.push(disc);
    addLog(`Hand limit: discarded ${disc.name}.`);
  }
  G.phase = 'draw-shadow';
  return { drawn };
}

function resolveSkiesDarken(card) {
  switch (card.effect) {
    case 'shadow-grows':
      G.threatRate = Math.min(G.maxThreat, G.threatRate + 1);
      addLog(`Threat rate increased to ${G.threatRate}.`);
      break;
    case 'i-see-you':
      const frodoLoc = G.charState['frodo-sam'].location;
      const frodoRegion = LOCS[frodoLoc].region;
      if (G.eyeRegion === frodoRegion) {
        loseHope(2, 'I See You! — Eye already in Frodo\'s region');
      } else {
        G.eyeRegion = frodoRegion;
        addLog(`Eye shifts to ${REGIONS[frodoRegion].name}.`);
      }
      break;
    case 'under-cover':
      if (card.location && G.locState[card.location]) {
        const ls = G.locState[card.location];
        if (!G.capturedStrongholds.includes(card.location)) {
          for (let i = 0; i < 3; i++) {
            if (G.shadowSupply > 0) { ls.shadowTroops++; G.shadowSupply--; }
            else loseHope(1, 'Shadow supply empty');
          }
          addLog(`3 shadow troops added to ${LOCS[card.location].name}.`);
          checkHavenLost(card.location);
        }
      }
      break;
    case 'danger-intensifies':
      G.shadowDeck = [...G.shadowDeck, ...shuffle(G.shadowDiscard)];
      G.shadowDiscard = [];
      addLog('Shadow discard shuffled back into deck!');
      break;
  }
}

// ── DRAW SHADOW CARDS ─────────────────────────────────────────────────────────
function drawShadowCards() {
  if (G.phase !== 'draw-shadow') return;
  const drawn = [];
  for (let i = 0; i < G.threatRate; i++) {
    if (G.shadowDeck.length === 0) {
      addLog('Shadow deck empty — reshuffling discard.');
      G.shadowDeck = shuffle(G.shadowDiscard);
      G.shadowDiscard = [];
    }
    if (G.shadowDeck.length === 0) { loseHope(1, 'No shadow cards'); continue; }
    const card = G.shadowDeck.pop();
    G.shadowDiscard.push(card);
    drawn.push(card);
    addLog(`Shadow card: ${card.name}`);
    resolveShadowCard(card);
  }
  // Advance to next player
  endTurn();
  return { drawn };
}

function resolveShadowCard(card) {
  if (card.type === 'special-shadow') { resolveSpecialShadow(card); return; }

  // 1. Advance specified battle lines (advancing all lines is only for special cards)
  const lines = card.battleLines;
  if (lines && lines.length > 0) {
    advanceSpecificLines(lines);
  } else if (card.topSection === 'advance') {
    resolveAdvance();
  }

  // 2. Spawn troop at spawnLoc (no effect if captured stronghold)
  const spawnId = card.spawnLoc || card.location;
  if (spawnId && G.locState[spawnId]) {
    if (!G.capturedStrongholds.includes(spawnId)) {
      if (G.shadowSupply > 0) {
        G.locState[spawnId].shadowTroops++;
        G.shadowSupply--;
        addLog(`  +1 shadow troop at ${LOCS[spawnId].name}.`);
        const tf = totalFriendlyAt(spawnId);
        if (tf > 0 && G.locState[spawnId].isHaven) rollBattle(spawnId, 1, null);
        else checkHavenLost(spawnId);
        checkDunlandShadowCapture();
      } else { loseHope(1, 'Shadow supply empty'); }
    } else { addLog(`  ${LOCS[spawnId].name} is captured — no reinforcement.`); }
  }

  // 3. Nazgûl order
  const order = card.nazgulOrder || card.specialOrder;
  if (G.ui.ignoreNextOrder) {
    G.ui.ignoreNextOrder = false;
    addLog('  Special order ignored (event card effect).');
  } else { resolveSpecialOrder(order); }
}

function resolveAdvance() {
  addLog('ADVANCE: All battle lines march forward!');
  for (const line of BATTLE_LINES) {
    // Process from front (end) to back (start) to avoid double-moving
    for (let i = line.locs.length - 2; i >= 0; i--) {
      const from = line.locs[i];
      const to   = line.locs[i + 1];
      const fls  = G.locState[from];
      if (fls.shadowTroops > 0) {
        const n = fls.shadowTroops;
        fls.shadowTroops = 0;
        G.locState[to].shadowTroops += n;
        addLog(`  ${LOCS[from].name} → ${LOCS[to].name}: ${n} troop(s)`);
      }
    }
    // Resolve battles at locations with both (front to back)
    for (let i = line.locs.length - 1; i >= 0; i--) {
      const locId = line.locs[i];
      const ls = G.locState[locId];
      const totalFriendly = Object.values(ls.friendly).reduce((a,b)=>a+b,0);
      if (ls.shadowTroops > 0 && totalFriendly > 0) {
        addLog(`Battle triggered at ${LOCS[locId].name}!`);
        rollBattle(locId, ls.shadowTroops, null);
      } else {
        checkHavenLost(locId);
      }
    }
  }
}

function advanceSpecificLines(lineIds) {
  // sub-lines advance together with their parent color
  let ids = [...lineIds];
  if (ids.includes('green')    && !ids.includes('green4'))   ids.push('green4');
  if (ids.includes('yellow')   && !ids.includes('yellow-b')) ids.push('yellow-b');
  if (ids.includes('yellow-c') && !ids.includes('yellow-d')) ids.push('yellow-d');
  if (ids.includes('yellow-c') && !ids.includes('yellow-e')) ids.push('yellow-e');
  if (ids.includes('orange')   && !ids.includes('orange-b')) ids.push('orange-b');
  if (ids.includes('orange')   && !ids.includes('orange-c')) ids.push('orange-c');
  if (ids.includes('orange')   && !ids.includes('orange-d')) ids.push('orange-d');
  if (ids.includes('orange')   && !ids.includes('orange-e')) ids.push('orange-e');
  if (ids.includes('orange')   && !ids.includes('orange-f')) ids.push('orange-f');
  if (ids.includes('pink')     && !ids.includes('pink-b'))   ids.push('pink-b');
  if (ids.includes('pink')     && !ids.includes('pink-c'))   ids.push('pink-c');
  if (ids.includes('purple')   && !ids.includes('purple-b')) ids.push('purple-b');
  if (ids.includes('purple')   && !ids.includes('purple-c')) ids.push('purple-c');
  if (ids.includes('teal')     && !ids.includes('teal-b'))   ids.push('teal-b');
  if (ids.includes('teal')     && !ids.includes('teal-c'))   ids.push('teal-c');
  const lines = BATTLE_LINES.filter(bl => ids.includes(bl.id));
  if (lines.length === 0) return;
  addLog(`ADVANCE: ${lines.map(l=>l.name).join(', ')} march forward!`);
  const clearedLocs = new Set();
  for (const line of lines) {
    for (let i = line.locs.length - 2; i >= 0; i--) {
      const from = line.locs[i], to = line.locs[i+1];
      if (clearedLocs.has(from)) continue;
      const fls = G.locState[from];
      if (fls.shadowTroops > 0) {
        const n = fls.shadowTroops; fls.shadowTroops = 0;
        G.locState[to].shadowTroops += n;
        addLog(`  ${LOCS[from].name} → ${LOCS[to].name}: ${n} troop(s)`);
      }
      clearedLocs.add(from);
    }
    for (let i = line.locs.length - 1; i >= 0; i--) {
      const locId = line.locs[i];
      const ls = G.locState[locId];
      const tf = totalFriendlyAt(locId);
      if (ls.shadowTroops > 0 && tf > 0) {
        addLog(`Battle at ${LOCS[locId].name}!`);
        rollBattle(locId, ls.shadowTroops, null);
      } else { checkHavenLost(locId); }
    }
  }
}

function resolveReinforce(card) {
  const locId = card.location;
  if (!locId || !G.locState[locId]) return;
  if (G.capturedStrongholds.includes(locId)) {
    addLog(`  ${LOCS[locId].name} is captured — no reinforcement.`);
  } else {
    const ls = G.locState[locId];
    const totalFriendly = Object.values(ls.friendly).reduce((a,b)=>a+b,0);
    if (G.shadowSupply > 0) {
      ls.shadowTroops++;
      G.shadowSupply--;
      addLog(`  Reinforce: +1 shadow troop at ${LOCS[locId].name}`);
      if (totalFriendly > 0 && ls.isHaven) {
        addLog(`  Battle at haven ${LOCS[locId].name}!`);
        rollBattle(locId, 1, null);
      } else {
        checkHavenLost(locId);
      }
    } else {
      loseHope(1, 'Shadow supply empty');
    }
  }

  if (G.ui.ignoreNextOrder) {
    G.ui.ignoreNextOrder = false;
    addLog('  Special order ignored (event card effect).');
    return;
  }

  // Resolve special order
  resolveSpecialOrder(card.specialOrder);
}

function resolveSpecialOrder(order) {
  if (!order) return;
  const frodoLoc = G.charState['frodo-sam'].location;
  const frodoRegion = LOCS[frodoLoc].region;

  if (order === 'eye-to-frodo') {
    if (G.eyeRegion === frodoRegion) {
      addLog('  Eye already in Frodo\'s region — rolling search!');
      rollSearch(frodoLoc);
    } else {
      G.eyeRegion = frodoRegion;
      addLog(`  Eye shifts to ${REGIONS[frodoRegion].name} (Frodo's region).`);
    }
  } else if (order === 'nazgul-closer' || order === 'move-closest') {
    // Move the Nazgûl closest to Frodo (from outside his region) 1 step toward him
    moveNazgulCloser(1);
    // If a Nazgûl is already in Frodo's region AND order is 'search', roll a search
    if (order !== 'move-closest' && (G.nazgul[frodoRegion] || 0) > 0) {
      addLog('  Nazgûl already in Frodo\'s region — rolling search!');
      rollSearch(frodoLoc);
    }
  } else if (order === 'search') {
    // Move Nazgûl closer; if already there, roll search
    const inRegion = (G.nazgul[frodoRegion] || 0) > 0;
    if (inRegion) {
      addLog('  Nazgûl already in Frodo\'s region — rolling search!');
      rollSearch(frodoLoc);
    } else {
      moveNazgulCloser(1);
    }
  } else if (order === 'deploy-nazgul' || order === 'deploy-recall') {
    const mordorNaz = G.nazgul.mordor || 0;
    if (G.eyeRegion === 'mordor') {
      // Recall 3 Nazgûl to Mordor from other regions
      let recalled = 0;
      for (const r of Object.keys(G.nazgul)) {
        if (r === 'mordor' || !G.nazgul[r]) continue;
        const move = Math.min(3 - recalled, G.nazgul[r]);
        G.nazgul[r] -= move; G.nazgul.mordor += move; recalled += move;
        if (recalled >= 3) break;
      }
      addLog(`  Eye in Mordor: recalled ${recalled} Nazgûl to Mordor.`);
    } else if (mordorNaz > 0) {
      deployNazgulToEye(3);
    } else {
      // Mordor empty: deploy from largest regional group instead
      let largest = null, maxCount = 0;
      for (const [r, n] of Object.entries(G.nazgul)) {
        if (r !== G.eyeRegion && n > maxCount) { maxCount = n; largest = r; }
      }
      if (largest) {
        G.nazgul[largest]--;
        G.nazgul[G.eyeRegion] = (G.nazgul[G.eyeRegion] || 0) + 1;
        addLog(`  Mordor empty: Nazgûl deployed from ${REGIONS[largest]?.name||largest} to ${REGIONS[G.eyeRegion]?.name||G.eyeRegion}.`);
      } else { addLog('  No Nazgûl to deploy.'); }
    }
  }
}

function moveNazgulCloser(count) {
  const frodoLoc = G.charState['frodo-sam'].location;
  const frodoRegion = LOCS[frodoLoc].region;
  let moved = 0;
  // Find regions with Nazgûl not in Frodo's region, move them 1 step closer
  const regions = Object.keys(G.nazgul).filter(r => r !== frodoRegion && G.nazgul[r] > 0);
  for (let i = 0; i < count; i++) {
    // Find closest region with Nazgûl not in Frodo's region
    let best = null, bestDist = 99;
    for (const r of Object.keys(G.nazgul)) {
      if (r === frodoRegion || !G.nazgul[r]) continue;
      const d = regionDist(r, frodoRegion);
      if (d < bestDist) { bestDist = d; best = r; }
    }
    if (!best) break;
    // Move 1 step closer
    const next = stepToward(best, frodoRegion);
    if (next) {
      G.nazgul[best]--;
      G.nazgul[next] = (G.nazgul[next] || 0) + 1;
      addLog(`  Nazgûl moves: ${best} → ${next} (closer to Frodo)`);
      moved++;
    }
  }
  if (moved === 0) addLog('  No Nazgûl to move closer (all in Mordor or Frodo\'s region).');
}

function deployNazgulToEye(count) {
  const mordorNaz = G.nazgul.mordor || 0;
  const toMove = Math.min(count, mordorNaz);
  G.nazgul.mordor -= toMove;
  G.nazgul[G.eyeRegion] = (G.nazgul[G.eyeRegion] || 0) + toMove;
  addLog(`  ${toMove} Nazgûl deployed from Mordor to ${REGIONS[G.eyeRegion].name}.`);
  if (toMove < count) addLog(`  Only ${toMove} Nazgûl in Mordor.`);
}

function regionDist(from, to) {
  // BFS
  const visited = new Set([from]);
  const queue = [[from, 0]];
  while (queue.length) {
    const [cur, d] = queue.shift();
    if (cur === to) return d;
    for (const nb of (REGION_ADJ[cur] || [])) {
      if (!visited.has(nb)) { visited.add(nb); queue.push([nb, d+1]); }
    }
  }
  return 99;
}

function stepToward(from, to) {
  let best = null, bestDist = regionDist(from, to);
  for (const nb of (REGION_ADJ[from] || [])) {
    const d = regionDist(nb, to);
    if (d < bestDist) { bestDist = d; best = nb; }
  }
  return best;
}

function resolveSpecialShadow(card) {
  if (card.effect === 'drums') {
    addLog('DRUMS OF WAR!');
    for (let i = 0; i < 2; i++) {
      if (G.shadowSupply > 0) { G.locState['moria'].shadowTroops++; G.shadowSupply--; }
    }
    addLog('  +2 shadow troops at Moria.');
    resolveAdvance();
  } else if (card.effect === 'wheels') {
    addLog('WHEELS OF SARUMAN!');
    if (!G.capturedStrongholds.includes('isengard') && G.shadowSupply >= 2) {
      G.locState['isengard'].shadowTroops += 2; G.shadowSupply -= 2;
      addLog('  +2 shadow troops at Isengard.');
    }
    if (!G.capturedStrongholds.includes('helms-deep') && G.shadowSupply > 0) {
      G.locState['helms-deep'].shadowTroops++; G.shadowSupply--;
      addLog('  +1 shadow troop at Helm\'s Deep.');
    }
    checkHavenLost('helms-deep');
  }
}

// ── EVENT CARD EFFECTS ────────────────────────────────────────────────────────
function playEvent(cardId, opts) {
  const p = G.players[G.currentPlayer];
  const idx = p.hand.findIndex(c => c.id === cardId);
  if (idx < 0) return err('Card not in hand.');
  const [card] = p.hand.splice(idx, 1);
  G.playerDiscard.push(card);

  switch (card.effect) {
    case 'eagle':
      if (opts.charId && opts.locId) {
        G.charState[opts.charId].location = opts.locId;
        addLog(`Eagles: ${CHARS[opts.charId].name} moved to ${LOCS[opts.locId].name}.`);
        if (opts.charId === 'frodo-sam') {
          const frodoRegion = LOCS[opts.locId].region;
          G.eyeRegion = frodoRegion;
          // Move 7 closest Nazgûl to Frodo's region via BFS region distances
          const dist = bfsRegionDistances(frodoRegion);
          const outsideNaz = Object.entries(G.nazgul)
            .filter(([r, n]) => r !== frodoRegion && n > 0)
            .sort((a, b) => (dist[a[0]] ?? 99) - (dist[b[0]] ?? 99) || b[1] - a[1]);
          let remaining = 7;
          for (const [r, count] of outsideNaz) {
            if (remaining <= 0) break;
            const moving = Math.min(count, remaining);
            G.nazgul[r] = (G.nazgul[r] || 0) - moving;
            G.nazgul[frodoRegion] = (G.nazgul[frodoRegion] || 0) + moving;
            remaining -= moving;
            addLog(`  Eagles: ${moving} Nazgûl from ${REGIONS[r]?.name||r} → ${REGIONS[frodoRegion]?.name||frodoRegion}.`);
          }
          addLog(`  Eye shifts to ${REGIONS[frodoRegion]?.name||frodoRegion}. Search rolling…`);
          opts._eagleSearchRolls = rollSearch(opts.locId);
        }
      }
      break;
    case 'ent-moot':
      if (opts.locId && LOCS[opts.locId].region === 'rohan') {
        const ls = G.locState[opts.locId];
        if (!ls.isShadowStronghold && G.troopSupply.rohirrim >= 2) {
          ls.friendly.rohirrim += 2; G.troopSupply.rohirrim -= 2;
          addLog(`Ent Moot: +2 Rohirrim at ${LOCS[opts.locId].name}.`);
        }
      }
      break;
    case 'gifts':
      for (const pl of G.players) pl.tokens.friendship++;
      addLog('Gifts of Galadriel: each player gains 1 ♥.');
      break;
    case 'elven-rope':
      G.ui.freeSearchThisTurn = true;
      addLog('Elven Rope: Frodo skips search roll this turn.');
      break;
    case 'sting':
      if (opts.locId) {
        const ls = G.locState[opts.locId];
        const remove = Math.min(2, ls.shadowTroops);
        ls.shadowTroops -= remove; G.shadowSupply += remove;
        addLog(`Sting: ${remove} shadow troop(s) removed from ${LOCS[opts.locId].name}.`);
      }
      break;
    case 'paths-of-dead':
      if (opts.charId) {
        G.charState[opts.charId].location = 'minas-tirith';
        addLog(`Paths of the Dead: ${CHARS[opts.charId].name} arrives at Minas Tirith.`);
      }
      break;
    case 'pipeweed':
      gainHope(2, 'Pipeweed');
      break;
    case 'ancient-alliance':
      if (opts.locId && opts.troopType) {
        const ls = G.locState[opts.locId];
        if (G.troopSupply[opts.troopType] >= 3) {
          ls.friendly[opts.troopType] += 3; G.troopSupply[opts.troopType] -= 3;
          addLog(`Ancient Alliance: +3 ${opts.troopType} at ${LOCS[opts.locId].name}.`);
        }
      }
      break;
    case 'ignore-order':
      G.ui.ignoreNextOrder = true;
      addLog('One Does Not Simply...: Next special order ignored.');
      break;
    case 'riddle':
      // UI handles the reordering
      addLog('Riddle in the Dark: look at top 3 shadow cards.');
      return { ok: true, topShadow: G.shadowDeck.slice(-3).reverse() };
    case 'extra-draw':
      for (let i = 0; i < 2; i++) {
        if (G.playerDeck.length) { p.hand.push(G.playerDeck.pop()); }
      }
      addLog('Drew 2 extra player cards.');
      break;
    case 'recall-nazgul':
      if (opts.region && (G.nazgul[opts.region] || 0) > 0) {
        G.nazgul[opts.region]--;
        G.nazgul.mordor = (G.nazgul.mordor || 0) + 1;
        addLog(`Nazgûl recalled from ${opts.region} to Mordor.`);
      }
      break;
    case 'ent-march':
      const is = G.locState['isengard'];
      G.shadowSupply += is.shadowTroops; is.shadowTroops = 0;
      addLog('Ents march! All shadow troops removed from Isengard.');
      break;
    case 'dunedain-hope':
      gainHope(G.capturedStrongholds.length, 'Hope of the Dúnedain');
      break;
    case 'lembas':
      if (opts.charId && G.turn.charActions[opts.charId] !== undefined) {
        G.turn.charActions[opts.charId] += 2;
        addLog(`Lembas: ${CHARS[opts.charId].name} gains 2 extra actions.`);
      }
      break;
  }
  return { ok: true };
}

// ── END TURN ──────────────────────────────────────────────────────────────────
function endTurn() {
  G.currentPlayer = (G.currentPlayer + 1) % G.players.length;
  G.phase = 'actions';
  G.turn = makeTurn(G.players[G.currentPlayer].chars, G.players[G.currentPlayer].actionsPerChar);
  G.ui = { selectedChar: null, pendingAction: null, validTargets: [], ignoreNextOrder: G.ui.ignoreNextOrder, freeSearchThisTurn: false };
  addLog(`--- ${G.players[G.currentPlayer].name}'s turn ---`);
}

function advancePhase() {
  if (G.phase === 'actions')      G.phase = 'draw-player';
  else if (G.phase === 'draw-player')  drawPlayerCards();
  else if (G.phase === 'draw-shadow')  drawShadowCards();
}

// ── HELPER ────────────────────────────────────────────────────────────────────
function err(msg) { addLog(`⚠ ${msg}`); return { error: msg }; }

function frodoLocation() { return G.charState['frodo-sam'].location; }

// Selects `count` cards from pool, prioritising 'prioritised' then 'normal' then 'avoid'
function selectByPriority(pool, prefs, count) {
  const bucket = t => pool.filter(c => (prefs[c.id] || 'normal') === t);
  const ordered = [...shuffle(bucket('prioritised')), ...shuffle(bucket('normal')), ...shuffle(bucket('avoid'))];
  return ordered.slice(0, count);
}

function bfsRegionDistances(startRegion) {
  // BFS over region adjacency derived from CONNECTIONS
  const adj = {};
  for (const conn of CONNECTIONS) {
    const ra = LOCS[conn.a]?.region, rb = LOCS[conn.b]?.region;
    if (ra && rb && ra !== rb) {
      (adj[ra] = adj[ra] || new Set()).add(rb);
      (adj[rb] = adj[rb] || new Set()).add(ra);
    }
  }
  const dist = { [startRegion]: 0 };
  const queue = [startRegion];
  while (queue.length) {
    const r = queue.shift();
    for (const nb of (adj[r] || [])) {
      if (dist[nb] === undefined) { dist[nb] = dist[r] + 1; queue.push(nb); }
    }
  }
  return dist;
}

function totalFriendlyAt(locId) {
  return Object.values(G.locState[locId].friendly).reduce((a,b)=>a+b,0);
}

function validTravelTargets(charId) {
  const loc = G.charState[charId].location;
  return Object.keys(LOCS).filter(id => id !== loc && isConnected(loc, id));
}
