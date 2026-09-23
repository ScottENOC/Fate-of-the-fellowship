'use strict';
const fs=require('node:fs');
const p='index.html';
let s=fs.readFileSync(p,'utf8');
function rep(a,b,label){if(!s.includes(a))throw new Error('missing anchor: '+label);s=s.replace(a,b);}
rep(
"  .card-item{padding:9px 10px}\n",
"  .hand-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:4px}\n  .card-item{padding:6px 8px;min-height:40px;font-size:.74em;justify-content:flex-start;gap:6px;line-height:1.15;overflow:hidden}\n  .card-item .card-sym{flex:0 0 auto}\n  .card-item{white-space:nowrap;text-overflow:ellipsis}\n",
'portrait hand density'
);
fs.writeFileSync(p,s);

const tp='tests/regression.cjs';
let t=fs.readFileSync(tp,'utf8');
const marker="test('compact iPhone drawer and touch Nazgul wiring are present', () => {";
if(!t.includes(marker)) throw new Error('missing compact iphone regression test');
const insert=`\ntest('compact portrait hand wiring is present', () => {\n  assert.ok(indexSource.includes('grid-template-columns:repeat(auto-fit,minmax(132px,1fr))'));\n  assert.ok(indexSource.includes('.card-item{padding:6px 8px;min-height:40px;font-size:.74em;justify-content:flex-start;gap:6px;line-height:1.15;overflow:hidden}'));\n});\n`;
t=t.replace(marker,insert+'\n'+marker);
fs.writeFileSync(tp,t);
