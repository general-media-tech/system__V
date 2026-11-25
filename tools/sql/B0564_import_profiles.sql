-- TASK-B0564 (A989–A991 م١ · seq B1102) — «النظام يتعلّم شكل ملف كلّ مورّد» بلا ذكاء اصطناعي · مطبَّق
-- sig = بصمة صفّ العناوين (عناوين الأعمدة بعد التطبيع) ⇒ col = أيّ عمود لأيّ حقل كما صحّحه/اعتمده المستخدم.
-- المرّة الجاية بنفس شكل الملف: الأعمدة بتنعرف من البصمة مباشرةً. لا حذف.
create table if not exists public.gmt_import_profiles (
  sig text primary key,
  kind text not null default 'invoice',
  col jsonb not null,
  header jsonb,
  supplier text,
  uses integer not null default 1,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.gmt_import_profiles enable row level security;
create policy gmt_import_profiles_select on public.gmt_import_profiles for select using (true);
create policy gmt_import_profiles_insert on public.gmt_import_profiles for insert with check (true);
create policy gmt_import_profiles_update on public.gmt_import_profiles for update using (true);
