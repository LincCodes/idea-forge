/* Idempotent normaliser for the compact idea format.
   Authoring format is 12 fields:
     id|title|category|stack|controls|art|hook|loop|twist|levels|spark|tags
   A common authoring slip duplicates the art token (position 6) before spark.
   This removes it when it is an exact duplicate, and reports anything else odd.

   Usage: node tools/normalise.mjs [--check] */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const check = process.argv.includes('--check');
const files = ['data/games.js', 'data/apps.js', 'data/websites.js'];
let fixedTotal = 0, bad = 0;

for (const f of files) {
  const path = join(root, f);
  let src = readFileSync(path, 'utf8');
  let fixed = 0;
  src = src.replace(/^"(.+)"(,?)\s*$/gm, (m, body, tail) => {
    const p = body.split('|');
    if (p.length === 13 && p[10] === p[5]) { p.splice(10, 1); fixed++; return '"' + p.join('|') + '"' + tail; }
    if (p.length !== 12) { console.error(`  ! ${f}: ${p.length} fields in "${p[0]}"`); bad++; }
    return m;
  });
  if (fixed && !check) writeFileSync(path, src);
  if (fixed) console.log(`${f}: ${fixed} lines normalised`);
  fixedTotal += fixed;
}
console.log(fixedTotal ? (check ? `would fix ${fixedTotal}` : `fixed ${fixedTotal}`) : 'nothing to fix');
if (bad) { console.error(`${bad} lines with unexpected field counts`); process.exit(1); }
