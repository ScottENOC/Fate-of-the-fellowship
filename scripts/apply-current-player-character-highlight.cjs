'use strict';
const fs=require('node:fs');
const p='index.html';
let s=fs.readFileSync(p,'utf8');
const old=`      if (isSelected) {\n        g.appendChild(svgEl('circle',{cx,cy,r:1.9,fill:'none',stroke:'#ffffff','stroke-width':0.5,opacity:0.9}));\n      }\n      g.appendChild(svgEl('circle',{cx,cy,r:1.4,fill:c.color,stroke:'#00000088','stroke-width':0.3,opacity:0.95}));`;
const neu=`      if (isCurrentPlayer) {\n        g.appendChild(svgEl('circle',{cx,cy,r:1.9,fill:'none',stroke:'#c8a050','stroke-width':0.45,opacity:0.88}));\n      }\n      if (isSelected) {\n        g.appendChild(svgEl('circle',{cx,cy,r:2.25,fill:'none',stroke:'#ffffff','stroke-width':0.5,opacity:0.95}));\n      }\n      g.appendChild(svgEl('circle',{cx,cy,r:1.4,fill:c.color,stroke:isCurrentPlayer?'#f0d080':'#00000088','stroke-width':isCurrentPlayer?0.38:0.3,opacity:0.95}));`;
if(!s.includes(old)) throw new Error('character marker anchor missing');
s=s.replace(old,neu);
fs.writeFileSync(p,s);

const tp='tests/regression.cjs';
let t=fs.readFileSync(tp,'utf8');
const marker="test('compact portrait hand wiring is present', () => {";
if(!t.includes(marker)) throw new Error('regression insertion anchor missing');
const test=`\ntest('current player characters have persistent map highlight', () => {\n  assert.ok(indexSource.includes("if (isCurrentPlayer) {"));\n  assert.ok(indexSource.includes("stroke:'#c8a050','stroke-width':0.45,opacity:0.88"));\n  assert.ok(indexSource.includes("stroke:isCurrentPlayer?'#f0d080':'#00000088'"));\n  assert.ok(indexSource.includes("r:2.25,fill:'none',stroke:'#ffffff'"));\n});\n`;
t=t.replace(marker,test+'\n'+marker);
fs.writeFileSync(tp,t);
