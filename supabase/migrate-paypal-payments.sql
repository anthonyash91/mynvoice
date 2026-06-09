-- PayPal checkout on public invoice pages
--
-- PREREQUISITE: public.user_settings must exist.
-- If you see "relation public.user_settings does not exist", run the full
-- supabase/schema.sql first (Dashboard → SQL → New query → paste → Run).
--
-- Fresh project: schema.sql already includes these PayPal columns — you can
-- skip this file after running schema.sql.
--
-- Existing project (user_settings already there): run this file only.

alter table public.user_settings
add column if not exists paypal_client_id text not null default '';

alter table public.user_settings
add column if not exists paypal_client_secret text not null default '';

alter table public.user_settings
add column if not exists paypal_sandbox boolean not null default true;
