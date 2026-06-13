import { setRequestLocale, getTranslations } from 'next-intl/server';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getPendingAttendance, getPendingLeaveSupervisor } from '@/lib/data';
import { AppShell } from '@/components/AppShell';
import { StatusBadge, TamperBadges } from '@/components/StatusBadge';
import { ApprovalActions } from '@/components/ApprovalActions';

export default async function ManagerApprovals({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole(['project_manager', 'admin'], locale);
  const t = await getTranslations();
  const supabase = await createClient();
  const [att, leave] = await Promise.all([
    getPendingAttendance(supabase) as Promise<any[]>,
    getPendingLeaveSupervisor(supabase) as Promise<any[]>,
  ]);

  return (
    <AppShell role={ctx.profile.role} name={ctx.employee?.full_name_ar ?? ''}>
      <div className="space-y-6">
        <div className="card">
          <h2 className="mb-3 font-bold">{t('attendance.title')}</h2>
          <div className="space-y-2">
            {att.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                <div>
                  <p className="font-semibold">{r.employees?.full_name_ar} ({r.employees?.employee_code})</p>
                  <p className="text-slate-500">{r.work_date} · {r.sites?.name ?? '—'}</p>
                  <div className="mt-1 flex gap-2"><StatusBadge value={r.status} ns="attendance" /><TamperBadges flags={r.tamper_flags} /></div>
                </div>
                <ApprovalActions id={r.id} kind="attendance" level="supervisor" />
              </div>
            ))}
            {att.length === 0 && <p className="text-slate-400">{t('approval.queueEmpty')}</p>}
          </div>
        </div>
        <div className="card">
          <h2 className="mb-3 font-bold">{t('leave.title')}</h2>
          <div className="space-y-2">
            {leave.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                <div>
                  <p className="font-semibold">{r.employees?.full_name_ar} ({r.employees?.employee_code})</p>
                  <p className="text-slate-500">{t(`leave.${r.leave_type}`)} · {r.start_date} → {r.end_date} · {r.num_days} {t('leave.days')}</p>
                </div>
                <ApprovalActions id={r.id} kind="leave" level="supervisor" />
              </div>
            ))}
            {leave.length === 0 && <p className="text-slate-400">{t('approval.queueEmpty')}</p>}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
