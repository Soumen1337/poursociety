import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const allowedHosts = new Set([
  'assets.iceland.co.uk', 'boozeexpress.com.au', 'brand-assets.edrington.com',
  'cdn.metcash.media', 'cdn.shopify.com', 'cdn11.bigcommerce.com', 'cf.shopee.sg',
  'digitalcontent.api.tesco.com', 'drinky.ch', 'globalspirits.co.nz',
  'godrinks.com', 'images.cdn.europe-west1.gcp.commercetools.com',
  'images.ctfassets.net', 'images.news18.com', 'internetwines.com',
  'londonspiritscompetition.com', 'm.media-amazon.com', 'mrliquor.com.au',
  'onlinealcohol.in', 'paneco-sg-moonshine-production.s3.ap-southeast-1.amazonaws.com',
  'static.livcheers.com', 'static.maxi.rs', 'woodencork.com',
  'www.1855thebottleshop.com', 'www.bestwaywholesale.co.uk', 'www.continente.pt',
  'www.costco.co.uk', 'www.drinksinc.com', 'www.eightpm.co.nz',
  'www.finescottishhampers.com', 'www.instacart.com', 'www.paulsliquor.com.au',
  'www.theginguild.com', 'www.vlastni-etikety.cz', 'www.theboozeoutlet.com', 'bevmo.com', 'puninwine.com', 'www.pauljohnwhisky.com'
]);

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return response({ error: 'POST required' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return response({ error: 'Server configuration is incomplete' }, 500);

  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return response({ error: 'Admin sign-in required' }, 401);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: { user }, error: authError } = await admin.auth.getUser(authHeader.slice(7));
  if (authError || !user) return response({ error: 'Invalid session' }, 401);
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') return response({ error: 'Administrator access required' }, 403);

  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body?.product_ids) ? body.product_ids.map(String).slice(0, 50) : null;
  let query = admin.from('products').select('id,name,image_url,metadata').eq('active', true);
  if (ids?.length) query = query.in('id', ids);
  const { data: products, error: listError } = await query.order('name');
  if (listError) return response({ error: listError.message }, 500);

  const pending = (products || []).filter(p => {
    try {
      const u = new URL(p.image_url);
      const sourceUrl = p.metadata?.source_image_url || p.image_url;\n      const u = new URL(sourceUrl);\n      return u.protocol === 'https:' && allowedHosts.has(u.hostname);
    } catch { return false; }
  });
  const skipped = (products || []).filter(p => !pending.some(x => x.id === p.id)).map(p => ({ id: p.id, name: p.name, status: 'skipped_existing_or_unapproved_host' }));

  const results: Array<Record<string, unknown>> = [];
  let cursor = 0;
  async function worker() {
    while (cursor < pending.length) {
      const product = pending[cursor++];
      try {
        const source = new URL(product.metadata?.source_image_url || product.image_url);
        const remote = await fetch(source.toString(), {
          redirect: 'follow',
          headers: { 'user-agent': 'PourSocietyImageSync/1.0' },
          signal: AbortSignal.timeout(12000)
        });
        const finalUrl = remote.url ? new URL(remote.url) : source;
        if (finalUrl.protocol !== 'https:' || !allowedHosts.has(finalUrl.hostname)) {
          results.push({ id: product.id, name: product.name, status: 'redirect_host_rejected' });
          continue;
        }
        const contentType = (remote.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
        if (!remote.ok || !['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(contentType)) {
          results.push({ id: product.id, name: product.name, status: 'source_rejected', http_status: remote.status, content_type: contentType });
          continue;
        }
        const bytes = new Uint8Array(await remote.arrayBuffer());
        if (!bytes.length || bytes.length > 5 * 1024 * 1024) {
          results.push({ id: product.id, name: product.name, status: 'invalid_size', bytes: bytes.length });
          continue;
        }
        const ext = contentType === 'image/jpeg' ? 'jpg' : contentType.split('/')[1];
        const path = `${product.id}/source.${ext}`;
        const { error: uploadError } = await admin.storage.from('product-images').upload(path, bytes, {
          upsert: true,
          contentType,
          cacheControl: '31536000'
        });
        if (uploadError) {
          results.push({ id: product.id, name: product.name, status: 'storage_error', error: uploadError.message });
          continue;
        }
        const { data: publicUrl } = admin.storage.from('product-images').getPublicUrl(path);
        const { error: updateError } = await admin.from('products').update({ image_url: publicUrl.publicUrl, metadata: { ...(product.metadata || {}), source_image_url: product.metadata?.source_image_url || product.image_url, source_image_synced_at: new Date().toISOString() } }).eq('id', product.id);
        if (updateError) {
          results.push({ id: product.id, name: product.name, status: 'database_error', error: updateError.message });
          continue;
        }
        results.push({ id: product.id, name: product.name, status: 'stored', bytes: bytes.length, image_url: publicUrl.publicUrl });
      } catch (error) {
        results.push({ id: product.id, name: product.name, status: 'fetch_error', error: String(error).slice(0, 200) });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, pending.length) }, () => worker()));
  return response({ total: products?.length || 0, processed: results.length, stored: results.filter(x => x.status === 'stored').length, failed: results.filter(x => x.status !== 'stored').length, results: [...results, ...skipped] });
});
