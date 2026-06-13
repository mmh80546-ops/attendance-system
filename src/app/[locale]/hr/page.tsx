import { setRequestLocale } from 'next-intl/server';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getDashboardStats } from '@/lib/data';
import { AppShell } from '@/components/AppShell';
import { StatsGrid } from '@/components/StatsGrid';

export default async function HrDashboard({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole(['hr_manager', 'admin'], locale);
  const supabase = await createClient();
  const stats = await getDashboardStats(supabase);

  return (
    <AppShell role={ctx.profile.role} name={ctx.employee?.full_name_ar ?? ''}>
      <StatsGrid stats={stats} />
    </AppShell>
  );
}
