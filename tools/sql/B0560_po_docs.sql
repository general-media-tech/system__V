-- TASK-B0560 (A1004 P6 م٣ · الخطّة 1.8) — أرشيف مستندات المشتريات بتخزين خاصّ · مطبَّق
-- الدلو po-docs خاصّ: المتصفّح يرفع فقط (insert) — ما في قراءة عامّة ولا روابط public.
-- الفتح برابط موقَّع ٥ دقائق من دالة gmt-admin (a: doc_url) للأدمن الداخل برمز جلسته فقط.
-- gmt_po_docs = البيانات الوصفية (الاسم · النوع · الفاتورة/الشحنة · الحجم) — لا حذف: إلغاء بسبب.
insert into storage.buckets (id, name, public, file_size_limit)
values ('po-docs', 'po-docs', false, 52428800) on conflict (id) do nothing;
create policy po_docs_insert_only on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'po-docs' and name like 'po/%');
create table if not exists public.gmt_po_docs (
  id uuid primary key default gen_random_uuid(),
  invoice_id bigint references public.import_log(id),
  shipment_id uuid references public.gmt_po_shipments(id),
  kind text not null default 'other' check (kind in ('pi','invoice','packing','customs','bl','receipt','photo','other')),
  name text not null, path text not null unique, size bigint, mime text, note text,
  uploaded_by text, created_at timestamptz not null default now(),
  voided boolean not null default false, voided_at timestamptz, voided_by text, void_reason text,
  check (invoice_id is not null or shipment_id is not null)
);
create index if not exists gmt_po_docs_inv_idx on public.gmt_po_docs(invoice_id);
create index if not exists gmt_po_docs_ship_idx on public.gmt_po_docs(shipment_id);
alter table public.gmt_po_docs enable row level security;
create policy gmt_po_docs_select on public.gmt_po_docs for select using (true);
create policy gmt_po_docs_insert on public.gmt_po_docs for insert with check (true);
create policy gmt_po_docs_update on public.gmt_po_docs for update using (true);
