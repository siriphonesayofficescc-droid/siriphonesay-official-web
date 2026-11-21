-- ═══════════════════════════════════════════════════════════════════
-- Siriphonesay Construction — house designer backend (Supabase / PostgreSQL)
-- Run once in Supabase → SQL Editor. Safe to re-run (idempotent where possible).
-- ═══════════════════════════════════════════════════════════════════

-- ── roles ──────────────────────────────────────────────────────────
do $$ begin
  create type app_role as enum ('customer','md','admin','architect','engineer','qs','sales');
exception when duplicate_object then null; end $$;

-- ── profiles (one per auth user) ───────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role app_role not null default 'customer',
  created_at timestamptz not null default now()
);

-- create a profile automatically at sign-up
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone')
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- helper: current user's role
create or replace function public.my_role() returns app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;
create or replace function public.is_staff() returns boolean
language sql stable as $$ select coalesce(public.my_role() <> 'customer', false) $$;

-- ── designs ────────────────────────────────────────────────────────
create table if not exists public.designs (
  id uuid primary key default gen_random_uuid(),
  ref text unique not null,                 -- project reference e.g. SCC-26-4F7K
  owner uuid references auth.users(id) on delete cascade,
  name text not null,
  style text,
  data jsonb not null,                      -- full parametric design (regenerates the 3D model)
  estimate_usd numeric,
  gfa numeric,
  thumbnail text,                           -- small JPEG data URL
  status text default 'Draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists designs_owner_idx on public.designs(owner);

-- ── quotation requests ─────────────────────────────────────────────
create table if not exists public.quotation_requests (
  id uuid primary key default gen_random_uuid(),
  ref text not null,
  design_ref text not null,
  design_id uuid references public.designs(id) on delete set null,
  customer_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  phone text,
  location text,
  budget text,
  timeline text,
  message text,
  design jsonb not null,                    -- snapshot at submission time
  estimate_usd numeric,
  share_link text,
  specs text,                               -- full specification text
  images jsonb default '[]'::jsonb,         -- small 3D screenshots (JPEG data URLs)
  status text not null default 'Submitted', -- Submitted / Under review / Site visit / Quoted / Won / Closed
  assigned_to uuid references public.profiles(id),
  response text,                            -- reply shown to the customer
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quotes_customer_idx on public.quotation_requests(customer_id);
-- upgrade for existing databases
alter table public.quotation_requests add column if not exists specs text;
alter table public.quotation_requests add column if not exists images jsonb default '[]'::jsonb;

-- ── settings (rates, catalogue) ────────────────────────────────────
create table if not exists public.settings (
  key text primary key,                     -- 'rates' | 'catalog'
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ── uploaded 3D models of completed projects ───────────────────────
create table if not exists public.models (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  file_url text not null,
  storage_path text not null,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

-- ═══ Row-level security ═════════════════════════════════════════════
alter table public.profiles enable row level security;
alter table public.designs enable row level security;
alter table public.quotation_requests enable row level security;
alter table public.settings enable row level security;
alter table public.models enable row level security;

-- profiles: users read/update their own; staff read all; MD/admin manage roles
drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles for select using (id = auth.uid() or public.is_staff());
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid())); -- cannot change own role
drop policy if exists "profiles admin manage" on public.profiles;
create policy "profiles admin manage" on public.profiles for update using (public.my_role() in ('md','admin'));

-- designs: owner full access; staff read
drop policy if exists "designs owner" on public.designs;
create policy "designs owner" on public.designs for all using (owner = auth.uid()) with check (owner = auth.uid());
drop policy if exists "designs staff read" on public.designs;
create policy "designs staff read" on public.designs for select using (public.is_staff());

-- quotation requests: anyone may submit (also anonymous visitors); customers read their own; staff read/update
drop policy if exists "quotes insert" on public.quotation_requests;
create policy "quotes insert" on public.quotation_requests for insert with check (customer_id is null or customer_id = auth.uid());
drop policy if exists "quotes own read" on public.quotation_requests;
create policy "quotes own read" on public.quotation_requests for select using (customer_id = auth.uid() or public.is_staff());
drop policy if exists "quotes staff update" on public.quotation_requests;
create policy "quotes staff update" on public.quotation_requests for update using (public.is_staff());

-- settings: public read (estimator needs rates); only MD / admin / QS write
drop policy if exists "settings read" on public.settings;
create policy "settings read" on public.settings for select using (true);
drop policy if exists "settings write" on public.settings;
create policy "settings write" on public.settings for all using (public.my_role() in ('md','admin','qs')) with check (public.my_role() in ('md','admin','qs'));

-- models: public read of published; staff manage
drop policy if exists "models read" on public.models;
create policy "models read" on public.models for select using (published or public.is_staff());
drop policy if exists "models manage" on public.models;
create policy "models manage" on public.models for all using (public.my_role() in ('md','admin','architect','engineer')) with check (public.my_role() in ('md','admin','architect','engineer'));

-- ═══ Storage bucket for GLB models ══════════════════════════════════
insert into storage.buckets (id, name, public) values ('models', 'models', true) on conflict (id) do nothing;
drop policy if exists "models bucket read" on storage.objects;
create policy "models bucket read" on storage.objects for select using (bucket_id = 'models');
drop policy if exists "models bucket write" on storage.objects;
create policy "models bucket write" on storage.objects for insert with check (bucket_id = 'models' and public.my_role() in ('md','admin','architect','engineer'));
drop policy if exists "models bucket delete" on storage.objects;
create policy "models bucket delete" on storage.objects for delete using (bucket_id = 'models' and public.my_role() in ('md','admin','architect','engineer'));

-- ═══ First Managing Director account ════════════════════════════════
-- After you sign up on the website with your own email, run:
--   update public.profiles set role = 'md' where id = (select id from auth.users where email = 'YOUR-EMAIL');

-- ═══ AI 3D models from customer photos (Edge Function image-to-3d) ══════
create table if not exists public.ai_models (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  design_ref text,
  model text not null,
  request_id text not null,
  status_url text not null,
  response_url text not null,
  status text not null default 'queued',   -- queued / working / done / failed
  glb_url text,
  error text,
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index if not exists ai_models_user_idx on public.ai_models(user_id, created_at);
alter table public.ai_models enable row level security;
drop policy if exists "ai models own read" on public.ai_models;
create policy "ai models own read" on public.ai_models for select using (auth.uid() = user_id or public.my_role() in ('md','admin','architect','engineer'));
-- rows are written only by the Edge Function (service role)
insert into storage.buckets (id, name, public) values ('ai-models', 'ai-models', true) on conflict (id) do nothing;
drop policy if exists "ai-models bucket read" on storage.objects;
create policy "ai-models bucket read" on storage.objects for select using (bucket_id = 'ai-models');

-- ═══ Company house catalogue (3D Virtual Experience) ═══════════════
create table if not exists public.house_catalog (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  name_lo text,
  tagline text,
  tagline_lo text,
  description text,
  description_lo text,
  floors int not null default 2,
  gfa numeric not null default 0,
  bedrooms int not null default 0,
  bathrooms int not null default 0,
  parking int not null default 0,
  rooms jsonb,
  features jsonb,
  finish text not null default 'premium',
  price_usd numeric not null default 0,
  price_breakdown jsonb,
  glb_url text not null,
  poster_url text,
  published boolean not null default true,
  sort int not null default 100,
  created_at timestamptz not null default now()
);
alter table public.house_catalog enable row level security;
drop policy if exists "catalog public read" on public.house_catalog;
create policy "catalog public read" on public.house_catalog for select using (published or public.my_role() in ('md','admin','architect','engineer'));
drop policy if exists "catalog staff write" on public.house_catalog;
create policy "catalog staff write" on public.house_catalog for all using (public.my_role() in ('md','admin','architect','engineer')) with check (public.my_role() in ('md','admin','architect','engineer'));
alter table public.quotation_requests alter column design drop not null;

-- house catalogue: floor heights for Floor plans / Walk inside (null = exterior-only model)
alter table public.house_catalog add column if not exists levels jsonb;
