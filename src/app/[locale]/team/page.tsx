import { setRequestLocale, getTranslations } from 'next-intl/server';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getTeamAttendanceToday } from '@/lib/data';
import { AppShell } from '@/components/AppShell';
import { StatusBadge, TamperBadges } from '@/components/StatusBadge';

export default async function TeamToday({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole(['supervisor', 'site_engineer', 'project_manager', 'admin'], locale);
  const t = await getTranslations();
  const supabase = await createClient();
  const rows = (await getTeamAttendanceToday(supabase)) as any[];

  return (
    <AppShell role={ctx.profile.role} name={ctx.employee?.full_name_ar ?? ''}>
      <div className="card">
        <h1 className="mb-4 text-lg font-bold">{t('nav.team')} — {t('dashboard.presentToday')}</h1>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-right text-slate-500">
                <th className="p-2">{t('common.code')}</th>
                <th className="p-2">{t('common.name')}</th>
                <th className="p-2">{t('common.site')}</th>
                <th className="p-2">{t('attendance.checkInTime')}</th>
                <th className="p-2">{t('attendance.status')}</th>
                <th className="p-2">⚠</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="p-2">{r.employees?.employee_code}</td>
                  <td className="p-2">{r.employees?.full_name_ar}</td>
                  <td className="p-2">{r.sites?.name ?? '—'}</td>
                  <td className="p-2">
                    {r.check_in_at ? new Date(r.check_in_at).toLocaleTimeString('ar-SA') : '—'}
                  </td>
                  <td className="p-2"><StatusBadge value={r.status} ns="attendance" /></td>
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
