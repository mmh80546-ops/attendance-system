import { setRequestLocale, getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { roleHome } from '@/lib/roles';

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  if (!isSupabaseConfigured) {
    const t = await getTranslations('common');
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center p-6">
        <div className="card text-center">
          <h1 className="mb-3 text-xl font-bold">{t('setupNeeded')}</h1>
          <p className="text-sm text-slate-500">
            cp .env.example .env.local
          </p>
        </div>
      </main>
    );
  }

  const session = await getSession();
  if (!session) redirect({ href: '/login', locale });
  else redirect({ href: roleHome[session.profile.role], locale });
}
