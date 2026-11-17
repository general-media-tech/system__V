-- (TASK-B0420 · المهمّة ٦) Triggers: كلّ دالّة ملفوفة بـexception فلا تُفشل الكتابة التجاريّة أبداً — idempotent
create or replace function public.gmt_push_kick() returns void language plpgsql security definer set search_path = public as $$
declare u text; s text;
begin
  if not exists (select 1 from gmt_push_queue where (status='pending' and send_after<=now()) or (status='sending' and send_after < now() - interval '5 minutes')) then return; end if;
  select v into u from push_config where k='dispatch_url'; select v into s from push_config where k='cron_secret';
  if u is null or s is null then return; end if;
  perform net.http_post(url := u, body := '{}'::jsonb, headers := jsonb_build_object('Content-Type','application/json','x-push-secret', s), timeout_milliseconds := 10000);
exception when others then null;
end $$;
revoke all on function public.gmt_push_kick() from public, anon, authenticated;

create or replace function public.gmt_push_on_transfer() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pending' and (tg_op = 'INSERT' or old.status is distinct from 'pending') then
    insert into gmt_push_queue(kind, branch_key, topic, ref_table, ref_id, data, dedupe_key, send_after)
    values ('transfer', new.to_branch, 'pos', 'branch_stock_transfers', new.id::text,
            jsonb_build_object('num', new.transfer_number, 'from', coalesce(new.from_branch_name, new.from_branch)), 'transfer:' || new.id, now() + interval '45 seconds')
    on conflict (dedupe_key) where status = 'pending' and dedupe_key is not null do nothing;
  end if;
  return new;
exception when others then return new;
end $$;
drop trigger if exists gmt_push_transfer on public.branch_stock_transfers;
create trigger gmt_push_transfer after insert or update of status on public.branch_stock_transfers for each row execute function public.gmt_push_on_transfer();

create or replace function public.gmt_push_on_order() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pending' and new.branch = 'المتجر الإلكتروني' then
    insert into gmt_push_queue(kind, branch_key, topic, ref_table, ref_id, data, dedupe_key, send_after)
    values ('order', null, 'orders', 'gmt_orders', new.id::text, jsonb_build_object('num', coalesce(new.order_number, new.serial_code), 'qty', new.qty), 'order:' || new.id, now())
    on conflict (dedupe_key) where status = 'pending' and dedupe_key is not null do nothing;
    perform public.gmt_push_kick();
  end if;
  return new;
exception when others then return new;
end $$;
drop trigger if exists gmt_push_order on public.gmt_orders;
create trigger gmt_push_order after insert on public.gmt_orders for each row execute function public.gmt_push_on_order();

create or replace function public.gmt_push_on_offer() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_active and (tg_op = 'INSERT' or not coalesce(old.is_active, false)) and coalesce(new.offer_type, '') <> 'announce'
     and coalesce(new.targets::text, '') !~ '"pos"\s*:\s*false' then
    insert into gmt_push_queue(kind, branch_key, topic, ref_table, ref_id, data, dedupe_key, send_after)
    values ('offer', null, 'pos', 'gmt_offers', new.id::text,
            jsonb_build_object('name', new.name, 'price', new.offer_price, 'bundle', new.offer_type = 'bundle', 'until', new.ends_at), 'offer:' || new.id, now() + interval '60 seconds')
    on conflict (dedupe_key) where status = 'pending' and dedupe_key is not null do nothing;
  end if;
  return new;
exception when others then return new;
end $$;
drop trigger if exists gmt_push_offer on public.gmt_offers;
create trigger gmt_push_offer after insert or update of is_active on public.gmt_offers for each row execute function public.gmt_push_on_offer();

create or replace function public.gmt_push_on_price() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into gmt_push_queue(kind, branch_key, topic, ref_table, ref_id, data, dedupe_key, send_after)
  values ('price', null, 'pos', 'products', new.id::text, jsonb_build_object('pid', new.id, 'name', new.name, 'barcode', new.barcode, 'old', old.price, 'new', new.price), 'price:' || new.id, now() + interval '90 seconds')
  on conflict (dedupe_key) where status = 'pending' and dedupe_key is not null
  do update set data = gmt_push_queue.data || jsonb_build_object('new', excluded.data->'new', 'name', excluded.data->'name');
  return new;
exception when others then return new;
end $$;
drop trigger if exists gmt_push_price on public.products;
create trigger gmt_push_price after update of price on public.products for each row when (old.price is distinct from new.price) execute function public.gmt_push_on_price();

create or replace function public.gmt_push_on_price_change() returns trigger language plpgsql security definer set search_path = public as $$
declare pn text; pb text;
begin
  select name, barcode into pn, pb from products where id::text = new.product_id::text;
  insert into gmt_push_queue(kind, branch_key, topic, ref_table, ref_id, data, dedupe_key, send_after)
  values ('price', null, 'pos', 'gmt_price_changes', new.product_id::text, jsonb_build_object('pid', new.product_id, 'name', pn, 'barcode', pb, 'old', new.old_price, 'new', new.new_price, 'until', new.ends_at), 'price:' || new.product_id, now() + interval '90 seconds')
  on conflict (dedupe_key) where status = 'pending' and dedupe_key is not null
  do update set data = gmt_push_queue.data || jsonb_build_object('new', excluded.data->'new', 'until', excluded.data->'until');
  return new;
exception when others then return new;
end $$;
drop trigger if exists gmt_push_price_change on public.gmt_price_changes;
create trigger gmt_push_price_change after insert on public.gmt_price_changes for each row execute function public.gmt_push_on_price_change();

create or replace function public.gmt_push_on_expense() returns trigger language plpgsql security definer set search_path = public as $$
declare bn text;
begin
  if new.approved is not true then
    select display_name into bn from inv_columns where key_name = new.branch_key limit 1;
    insert into gmt_push_queue(kind, branch_key, topic, ref_table, ref_id, data, dedupe_key, send_after)
    values ('expense', null, 'admin', 'gmt_expenses', new.id::text, jsonb_build_object('branch', coalesce(bn, new.branch_key)), 'expense:' || new.id, now() + interval '60 seconds')
    on conflict (dedupe_key) where status = 'pending' and dedupe_key is not null do nothing;
  end if;
  return new;
exception when others then return new;
end $$;
drop trigger if exists gmt_push_expense on public.gmt_expenses;
create trigger gmt_push_expense after insert on public.gmt_expenses for each row execute function public.gmt_push_on_expense();
