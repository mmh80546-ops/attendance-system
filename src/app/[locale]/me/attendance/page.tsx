import { setRequestLocale, getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getMyAttendanceHistory } from '@/lib/data';
import { AppShell } from '@/components/AppShell';
import { StatusBadge, TamperBadges } from '@/components/StatusBadge';

export default async function MyAttendance({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getSession();
  if (!session) redirect({ href: '/login', locale });
  const ctx = session!;
  const t = await getTranslations();
  const supabase = await createClient();
  const rows = ctx.employee ? await getMyAttendanceHistory(supabase, ctx.employee.id) : [];

  return (
    <AppShell role={ctx.profile.role} name={ctx.employee?.full_name_ar ?? ''}>
      <div className="card">
        <h1 className="mb-4 text-lg font-bold">{t('attendance.history')}</h1>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-right text-slate-500">
                <th className="p-2">{t('common.date')}</th>
                <th className="p-2">{t('attendance.checkInTime')}</th>
                <th className="p-2">{t('attendance.checkOutTime')}</th>
                <th className="p-2">{t('attendance.status')}</th>
                <th className="p-2">{t('approval.supervisorLevel')}</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="p-2">{r.work_date}</td>
                  <td className="p-2">
                    {r.check_in_at ? new Date(r.check_in_at).toLocaleTimeString('ar-SA') : '—'}
                  </td>
                  <td className="p-2">
                    {r.check_out_at ? new Date(r.check_out_at).toLocaleTimeString('ar-SA') : '—'}
                  </td>
                  <td className="p-2"><StatusBadge value={r.status} ns="attendance" /></td>
                  <td className="p-2"><StatusBadge value={r.supervisor_approval} ns="approval" /></td>
                  <td className="p-2"><TamperBadges flags={r.tamper_flags} /></td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-slate-400">{t('common.noData')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
