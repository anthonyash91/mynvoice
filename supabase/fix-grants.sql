-- Run this if you see permission or RLS errors after signing in.
-- Supabase Dashboard → SQL → New query

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.clients to authenticated;
grant select, insert, update, delete on public.invoices to authenticated;
grant select, insert, update, delete on public.user_settings to authenticated;

grant select on public.clients to anon;
grant select on public.invoices to anon;
grant select on public.user_settings to anon;
