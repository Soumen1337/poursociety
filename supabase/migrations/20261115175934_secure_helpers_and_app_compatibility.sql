create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'); $$;
revoke all on function private.is_admin() from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.record_price_change() from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon, authenticated;

alter table public.products add column if not exists type text not null default 'spirit';
alter table public.products add column if not exists description text;
alter table public.products add column if not exists active boolean not null default true;
alter table public.products add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.city_prices (
 id uuid primary key default gen_random_uuid(),
 product_id text not null references public.products(id) on delete cascade,
 city text not null check (city in ('Gurgaon','Delhi','Noida','Jaipur')),
 price numeric(10,2) not null check (price >= 0),
 source_type text not null default 'manual' check (source_type in ('manual','api','verified_retailer','import')),
 source_label text, source_url text, verified boolean not null default false,
 updated_at timestamptz not null default now(), unique(product_id,city)
);
create index if not exists city_prices_city_product_idx on public.city_prices(city,product_id);

alter table public.price_history add column if not exists city text;
alter table public.price_history add column if not exists old_price numeric(10,2);
alter table public.price_history add column if not exists new_price numeric(10,2);
alter table public.price_history add column if not exists source_type text;
alter table public.price_history add column if not exists source_label text;
alter table public.price_history add column if not exists changed_at timestamptz not null default now();

create or replace function public.log_city_price_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_city_id text;
begin
 select c.id into v_city_id from public.cities c where c.name = new.city;
 if v_city_id is null then raise exception 'Unknown city: %', new.city; end if;
 if tg_op = 'INSERT' then
  insert into public.price_history(product_id,city_id,old_price_inr,new_price_inr,source_name,source_url,recorded_by,city,old_price,new_price,source_type,source_label,changed_at)
  values(new.product_id,v_city_id,null,new.price::integer,coalesce(new.source_label,new.source_type),new.source_url,auth.uid(),new.city,null,new.price,new.source_type,new.source_label,new.updated_at);
 elsif new.price is distinct from old.price or new.source_type is distinct from old.source_type or new.source_label is distinct from old.source_label then
  insert into public.price_history(product_id,city_id,old_price_inr,new_price_inr,source_name,source_url,recorded_by,city,old_price,new_price,source_type,source_label,changed_at)
  values(new.product_id,v_city_id,old.price::integer,new.price::integer,coalesce(new.source_label,new.source_type),new.source_url,auth.uid(),new.city,old.price,new.price,new.source_type,new.source_label,new.updated_at);
 end if;
 return new;
end;
$$;
revoke all on function public.log_city_price_change() from public, anon, authenticated;
drop trigger if exists city_prices_history_trigger on public.city_prices;
create trigger city_prices_history_trigger after insert or update of price,source_type,source_label
on public.city_prices for each row execute function public.log_city_price_change();

-- Replace public helper references with a non-exposed private-schema helper.
drop policy if exists "profiles_read_own" on public.profiles;
drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_read_own" on public.profiles for select to authenticated
using (id = (select auth.uid()) or private.is_admin());
create policy "profiles_admin_update" on public.profiles for update to authenticated
using (private.is_admin()) with check (private.is_admin());

drop policy if exists "products_public_read" on public.products;
drop policy if exists "products_admin_write" on public.products;
create policy "products_public_read_v2" on public.products for select to anon,authenticated using (active or private.is_admin());
create policy "products_admin_write_v2" on public.products for all to authenticated using (private.is_admin()) with check (private.is_admin());

drop policy if exists "cities_public_read" on public.cities;
drop policy if exists "cities_admin_write" on public.cities;
create policy "cities_public_read_v2" on public.cities for select to anon,authenticated using (is_active or private.is_admin());
create policy "cities_admin_write_v2" on public.cities for all to authenticated using (private.is_admin()) with check (private.is_admin());

drop policy if exists "prices_public_read" on public.product_prices;
drop policy if exists "prices_admin_write" on public.product_prices;
create policy "prices_public_read_v2" on public.product_prices for select to anon,authenticated using (valid_until is null or valid_until > now());
create policy "prices_admin_write_v2" on public.product_prices for all to authenticated using (private.is_admin()) with check (private.is_admin());

drop policy if exists "history_admin_read" on public.price_history;
drop policy if exists "history_admin_write" on public.price_history;
create policy "history_public_read_v2" on public.price_history for select to anon,authenticated using (true);
create policy "history_admin_write_v2" on public.price_history for all to authenticated using (private.is_admin()) with check (private.is_admin());

drop policy if exists "cocktails_public_read" on public.cocktails;
drop policy if exists "cocktails_admin_write" on public.cocktails;
create policy "cocktails_public_read_v2" on public.cocktails for select to anon,authenticated using (is_active or private.is_admin());
create policy "cocktails_admin_write_v2" on public.cocktails for all to authenticated using (private.is_admin()) with check (private.is_admin());

drop policy if exists "favourites_own_read" on public.favourites;
drop policy if exists "favourites_own_insert" on public.favourites;
drop policy if exists "favourites_own_delete" on public.favourites;
create policy "favourites_own_read_v2" on public.favourites for select to authenticated using (user_id = (select auth.uid()));
create policy "favourites_own_insert_v2" on public.favourites for insert to authenticated with check (user_id = (select auth.uid()));
create policy "favourites_own_delete_v2" on public.favourites for delete to authenticated using (user_id = (select auth.uid()));

alter table public.city_prices enable row level security;
drop policy if exists "city_prices_public_read" on public.city_prices;
drop policy if exists "city_prices_admin_write" on public.city_prices;
create policy "city_prices_public_read" on public.city_prices for select to anon,authenticated using (true);
create policy "city_prices_admin_write" on public.city_prices for all to authenticated using (private.is_admin()) with check (private.is_admin());

drop policy if exists "product_images_admin_insert" on storage.objects;
drop policy if exists "product_images_admin_update" on storage.objects;
drop policy if exists "product_images_admin_delete" on storage.objects;
create policy "product_images_admin_insert" on storage.objects for insert to authenticated with check (bucket_id='product-images' and private.is_admin());
create policy "product_images_admin_update" on storage.objects for update to authenticated using (bucket_id='product-images' and private.is_admin()) with check (bucket_id='product-images' and private.is_admin());
create policy "product_images_admin_delete" on storage.objects for delete to authenticated using (bucket_id='product-images' and private.is_admin());

drop function if exists public.is_admin();
grant select on public.city_prices to anon,authenticated;
grant insert,update,delete on public.city_prices to authenticated;
grant select on public.price_history to anon,authenticated;
