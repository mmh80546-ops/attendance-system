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
