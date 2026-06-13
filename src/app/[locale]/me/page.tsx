import { setRequestLocale, getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getSites, getMyAttendanceToday } from '@/lib/data';
import { AppShell } from '@/components/AppShell';
import { CheckInOut } from '@/components/CheckInOut';

export default async function MePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getSession();
  if (!session) redirect({ href: '/login', locale });
  const ctx = session!;
  const t = await getTranslations();

  if (!ctx.employee) {
    return (
      <AppShell role={ctx.profile.role} name={ctx.email ?? ''}>
        <div className="card">{t('common.noData')}</div>
      </AppShell>
    );
  }

  const supabase = await createClient();
  const [sites, today] = await Promise.all([
    getSites(supabase),
    getMyAttendanceToday(supabase, ctx.employee.id),
  ]);

  return (
    <AppShell role={ctx.profile.role} name={ctx.employee.full_name_ar}>
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="text-xl font-bold text-white">
          {t('common.welcome')}، {ctx.employee.full_name_ar}
        </h1>
        <div className="card">
          <h2 className="mb-4 text-lg font-bold">{t('attendance.title')}</h2>
          <CheckInOut sites={sites} employeeId={ctx.employee.id} today={today} />
        </div>
      </div>
    </AppShell>
  );
}
