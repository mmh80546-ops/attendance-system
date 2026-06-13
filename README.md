# ETC Field & Workforce System — نظام مسارات الامتياز الميداني

نظام حضور ميداني لشركة **مسارات الامتياز (Excellence Tracks Co.)** يحل محل تسجيل الحضور عبر
واتساب بعملية منظّمة وقابلة للتدقيق. عربي أولًا (RTL) مع تبديل للإنجليزية.

> **الرواتب خارج النطاق تمامًا.** هذه طبقة ميدانية مستقلة ستغذّي Odoo مستقبلًا — لذلك كل جدول
> أساسي يحمل `external_ref` و `sync_status` منذ اليوم الأول.

## التقنيات

- **الواجهة:** Next.js 14 (App Router) + TypeScript + Tailwind CSS — PWA للجوال، استجابة لسطح المكتب.
- **الخلفية:** Supabase (PostgreSQL + Auth + Storage + Row Level Security).
- **الجغرافيا:** Geolocation API في المتصفح + حساب Haversine من جهة الخادم.
- **الحالة:** Supabase client + TanStack Query.
- **التعدد اللغوي:** next-intl (العربية افتراضيًا).

## الإعداد

```bash
# 1) المتطلبات
npm install

# 2) أنشئ مشروع Supabase ثم انسخ المتغيرات
cp .env.example .env.local
#   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

# 3) شغّل ملفات الترحيل (SQL editor في Supabase أو supabase CLI) بالترتيب:
#    supabase/migrations/0001_init.sql
#    supabase/migrations/0002_rls.sql
#    supabase/migrations/0003_functions.sql
#    supabase/migrations/0004_storage.sql

# 4) بيانات تجريبية للأعمال (مشاريع/مواقع/فرق/موظفين)
#    شغّل supabase/seed.sql في SQL editor

# 5) أنشئ حسابات الدخول التجريبية (يتطلب service-role key)
npm run seed

# 6) التشغيل
npm run dev
```

### حسابات تجريبية (كلمة المرور `Etc@12345`)

| الدور | البريد |
|------|--------|
| admin | admin@etc.test |
| hr_manager | hr@etc.test |
| operations_manager | ops@etc.test |
| project_manager | pm@etc.test |
| site_engineer | engineer@etc.test |
| supervisor | supervisor@etc.test |
| employee | worker@etc.test |

## البنية والأمان

- **العمليات الموثوقة من الخادم** منفّذة كدوال PostgreSQL بصلاحية `SECURITY DEFINER`
  (`attendance_check_in`, `attendance_check_out`, `submit_leave`, دوال الموافقات):
  - التوقيت من `now()` (الخادم) وليس من جهاز المستخدم.
  - مرور النطاق الجغرافي يُحسب على الخادم عبر `haversine_m`.
  - أعلام التلاعب (`outside_geofence`, `mock_location`, `gps_off`, `low_accuracy`) تُسند هنا.
  - السجلات الموسومة **لا تُرفض تلقائيًا** — تُوجّه للمشرف، ثم مراجعة الموارد البشرية.
- **RLS مفعّل على كل جدول** مع دوال نطاق (`app.visible_employee_ids`) تقيّد الصفوف حسب الدور/الفريق/المشروع.
- **الحقول الحساسة** (`nationality`, `mobile`) تظهر للموارد البشرية/المدير فقط عبر العرض `employees_safe`.
- **سجل التدقيق** يسجّل الموافقات وتغييرات الحالة وعمليات التصدير.
- التصدير CSV يستخدم أسماء أعمدة نظيفة قابلة للاستيراد في Odoo مع BOM للترميز UTF-8 (عربي سليم في Excel).

> **حدود النظام:** هذه طبقة ردع وكشف، وليست منعًا مطلقًا للتزييف. المنع الكامل يتطلب تطبيقًا أصليًا
> مستقبلاً. متصفح الويب لا يمنع تزييف GPS.

## حالة المراحل

- **المرحلة 0 (مكتملة):** الترحيلات + RLS + البذور + هيكل Next.js + RTL + المصادقة + التوجيه حسب الدور.
- **المرحلة 1A (مكتملة):** حضور/انصراف PWA، سيلفي + GPS، دالة الخادم، موافقة المشرف، مراجعة HR، السجل.
- **المرحلة 1B (مكتملة):** الإجازات — طلب → مشرف → HR → خصم الرصيد مرة واحدة بعد اعتماد HR.
- **المرحلة 1C (مكتملة):** لوحات الحضور/HR/الإدارة + تقارير + تصدير CSV + سجل تدقيق.
- **المرحلة 2 (لاحقًا):** أوامر العمل، توثيق الصور، الإنتاجية (الجداول جاهزة، بلا واجهة بعد).
- **المرحلة 3 (لاحقًا):** تجهيز تكامل Odoo عبر `external_ref` / `sync_status`.

## ملاحظات أمنية للاعتماديات

تبقّت تنبيهات `npm audit` تتطلب ترقيات كبرى كاسرة: تحذير Next.js يخص توجيه i18n في **Pages Router**
(نحن نستخدم App Router فلا ينطبق)؛ وتحذيرات next-intl/postcss تتطلب إصدارات major. يُنصح بتقييمها قبل الإنتاج.
