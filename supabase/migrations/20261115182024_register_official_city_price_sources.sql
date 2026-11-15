-- Register authoritative state sources for each price market.
-- This table is admin-only; registering a portal is not a claim that it provides an
-- authorized machine-readable feed.

create table if not exists public.price_sources (
  id text primary key,
  city text not null check (city in ('Gurgaon','Delhi','Noida','Jaipur')),
  source_name text not null,
  source_url text not null,
  source_kind text not null check (source_kind in ('official_portal','policy_document')),
  price_granularity text not null check (price_granularity in ('brand_sku_mrp','policy_category','mixed')),
  automation_status text not null default 'manual_review_required'
    check (automation_status in ('manual_review_required','ready_for_api','automated')),
  last_checked_at timestamptz,
  last_success_at timestamptz,
  notes text,
  updated_at timestamptz not null default now()
);

alter table public.price_sources enable row level security;
create policy "price_sources_admin_read" on public.price_sources
  for select to authenticated using (private.is_admin());
create policy "price_sources_admin_insert" on public.price_sources
  for insert to authenticated with check (private.is_admin());
create policy "price_sources_admin_update" on public.price_sources
  for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "price_sources_admin_delete" on public.price_sources
  for delete to authenticated using (private.is_admin());
grant select, insert, update, delete on public.price_sources to authenticated;

insert into public.price_sources
(id, city, source_name, source_url, source_kind, price_granularity, automation_status, notes)
values
('delhi-excise-price-list', 'Delhi',
 'Delhi Excise Department — Price List',
 'https://excise.delhi.gov.in/excise/additional-information-0',
 'official_portal', 'brand_sku_mrp', 'manual_review_required',
 'The official department page links to a separate Price List portal. A supported machine-readable feed/API and automated access terms have not yet been verified.'),
('gurgaon-haryana-excise-policy', 'Gurgaon',
 'Haryana Excise and Taxation Department — Excise Policy 2025-27',
 'https://haryanatax.gov.in/HEX/DownloadPDF?formName=%2FExcisePolicy2025_27%2FExcise_Policy_2025_27.pdf',
 'policy_document', 'policy_category', 'manual_review_required',
 'The policy includes minimum retail-sale-price bands for 1 April 2026 to 31 March 2027, not a complete SKU-level retail MRP feed.'),
('noida-up-liquor-price-finder', 'Noida',
 'Uttar Pradesh Excise Department — Liquor Price Finder',
 'https://cms.upexciseonline.co/',
 'official_portal', 'brand_sku_mrp', 'manual_review_required',
 'The official IESCMS portal exposes Entity Type Wise MRP and Liquor Type Wise MRP pages. An authorized automated endpoint and terms have not yet been verified.'),
('jaipur-rajasthan-approved-rate-list', 'Jaipur',
 'Rajasthan Excise Department — Approved Rate List 2026-27',
 'https://excise.rajasthan.gov.in/RSED/Website/Approved-Rate-List.aspx',
 'official_portal', 'brand_sku_mrp', 'manual_review_required',
 'The official portal provides an approved-rate list and Search Brand MRP page. Dynamic result requests/API contract have not yet been verified.')
on conflict (id) do update set
  city = excluded.city,
  source_name = excluded.source_name,
  source_url = excluded.source_url,
  source_kind = excluded.source_kind,
  price_granularity = excluded.price_granularity,
  notes = excluded.notes,
  updated_at = now();
