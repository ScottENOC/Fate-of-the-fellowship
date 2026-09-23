'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const testsPath = path.join(root, 'tests', 'regression.cjs');

function mustReplace(src, before, after, label) {
  if (!src.includes(before)) throw new Error('Missing anchor: ' + label);
  return src.replace(before, after);
}

let s = fs.readFileSync(indexPath, 'utf8');

// Safe areas + cleaner mobile CSS, replacing the duplicated quick-action rules and old 52/48 split.
const dupStart = s.indexOf('#mobile-action-sheet{display:none}');
const portraitStart = s.indexOf('/* ── PORTRAIT / NARROW LAYOUT ── */');
const lobbyStart = s.indexOf('/* ── LOBBY SCREEN ── */');
if (dupStart < 0 || portraitStart < 0 || lobbyStart < 0) throw new Error('Mobile CSS anchors missing');
const mobileCss = `#mobile-status-hud{display:none}\n#mobile-action-sheet{display:none}\n.mobile-quick-btn{background:rgba(26,21,16,.97);border:1px solid #6a5020;color:#d4c4a0;border-radius:18px;min-height:44px;padding:8px 13px;font-family:inherit;font-size:.78em;white-space:nowrap;touch-action:manipulation}\n.mobile-quick-btn.primary{border-color:#c8a050;color:#f0d080}\n.mobile-quick-btn.more{border-color:#806040}\n.mobile-task{min-width:130px;max-width:165px;font-size:.72em;color:#a89068;line-height:1.25;flex-shrink:0}\n.mobile-task strong{display:block;color:#ead8a8;font-size:1.08em;margin-bottom:2px}\n#sidebar.menu-hidden{display:none}\n\n/* ── PORTRAIT / NARROW LAYOUT ── */\n@media (orientation:portrait){\n  body{height:100dvh}\n  #setup{height:100dvh;padding-top:calc(20px + env(safe-area-inset-top));padding-bottom:calc(28px + env(safe-area-inset-bottom))}\n  #game{position:relative;display:flex;flex-direction:column;height:100dvh}\n  #map-panel{height:100%;flex:1}\n  #sidebar{position:fixed;left:0;right:0;bottom:0;z-index:45;width:100%;min-width:0;height:min(68dvh,620px);border-left:none;border-top:1px solid #6a5020;border-radius:18px 18px 0 0;box-shadow:0 -8px 30px rgba(0,0,0,.7);padding-bottom:env(safe-area-inset-bottom)}\n  #sidebar.menu-hidden{display:none}\n  #middle{padding-bottom:12px}\n  #log-area{display:none}\n  #top-bar{padding:8px 12px;gap:4px}\n  .track-row{font-size:.8em}\n  .track-bar{height:9px}\n  #nazgul-row,#supply-row{font-size:.7em}\n  .setup-card{width:calc(100vw - 32px);max-width:460px}\n  #toast{bottom:calc(88px + env(safe-area-inset-bottom));max-width:calc(100vw - 24px);white-space:normal;text-align:center}\n  #menu-toggle-btn{top:calc(8px + env(safe-area-inset-top));left:calc(8px + env(safe-area-inset-left));bottom:auto;min-width:44px;min-height:44px;padding:8px 12px;border-radius:22px}\n  #map-toggles{top:calc(8px + env(safe-area-inset-top));right:calc(8px + env(safe-area-inset-right))}\n  #map-toggles-btn{width:44px;height:44px;border-radius:22px;font-size:18px}\n  #map-toggles-menu{top:50px}\n  #mobile-status-hud{display:flex;position:absolute;z-index:17;top:calc(60px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);align-items:center;gap:8px;background:rgba(14,12,8,.92);border:1px solid #4a3820;border-radius:18px;padding:7px 11px;font-size:.72em;color:#c8b080;box-shadow:0 3px 14px rgba(0,0,0,.45);backdrop-filter:blur(6px);max-width:calc(100vw - 110px);white-space:nowrap}\n  #mobile-status-hud strong{color:#ead8a8}\n  #mobile-action-sheet{display:flex;position:absolute;left:calc(8px + env(safe-area-inset-left));right:calc(8px + env(safe-area-inset-right));bottom:calc(8px + env(safe-area-inset-bottom));z-index:18;background:rgba(14,12,8,.95);border:1px solid #4a3820;border-radius:14px;padding:8px;gap:6px;align-items:center;overflow-x:auto;box-shadow:0 4px 18px rgba(0,0,0,.6);backdrop-filter:blur(7px);scrollbar-width:none}\n  #mobile-action-sheet::-webkit-scrollbar{display:none}\n  .btn-sm,.action-btn,.char-card,.card-item,.token-chip{min-height:44px}\n  .action-btn{padding:9px 6px}\n  .char-card{padding:9px 10px}\n  .card-item{padding:9px 10px}\n  .token-chip{padding:8px 10px}\n}\n\n`;
s = s.slice(0, dupStart) + mobileCss + s.slice(lobbyStart);

s = mustReplace(s,
  '    <button id="menu-toggle-btn" onclick="toggleSidebar()">☰ Hide Menu</button>\n    <div id="mobile-action-sheet"><div class="mobile-char-summary">Tap a character to show quick actions.</div></div>',
  '    <button id="menu-toggle-btn" onclick="toggleSidebar()">☰ Menu</button>\n    <div id="mobile-status-hud" aria-live="polite"></div>\n    <div id="mobile-action-sheet"><div class="mobile-task">Tap a character to show actions.</div></div>',
  'mobile HUD html');

// Mobile status HUD is updated alongside the desktop top bar.
s = mustReplace(s,
  "  const sr = document.getElementById('supply-row');",
  "  const mh = document.getElementById('mobile-status-hud');\n  if (mh) {\n    const active = UI.selectedChar ? (CHARS[UI.selectedChar]?.name || UI.selectedChar) : (G.players[G.currentPlayer]?.name || 'Turn');\n    mh.innerHTML = '<strong>♥ ' + G.hope + '/' + G.maxHope + '</strong><span>☠ ' + G.threatRate + '/' + G.maxThreat + '</span><span>👁 ' + escapeHtml(REGIONS[G.eyeRegion]?.name || G.eyeRegion) + '</span><span>' + escapeHtml(active) + '</span>';\n  }\n  const sr = document.getElementById('supply-row');",
  'mobile status rendering');

// Character tap selects and recentres on mobile/portrait.
s = s.replace(/function selectChar\(cid\) \{([\s\S]*?)\n\}/, match => {
  if (match.includes('centerMapOnLocation')) return match;
  return match.replace('  render();', "  render();\n  if (window.matchMedia?.('(orientation: portrait)').matches) {\n    const locId = G?.charState?.[cid]?.location;\n    if (locId) centerMapOnLocation(locId, 2.5);\n  }");
});

// Turn location taps into a touch-friendly details surface when no action is pending.
s = mustReplace(s,
  "function clickLocation(locId) {\n  if (isPanDrag) { isPanDrag = false; return; } // suppress click after a drag\n  hideTooltip();\n  if (!UI.pendingAction) return;",
  "function showLocationDetails(locId) {\n  const loc = LOCS[locId], ls = G?.locState?.[locId];\n  if (!loc || !ls) return;\n  const friendly = Object.entries(ls.friendly || {}).filter(([,n])=>n>0).map(([t,n])=>n+' '+t).join(', ') || 'none';\n  const shadow = ls.shadowTroops || 0;\n  const chars = Object.entries(G.charState || {}).filter(([,cs])=>cs.alive && cs.location===locId).map(([id])=>CHARS[id]?.name||id).join(', ') || 'none';\n  const conn = CONNECTIONS.filter(c=>c.a===locId||c.b===locId).map(c=>LOCS[c.a===locId?c.b:c.a]?.name).filter(Boolean).join(', ');\n  showModal(loc.name, '<strong>Region:</strong> '+escapeHtml(REGIONS[loc.region]?.name||loc.region)+'<br><strong>Friendly:</strong> '+escapeHtml(friendly)+'<br><strong>Shadow:</strong> '+shadow+'<br><strong>Characters:</strong> '+escapeHtml(chars)+'<br><strong>Connections:</strong> '+escapeHtml(conn||'none'));\n}\n\nfunction showRecentLog() {\n  const rows = (G?.log || []).slice(0, 30);\n  const html = rows.length ? rows.map(x=>'<div style=\"padding:5px 0;border-bottom:1px solid #2a2010\">'+escapeHtml(x.msg||String(x))+'</div>').join('') : '<em>No events yet.</em>';\n  showModal('Game History', html);\n}\n\nfunction explainUnavailableAction(label, tip) { showToast('ⓘ ' + label + ': ' + tip); }\n\nfunction clickLocation(locId) {\n  if (isPanDrag) { isPanDrag = false; return; } // suppress click after a drag\n  hideTooltip();\n  if (!UI.pendingAction) { showLocationDetails(locId); return; }",
  'touch location details');

// Larger invisible map hit target.
s = mustReplace(s,
  "    if (isValidTarget) {\n      g.appendChild(svgEl('circle',{cx:loc.x,cy:loc.y,r:r+0.7,fill:'none',stroke:'#f0e060','stroke-width':0.5,class:'valid-target'}));\n    }",
  "    g.appendChild(svgEl('circle',{cx:loc.x,cy:loc.y,r:2.35,fill:'transparent',stroke:'none',class:'touch-hit'}));\n    if (isValidTarget) {\n      g.appendChild(svgEl('circle',{cx:loc.x,cy:loc.y,r:r+0.9,fill:'none',stroke:'#f0e060','stroke-width':0.55,class:'valid-target'}));\n    }",
  'map hit target');

// Disabled sidebar actions stay tappable to explain why they are unavailable.
s = mustReplace(s,
  "    btn.disabled = !a.ok;\n    btn.title = a.tip;\n    btn.onclick = () => clickAction(a.key);",
  "    btn.disabled = false;\n    btn.title = a.tip;\n    if (!a.ok) { btn.classList.add('unavailable'); btn.setAttribute('aria-disabled','true'); }\n    btn.onclick = () => a.ok ? clickAction(a.key) : explainUnavailableAction(a.label, a.tip);",
  'disabled action explanations');
s = s.replace('.action-btn:disabled{opacity:.3;cursor:default}', '.action-btn:disabled,.action-btn.unavailable{opacity:.42;cursor:help}');

// Replace the old mobile quick sheet with context-only actions and a clear task line.
const mobileFnStart = s.indexOf('function renderMobileActionSheet() {');
const mobileFnEnd = s.indexOf('\n\nfunction centerMapOnLocation', mobileFnStart);
if (mobileFnStart < 0 || mobileFnEnd < 0) throw new Error('renderMobileActionSheet anchors missing');
const newMobileFn = `function renderMobileActionSheet() {\n  const el = document.getElementById('mobile-action-sheet');\n  if (!el || !G) return;\n  const sc = UI.selectedChar;\n  const taskForPending = () => {\n    if (UI.pendingAction === 'travel' || UI.pendingAction === 'eomer-bonus-travel') return 'Choose a highlighted destination on the map';\n    if (UI.pendingAction === 'prepare') return 'Choose a region card from your hand';\n    if (UI.pendingAction) return 'Choose a target for ' + UI.pendingAction;\n    return null;\n  };\n  if (!sc || !CHARS[sc] || !G.charState?.[sc]) {\n    const task = taskForPending() || 'Tap one of your characters on the map or open More';\n    el.innerHTML = '<div class=\"mobile-task\"><strong>What next?</strong>'+escapeHtml(task)+'</div><button class=\"mobile-quick-btn more\" onclick=\"openFullActionsMobile()\">More…</button><button class=\"mobile-quick-btn more\" onclick=\"showRecentLog()\">History</button>';\n    return;\n  }\n  const cs = G.charState[sc], loc = G.locState[cs.location], locData = LOCS[cs.location];\n  const left = G.turn?.charActions?.[sc] ?? G.players[myPlayerIdx()]?.actionsPerChar ?? 4;\n  const can = canAct(sc);\n  const friendly = loc ? Object.values(loc.friendly || {}).reduce((a,b)=>a+b,0) : 0;\n  const hasRegionCard = (G.players[myPlayerIdx()]?.hand || []).some(c => c.type === 'region');\n  const buttons = [];\n  const add = (label,key,ok,primary=false) => { if (ok) buttons.push('<button class=\"mobile-quick-btn'+(primary?' primary':'')+'\" onclick=\"clickAction(\\''+key+'\\')\">'+label+'</button>'); };\n  add('Travel','travel',can && validTravelTargets(sc).length>0,true);\n  add('Attack','attack',can && friendly>0 && (loc?.shadowTroops||0)>0,true);\n  add('Capture','capture',can && !!locData?.capturable && (loc?.shadowTroops||0)===0 && friendly>0,true);\n  add('Prepare','prepare',can && !!loc?.isHaven && hasRegionCard);\n  add('Muster ♥','muster',can && !!locData?.musterType && !loc?.isShadowStronghold);\n  if (sc==='frodo-sam' && cs.location==='mount-doom') add('Destroy Ring!','destroy-ring',can,true);\n  const task = taskForPending() || ((CHARS[sc]?.name||sc)+' at '+(LOCS[cs.location]?.name||cs.location)+' · '+left+' action'+(left===1?'':'s')+' left');\n  el.innerHTML = '<div class=\"mobile-task\"><strong>'+(UI.pendingAction?'What next?':escapeHtml(CHARS[sc]?.name||sc))+'</strong>'+escapeHtml(task)+'</div>' + buttons.slice(0,4).join('') + '<button class=\"mobile-quick-btn more\" onclick=\"centerOnActiveCharacter()\">Centre</button><button class=\"mobile-quick-btn more\" onclick=\"openFullActionsMobile()\">More…</button>';\n}\n`;
s = s.slice(0, mobileFnStart) + newMobileFn + s.slice(mobileFnEnd);

// Ensure opening the drawer labels the map button sensibly; closing retains map-first view.
s = mustReplace(s,
  "  if (btn) btn.textContent = '☰ Hide Menu';",
  "  if (btn) btn.textContent = '☰ Close';",
  'drawer label');

fs.writeFileSync(indexPath, s);

let t = fs.readFileSync(testsPath, 'utf8');
const anchor = "test('free-people lieutenant boon state is wired into newGame', () => {";
const tests = `test('iPhone map-first UI wiring is present', () => {\n  assert.ok(indexSource.includes('id=\"mobile-status-hud\"'));\n  assert.ok(indexSource.includes('height:min(68dvh,620px)'));\n  assert.ok(indexSource.includes('env(safe-area-inset-bottom)'));\n  assert.ok(indexSource.includes('function showLocationDetails(locId)'));\n  assert.ok(indexSource.includes('function explainUnavailableAction(label, tip)'));\n  assert.ok(indexSource.includes("buttons.slice(0,4).join('')"));\n  assert.ok(indexSource.includes("class:'touch-hit'"));\n});\n\n`;
if (!t.includes("test('iPhone map-first UI wiring is present'")) {
  if (!t.includes(anchor)) throw new Error('test insertion anchor missing');
  t = t.replace(anchor, tests + anchor);
  fs.writeFileSync(testsPath, t);
}
console.log('iPhone map-first UI patch applied');
