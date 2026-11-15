import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
});

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return respond({ error: 'POST required' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return respond({ error: 'Server configuration is incomplete' }, 500);

  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return respond({ error: 'Admin sign-in required' }, 401);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: { user }, error: authError } = await admin.auth.getUser(authHeader.slice(7));
  if (authError || !user) return respond({ error: 'Invalid session' }, 401);
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') return respond({ error: 'Administrator access required' }, 403);

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.prices) || body.prices.length < 1 || body.prices.length > 500) {
    return respond({ error: 'Expected prices array with 1–500 entries' }, 400);
  }
  const allowedCities = new Set(['Gurgaon', 'Delhi', 'Noida', 'Jaipur']);
  const sourceUrl = body.source_url ? String(body.source_url) : null;
  if (sourceUrl) {
    try {
      const parsed = new URL(sourceUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('scheme');
    } catch {
      return respond({ error: 'source_url must be a valid HTTP(S) URL' }, 400);
    }
  }
  const sourceLabel = String(body.source_label || 'Authorized external feed').slice(0, 120);
  const rows = [];
  for (const item of body.prices) {
    const amount = Number(item.price);
    if (!item.product_id || !allowedCities.has(item.city) || !Number.isFinite(amount) || amount < 0) {
      return respond({ error: 'Each row needs product_id, supported city, and non-negative numeric price' }, 400);
    }
    rows.push({
      product_id: String(item.product_id), city: item.city, price: amount,
      source_type: 'api', source_label: sourceLabel, source_url: sourceUrl,
      verified: false, updated_at: new Date().toISOString()
    });
  }
  const { data, error } = await admin.from('city_prices')
    .upsert(rows, { onConflict: 'product_id,city' })
    .select('product_id,city,price,source_type,source_label,source_url,verified,updated_at');
  if (error) return respond({ error: error.message }, 500);
  return respond({ imported: data?.length || 0, prices: data });
});
