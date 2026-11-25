-- B0543: توزيع سند القبض على فواتير الزبون المفتوحة — مطبَّق
alter table public.gmt_receipts add column if not exists allocations jsonb not null default '[]'::jsonb;
