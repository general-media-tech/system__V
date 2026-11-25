-- TASK-B0559 (A1004 P6 م٢ · الخطّة 1.8) — شحنات المشتريات N↔N · مطبَّق
-- شحنة وحدة لعدّة فواتير، وفاتورة ممكن تنقسم على عدّة شحنات (invoice_ids).
-- منفصل عن جدول shipments (هداك للأوردرات وفيه اسم زبون) — لا نخلط.
-- لا حذف: الإلغاء بالحالة cancelled مع سبب. وصول الشحنة ≠ استلام البضاعة (الاستلام بالمسح لكلّ فاتورة كما هو).
create table if not exists public.gmt_po_shipments (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  carrier text, tracking text,
  mode text not null default 'sea' check (mode in ('sea','air','land','express')),
  status text not null default 'booked' check (status in ('booked','transit','customs','arrived','cancelled')),
  invoice_ids bigint[] not null default '{}',
  etd date, eta date, arrived_at timestamptz,
  cartons integer, kg numeric, cbm numeric,
  note text, cancel_reason text,
  created_by text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists gmt_po_shipments_inv_idx on public.gmt_po_shipments using gin(invoice_ids);
alter table public.gmt_po_shipments enable row level security;
create policy gmt_po_shipments_select on public.gmt_po_shipments for select using (true);
create policy gmt_po_shipments_insert on public.gmt_po_shipments for insert with check (true);
create policy gmt_po_shipments_update on public.gmt_po_shipments for update using (true);
