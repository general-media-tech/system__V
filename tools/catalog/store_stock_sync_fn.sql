-- (TASK-A0516 · المالك seq 762 · 775 «المتجر يعرف الكمية — مزامنة فعلية») — يُشغَّل مرّة في محرّر SQL للقاعدة الرئيسية (Supabase ⇐ SQL Editor ⇐ Run)
-- كمية قوائم المتجر = مجموع فروع الجرد (قاعدة الجسر: inv_columns is_branch · include_in_total · عدا ألمانيا/الصين) · للقوائم البسيطة المربوطة (inv_id) فقط
-- يكتب فقط إن تغيّر شيء · بشرط التزامن على updated_at (لا يدوس تعديلاً متزامناً من الأدمن) · سطر تدقيق بعدد التغييرات.
-- مفتاح المتجر العامّ يُقرأ من الدالّة الموجودة gmt_catalog_sync (لا يُكتب هنا).
create or replace function public.gmt_store_stock_sync()
returns jsonb language plpgsql security definer set search_path = public, extensions as $fn$
declare
  su text := 'https://tupldwylzrkjzqtaiscv.supabase.co';
  sk text;
  keys text; rec jsonb; prods jsonb; upd text; newp jsonb; changed int; resp extensions.http_response; hdr extensions.http_header[];
begin
  select substring(pg_get_functiondef('public.gmt_catalog_sync(text[],text)'::regprocedure) from $r$select '([^']+)'::text k$r$) into sk;
  if sk is null then return jsonb_build_object('ok', false, 'err', 'no store key'); end if;
  hdr := array[extensions.http_header('apikey', sk), extensions.http_header('Authorization', 'Bearer ' || sk)];
  select string_agg(format('coalesce(%I,0)', key_name), '+' order by sort_order) into keys
    from inv_columns where is_branch and include_in_total and key_name ~ '^[a-z][a-z0-9_]*$' and key_name not in ('germany','china')
      and exists (select 1 from information_schema.columns c where c.table_schema='public' and c.table_name='products' and c.column_name=key_name);
  if keys is null then keys := 'coalesce(homs,0)+coalesce(daraa,0)+coalesce(haleb,0)+coalesce(kurani,0)+coalesce(sarmada,0)+coalesce(fakhouri,0)'; end if;
  create temp table if not exists _gss_q (id text primary key, q int) on commit drop; truncate _gss_q;
  execute format('insert into _gss_q select id::text, (%s)::int from products', keys);
  resp := extensions.http(('GET', su || '/rest/v1/gmt_store?id=eq.1&select=updated_at,products', hdr, null, null)::extensions.http_request);
  if resp.status <> 200 then return jsonb_build_object('ok', false, 'err', 'GET ' || resp.status); end if;
  rec := (resp.content::jsonb) -> 0; prods := rec -> 'products'; upd := rec ->> 'updated_at';
  select count(*) into changed from jsonb_array_elements(prods) x join _gss_q q on q.id = x->>'inv_id'
    where coalesce(jsonb_array_length(case when jsonb_typeof(x->'options')='array' then x->'options' end),0) = 0
      and coalesce(nullif(x->>'stock','')::numeric::int, 0) <> q.q;
  if changed = 0 then return jsonb_build_object('ok', true, 'changed', 0); end if;
  select jsonb_agg(case when q.id is not null and coalesce(jsonb_array_length(case when jsonb_typeof(x->'options')='array' then x->'options' end),0) = 0
                        and coalesce(nullif(x->>'stock','')::numeric::int, 0) <> q.q then x || jsonb_build_object('stock', q.q) else x end order by o)
    into newp from jsonb_array_elements(prods) with ordinality t(x, o) left join _gss_q q on q.id = x->>'inv_id';
  if jsonb_array_length(newp) <> jsonb_array_length(prods) then return jsonb_build_object('ok', false, 'err', 'count mismatch'); end if;
  resp := extensions.http(('PATCH', su || '/rest/v1/gmt_store?id=eq.1&select=id' || case when upd is null then '&updated_at=is.null' else '&updated_at=eq.' || replace(replace(upd, '+', '%2B'), ':', '%3A') end,
            hdr || array[extensions.http_header('Prefer', 'return=representation')], 'application/json',
            jsonb_build_object('products', newp, 'updated_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))::text)::extensions.http_request);
  if resp.status not in (200, 204) or coalesce(resp.content, '[]') = '[]' then return jsonb_build_object('ok', false, 'err', 'PATCH ' || resp.status); end if;
  insert into gmt_audit (action, actor, entity, entity_name, new_value, reason)
    values ('store_stock_sync', 'المزامنة التلقائية', 'gmt_store', 'كمية قوائم المتجر', jsonb_build_object('changed', changed)::text, 'TASK-A0516 — كمية المتجر من فروع الجرد كلّ 10 دقائق');
  return jsonb_build_object('ok', true, 'changed', changed);
end $fn$;
revoke all on function public.gmt_store_stock_sync() from public, anon, authenticated;

-- الجدولة: كلّ 10 دقائق (تُلغى بـ select cron.unschedule('gmt_store_stock_sync');)
select cron.schedule('gmt_store_stock_sync', '*/10 * * * *', $$select public.gmt_store_stock_sync()$$);

-- تجربة فورية (تُرجع {"ok":true,"changed":N}):
select public.gmt_store_stock_sync();
