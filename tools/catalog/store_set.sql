-- (المالك seq 366–368) ترتيب صور قوائم المتجر من آخر سطر تدقيق catalog_images لكل منتج: البوستر أوّلاً ثم صور الجرد بترتيبها · المفصولة تُحذف من القائمة · صور المتجر الخاصّة الأخرى تبقى في آخرها
-- الاستعمال: استبدل __IDS__ بمصفوفة المعرّفات — نسخة احتياطية أوّلاً · يكتب فقط إن لم يتغيّر عدد المنتجات
with k as (select '<STORE_ANON_KEY — من gmt-config.js · لا يُكتب هنا>'::text k),
ids(id) as (select unnest(__IDS__::text[])),
a as (select distinct on (entity_id::text) entity_id::text id, (new_value::jsonb->'images') inv, meta->>'poster' poster, coalesce(meta->'removed','[]'::jsonb) drop
      from gmt_audit where action = 'catalog_images' and entity_id::text in (select id from ids) order by entity_id::text, created_at desc),
s as (select ((extensions.http(('GET','https://tupldwylzrkjzqtaiscv.supabase.co/rest/v1/gmt_store?id=eq.1&select=products,updated_at', array[extensions.http_header('apikey',k.k),extensions.http_header('Authorization','Bearer '||k.k)],null,null)::extensions.http_request)).content)::jsonb->0 j from k),
el as (select x, o from s, jsonb_array_elements(s.j->'products') with ordinality t(x,o)),
bk as (insert into gmt_catalog_backup (data, reason, source) select jsonb_agg(el.x), 'المالك seq 366–368: قبل ترتيب صور المتجر (البوستر أوّلاً · فصل الصورة القديمة الرديئة)', 'store' from el where coalesce(el.x->>'inv_id','') in (select id from ids) returning id),
fx as (select el.o, case when a.id is null then el.x else el.x || jsonb_build_object('images', (
         select jsonb_agg(u order by ord) from (
           select u, min(ord) ord from (
             select a.poster u, 0 ord where coalesce(a.poster,'') <> ''
             union all select u, n from jsonb_array_elements_text(a.inv) with ordinality q(u,n)
             union all select u, 1000+n from jsonb_array_elements_text(coalesce(el.x->'images','[]')) with ordinality q(u,n)) z
           where coalesce(u,'') <> '' and u !~ '^data:' and not (a.drop ? u) group by u) zz)) end x
      from el left join a on a.id = coalesce(el.x->>'inv_id','')),
np as (select jsonb_agg(x order by o) p from fx),
nu as (select to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.US"+00:00"') ua)
select (select id from bk) bk, jsonb_array_length(s.j->'products') before_n, jsonb_array_length(np.p) after_n,
 (select jsonb_agg(jsonb_build_object('n',left(x->>'name',40),'imgs',jsonb_array_length(x->'images'))) from jsonb_array_elements(np.p) x where coalesce(x->>'inv_id','') in (select id from ids)) synced,
 case when jsonb_array_length(np.p) = jsonb_array_length(s.j->'products') then
 (extensions.http(('PATCH','https://tupldwylzrkjzqtaiscv.supabase.co/rest/v1/gmt_store?id=eq.1&updated_at=eq.'||replace(s.j->>'updated_at','+','%2B'),
   array[extensions.http_header('apikey',k.k),extensions.http_header('Authorization','Bearer '||k.k),extensions.http_header('Prefer','return=representation')],
   'application/json', jsonb_build_object('products',np.p,'updated_at',nu.ua)::text)::extensions.http_request)).content::text ilike '%"id":1%' end ok
from s, np, k, nu;
