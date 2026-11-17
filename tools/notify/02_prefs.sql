-- مركز الإشعارات — المرحلة ٣ (المالك seq 809 «فيك تكمل»): تفضيلات كل مستخدم على الخادم
--   الإسكات لكل نوع · المهم فقط · ساعات هدوء وأيام عطلة · صوت لكل نوع · مستوى الصوت
--   الإلزامي (القاعدة mandatory) لا يُسكَت. التطبيق: صندوق الوارد (هنا) + إشعارات الجهاز (push-dispatch).
create table if not exists public.gmt_notify_prefs (
  recipient text primary key, muted text[] not null default '{}', important_only boolean not null default false,
  quiet_from smallint check (quiet_from between 0 and 23), quiet_to smallint check (quiet_to between 0 and 23),
  quiet_days smallint[] not null default '{}', sounds jsonb not null default '{}'::jsonb, volume smallint check (volume between 0 and 100),
  updated_at timestamptz not null default now());
alter table public.gmt_notify_prefs enable row level security;
revoke all on public.gmt_notify_prefs from anon, authenticated;
update public.gmt_notify_rules set mandatory = true where kind in ('version','expense');
-- gmt_notify_fanout: نفس المرحلة ١ + لا يُدرج لمن أسكت النوع أو اختار «المهم فقط» (إلّا الإلزامي) — انظر 01_center.sql
