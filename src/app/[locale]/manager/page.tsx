import { setRequestLocale, getTranslations } from 'next-intl/server';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getDashboardStats, getProjects } from '@/lib/data';
import { AppShell } from '@/components/AppShell';
import { StatsGrid } from '@/components/StatsGrid';

export default async function ManagerDashboard({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole(['project_manager', 'admin'], locale);
  const t = await getTranslations();
  const supabase = await createClient();
  const [stats, projects] = await Promise.all([getDashboardStats(supabase), getProjects(supabase)]);

  return (
    <AppShell role={ctx.profile.role} name={ctx.employee?.full_name_ar ?? ''}>
      <div className="space-y-6">
        <StatsGrid stats={stats} />
        <div className="card">
          <h2 className="mb-3 font-bold">{t('nav.projects')}</h2>
          <ul className="divide-y">
            {projects.map((p) => (
              <li key={p.id} className="flex justify-between py-2 text-sm">
                <span className="font-semibold">{p.name}</span>
                <span className="text-slate-500">{p.location_text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
