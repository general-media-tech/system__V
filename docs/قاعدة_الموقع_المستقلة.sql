-- ════════════════════════════════════════════════════════════════════════════
-- قاعدة الموقع الإلكتروني المستقلّة — site.html · admin_site.html
-- (TASK-0154 · المالك seq 201: «افصل قاعدة الموقع … راح اشغلها لحالها · الهدف تخفيف عن القاعدة الرئيسية»)
-- تُشغَّل مرّةً واحدة في محرّر SQL لمشروع Supabase الجديد للموقع. بعدها يُستبدل رابط المشروع ومفتاحه العامّ (anon)
-- في gmt-config.js ⇐ GMT_DB.SITE — لا شيء غيره.
-- المحتوى الحاليّ (المؤقّت في القاعدة الرئيسية) يُنسخ إليها بعد إنشائها، ثمّ تُحذف نسخته من الرئيسية بموافقة المالك.
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.site_settings (key text primary key, value text, sort_order int not null default 0, updated_at timestamptz not null default now());
create table if not exists public.nav_items (id bigserial primary key, sort_order int not null default 0, is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), label_ar text not null default '', url text, is_home boolean not null default false, open_new_tab boolean not null default false);
create table if not exists public.hero_slides (id bigserial primary key, sort_order int not null default 0, is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), title_ar text, subtitle_ar text, description_ar text, btn1_label_ar text, btn1_url text, btn2_label_ar text, btn2_url text, bg_color text, image_url text);
create table if not exists public.service_cards (id bigserial primary key, sort_order int not null default 0, is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), label_ar text not null default '', url text, icon_name text, icon_svg text, open_new_tab boolean not null default false, contact boolean not null default false);
create table if not exists public.banners (id bigserial primary key, sort_order int not null default 0, is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), slot text not null default 'top', image_url text, link_url text, display_secs int not null default 4);
create table if not exists public.quick_links (id bigserial primary key, sort_order int not null default 0, is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), title_ar text, description_ar text, url text, icon_name text, icon_svg text, open_new_tab boolean not null default false);
create table if not exists public.why_us_features (id bigserial primary key, sort_order int not null default 0, is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), title_ar text, description_ar text, icon_name text, icon_svg text);
create table if not exists public.news_cards (id bigserial primary key, sort_order int not null default 0, is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), title_ar text not null default '', description_ar text, tag_ar text, tag_color text, link_url text, published_at date, image_url text);
create table if not exists public.footer_links (id bigserial primary key, sort_order int not null default 0, is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), label_ar text not null default '', url text, icon_name text, icon_svg text, link_type text, open_new_tab boolean not null default false);
create table if not exists public.agents (id bigserial primary key, sort_order int not null default 0, is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), name text not null default '', city text, phone text);
do $do$ declare t text; begin
  foreach t in array array['site_settings','nav_items','hero_slides','service_cards','banners','quick_links','why_us_features','news_cards','footer_links','agents'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists site_read on public.%I', t);
    execute format('drop policy if exists site_write on public.%I', t);
    execute format('create policy site_read on public.%I for select using (true)', t);
    execute format('create policy site_write on public.%I for all using (true) with check (true)', t);
  end loop;
end $do$;
-- صور لوحة الموقع: مخزنٌ عامّ واحد بمجلّدات site-hero · site-banners · site-news
insert into storage.buckets (id, name, public) values ('products-images', 'products-images', true) on conflict (id) do nothing;
create policy site_img_read on storage.objects for select using (bucket_id = 'products-images');
create policy site_img_write on storage.objects for insert with check (bucket_id = 'products-images');
create policy site_img_update on storage.objects for update using (bucket_id = 'products-images');
