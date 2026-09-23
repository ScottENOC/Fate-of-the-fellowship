'use strict';
const fs = require('node:fs');
const p = 'index.html';
let s = fs.readFileSync(p, 'utf8');
function rep(oldText,newText,label){ if(!s.includes(oldText)) throw new Error('missing anchor: '+label); s=s.replace(oldText,newText); }

// Portrait density: compact character grid, tighter action hint, three-column actions.
rep(
  '  #middle{padding-bottom:12px}\n',
  '  #middle{padding:6px 8px 10px;gap:5px}\n  #char-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:4px}\n',
  'portrait middle/char grid'
);
rep(
  '  .action-btn{padding:9px 6px}\n',
  '  .actions-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}\n  .action-btn{padding:7px 4px;min-height:40px}\n  #action-hint{min-height:0!important;margin-bottom:1px!important;line-height:1.15}\n',
  'portrait action grid'
);
rep(
  '  .char-card{padding:9px 10px}\n',
  '  .char-card{padding:6px 8px;min-height:40px}\n  .char-card .char-name{font-size:.8em}\n  .char-card .char-loc{font-size:.68em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:22px}\n  .char-card .char-actions-left{top:6px;right:7px}\n',
  'portrait char compact'
);

// Remove persistent Nazgul summary from drawer; keep Eye in compact HUD.
rep(
  '        <div id="nazgul-row" style="font-size:.75em;color:#806040;padding:4px 0">Nazgûl: loading…</div>\n',
  '',
  'remove nazgul row html'
);
rep(
  "  // Nazgûl summary\n  const naz = Object.entries(G.nazgul).filter(([,v])=>v>0).map(([k,v])=>`${REGIONS[k]?.name||k}:${v}`).join(' · ');\n  document.getElementById('nazgul-row').textContent = `Nazgûl: ${naz} | Eye: ${REGIONS[G.eyeRegion]?.name||G.eyeRegion}`;\n",
  '',
  'remove nazgul summary render'
);

// Reusable Nazgul distribution modal for touch devices.
const eyeAnchor = "function renderEyeAndNazgul(layer) {";
rep(
  eyeAnchor,
  `function showNazgulDistribution() {\n  if (!G) return;\n  const rows = Object.entries(G.nazgul || {})\n    .filter(([,count]) => count > 0)\n    .sort(([a],[b]) => (REGIONS[a]?.name || a).localeCompare(REGIONS[b]?.name || b))\n    .map(([id,count]) => '<div style=\"display:flex;justify-content:space-between;gap:16px;padding:5px 0;border-bottom:1px solid #2a2010\"><span>'+escapeHtml(REGIONS[id]?.name || id)+'</span><strong>'+count+'</strong></div>')\n    .join('');\n  showModal('Nazgûl', rows || 'No Nazgûl are currently on the map.');\n}\n\n${eyeAnchor}`,
  'nazgul modal'
);

// Eye itself opens the same touch-friendly distribution.
rep(
  "    g.style.cursor = 'default';\n",
  "    g.style.cursor = 'pointer';\n    g.onclick = e => { e.stopPropagation(); showNazgulDistribution(); };\n",
  'eye click'
);

// Nazgul badges should also be clickable, with a larger invisible hit target.
rep(
  "    const g = svgEl('g',{});\n    g.appendChild(svgEl('circle',{cx:rc.x, cy:rc.y, r:1.6,\n",
  "    const g = svgEl('g',{cursor:'pointer'});\n    g.style.pointerEvents = 'all';\n    g.onclick = e => { e.stopPropagation(); showNazgulDistribution(); };\n    g.appendChild(svgEl('circle',{cx:rc.x,cy:rc.y,r:2.8,fill:'transparent',stroke:'none',class:'touch-hit'}));\n    g.appendChild(svgEl('circle',{cx:rc.x, cy:rc.y, r:1.6,\n",
  'nazgul badge click'
);

fs.writeFileSync(p,s);

const tp='tests/regression.cjs';
let t=fs.readFileSync(tp,'utf8');
const marker = "test('iPhone map-first UI wiring is present', () => {";
if(!t.includes(marker)) throw new Error('missing iphone regression test');
const insert = `\ntest('compact iPhone drawer and touch Nazgul wiring are present', () => {\n  assert.ok(indexSource.includes('grid-template-columns:repeat(auto-fit,minmax(118px,1fr))'));\n  assert.ok(indexSource.includes('grid-template-columns:repeat(3,minmax(0,1fr))'));\n  assert.ok(indexSource.includes('function showNazgulDistribution()'));\n  assert.ok(indexSource.includes("g.onclick = e => { e.stopPropagation(); showNazgulDistribution(); };"));\n  assert.ok(!indexSource.includes('id="nazgul-row"'));\n  assert.ok(indexSource.includes('#action-hint{min-height:0!important;margin-bottom:1px!important;line-height:1.15}'));\n});\n`;
t = t.replace(marker, insert + '\n' + marker);
fs.writeFileSync(tp,t);
