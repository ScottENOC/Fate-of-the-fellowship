'use strict';

// ── GAME STATE ────────────────────────────────────────────────────────────────
let G = null; // the live game state

function newGame(cfg) {
  const { numPlayers, playerNames, boons = {} } = cfg;
  const difficulty = cfg.difficulty || 'standard';
  const plusMatch = difficulty.match(/^legendary\+(\d+)$/);
  const plusLevel = plusMatch ? parseInt(plusMatch[1]) : 0;
  const baseDiff = plusLevel > 0 ? 'legendary' : difficulty;
  const skiesCounts = { introductory:4, standard:5, heroic:5, epic:6, legendary:6 };
  const numSkies = skiesCounts[baseDiff] || 5;

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
  const numOpt = Math.min((objCounts[baseDiff] ?? 3) + plusLevel, OBJECTIVES.filter(o => !o.required).length);
  const requiredObjs = OBJECTIVES.filter(o => o.required);
  let computedObjectives;
  const { selectedObjectiveIds } = cfg;
  if (selectedObjectiveIds?.length) {
    // Use lobby-pre-selected objectives, filtered to chars actually in game
    const selected = selectedObjectiveIds
      .map(id => OBJECTIVES.find(o => o.id === id))
      .filter(o => o && (!o.requiresChar || allCharIds.includes(o.requiresChar)));
    computedObjectives = selected;
  } else {
    const eligibleOptional = OBJECTIVES.filter(o => !o.required && (!o.requiresChar || allCharIds.includes(o.requiresChar)));
    computedObjectives = [
      ...requiredObjs,
      ...selectByPriority(eligibleOptional, cardPrefs, numOpt),
    ];
  }
  computedObjectives = computedObjectives.map(o => ({ ...o, done: false, reservedTroops: o.setupTroops || 0 }));

  const troopReserved = { dwarven:0, elven:0, rohirrim:0, gondor:0 };
  for (const obj of computedObjectives) {
    if (obj.setupTroops > 0 && obj.setupTroopType) {
      troopReserved[obj.setupTroopType] = (troopReserved[obj.setupTroopType] || 0) + obj.setupTroops;
    }
  }

  // Shadow deck — draw 9 + extra for odd legendary+ levels (troop placement only)
  let shadowDeck = makeShadowDeck();
  const shadowSetupDiscard = [];
  const extraSetupDraws = Math.ceil(plusLevel / 2); // +1 per odd + level
  for (let i = 0; i < 9 + extraSetupDraws; i++) {
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
    shadowSupply: 45 - 18 - (9 + extraSetupDraws), // 45 total minus normal+extra setup draws
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
    plusLevel,
    nazgulDeaths: 0,           // total Nazgûl kills by Éowyn (for Shieldmaiden objective)
    gandalfState: 'grey',      // 'grey' | 'dead' | 'awaiting-white' | 'white'
    shadowLieutenants: [],     // active lieutenant ids from legendary+
    freeLtBoons: boons,        // which free lt boons are purchased (id → count)
    freeLtState: {},           // per-lt state: { active, location }
  };
  // Initialize free peoples lieutenant state
  for (const lt of FREE_PEOPLES_LIEUTENANTS) {
    G.freeLtState[lt.id] = { active: false, location: lt.spawnLoc };
  }
  // Activate immediate-spawn free LTs (those without a trigger)
  for (const lt of FREE_PEOPLES_LIEUTENANTS) {
    if (lt.spawnTrigger === null && (boons[lt.id] || 0) > 0) {
      activateFreeLt(lt.id);
    }
  }

  // Spawn shadow lieutenants (1 per even + level, up to 5 defined)
  const numLieutenants = Math.min(Math.floor(plusLevel / 2), SHADOW_LIEUTENANTS.length);
  for (let i = 0; i < numLieutenants; i++) {
    const lt = SHADOW_LIEUTENANTS[i];
    G.shadowLieutenants.push(lt.id);
    if (lt.spawnLoc && G.locState[lt.spawnLoc]) {
      G.locState[lt.spawnLoc].shadowTroops++;
      addLog(`Lieutenant: ${lt.name} spawns at ${LOCS[lt.spawnLoc]?.name || lt.spawnLoc}.`);
    }
    if (lt.id === 'witch-king') {
      // Secretly mark one Nazgûl region as the Witch-king's
      const regions = Object.keys(G.nazgul).filter(r => (G.nazgul[r] || 0) > 0);
      G.witchKingRegion = regions[Math.floor(Math.random() * regions.length)];
      G.witchKingRevealed = false;
      addLog('Lieutenant: The Witch-king lurks among the Nazgûl... (location hidden)');
    }
    if (lt.id === 'saruman-lt') {
      // Remove one Rohirrim from reserve
      if (G.troopSupply.rohirrim > 0) G.troopSupply.rohirrim--;
    }
  }
  // Objectives that add shadow troops at setup
  for (const obj of G.objectives) {
    if (obj.setupShadowLoc && G.locState[obj.setupShadowLoc]) {
      G.locState[obj.setupShadowLoc].shadowTroops++;
      addLog(`Setup (${obj.name}): +1 shadow troop at ${LOCS[obj.setupShadowLoc].name}.`);
    }
    if (obj.setupShadowLocs) {
      for (const [locId, count] of Object.entries(obj.setupShadowLocs)) {
        if (G.locState[locId]) {
          G.locState[locId].shadowTroops += count;
          addLog(`Setup (${obj.name}): +${count} shadow troop(s) at ${LOCS[locId].name}.`);
        }
      }
    }
  }
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

const EORED_SLOT_LOCS = {
  'north-ithilien': 'Ithilien', 'south-ithilien': 'Ithilien',
  'woodland-realm': 'Mirkwood', 'old-forest-road': 'Mirkwood', 'southern-mirkwood': 'Mirkwood',
};
const EORED_SLOT_REGIONS = {
  'rohan': 'Rohan', 'misty-mountains': 'Misty Mountains', 'gondor': 'Gondor',
  'rhovanion': 'Rhovanion', 'enedwaith': 'Enedwaith',
};
function getEoredSlot(locId) {
  return EORED_SLOT_LOCS[locId] || EORED_SLOT_REGIONS[LOCS[locId]?.region] || null;
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
  const shadowBefore = ls.shadowTroops;
  const friendlyBefore = totalFriendlyAt(locId);
  const hadRohirrim = (ls.friendly.rohirrim || 0) > 0;
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
        if (ls.shadowTroops > 0) {
          ls.shadowTroops--;
          addLog('  Éowyn: Nazgûl treated as Rout.');
          G.nazgulDeaths = (G.nazgulDeaths || 0) + 1;
          checkShieldmaidenComplete();
        }
      } else if (nazgulPresent) {
        removeFriendlyTroop(locId, 2); addLog('  Nazgûl! 2 friendly troops lost.');
      }
    }
  }
  // Gothmog: Iron Discipline — +1 friendly casualty if shadow outnumbered friendly at battle start
  if (G.shadowLieutenants.includes('gothmog') && shadowBefore > friendlyBefore && totalFriendlyAt(locId) > 0) {
    removeFriendlyTroop(locId, 1);
    addLog('  ⚔ Gothmog\'s Iron Discipline: +1 extra friendly casualty!');
  }
  checkHavenLost(locId);
  if (checkBoromirHonorTrigger(locId)) G.ui.boromirHonorPending = locId;

  // Ride with the Éored: offer slot when Éomer removes shadow troops with Rohirrim present
  if (charId === 'eomer' && hadRohirrim && ls.shadowTroops < shadowBefore) {
    const eoredObj = G.objectives?.find(o => o.id === 'ride-with-eored' && !o.done);
    if (eoredObj) {
      const slot = getEoredSlot(locId);
      if (slot && !eoredObj.slotsFilled[slot]) {
        G.ui.pendingEoredSlot = slot;
      }
    }
  }

  checkPassiveObjectives();
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
    // Non-capturable locations (like Osgiliath via objective) don't become permanent strongholds
    if (LOCS[locId].capturable) ls.isShadowStronghold = true;
    const idx = G.capturedStrongholds.indexOf(locId);
    if (idx >= 0) G.capturedStrongholds.splice(idx, 1);
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
    primaryChar: null,
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
  const t = G.turn;
  if (!t) return false;
  if (t.doneChars?.includes(charId)) return false;
  // Block secondary char until primary has clicked End Actions (is in doneChars)
  if (t.primaryChar && t.primaryChar !== charId && !t.doneChars?.includes(t.primaryChar)) return false;
  return (t.charActions?.[charId] || 0) > 0;
}

function spendAction(charId) {
  const t = G.turn;
  if (!t.primaryChar) t.primaryChar = charId;
  t.charActions[charId] = Math.max(0, (t.charActions[charId] || 0) - 1);
  // Forfeit Éomer's bonus travel once any other character acts
  if (charId !== 'eomer' && t.eomerBonusTravelLeft > 0) {
    t.eomerBonusForfeited = true;
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
  checkPassiveObjectives();
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
function actionCapture(charId, payWith = 'valor') {
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

  const infiltrateActive = locId === 'minas-morgul' &&
    G.objectives.some(o => o.id === 'infiltrate-minas-morgul' && !o.done);
  const layBareActive = locId === 'dol-guldur' && charId === 'galadriel' &&
    G.objectives.some(o => o.id === 'lay-bare-pits' && !o.done);

  if (payWith === 'stealth' && infiltrateActive) {
    if ((p.tokens.stealth || 0) < cost) return err(`Need ${cost} ★ (Stealth) to capture via Infiltrate.`);
    p.tokens.stealth -= cost;
  } else if (payWith === 'resistance-valor' && layBareActive) {
    if ((p.tokens.resistance || 0) < 2) return err('Need 2 ◎ (Resistance) for Lay Bare the Pits.');
    if ((p.tokens.valor || 0) < 1) return err('Need 1 ⚔ (Valor) for Lay Bare the Pits.');
    p.tokens.resistance -= 2;
    p.tokens.valor -= 1;
  } else {
    if ((p.tokens.valor || 0) < cost) return err(`Need ${cost} ⚔ (Valor) to capture.`);
    p.tokens.valor -= cost;
  }

  ls.isShadowStronghold = false;
  ls.isHaven = true;
  G.capturedStrongholds.push(locId);
  G.eyeRegion = LOCS[locId].region;
  gainHope(2, `Captured ${LOCS[locId].name}`);
  addLog(`✅ ${CHARS[charId].name} captures ${LOCS[locId].name}! It is now a haven.`);
  spendAction(charId);

  if (infiltrateActive) {
    const obj = G.objectives.find(o => o.id === 'infiltrate-minas-morgul');
    obj.done = true;
    p.tokens.stealth = (p.tokens.stealth || 0) + 2;
    addLog(`Infiltrate Minas Morgul complete! +2 ★. Peek top 2 shadow cards.`);
    const topCards = G.shadowDeck.slice(-2).reverse();
    return { ok: true, infiltrateCards: topCards, deckSize: G.shadowDeck.length };
  }

  // Lay Bare the Pits — capture is step 1; objective completes once 3+ Elven troops also present
  if (layBareActive) checkLayBarePitsComplete();

  checkPassiveObjectives();
  return { ok: true };
}

// Called from UI after player chooses which shadow cards to remove
function actionInfiltrateResolve(removeTop, removeSecond) {
  const len = G.shadowDeck.length;
  if (len === 0) return;
  const toRemove = new Set();
  if (removeTop && len >= 1) toRemove.add(len - 1);
  if (removeSecond && len >= 2) toRemove.add(len - 2);
  G.shadowDeck = G.shadowDeck.filter((_, i) => !toRemove.has(i));
  const count = toRemove.size;
  addLog(`Infiltrate: ${count > 0 ? count + ' shadow card(s) removed from game.' : 'No shadow cards removed.'}`);
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
    if (!G.capturedStrongholds.includes('isengard')) return err('Isengard must be a captured haven first.');
    const rohanFree = Object.entries(LOCS).every(([id, loc]) =>
      loc.region !== 'rohan' ||
      (G.locState[id].shadowTroops === 0 && (!loc.capturable || G.capturedStrongholds.includes(id)))
    );
    if (!rohanFree) return err('Every Rohan location must be free of shadow troops and shadow strongholds.');
    obj.done = true;
    p.tokens.resistance = (p.tokens.resistance || 0) + 1;
    addLog('✅ Saruman, Your Staff Is Broken completed! Current player gains 1 ◎.');
    spendAction(charId);
    checkAfterObjectiveComplete();
    return { ok: true };
  }

  if (objectiveId === 'challenge-sauron') {
    if (cs.location !== 'north-ithilien') return err('Must be in North Ithilien.');
    const f = G.locState['north-ithilien'].friendly;
    if ((f.gondor || 0) < 3) return err('Need at least 3 Gondor troops at North Ithilien.');
    if ((f.elven || 0) < 2)  return err('Need at least 2 Elven troops at North Ithilien.');
    if ((f.dwarven || 0) < 2) return err('Need at least 2 Dwarven troops at North Ithilien.');
    obj.done = true;
    G.eyeRegion = LOCS['north-ithilien'].region;
    addLog(`Eye of Sauron shifts to ${REGIONS[G.eyeRegion]?.name || G.eyeRegion}.`);
    let moved = 0;
    for (const [id, ls] of Object.entries(G.locState)) {
      if (LOCS[id].region === 'mordor' && id !== 'udun' && ls.shadowTroops > 0) {
        G.locState['udun'].shadowTroops += ls.shadowTroops;
        moved += ls.shadowTroops;
        ls.shadowTroops = 0;
      }
    }
    addLog(`✅ Challenge Sauron completed! ${moved} shadow troop${moved!==1?'s':''} consolidated to Udûn.`);
    spendAction(charId);
    checkAfterObjectiveComplete();
    return { ok: true };
  }

  if (objectiveId === 'hobbits-pledge') {
    if (charId !== 'merry-pippin') return err('Only Merry & Pippin can complete this objective.');
    const havenCategory = {
      'grey-havens':'elf', 'rivendell':'elf', 'lorien':'elf', 'woodland-realm':'elf',
      'helms-deep':'rohan', 'erebor':'dwarf', 'minas-tirith':'gondor', 'dol-amroth':'gondor',
    };
    const cat = havenCategory[cs.location];
    if (!cat) return err('Merry & Pippin must be at a qualifying haven (Grey Havens, Rivendell, Lórien, Woodland Realm, Helm\'s Deep, Erebor, Minas Tirith, or Dol Amroth).');
    if (!obj.state) obj.state = { categoriesFilled: [] };
    if (obj.state.categoriesFilled.includes(cat)) return err(`The ${cat} category is already filled.`);
    const locRegion = LOCS[cs.location].region;
    const matchCard = p.hand.find(c => c.type === 'region' && LOCS[c.location]?.region === locRegion);
    if (!matchCard) return err(`Need a region card matching ${REGIONS[locRegion]?.name || locRegion} in hand.`);
    p.hand = p.hand.filter(c => c.id !== matchCard.id);
    G.playerDiscard.push(matchCard);
    obj.state.categoriesFilled.push(cat);
    addLog(`Hobbits Pledge: ${cat} category filled at ${LOCS[cs.location].name}.`);
    if (obj.state.categoriesFilled.length >= 2) {
      obj.done = true;
      gainHope(1, "Hobbits Pledge Their Loyalty");
      p.tokens.friendship = (p.tokens.friendship || 0) + 2;
      addLog("✅ Hobbits Pledge Their Loyalty completed! Gain 1 hope, 2 ♥ for Merry & Pippin's player.");
      checkAfterObjectiveComplete();
    }
    spendAction(charId);
    return { ok: true, categoriesFilled: obj.state.categoriesFilled };
  }

  if (objectiveId === 'confront-balrog') {
    if (charId !== 'gandalf') return err('Only Gandalf can confront the Balrog.');
    if (cs.location !== 'moria') return err('Gandalf must be in Moria.');
    // Roll 3 dice and return results; hope loss applied client-side after spending
    const results = genBattleRolls(3, 7);
    addLog(`Gandalf confronts the Balrog! Rolled: ${results.join(', ')}`);
    spendAction(charId);
    return { ok: true, balrogRoll: results, pendingResolution: true };
  }

  if (objectiveId === 'shelobs-lair') {
    if (charId !== 'frodo-sam') return err('Only Frodo & Sam can complete Shelob\'s Lair.');
    if (cs.location !== 'minas-morgul') return err('Frodo & Sam must be in Minas Morgul.');
    const gollumPlayerIdx = G.players.findIndex(pl => pl.chars.includes('gollum'));
    if (gollumPlayerIdx === -1) return err('Gollum must be assigned for this objective.');
    if (G.players.length > 1 && gollumPlayerIdx === G.currentPlayer)
      return err('In multiplayer, the Frodo & Sam player cannot also control Gollum.');
    // Count Gollum player's resistance resources
    const gollumPlayer = G.players[gollumPlayerIdx];
    const isSolo = G.players.length === 1;
    let gollumResistancePenalty;
    if (isSolo) {
      // Solo: count resistance cards in the current player's hand
      gollumResistancePenalty = p.hand.filter(c => c.symbol === 'resistance').length;
    } else {
      const resCards = gollumPlayer.hand.filter(c => c.symbol === 'resistance').length;
      const resTokens = gollumPlayer.tokens.resistance || 0;
      gollumResistancePenalty = resCards + resTokens;
    }
    const rolls = genBattleRolls(3, 7);
    addLog(`Shelob's Lair: Frodo rolled ${rolls.join(', ')}. Gollum penalty: ${gollumResistancePenalty} hope.`);
    spendAction(charId);
    return { ok: true, sheloblRoll: rolls, gollumPenalty: gollumResistancePenalty };
  }

  if (objectiveId === 'rangers-eriador') {
    const eriadorLocs = Object.entries(LOCS).filter(([,l]) => l.region === 'eriador').map(([id]) => id);
    const hasShadow = eriadorLocs.some(id => G.locState[id].shadowTroops > 0 ||
      (LOCS[id].capturable && !G.capturedStrongholds.includes(id) && G.locState[id].isShadowStronghold));
    if (hasShadow) return err('Eriador is not yet free of shadow troops and strongholds.');
    const missingTroop = eriadorLocs.find(id => {
      const f = G.locState[id].friendly;
      return (f.dwarven + f.elven + f.rohirrim + f.gondor) === 0;
    });
    if (missingTroop) return err(`${LOCS[missingTroop].name} has no friendly troop.`);
    obj.done = true;
    gainHope(1, 'Rangers Secure Eriador');
    addLog('✅ Rangers Secure Eriador completed! Gain 1 hope. Move any Eriador troops to Tharbad or Weather Hills.');
    spendAction(charId);
    checkAfterObjectiveComplete();
    return { ok: true, canMoveTroopsFrom: eriadorLocs };
  }

  if (objectiveId === 'unseat-denethor') {
    if (cs.location !== 'minas-tirith') return err('Must be in Minas Tirith.');
    const others = Object.entries(G.charState).filter(([cid,c]) => cid !== charId && c.location === 'minas-tirith' && c.alive);
    if (others.length === 0) return err('At least 1 other character must also be in Minas Tirith.');
    if ((p.tokens.stealth || 0) < 2) return err('Need 2 ★ (Stealth).');
    if ((p.tokens.friendship || 0) < 1) return err('Need 1 ♥ (Friendship).');
    if ((p.tokens.valor || 0) < 1) return err('Need 1 ⚔ (Valor).');
    p.tokens.stealth -= 2;
    p.tokens.friendship -= 1;
    p.tokens.valor -= 1;
    // Return reserved gondor troops to supply
    const reserved = obj.reservedTroops || 0;
    G.troopSupply.gondor = (G.troopSupply.gondor || 0) + reserved;
    obj.done = true;
    gainHope(1, 'Unseat Denethor');
    G.ui.pendingUnseatDenethorReward = true;
    addLog(`✅ Denethor is unseated! ${reserved} Gondor troops returned to supply. +1 hope.`);
    spendAction(charId);
    checkAfterObjectiveComplete();
    return { ok: true };
  }

  if (objectiveId === 'arwen-banner') {
    if (charId !== 'arwen') return err('Only Arwen can complete this objective.');
    if (cs.location !== 'minas-tirith') return err('Arwen must be in Minas Tirith.');
    if (!G.locState['minas-tirith'].isHaven && !G.capturedStrongholds.includes('minas-tirith'))
      return err('Minas Tirith must be a captured haven.');
    const f = G.locState['minas-tirith'].friendly;
    if ((f.gondor || 0) < 1) return err('Need at least 1 Gondor troop in Minas Tirith.');
    if ((f.rohirrim || 0) < 1) return err('Need at least 1 Rohirrim troop in Minas Tirith.');
    if ((f.elven || 0) < 1) return err('Need at least 1 Elven troop in Minas Tirith.');
    if ((f.dwarven || 0) < 1) return err('Need at least 1 Dwarven troop in Minas Tirith.');
    if ((p.tokens.friendship || 0) < 1) return err('Need 1 ♥ (Friendship).');
    p.tokens.friendship--;
    obj.done = true;
    gainHope(1, 'Arwen Unfurls the Banner');
    addLog('✅ Arwen Unfurls the Banner! +1 hope. All peoples of Middle-earth united at Minas Tirith.');
    spendAction(charId);
    checkAfterObjectiveComplete();
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

function checkShieldmaidenComplete() {
  const obj = G.objectives.find(o => o.id === 'shieldmaiden' && !o.done);
  if (!obj) return;
  if ((G.nazgulDeaths || 0) < 2) return;
  const rohanFree = Object.entries(LOCS).every(([id, loc]) =>
    loc.region !== 'rohan' ||
    (G.locState[id].shadowTroops === 0 && (!loc.capturable || G.capturedStrongholds.includes(id)))
  );
  if (!rohanFree) return;
  obj.done = true;
  gainHope(1, 'Shieldmaiden No Longer');
  addLog('✅ Shieldmaiden No Longer completed! Gain 1 hope.');
  checkAfterObjectiveComplete();
}

function checkRangersEriadorComplete() {
  const obj = G.objectives.find(o => o.id === 'rangers-eriador' && !o.done);
  if (!obj) return;
  const eriadorLocs = Object.entries(LOCS).filter(([,l]) => l.region === 'eriador').map(([id]) => id);
  const hasShadow = eriadorLocs.some(id =>
    G.locState[id].shadowTroops > 0 ||
    (LOCS[id].capturable && !G.capturedStrongholds.includes(id) && G.locState[id].isShadowStronghold)
  );
  if (hasShadow) return;
  const missingTroop = eriadorLocs.find(id => {
    const f = G.locState[id].friendly;
    return (f.dwarven + f.elven + f.rohirrim + f.gondor) === 0;
  });
  if (missingTroop) return;
  obj.done = true;
  gainHope(1, 'Rangers Secure Eriador');
  addLog('✅ Rangers Secure Eriador completed! Gain 1 hope. You may move Eriador troops to Tharbad or Weather Hills.');
  checkAfterObjectiveComplete();
}

function checkLayBarePitsComplete() {
  const obj = G.objectives.find(o => o.id === 'lay-bare-pits' && !o.done);
  if (!obj) return;
  if (!G.capturedStrongholds.includes('dol-guldur')) return;
  if ((G.locState['dol-guldur']?.friendly?.elven || 0) < 3) return;
  obj.done = true;
  const galadrielHere = G.charState['galadriel']?.location === 'dol-guldur';
  if (galadrielHere) gainHope(1, 'Lay Bare the Pits: Galadriel present');
  addLog(`✅ Lay Bare the Pits complete!${galadrielHere ? ' +1 hope (Galadriel present).' : ''}`);
  checkAfterObjectiveComplete();
}

// Move friendly troops from Haradwaith to Pelargir (Subdue Umbar reward)
function actionSubdueUmbarMove(moveCounts) {
  // moveCounts: { locId: { dwarven:0, elven:0, rohirrim:0, gondor:0 }, ... }
  for (const [fromId, types] of Object.entries(moveCounts)) {
    const from = G.locState[fromId];
    const to = G.locState['pelargir'];
    if (!from || !to) continue;
    for (const [t, n] of Object.entries(types)) {
      const actual = Math.min(n, from.friendly[t] || 0);
      if (actual <= 0) continue;
      from.friendly[t] -= actual;
      to.friendly[t] = (to.friendly[t] || 0) + actual;
      addLog(`Subdue Umbar: ${actual} ${t} troop(s) moved from ${LOCS[fromId].name} to Pelargir.`);
    }
  }
}

const MIRKWOOD_LOCS = ['woodland-realm', 'old-forest-road', 'southern-mirkwood'];

function checkBringLightMirkwoodComplete() {
  const obj = G.objectives.find(o => o.id === 'bring-light-mirkwood' && !o.done);
  if (!obj) return;
  const hasShadow = MIRKWOOD_LOCS.some(id => G.locState[id].shadowTroops > 0);
  if (hasShadow) return;
  const missingElven = MIRKWOOD_LOCS.find(id => (G.locState[id].friendly.elven || 0) < 1);
  if (missingElven) return;
  obj.done = true;
  gainHope(1, 'Bring Light to Mirkwood');
  G.ui.pendingBringLightMirkwoodReward = true;
  addLog('✅ Bring Light to Mirkwood complete! +1 hope. Choose a Mirkwood location to concentrate your Elven troops.');
  checkAfterObjectiveComplete();
}

function actionBringLightMirkwoodMove(targetLocId, moveCounts) {
  // moveCounts: { locId: n } — elven troops to move from each other Mirkwood location to target
  const to = G.locState[targetLocId];
  if (!to) return;
  for (const [fromId, n] of Object.entries(moveCounts)) {
    if (fromId === targetLocId) continue;
    const from = G.locState[fromId];
    const actual = Math.min(n, from.friendly.elven || 0);
    if (actual <= 0) continue;
    from.friendly.elven -= actual;
    to.friendly.elven = (to.friendly.elven || 0) + actual;
    addLog(`Bring Light to Mirkwood: ${actual} Elven troop(s) from ${LOCS[fromId].name} → ${LOCS[targetLocId].name}.`);
  }
}

function checkAvengeBalinComplete() {
  const obj = G.objectives.find(o => o.id === 'avenge-balin' && !o.done);
  if (!obj) return;
  if (!G.capturedStrongholds.includes('moria')) return;
  if ((G.locState['moria'].friendly.dwarven || 0) < 2) return;
  obj.done = true;
  G.ui.pendingAvengeBalinReward = true;
  addLog('✅ Avenge Balin complete! Move Dwarven troops to Moria; reach 4 for 2 Valor.');
  checkAfterObjectiveComplete();
}

function actionSecureOsgiliath(payWith) {
  if (!canAct('faramir')) return err('Cannot act now.');
  const cs = G.charState['faramir'];
  if (cs.location !== 'osgiliath') return err('Faramir must be in Osgiliath.');
  const obj = G.objectives?.find(o => o.id === 'secure-osgiliath' && !o.done);
  if (!obj) return err('Secure the Crossing objective is not active.');
  const ls = G.locState['osgiliath'];
  if (ls.shadowTroops > 0) return err('Shadow troops still present — defeat them first.');
  const totalF = Object.values(ls.friendly).reduce((a,b)=>a+b,0);
  if (totalF === 0) return err('At least 1 friendly troop must be present.');
  const p = G.players[G.currentPlayer];
  if (payWith === 'resistance-stealth') {
    if ((p.tokens.resistance || 0) < 2) return err('Need 2 ◎ (Resistance).');
    if ((p.tokens.stealth || 0) < 1) return err('Need 1 ★ (Stealth).');
    p.tokens.resistance -= 2;
    p.tokens.stealth -= 1;
  } else {
    if ((p.tokens.valor || 0) < 3) return err('Need 3 ⚔ (Valor).');
    p.tokens.valor -= 3;
  }
  ls.isHaven = true;
  G.capturedStrongholds.push('osgiliath');
  gainHope(2, 'Secured Osgiliath');
  obj.done = true;
  G.ui.pendingSecureOsgiliathReward = true;
  addLog('✅ Faramir secures the Crossing of the Anduin! Osgiliath is now a haven (+2 hope).');
  spendAction('faramir');
  checkAfterObjectiveComplete();
  return { ok: true };
}

function actionCallOathbreakers() {
  if (!canAct('aragorn')) return err('Cannot act now.');
  const cs = G.charState['aragorn'];
  if (cs.location !== 'edoras') return err('Aragorn must be in Edoras.');
  const obj = G.objectives?.find(o => o.id === 'oathbreakers-duty' && !o.done);
  if (!obj) return err('Oathbreakers Fulfill Their Duty objective is not active.');
  if (obj.aragornCalledOaths) return err('The Oathbreakers have already been called this game.');
  // Move Aragorn to Erech (free — no stealth cost)
  cs.location = 'erech';
  // Add 2 shadow troops to Pelargir
  G.locState['pelargir'].shadowTroops += 2;
  checkHavenLost('pelargir');
  // Move all Umbar shadow troops to Pelargir
  const umbarShadow = G.locState['umbar'].shadowTroops || 0;
  if (umbarShadow > 0) {
    G.locState['umbar'].shadowTroops = 0;
    G.locState['pelargir'].shadowTroops += umbarShadow;
    checkHavenLost('pelargir');
    addLog(`Oathbreakers: ${umbarShadow} shadow troop(s) moved from Umbar to Pelargir.`);
  }
  addLog(`Aragorn rides to Erech! +2 shadow troops to Pelargir. The Dead Awaken.`);
  obj.aragornCalledOaths = true;
  G.ui.pendingOathbreakersErech = Math.min(G.troopSupply?.gondor || 0, 3);
  spendAction('aragorn');
  checkPassiveObjectives();
  return { ok: true };
}

function checkOathbreakersComplete() {
  const obj = G.objectives?.find(o => o.id === 'oathbreakers-duty' && !o.done);
  if (!obj || !obj.aragornCalledOaths) return;
  const gondorLocs = Object.entries(LOCS).filter(([,l]) => l.region === 'gondor').map(([id]) => id);
  const hasShadow = gondorLocs.some(id => {
    const ls = G.locState[id];
    return ls.shadowTroops > 0 || (LOCS[id].capturable && ls.isShadowStronghold && !G.capturedStrongholds.includes(id));
  });
  if (hasShadow) return;
  obj.done = true;
  gainHope(1, 'Oathbreakers Fulfill Their Duty');
  addLog('✅ Oathbreakers Fulfill Their Duty complete! Gondor is free. +1 hope.');
  checkAfterObjectiveComplete();
}

function actionEoredFillSlot(slot, fill) {
  const obj = G.objectives?.find(o => o.id === 'ride-with-eored' && !o.done);
  if (!obj || !fill) return;
  if (obj.slotsFilled[slot]) return;
  obj.slotsFilled[slot] = true;
  const count = Object.keys(obj.slotsFilled).length;
  addLog(`Ride with the Éored: ${slot} slot filled (${count}/4).`);
  if (count >= 4) {
    obj.done = true;
    gainHope(1, 'Ride with the Éored');
    addLog('✅ Ride with the Éored complete! +1 hope. Held shadow troops returned to supply.');
    checkAfterObjectiveComplete();
  }
}

function actionAvengeBalinMove(moveCounts, takeValor) {
  const to = G.locState['moria'];
  for (const [fromId, n] of Object.entries(moveCounts)) {
    const from = G.locState[fromId];
    const actual = Math.min(n, from?.friendly?.dwarven || 0);
    if (actual <= 0) continue;
    from.friendly.dwarven -= actual;
    to.friendly.dwarven = (to.friendly.dwarven || 0) + actual;
    addLog(`Avenge Balin: ${actual} Dwarven troop(s) from ${LOCS[fromId].name} → Moria.`);
  }
  if (takeValor && (to.friendly.dwarven || 0) >= 4) {
    const p = G.players[G.currentPlayer];
    p.tokens.valor = (p.tokens.valor || 0) + 2;
    addLog('Avenge Balin: current player gains 2 ⚔ Valor!');
  }
}

function checkLiftShadowDwarvenComplete() {
  const obj = G.objectives.find(o => o.id === 'lift-shadow-dwarven' && !o.done);
  if (!obj) return;
  const eredLuin = G.locState['ered-luin'];
  if ((eredLuin.shadowTroops || 0) > 0) return;
  if ((eredLuin.friendly.dwarven || 0) < 4) return;
  const lakeTown = G.locState['lake-town'];
  if ((lakeTown.shadowTroops || 0) > 0) return;
  if (lakeTown.isShadowStronghold) return;
  obj.done = true;
  gainHope(1, 'Lift Shadow from Dwarven Lands');
  G.ui.pendingLiftShadowValorOffer = true;
  addLog('✅ Lift Shadow from Dwarven Lands complete! +1 hope. Current player may take 2 ⚔ Valor.');
  checkAfterObjectiveComplete();
}

function actionLiftShadowTakeValor(take) {
  if (take) {
    const p = G.players[G.currentPlayer];
    p.tokens.valor = (p.tokens.valor || 0) + 2;
    addLog('Lift Shadow from Dwarven Lands: +2 ⚔ Valor gained.');
  }
}

// ── FREE PEOPLES LIEUTENANTS ──────────────────────────────────────────────────

function activateFreeLt(ltId) {
  const lt = FREE_PEOPLES_LIEUTENANTS.find(l => l.id === ltId);
  if (!lt || !G.freeLtState[ltId] || G.freeLtState[ltId].active) return;
  G.freeLtState[ltId].active = true;
  G.freeLtState[ltId].location = lt.spawnLoc;
  const spawned = Math.min(lt.startTroops, G.troopSupply[lt.troopType]);
  if (spawned > 0) {
    G.locState[lt.spawnLoc].friendly[lt.troopType] += spawned;
    G.troopSupply[lt.troopType] -= spawned;
  }
  addLog(`⭐ ${lt.name} arrives at ${LOCS[lt.spawnLoc].name} with ${spawned} ${lt.troopType} troops!`);
}

function checkFreeLtSpawnTriggers() {
  if (!G.freeLtBoons) return;
  for (const lt of FREE_PEOPLES_LIEUTENANTS) {
    if (!lt.spawnTrigger) continue;
    if (!(G.freeLtBoons[lt.id] > 0)) continue;
    const state = G.freeLtState[lt.id];
    if (!state || state.active) continue;
    if (lt.spawnTrigger === 'shadow-at') {
      const triggered = lt.allowedLocs.some(locId => (G.locState[locId]?.shadowTroops || 0) > 0);
      if (triggered) activateFreeLt(lt.id);
    }
  }
}

function processFreeLts() {
  for (const lt of FREE_PEOPLES_LIEUTENANTS) {
    const state = G.freeLtState?.[lt.id];
    if (!state?.active) continue;

    let actions = 2;
    while (actions > 0) {
      const loc = state.location;
      const ls = G.locState[loc];
      const troopsHere = ls.friendly[lt.troopType] || 0;
      const shadowHere = ls.shadowTroops || 0;

      // Priority 1: Attack at current location (needs 2+ troops — won't attack alone)
      if (shadowHere > 0 && troopsHere >= 2) {
        ls.shadowTroops--;
        G.shadowSupply++;
        addLog(`⭐ ${lt.name} attacks at ${LOCS[loc].name}: 1 shadow troop removed.`);
        checkHavenLost(loc);
        actions--;
        continue;
      }

      // Haldir special — Lórien's Arrow: attack at any other allowed location
      if (lt.id === 'haldir' && troopsHere >= 2) {
        let bowTarget = null;
        for (const locId of lt.allowedLocs) {
          if (locId !== loc && (G.locState[locId]?.shadowTroops || 0) > 0) {
            bowTarget = locId;
            break;
          }
        }
        if (bowTarget) {
          G.locState[bowTarget].shadowTroops--;
          G.shadowSupply++;
          addLog(`⭐ Haldir (Lórien's Arrow): 1 shadow troop removed at ${LOCS[bowTarget].name}.`);
          checkHavenLost(bowTarget);
          actions--;
          continue;
        }
      }

      // Priority 2: Recruit if below maxTroops at current location
      if (troopsHere < lt.maxTroops && G.troopSupply[lt.troopType] > 0) {
        ls.friendly[lt.troopType]++;
        G.troopSupply[lt.troopType]--;
        addLog(`⭐ ${lt.name} recruits 1 ${lt.troopType} troop at ${LOCS[loc].name}.`);
        actions--;
        continue;
      }

      // Priority 3: Move toward most-threatened allowed location
      if (lt.allowedLocs.length > 1) {
        let moveTo = null, maxThreat = -1;
        for (const locId of lt.allowedLocs) {
          if (locId === loc) continue;
          const threat = G.locState[locId]?.shadowTroops || 0;
          if (threat > maxThreat) { maxThreat = threat; moveTo = locId; }
        }
        if (moveTo && maxThreat > 0) {
          state.location = moveTo;
          addLog(`⭐ ${lt.name} moves to ${LOCS[moveTo].name}.`);
          actions--;
          continue;
        }
      }

      // Nothing useful to do
      addLog(`⭐ ${lt.name} stands watch at ${LOCS[loc].name}.`);
      break;
    }
  }
}

function checkPassiveObjectives() {
  checkShieldmaidenComplete();
  checkRangersEriadorComplete();
  checkSubdueUmbarComplete();
  checkLayBarePitsComplete();
  checkBringLightMirkwoodComplete();
  checkAvengeBalinComplete();
  checkLiftShadowDwarvenComplete();
  checkOathbreakersComplete();
  checkFreeLtSpawnTriggers();
}

const HARADWAITH_LOCS = ['umbar', 'near-harad', 'harondor'];

function checkSubdueUmbarComplete() {
  const obj = G.objectives.find(o => o.id === 'subdue-umbar' && !o.done);
  if (!obj) return;
  const umbarHaven = G.capturedStrongholds.includes('umbar');
  const allClear = HARADWAITH_LOCS.every(id => {
    const ls = G.locState[id];
    const f = ls.friendly;
    return ls.shadowTroops === 0 && (f.dwarven + f.elven + f.rohirrim + f.gondor) >= 1;
  });
  if (!umbarHaven && !allClear) return;
  obj.done = true;
  G.ui.pendingSubdueUmbarReward = true;
  addLog('✅ Subdue Umbar complete! Move any friendly troops from Haradwaith to Pelargir.');
  checkAfterObjectiveComplete();
}

// Called when Balrog battle resolution is confirmed by the UI
// ignoredIndices: Set of die indices (0,1,2) to ignore (each costs 1 Valor)
// friendshipSpend: number of Friendship tokens to spend (each reduces hope loss by 1)
// gollumPenalty: pre-computed from the roll return value
function actionResolveShelob(ignoredIndices, friendshipSpend, rolls, gollumPenalty) {
  const hopeLoss = { rout: 0, exchange: 2, overrun: 1, nazgul: 3 };
  const p = G.players[G.currentPlayer];
  const valorCost = ignoredIndices.size;
  const v = Math.min(valorCost, p.tokens.valor || 0);
  p.tokens.valor = (p.tokens.valor || 0) - v;
  const f = Math.min(friendshipSpend || 0, p.tokens.friendship || 0);
  p.tokens.friendship = (p.tokens.friendship || 0) - f;

  const diceLoss = rolls.reduce((sum, r, i) => ignoredIndices.has(i) ? sum : sum + (hopeLoss[r] || 0), 0);
  const totalLoss = Math.max(0, diceLoss + (gollumPenalty || 0) - f);

  const obj = G.objectives.find(o => o.id === 'shelobs-lair');
  if (obj) obj.done = true;
  checkAfterObjectiveComplete();

  if (totalLoss > 0) loseHope(totalLoss, "Shelob's Lair");
  else addLog("Shelob's Lair: Frodo lost no hope — gains 1 bonus action!");

  if (totalLoss === 0 && G.turn.charActions['frodo-sam'] !== undefined) {
    G.turn.charActions['frodo-sam']++;
  }
  addLog(`Shelob's Lair resolved. ${v} ⚔ and ${f} ♥ spent.`);
}

function actionResolveBalrog(spendResistance, spendValor) {
  const p = G.players[G.currentPlayer];
  const r = Math.min(spendResistance || 0, p.tokens.resistance || 0);
  const v = Math.min(spendValor || 0, p.tokens.valor || 0);
  p.tokens.resistance = (p.tokens.resistance || 0) - r;
  p.tokens.valor = (p.tokens.valor || 0) - v;
  // Hope loss is computed by the UI from the returned roll; we just spend tokens here
  // Then remove Gandalf from the board
  const obj = G.objectives.find(o => o.id === 'confront-balrog');
  if (obj) obj.done = true;
  G.gandalfState = 'awaiting-white';
  G.charState['gandalf'].alive = false;
  addLog('Gandalf has fallen into shadow... but he shall return. Awaiting the next Skies Darken.');
  checkAfterObjectiveComplete();
  return { ok: true };
}

// ── ÉOMER ABILITY ────────────────────────────────────────────────────────────
function getSureShotTargets() {
  const cs = G.charState['legolas'];
  if (!cs || !cs.alive) return [];
  const here = cs.location;
  const adjacent = CONNECTIONS
    .filter(c => c.a === here || c.b === here)
    .map(c => c.a === here ? c.b : c.a);
  return [here, ...adjacent].filter(id => (G.locState[id]?.shadowTroops || 0) > 0);
}

function actionSureShot(targetLocId, placeOnCard = false) {
  const legolasPlayerIdx = G.players.findIndex(pl => pl.chars.includes('legolas'));
  if (legolasPlayerIdx !== G.currentPlayer) return err('Not the Legolas player\'s turn.');
  const cs = G.charState['legolas'];
  if (!cs || !cs.alive) return err('Legolas is not in play.');
  const validTargets = getSureShotTargets();
  if (!validTargets.includes(targetLocId)) return err('Invalid Sure Shot target — must be Legolas\'s location or adjacent, and have a shadow troop.');
  const p = G.players[legolasPlayerIdx];
  if ((p.tokens.stealth || 0) < 1) return err('Need 1 ★ (Stealth) for Sure Shot.');
  p.tokens.stealth--;
  G.locState[targetLocId].shadowTroops--;
  checkHavenLost(targetLocId);

  const sixObj = placeOnCard && G.objectives?.find(o => o.id === 'that-makes-six' && !o.done);
  if (sixObj) {
    sixObj.heldTroops = (sixObj.heldTroops || 0) + 1;
    addLog(`Sure Shot: shadow troop held on card (${sixObj.heldTroops}/6).`);
    if (sixObj.heldTroops >= 6) {
      sixObj.done = true;
      gainHope(1, 'That Makes Six');
      addLog('✅ That Makes Six complete! +1 hope. 6 held troops returned to supply.');
      checkAfterObjectiveComplete();
    }
  } else {
    addLog(`Legolas: Sure Shot removes 1 shadow troop from ${LOCS[targetLocId].name}.`);
  }
  checkPassiveObjectives();
  return { ok: true };
}

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
  // Gandalf the White arrives on the next Skies Darken after the Balrog
  if (G.gandalfState === 'awaiting-white') {
    G.gandalfState = 'white';
    G.charState['gandalf'].alive = true;
    G.charState['gandalf'].location = 'lorien';
    gainHope(2, 'Gandalf the White arrives!');
    addLog('⚪ Gandalf the White has returned! He appears in Lórien. Gain 2 hope.');
  }
}

// ── DRAW SHADOW CARDS ─────────────────────────────────────────────────────────
function drawShadowCards() {
  if (G.phase !== 'draw-shadow') return;
  // Mouth of Sauron: Dark Emissary — demand tribute once per shadow phase
  if (G.shadowLieutenants.includes('mouth-of-sauron')) {
    G.ui.pendingMouthTribute = true;
  }
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
        // Gothmog: Commander's Reinforcement — extra troop in Mordor-region locations
        if (G.shadowLieutenants.includes('gothmog') && LOCS[spawnId]?.region === 'mordor' && G.shadowSupply > 0) {
          G.locState[spawnId].shadowTroops++;
          G.shadowSupply--;
          addLog(`  ⚔ Gothmog's Reinforcement: +1 extra shadow troop at ${LOCS[spawnId].name}!`);
        }
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
  if (G.currentPlayer === 0) processFreeLts();
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
