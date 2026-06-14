'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { createAdminClient, isAdminConfigured } from '@/lib/supabase/admin';
import type { AppRole, Department } from '@/lib/types';

const ROLES: AppRole[] = [
  'admin', 'hr_manager', 'operations_manager', 'project_manager',
  'site_engineer', 'supervisor', 'employee',
];
const DEPARTMENTS: Department[] = [
  'projects', 'maintenance', 'procurement', 'accounting', 'hr', 'management',
];

export interface ActionResult {
  ok?: boolean;
  error?: string;
  message?: string;
}

/** Create a login account, optionally creating + linking a new employee. Admin only. */
export async function createUserAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const session = await getSession();
  if (!session || session.profile.role !== 'admin') {
    return { error: 'غير مصرّح — مدير النظام فقط' };
  }
  if (!isAdminConfigured()) {
    return { error: 'مفتاح service_role غير مضبوط في Vercel (SUPABASE_SERVICE_ROLE_KEY)' };
  }

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const role = String(formData.get('role') ?? 'employee') as AppRole;
  const existingEmployee = String(formData.get('employee_id') ?? '').trim();

  if (!email || !password) return { error: 'البريد وكلمة المرور مطلوبة' };
  if (password.length < 6) return { error: 'كلمة المرور 6 أحرف على الأقل' };
  if (!ROLES.includes(role)) return { error: 'دور غير صالح' };

  const admin = createAdminClient();

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created?.user) {
    return { error: createErr?.message ?? 'تعذّر إنشاء الحساب' };
  }

  let employeeId: string | null = existingEmployee || null;

  if (!employeeId) {
    const fullNameAr = String(formData.get('full_name_ar') ?? '').trim();
    const employeeCode = String(formData.get('employee_code') ?? '').trim();
    if (fullNameAr && employeeCode) {
      const deptRaw = String(formData.get('department') ?? '');
      const department = DEPARTMENTS.includes(deptRaw as Department) ? deptRaw : null;
      const { data: emp, error: empErr } = await admin
        .from('employees')
        .insert({
          employee_code: employeeCode,
          full_name_ar: fullNameAr,
          full_name_en: String(formData.get('full_name_en') ?? '').trim() || null,
          job_title: String(formData.get('job_title') ?? '').trim() || null,
          department,
          mobile: String(formData.get('mobile') ?? '').trim() || null,
          employment_status: 'active',
        } as never)
        .select('id')
        .single();
      if (empErr) {
        await admin.auth.admin.deleteUser(created.user.id); // rollback the orphan account
        return { error: `تعذّر إنشاء الموظف: ${empErr.message}` };
      }
      employeeId = (emp as { id: string } | null)?.id ?? null;
    }
  }

  const { error: profErr } = await admin
    .from('profiles')
    .upsert({ id: created.user.id, role, employee_id: employeeId, is_active: true } as never);
  if (profErr) return { error: `تعذّر ربط الصلاحية: ${profErr.message}` };

  revalidatePath('/admin/users');
  return { ok: true, message: `تم إنشاء ${email} بدور ${role}` };
}

/** Bulk-insert employees from pasted CSV/Excel rows (no login accounts). Admin/HR. */
export async function importEmployeesAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const session = await getSession();
  if (!session || !['admin', 'hr_manager'].includes(session.profile.role)) {
    return { error: 'غير مصرّح — الموارد البشرية أو المدير فقط' };
  }
  if (!isAdminConfigured()) {
    return { error: 'مفتاح service_role غير مضبوط في Vercel (SUPABASE_SERVICE_ROLE_KEY)' };
  }

  const raw = String(formData.get('csv') ?? '').trim();
  if (!raw) return { error: 'الصق محتوى الملف أولًا' };

  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { error: 'الملف يحتاج صف عناوين + صف بيانات واحد على الأقل' };

  const split = (line: string) => line.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ''));
  const headers = split(lines[0]).map((h) => h.toLowerCase());
  const idx = (name: string) => headers.indexOf(name);

  const cEmpCode = idx('employee_code');
  const cNameAr = idx('full_name_ar');
  if (cEmpCode === -1 || cNameAr === -1) {
    return { error: 'الأعمدة المطلوبة على الأقل: employee_code و full_name_ar' };
  }

  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = split(lines[i]);
    const code = cells[cEmpCode];
    const nameAr = cells[cNameAr];
    if (!code || !nameAr) continue;
    const deptRaw = idx('department') > -1 ? cells[idx('department')] : '';
    const department = DEPARTMENTS.includes(deptRaw as Department) ? deptRaw : null;
    rows.push({
      employee_code: code,
      full_name_ar: nameAr,
      full_name_en: idx('full_name_en') > -1 ? cells[idx('full_name_en')] || null : null,
      job_title: idx('job_title') > -1 ? cells[idx('job_title')] || null : null,
      department,
      nationality: idx('nationality') > -1 ? cells[idx('nationality')] || null : null,
      mobile: idx('mobile') > -1 ? cells[idx('mobile')] || null : null,
      employment_status: 'active',
    });
  }
  if (rows.length === 0) return { error: 'لم يتم العثور على صفوف صالحة' };

  const admin = createAdminClient();
  const { error } = await admin
    .from('employees')
    .upsert(rows as never, { onConflict: 'employee_code' });
  if (error) return { error: `فشل الاستيراد: ${error.message}` };

  revalidatePath('/admin/users');
  revalidatePath('/hr/employees');
  return { ok: true, message: `تم استيراد ${rows.length} موظفًا` };
}
