-- (TASK-0300 · المالك seq 371) إعادة بناء النسخة الخفيفة للمتجر (products-images/store/home.json) من سجلّ gmt_store — كما homeBuild في gmt-store-sync.js
with sk as (select '<KEY — من gmt-config.js · لا يُكتب هنا>'::text k), mk as (select '<KEY — من gmt-config.js · لا يُكتب هنا>'::text k),
s as (select ((extensions.http(('GET','https://tupldwylzrkjzqtaiscv.supabase.co/rest/v1/gmt_store?id=eq.1&select=*', array[extensions.http_header('apikey',sk.k),extensions.http_header('Authorization','Bearer '||sk.k)],null,null)::extensions.http_request)).content)::jsonb->0 r from sk),
p as (select jsonb_agg(
   (x - 'specs' - 'description' - 'compat' - 'alt_names' - 'video_url' - 'search_terms' - 'images_hidden')
   || case when jsonb_typeof(x->'images')='array' then jsonb_build_object('images', coalesce((select jsonb_agg(u order by n) from (select u, n from jsonb_array_elements_text(x->'images') with ordinality q(u,n) where u !~* '^data:' order by n limit 3) z), '[]'::jsonb)) else '{}'::jsonb end
   || case when jsonb_typeof(x->'options')='array' then jsonb_build_object('options', (select jsonb_agg(case when jsonb_typeof(o->'values')='array' then o || jsonb_build_object('values', (select jsonb_agg(case when jsonb_typeof(v)='object' then v - 'specs' - 'compat' else v end order by vn) from jsonb_array_elements(o->'values') with ordinality vv(v,vn))) else o end order by on_) from jsonb_array_elements(x->'options') with ordinality oo(o,on_))) else '{}'::jsonb end
   order by o) prods from s, jsonb_array_elements(s.r->'products') with ordinality t(x,o)),
body as (select ((s.r - 'products') || jsonb_build_object('products', p.prods, '__light', true, '__src_updated_at', s.r->>'updated_at', '__built_at', to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))::text b, jsonb_array_length(p.prods) n from s, p)
select body.n, length(body.b) bytes, (extensions.http(('POST','https://ysawzwtmodkqqbqoiojj.supabase.co/storage/v1/object/products-images/store/home.json',
  array[extensions.http_header('apikey',mk.k),extensions.http_header('Authorization','Bearer '||mk.k),extensions.http_header('x-upsert','true'),extensions.http_header('cache-control','max-age=60')],
  'application/json', body.b)::extensions.http_request)).status st from body, mk;
