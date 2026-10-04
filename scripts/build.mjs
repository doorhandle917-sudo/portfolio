// Static build: src/ → dist/. Everything except index.html goes into a
// content-hashed folder (dist/b-<hash>/) so a new deploy never mixes cached
// old modules with new ones; index.html is rewritten to point at it.
// Zero dependencies — Node built-ins only.
import { createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const dist = join(root, 'dist');
const ENTRY = "import('./os/main.js')";

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out.sort();
}

const files = await walk(src);
const hash = createHash('sha256');
for (const file of files) {
  hash.update(relative(src, file));
  hash.update(await readFile(file));
}
const version = `b-${hash.digest('hex').slice(0, 10)}`;

await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, version), { recursive: true });

let bytes = 0;
for (const file of files) {
  const rel = relative(src, file);
  if (rel === 'index.html') continue;
  const target = join(dist, version, rel);
  await mkdir(dirname(target), { recursive: true });
  await cp(file, target);
  bytes += (await stat(file)).size;
}

const html = await readFile(join(src, 'index.html'), 'utf8');
const occurrences = html.split(ENTRY).length - 1;
if (occurrences !== 1) {
  console.error(`build: expected exactly one ${ENTRY} in src/index.html, found ${occurrences}`);
  process.exit(1);
}
const page = html.replace(ENTRY, `import('./${version}/os/main.js')`);
await writeFile(join(dist, 'index.html'), page);
bytes += Buffer.byteLength(page);

// Report content placeholders that still need real data.
const content = await readFile(join(src, 'content.js'), 'utf8');
const placeholders = content.split('\n')
  .map((line, i) => [i + 1, line.match(/:\s*['"](PLACEHOLDER[^'"]*)['"]/)])
  .filter(([, m]) => m);

console.log(`Built ${files.length} files (${(bytes / 1024).toFixed(1)} KiB) into dist/ — assets in dist/${version}/`);
if (placeholders.length) {
  console.log(`\n${placeholders.length} placeholder(s) left in src/content.js:`);
  for (const [line, m] of placeholders) console.log(`  line ${line}: ${m[1]}`);
}
