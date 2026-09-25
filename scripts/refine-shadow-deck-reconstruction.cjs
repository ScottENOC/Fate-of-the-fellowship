'use strict';
const fs=require('node:fs');

let data=fs.readFileSync('data.js','utf8');
const old="  { key:'dunland-grey-extra', start:'dunland', lineColor:'grey', lineId:'grey', destination:'grey-havens', back:'red' },";
const repl="  // Internally this legacy battle-line id is 'grey', but the line is visually purple on the board.\n  { key:'dunland-purple-extra', start:'dunland', lineColor:'purple', lineId:'grey', destination:'grey-havens', back:'red' },";
if(!data.includes(old)) throw new Error('Dunland legacy route anchor missing');
data=data.replace(old,repl);

const connAnchor="  { a:'edoras',        b:'eastemnet',         type:'normal' },";
if(!data.includes(connAnchor)) throw new Error('Edoras connection anchor missing');
data=data.replace(connAnchor,connAnchor+"\n  { a:'fangorn',       b:'edoras',             type:'normal' }, // white player-only connection; not a Shadow battle line");

data=data.replace("text:'Break Oath (approximation): remove 2 friendly troops from the outer realms.'","text:'Break Oath: remove 1 Dwarven troop from Iron Hills and 1 from Ered Luin.'");
fs.writeFileSync('data.js',data);

let engine=fs.readFileSync('engine.js','utf8');
const start=engine.indexOf("  if (card.effect === 'wheels') {");
const end=engine.indexOf('\n  }\n}\n\n// ── EVENT CARD EFFECTS',start);
if(start<0||end<0) throw new Error('Wheels function anchors missing');
const wheels=`  if (card.effect === 'wheels') {
    addLog('WHEELS OF SARUMAN! Break Oath.');
    for (const locId of ['iron-hills','ered-luin']) {
      const friendly=G.locState[locId]?.friendly;
      if (!friendly || (friendly.dwarven||0) <= 0) {
        addLog('  Break Oath: no Dwarven troop at '+LOCS[locId].name+' to remove.');
        continue;
      }
      friendly.dwarven--;
      G.troopSupply.dwarven=(G.troopSupply.dwarven||0)+1;
      addLog('  Break Oath: removed 1 Dwarven troop from '+LOCS[locId].name+'.');
    }
  }`;
engine=engine.slice(0,start)+wheels+engine.slice(end+4);
fs.writeFileSync('engine.js',engine);

let tests=fs.readFileSync('tests/regression.cjs','utf8');
const finalAnchor="test('Drums of War reinforces Udun, Barad-dur and Minas Morgul', () => {";
if(!tests.includes(finalAnchor)) throw new Error('test anchor missing');
const extra=`test('Dunland reconstructed routes use purple, yellow and orange', () => {
  const ctx=makeContext();
  const rows=evalIn(ctx,"NORMAL_SHADOW_CARDS.filter(c=>c.location==='dunland').map(c=>c.lineColor).sort()");
  assert.deepEqual(Array.from(rows),['orange','purple','yellow']);
});

test('Fangorn and Edoras have a white player-only connection', () => {
  const ctx=makeContext();
  assert.equal(evalIn(ctx,"CONNECTIONS.some(c=>((c.a==='fangorn'&&c.b==='edoras')||(c.a==='edoras'&&c.b==='fangorn'))&&c.type==='normal')"),true);
  assert.equal(evalIn(ctx,"BATTLE_LINES.some(bl=>bl.locs.some((x,i)=>x==='fangorn'&&bl.locs[i+1]==='edoras'))"),false);
});

test('Wheels of Saruman breaks the Dwarven oath at Iron Hills and Ered Luin', () => {
  const ctx=makeContext(); startGame(ctx,{numPlayers:1,playerNames:['Tester'],charAssignment:[['frodo-sam','aragorn']],difficulty:'standard',cardPrefs:{},boons:{}});
  vm.runInContext("G.locState['iron-hills'].friendly.dwarven=1;G.locState['ered-luin'].friendly.dwarven=1;resolveSpecialShadow(SPECIAL_SHADOW_CARDS.find(c=>c.effect==='wheels'));",ctx);
  assert.equal(evalIn(ctx,"G.locState['iron-hills'].friendly.dwarven"),0);
  assert.equal(evalIn(ctx,"G.locState['ered-luin'].friendly.dwarven"),0);
});

`;
tests=tests.replace(finalAnchor,extra+finalAnchor);
fs.writeFileSync('tests/regression.cjs',tests);
