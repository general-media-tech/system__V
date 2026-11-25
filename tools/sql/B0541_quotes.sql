-- TASK-B0541 (المالك seq B1073 «عرض السعر … أسماء زبائن · اقتراح · تسييف · إنشاء فاتورة منه أو استيراد من عرض سعر · تذكيرات»)
-- كان عرض السعر مسودّةً على الجهاز فقط (localStorage) ⇒ لا قائمة ولا متابعة ولا تحويل لفاتورة.
-- العرض لا يُحذف: يُعلَّم «ما تمّ» (lost) أو «تحوّل لفاتورة» (converted) — نفس قاعدة عدم حذف السجلّات.
create table if not exists public.gmt_quotes (
  id             uuid primary key default gen_random_uuid(),
  ref            text not null unique,                 -- QT-YYMMDD-HHMM
  customer_name  text,
  customer_phone text,
  items          jsonb not null default '[]'::jsonb,   -- [{pid,name,qty,price}]
  discount       numeric not null default 0,
  currency       text not null default 'usd',
  rate           numeric,
  valid_days     int not null default 7,
  notes          text,
  total          numeric not null default 0,
  status         text not null default 'open' check (status in ('open','sent','converted','lost')),
  follow_up_at   date,                                 -- تذكير المتابعة
  invoice_id     text,
  invoice_number text,
  created_by     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists gmt_quotes_status_idx on public.gmt_quotes(status, follow_up_at);
alter table public.gmt_quotes enable row level security;
drop policy if exists gmt_quotes_select on public.gmt_quotes;
drop policy if exists gmt_quotes_insert on public.gmt_quotes;
drop policy if exists gmt_quotes_update on public.gmt_quotes;
create policy gmt_quotes_select on public.gmt_quotes for select using (true);
create policy gmt_quotes_insert on public.gmt_quotes for insert with check (true);
create policy gmt_quotes_update on public.gmt_quotes for update using (true);
-- لا سياسة حذف عمداً.
