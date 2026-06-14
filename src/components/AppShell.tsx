import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { navFor } from '@/lib/roles';
import type { AppRole } from '@/lib/types';
import { LogoutButton } from './LogoutButton';
import { LanguageSwitcher } from './LanguageSwitcher';

export async function AppShell({
  role,
  name,
  children,
}: {
  role: AppRole;
  name: string;
  children: React.ReactNode;
}) {
  const t = await getTranslations();
  const items = navFor(role);

  return (
    <div className="min-h-screen">
      <header className="bg-brand-darker/95 text-white shadow-lg backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white p-1.5">
              <Image src="/etc-logo-light.jpeg" alt="ETC" width={56} height={32} className="h-7 w-auto" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold">{t('app.company')}</p>
              <p className="text-xs text-brand-orange">{t(`roles.${role}`)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-white/80 sm:inline">{name}</span>
            <LanguageSwitcher />
            <LogoutButton />
          </div>
        </div>
        <nav className="border-t border-white/10 bg-brand-dark/80">
          <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 py-1.5">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white"
              >
                {t(`nav.${item.key}`)}
              </Link>
            ))}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl p-4 sm:p-6">{children}</main>
    </div>
  );
}
