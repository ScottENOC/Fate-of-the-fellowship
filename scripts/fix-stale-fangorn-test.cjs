'use strict';
const fs=require('fs');
const p='tests/regression.cjs';
let s=fs.readFileSync(p,'utf8');
const old=`test('Fangorn and Edoras have a white player-only connection', () => {\n  const ctx=makeContext();\n  assert.equal(evalIn(ctx,"CONNECTIONS.some(c=>((c.a==='fangorn'&&c.b==='edoras')||(c.a==='edoras'&&c.b==='fangorn'))&&c.type==='normal')"),true);\n  assert.equal(evalIn(ctx,"BATTLE_LINES.some(bl=>bl.locs.some((x,i)=>x==='fangorn'&&bl.locs[i+1]==='edoras'))"),false);\n});\n\n`;
if(!s.includes(old)) throw new Error('stale Fangorn regression not found');
s=s.replace(old,'');
fs.writeFileSync(p,s);
