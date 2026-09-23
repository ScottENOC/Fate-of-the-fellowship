'use strict';
const fs = require('node:fs');
const p = 'index.html';
let s = fs.readFileSync(p, 'utf8');
function rep(oldText, newText, label) {
  if (!s.includes(oldText)) throw new Error('missing anchor: ' + label);
  s = s.replace(oldText, newText);
}

rep(
  '#map-wrap{position:relative;width:100%;height:100%;transform-origin:0 0;cursor:grab;will-change:transform}',
  '#map-wrap{position:absolute;left:0;top:0;transform-origin:0 0;cursor:grab;will-change:transform}',
  'map-wrap css'
);
rep(
  '#map-img{display:block;width:100%;height:100%;object-fit:contain;object-position:top left;user-select:none;-webkit-user-drag:none}',
  '#map-img{display:block;width:100%;height:100%;object-fit:fill;user-select:none;-webkit-user-drag:none}',
  'map image css'
);
rep(
  "const mapView = { zoom: 1, panX: 0, panY: 0 };",
  "const mapView = { zoom: 1, panX: 0, panY: 0, baseWidth: 0, baseHeight: 0, viewportWidth: 0, viewportHeight: 0 };",
  'mapView'
);

const applyAnchor = `function applyMapTransform() {\n  const wrap = document.getElementById('map-wrap');\n  if (wrap) wrap.style.transform = \`translate(\${mapView.panX}px,\${mapView.panY}px) scale(\${mapView.zoom})\`;\n}`;
rep(applyAnchor, applyAnchor + `\n\nfunction centerMapAtBase() {\n  const pw = mapView.viewportWidth || document.getElementById('map-panel')?.clientWidth || 0;\n  const ph = mapView.viewportHeight || document.getElementById('map-panel')?.clientHeight || 0;\n  mapView.panX = (pw - mapView.baseWidth * mapView.zoom) / 2;\n  mapView.panY = (ph - mapView.baseHeight * mapView.zoom) / 2;\n}`, 'apply transform');

s = s.replace(/function clampPan\(\) \{[\s\S]*?\n\}\n\nfunction zoomAtPoint/, `function clampPan() {\n  const panel = document.getElementById('map-panel');\n  if (!panel) return;\n  const pw = panel.clientWidth, ph = panel.clientHeight;\n  const baseW = mapView.baseWidth || document.getElementById('map-wrap')?.offsetWidth || pw;\n  const baseH = mapView.baseHeight || document.getElementById('map-wrap')?.offsetHeight || ph;\n  const scaledW = baseW * mapView.zoom;\n  const scaledH = baseH * mapView.zoom;\n  // Camera bounds are exactly the map edges: never reveal space outside the map.\n  const minX = Math.min(0, pw - scaledW);\n  const minY = Math.min(0, ph - scaledH);\n  mapView.panX = Math.max(minX, Math.min(0, mapView.panX));\n  mapView.panY = Math.max(minY, Math.min(0, mapView.panY));\n}\n\nfunction zoomAtPoint`);
if (!s.includes('const minX = Math.min(0, pw - scaledW);')) throw new Error('clampPan replacement failed');

rep('const newZoom = Math.max(0.5, Math.min(8, mapView.zoom * factor));', 'const newZoom = Math.max(1, Math.min(8, mapView.zoom * factor));', 'zoom floor');
rep(
  "    mapView.zoom = 1; mapView.panX = 0; mapView.panY = 0;\n    applyMapTransform();",
  "    mapView.zoom = 1; centerMapAtBase(); clampPan();\n    applyMapTransform();",
  'double click reset'
);

const alignPattern = /function alignSvgToImage\(\) \{[\s\S]*?\n\}\nwindow\.addEventListener\('resize', \(\) => \{ if \(G\) \{ alignSvgToImage\(\); render\(\); \} \}\);/;
const alignReplacement = `function alignSvgToImage() {\n  const img = document.getElementById('map-img');\n  const svg = document.getElementById('map-svg');\n  const wrap = document.getElementById('map-wrap');\n  const panel = document.getElementById('map-panel');\n  if (!img || !svg || !wrap || !panel) return;\n\n  const pw = panel.clientWidth, ph = panel.clientHeight;\n  if (!pw || !ph) return;\n\n  // Preserve the point currently under the viewport centre across resizes/orientation changes.\n  let centreX = 0.5, centreY = 0.5;\n  if (mapView.baseWidth > 0 && mapView.baseHeight > 0 && mapView.viewportWidth > 0 && mapView.viewportHeight > 0) {\n    centreX = (mapView.viewportWidth / 2 - mapView.panX) / (mapView.baseWidth * mapView.zoom);\n    centreY = (mapView.viewportHeight / 2 - mapView.panY) / (mapView.baseHeight * mapView.zoom);\n  }\n\n  const iW = img.naturalWidth || 2230;\n  const iH = img.naturalHeight || 2260;\n  const coverScale = Math.max(pw / iW, ph / iH);\n  const dispW = iW * coverScale;\n  const dispH = iH * coverScale;\n\n  wrap.style.width = dispW + 'px';\n  wrap.style.height = dispH + 'px';\n  img.style.width = '100%';\n  img.style.height = '100%';\n  svg.style.width = '100%';\n  svg.style.height = '100%';\n  svg.style.top = '0px';\n  svg.style.left = '0px';\n\n  mapView.baseWidth = dispW;\n  mapView.baseHeight = dispH;\n  mapView.viewportWidth = pw;\n  mapView.viewportHeight = ph;\n  mapView.panX = pw / 2 - centreX * dispW * mapView.zoom;\n  mapView.panY = ph / 2 - centreY * dispH * mapView.zoom;\n  clampPan();\n  applyMapTransform();\n}\nwindow.addEventListener('resize', () => { if (G) { alignSvgToImage(); render(); } });`;
if (!alignPattern.test(s)) throw new Error('alignSvgToImage block not found');
s = s.replace(alignPattern, alignReplacement);

fs.writeFileSync(p, s);
