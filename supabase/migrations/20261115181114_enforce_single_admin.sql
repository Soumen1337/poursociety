-- The selected owner is the only administrator allowed in this project.
create unique index if not exists profiles_single_admin_idx
on public.profiles ((role))
where role = 'admin';
