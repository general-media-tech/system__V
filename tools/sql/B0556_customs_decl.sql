-- B0556 (A1004 P5): ملخّص البيان الجمركي على الفاتورة — مطبَّق
alter table public.import_log add column if not exists customs_decl jsonb;
