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
