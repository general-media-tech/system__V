-- ═══════════════════════════════════════════════════════════════════════════
-- مركز الإشعارات — المرحلة ١ (المالك seq 803/808 · TASK-B0424)
-- يبني فوق محرّك الإشعارات القائم (gmt_push_queue = سجلّ الأحداث الموحّد):
--   • gmt_notify_rules     قواعد كل نوع (تفعيل · أولوية · مستلمون · منبثقة) — تُعدَّل من اللوحة بلا كود
--   • gmt_notify_groups    مجموعات حسب الدور (محاسبة · مستودع · خدمة عملاء …) وأعضاؤها
--   • gmt_notifications    صندوق الوارد: صفّ لكل مستلم (مقروء · مؤرشف · مؤجّل · تمّ الإجراء)
--   • gmt_notify_devices   أجهزة موثَّقة بكلمة السرّ أو باشتراك الإشعارات (رمزٌ مُجزّأ فقط)
-- الأمان: الصندوق والأجهزة بلا أيّ سياسة للمفتاح العام — القراءة عبر الدالّة notify-inbox فقط
-- (كلّ جهاز يرى إشعارات صاحبه وحده). القواعد والمجموعات تُقرأ وتُكتب كباقي إعدادات النظام.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.gmt_notify_rules (
  kind        text primary key,
  label       text not null,
  enabled     boolean not null default true,
  priority    smallint not null default 1 check (priority between 1 and 3),   -- 1 عادي · 2 مهم · 3 حرج
  to_admin    boolean not null default true,
  to_branch   boolean not null default false,       -- موظّفو فرع الحدث (أو كل الفروع إن لم يكن للحدث فرع)
  groups      text[] not null default '{}',         -- مفاتيح gmt_notify_groups
  popup       boolean not null default false,       -- منبثقة تطلب إجراءً
  mandatory   boolean not null default false,       -- لا يستطيع المستخدم إيقافه
  sound       text,                                 -- مفتاح صوت من gmt-sound.js (اختياري)
  updated_at  timestamptz not null default now(),
  updated_by  text
);

create table if not exists public.gmt_notify_groups (
  key         text primary key,
  name        text not null,
  members     text[] not null default '{}',         -- 'user:<uuid>' · 'admin'
  updated_at  timestamptz not null default now()
);

create table if not exists public.gmt_notifications (
  id            bigserial primary key,
  event_id      bigint not null references public.gmt_push_queue(id) on delete cascade,
  recipient     text not null,                      -- 'user:<uuid>' · 'admin'
  kind          text not null,
  priority      smallint not null default 1,
  popup         boolean not null default false,
  branch_key    text,
  ref_id        text,
  created_at    timestamptz not null default now(),
  read_at       timestamptz,
  archived_at   timestamptz,
  snoozed_until timestamptz,
  acted_at      timestamptz,
  unique (event_id, recipient)                      -- منع التكرار (Idempotency)
);
create index if not exists gmt_notifications_rcpt_idx on public.gmt_notifications (recipient, id desc);
create index if not exists gmt_notifications_unread_idx on public.gmt_notifications (recipient) where read_at is null and archived_at is null;

create table if not exists public.gmt_notify_devices (
  id           bigserial primary key,
  token_hash   text not null unique,
  recipient    text not null,
  user_id      text,
  branch_key   text,
  name         text,
  via          text not null,                       -- password · push
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at   timestamptz
);
create index if not exists gmt_notify_devices_rcpt_idx on public.gmt_notify_devices (recipient);

alter table public.gmt_notifications  enable row level security;
alter table public.gmt_notify_devices enable row level security;
alter table public.gmt_notify_rules   enable row level security;
alter table public.gmt_notify_groups  enable row level security;
revoke all on public.gmt_notifications, public.gmt_notify_devices from anon, authenticated;
drop policy if exists gmt_notify_rules_all on public.gmt_notify_rules;
create policy gmt_notify_rules_all on public.gmt_notify_rules for all using (true) with check (true);
drop policy if exists gmt_notify_groups_all on public.gmt_notify_groups;
create policy gmt_notify_groups_all on public.gmt_notify_groups for all using (true) with check (true);

-- القواعد الافتراضية = سلوك اليوم بالضبط (لا تغيير لما يصل لأحد) + الأولوية والمنبثقة
insert into public.gmt_notify_rules (kind, label, priority, to_admin, to_branch, popup, mandatory) values
  ('order',             'أوردر جديد من المتجر',        2, true,  true,  false, false),
  ('order_new',         'أوردر جديد (يدوي)',           1, true,  false, false, false),
  ('order_confirmed',   'أكّد الزبون طلبه',            2, true,  false, false, false),
  ('order_shipped',     'شُحن أوردر',                  1, true,  false, false, false),
  ('order_delivered',   'وصل أوردر للزبون',            1, true,  false, false, false),
  ('order_completed',   'حُصّل أوردر',                 1, true,  false, false, false),
  ('order_returned',    'أوردر مرتجع',                 2, true,  false, false, false),
  ('reservation',       'حجز منتج',                    1, true,  false, false, false),
  ('chat',              'زبون يطلب محادثة',            2, true,  false, false, false),
  ('sale',              'مبيعات جديدة',                1, true,  false, false, false),
  ('refund',            'مرتجع فاتورة',                2, true,  false, false, false),
  ('transfer',          'فاتورة نقل واردة',            2, false, true,  false, false),
  ('transfer_received', 'استُلمت فاتورة نقل',          1, true,  true,  false, false),
  ('transfer_aging',    'فواتير نقل متأخّرة',          2, true,  true,  false, false),
  ('stock_in',          'وصلت بضاعة',                  1, true,  true,  false, false),
  ('stock_count',       'جرد جديد',                    1, true,  false, false, false),
  ('product_new',       'منتج جديد',                   1, true,  false, false, false),
  ('offer',             'عرض/باقة جديدة',              1, false, true,  false, false),
  ('price',             'تغيّر سعر',                   1, false, true,  false, false),
  ('expense',           'مصروف بانتظار الموافقة',      2, true,  false, true,  false),
  ('expense_approved',  'اعتُمد مصروف الفرع',          1, false, true,  false, false),
  ('cash_transfer',     'تحويل نقدي',                  1, true,  false, false, false),
  ('daily_close',       'إقفال يومي',                  1, true,  false, false, false),
  ('settlement',        'تسوية عمولات',                1, true,  false, false, false),
  ('review',            'تقييم جديد في المتجر',        1, true,  false, false, false),
  ('job',               'طلب توظيف',                   1, true,  false, false, false),
  ('warranty_on',       'تفعيل كفالة',                 1, true,  false, false, false),
  ('version',           'تحديث النظام',                1, true,  true,  false, true)
on conflict (kind) do nothing;

insert into public.gmt_notify_groups (key, name) values
  ('accounting', 'المحاسبة'), ('warehouse', 'المستودع'), ('customer_service', 'خدمة العملاء'),
  ('orders_team', 'فريق الطلبات'), ('tech', 'المسؤول التقني'), ('branch_managers', 'مدراء الفروع')
on conflict (key) do nothing;

-- التوزيع: كل حدثٍ جديد ⇐ صفّ في صندوق كل مستلم حسب القاعدة. لا يُعطّل الحدث الأصلي أبداً.
create or replace function public.gmt_notify_fanout() returns trigger
language plpgsql security definer set search_path = public as $$
declare r public.gmt_notify_rules; rc text[] := '{}';
begin
  begin
    select * into r from public.gmt_notify_rules where kind = new.kind;
    if not found then
      r.enabled := true; r.priority := 1; r.popup := false; r.groups := '{}';
      r.to_admin := (new.topic in ('admin','orders')); r.to_branch := (new.topic = 'pos');
    end if;
    if not r.enabled then return new; end if;
    if r.to_admin then rc := rc || array['admin']; end if;
    if r.to_branch then
      rc := rc || coalesce((select array_agg('user:' || u.id::text) from public.gmt_users u
              where coalesce(u.is_active, true) and coalesce(u.approved, true)
                and (new.branch_key is null or u.branch_key = new.branch_key)), '{}');
    end if;
    if array_length(r.groups, 1) > 0 then
      rc := rc || coalesce((select array_agg(distinct m) from public.gmt_notify_groups g, unnest(g.members) m
              where g.key = any (r.groups)), '{}');
    end if;
    insert into public.gmt_notifications (event_id, recipient, kind, priority, popup, branch_key, ref_id)
      select new.id, x, new.kind, r.priority, r.popup, new.branch_key, new.ref_id
      from (select distinct unnest(rc) x) s where x is not null and x <> ''
      on conflict (event_id, recipient) do nothing;
  exception when others then
    null;   -- صندوق الوارد لا يُفشل أيّ عمليةٍ أصلية
  end;
  return new;
end $$;

drop trigger if exists gmt_notify_fanout_trg on public.gmt_push_queue;
create trigger gmt_notify_fanout_trg after insert on public.gmt_push_queue
  for each row execute function public.gmt_notify_fanout();

-- تنظيف: المقروء والمؤرشف بعد 120 يوماً (السجلّ الأصلي يبقى في gmt_push_queue حسب سياسته)
create or replace function public.gmt_notify_cleanup() returns void
language sql security definer set search_path = public as $$
  delete from public.gmt_notifications where created_at < now() - interval '120 days' and (read_at is not null or archived_at is not null);
  update public.gmt_notify_devices set revoked_at = now() where revoked_at is null and last_seen_at < now() - interval '120 days';
$$;

-- تنظيف الطابور: يبقى الحدث ما دام في صندوقٍ غير مؤرشف (حتى 120 يوماً) — وإلّا يُحذف بعد 30 يوماً كما كان
select cron.unschedule('gmt_push_cleanup') where exists (select 1 from cron.job where jobname = 'gmt_push_cleanup');
select cron.schedule('gmt_push_cleanup', '10 0 * * *', $c$
  delete from public.gmt_push_queue q where q.created_at < now() - interval '30 days'
    and not exists (select 1 from public.gmt_notifications n where n.event_id = q.id and n.archived_at is null and q.created_at > now() - interval '120 days');
  delete from public.push_rate where at < now() - interval '1 day';
  update public.push_subscriptions set disabled_at = now(), disabled_reason = 'stale' where disabled_at is null and last_seen_at < now() - interval '90 days';
  delete from public.push_subscriptions where disabled_at < now() - interval '30 days';
  select public.gmt_notify_cleanup();
$c$);
