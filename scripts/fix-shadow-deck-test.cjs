'use strict';
const fs=require('node:fs');
const p='tests/regression.cjs';
let s=fs.readFileSync(p,'utf8');
const old="  assert.deepEqual(g.shadowDiscard.filter(c=>c.type==='special-shadow').map(c=>c.effect).sort(),['drums','wheels']);";
const repl="  assert.deepEqual(Array.from(g.shadowDiscard.filter(c=>c.type==='special-shadow').map(c=>c.effect).sort()),['drums','wheels']);";
if(!s.includes(old)) throw new Error('assertion anchor missing');
s=s.replace(old,repl);
fs.writeFileSync(p,s);
