-- TASK-B0533 (المالك seq B1045 «سجل لعملاء شراء دائمين مثل بلال بكور … بالدين … يبحث بالفواتير»)
-- العميل الدائم = صفّ gmt_customers موسوم (لا جدول عملاء جديد) · الحساب الجاري مشتقّ لا مخزَّن:
--   مجموع المتبقّي على فواتيره − سندات القبض غير المُلغاة ⇒ لا رقمان متناقضان.
-- سند القبض لا يُحذف أبداً (يُلغى بسببٍ مسجَّل) — نفس قاعدة ADM-4 للديون والمصاريف.

alter table public.gmt_customers add column if not exists is_regular boolean not null default false;
alter table public.gmt_customers add column if not exists credit_limit numeric;

create table if not exists public.gmt_receipts (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid references public.gmt_customers(id),
  customer_name text,
  customer_phone text,
  amount        numeric not null check (amount > 0),
  currency      text not null default 'USD',
  exchange_rate numeric,
  method        text not null default 'cash',      -- cash · transfer · other
  invoice_id    text,                               -- إن خُصّص لفاتورة بعينها (اختياري)
  branch_key    text,
  received_by   text,
  note          text,
  created_at    timestamptz not null default now(),
  voided        boolean not null default false,
  voided_at     timestamptz,
  voided_by     text,
  void_reason   text
);
create index if not exists gmt_receipts_customer_idx on public.gmt_receipts(customer_id);

alter table public.gmt_receipts enable row level security;
drop policy if exists gmt_receipts_select on public.gmt_receipts;
drop policy if exists gmt_receipts_insert on public.gmt_receipts;
drop policy if exists gmt_receipts_update on public.gmt_receipts;
create policy gmt_receipts_select on public.gmt_receipts for select using (true);
create policy gmt_receipts_insert on public.gmt_receipts for insert with check (true);
create policy gmt_receipts_update on public.gmt_receipts for update using (true);
-- لا سياسة حذف عمداً: السند يُلغى (voided) ولا يُحذف.
