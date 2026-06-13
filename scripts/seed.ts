/**
 * Creates demo auth users (one per role) and links each to a seeded employee
 * via the profiles table. Requires SUPABASE_SERVICE_ROLE_KEY.
 *
 *   npm run seed
 *
 * All demo accounts use the password below — change before any real use.
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_PASSWORD = 'Etc@12345';

type Seed = { email: string; role: string; employee_id: string | null };

const accounts: Seed[] = [
  { email: 'admin@etc.test', role: 'admin', employee_id: '11111111-1111-1111-1111-111111111111' },
  { email: 'hr@etc.test', role: 'hr_manager', employee_id: '22222222-2222-2222-2222-222222222222' },
  { email: 'ops@etc.test', role: 'operations_manager', employee_id: '33333333-3333-3333-3333-333333333333' },
  { email: 'pm@etc.test', role: 'project_manager', employee_id: '44444444-4444-4444-4444-444444444444' },
  { email: 'engineer@etc.test', role: 'site_engineer', employee_id: '55555555-5555-5555-5555-555555555555' },
  { email: 'supervisor@etc.test', role: 'supervisor', employee_id: '66666666-6666-6666-6666-666666666666' },
  { email: 'worker@etc.test', role: 'employee', employee_id: '77777777-7777-7777-7777-777777777777' },
];

async function main() {
  for (const acc of accounts) {
    // create or find the auth user
    const { data: created, error } = await admin.auth.admin.createUser({
      email: acc.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
    });

    let userId = created?.user?.id;
    if (error && !userId) {
      // already exists — look it up
      const { data: list } = await admin.auth.admin.listUsers();
      userId = list?.users.find((u) => u.email === acc.email)?.id;
    }
    if (!userId) {
      console.error(`Could not provision ${acc.email}:`, error?.message);
      continue;
    }

    const { error: pErr } = await admin.from('profiles').upsert({
      id: userId,
      role: acc.role,
      employee_id: acc.employee_id,
      is_active: true,
    });
    if (pErr) console.error(`profile ${acc.email}:`, pErr.message);
    else console.log(`✓ ${acc.email} (${acc.role}) / ${DEMO_PASSWORD}`);
  }
  console.log('\nSeed complete. Log in with any address above and password', DEMO_PASSWORD);
}

main().then(() => process.exit(0));
