-- TASK-A0544 (المالك seq 929 «خلّيها مراقَبة ويسجّل ويفحص») — بوت مراقبة الأخطاء على القاعدة الرئيسية
-- كلّ ساعة: يجمّع أخطاء كلّ الأجهزة (gmt_telemetry kind='error') بنوعها (الصفحة · النوع · الرسالة بلا أرقام) ⇒ gmt_error_watch
--   • نوعٌ «حرج» جديد ⇒ تنبيه هاتف فوري (error_new) · • نوعٌ «مُصلَح» عاد بعد إصلاحه ⇒ «reopened» + تنبيه.
create table if not exists public.gmt_error_watch (
  sig          text primary key,
  page         text,
  err_type     text,
  severity     text,
  message      text,
  sample       text,
  first_seen   timestamptz not null default now(),
  last_seen    timestamptz not null default now(),
  hits         integer not null default 0,
  sessions     integer not null default 0,
  status       text not null default 'new' check (status in ('new','seen','fixed','reopened','ignored')),
  fixed_at     timestamptz,
  fixed_note   text,
  alerted_at   timestamptz,
  updated_at   timestamptz not null default now()
);
alter table public.gmt_error_watch enable row level security;
drop policy if exists gmt_error_watch_read on public.gmt_error_watch;
create policy gmt_error_watch_read on public.gmt_error_watch for select using (true);

alter table public.gmt_push_queue drop constraint if exists gmt_push_queue_kind_check;
alter table public.gmt_push_queue add constraint gmt_push_queue_kind_check check (kind = any (array['order','order_new','order_confirmed','order_shipped','order_delivered','order_completed','order_returned','sale','refund','transfer','transfer_received','transfer_aging','stock_in','stock_count','product_new','offer','price','expense','expense_approved','cash_transfer','daily_close','settlement','chat','review','reservation','job','warranty_on','version','stock_low','stock_out','order_late','sales_low','escalate','carrier_arrived','carrier_got','carrier_returned','error_new','error_reopened']));

create or replace function public.gmt_error_sig(p_page text, p_type text, p_msg text) returns text
language sql immutable as $$
  select md5(coalesce(p_page,'') || '|' || coalesce(p_type,'') || '|' ||
             regexp_replace(regexp_replace(coalesce(p_msg,''), '[0-9]+(\.[0-9]+)?', '#', 'g'), '\s+', ' ', 'g'))
$$;

create or replace function public.gmt_error_watch_run() returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_since timestamptz; v_until timestamptz; v_new int := 0; v_re int := 0; v_t text; v_b text;
begin
  -- علامةٌ دقيقة لآخر خطأ عولج (لا يُعدّ خطأٌ مرّتين)
  select coalesce((select value::timestamptz from gmt_settings where key = 'error_watch_mark'), now() - interval '2 hours') into v_since;
  select coalesce(max(created_at), v_since) into v_until from gmt_telemetry where kind = 'error' and created_at > v_since;
  with g as (
    select gmt_error_sig(page, err_type, message) sig, max(page) page, max(err_type) err_type,
           max(severity) filter (where severity = 'crit') crit, max(severity) sev,
           max(regexp_replace(left(message, 300), '[0-9]+(\.[0-9]+)?', '#', 'g')) message, max(left(detail::text, 400)) sample,
           min(created_at) f, max(created_at) l, sum(coalesce(count, 1))::int h, count(distinct session_id)::int s
    from gmt_telemetry where kind = 'error' and created_at > v_since and created_at <= v_until group by 1
  ), up as (
    insert into gmt_error_watch as w (sig, page, err_type, severity, message, sample, first_seen, last_seen, hits, sessions)
    select sig, page, err_type, coalesce(crit, sev), message, sample, f, l, h, s from g
    on conflict (sig) do update set last_seen = greatest(w.last_seen, excluded.last_seen), hits = w.hits + excluded.hits,
      sessions = w.sessions + excluded.sessions, sample = excluded.sample, updated_at = now(),
      severity = case when excluded.severity = 'crit' then 'crit' else w.severity end,
      status = case when w.status = 'fixed' and excluded.last_seen > w.fixed_at then 'reopened' else w.status end
    returning w.*, (w.xmax::text = '0') as inserted
  )
  select count(*) filter (where inserted and severity = 'crit' and alerted_at is null),
         count(*) filter (where status = 'reopened' and (alerted_at is null or alerted_at < fixed_at))
    into v_new, v_re from up;
  -- التنبيهات (بلا بيانات زبائن: الصفحة ونوع الخطأ فقط)
  if v_new > 0 then
    select '🛡️ خطأ حرج جديد' || case when v_new > 1 then ' (' || v_new || ')' else '' end,
           string_agg(coalesce(page,'') || ': ' || left(message, 80), ' · ') into v_t, v_b
    from (select page, message from gmt_error_watch where severity = 'crit' and status = 'new' and alerted_at is null order by first_seen desc limit 3) x;
    begin
      insert into gmt_push_queue (kind, topic, data, dedupe_key, send_after)
      values ('error_new', 'admin', jsonb_build_object('t', v_t, 'b', v_b, 'u', 'weekly_report.html'), 'error_new:' || md5(coalesce(v_b,'')), now())
      on conflict do nothing;
    exception when others then null; end;
    update gmt_error_watch set alerted_at = now() where severity = 'crit' and status = 'new' and alerted_at is null;
  end if;
  if v_re > 0 then
    select string_agg(coalesce(page,'') || ': ' || left(message, 80), ' · ') into v_b
    from (select page, message from gmt_error_watch where status = 'reopened' and (alerted_at is null or alerted_at < fixed_at) limit 3) x;
    begin
      insert into gmt_push_queue (kind, topic, data, dedupe_key, send_after)
      values ('error_reopened', 'admin', jsonb_build_object('t', '🔁 رجع خطأٌ مُصلَح (' || v_re || ')', 'b', v_b || ' — قد يكون جهازاً بنسخةٍ قديمة', 'u', 'weekly_report.html'), 'error_re:' || md5(coalesce(v_b,'') || now()::date), now())
      on conflict do nothing;
    exception when others then null; end;
    update gmt_error_watch set alerted_at = now() where status = 'reopened' and (alerted_at is null or alerted_at < fixed_at);
  end if;
  update gmt_settings set value = v_until::text where key = 'error_watch_mark';
  if not found then insert into gmt_settings (key, value) values ('error_watch_mark', v_until::text); end if;
  return jsonb_build_object('since', v_since, 'until', v_until, 'new_crit', v_new, 'reopened', v_re);
end $$;

-- كلّ ساعة (الدقيقة 43)
select cron.unschedule('gmt_error_watch') where exists (select 1 from cron.job where jobname = 'gmt_error_watch');
select cron.schedule('gmt_error_watch', '43 * * * *', 'select public.gmt_error_watch_run()');
