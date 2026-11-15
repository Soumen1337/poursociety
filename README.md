# PourSociety

PourSociety is a public spirits, wine, beer and cocktail discovery catalogue with indicative city-price comparisons for Gurgaon, Delhi, Noida and Jaipur. It is a non-commerce information project: it does not sell or deliver alcohol.

## Stack

- React 19 + Vite
- Supabase PostgreSQL, Auth, RLS, Storage and Edge Functions
- Vercel static hosting and GitHub-connected deployments

## Local setup

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env.local`.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from your own Supabase project. The publishable key is browser-safe when RLS is enabled. Never place a service-role/secret key in a `VITE_` variable.
4. Run `npm install`, then `npm run dev`.
5. Run `npm run build` before pushing.

## Supabase project

Project ref: `qdlohormyrumfhzdaxum`

The database migrations are in `supabase/migrations/` and catalogue data is in `supabase/seed.sql`. The live project already has its schema migrations applied. If setting up a fresh project, run migrations in timestamp order, then execute `supabase/seed.sql` in the SQL Editor. Seeded prices are legacy estimates, marked `verified = false`, with an unknown source date. Do not describe them as live retail quotes.

The `product-images` Storage bucket is public-read and admin-write. Use the Admin dashboard to upload a replacement photo or run **Copy external photos to Supabase Storage**. That button calls the deployed `image-sync` Edge Function, which copies images from the approved source-host allowlist into your own bucket, updates product image URLs and retains the source URL in product metadata. The function reports blocked/invalid sources instead of substituting generated artwork.

For local image downloads, `scripts/check-images.mjs` tests the current source URLs and writes working files into `public/images/`, then rewrites `src/catalog.seed.json`. Run it from a network-enabled machine; source hosts can block hotlinking. `scripts/upload-images-to-supabase.mjs` uploads downloaded local assets to the bucket. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` only in your local shell for that one-time upload script. Never commit those values.

## Create your sole admin

1. Open the deployed website and create your own account.
2. Open Supabase Dashboard → SQL Editor.
3. Copy `supabase/promote-admin.sql`, replace `YOUR_OWNER_EMAIL`, and run it.
4. Sign out and back in. The Admin control appears only when `profiles.role = 'admin'`. Public signups always receive the `customer` role; users cannot promote themselves. A partial unique index enforces at most one admin profile in the project.

## Price data updates

Manual price changes are available in the admin dashboard and are logged to `price_history`. The deployed `price-ingest` Edge Function accepts authenticated admin requests with `prices: [{ product_id, city, price }]`, plus `source_label` and optional `source_url`. It validates city and amount, and records API imports as unverified. No retailer API provider has been configured yet: automated live updates require an authorized source/API for the relevant city/state. Do not scrape retailer pages where their terms prohibit it.

Example request body for an authorized feed:

```json
{
  "source_label": "Approved supplier feed",
  "source_url": "https://supplier.example/prices",
  "prices": [
    { "product_id": "indri-trini", "city": "Gurgaon", "price": 3200 }
  ]
}
```

Send the request to `https://qdlohormyrumfhzdaxum.supabase.co/functions/v1/price-ingest` with the signed-in admin access token in `Authorization: Bearer <token>`. Never send the service-role key from the browser.

## Vercel deployment

1. Import `Soumen1337/poursociety` in Vercel.
2. Framework preset: Vite. Build command: `npm run build`. Output directory: `dist`.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` under Project Settings → Environment Variables.
4. Deploy.
5. In Supabase → Authentication → URL Configuration, add the Vercel production URL to Site URL / Redirect URLs.
6. Pushes to `main` trigger deployments after GitHub/Vercel integration is enabled.

## Security

- Browser client uses only the Supabase publishable key.
- RLS is enabled on all public tables.
- Admin access is controlled by the server-owned `profiles.role` value.
- `private.is_admin()` is placed in a non-exposed schema.
- Storage uploads require admin authorization.
- Never commit `.env.local`, database passwords, service-role keys or provider secrets.

## Image and price provenance

Product photos currently reference external sources until local copies are downloaded and uploaded to Supabase Storage. Some providers block hotlinking or may change URLs. The image audit script reports each source's result. The legacy price list is reference data only and is not verified as current.
