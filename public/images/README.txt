Product photographs belong in this directory as local optimized WebP/JPEG/PNG files.

To download approved source photographs from a network-enabled machine:
  npm run images:audit

To upload the downloaded files into your own Supabase Storage bucket:
  Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your local shell only.
  node scripts/upload-images-to-supabase.mjs

Alternatively, sign in as the PourSociety admin and use the Admin dashboard's
"Copy external photos to Supabase Storage" button. This uses the deployed
image-sync Edge Function and only fetches from the approved host allowlist.
