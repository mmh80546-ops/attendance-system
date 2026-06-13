-- ============================================================================
-- ETC Field & Workforce System — ONE-SHOT SETUP
-- Paste this whole file into Supabase → SQL Editor → Run.
-- It runs: schema + RLS + functions + storage + business seed (in order).
-- After running, create your admin login (see DEPLOY.md step 4).
-- ============================================================================

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

-- ============================================================================
-- Row Level Security — every table is locked down.
-- Helper functions are SECURITY DEFINER so policies can read profiles/teams
-- without recursive RLS evaluation.
-- ============================================================================

create schema if not exists app;

-- Current user's role -------------------------------------------------------
create or replace function app.current_role()
returns app_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Current user's linked employee id -----------------------------------------
create or replace function app.current_employee_id()
returns uuid language sql stable security definer set search_path = public as $$
  select employee_id from public.profiles where id = auth.uid();
$$;

create or replace function app.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select app.current_role() = 'admin';
$$;

-- HR / Ops / Admin see everything (org-wide read) ---------------------------
create or replace function app.is_org_wide()
returns boolean language sql stable security definer set search_path = public as $$
  select app.current_role() in ('admin','hr_manager','operations_manager');
$$;

create or replace function app.is_hr_or_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select app.current_role() in ('admin','hr_manager');
$$;

-- The set of employee ids the current user may view / act on ----------------
create or replace function app.visible_employee_ids()
returns setof uuid language plpgsql stable security definer set search_path = public as $$
declare
  r app_role := app.current_role();
  me uuid := app.current_employee_id();
begin
  if r in ('admin','hr_manager','operations_manager') then
    return query select id from public.employees;
  elsif r = 'project_manager' then
    return query
      select e.id from public.employees e
      where e.assigned_project_id in (
        select p.id from public.projects p where p.project_manager_id = me
      );
  elsif r = 'supervisor' then
    return query
      select e.id from public.employees e
      where e.assigned_team_id in (
        select t.id from public.teams t where t.supervisor_id = me
      );
  elsif r = 'site_engineer' then
    return query
      select e.id from public.employees e
      where e.assigned_team_id in (
        select t.id from public.teams t where t.site_engineer_id = me
      );
  else
    return query select me where me is not null;
  end if;
end; $$;

-- Can the current user act as 1st-level approver for an employee? ------------
create or replace function app.can_first_approve(target_employee uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select app.current_role() in ('admin','project_manager','site_engineer','supervisor')
     and target_employee in (select app.visible_employee_ids());
$$;

-- ----------------------------------------------------------------------------
-- Enable RLS
-- ----------------------------------------------------------------------------
alter table public.employees        enable row level security;
alter table public.profiles         enable row level security;
alter table public.projects         enable row level security;
alter table public.sites            enable row level security;
alter table public.teams            enable row level security;
alter table public.attendance       enable row level security;
alter table public.leave_requests   enable row level security;
alter table public.audit_log        enable row level security;
alter table public.system_settings  enable row level security;
alter table public.work_orders      enable row level security;
alter table public.field_photos     enable row level security;
alter table public.productivity_logs enable row level security;

-- profiles -------------------------------------------------------------------
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles for select
  using (id = auth.uid() or app.is_org_wide());

drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles for all
  using (app.is_admin()) with check (app.is_admin());

-- employees ------------------------------------------------------------------
drop policy if exists employees_scoped_read on public.employees;
create policy employees_scoped_read on public.employees for select
  using (id in (select app.visible_employee_ids()));

drop policy if exists employees_hr_write on public.employees;
create policy employees_hr_write on public.employees for all
  using (app.is_hr_or_admin()) with check (app.is_hr_or_admin());

-- projects -------------------------------------------------------------------
drop policy if exists projects_read on public.projects;
create policy projects_read on public.projects for select
  using (
    app.is_org_wide()
    or project_manager_id = app.current_employee_id()
    or app.current_role() in ('site_engineer','supervisor','employee')
  );

drop policy if exists projects_admin_write on public.projects;
create policy projects_admin_write on public.projects for all
  using (app.is_admin()) with check (app.is_admin());

-- sites ----------------------------------------------------------------------
drop policy if exists sites_read on public.sites;
create policy sites_read on public.sites for select using (true);

drop policy if exists sites_admin_write on public.sites;
create policy sites_admin_write on public.sites for all
  using (app.is_admin()) with check (app.is_admin());

-- teams ----------------------------------------------------------------------
drop policy if exists teams_read on public.teams;
create policy teams_read on public.teams for select using (true);

drop policy if exists teams_admin_write on public.teams;
create policy teams_admin_write on public.teams for all
  using (app.is_admin()) with check (app.is_admin());

-- attendance -----------------------------------------------------------------
drop policy if exists attendance_scoped_read on public.attendance;
create policy attendance_scoped_read on public.attendance for select
  using (employee_id in (select app.visible_employee_ids()));

-- Employee may create / update only their OWN row (server fns set trusted cols)
drop policy if exists attendance_self_insert on public.attendance;
create policy attendance_self_insert on public.attendance for insert
  with check (employee_id = app.current_employee_id());

drop policy if exists attendance_self_update on public.attendance;
create policy attendance_self_update on public.attendance for update
  using (employee_id = app.current_employee_id())
  with check (employee_id = app.current_employee_id());

-- Approvers (supervisor/PM/SE) and HR/admin can update rows in their scope
drop policy if exists attendance_approver_update on public.attendance;
create policy attendance_approver_update on public.attendance for update
  using (app.is_org_wide() or employee_id in (select app.visible_employee_ids()))
  with check (app.is_org_wide() or employee_id in (select app.visible_employee_ids()));

-- leave_requests -------------------------------------------------------------
drop policy if exists leave_scoped_read on public.leave_requests;
create policy leave_scoped_read on public.leave_requests for select
  using (employee_id in (select app.visible_employee_ids()));

drop policy if exists leave_self_insert on public.leave_requests;
create policy leave_self_insert on public.leave_requests for insert
  with check (employee_id = app.current_employee_id());

drop policy if exists leave_approver_update on public.leave_requests;
create policy leave_approver_update on public.leave_requests for update
  using (app.is_org_wide() or employee_id in (select app.visible_employee_ids()))
  with check (app.is_org_wide() or employee_id in (select app.visible_employee_ids()));

-- audit_log ------------------------------------------------------------------
drop policy if exists audit_read on public.audit_log;
create policy audit_read on public.audit_log for select
  using (app.is_org_wide());

drop policy if exists audit_insert on public.audit_log;
create policy audit_insert on public.audit_log for insert
  with check (actor_id = auth.uid());

-- system_settings ------------------------------------------------------------
drop policy if exists settings_read on public.system_settings;
create policy settings_read on public.system_settings for select using (true);

drop policy if exists settings_admin_write on public.system_settings;
create policy settings_admin_write on public.system_settings for all
  using (app.is_admin()) with check (app.is_admin());

-- phase 2 tables: org-wide read, admin write (placeholder until Phase 2 UI) --
drop policy if exists wo_read on public.work_orders;
create policy wo_read on public.work_orders for select
  using (app.is_org_wide() or assigned_team_id in (select id from public.teams));
drop policy if exists wo_admin_write on public.work_orders;
create policy wo_admin_write on public.work_orders for all
  using (app.is_admin()) with check (app.is_admin());

drop policy if exists fp_read on public.field_photos;
create policy fp_read on public.field_photos for select using (app.is_org_wide());
drop policy if exists fp_admin_write on public.field_photos;
create policy fp_admin_write on public.field_photos for all
  using (app.is_admin()) with check (app.is_admin());

drop policy if exists pl_read on public.productivity_logs;
create policy pl_read on public.productivity_logs for select using (app.is_org_wide());
drop policy if exists pl_admin_write on public.productivity_logs;
create policy pl_admin_write on public.productivity_logs for all
  using (app.is_admin()) with check (app.is_admin());

-- ============================================================================
-- Server-trusted operations. All SECURITY DEFINER, so they bypass RLS — each
-- therefore re-checks the caller's permission explicitly.
-- Timestamps come from now() (server), never the client. Geofence + tamper
-- flags are computed here, never trusted from the device.
-- ============================================================================

-- Haversine distance in metres ----------------------------------------------
create or replace function public.haversine_m(
  lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric
) returns numeric language sql immutable as $$
  select 6371000 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- Audit helper ---------------------------------------------------------------
create or replace function app.audit(
  p_action text, p_entity text, p_entity_id uuid, p_before jsonb, p_after jsonb
) returns void language sql security definer set search_path = public as $$
  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values (auth.uid(), p_action, p_entity, p_entity_id, p_before, p_after);
$$;

-- ----------------------------------------------------------------------------
-- CHECK-IN: server time + geofence + tamper flags
-- ----------------------------------------------------------------------------
create or replace function public.attendance_check_in(
  p_site_id uuid,
  p_lat numeric,
  p_lng numeric,
  p_photo_url text,
  p_accuracy numeric default null,
  p_mock_location boolean default false
) returns public.attendance
language plpgsql security definer set search_path = public as $$
declare
  v_emp uuid := app.current_employee_id();
  v_site public.sites;
  v_settings public.system_settings;
  v_dist numeric;
  v_pass boolean;
  v_flags jsonb := '{}'::jsonb;
  v_status attendance_status;
  v_now timestamptz := now();
  v_local_time time;
  v_row public.attendance;
begin
  if v_emp is null then
    raise exception 'no linked employee for current user';
  end if;
  if p_photo_url is null or length(p_photo_url) = 0 then
    raise exception 'selfie photo is required at check-in';
  end if;

  select * into v_site from public.sites where id = p_site_id;
  select * into v_settings from public.system_settings where id = true;

  -- geofence (server-computed)
  if v_site.latitude is not null and p_lat is not null then
    v_dist := public.haversine_m(p_lat, p_lng, v_site.latitude, v_site.longitude);
    v_pass := v_dist <= coalesce(v_site.geofence_radius_m, 200);
  else
    v_dist := null;
    v_pass := null;
  end if;

  -- tamper flags
  if v_pass is false then v_flags := v_flags || jsonb_build_object('outside_geofence', true); end if;
  if coalesce(p_mock_location, false) then v_flags := v_flags || jsonb_build_object('mock_location', true); end if;
  if p_lat is null then v_flags := v_flags || jsonb_build_object('gps_off', true); end if;
  if p_accuracy is not null and p_accuracy > 100 then v_flags := v_flags || jsonb_build_object('low_accuracy', true); end if;

  -- present vs late by server local time
  v_local_time := (v_now at time zone 'Asia/Riyadh')::time;
  if v_local_time > (v_settings.workday_start + make_interval(mins => v_settings.late_threshold_minutes)) then
    v_status := 'late';
  else
    v_status := 'present';
  end if;

  insert into public.attendance as a (
    employee_id, site_id, work_date, check_in_at, check_in_lat, check_in_lng,
    check_in_photo_url, check_in_distance_m, check_in_geofence_pass, status, tamper_flags
  ) values (
    v_emp, p_site_id, (v_now at time zone 'Asia/Riyadh')::date, v_now, p_lat, p_lng,
    p_photo_url, v_dist, v_pass, v_status, v_flags
  )
  on conflict (employee_id, work_date) do update set
    site_id = excluded.site_id,
    check_in_at = excluded.check_in_at,
    check_in_lat = excluded.check_in_lat,
    check_in_lng = excluded.check_in_lng,
    check_in_photo_url = excluded.check_in_photo_url,
    check_in_distance_m = excluded.check_in_distance_m,
    check_in_geofence_pass = excluded.check_in_geofence_pass,
    status = excluded.status,
    tamper_flags = excluded.tamper_flags
  returning * into v_row;

  perform app.audit('check_in', 'attendance', v_row.id, null, to_jsonb(v_row));
  return v_row;
end; $$;

-- ----------------------------------------------------------------------------
-- CHECK-OUT
-- ----------------------------------------------------------------------------
create or replace function public.attendance_check_out(
  p_lat numeric, p_lng numeric, p_photo_url text default null
) returns public.attendance
language plpgsql security definer set search_path = public as $$
declare
  v_emp uuid := app.current_employee_id();
  v_now timestamptz := now();
  v_row public.attendance;
begin
  if v_emp is null then raise exception 'no linked employee'; end if;

  update public.attendance set
    check_out_at = v_now,
    check_out_lat = p_lat,
    check_out_lng = p_lng,
    check_out_photo_url = coalesce(p_photo_url, check_out_photo_url),
    status = case when status = 'incomplete' then 'present' else status end
  where employee_id = v_emp
    and work_date = (v_now at time zone 'Asia/Riyadh')::date
  returning * into v_row;

  if v_row.id is null then raise exception 'no open check-in for today'; end if;
  perform app.audit('check_out', 'attendance', v_row.id, null, to_jsonb(v_row));
  return v_row;
end; $$;

-- ----------------------------------------------------------------------------
-- Supervisor / first-level attendance decision
-- ----------------------------------------------------------------------------
create or replace function public.decide_attendance(
  p_id uuid, p_decision approval_status, p_reason text default null
) returns public.attendance
language plpgsql security definer set search_path = public as $$
declare v_row public.attendance; v_before jsonb;
begin
  select * into v_row from public.attendance where id = p_id;
  if v_row.id is null then raise exception 'attendance not found'; end if;
  if not app.can_first_approve(v_row.employee_id) and not app.is_org_wide() then
    raise exception 'not authorized to approve this record';
  end if;
  v_before := to_jsonb(v_row);
  update public.attendance set
    supervisor_approval = p_decision,
    supervisor_approved_by = auth.uid(),
    supervisor_approved_at = now(),
    notes = coalesce(p_reason, notes)
  where id = p_id returning * into v_row;
  perform app.audit('decide_attendance', 'attendance', p_id, v_before, to_jsonb(v_row));
  return v_row;
end; $$;

-- HR final review ------------------------------------------------------------
create or replace function public.hr_review_attendance(
  p_id uuid, p_status hr_review_status
) returns public.attendance
language plpgsql security definer set search_path = public as $$
declare v_row public.attendance; v_before jsonb;
begin
  if not app.is_hr_or_admin() then raise exception 'HR/admin only'; end if;
  select * into v_row from public.attendance where id = p_id;
  v_before := to_jsonb(v_row);
  update public.attendance set
    hr_review = p_status, hr_reviewed_by = auth.uid(), hr_reviewed_at = now()
  where id = p_id returning * into v_row;
  perform app.audit('hr_review_attendance', 'attendance', p_id, v_before, to_jsonb(v_row));
  return v_row;
end; $$;

-- ----------------------------------------------------------------------------
-- LEAVE: submit (server computes num_days excluding weekend days)
-- ----------------------------------------------------------------------------
create or replace function public.submit_leave(
  p_leave_type leave_type, p_start date, p_end date, p_reason text
) returns public.leave_requests
language plpgsql security definer set search_path = public as $$
declare
  v_emp uuid := app.current_employee_id();
  v_weekend integer[];
  v_days numeric;
  v_row public.leave_requests;
begin
  if v_emp is null then raise exception 'no linked employee'; end if;
  if p_end < p_start then raise exception 'end_date before start_date'; end if;

  select weekend_days into v_weekend from public.system_settings where id = true;
  select count(*) into v_days
  from generate_series(p_start, p_end, interval '1 day') d
  where extract(dow from d)::int <> all (v_weekend);

  insert into public.leave_requests (employee_id, leave_type, start_date, end_date, num_days, reason)
  values (v_emp, p_leave_type, p_start, p_end, v_days, p_reason)
  returning * into v_row;
  perform app.audit('submit_leave', 'leave_requests', v_row.id, null, to_jsonb(v_row));
  return v_row;
end; $$;

-- Supervisor decision on leave ----------------------------------------------
create or replace function public.supervisor_decide_leave(
  p_id uuid, p_decision approval_status, p_reason text default null
) returns public.leave_requests
language plpgsql security definer set search_path = public as $$
declare v_row public.leave_requests; v_before jsonb;
begin
  select * into v_row from public.leave_requests where id = p_id;
  if v_row.id is null then raise exception 'leave not found'; end if;
  if not app.can_first_approve(v_row.employee_id) and not app.is_org_wide() then
    raise exception 'not authorized';
  end if;
  v_before := to_jsonb(v_row);
  update public.leave_requests set
    supervisor_approval = p_decision,
    supervisor_approved_by = auth.uid(),
    supervisor_approved_at = now(),
    supervisor_reject_reason = case when p_decision = 'rejected' then p_reason else null end
  where id = p_id returning * into v_row;
  perform app.audit('supervisor_decide_leave', 'leave_requests', p_id, v_before, to_jsonb(v_row));
  return v_row;
end; $$;

-- HR decision on leave — deduct balance exactly once on approval -------------
create or replace function public.hr_decide_leave(
  p_id uuid, p_decision approval_status, p_reason text default null
) returns public.leave_requests
language plpgsql security definer set search_path = public as $$
declare v_row public.leave_requests; v_before jsonb;
begin
  if not app.is_hr_or_admin() then raise exception 'HR/admin only'; end if;
  select * into v_row from public.leave_requests where id = p_id for update;
  if v_row.id is null then raise exception 'leave not found'; end if;
  v_before := to_jsonb(v_row);

  if p_decision = 'approved' then
    -- deduct only once, and only for balance-bearing leave types
    if not v_row.balance_deducted and v_row.leave_type in ('annual') then
      update public.employees
        set annual_leave_balance_days = annual_leave_balance_days - v_row.num_days
        where id = v_row.employee_id;
      update public.leave_requests set balance_deducted = true where id = p_id;
    end if;
    update public.leave_requests set
      hr_approval = 'approved', hr_approved_by = auth.uid(), hr_approved_at = now(), hr_reject_reason = null
      where id = p_id returning * into v_row;
  else
    update public.leave_requests set
      hr_approval = 'rejected', hr_approved_by = auth.uid(), hr_approved_at = now(), hr_reject_reason = p_reason
      where id = p_id returning * into v_row;
  end if;

  perform app.audit('hr_decide_leave', 'leave_requests', p_id, v_before, to_jsonb(v_row));
  return v_row;
end; $$;

-- ----------------------------------------------------------------------------
-- Employee directory view that hides restricted fields from peers
-- (nationality + mobile visible only to HR/admin)
-- ----------------------------------------------------------------------------
create or replace view public.employees_safe with (security_invoker = true) as
  select
    id, employee_code, full_name_ar, full_name_en, job_title, department,
    case when app.is_hr_or_admin() then nationality else null end as nationality,
    case when app.is_hr_or_admin() then mobile else null end as mobile,
    joining_date, employment_status, assigned_project_id, assigned_team_id,
    annual_leave_balance_days, external_ref, sync_status, created_at, updated_at
  from public.employees;

-- ============================================================================
-- Storage bucket for attendance selfies. Public-read (URLs embedded in records),
-- authenticated-write into a folder named after the employee id.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('attendance-photos', 'attendance-photos', true)
on conflict (id) do nothing;

drop policy if exists attendance_photos_read on storage.objects;
create policy attendance_photos_read on storage.objects for select
  using (bucket_id = 'attendance-photos');

drop policy if exists attendance_photos_write on storage.objects;
create policy attendance_photos_write on storage.objects for insert
  to authenticated
  with check (bucket_id = 'attendance-photos');

drop policy if exists attendance_photos_update on storage.objects;
create policy attendance_photos_update on storage.objects for update
  to authenticated
  using (bucket_id = 'attendance-photos');

-- ============================================================================
-- ETC sample data (business entities). Auth users + profiles are created by
-- scripts/seed.ts (needs the service-role key). Fixed UUIDs let the two link.
-- Run order: migrations -> seed.sql -> npm run seed
-- ============================================================================

-- Employees (login users have fixed UUIDs) -----------------------------------
insert into public.employees (id, employee_code, full_name_ar, full_name_en, job_title, department, nationality, mobile, joining_date, employment_status, annual_leave_balance_days)
values
  ('11111111-1111-1111-1111-111111111111', 'ETC-0001', 'مدير النظام', 'System Admin', 'مدير النظام', 'management', 'سعودي', '+966500000001', '2020-01-01', 'active', 30),
  ('22222222-2222-2222-2222-222222222222', 'ETC-0002', 'منى الحربي', 'Mona Al-Harbi', 'مدير الموارد البشرية', 'hr', 'سعودي', '+966500000002', '2021-03-15', 'active', 30),
  ('33333333-3333-3333-3333-333333333333', 'ETC-0003', 'سعد القحطاني', 'Saad Al-Qahtani', 'مدير العمليات', 'management', 'سعودي', '+966500000003', '2020-06-01', 'active', 30),
  ('44444444-4444-4444-4444-444444444444', 'ETC-0004', 'خالد العتيبي', 'Khalid Al-Otaibi', 'مدير مشروع', 'projects', 'سعودي', '+966500000004', '2021-09-10', 'active', 25),
  ('55555555-5555-5555-5555-555555555555', 'ETC-0005', 'محمد فاروق', 'Mohammed Farouk', 'مهندس موقع', 'projects', 'مصري', '+966500000005', '2022-01-20', 'active', 21),
  ('66666666-6666-6666-6666-666666666666', 'ETC-0006', 'راجو كومار', 'Raju Kumar', 'مشرف', 'maintenance', 'هندي', '+966500000006', '2022-05-05', 'active', 21),
  ('77777777-7777-7777-7777-777777777777', 'ETC-0007', 'أحمد سليم', 'Ahmed Salim', 'فني كهرباء', 'maintenance', 'باكستاني', '+966500000007', '2023-02-01', 'active', 21),
  ('88888888-8888-8888-8888-888888888888', 'ETC-0008', 'بلال حسن', 'Bilal Hassan', 'فني', 'maintenance', 'بنغلاديشي', '+966500000008', '2023-04-12', 'active', 18),
  ('99999999-9999-9999-9999-999999999999', 'ETC-0009', 'جوزيف رييس', 'Joseph Reyes', 'فني', 'projects', 'فلبيني', '+966500000009', '2023-07-01', 'active', 18)
on conflict (id) do nothing;

-- Projects (geofence centres = real-ish coordinates) -------------------------
insert into public.projects (id, name, client, location_text, latitude, longitude, geofence_radius_m, project_manager_id, status)
values
  ('a1111111-0000-0000-0000-000000000001', 'صيانة محطات الجبيل', 'الهيئة الملكية بالجبيل', 'الجبيل الصناعية', 27.0046, 49.6583, 250, '44444444-4444-4444-4444-444444444444', 'active'),
  ('a1111111-0000-0000-0000-000000000002', 'البنية التحتية - الدمام', 'أمانة المنطقة الشرقية', 'الدمام', 26.4207, 50.0888, 200, '44444444-4444-4444-4444-444444444444', 'active'),
  ('a1111111-0000-0000-0000-000000000003', 'شبكات حفر الباطن', 'شركة الكهرباء السعودية', 'حفر الباطن', 28.4337, 45.9601, 300, '44444444-4444-4444-4444-444444444444', 'active')
on conflict (id) do nothing;

-- Sites ----------------------------------------------------------------------
insert into public.sites (id, project_id, name, latitude, longitude, geofence_radius_m, is_active)
values
  ('b1111111-0000-0000-0000-000000000001', 'a1111111-0000-0000-0000-000000000001', 'محطة الجبيل 1', 27.0046, 49.6583, 250, true),
  ('b1111111-0000-0000-0000-000000000002', 'a1111111-0000-0000-0000-000000000001', 'محطة الجبيل 2', 27.0120, 49.6700, 250, true),
  ('b1111111-0000-0000-0000-000000000003', 'a1111111-0000-0000-0000-000000000002', 'موقع الدمام المركزي', 26.4207, 50.0888, 200, true),
  ('b1111111-0000-0000-0000-000000000004', 'a1111111-0000-0000-0000-000000000003', 'موقع حفر الباطن الشمالي', 28.4337, 45.9601, 300, true)
on conflict (id) do nothing;

-- Teams ----------------------------------------------------------------------
insert into public.teams (id, name, project_id, supervisor_id, site_engineer_id)
values
  ('c1111111-0000-0000-0000-000000000001', 'فريق الجبيل أ', 'a1111111-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666', '55555555-5555-5555-5555-555555555555'),
  ('c1111111-0000-0000-0000-000000000002', 'فريق الدمام', 'a1111111-0000-0000-0000-000000000002', '66666666-6666-6666-6666-666666666666', '55555555-5555-5555-5555-555555555555')
on conflict (id) do nothing;

-- Assign workers to project/team ---------------------------------------------
update public.employees set assigned_project_id = 'a1111111-0000-0000-0000-000000000001', assigned_team_id = 'c1111111-0000-0000-0000-000000000001'
  where id in ('55555555-5555-5555-5555-555555555555','66666666-6666-6666-6666-666666666666','77777777-7777-7777-7777-777777777777','88888888-8888-8888-8888-888888888888');
update public.employees set assigned_project_id = 'a1111111-0000-0000-0000-000000000002', assigned_team_id = 'c1111111-0000-0000-0000-000000000002'
  where id = '99999999-9999-9999-9999-999999999999';
