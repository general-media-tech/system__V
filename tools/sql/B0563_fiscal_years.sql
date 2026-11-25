-- TASK-B0563 (seq B1101) — إقفال السنة المالية: لقطة «ما لنا وما علينا» آخر السنة ⇒ رصيد مدوّر للسنة الجديدة · مطبَّق
-- اللقطة ما بتمنع التعديل: إذا تغيّرت أرقام سنة مقفولة بعد الإقفال، السجلّ المالي بيبيّن الفرق. لا حذف.
create table if not exists public.gmt_fiscal_years (
  year integer primary key check (year between 2020 and 2100),
  closed_at timestamptz not null default now(),
  closed_by text,
  snapshot jsonb not null,
  note text
);
alter table public.gmt_fiscal_years enable row level security;
create policy gmt_fiscal_years_select on public.gmt_fiscal_years for select using (true);
create policy gmt_fiscal_years_insert on public.gmt_fiscal_years for insert with check (true);
create policy gmt_fiscal_years_update on public.gmt_fiscal_years for update using (true);
