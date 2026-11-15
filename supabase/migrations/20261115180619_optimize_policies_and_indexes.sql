drop policy if exists "products_admin_write_v2" on public.products;
create policy "products_admin_insert" on public.products for insert to authenticated with check (private.is_admin());
create policy "products_admin_update" on public.products for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "products_admin_delete" on public.products for delete to authenticated using (private.is_admin());

drop policy if exists "cities_admin_write_v2" on public.cities;
create policy "cities_admin_insert" on public.cities for insert to authenticated with check (private.is_admin());
create policy "cities_admin_update" on public.cities for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "cities_admin_delete" on public.cities for delete to authenticated using (private.is_admin());

drop policy if exists "city_prices_admin_write" on public.city_prices;
create policy "city_prices_admin_insert" on public.city_prices for insert to authenticated with check (private.is_admin());
create policy "city_prices_admin_update" on public.city_prices for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "city_prices_admin_delete" on public.city_prices for delete to authenticated using (private.is_admin());

drop policy if exists "prices_admin_write_v2" on public.product_prices;
create policy "product_prices_admin_insert" on public.product_prices for insert to authenticated with check (private.is_admin());
create policy "product_prices_admin_update" on public.product_prices for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "product_prices_admin_delete" on public.product_prices for delete to authenticated using (private.is_admin());

drop policy if exists "cocktails_admin_write_v2" on public.cocktails;
create policy "cocktails_admin_insert" on public.cocktails for insert to authenticated with check (private.is_admin());
create policy "cocktails_admin_update" on public.cocktails for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "cocktails_admin_delete" on public.cocktails for delete to authenticated using (private.is_admin());
drop policy if exists "history_admin_write_v2" on public.price_history;

create index if not exists favourites_product_id_idx on public.favourites(product_id);
create index if not exists price_history_city_id_idx on public.price_history(city_id);
create index if not exists price_history_product_recorded_at_idx on public.price_history(product_id,recorded_at desc);
create index if not exists price_history_recorded_by_idx on public.price_history(recorded_by);
create index if not exists product_prices_city_id_idx on public.product_prices(city_id);
create index if not exists product_prices_created_by_idx on public.product_prices(created_by);
