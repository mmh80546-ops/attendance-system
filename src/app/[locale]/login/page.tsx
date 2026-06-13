import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Brand } from '@/components/Brand';
import { LoginForm } from '@/components/LoginForm';

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <Brand subtitle={t('app.tagline')} />
      <div className="card mt-6">
        <h1 className="mb-4 text-center text-xl font-bold">{t('login.title')}</h1>
        <LoginForm />
      </div>
    </main>
  );
}
