-- TASK-B0545 (A1004 P1 · الخطّة B 1.3) — دفعات متعدّدة لفاتورة الشراء · مطبَّق
-- لا حذف: الإلغاء بسبب (voided). usd = المبلغ ÷ سعر الصرف (لا جمع عملات بلا سعر صرف محفوظ).
-- المحاسبة: import_log.cash_payment = مجموع usd غير الملغاة ⇒ GMTLedger.syncPurchase (قيود [PO:] نفسها).
create table if not exists public.gmt_po_payments (
  id uuid primary key default gen_random_uuid(),
  purchase_id bigint not null references public.import_log(id),
  kind text not null default 'partial' check (kind in ('opening','advance','partial','final')),
  amount numeric not null check (amount > 0), currency text not null default 'USD', fx_rate numeric, usd numeric not null,
  method text, ref_no text, paid_at date, due_at date, paid_by text, note text, created_by text,
  created_at timestamptz not null default now(),
  voided boolean not null default false, voided_at timestamptz, voided_by text, void_reason text
);
create index if not exists gmt_po_payments_pid_idx on public.gmt_po_payments(purchase_id);
alter table public.gmt_po_payments enable row level security;
create policy gmt_po_payments_select on public.gmt_po_payments for select using (true);
create policy gmt_po_payments_insert on public.gmt_po_payments for insert with check (true);
create policy gmt_po_payments_update on public.gmt_po_payments for update using (true);
