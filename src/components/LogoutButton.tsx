'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';

export function LogoutButton() {
  const t = useTranslations('nav');
  const router = useRouter();
  async function logout() {
    await createClient().auth.signOut();
    router.replace('/login');
    router.refresh();
  }
  return (
    <button onClick={logout} className="text-sm font-semibold text-white/80 hover:text-white">
      {t('logout')}
    </button>
  );
}
