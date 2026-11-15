import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = process.cwd();
const catalogPath = path.join(ROOT, 'src', 'catalog.seed.json');
const sourcesPath = path.join(ROOT, 'image-sources.json');
const auditPath = path.join(ROOT, 'image-audit.json');
const sqlPath = path.join(ROOT, 'supabase', 'updates', '20261116_sync_local_product_images.sql');
const outDir = path.join(ROOT, 'public', 'images');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qdlohormyrumfhzdaxum.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_FGFlX-siLsJIHJboSTMNPQ_HTM225gs';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const allowedHosts = new Set([
  'assets.iceland.co.uk','boozeexpress.com.au','brand-assets.edrington.com','cdn.metcash.media',
  'cdn.shopify.com','cdn11.bigcommerce.com','cf.shopee.sg','digitalcontent.api.tesco.com',
  'drinky.ch','globalspirits.co.nz','godrinks.com','images.cdn.europe-west1.gcp.commercetools.com',
  'images.ctfassets.net','images.news18.com','internetwines.com','londonspiritscompetition.com',
  'm.media-amazon.com','mrliquor.com.au','onlinealcohol.in',
  'paneco-sg-moonshine-production.s3.ap-southeast-1.amazonaws.com','static.livcheers.com',
  'static.maxi.rs','woodencork.com','www.1855thebottleshop.com','www.bestwaywholesale.co.uk',
  'www.continente.pt','www.costco.co.uk','www.drinksinc.com','www.eightpm.co.nz',
  'www.finescottishhampers.com','www.instacart.com','www.paulsliquor.com.au','www.theginguild.com','www.theboozeoutlet.com','bevmo.com',
  'www.vlastni-etikety.cz',
  'images.squarespace-cdn.com','www.whiskybrother.com','assets.gqindia.com','www.bswliquor.com',
  'goodpour.com','vinosylicores.hn','target.scene7.com','everydaydirect.co.uk',
  'camperdowncellars.com.au','s3.me-central-1.amazonaws.com','cdn.store-assets.com',
  'images.salsify.com','spiritory.com','theboozeoutlet.com','d1q9atv66skeoi.cloudfront.net',
  'cdn.prod2.whisky.fr','www.spencers.in','cdn.shopify.com'
]);

const safeId = value => String(value).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
const sqlQuote = value => "'" + String(value).replace(/'/g, "''") + "'";

await fs.mkdir(outDir, { recursive: true });
await fs.mkdir(path.dirname(sqlPath), { recursive: true });

const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
const sourceInventory = JSON.parse(await fs.readFile(sourcesPath, 'utf8'));
const localById = new Map();
for (const group of ['products','wines','cocktails']) {
  for (const item of catalog[group] || []) localById.set(item.id, item);
}

const { data: dbProducts, error: dbError } = await supabase
  .from('products')
  .select('id,name,image_url,metadata')
  .eq('active', true)
  .order('name');
if (dbError) throw new Error('Could not read the live product catalogue: ' + dbError.message);
if (!dbProducts?.length) throw new Error('The live catalogue returned no active products.');

const tasks = dbProducts.map(product => ({
  id: product.id,
  name: product.name,
  sourceUrl: product.metadata?.source_image_url || product.image_url,
  currentUrl: product.image_url,
  metadata: product.metadata || {}
}));

const report = [];
const updates = [];
let cursor = 0;
async function worker() {
  while (cursor < tasks.length) {
    const product = tasks[cursor++];
    if (!product.sourceUrl) {
      report.push({ id: product.id, name: product.name, status: 'missing_source', ok: false });
      continue;
    }

    try {
      const source = new URL(product.sourceUrl);
      if (source.protocol !== 'https:' || !allowedHosts.has(source.hostname)) {
        report.push({ id: product.id, name: product.name, status: 'source_host_not_approved', source_url: product.sourceUrl, ok: false });
        continue;
      }

      const response = await fetch(source.toString(), {
        redirect: 'follow',
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; PourSocietyImageAudit/1.0)',
          'accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        },
        signal: AbortSignal.timeout(15000)
      });

      let finalUrl;
      try { finalUrl = new URL(response.url || source.toString()); }
      catch { throw new Error('Invalid redirect URL'); }
      if (finalUrl.protocol !== 'https:' || !allowedHosts.has(finalUrl.hostname)) {
        report.push({ id: product.id, name: product.name, status: 'redirect_host_not_approved', source_url: product.sourceUrl, final_url: response.url, ok: false });
        continue;
      }

      const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (!response.ok || !['image/jpeg','image/png','image/webp','image/avif'].includes(contentType)) {
        report.push({ id: product.id, name: product.name, status: 'source_unavailable_or_not_image', http_status: response.status, content_type: contentType, source_url: product.sourceUrl, ok: false });
        continue;
      }

      const announcedSize = Number(response.headers.get('content-length') || 0);
      if (announcedSize > 5 * 1024 * 1024) {
        report.push({ id: product.id, name: product.name, status: 'image_too_large', bytes: announcedSize, source_url: product.sourceUrl, ok: false });
        continue;
      }

      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length || bytes.length > 5 * 1024 * 1024) {
        report.push({ id: product.id, name: product.name, status: 'invalid_image_size', bytes: bytes.length, source_url: product.sourceUrl, ok: false });
        continue;
      }

      const ext = contentType === 'image/jpeg' ? 'jpg' : contentType.split('/')[1];
      const filename = safeId(product.id) + '.' + ext;
      await fs.writeFile(path.join(outDir, filename), bytes);
      const localUrl = '/images/' + filename;
      const catalogItem = localById.get(product.id);
      if (catalogItem) catalogItem.image = localUrl;

      const metadata = {
        ...product.metadata,
        source_image_url: product.sourceUrl,
        image_audited_at: new Date().toISOString(),
        image_source_status: 'downloaded_and_validated'
      };

      updates.push(
        'update public.products set image_url=' + sqlQuote(localUrl) +
        ', metadata=coalesce(metadata,\'{}\'::jsonb)||' + sqlQuote(JSON.stringify(metadata)) +
        '::jsonb, updated_at=now() where id=' + sqlQuote(product.id) + ';'
      );
      report.push({
        id: product.id, name: product.name, status: 'downloaded_and_validated',
        http_status: response.status, content_type: contentType, bytes: bytes.length,
        source_url: product.sourceUrl, local_url: localUrl, ok: true
      });
    } catch (error) {
      report.push({
        id: product.id, name: product.name, status: 'fetch_error',
        source_url: product.sourceUrl, error: String(error).slice(0, 240), ok: false
      });
    }
  }
}

await Promise.all(Array.from({ length: 5 }, () => worker()));
await fs.writeFile(catalogPath, JSON.stringify(catalog, null, 2));

const result = {
  audited_at: new Date().toISOString(),
  live_products: tasks.length,
  downloaded: report.filter(x => x.ok).length,
  failed: report.filter(x => !x.ok).length,
  results: report.sort((a,b) => a.id.localeCompare(b.id))
};
await fs.writeFile(auditPath, JSON.stringify(result, null, 2));

sourceInventory.checkedAt = result.audited_at;
sourceInventory.entries = (sourceInventory.entries || []).map(entry => {
  const audit = report.find(x => x.id === entry.id);
  if (!audit) return entry;
  return {
    ...entry,
    status: audit.status,
    local: audit.local_url || null,
    content_type: audit.content_type || null,
    bytes: audit.bytes || null,
    audit_error: audit.error || null
  };
});
await fs.writeFile(sourcesPath, JSON.stringify(sourceInventory, null, 2));

const sql = [
  '-- Generated by scripts/audit-product-images.mjs after verifying image responses.',
  '-- Only successfully downloaded image files are mapped to local /images/ paths.',
  'begin;',
  ...updates,
  'commit;',
  ''
].join('\n');
await fs.writeFile(sqlPath, sql);

console.log(JSON.stringify({
  live_products: result.live_products,
  downloaded: result.downloaded,
  failed: result.failed,
  sql_updates: updates.length,
  failed_products: report.filter(x => !x.ok).map(x => ({ id: x.id, status: x.status, error: x.error || null }))
}, null, 2));
