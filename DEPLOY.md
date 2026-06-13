# دليل النشر — الحصول على رابط يعمل فعليًا

اتبع الخطوات بالترتيب. النتيجة: رابط `https://...vercel.app` يفتح النظام الكامل بقاعدة بيانات حقيقية.

الوقت المتوقع: ١٥–٢٠ دقيقة. كل شيء مجاني (خطط Supabase وVercel المجانية تكفي).

---

## الخطوة 1 — أنشئ مشروع Supabase

1. ادخل https://supabase.com وسجّل الدخول (يمكن عبر GitHub).
2. **New project** → اختر اسمًا (مثل `etc-field`) وكلمة مرور لقاعدة البيانات (احفظها).
3. اختر أقرب منطقة (مثل `Central EU` أو `Middle East` إن توفّرت). انتظر اكتمال التهيئة (~دقيقتان).

## الخطوة 2 — جهّز قاعدة البيانات (لصقة واحدة)

1. داخل المشروع: **SQL Editor** → **New query**.
2. افتح ملف `supabase/setup.sql` من المستودع، انسخ محتواه كاملًا، الصقه، واضغط **Run**.
   - هذا يُنشئ الجداول + RLS + الدوال + التخزين + بيانات تجريبية (مشاريع/مواقع/فرق/موظفين).
   - إن ظهرت رسالة نجاح بدون أخطاء حمراء، تمت العملية.

## الخطوة 3 — انسخ مفاتيح المشروع

من **Project Settings → API**:
- `Project URL`  → سيصبح `NEXT_PUBLIC_SUPABASE_URL`
- `anon public`  → سيصبح `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` (سرّي) → سيصبح `SUPABASE_SERVICE_ROLE_KEY` (للبذور فقط، لا يُنشر للعميل)

## الخطوة 4 — أنشئ أول حساب مدير

1. **Authentication → Users → Add user**:
   - البريد: بريدك (مثل بريدك الحقيقي)
   - كلمة المرور: قوية
   - فعّل **Auto Confirm User**
2. **SQL Editor**: افتح `supabase/bootstrap_admin.sql`، غيّر البريد إلى نفس البريد أعلاه، ثم **Run**.
   - هذا يربط حسابك بدور `admin`.

> تريد بقية الأدوار للتجربة؟ شغّل `npm run seed` محليًا بعد ضبط `.env.local` (الخطوة 6)،
> أو أنشئ مستخدمين يدويًا واربطهم عبر تعديل بسيط على `bootstrap_admin.sql`.

## الخطوة 5 — انشر على Vercel

1. ادخل https://vercel.com وسجّل الدخول عبر GitHub.
2. **Add New → Project** → اختر مستودع `mmh80546-ops/attendance-system`.
3. **Branch**: اختر `claude/masarat-logo-background-5l17w3` (أو ادمجه إلى `main` أولًا).
4. في **Environment Variables** أضف:
   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | من الخطوة 3 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | من الخطوة 3 |
5. **Deploy**. بعد دقائق تحصل على رابط `https://attendance-system-xxx.vercel.app`.
6. افتح الرابط → سجّل الدخول ببريد المدير من الخطوة 4.

## الخطوة 6 (اختياري) — تشغيل محلي + بذر كل الأدوار

```bash
cp .env.example .env.local      # املأ الثلاثة مفاتيح (شامل service_role)
npm install
npm run seed                    # ينشئ 7 حسابات تجريبية (كلمة المرور Etc@12345)
npm run dev                     # http://localhost:3000
```

---

## بعد النشر

- **غيّر كلمات المرور التجريبية** قبل أي استخدام فعلي.
- لإضافة موظفين/مشاريع حقيقية: استخدم لوحة المدير، أو أدخلها عبر SQL Editor.
- صور الحضور تُخزَّن في bucket `attendance-photos` (عام القراءة، كتابة للمسجّلين).
