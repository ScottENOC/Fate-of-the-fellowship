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
`function myPlayerIdx() {\n  if (!G?.playerIds) return 0;\n  const idx = G.playerIds.indexOf(getPlayerId());\n  return idx >= 0 ? idx : 0;\n}`,
`function myPlayerIdx() {\n  // Local hot-seat games have no playerIds: the viewing player is the active\n  // player. Cloud games retain per-device identity through playerIds.\n  if (!G?.playerIds) return G?.currentPlayer ?? 0;\n  const idx = G.playerIds.indexOf(getPlayerId());\n  return idx >= 0 ? idx : 0;\n}`, 'local hotseat player identity');

index = replaceOnce(index,
`function genRoomCodeStr() {\n  const words = ['SHIRE','RIVENDELL','LORIEN','ROHAN','GONDOR','MIRKWOOD','EREBOR','EDORAS'];\n  return words[Math.floor(Math.random() * words.length)] + '-' + Math.floor(1000 + Math.random() * 9000);\n}`,
`function genRoomCodeStr() {\n  const words = ['SHIRE','RIVENDELL','LORIEN','ROHAN','GONDOR','MIRKWOOD','EREBOR','EDORAS'];\n  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';\n  const bytes = new Uint8Array(6);\n  if (globalThis.crypto?.getRandomValues) crypto.getRandomValues(bytes);\n  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);\n  const suffix = Array.from(bytes, b => alphabet[b % alphabet.length]).join('');\n  return words[bytes[0] % words.length] + '-' + suffix.slice(0,3) + '-' + suffix.slice(3);\n}`, 'stronger room codes');

index = replaceOnce(index,
`function lobbyPlayerOrder(players, hostId) {`,
`function escapeHtml(value) {\n  return String(value ?? '').replace(/[&<>"']/g, ch => ({\n    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'\n  })[ch]);\n}\n\nfunction lobbyPlayerOrder(players, hostId) {`, 'escape html helper');

index = replaceOnce(index,
`          <input class="lobby-name-input" value="\${p.name.replace(/"/g,'&quot;')}" placeholder="Your name"`,
`          <input class="lobby-name-input" value="\${escapeHtml(p.name)}" placeholder="Your name"`, 'escape own lobby name');
index = replaceOnce(index,
`          <span style="color:\${isHost?'#f0c040':'#c8b880'};font-size:.85em;font-weight:\${isHost?'bold':'normal'}">\${p.name}\${isHost?' 👑':''}</span>`,
`          <span style="color:\${isHost?'#f0c040':'#c8b880'};font-size:.85em;font-weight:\${isHost?'bold':'normal'}">\${escapeHtml(p.name)}\${isHost?' 👑':''}</span>`, 'escape remote lobby name');
fs.writeFileSync(indexPath, index);

let tests = fs.readFileSync(testsPath, 'utf8');
const anchor = `test('UI render keeps static map layers cached and autosave debounced', () => {`;
const addition = `test('local hot-seat UI follows the active player and lobby rendering escapes names', () => {\n  assert.ok(indexSource.includes('if (!G?.playerIds) return G?.currentPlayer ?? 0;'));\n  assert.ok(indexSource.includes('function escapeHtml(value)'));\n  assert.ok(indexSource.includes('\\${escapeHtml(p.name)}'));\n});\n\ntest('generated room codes use a longer non-confusable random suffix', () => {\n  assert.ok(indexSource.includes("const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';"));\n  assert.ok(indexSource.includes('new Uint8Array(6)'));\n  assert.ok(indexSource.includes("suffix.slice(0,3) + '-' + suffix.slice(3)"));\n});\n\n`;
if (!tests.includes("test('local hot-seat UI follows the active player")) {
  if (!tests.includes(anchor)) throw new Error('test anchor missing');
  tests = tests.replace(anchor, addition + anchor);
}
fs.writeFileSync(testsPath, tests);
console.log('Multiplayer/local safety patch applied.');
