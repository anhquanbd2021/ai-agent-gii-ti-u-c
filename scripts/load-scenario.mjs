// Loads the disk fixtures under examples/ into the same scenario shape
// that public/data.mjs embeds for the browser — so the lab runs against
// files you can inspect, not hardcoded blobs.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXAMPLES = fileURLToPath(new URL('../examples', import.meta.url));

function walk(dir, base, out) {
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, base, out);
    else out[relative(base, full).split('\\').join('/')] = readFileSync(full, 'utf8').replace(/\r\n/g, '\n');
  }
  return out;
}

export function loadScenario(examplesDir = EXAMPLES) {
  const scenario = JSON.parse(readFileSync(join(examplesDir, 'atlas-scenario.json'), 'utf8'));
  scenario.repoFiles = walk(join(examplesDir, 'repo'), join(examplesDir, 'repo'), {});
  return scenario;
}
