# PourSociety

PourSociety is a public spirits, wine, beer and cocktail discovery catalogue with indicative city-price comparisons for Gurgaon, Delhi, Noida and Jaipur. It is a non-commerce information project: it does not sell or deliver alcohol.

## Stack

- React 19 + Vite
- Supabase PostgreSQL, Auth, RLS, Storage and Edge Functions
- Vercel static hosting and GitHub-connected deployments

## Local setup

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env.local` when using a different Supabase environment.
3. Optional: set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. This project has browser-safe public defaults for its current Supabase project. Never place a service-role/secret key in a `VITE_` variable.
4. Run `npm install`, then `npm run dev`.
5. Run `npm run build` before pushing.

## Supabase project

Project ref: `qdlohormyrumfhzdaxum`

The database migrations are in `supabase/migrations/` and catalogue data is in `supabase/seed.sql`. The live project already has its schema migrations applied. If setting up a fresh project, run migrations in timestamp order, then execute `supabase/seed.sql` in the SQL Editor. Seeded prices are legacy estimates, marked `verified = false`, with an unknown source date. Do not describe them as live retail quotes.

The `product-images` Storage bucket is public-read and admin-write. Use the Admin dashboard to upload a replacement photo or run **Copy external photos to Supabase Storage**. That button calls the deployed `image-sync` Edge Function, which copies images from the approved source-host allowlist into your own bucket, updates product image URLs and retains the source URL in product metadata. The function reports blocked/invalid sources instead of substituting generated artwork.

For local image downloads, `scripts/check-images.mjs` tests current source URLs and writes working files into `public/images/`, then rewrites `src/catalog.seed.json`. Run it from a network-enabled machine; source hosts can block hotlinking. `scripts/upload-images-to-supabase.mjs` uploads downloaded local assets to the bucket. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` only in your local shell for that one-time upload script. Never commit those values.

## Create your sole admin

1. Open the website and create your own account.
2. Open Supabase Dashboard → SQL Editor.
3. Copy `supabase/promote-admin.sql`, replace `YOUR_OWNER_EMAIL` with the exact email used for sign-up, and run it.
4. Sign out and back in. The Admin control appears only when `profiles.role = 'admin'`. Public signups always receive the `customer` role; users cannot promote themselves. A partial unique index enforces at most one admin profile in the project.

The live database currently has **zero admin accounts**, so admin-only image syncing and price editing remain locked until the owner account is promoted.

## Price data updates

The official sources registered for the four markets are documented in [PRICE-SOURCES.md](./PRICE-SOURCES.md) and stored in the admin-only `public.price_sources` table. Current portal checks establish that each state publishes some relevant price information, but do not establish a permitted machine-readable API for automated collection. Haryana's 2025–27 excise policy gives minimum retail-price categories/pack sizes, not exact live brand-level MRP. Therefore no scheduled price importer is enabled.

Manual price changes are available in the admin dashboard and are logged to `price_history`. The deployed `price-ingest` Edge Function accepts authenticated admin requests with `prices: [{ product_id, city, price }]`, plus `source_label` and optional `source_url`. It validates city and amount, and records API imports as unverified. An authorized source/API for the relevant city/state is still required for automatic updates.

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
3. The current Supabase URL and publishable key are set as safe browser defaults in `src/supabase.js`. Environment variables can override them.
4. Deploy.
5. In Supabase → Authentication → URL Configuration, add the production URL to Site URL / Redirect URLs.
6. Connect the Vercel project to GitHub `main` to enable deployments on pushes. GitHub Actions separately checks every production build.

## Security

- Browser client uses only the Supabase publishable key.
- RLS is enabled on all public tables.
- Admin access is controlled by the server-owned `profiles.role` value.
- `private.is_admin()` is placed in a non-exposed schema.
- Storage uploads require admin authorization.
- Never commit `.env.local`, database passwords, service-role keys or provider secrets.

## Image and price provenance

Product photos currently reference external sources until local copies are downloaded and uploaded to Supabase Storage. Some providers block hotlinking or may change URLs. The image audit script reports each source's result. The legacy price list is reference data only and is not verified as current.


## Appearance

The header includes a persistent **Light / Dark** switch. Dark mode remains the default and keeps the original charcoal, black and champagne-gold design. Light mode uses a warm ivory canvas, soft white cards, dark readable text and muted gold accents. The choice is saved in the browser under `ps-theme`.

## Product image audit

The project audits product photos against the **live Supabase catalogue**, not just the offline seed:

1. Open GitHub → Actions → **Audit all product images** → **Run workflow**, or update `scripts/audit-product-images.mjs`.
2. The audit checks every active product image URL, rejects non-image responses and unsafe/unknown hosts, and downloads valid photos (maximum 5 MB each) to `public/images/`.
3. It commits `image-audit.json`, the local photos, the refreshed fallback catalogue and `supabase/updates/20261116_sync_local_product_images.sql`.
4. Run the generated SQL in Supabase SQL Editor to map the verified local image paths into `public.products.image_url`.

Only images that return a valid image response are mapped to local paths. Failed images remain listed with their reason in `image-audit.json`; they are not replaced with unrelated stock images or generated placeholders.
