-- Keep public price transparency while hiding internal user identifiers and legacy audit fields.
revoke select on public.price_history from anon, authenticated;
grant select (product_id, city, old_price, new_price, source_type, source_label, changed_at)
on public.price_history to anon, authenticated;

-- The legacy versioned table is not used by the public client; restrict it to authenticated admins.
drop policy if exists "prices_public_read_v2" on public.product_prices;
revoke select on public.product_prices from anon, authenticated;
