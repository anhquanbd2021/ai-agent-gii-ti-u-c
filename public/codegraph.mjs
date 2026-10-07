// Code-Graph substrate: derives structural facts from a repo file map.
// Input: { 'src/db.js': '...source...', 'infra/deploy.yaml': '...', ... }
// Output: [{ key, value, evidence }] — every fact carries the file and
// line it was derived from, so recall can drill down to ground truth.

export function extractFacts(files) {
  const facts = [];
  const paths = Object.keys(files).sort();

  for (const path of paths) {
    const content = files[path];
    const lines = content.split('\n');

    if (path === 'package.json') {
      try {
        const pkg = JSON.parse(content);
        if (pkg.name) facts.push({ key: 'service.name', value: pkg.name, evidence: `${path}: name` });
        if (pkg.packageManager) {
          facts.push({
            key: 'pkg.manager',
            value: pkg.packageManager.split('@')[0],
            evidence: `${path}: packageManager`,
          });
        }
      } catch { /* malformed fixture — skip */ }
    }

    // Lockfiles are ground truth for the package manager.
    if (path === 'pnpm-lock.yaml') {
      facts.push({ key: 'pkg.manager', value: 'pnpm', evidence: `${path} present` });
    }
    if (path === 'package-lock.json') {
      facts.push({ key: 'pkg.manager', value: 'npm', evidence: `${path} present` });
    }
    if (path === 'yarn.lock') {
      facts.push({ key: 'pkg.manager', value: 'yarn', evidence: `${path} present` });
    }

    if (path.endsWith('deploy.yaml') || path.endsWith('deploy.yml')) {
      lines.forEach((line, i) => {
        const m = line.match(/^\s*(\w[\w-]*)\s*:\s*(.+?)\s*$/);
        if (!m) return;
        const [, field, val] = m;
        if (field === 'region') {
          facts.push({ key: 'deploy.region', value: val, evidence: `${path}:${i + 1}` });
        }
        if (field === 'replicas') {
          facts.push({ key: 'deploy.replicas', value: val, evidence: `${path}:${i + 1}` });
        }
      });
    }

    if (path.endsWith('.js') || path.endsWith('.mjs') || path.endsWith('.ts')) {
      lines.forEach((line, i) => {
        if (/better-sqlite3|new Database\(/.test(line)) {
          facts.push({ key: 'datastore', value: 'sqlite', evidence: `${path}:${i + 1}` });
        }
        if (/from 'pg'|require\('pg'\)|new Client\(/.test(line) && /postgres|pg/i.test(line)) {
          facts.push({ key: 'datastore', value: 'postgres', evidence: `${path}:${i + 1}` });
        }
        if (/from 'redis'|createClient\(.*redis/i.test(line)) {
          facts.push({ key: 'datastore', value: 'redis', evidence: `${path}:${i + 1}` });
        }
      });
    }
  }

  // Structural substrate dedupes: same key+value extracted twice is one fact.
  const seen = new Set();
  return facts.filter((f) => {
    const sig = `${f.key}=${f.value}`;
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
}
