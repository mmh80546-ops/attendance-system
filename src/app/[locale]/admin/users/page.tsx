import { setRequestLocale, getTranslations } from 'next-intl/server';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/AppShell';

export default async function AdminUsers({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole(['admin'], locale);
  const t = await getTranslations();
  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*, employees(full_name_ar, employee_code)')
    .order('role');
  const rows = (profiles ?? []) as any[];

  return (
    <AppShell role={ctx.profile.role} name={ctx.employee?.full_name_ar ?? ''}>
      <div className="card">
        <h1 className="mb-4 text-lg font-bold">{t('nav.users')}</h1>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-right text-slate-500">
              <th className="p-2">{t('common.name')}</th>
              <th className="p-2">الدور</th>
              <th className="p-2">نشط</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="p-2">{p.employees?.full_name_ar ?? '—'}</td>
                <td className="p-2">{t(`roles.${p.role}`)}</td>
                <td className="p-2">{p.is_active ? '✓' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
