-- (المالك seq 347) الصور: الموجودة في القائمة أوّلاً ثمّ الجديدة حتى 7 فقط (seq 351) — لا تكثير، ولا يُحذف شيء موجود
-- مزامنة منتجات الجرد المُثراة إلى قوائمها في المتجر (المالك seq 344) — تُستبدل __IDS__ بقائمة المعرّفات
with k as (select '<STORE_ANON_KEY من gmt-config.js: GMT_DB.STORE.key>'::text k),
ids(id) as (select unnest(array[__IDS__]::text[])),
inv as (select p.id::text id, p.image_url, p.images, p.specs, p.compat from products p where p.id::text in (select id from ids)),
s as (select ((extensions.http(('GET','https://tupldwylzrkjzqtaiscv.supabase.co/rest/v1/gmt_store?id=eq.1&select=products,updated_at', array[extensions.http_header('apikey',k.k),extensions.http_header('Authorization','Bearer '||k.k)],null,null)::extensions.http_request)).content)::jsonb->0 j from k),
el as (select x, o from s, jsonb_array_elements(s.j->'products') with ordinality t(x,o)),
bk as (insert into gmt_catalog_backup (data, reason, source) select jsonb_agg(el.x), 'المالك seq 344 «زامن فوراً وارفع على السيستم»: قبل مزامنة صور ومواصفات وشرح المنتجات المُراجَعة إلى المتجر', 'store' from el where coalesce(el.x->>'inv_id','') in (select id from ids) returning id),
fx as (select el.o, case when i.id is null then el.x else
  el.x
  || jsonb_build_object('images', (select jsonb_agg(u order by mo) from (select u, min(oo) mo from (
        select u, n oo from jsonb_array_elements_text(coalesce(el.x->'images','[]')) with ordinality q(u,n)
        union all select i.image_url, 1000 where coalesce(i.image_url,'') <> ''
        union all select u, 1000+n from jsonb_array_elements_text(coalesce(i.images,'[]'::jsonb)) with ordinality q(u,n)) z where coalesce(u,'') <> '' and u !~ '^data:' group by u order by mo limit greatest(7, jsonb_array_length(coalesce(el.x->'images','[]')))) zz))
  || case when length(coalesce(i.specs->>'__desc','')) > length(coalesce(el.x->>'description','')) then jsonb_build_object('description', i.specs->>'__desc') else '{}'::jsonb end
  || jsonb_build_object('specs', coalesce((select jsonb_agg(case when i.specs ? (e->>'label') and coalesce(i.specs->>(e->>'label'),'') <> '' then jsonb_set(e, '{value}', to_jsonb(i.specs->>(e->>'label'))) else e end order by n)
        from jsonb_array_elements(coalesce(el.x->'specs','[]'::jsonb)) with ordinality q(e,n)
        -- (seq 248) الحقل الذي حذفته المراجعة من الجرد (مسجَّل في gmt_audit.meta.dropped) يُحذف من القائمة أيضاً · القيمة المصحَّحة في الجرد تحلّ محلّ القديمة
        where not (not (i.specs ? (e->>'label')) and (e->>'label') in (select jsonb_object_keys(a.meta->'dropped') from gmt_audit a where a.action = 'catalog_enrich' and a.entity_id::text = i.id and jsonb_typeof(a.meta->'dropped') = 'object'))), '[]'::jsonb) || coalesce((select jsonb_agg(jsonb_build_object('label',kv.key,'value',kv.value #>> '{}')) from jsonb_each(coalesce(i.specs,'{}'::jsonb)) kv
        where kv.key !~ '^__' and coalesce(kv.value #>> '{}','') <> ''
          and not exists (select 1 from jsonb_array_elements(coalesce(el.x->'specs','[]'::jsonb)) e where e->>'label' = kv.key)), '[]'::jsonb))
  || case when coalesce(el.x->>'compat','') = '' and coalesce(i.compat,'') <> '' then jsonb_build_object('compat', i.compat) else '{}'::jsonb end
  end x from el left join inv i on i.id = coalesce(el.x->>'inv_id','')),
np as (select jsonb_agg(x order by o) p from fx),
nu as (select to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.US"+00:00"') ua)
select (select id from bk) bk, jsonb_array_length(s.j->'products') before_n, jsonb_array_length(np.p) after_n,
 (select jsonb_agg(jsonb_build_object('n',x->>'name','imgs',jsonb_array_length(x->'images'),'specs',jsonb_array_length(x->'specs'))) from jsonb_array_elements(np.p) x where coalesce(x->>'inv_id','') in (select id from ids)) synced,
 case when jsonb_array_length(np.p) = jsonb_array_length(s.j->'products') then
 (extensions.http(('PATCH','https://tupldwylzrkjzqtaiscv.supabase.co/rest/v1/gmt_store?id=eq.1&updated_at=eq.'||replace(s.j->>'updated_at','+','%2B'),
   array[extensions.http_header('apikey',k.k),extensions.http_header('Authorization','Bearer '||k.k),extensions.http_header('Prefer','return=representation')],
   'application/json', jsonb_build_object('products',np.p,'updated_at',nu.ua)::text)::extensions.http_request)).content::text ilike '%"id":1%' end as ok
from s, np, k, nu;
