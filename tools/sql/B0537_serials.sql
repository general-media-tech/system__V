-- TASK-B0537 (المالك seq B1038–B1039 «نظام GMT الذكي لإدارة IMEI و Serial Numbers») — المرحلة ١
-- ① ما يحتاجه المنتج (الإدارة تتحكّم — لا افتراض بالتصنيف): '' | serial | imei | both
alter table public.products add column if not exists serial_req text;
-- ② الأرقام على بند الفاتورة نفسه (تظهر في الفاتورة والطباعة وتمرّ للكفالة): [{code, kind}]
alter table public.invoice_items add column if not exists serials jsonb;
-- ③ سجلّ الجهاز المركزي: رقمٌ واحد = سجلٌّ واحد (لا تكرار على مستوى النظام) · لا حذف (يُلغى بسبب)
create table if not exists public.gmt_serials (
  id              uuid primary key default gen_random_uuid(),
  code            text not null,
  kind            text not null default 'serial',          -- imei · serial
  product_id      uuid,
  product_name    text,
  status          text not null default 'in_stock',        -- in_stock · sold · returned · warranty · void
  branch_key      text,
  purchase_ref    text,
  sale_invoice_id text,
  sale_inv_number text,
  customer_name   text,
  customer_phone  text,
  sold_at         timestamptz,
  history         jsonb not null default '[]'::jsonb,       -- [{at, ev, by, ref}]
  created_at      timestamptz not null default now(),
  created_by      text,
  void_reason     text
);
create unique index if not exists gmt_serials_code_uq on public.gmt_serials (code) where status <> 'void';
create index if not exists gmt_serials_product_idx on public.gmt_serials (product_id);
alter table public.gmt_serials enable row level security;
drop policy if exists gmt_serials_select on public.gmt_serials;
drop policy if exists gmt_serials_insert on public.gmt_serials;
drop policy if exists gmt_serials_update on public.gmt_serials;
create policy gmt_serials_select on public.gmt_serials for select using (true);
create policy gmt_serials_insert on public.gmt_serials for insert with check (true);
create policy gmt_serials_update on public.gmt_serials for update using (true);
-- لا سياسة حذف عمداً.
