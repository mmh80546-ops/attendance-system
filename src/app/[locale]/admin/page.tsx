import { setRequestLocale, getTranslations } from 'next-intl/server';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getDashboardStats } from '@/lib/data';
import { AppShell } from '@/components/AppShell';
import { StatsGrid } from '@/components/StatsGrid';
import { Link } from '@/i18n/navigation';

export default async function AdminDashboard({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole(['admin'], locale);
  const t = await getTranslations();
  const supabase = await createClient();
  const stats = await getDashboardStats(supabase);

  const links = [
    { href: '/admin/users', key: 'users' },
    { href: '/admin/projects', key: 'projects' },
    { href: '/admin/settings', key: 'settings' },
    { href: '/admin/audit', key: 'audit' },
    { href: '/reports', key: 'reports' },
  ];

  return (
    <AppShell role={ctx.profile.role} name={ctx.employee?.full_name_ar ?? ''}>
      <div className="space-y-6">
        <StatsGrid stats={stats} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="stat-card font-semibold text-brand-dark hover:bg-brand-orange/10">
              {t(`nav.${l.key}`)}
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
