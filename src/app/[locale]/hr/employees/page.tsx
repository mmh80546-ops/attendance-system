import { setRequestLocale, getTranslations } from 'next-intl/server';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getEmployees } from '@/lib/data';
import { AppShell } from '@/components/AppShell';

export default async function HrEmployees({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole(['hr_manager', 'admin'], locale);
  const t = await getTranslations();
  const supabase = await createClient();
  const employees = await getEmployees(supabase);

  return (
    <AppShell role={ctx.profile.role} name={ctx.employee?.full_name_ar ?? ''}>
      <div className="card">
        <h1 className="mb-4 text-lg font-bold">{t('nav.employees')}</h1>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-right text-slate-500">
                <th className="p-2">{t('common.code')}</th>
                <th className="p-2">{t('common.name')}</th>
                <th className="p-2">{t('common.department')}</th>
                <th className="p-2">الجنسية</th>
                <th className="p-2">{t('leave.balance')}</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="p-2">{e.employee_code}</td>
                  <td className="p-2">{e.full_name_ar}</td>
                  <td className="p-2">{e.department ?? '—'}</td>
                  <td className="p-2">{e.nationality ?? '—'}</td>
                  <td className="p-2">{e.annual_leave_balance_days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
