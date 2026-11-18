-- TASK-B0523 · الأمان م٢-ب — إغلاق بيانات الزبائن عن المفتاح العامّ (لا يُطبَّق قبل أن يأخذ كلّ الموظّفين جلساتهم:
--   select name, count(*) from gmt_sessions where exp > now() group by name;)
-- القراءة والتعديل والحذف لمن معه جلسة خادم (x-gmt-session) · الإدراج يبقى مفتوحاً (المتجر والكفالة يضيفان زبائن جدداً)
-- · المتجر يكمل الاسم الناقص فقط لزبونٍ بلا اسم.
alter table public.gmt_customers enable row level security;
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'gmt_customers' loop
    execute format('drop policy %I on public.gmt_customers', p.policyname);
  end loop;
end $$;
create policy gmt_customers_read   on public.gmt_customers for select using (public.gmt_session_ok());
create policy gmt_customers_insert on public.gmt_customers for insert with check (true);
create policy gmt_customers_update on public.gmt_customers for update using (public.gmt_session_ok() or coalesce(name, '') = '') with check (true);
create policy gmt_customers_delete on public.gmt_customers for delete using (public.gmt_session_ok());
-- التراجع: drop policy … ثمّ create policy allow_all on public.gmt_customers for all using (true) with check (true);
