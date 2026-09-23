'use strict';
const fs = require('node:fs');
const p = 'index.html';
let s = fs.readFileSync(p, 'utf8');
function rep(oldText, newText, label) {
  if (!s.includes(oldText)) throw new Error('Missing anchor: ' + label);
  s = s.replace(oldText, newText);
}

rep(
`#menu-toggle-btn{position:absolute;bottom:10px;left:10px;z-index:20;background:rgba(20,15,8,.88);border:1px solid #4a3820;color:#c8a050;padding:5px 13px;border-radius:14px;cursor:pointer;font-family:inherit;font-size:.78em;transition:all .15s}\n#menu-toggle-btn:hover{border-color:#c8a050;background:rgba(30,22,10,.97)}\n#mobile-status-hud{display:none}`,
`#menu-toggle-btn{position:absolute;left:50%;bottom:76px;transform:translateX(-50%);z-index:46;background:rgba(20,15,8,.42);border:1px solid rgba(120,92,48,.55);color:#d7c28e;width:36px;height:24px;border-radius:12px;cursor:pointer;font-family:inherit;font-size:.82em;line-height:1;transition:bottom .18s ease,background .15s}\n#menu-toggle-btn:hover{background:rgba(30,22,10,.68);border-color:#c8a050}\n#menu-toggle-btn.drawer-open{bottom:min(68dvh,620px);border-radius:10px 10px 0 0}\n#mobile-status-hud{display:none}`,
'menu toggle base CSS');

rep(
`  #top-bar{padding:8px 12px;gap:4px}\n  .track-row{font-size:.8em}\n  .track-bar{height:9px}`,
`  #top-bar{display:none}`,
'portrait duplicate top bar');

rep(
`  #menu-toggle-btn{top:calc(8px + env(safe-area-inset-top));left:calc(8px + env(safe-area-inset-left));bottom:auto;min-width:44px;min-height:44px;padding:8px 12px;border-radius:22px}`,
`  #menu-toggle-btn{position:fixed;top:auto;left:50%;bottom:calc(76px + env(safe-area-inset-bottom));min-width:0;min-height:0;padding:0;border-radius:12px}\n  #menu-toggle-btn.drawer-open{bottom:min(calc(68dvh + env(safe-area-inset-bottom)),calc(620px + env(safe-area-inset-bottom)))}`,
'portrait menu toggle CSS');

rep(
`  #mobile-status-hud{display:flex;position:absolute;z-index:17;top:calc(60px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);align-items:center;gap:8px;background:rgba(14,12,8,.92);border:1px solid #4a3820;border-radius:18px;padding:7px 11px;font-size:.72em;color:#c8b080;box-shadow:0 3px 14px rgba(0,0,0,.45);backdrop-filter:blur(6px);max-width:calc(100vw - 110px);white-space:nowrap}`,
`  #mobile-status-hud{display:flex;position:absolute;z-index:17;top:calc(12px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);align-items:center;gap:8px;background:rgba(14,12,8,.24);border:1px solid rgba(106,80,32,.3);border-radius:18px;padding:6px 10px;font-size:.72em;color:#c8b080;box-shadow:0 2px 8px rgba(0,0,0,.16);backdrop-filter:blur(2px);max-width:calc(100vw - 96px);white-space:nowrap}`,
'portrait compact HUD transparency');

rep(
`#mobile-action-sheet{display:none}\n.mobile-quick-btn`,
`#mobile-action-sheet{display:none}\n#mobile-utility-menu-btn{display:none}\n.mobile-quick-btn`,
'mobile utility base CSS');

rep(
`  #mobile-action-sheet::-webkit-scrollbar{display:none}\n  .btn-sm,.action-btn,.char-card,.card-item,.token-chip{min-height:44px}`,
`  #mobile-action-sheet::-webkit-scrollbar{display:none}\n  #utility-bar{padding:4px 8px calc(4px + env(safe-area-inset-bottom));border-top:none;background:transparent;position:absolute;right:8px;bottom:calc(74px + env(safe-area-inset-bottom));z-index:19;pointer-events:none}\n  #utility-bar .desktop-utility-btn{display:none}\n  #mobile-utility-menu-btn{display:block;pointer-events:auto;min-height:32px;padding:5px 10px;border-radius:14px;background:rgba(20,15,8,.4);border:1px solid rgba(106,80,32,.55);color:#c8b080;font-family:inherit;font-size:.72em}\n  .btn-sm,.action-btn,.char-card,.card-item,.token-chip{min-height:44px}`,
'portrait utility menu CSS');

rep(
`    <button id="menu-toggle-btn" onclick="toggleSidebar()">☰ Menu</button>`,
`    <button id="menu-toggle-btn" onclick="toggleSidebar()" aria-label="Open game drawer">▴</button>`,
'map drawer toggle HTML');

rep(
`    <div style="padding:6px 10px;border-top:1px solid #3a2810;display:flex;gap:6px">\n      <button class="btn btn-sm" onclick="saveGame();cloudSave();showToast('💾 Saved')">💾 Save</button>\n      <button class="btn btn-sm" id="sync-btn" onclick="syncFromCloud()" style="color:#507050;border-color:#507050">☁ Sync</button>\n      <button class="btn btn-sm" style="color:#906040;border-color:#906040" onclick="if(confirm('Return to setup? Unsaved progress will be lost.'))location.reload()">↩ Menu</button>\n      <button class="btn btn-sm" onclick="showCampaignChronicle()">📜</button>\n      <button class="btn btn-sm" style="color:#507050;border-color:#507050;margin-left:auto" onclick="devTools()">🔧</button>\n    </div>`,
`    <div id="utility-bar" style="padding:6px 10px;border-top:1px solid #3a2810;display:flex;gap:6px">\n      <button class="btn btn-sm desktop-utility-btn" onclick="saveGame();cloudSave();showToast('💾 Saved')">💾 Save</button>\n      <button class="btn btn-sm desktop-utility-btn" id="sync-btn" onclick="syncFromCloud()" style="color:#507050;border-color:#507050">☁ Sync</button>\n      <button class="btn btn-sm desktop-utility-btn" style="color:#906040;border-color:#906040" onclick="if(confirm('Return to setup? Unsaved progress will be lost.'))location.reload()">↩ Menu</button>\n      <button class="btn btn-sm desktop-utility-btn" onclick="showCampaignChronicle()">📜</button>\n      <button class="btn btn-sm desktop-utility-btn" style="color:#507050;border-color:#507050;margin-left:auto" onclick="devTools()">🔧</button>\n      <button id="mobile-utility-menu-btn" onclick="showUtilityMenu()">Menu</button>\n    </div>`,
'utility footer HTML');

const toggleRe = /function toggleSidebar\(\) \{[\s\S]*?\n\}/;
if (!toggleRe.test(s)) throw new Error('Missing toggleSidebar function');
s = s.replace(toggleRe, `function toggleSidebar() {\n  const sidebar = document.getElementById('sidebar');\n  const btn = document.getElementById('menu-toggle-btn');\n  if (!sidebar) return;\n  const opening = sidebar.classList.contains('menu-hidden');\n  sidebar.classList.toggle('menu-hidden', !opening);\n  if (btn) {\n    btn.textContent = opening ? '▾' : '▴';\n    btn.classList.toggle('drawer-open', opening);\n    btn.setAttribute('aria-label', opening ? 'Close game drawer' : 'Open game drawer');\n  }\n}`);

const devAnchor = `function devTools() {`;
if (!s.includes(devAnchor)) throw new Error('Missing devTools anchor');
const utilityFn = `function showUtilityMenu() {\n  const buttons = [\n    { label:'💾 Save', action:() => { closeModal(); saveGame(); cloudSave(); showToast('💾 Saved'); } },\n    { label:'☁ Sync', action:() => { closeModal(); syncFromCloud(); } },\n    { label:'📜 Campaign Chronicle', action:() => { closeModal(); showCampaignChronicle(); } },\n    { label:'↩ Return to setup', action:() => { closeModal(); if(confirm('Return to setup? Unsaved progress will be lost.')) location.reload(); } },\n    { label:'🔧 Dev Tools', action:() => { closeModal(); devTools(); } },\n  ];\n  showModal('Menu', 'Game and campaign options', buttons);\n}\n\n`;
s = s.replace(devAnchor, utilityFn + devAnchor);

// Ensure duplicate top-bar data remains available on desktop but is hidden in portrait.
if (!s.includes('#top-bar{display:none}')) throw new Error('Portrait top bar was not hidden');
if (!s.includes('background:rgba(14,12,8,.24)')) throw new Error('HUD transparency patch missing');
if (!s.includes('showUtilityMenu()')) throw new Error('Utility menu patch missing');

fs.writeFileSync(p, s);
console.log('iPhone chrome cleanup applied');
