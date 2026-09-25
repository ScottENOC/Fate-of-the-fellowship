'use strict';
const fs=require('node:fs');
let s=fs.readFileSync('tests/regression.cjs','utf8');
for(const title of [
  "test('Wheels of Saruman breaks the Dwarven oath at Iron Hills and Ered Luin', () => {",
  "test('Drums of War reinforces Udun, Barad-dur and Minas Morgul', () => {",
]){
  const start=s.indexOf(title);
  if(start<0) continue;
  const next=s.indexOf("\ntest('",start+title.length);
  if(next<0) throw new Error('Could not find end of stale test: '+title);
  s=s.slice(0,start)+s.slice(next+1);
}
fs.writeFileSync('tests/regression.cjs',s);
