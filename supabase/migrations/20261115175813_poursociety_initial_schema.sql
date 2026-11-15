create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'customer' check (role in ('customer','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  name text not null,
  brand text not null,
  category text not null,
  subcategory text,
  volume text,
  abv text,
  origin text,
  rating numeric(2,1) check (rating is null or (rating >= 0 and rating <= 5)),
  badge text,
  tasting_notes text,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cities (
  id text primary key,
  name text not null unique,
  state_name text,
  country text not null default 'India',
  is_active boolean not null default true
);

create table if not exists public.product_prices (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  city_id text not null references public.cities(id) on delete cascade,
  price_inr integer not null check (price_inr >= 0),
  source_name text not null default 'Manual entry',
  source_url text,
  verified_at timestamptz,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (product_id, city_id, valid_from)
);

create table if not exists public.price_history (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  city_id text not null references public.cities(id) on delete cascade,
  old_price_inr integer,
  new_price_inr integer not null check (new_price_inr >= 0),
  source_name text not null,
  source_url text,
  recorded_at timestamptz not null default now(),
  recorded_by uuid references auth.users(id)
);

create table if not exists public.cocktails (
  id text primary key,
  name text not null,
  creator text,
  bar_name text,
  city_name text,
  difficulty text,
  description text,
  base_spirit text,
  ingredients jsonb not null default '[]'::jsonb,
  method jsonb not null default '[]'::jsonb,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.favourites (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'); $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_poursociety on auth.users;
create trigger on_auth_user_created_poursociety after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.record_price_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.price_history(product_id,city_id,old_price_inr,new_price_inr,source_name,source_url,recorded_by)
    values(new.product_id,new.city_id,null,new.price_inr,new.source_name,new.source_url,new.created_by);
  elsif new.price_inr is distinct from old.price_inr or new.source_name is distinct from old.source_name then
    insert into public.price_history(product_id,city_id,old_price_inr,new_price_inr,source_name,source_url,recorded_by)
    values(new.product_id,new.city_id,old.price_inr,new.price_inr,new.source_name,new.source_url,new.created_by);
  end if;
  return new;
end;
$$;
drop trigger if exists product_price_history_trigger on public.product_prices;
create trigger product_price_history_trigger after insert or update on public.product_prices
for each row execute procedure public.record_price_change();

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.cities enable row level security;
alter table public.product_prices enable row level security;
alter table public.price_history enable row level security;
alter table public.cocktails enable row level security;
alter table public.favourites enable row level security;

create policy "profiles_read_own" on public.profiles for select to authenticated
using (id = (select auth.uid()) or public.is_admin());
create policy "profiles_admin_update" on public.profiles for update to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy "products_public_read" on public.products for select to anon, authenticated
using (is_active or public.is_admin());
create policy "products_admin_write" on public.products for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy "cities_public_read" on public.cities for select to anon, authenticated
using (is_active or public.is_admin());
create policy "cities_admin_write" on public.cities for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy "prices_public_read" on public.product_prices for select to anon, authenticated
using (valid_until is null or valid_until > now());
create policy "prices_admin_write" on public.product_prices for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy "history_admin_read" on public.price_history for select to authenticated
using (public.is_admin());
create policy "history_admin_write" on public.price_history for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy "cocktails_public_read" on public.cocktails for select to anon, authenticated
using (is_active or public.is_admin());
create policy "cocktails_admin_write" on public.cocktails for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy "favourites_own_read" on public.favourites for select to authenticated
using (user_id = (select auth.uid()));
create policy "favourites_own_insert" on public.favourites for insert to authenticated
with check (user_id = (select auth.uid()));
create policy "favourites_own_delete" on public.favourites for delete to authenticated
using (user_id = (select auth.uid()));

grant select on public.products, public.cities, public.product_prices, public.cocktails to anon, authenticated;
grant select, insert, update, delete on public.products, public.cities, public.product_prices, public.cocktails to authenticated;
grant select on public.price_history to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, delete on public.favourites to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do nothing;
create policy "product_images_public_read" on storage.objects for select to anon, authenticated
using (bucket_id = 'product-images');
create policy "product_images_admin_insert" on storage.objects for insert to authenticated
with check (bucket_id = 'product-images' and public.is_admin());
create policy "product_images_admin_update" on storage.objects for update to authenticated
using (bucket_id = 'product-images' and public.is_admin()) with check (bucket_id = 'product-images' and public.is_admin());
create policy "product_images_admin_delete" on storage.objects for delete to authenticated
using (bucket_id = 'product-images' and public.is_admin());

insert into public.cities(id,name,state_name) values
  ('gurgaon','Gurgaon','Haryana'),('delhi','Delhi','Delhi'),
  ('noida','Noida','Uttar Pradesh'),('jaipur','Jaipur','Rajasthan')
on conflict (id) do update set name=excluded.name,state_name=excluded.state_name;
