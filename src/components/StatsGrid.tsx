import { getTranslations } from 'next-intl/server';

export async function StatsGrid({
  stats,
}: {
  stats: {
    employees: number;
    activeProjects: number;
    presentToday: number;
    pendingApprovals: number;
    attendanceRate: number;
  };
}) {
  const t = await getTranslations('dashboard');
  const items = [
    { label: t('totalEmployees'), value: stats.employees },
    { label: t('activeProjects'), value: stats.activeProjects },
    { label: t('presentToday'), value: stats.presentToday },
    { label: t('pendingApprovals'), value: stats.pendingApprovals },
    { label: t('attendanceRate'), value: `${stats.attendanceRate}%` },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((it) => (
        <div key={it.label} className="stat-card">
          <p className="text-sm text-slate-500">{it.label}</p>
          <p className="text-2xl font-bold text-brand-dark">{it.value}</p>
        </div>
      ))}
    </div>
  );
}
