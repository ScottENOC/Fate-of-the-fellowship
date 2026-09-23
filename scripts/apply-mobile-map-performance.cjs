'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const indexPath = path.join(ROOT, 'index.html');
const testsPath = path.join(ROOT, 'tests', 'regression.cjs');
function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count === 0) { if (source.includes(after)) return source; throw new Error(`Missing anchor: ${label}`); }
  if (count !== 1) throw new Error(`Non-unique anchor (${count}): ${label}`);
  return source.replace(before, after);
}
let index = fs.readFileSync(indexPath, 'utf8');

index = replaceOnce(index,
`#menu-toggle-btn:hover{border-color:#c8a050;background:rgba(30,22,10,.97)}\n`,
`#menu-toggle-btn:hover{border-color:#c8a050;background:rgba(30,22,10,.97)}\n#mobile-action-sheet{display:none}\n.mobile-quick-btn{background:rgba(26,21,16,.96);border:1px solid #6a5020;color:#d4c4a0;border-radius:16px;padding:7px 10px;font-family:inherit;font-size:.76em;white-space:nowrap}\n.mobile-quick-btn:disabled{opacity:.35}\n.mobile-quick-btn.primary{border-color:#c8a050;color:#f0d080}\n`, 'mobile sheet base css');

index = replaceOnce(index,
`  #menu-toggle-btn{bottom:auto;top:8px;left:10px}\n}`,
`  #menu-toggle-btn{bottom:auto;top:8px;left:10px}\n  #mobile-action-sheet{display:flex;position:absolute;left:8px;right:8px;bottom:8px;z-index:18;background:rgba(14,12,8,.94);border:1px solid #4a3820;border-radius:12px;padding:8px;gap:6px;align-items:center;overflow-x:auto;box-shadow:0 4px 16px rgba(0,0,0,.55);backdrop-filter:blur(6px)}\n  #mobile-action-sheet .mobile-char-summary{min-width:116px;max-width:150px;font-size:.7em;color:#907850;line-height:1.25;flex-shrink:0}\n  #mobile-action-sheet .mobile-char-summary strong{display:block;color:#d4c4a0;font-size:1.08em}\n}`, 'portrait mobile sheet css');

index = replaceOnce(index,
`    <button id="menu-toggle-btn" onclick="toggleSidebar()">☰ Hide Menu</button>\n    <div id="map-wrap">`,
`    <button id="menu-toggle-btn" onclick="toggleSidebar()">☰ Hide Menu</button>\n    <div id="mobile-action-sheet"><div class="mobile-char-summary">Tap a character to show quick actions.</div></div>\n    <div id="map-wrap">`, 'mobile sheet html');

index = replaceOnce(index,
`let _cloudSaveTimer = null;\nfunction toggleSidebar() {`,
`let _cloudSaveTimer = null;\nlet _localSaveTimer = null;\nfunction toggleSidebar() {`, 'local save timer');
index = replaceOnce(index,
`function autoSave() {\n  if (!G || G.phase === 'gameover') return;\n  saveGame(); // always write localStorage immediately\n  if (G.roomCode) {\n    // debounce: send to Firebase 2s after last change\n    clearTimeout(_cloudSaveTimer);\n    _cloudSaveTimer = setTimeout(cloudSave, 2000);\n  }\n}`,
`function autoSave() {\n  if (!G || G.phase === 'gameover') return;\n  // Rendering/selecting UI can happen many times per second on touch devices.\n  // Debounce JSON serialisation so harmless selection changes do not repeatedly\n  // stringify the full game state. Manual Save still writes immediately.\n  clearTimeout(_localSaveTimer);\n  _localSaveTimer = setTimeout(saveGame, 250);\n  if (G.roomCode) {\n    clearTimeout(_cloudSaveTimer);\n    _cloudSaveTimer = setTimeout(cloudSave, 2000);\n  }\n}`, 'debounced autosave');

index = replaceOnce(index,
`function render() {\n  if (!G) return;`,
`function render() {\n  if (!G) return;`, 'render anchor noop');
index = replaceOnce(index,
`  try { renderActions(); } catch(e) { console.error('renderActions:', e); }\n  try { renderLog(); } catch(e) { console.error('renderLog:', e); }\n  try { renderMap(); } catch(e) { console.error('renderMap:', e); }`,
`  try { renderActions(); } catch(e) { console.error('renderActions:', e); }\n  try { renderMobileActionSheet(); } catch(e) { console.error('renderMobileActionSheet:', e); }\n  try { renderLog(); } catch(e) { console.error('renderLog:', e); }\n  try { renderMap(); } catch(e) { console.error('renderMap:', e); }`, 'render mobile sheet');

const mobileHelpers = `\nfunction centerMapOnLocation(locId, minZoom = 2.2) {\n  const loc = LOCS[locId];\n  const panel = document.getElementById('map-panel');\n  const svg = document.getElementById('map-svg');\n  if (!loc || !panel || !svg) return;\n  const zoom = Math.max(minZoom, mapView.zoom);\n  const x = (loc.x / 100) * (svg.offsetWidth || panel.offsetWidth);\n  const y = (loc.y / 100) * (svg.offsetHeight || panel.offsetHeight);\n  mapView.zoom = zoom;\n  mapView.panX = panel.offsetWidth / 2 - x * zoom;\n  mapView.panY = panel.offsetHeight / 2 - y * zoom;\n  clampPan(); applyMapTransform();\n}\n\nfunction centerOnActiveCharacter() {\n  if (!G) return;\n  const p = G.players[myPlayerIdx()] || G.players[G.currentPlayer];\n  const cid = UI.selectedChar || G.turn?.primaryChar || p?.chars?.find(id => G.charState?.[id]?.alive);\n  const locId = cid && G.charState?.[cid]?.location;\n  if (locId) centerMapOnLocation(locId);\n}\n\nfunction openFullActionsMobile() {\n  const sidebar = document.getElementById('sidebar');\n  sidebar?.classList.remove('menu-hidden');\n  const btn = document.getElementById('menu-toggle-btn');\n  if (btn) btn.textContent = '☰ Hide Menu';\n  document.getElementById('action-grid')?.scrollIntoView({ behavior:'smooth', block:'center' });\n}\n\nfunction renderMobileActionSheet() {\n  const el = document.getElementById('mobile-action-sheet');\n  if (!el || !G) return;\n  const cid = UI.selectedChar;\n  if (!cid || !CHARS[cid] || !G.charState?.[cid]) {\n    el.innerHTML = '<div class="mobile-char-summary">Tap a character to show quick actions.</div><button class="mobile-quick-btn" onclick="centerOnActiveCharacter()">◎ Centre</button>';\n    return;\n  }\n  const cs = G.charState[cid];\n  const loc = G.locState[cs.location];\n  const left = G.turn?.charActions?.[cid] ?? G.players[myPlayerIdx()]?.actionsPerChar ?? 4;\n  const can = canAct(cid);\n  const friendly = loc ? Object.values(loc.friendly || {}).reduce((a,b)=>a+b,0) : 0;\n  const hasRegionCard = (G.players[myPlayerIdx()]?.hand || []).some(c => c.type === 'region');\n  const travelOK = can && validTravelTargets(cid).length > 0;\n  const prepareOK = can && !!loc?.isHaven && hasRegionCard;\n  const musterOK = can && !!LOCS[cs.location]?.musterType && !loc?.isShadowStronghold;\n  const attackOK = can && friendly > 0 && (loc?.shadowTroops || 0) > 0;\n  const captureOK = can && !!LOCS[cs.location]?.capturable && (loc?.shadowTroops || 0) === 0 && friendly > 0;\n  const summary = '<div class="mobile-char-summary"><strong>'+CHARS[cid].name+'</strong>'+ (LOCS[cs.location]?.name || cs.location) +' · '+left+' action'+(left===1?'':'s')+'</div>';\n  const btn = (label, action, ok, primary=false) => '<button class="mobile-quick-btn'+(primary?' primary':'')+'" '+(ok?'':'disabled ')+'onclick="clickAction(\\''+action+'\\')">'+label+'</button>';\n  el.innerHTML = summary +\n    btn('Travel','travel',travelOK,true) +\n    btn('Prepare','prepare',prepareOK) +\n    btn('Muster','muster',musterOK) +\n    btn('Attack','attack',attackOK) +\n    (captureOK ? btn('Capture','capture',true) : '') +\n    '<button class="mobile-quick-btn" onclick="centerOnActiveCharacter()">◎ Centre</button>' +\n    '<button class="mobile-quick-btn" onclick="openFullActionsMobile()">More…</button>';\n}\n`;
index = replaceOnce(index,
`function resetUI() {\n  UI.selectedChar = null; UI.pendingAction = null;`,
mobileHelpers + `\nfunction resetUI() {\n  UI.selectedChar = null; UI.pendingAction = null;`, 'mobile helper functions');

index = replaceOnce(index,
`// ── MAP RENDERING ─────────────────────────────────────────────────────────────\nfunction renderMap() {\n  renderConnections();\n  renderBattleLines();\n  renderLocations();`,
`// ── MAP RENDERING ─────────────────────────────────────────────────────────────\nlet mapStaticBuilt = false;\nfunction renderMap() {\n  if (!mapStaticBuilt) {\n    renderConnections();\n    renderBattleLines();\n    mapStaticBuilt = true;\n  }\n  renderLocations();`, 'static map rendering');

index = replaceOnce(index,
`window.addEventListener('resize', () => { if (G) { alignSvgToImage(); render(); } });`,
`window.addEventListener('resize', () => { if (G) { alignSvgToImage(); render(); } });`, 'resize anchor noop');

fs.writeFileSync(indexPath, index);

let tests = fs.readFileSync(testsPath, 'utf8');
const anchor = `test('Legacy boon definitions have implementation references', () => {`;
const addition = `test('UI render keeps static map layers cached and autosave debounced', () => {\n  assert.ok(indexSource.includes('let mapStaticBuilt = false;'));\n  assert.ok(indexSource.includes('if (!mapStaticBuilt)'));\n  assert.ok(indexSource.includes('_localSaveTimer = setTimeout(saveGame, 250)'));\n  assert.ok(indexSource.includes('renderMobileActionSheet()'));\n  assert.ok(indexSource.includes('centerOnActiveCharacter()'));\n});\n\n`;
if (!tests.includes("test('UI render keeps static map layers cached")) {
  if (!tests.includes(anchor)) throw new Error('test anchor missing');
  tests = tests.replace(anchor, addition + anchor);
}
fs.writeFileSync(testsPath, tests);
console.log('Mobile/map performance patch applied.');
