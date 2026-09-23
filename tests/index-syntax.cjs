'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(m => m[1].trim())
  .filter(Boolean);

assert.ok(scripts.length > 0, 'expected at least one inline script');
for (let i = 0; i < scripts.length; i++) {
  assert.doesNotThrow(() => new vm.Script(scripts[i], { filename: `index-inline-${i + 1}.js` }));
}
console.log(`✓ ${scripts.length} inline browser script(s) parse successfully`);
