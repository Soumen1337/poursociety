import fs from 'node:fs/promises';
import path from 'node:path';

const catalogPath = new URL('../src/catalog.seed.json', import.meta.url);
const sourcesPath = new URL('../image-sources.json', import.meta.url);
const auditPath = new URL('../image-audit.json', import.meta.url);
const outDir = new URL('../public/images/', import.meta.url);
const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
const sourceInventory = JSON.parse(await fs.readFile(sourcesPath, 'utf8'));
const sourceById = new Map((sourceInventory.entries || []).map(x => [x.id, x.source_url]));
await fs.mkdir(outDir, { recursive: true });
const groups = [['products', catalog.products], ['wines', catalog.wines], ['cocktails', catalog.cocktails]];
const tasks = groups.flatMap(([group, items]) => items.map(item => ({ group, item })));

// A single quick connectivity probe avoids leaving dozens of hung requests in offline environments.
try {
  const probe = await fetch('https://www.google.com/generate_204', { signal: AbortSignal.timeout(3500) });
  if (!probe.ok && probe.status !== 204) throw new Error(`probe HTTP ${probe.status}`);
} catch (error) {
  const results = tasks.map(({ group, item }) => ({
    id: item.id, name: item.name, type: group,
    url: item.image?.startsWith('/images/') ? sourceById.get(item.id) || item.image : item.image,
    status: 'not_checked_network_unavailable'
  }));
  await fs.writeFile(auditPath, JSON.stringify({
    checkedAt: new Date().toISOString(), total: results.length, downloaded: 0,
    failed: 0, pending: results.length,
    note: `Network probe failed (${String(error).slice(0, 160)}). Run this script on a network-enabled machine.`, results
  }, null, 2));
  console.log(`No outbound network. ${results.length} images left pending; see image-audit.json.`);
  process.exit(0);
}

const results = [];
let cursor = 0;
async function worker() {
  while (cursor < tasks.length) {
    const task = tasks[cursor++];
    const { item, group } = task;
    let url = item.image;
    if (url?.startsWith('/images/')) {
      try {
        await fs.access(new URL(`../public${url}`, import.meta.url));
        results.push({ id: item.id, name: item.name, type: group, status: 'LOCAL', local: url, ok: true });
        continue;
      } catch {
        url = sourceById.get(item.id);
      }
    }
    if (!url) {
      results.push({ id: item.id, name: item.name, type: group, status: 'MISSING_SOURCE', ok: false });
      continue;
    }
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        headers: { 'user-agent': 'PourSocietyImageAudit/1.0' },
        signal: AbortSignal.timeout(10000)
      });
      const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (!res.ok || !['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(type)) {
        results.push({ id: item.id, name: item.name, type: group, status: res.status, contentType: type, url, ok: false });
        continue;
      }
      const bytes = Buffer.from(await res.arrayBuffer());
      if (!bytes.length || bytes.length > 5 * 1024 * 1024) {
        results.push({ id: item.id, name: item.name, type: group, status: 'INVALID_SIZE', bytes: bytes.length, url, ok: false });
        continue;
      }
      const ext = type === 'image/jpeg' ? 'jpg' : type.split('/')[1];
      const filename = `${item.id}.${ext}`;
      await fs.writeFile(new URL(filename, outDir), bytes);
      item.image = `/images/${filename}`;
      results.push({ id: item.id, name: item.name, type: group, status: res.status, contentType: type, bytes: bytes.length, local: item.image, source_url: url, ok: true });
    } catch (error) {
      results.push({ id: item.id, name: item.name, type: group, status: 'FETCH_ERROR', url, error: String(error).slice(0, 160), ok: false });
    }
  }
}

await Promise.all(Array.from({ length: 6 }, worker));
await fs.writeFile(catalogPath, JSON.stringify(catalog, null, 2));
const report = {
  checkedAt: new Date().toISOString(), total: results.length,
  downloaded: results.filter(x => x.ok && x.status !== 'LOCAL').length,
  local: results.filter(x => x.status === 'LOCAL').length,
  failed: results.filter(x => !x.ok).length,
  results
};
await fs.writeFile(auditPath, JSON.stringify(report, null, 2));
sourceInventory.checkedAt = report.checkedAt;
sourceInventory.entries = sourceInventory.entries.map(x => {
  const result = results.find(y => y.id === x.id);
  return result ? { ...x, status: result.status, local: result.local || null, content_type: result.contentType || null, bytes: result.bytes || null } : x;
});
await fs.writeFile(sourcesPath, JSON.stringify(sourceInventory, null, 2));
console.log(`Image audit complete: ${report.downloaded} downloaded, ${report.local} already local, ${report.failed} failed.`);
for (const x of results.filter(x => !x.ok)) console.log(`FAIL ${x.id}: ${x.status} ${x.error || x.contentType || ''} ${x.url || ''}`);
