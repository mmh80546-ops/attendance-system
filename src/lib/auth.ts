import { redirect } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import type { AppRole, Employee, Profile } from './types';
import { roleHome } from './roles';

export interface SessionContext {
  userId: string;
  email: string | null;
  profile: Profile;
  employee: Employee | null;
}

/** Returns the signed-in user's profile + employee, or null if not signed in. */
export async function getSession(): Promise<SessionContext | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  const profile = profileData as Profile | null;
  if (!profile) return null;

  let employee: Employee | null = null;
  if (profile.employee_id) {
    const { data } = await supabase
      .from('employees')
      .select('*')
      .eq('id', profile.employee_id)
      .single();
    employee = (data as Employee | null) ?? null;
  }

  return { userId: user.id, email: user.email ?? null, profile, employee };
}

/** Guard for protected pages. Redirects to login, or to the role's home if the
 *  role is not in `allowed`. */
export async function requireRole(
  allowed: AppRole[],
  locale: string,
): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect({ href: '/login', locale });
  const ctx = session as SessionContext;
  if (!allowed.includes(ctx.profile.role)) {
    redirect({ href: roleHome[ctx.profile.role], locale });
  }
  return ctx;
}
