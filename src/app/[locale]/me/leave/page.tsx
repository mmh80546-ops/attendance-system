import { setRequestLocale, getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getMyLeave } from '@/lib/data';
import { AppShell } from '@/components/AppShell';
import { LeaveForm } from '@/components/LeaveForm';
import { StatusBadge } from '@/components/StatusBadge';

export default async function MyLeave({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getSession();
  if (!session) redirect({ href: '/login', locale });
  const ctx = session!;
  const t = await getTranslations();
  const supabase = await createClient();
  const rows = ctx.employee ? await getMyLeave(supabase, ctx.employee.id) : [];

  return (
    <AppShell role={ctx.profile.role} name={ctx.employee?.full_name_ar ?? ''}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <div className="mb-4 rounded-xl bg-brand-orange/10 p-4 text-center">
            <p className="text-sm text-slate-600">{t('leave.balance')}</p>
            <p className="text-3xl font-bold text-brand-orange">
              {ctx.employee?.annual_leave_balance_days ?? 0}{' '}
              <span className="text-base">{t('leave.days')}</span>
            </p>
          </div>
          <h2 className="mb-3 font-bold">{t('leave.newRequest')}</h2>
          <LeaveForm />
        </div>
        <div className="card">
          <h2 className="mb-3 font-bold">{t('leave.myRequests')}</h2>
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{t(`leave.${r.leave_type}`)}</span>
                  <span>{r.num_days} {t('leave.days')}</span>
                </div>
                <div className="mt-1 text-slate-500">
                  {r.start_date} → {r.end_date}
                </div>
                <div className="mt-2 flex gap-2">
                  <StatusBadge value={r.supervisor_approval} ns="approval" />
                  <StatusBadge value={r.hr_approval} ns="approval" />
                </div>
              </div>
            ))}
            {rows.length === 0 && <p className="text-slate-400">{t('common.noData')}</p>}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
