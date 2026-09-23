'use strict';
const fs = require('node:fs');
const p = 'index.html';
let s = fs.readFileSync(p, 'utf8');
function rep(oldText, newText, label) {
  if (!s.includes(oldText)) throw new Error('missing anchor: ' + label);
  s = s.replace(oldText, newText);
}

// Shorter portrait drawer and matching chevron position.
rep(
  '#menu-toggle-btn.drawer-open{bottom:min(68dvh,620px);border-radius:10px 10px 0 0}',
  '#menu-toggle-btn.drawer-open{bottom:min(52dvh,480px);border-radius:10px 10px 0 0}',
  'drawer button base height'
);
rep(
  '#sidebar{position:fixed;left:0;right:0;bottom:0;z-index:45;width:100%;min-width:0;height:min(68dvh,620px);border-left:none;border-top:1px solid #6a5020;border-radius:18px 18px 0 0;box-shadow:0 -8px 30px rgba(0,0,0,.7);padding-bottom:env(safe-area-inset-bottom)}',
  '#sidebar{position:fixed;left:0;right:0;bottom:0;z-index:45;width:100%;min-width:0;height:min(52dvh,480px);border-left:none;border-top:1px solid #6a5020;border-radius:18px 18px 0 0;box-shadow:0 -8px 30px rgba(0,0,0,.7);padding-bottom:env(safe-area-inset-bottom)}',
  'portrait sidebar height'
);
rep(
  '#menu-toggle-btn.drawer-open{bottom:min(calc(68dvh + env(safe-area-inset-bottom)),calc(620px + env(safe-area-inset-bottom)))}',
  '#menu-toggle-btn.drawer-open{bottom:min(calc(52dvh + env(safe-area-inset-bottom)),calc(480px + env(safe-area-inset-bottom)))}',
  'portrait drawer chevron height'
);

// Put the two end controls into one footer row.
rep(
  '<div class="actions-grid" id="action-grid"></div>\n        <button class="btn" id="phase-btn" onclick="clickPhaseBtn()">End Actions →</button>',
  '<div class="actions-grid" id="action-grid"></div>\n        <div id="action-footer"><button class="btn" id="phase-btn" onclick="clickPhaseBtn()">End Actions →</button></div>',
  'action footer html'
);
rep(
  '  .action-btn{padding:9px 6px}\n  .char-card{padding:9px 10px}',
  '  .action-btn{padding:9px 6px}\n  #action-footer{display:flex;gap:4px;align-items:stretch}\n  #action-footer > button{flex:1 1 50%;width:auto!important;margin-top:4px;min-width:0;padding-left:6px;padding-right:6px}\n  .char-card{padding:9px 10px}',
  'portrait action footer css'
);

// Clear/rebuild the per-character end-actions button each render.
rep(
  "  const phaseBtn = document.getElementById('phase-btn');",
  "  const phaseBtn = document.getElementById('phase-btn');\n  const actionFooter = document.getElementById('action-footer');\n  actionFooter?.querySelectorAll('.char-done-btn').forEach(b => b.remove());",
  'renderActions footer setup'
);
rep(
  "    doneBtn.className = 'action-btn btn-danger';\n    doneBtn.style.gridColumn = '1 / -1';",
  "    doneBtn.className = 'action-btn btn-danger char-done-btn';",
  'done button class'
);
rep(
  '    el.appendChild(doneBtn);\n  }\n}',
  '    if (actionFooter && phaseBtn) actionFooter.insertBefore(doneBtn, phaseBtn);\n    else el.appendChild(doneBtn);\n  }\n}',
  'done button append'
);

// Muster/Capture are only useful in the drawer when currently legal.
rep(
  "  for (const a of actions) {\n    const btn = document.createElement('button');",
  "  for (const a of actions) {\n    if ((a.key === 'muster' || a.key === 'capture') && !a.ok) continue;\n    const btn = document.createElement('button');",
  'hide unavailable muster capture'
);

// Treat an open portrait drawer as occluding the bottom of the camera viewport.
const clampAnchor = `function clampPan() {\n  const panel = document.getElementById('map-panel');\n  if (!panel) return;\n  const pw = panel.clientWidth, ph = panel.clientHeight;`;
rep(
  clampAnchor,
  `function visibleMapViewportHeight(panel) {\n  if (!panel) return 0;\n  let h = panel.clientHeight;\n  const sidebar = document.getElementById('sidebar');\n  const portrait = window.matchMedia?.('(orientation: portrait)').matches;\n  if (portrait && sidebar && !sidebar.classList.contains('menu-hidden')) {\n    h -= sidebar.getBoundingClientRect().height;\n  }\n  return Math.max(1, h);\n}\n\nfunction clampPan() {\n  const panel = document.getElementById('map-panel');\n  if (!panel) return;\n  const pw = panel.clientWidth, ph = visibleMapViewportHeight(panel);`,
  'visible camera height'
);

// Re-clamp immediately when the drawer opens/closes.
rep(
  "    btn.setAttribute('aria-label', opening ? 'Close game drawer' : 'Open game drawer');\n  }\n}",
  "    btn.setAttribute('aria-label', opening ? 'Close game drawer' : 'Open game drawer');\n  }\n  requestAnimationFrame(() => { clampPan(); applyMapTransform(); });\n}",
  'toggle sidebar reclamp'
);

// Centre-on-location should centre within the actually visible map area when the drawer is open.
rep(
  '  mapView.panY = panel.offsetHeight / 2 - y * zoom;',
  '  mapView.panY = visibleMapViewportHeight(panel) / 2 - y * zoom;',
  'centre visible height'
);

fs.writeFileSync(p, s);

// Update the regression contract from the old drawer height to the new compact drawer,
// and assert the occlusion-aware camera logic is wired in.
const tp = 'tests/regression.cjs';
let t = fs.readFileSync(tp, 'utf8');
if (!t.includes("assert.ok(indexSource.includes('height:min(68dvh,620px)'))")) throw new Error('missing old drawer regression assertion');
t = t.replace(
  "assert.ok(indexSource.includes('height:min(68dvh,620px)'))",
  "assert.ok(indexSource.includes('height:min(52dvh,480px)'));\n  assert.ok(indexSource.includes('function visibleMapViewportHeight(panel)'));\n  assert.ok(indexSource.includes(\"h -= sidebar.getBoundingClientRect().height;\"));\n  assert.ok(indexSource.includes(\"if ((a.key === 'muster' || a.key === 'capture') && !a.ok) continue;\"));\n  assert.ok(indexSource.includes('id=\"action-footer\"'))"
);
fs.writeFileSync(tp, t);
