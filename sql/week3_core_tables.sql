-- SITEPM Week 3 — core tables
-- Spec: SITEPM_BUILD_SPEC.md §8
-- Additive only: no DROP TABLE / TRUNCATE / DELETE.
-- RLS on, no policies. Persistence is verified in the Supabase Table Editor.
-- Week 4 adds authenticated, company-scoped policies.

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid,
  company_id uuid references public.companies (id),
  full_name text,
  email text,
  role text check (role in (
    'owner',
    'admin',
    'project_manager',
    'superintendent',
    'field'
  )),
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  name text not null,
  client_name text,
  address text,
  status text not null default 'active' check (status in ('active', 'on_hold', 'complete')),
  start_date date,
  target_completion_date date,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  project_id uuid not null references public.projects (id),
  title text not null,
  description text,
  assigned_to uuid references public.profiles (id),
  due_date date,
  priority text check (priority in ('high', 'medium', 'low')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'done')),
  ai_suggested boolean not null default false,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.field_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  project_id uuid not null references public.projects (id),
  created_by uuid references public.profiles (id),
  log_date date not null default current_date,
  notes text,
  issue_flag boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.field_logs enable row level security;
