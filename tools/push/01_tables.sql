-- (TASK-B0420 · docs/دراسة_الإشعارات_الفورية.md المهمّة ١) جداول الإشعارات الفوريّة — idempotent
-- تحقّق من المخطّط (17 ت2 2026): gmt_users(id uuid, username, branch_key, is_active, role, approved) · gmt_settings(key, value) ·
-- branch_stock_transfers(id uuid, to_branch, from_branch, from_branch_name, status, transfer_number) · gmt_offers(targets jsonb) · products(id uuid, price)
create extension if not exists pg_net;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null, auth text not null,
  user_id text, username text, branch_key text,
  topics text[] not null default '{pos}',
  prefs jsonb not null default '{}',
  platform text, ua text,
  created_at timestamptz not null default now(), last_seen_at timestamptz not null default now(), last_sent_at timestamptz,
  fail_count int not null default 0, disabled_at timestamptz, disabled_reason text
);
create index if not exists push_subs_branch_idx on public.push_subscriptions(branch_key) where disabled_at is null;

create table if not exists public.gmt_push_queue (
  id bigserial primary key,
  kind text not null check (kind in ('order','offer','price','transfer','version','transfer_aging','expense')),
  branch_key text, topic text not null default 'pos',
  ref_table text, ref_id text, data jsonb not null default '{}', dedupe_key text,
  send_after timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','sending','sent','skipped','failed')),
  attempts int not null default 0, created_at timestamptz not null default now(), sent_at timestamptz, result jsonb
);
create unique index if not exists gmt_push_queue_dedupe on public.gmt_push_queue(dedupe_key) where status='pending' and dedupe_key is not null;
create index if not exists gmt_push_queue_due on public.gmt_push_queue(status, send_after);

create table if not exists public.push_rate (k text not null, at timestamptz not null default now());
create index if not exists push_rate_k on public.push_rate(k, at);

alter table public.push_subscriptions enable row level security;
alter table public.gmt_push_queue enable row level security;
alter table public.push_rate enable row level security;
revoke all on public.push_subscriptions, public.gmt_push_queue, public.push_rate from anon, authenticated;
revoke all on sequence public.gmt_push_queue_id_seq from anon, authenticated;

insert into public.gmt_settings(key, value) values ('push_enabled_branches',''),('push_admin_users',''),('push_last_version',''),('push_site_url','https://general-media-tech.github.io/system__V') on conflict (key) do nothing;

create or replace function public.gmt_push_claim(lim int) returns setof public.gmt_push_queue
language plpgsql security definer set search_path = public as $$
begin
  update gmt_push_queue set status='pending' where status='sending' and send_after < now() - interval '5 minutes';
  return query update gmt_push_queue q set status='sending', attempts=q.attempts+1
    where q.id in (select id from gmt_push_queue where status='pending' and send_after<=now() order by id limit lim for update skip locked)
    returning q.*;
end $$;
revoke all on function public.gmt_push_claim(int) from public, anon, authenticated;
grant execute on function public.gmt_push_claim(int) to service_role;
