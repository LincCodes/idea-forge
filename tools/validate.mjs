/* Validates the catalog: parses every data file, expands it, and reports problems.
   Usage: node tools/validate.mjs */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const win = {};
globalThis.window = win;

function load(rel) {
  const code = readFileSync(join(root, rel), 'utf8');
  new Function('window', code)(win);
}

for (const f of ['data/games.js', 'data/apps.js', 'data/websites.js']) {
  try { load(f); } catch (e) { console.error(`✗ ${f}: ${e.message}`); process.exit(1); }
}
load('js/expand.js');

const IdeaForge = win.IdeaForge;
const RAW = win.RAW || {};
const kinds = { games: RAW.games, apps: RAW.apps, websites: RAW.websites };

let problems = 0, total = 0;
const ids = new Set();
const titles = new Map();

for (const [kind, raw] of Object.entries(kinds)) {
  const lines = raw || [];
  console.log(`\n${kind}: ${lines.length} entries`);
  lines.forEach((line, n) => {
    total++;
    const f = String(line).split('|').map(s => s.trim());
    const where = `${kind}[${n}]`;
    if (f.length !== 12) { console.error(`  ✗ ${where} has ${f.length} fields (want 12): ${f[0]}`); problems++; }
    if (!/^[gaw]\d{3}$/.test(f[0] || '')) { console.error(`  ✗ ${where} bad id: ${f[0]}`); problems++; }
    if (ids.has(f[0])) { console.error(`  ✗ ${where} duplicate id: ${f[0]}`); problems++; }
    ids.add(f[0]);
    const t = (f[1] || '').toLowerCase();
    if (titles.has(t)) { console.error(`  ✗ ${where} duplicate title: ${f[1]} (also ${titles.get(t)})`); problems++; }
    titles.set(t, f[0]);
    if (!['js', 'godot', 'flutter'].includes(f[3])) { console.error(`  ✗ ${where} bad stack: ${f[3]}`); problems++; }
    if (!['tap', 'drag', 'swipe', 'tilt', 'hold', 'twoThumb', 'typing', 'voice', 'camera', 'shake'].includes(f[4])) {
      console.error(`  ✗ ${where} bad control: ${f[4]}`); problems++;
    }
    ['hook', 'loop', 'twist', 'levels', 'spark'].forEach((label, i) => {
      const v = f[6 + i];
      if (!v || v.length < 12) { console.error(`  ✗ ${where} weak ${label}: "${v}"`); problems++; }
    });
    if (!f[11]) { console.error(`  ✗ ${where} no tags`); problems++; }
  });
  const built = IdeaForge.build(lines, kind);
  console.log(`  expanded ok — sample: "${built[0]?.title}" ${built[0]?.prototype.length} prototype steps, ${built[0]?.plain.split('\n').length} lines of detail`);
}

console.log(`\nTOTAL ${total} ideas · ${problems} problems`);
console.log('kinds:', Object.entries(kinds).map(([k, v]) => `${k}=${(v || []).length}`).join(' '));
process.exit(problems ? 1 : 0);
