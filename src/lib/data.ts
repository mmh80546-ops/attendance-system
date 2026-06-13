import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Employee, Site } from './types';

// Loosely typed so both the server and browser SSR clients (whose resolved
// schema generics differ structurally) are accepted without friction.
export type DB = SupabaseClient<Database, any, any>;

// --- reference data ---------------------------------------------------------
export async function getProjects(sb: DB) {
  const { data } = await sb.from('projects').select('*').order('name');
  return data ?? [];
}

export async function getSites(sb: DB): Promise<Site[]> {
  const { data } = await sb.from('sites').select('*').eq('is_active', true).order('name');
  return data ?? [];
}

export async function getEmployees(sb: DB): Promise<Employee[]> {
  const { data } = await sb.from('employees_safe').select('*').order('employee_code');
  return data ?? [];
}

export async function getSettings(sb: DB) {
  const { data } = await sb.from('system_settings').select('*').eq('id', true).single();
  return data;
}

// --- attendance -------------------------------------------------------------
function today() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
}

export async function getMyAttendanceToday(sb: DB, employeeId: string) {
  const { data } = await sb
    .from('attendance')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('work_date', today())
    .maybeSingle();
  return data;
}

export async function getMyAttendanceHistory(sb: DB, employeeId: string, limit = 30) {
  const { data } = await sb
    .from('attendance')
    .select('*')
    .eq('employee_id', employeeId)
    .order('work_date', { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getTeamAttendanceToday(sb: DB) {
  const { data } = await sb
    .from('attendance')
    .select('*, employees(full_name_ar, employee_code), sites(name)')
    .eq('work_date', today())
    .order('check_in_at', { ascending: false });
  return data ?? [];
}

export async function getPendingAttendance(sb: DB) {
  const { data } = await sb
    .from('attendance')
    .select('*, employees(full_name_ar, employee_code), sites(name)')
    .eq('supervisor_approval', 'pending')
    .order('work_date', { ascending: false });
  return data ?? [];
}

export async function getHrAttendanceQueue(sb: DB) {
  const { data } = await sb
    .from('attendance')
    .select('*, employees(full_name_ar, employee_code), sites(name)')
    .eq('supervisor_approval', 'approved')
    .eq('hr_review', 'pending')
    .order('work_date', { ascending: false });
  return data ?? [];
}

export async function getAttendanceRange(sb: DB, from: string, to: string) {
  const { data } = await sb
    .from('attendance')
    .select('*, employees(full_name_ar, full_name_en, employee_code), sites(name, project_id)')
    .gte('work_date', from)
    .lte('work_date', to)
    .order('work_date', { ascending: false });
  return data ?? [];
}

// --- leave ------------------------------------------------------------------
export async function getMyLeave(sb: DB, employeeId: string) {
  const { data } = await sb
    .from('leave_requests')
    .select('*')
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function getPendingLeaveSupervisor(sb: DB) {
  const { data } = await sb
    .from('leave_requests')
    .select('*, employees(full_name_ar, employee_code)')
    .eq('supervisor_approval', 'pending')
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function getHrLeaveQueue(sb: DB) {
  const { data } = await sb
    .from('leave_requests')
    .select('*, employees(full_name_ar, employee_code)')
    .eq('supervisor_approval', 'approved')
    .eq('hr_approval', 'pending')
    .order('created_at', { ascending: false });
  return data ?? [];
}

// --- dashboard counts -------------------------------------------------------
export async function getDashboardStats(sb: DB) {
  const [emp, proj, present, pending] = await Promise.all([
    sb.from('employees').select('id', { count: 'exact', head: true }),
    sb.from('projects').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    sb
      .from('attendance')
      .select('id', { count: 'exact', head: true })
      .eq('work_date', today())
      .in('status', ['present', 'late']),
    sb
      .from('attendance')
      .select('id', { count: 'exact', head: true })
      .eq('supervisor_approval', 'pending'),
  ]);
  const employees = emp.count ?? 0;
  const presentToday = present.count ?? 0;
  return {
    employees,
    activeProjects: proj.count ?? 0,
    presentToday,
    pendingApprovals: pending.count ?? 0,
    attendanceRate: employees > 0 ? Math.round((presentToday / employees) * 100) : 0,
  };
}

export async function getAuditLog(sb: DB, limit = 100) {
  const { data } = await sb
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}
