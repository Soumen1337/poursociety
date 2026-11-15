-- Public SELECT policies call this helper to allow active catalogue rows.
-- The helper returns false for anonymous users (auth.uid() is NULL) and private schema is not API-exposed.
grant usage on schema private to anon, authenticated;
grant execute on function private.is_admin() to anon, authenticated;
