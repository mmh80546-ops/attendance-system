'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import {
  createUserAction,
  importEmployeesAction,
  type ActionResult,
} from '@/app/[locale]/admin/users/actions';
import type { AppRole, Employee } from '@/lib/types';

const ROLES: AppRole[] = [
  'admin', 'hr_manager', 'operations_manager', 'project_manager',
  'site_engineer', 'supervisor', 'employee',
];

const initial: ActionResult = {};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? '...' : label}
    </button>
  );
}

function Result({ state }: { state: ActionResult }) {
  if (state.error) {
    return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>;
  }
  if (state.ok) {
    return <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.message}</p>;
  }
  return null;
}

export function AdminUsersManager({ employees }: { employees: Employee[] }) {
  const t = useTranslations();
  const [createState, createForm] = useFormState(createUserAction, initial);
  const [importState, importForm] = useFormState(importEmployeesAction, initial);
  const [mode, setMode] = useState<'link' | 'new'>('link');

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Add user */}
      <div className="card">
        <h2 className="mb-4 text-lg font-bold">إضافة مستخدم (حساب دخول)</h2>
        <form action={createForm} className="space-y-3">
          <div>
            <label className="label">{t('login.email')}</label>
            <input name="email" type="email" className="field" dir="ltr" required />
          </div>
          <div>
            <label className="label">{t('login.password')}</label>
            <input name="password" type="text" className="field" dir="ltr" required minLength={6} />
          </div>
          <div>
            <label className="label">الدور</label>
            <select name="role" className="field" defaultValue="employee">
              {ROLES.map((r) => (
                <option key={r} value={r}>{t(`roles.${r}`)}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 text-sm">
            <button type="button" onClick={() => setMode('link')}
              className={`rounded-lg px-3 py-1.5 ${mode === 'link' ? 'bg-brand-orange text-white' : 'bg-slate-100'}`}>
              ربط بموظف موجود
            </button>
            <button type="button" onClick={() => setMode('new')}
              className={`rounded-lg px-3 py-1.5 ${mode === 'new' ? 'bg-brand-orange text-white' : 'bg-slate-100'}`}>
              موظف جديد
            </button>
          </div>

          {mode === 'link' ? (
            <div>
              <label className="label">الموظف</label>
              <select name="employee_id" className="field" defaultValue="">
                <option value="">— بدون ربط —</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.employee_code} — {e.full_name_ar}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3">
              <div>
                <label className="label">رمز الموظف</label>
                <input name="employee_code" className="field" />
              </div>
              <div>
                <label className="label">الاسم بالعربي</label>
                <input name="full_name_ar" className="field" />
              </div>
              <div>
                <label className="label">الاسم بالإنجليزي</label>
                <input name="full_name_en" className="field" dir="ltr" />
              </div>
              <div>
                <label className="label">المسمى الوظيفي</label>
                <input name="job_title" className="field" />
              </div>
              <div>
                <label className="label">القسم</label>
                <select name="department" className="field" defaultValue="">
                  <option value="">—</option>
                  <option value="projects">المشاريع</option>
                  <option value="maintenance">الصيانة</option>
                  <option value="procurement">المشتريات</option>
                  <option value="accounting">المحاسبة</option>
                  <option value="hr">الموارد البشرية</option>
                  <option value="management">الإدارة</option>
                </select>
              </div>
              <div>
                <label className="label">الجوال</label>
                <input name="mobile" className="field" dir="ltr" />
              </div>
            </div>
          )}

          <Result state={createState} />
          <Submit label="إنشاء المستخدم" />
        </form>
      </div>

      {/* Import employees */}
      <div className="card">
        <h2 className="mb-2 text-lg font-bold">استيراد قائمة الموظفين</h2>
        <p className="mb-3 text-sm text-slate-500">
          من Excel: احفظ كـ CSV، أو انسخ الأعمدة والصق هنا مباشرة. صف العناوين مطلوب.
          الأعمدة المدعومة: <code className="text-xs" dir="ltr">employee_code, full_name_ar, full_name_en, job_title, department, nationality, mobile</code>
          — الإلزامي: <code dir="ltr">employee_code</code> و <code dir="ltr">full_name_ar</code>.
        </p>
        <form action={importForm} className="space-y-3">
          <textarea
            name="csv"
            rows={8}
            dir="ltr"
            className="field font-mono text-xs"
            placeholder={'employee_code,full_name_ar,department,mobile\nETC-1001,محمد علي,maintenance,+9665...'}
          />
          <Result state={importState} />
          <Submit label="استيراد" />
        </form>
      </div>
    </div>
  );
}
