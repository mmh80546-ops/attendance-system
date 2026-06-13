-- ============================================================================
-- ETC Field & Workforce System — Phase 1 schema
-- Excellence Tracks Company (مسارات الامتياز)
-- Field-first attendance layer. Payroll is OUT OF SCOPE.
-- Every primary table carries external_ref + sync_status for future Odoo sync.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
do $$ begin
  create type app_role as enum (
    'admin', 'hr_manager', 'operations_manager', 'project_manager',
    'site_engineer', 'supervisor', 'employee'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type sync_status as enum ('local', 'synced', 'pending');
exception when duplicate_object then null; end $$;

do $$ begin
  create type department_type as enum (
    'projects', 'maintenance', 'procurement', 'accounting', 'hr', 'management'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type employment_status as enum ('active', 'on_leave', 'suspended', 'terminated');
exception when duplicate_object then null; end $$;

do $$ begin
  create type project_status as enum ('active', 'inactive');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attendance_status as enum ('present', 'late', 'absent', 'incomplete');
exception when duplicate_object then null; end $$;

do $$ begin
  create type approval_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type hr_review_status as enum ('pending', 'reviewed', 'flagged');
exception when duplicate_object then null; end $$;

do $$ begin
  create type leave_type as enum ('annual', 'sick', 'emergency', 'unpaid', 'other');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- updated_at trigger helper
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

-- employees ------------------------------------------------------------------
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_code text unique not null,
  full_name_ar text not null,
  full_name_en text,
  job_title text,
  department department_type,
  nationality text,                       -- RESTRICTED: HR/admin only (RLS-enforced view)
  mobile text,
  joining_date date,
  employment_status employment_status not null default 'active',
  assigned_project_id uuid,
  assigned_team_id uuid,
  annual_leave_balance_days numeric not null default 21,
  external_ref text,
  sync_status sync_status not null default 'local',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- projects -------------------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client text,
  location_text text,
  latitude numeric,
  longitude numeric,
  geofence_radius_m integer not null default 200,
  project_manager_id uuid references public.employees(id) on delete set null,
  status project_status not null default 'active',
  external_ref text,
  sync_status sync_status not null default 'local',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- sites ----------------------------------------------------------------------
create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null,
  latitude numeric,
  longitude numeric,
  geofence_radius_m integer not null default 200,
  is_active boolean not null default true,
  external_ref text,
  sync_status sync_status not null default 'local',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- teams ----------------------------------------------------------------------
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  project_id uuid references public.projects(id) on delete set null,
  supervisor_id uuid references public.employees(id) on delete set null,
  site_engineer_id uuid references public.employees(id) on delete set null,
  external_ref text,
  sync_status sync_status not null default 'local',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- deferred FKs on employees (after teams/projects exist)
do $$ begin
  alter table public.employees
    add constraint employees_assigned_project_fk
    foreign key (assigned_project_id) references public.projects(id) on delete set null;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.employees
    add constraint employees_assigned_team_fk
    foreign key (assigned_team_id) references public.teams(id) on delete set null;
exception when duplicate_object then null; end $$;

-- profiles (extends auth.users) ----------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role app_role not null default 'employee',
  employee_id uuid references public.employees(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- attendance (the heart of the system) ---------------------------------------
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  site_id uuid references public.sites(id) on delete set null,
  work_date date not null default (now() at time zone 'Asia/Riyadh')::date,
  check_in_at timestamptz,                 -- SERVER time
  check_in_lat numeric,
  check_in_lng numeric,
  check_in_photo_url text,
  check_in_distance_m numeric,
  check_in_geofence_pass boolean,
  check_out_at timestamptz,
  check_out_lat numeric,
  check_out_lng numeric,
  check_out_photo_url text,
  status attendance_status not null default 'incomplete',
  tamper_flags jsonb not null default '{}'::jsonb,
  supervisor_approval approval_status not null default 'pending',
  supervisor_approved_by uuid references public.profiles(id),
  supervisor_approved_at timestamptz,
  hr_review hr_review_status not null default 'pending',
  hr_reviewed_by uuid references public.profiles(id),
  hr_reviewed_at timestamptz,
  notes text,
  external_ref text,
  sync_status sync_status not null default 'local',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, work_date)
);

-- leave_requests -------------------------------------------------------------
create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  leave_type leave_type not null,
  start_date date not null,
  end_date date not null,
  num_days numeric not null default 0,
  reason text,
  supervisor_approval approval_status not null default 'pending',
  supervisor_approved_by uuid references public.profiles(id),
  supervisor_approved_at timestamptz,
  supervisor_reject_reason text,
  hr_approval approval_status not null default 'pending',
  hr_approved_by uuid references public.profiles(id),
  hr_approved_at timestamptz,
  hr_reject_reason text,
  balance_deducted boolean not null default false,
  external_ref text,
  sync_status sync_status not null default 'local',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- audit_log ------------------------------------------------------------------
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

-- system_settings (single row config: work hours, late threshold, weekend) ---
create table if not exists public.system_settings (
  id boolean primary key default true check (id),
  workday_start time not null default '07:00',
  late_threshold_minutes integer not null default 15,
  standard_hours numeric not null default 8,
  weekend_days integer[] not null default '{5,6}',   -- 0=Sun .. 6=Sat (Fri+Sat)
  default_geofence_radius_m integer not null default 200,
  updated_at timestamptz not null default now()
);
insert into public.system_settings (id) values (true) on conflict do nothing;

-- ----------------------------------------------------------------------------
-- Phase 2 tables (schema ready now; no Phase 1 UI)
-- ----------------------------------------------------------------------------
create table if not exists public.work_orders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  site_id uuid references public.sites(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'open',
  assigned_team_id uuid references public.teams(id) on delete set null,
  external_ref text,
  sync_status sync_status not null default 'local',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.field_photos (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid references public.work_orders(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  photo_url text not null,
  caption text,
  taken_at timestamptz not null default now(),
  external_ref text,
  sync_status sync_status not null default 'local',
  created_at timestamptz not null default now()
);

create table if not exists public.productivity_logs (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid references public.work_orders(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  metric text,
  value numeric,
  logged_at timestamptz not null default now(),
  external_ref text,
  sync_status sync_status not null default 'local',
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- updated_at triggers
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'employees','projects','sites','teams','profiles','attendance',
    'leave_requests','work_orders'
  ] loop
    execute format(
      'drop trigger if exists set_updated_at on public.%I; '
      || 'create trigger set_updated_at before update on public.%I '
      || 'for each row execute function public.set_updated_at();', t, t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------
create index if not exists idx_attendance_emp_date on public.attendance(employee_id, work_date);
create index if not exists idx_attendance_site on public.attendance(site_id);
create index if not exists idx_leave_emp on public.leave_requests(employee_id);
create index if not exists idx_employees_team on public.employees(assigned_team_id);
create index if not exists idx_employees_project on public.employees(assigned_project_id);
