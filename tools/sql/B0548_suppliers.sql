-- TASK-B0548 (A1004 §6 · P3 · الخطّة 1.5) — الموردون · مطبَّق
-- لا اختراع: البيانات من فواتيره أو مما يكتبه المستخدم · الربط بالأسماء القديمة بضغطة (aliases) · النصّ القديم على الفاتورة لا يتغيّر · لا حذف.
create table if not exists public.gmt_suppliers (
  id uuid primary key default gen_random_uuid(), name text not null unique, aliases text[] not null default '{}',
  legal_name text, country text, city text, address text, ship_address text, phone text, email text, web text, contact text,
  currencies text, pay_terms text, incoterms text, lead_days int, notes text, active boolean not null default true,
  created_by text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.import_log add column if not exists supplier_id uuid references public.gmt_suppliers(id);
alter table public.gmt_suppliers enable row level security;
create policy gmt_suppliers_select on public.gmt_suppliers for select using (true);
create policy gmt_suppliers_insert on public.gmt_suppliers for insert with check (true);
create policy gmt_suppliers_update on public.gmt_suppliers for update using (true);
