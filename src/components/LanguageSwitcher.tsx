'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const other = locale === 'ar' ? 'en' : 'ar';

  return (
    <button
      onClick={() => router.replace(pathname, { locale: other })}
      className="rounded-lg border border-white/20 px-2.5 py-1 text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white"
      aria-label="change language"
    >
      {other === 'ar' ? 'عربي' : 'EN'}
    </button>
  );
}
