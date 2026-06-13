import { setRequestLocale, getTranslations } from 'next-intl/server';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getAuditLog } from '@/lib/data';
import { AppShell } from '@/components/AppShell';

export default async function AdminAudit({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole(['admin'], locale);
  const t = await getTranslations();
  const supabase = await createClient();
  const rows = await getAuditLog(supabase);

  return (
    <AppShell role={ctx.profile.role} name={ctx.employee?.full_name_ar ?? ''}>
      <div className="card">
        <h1 className="mb-4 text-lg font-bold">{t('nav.audit')}</h1>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-right text-slate-500">
              <th className="p-2">{t('common.date')}</th>
              <th className="p-2">action</th>
              <th className="p-2">entity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="p-2" dir="ltr">{new Date(r.created_at).toLocaleString('ar-SA')}</td>
                <td className="p-2">{r.action}</td>
                <td className="p-2">{r.entity}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={3} className="p-6 text-center text-slate-400">{t('common.noData')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
