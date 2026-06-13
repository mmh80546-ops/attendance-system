import { setRequestLocale, getTranslations } from 'next-intl/server';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getSettings } from '@/lib/data';
import { AppShell } from '@/components/AppShell';

export default async function AdminSettings({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole(['admin'], locale);
  const t = await getTranslations();
  const supabase = await createClient();
  const s = await getSettings(supabase);

  const rows = [
    ['بداية الدوام', s?.workday_start],
    ['حد التأخير (دقيقة)', s?.late_threshold_minutes],
    ['ساعات العمل القياسية', s?.standard_hours],
    ['أيام نهاية الأسبوع', s?.weekend_days?.join(', ')],
    ['نطاق الموقع الافتراضي (م)', s?.default_geofence_radius_m],
  ];

  return (
    <AppShell role={ctx.profile.role} name={ctx.employee?.full_name_ar ?? ''}>
      <div className="card max-w-lg">
        <h1 className="mb-4 text-lg font-bold">{t('nav.settings')}</h1>
        <table className="w-full text-sm">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k as string} className="border-b last:border-0">
                <td className="p-2 font-semibold">{k}</td>
                <td className="p-2" dir="ltr">{String(v ?? '—')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
