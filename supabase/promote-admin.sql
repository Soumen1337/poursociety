-- Run in Supabase SQL Editor AFTER you have signed up through the website.
-- Replace the email with the exact email address of your owner account.
update public.profiles
set role = 'admin', updated_at = now()
where id = (select id from auth.users where lower(email) = lower('YOUR_OWNER_EMAIL'));

-- Confirm exactly one admin account exists.
select u.email, p.role
from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'admin';
