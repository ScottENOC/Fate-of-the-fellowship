'use strict';
const fs = require('node:fs');
function between(src,a,b,repl,label){const i=src.indexOf(a),j=src.indexOf(b,i);if(i<0||j<0)throw new Error('missing '+label);return src.slice(0,i)+repl+src.slice(j);}

let data=fs.readFileSync('data.js','utf8');
const shadowBlock = `// ── SHADOW DECK ──────────────────────────────────────────────────────────────
// Reconstruction of the physical 48-card ordinary Shadow deck.
// Every ordinary front contains both an Advance route and a Reinforce location.
// The back of the newly exposed NEXT card selects which half resolves:
// red flag = Advance, black banner = Reinforce.
// This front distribution is deliberately marked reconstructed until a verified
// card-by-card transcription becomes available.
const SHADOW_ROUTE_SPECS = [
  { key:'umbar-pink', start:'umbar', lineColor:'pink', lineId:'pink', destination:'grey-havens' },
  { key:'umbar-purple', start:'umbar', lineColor:'purple', lineId:'purple', destination:'helms-deep' },
  { key:'umbar-orange', start:'umbar', lineColor:'orange', lineId:'orange-c', destination:'helms-deep' },
  { key:'near-harad-teal', start:'near-harad', lineColor:'teal', lineId:'teal', destination:'erebor' },
  { key:'near-harad-purple', start:'near-harad', lineColor:'purple', lineId:'purple-b', destination:'helms-deep' },
  { key:'near-harad-orange', start:'near-harad', lineColor:'orange', lineId:'orange-d', destination:'helms-deep' },
  { key:'nurn-teal', start:'nurn', lineColor:'teal', lineId:'teal-b', destination:'erebor' },
  { key:'nurn-yellow', start:'nurn', lineColor:'yellow', lineId:'yellow-c', destination:'minas-tirith' },
  { key:'nurn-purple', start:'nurn', lineColor:'purple', lineId:'purple-c', destination:'helms-deep' },
  { key:'rhun-pink', start:'rhun', lineColor:'pink', lineId:'pink-c', destination:'woodland-realm' },
  { key:'rhun-orange', start:'rhun', lineColor:'orange', lineId:'orange-e', destination:'woodland-realm' },
  { key:'rhun-yellow', start:'rhun', lineColor:'yellow', lineId:'yellow-d', destination:'minas-tirith' },
  { key:'dol-guldur-teal', start:'dol-guldur', lineColor:'teal', lineId:'teal', destination:'erebor' },
  { key:'dol-guldur-yellow', start:'dol-guldur', lineColor:'yellow', lineId:'yellow-e', destination:'minas-tirith' },
  { key:'dol-guldur-green', start:'dol-guldur', lineColor:'green', lineId:'green4', destination:'helms-deep' },
  { key:'moria-teal', start:'moria', lineColor:'teal', lineId:'teal-c', destination:'erebor' },
  { key:'moria-yellow', start:'moria', lineColor:'yellow', lineId:'yellow-b', destination:'rivendell' },
  { key:'moria-green', start:'moria', lineColor:'green', lineId:'green', destination:'rivendell' },
  { key:'isengard-pink', start:'isengard', lineColor:'pink', lineId:'pink-b', destination:'grey-havens' },
  { key:'isengard-yellow', start:'isengard', lineColor:'yellow', lineId:'yellow', destination:'rivendell' },
  { key:'isengard-orange', start:'isengard', lineColor:'orange', lineId:'orange-b', destination:'helms-deep' },
];
const EXTRA_SHADOW_ROUTE_SPECS = [
  { key:'dunland-grey-extra', start:'dunland', lineColor:'grey', lineId:'grey', destination:'grey-havens', back:'red' },
  { key:'dunland-yellow-extra', start:'dunland', lineColor:'yellow', lineId:'yellow', destination:'rivendell', back:'black' },
  { key:'dunland-orange-extra', start:'dunland', lineColor:'orange', lineId:'orange', destination:'helms-deep', back:'red' },
  { key:'minas-morgul-purple-extra', start:'minas-morgul', lineColor:'purple', lineId:'purple-c', destination:'helms-deep', back:'black' },
  { key:'minas-morgul-yellow-extra', start:'minas-morgul', lineColor:'yellow', lineId:'yellow-c', destination:'minas-tirith', back:'red' },
  { key:'barad-dur-teal-extra', start:'barad-dur', lineColor:'teal', lineId:'teal-b', destination:'erebor', back:'black' },
];
const APPROX_SHADOW_ORDERS=['eye-to-frodo','move-2-nazgul','deploy-nazgul'];
function makeApproxShadowFront(spec,idSuffix,back,orderIndex){
  return {id:'sh-'+spec.key+'-'+idSuffix,type:'shadow',name:(LOCS[spec.start]?.name||spec.start)+' → '+(LOCS[spec.destination]?.name||spec.destination),location:spec.start,spawnLoc:spec.start,lineColor:spec.lineColor,lineId:spec.lineId,destination:spec.destination,back,specialOrder:APPROX_SHADOW_ORDERS[orderIndex%APPROX_SHADOW_ORDERS.length],reconstructed:true};
}
const NORMAL_SHADOW_CARDS=[];
SHADOW_ROUTE_SPECS.forEach((spec,i)=>{NORMAL_SHADOW_CARDS.push(makeApproxShadowFront(spec,'r','red',i*2));NORMAL_SHADOW_CARDS.push(makeApproxShadowFront(spec,'b','black',i*2+1));});
EXTRA_SHADOW_ROUTE_SPECS.forEach((spec,i)=>NORMAL_SHADOW_CARDS.push(makeApproxShadowFront(spec,'x',spec.back,SHADOW_ROUTE_SPECS.length*2+i)));
const SPECIAL_SHADOW_CARDS=[
  {id:'special-drums-of-war',type:'special-shadow',name:'The Drums of War',back:'black',effect:'drums',text:'Add 1 shadow troop to Udûn, Barad-dûr, and Minas Morgul.'},
  {id:'special-wheels-of-saruman',type:'special-shadow',name:'The Wheels of Saruman',back:'red',effect:'wheels',text:'Break Oath (approximation): remove 2 friendly troops from the outer realms.'},
];
function makeShadowDeck(){return shuffle(NORMAL_SHADOW_CARDS.map(c=>({...c})));}

`;
data=between(data,'// ── SHADOW DECK ──────────────────────────────────────────────────────────────','// ── SHADOW LIEUTENANTS ───────────────────────────────────────────────────────',shadowBlock,'shadow data block');
fs.writeFileSync('data.js',data);

let engine=fs.readFileSync('engine.js','utf8');
engine=engine.replace("    shadowSupply: Math.max(0, 45 - 18 - (9 + extraSetupDraws) - Math.max(0, boons['shadow-troop'] || 0)), // legacy boon removes reserve troops","    shadowSupply: Math.max(0, 48 - 18 - (9 + extraSetupDraws) - Math.max(0, boons['shadow-troop'] || 0)), // physical game has 48 shadow troops; legacy boon removes reserve troops");
engine=engine.replace('    shadowDiscard: [...shadowSetupDiscard],','    shadowDiscard: [...shadowSetupDiscard, ...SPECIAL_SHADOW_CARDS.map(c => ({...c}))],');
const rs=engine.indexOf('function resolveShadowCard(card) {'),re=engine.indexOf('function resolveAdvance() {',rs);if(rs<0||re<0)throw new Error('missing resolveShadowCard');
const resolver=`function resolveShadowCard(card) {
  if (card.type === 'special-shadow') { resolveSpecialShadow(card); return; }
  const selectorBack = G.shadowDeck[G.shadowDeck.length - 1]?.back || card.back || 'black';
  if (selectorBack === 'red') {
    addLog('  Red flag exposed — ADVANCE '+(LOCS[card.location]?.name||card.location)+' → '+(LOCS[card.destination]?.name||card.destination)+' ('+card.lineColor+').');
    advanceShadowRoute(card);
  } else {
    addLog('  Black banner exposed — REINFORCE '+(LOCS[card.location]?.name||card.location)+'.');
    resolveReinforce(card);
  }
}
function advanceShadowRoute(card) {
  const line=BATTLE_LINES.find(bl=>bl.id===card.lineId);
  if(!line){addLog('  Missing battle line '+card.lineId+'; no advance.');return;}
  const startIdx=line.locs.indexOf(card.location),endIdx=line.locs.indexOf(card.destination);
  if(startIdx<0||endIdx<=startIdx){addLog('  Invalid reconstructed route '+card.location+' → '+card.destination+'; no advance.');return;}
  const route=line.locs.slice(startIdx,endIdx+1);
  for(let i=route.length-2;i>=0;i--){const from=route[i],to=route[i+1],fls=G.locState[from];if(!fls||fls.shadowTroops<=0)continue;const n=fls.shadowTroops;fls.shadowTroops=0;G.locState[to].shadowTroops+=n;addLog('  '+LOCS[from].name+' → '+LOCS[to].name+': '+n+' troop(s)');}
  for(let i=route.length-1;i>=0;i--){const locId=route[i],ls=G.locState[locId],tf=totalFriendlyAt(locId);if(ls.shadowTroops>0&&tf>0){addLog('Battle at '+LOCS[locId].name+'!');rollBattle(locId,ls.shadowTroops,null);}else checkHavenLost(locId);}
}

`;
engine=engine.slice(0,rs)+resolver+engine.slice(re);
engine=engine.replace("  } else if (order === 'nazgul-closer' || order === 'move-closest') {\n    // Move the Nazgûl closest to Frodo (from outside his region) 1 step toward him\n    moveNazgulCloser(1);","  } else if (order === 'move-2-nazgul') {\n    moveNazgulCloser(2);\n  } else if (order === 'nazgul-closer' || order === 'move-closest') {\n    // Move the Nazgûl closest to Frodo (from outside his region) 1 step toward him\n    moveNazgulCloser(1);");
const ss=engine.indexOf('function resolveSpecialShadow(card) {'),se=engine.indexOf('// ── EVENT CARD EFFECTS',ss);if(ss<0||se<0)throw new Error('missing resolveSpecialShadow');
const special=`function resolveSpecialShadow(card) {
  if (card.effect === 'drums') {
    addLog('DRUMS OF WAR! +1 at Udûn, Barad-dûr, and Minas Morgul.');
    for (const locId of ['udun','barad-dur','minas-morgul']) {
      if (G.shadowSupply > 0) { G.locState[locId].shadowTroops++; G.shadowSupply--; if (totalFriendlyAt(locId)>0) rollBattle(locId,G.locState[locId].shadowTroops,null); else checkHavenLost(locId); }
      else loseHope(1,'Shadow supply empty');
    }
    return;
  }
  if (card.effect === 'wheels') {
    addLog('WHEELS OF SARUMAN! Break Oath (approximation).');
    const oathLocs=['grey-havens','ered-luin','iron-hills','dol-amroth']; let removed=0;
    for(const locId of oathLocs){if(removed>=2)break;const friendly=G.locState[locId]?.friendly;if(!friendly)continue;const type=Object.keys(friendly).find(k=>friendly[k]>0);if(!type)continue;friendly[type]--;G.troopSupply[type]=(G.troopSupply[type]||0)+1;removed++;addLog('  Break Oath: removed 1 '+type+' troop from '+LOCS[locId].name+'.');}
    if(removed<2)addLog('  Break Oath removed only '+removed+' troop(s); no eligible outer-realm troops remained.');
  }
}

`;
engine=engine.slice(0,ss)+special+engine.slice(se);
fs.writeFileSync('engine.js',engine);

let tests=fs.readFileSync('tests/regression.cjs','utf8');
tests=tests.replace("  assert.equal(g.shadowDiscard.length, 9, 'standard setup should draw 9 shadow cards');","  assert.equal(g.shadowDiscard.length, 11, 'standard setup should draw 9 ordinary shadow cards and seed 2 specials in discard');\n  assert.equal(g.shadowDeck.length, 39, '48 ordinary cards minus 9 setup draws should leave 39');");
tests=tests.replace("  assert.equal(g.shadowDiscard.length, 11, 'Legendary+4 should add 2 setup draws');","  assert.equal(g.shadowDiscard.length, 13, 'Legendary+4 should have 11 setup draws plus 2 seeded specials');");
const anchor="test('Shadow Burdens are tier-gated, unique and modify setup state', () => {";if(!tests.includes(anchor))throw new Error('missing test anchor');
const add=`test('reconstructed Shadow deck has 48 ordinary cards split evenly by back', () => {
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
  assert.deepEqual(g.shadowDiscard.filter(c=>c.type==='special-shadow').map(c=>c.effect).sort(),['drums','wheels']);
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

test('Drums of War reinforces Udun, Barad-dur and Minas Morgul', () => {
  const ctx=makeContext(); startGame(ctx,{numPlayers:1,playerNames:['Tester'],charAssignment:[['frodo-sam','aragorn']],difficulty:'standard',cardPrefs:{},boons:{}});
  vm.runInContext("G.locState.udun.shadowTroops=0;G.locState['barad-dur'].shadowTroops=0;G.locState['minas-morgul'].shadowTroops=0;G.shadowSupply=10;resolveSpecialShadow(SPECIAL_SHADOW_CARDS.find(c=>c.effect==='drums'));",ctx);
  assert.equal(evalIn(ctx,'G.locState.udun.shadowTroops'),1);assert.equal(evalIn(ctx,"G.locState['barad-dur'].shadowTroops"),1);assert.equal(evalIn(ctx,"G.locState['minas-morgul'].shadowTroops"),1);
});

`;
tests=tests.replace(anchor,add+anchor);
fs.writeFileSync('tests/regression.cjs',tests);
