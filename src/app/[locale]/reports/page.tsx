import { setRequestLocale } from 'next-intl/server';
import { requireRole } from '@/lib/auth';
import { AppShell } from '@/components/AppShell';
import { ReportsClient } from '@/components/ReportsClient';

export default async function ReportsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole(
    ['admin', 'hr_manager', 'operations_manager', 'project_manager'],
    locale,
  );

  return (
    <AppShell role={ctx.profile.role} name={ctx.employee?.full_name_ar ?? ''}>
      <ReportsClient userId={ctx.userId} />
    </AppShell>
  );
}
