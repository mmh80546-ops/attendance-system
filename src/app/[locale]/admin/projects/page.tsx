import { setRequestLocale, getTranslations } from 'next-intl/server';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getProjects, getSites } from '@/lib/data';
import { AppShell } from '@/components/AppShell';

export default async function AdminProjects({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole(['admin'], locale);
  const t = await getTranslations();
  const supabase = await createClient();
  const [projects, sites] = await Promise.all([getProjects(supabase), getSites(supabase)]);

  return (
    <AppShell role={ctx.profile.role} name={ctx.employee?.full_name_ar ?? ''}>
      <div className="space-y-6">
        <div className="card">
          <h1 className="mb-4 text-lg font-bold">{t('nav.projects')}</h1>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-right text-slate-500">
                <th className="p-2">{t('common.name')}</th>
                <th className="p-2">العميل</th>
                <th className="p-2">الموقع</th>
                <th className="p-2">النطاق (م)</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="p-2 font-semibold">{p.name}</td>
                  <td className="p-2">{p.client}</td>
                  <td className="p-2">{p.location_text}</td>
                  <td className="p-2">{p.geofence_radius_m}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2 className="mb-3 font-bold">{t('common.site')}</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-right text-slate-500">
                <th className="p-2">{t('common.name')}</th>
                <th className="p-2">lat</th>
                <th className="p-2">lng</th>
                <th className="p-2">النطاق (م)</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="p-2 font-semibold">{s.name}</td>
                  <td className="p-2" dir="ltr">{s.latitude}</td>
                  <td className="p-2" dir="ltr">{s.longitude}</td>
                  <td className="p-2">{s.geofence_radius_m}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
