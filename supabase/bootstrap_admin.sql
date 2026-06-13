-- ============================================================================
-- Link your first ADMIN login (no local tools needed).
--
-- Steps:
--  1) Supabase Dashboard → Authentication → Users → "Add user"
--     - email: admin@yourcompany.com   (use any email you control)
--     - password: (set a strong one)   - tick "Auto Confirm User"
--  2) Paste the line below into SQL Editor, change the email to match, Run.
--  3) Sign in to the app with that email/password → lands on the admin home.
-- ============================================================================

insert into public.profiles (id, role, employee_id, is_active)
select u.id, 'admin', '11111111-1111-1111-1111-111111111111', true
from auth.users u
where u.email = 'admin@yourcompany.com'      -- <-- change this
on conflict (id) do update
  set role = 'admin',
      employee_id = excluded.employee_id,
      is_active = true;
