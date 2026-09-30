import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
async function files(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) result.push(...await files(path)); else result.push(path);
  }
  return result;
}
const assets = (await files('dist')).filter(file => !file.endsWith('service-worker.js')).sort();
const hash = createHash('sha256');
for (const file of assets) { hash.update(file); hash.update(await readFile(file)); }
const template = await readFile('public/service-worker.js', 'utf8');
hash.update(template);
const worker = template.replace(/const CACHE_NAME = .*?;/, `const CACHE_NAME = 'my-life-app-${hash.digest('hex').slice(0, 16)}';`)
  .replace(/const ASSETS = .*?;/, `const ASSETS = ${JSON.stringify(['/', ...assets.map(file => file.replace('dist', ''))])};`);
await writeFile('dist/service-worker.js', worker);
console.log('Offline worker generated for', assets.length, 'application assets.');
