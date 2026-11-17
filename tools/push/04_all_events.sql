-- (TASK-B0423 · المالك seq 802 «نظام إشعارات كامل لكلّ الأنظمة… حتى لو نحن خارجين الإشعار يجينا») — idempotent
-- كلّ Trigger ملفوف بـexception: الإشعار لا يُفشل أيّ كتابة تجاريّة أبداً. النصوص بلا أسماء زبائن ولا أرقامهم ولا مبالغ.
alter table public.gmt_push_queue drop constraint if exists gmt_push_queue_kind_check;
alter table public.gmt_push_queue add constraint gmt_push_queue_kind_check check (kind in (
  'order','order_new','order_confirmed','order_shipped','order_delivered','order_completed','order_returned',
  'sale','refund','transfer','transfer_received','transfer_aging','stock_in','stock_count','product_new',
  'offer','price','expense','expense_approved','cash_transfer','daily_close','settlement',
  'chat','review','reservation','job','warranty_on','version'));

create or replace function public.gmt_push_enqueue(p_kind text, p_branch text, p_topic text, p_ref_table text, p_ref_id text, p_data jsonb, p_dedupe text, p_delay interval)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into gmt_push_queue(kind, branch_key, topic, ref_table, ref_id, data, dedupe_key, send_after)
  values (p_kind, p_branch, p_topic, p_ref_table, p_ref_id, coalesce(p_data,'{}'::jsonb), p_dedupe, now() + coalesce(p_delay, interval '0'))
  on conflict (dedupe_key) where status = 'pending' and dedupe_key is not null
  do update set data = gmt_push_queue.data || jsonb_build_object('n', coalesce((gmt_push_queue.data->>'n')::int, 1) + 1);
exception when others then null;
end $$;
revoke all on function public.gmt_push_enqueue(text,text,text,text,text,jsonb,text,interval) from public, anon, authenticated;

-- ① الأوردرات: إنشاء يدوي · تغيّر الحالة · تأكيد الزبون
create or replace function public.gmt_push_on_order_all() returns trigger language plpgsql security definer set search_path = public as $$
declare num text := coalesce(new.order_number, new.serial_code, new.id::text); k text;
begin
  if tg_op = 'INSERT' then
    if coalesce(new.branch,'') <> 'المتجر الإلكتروني' then
      perform gmt_push_enqueue('order_new', null, 'orders', 'gmt_orders', new.id::text, jsonb_build_object('num', num, 'by', new.entered_by), 'order_new:'||new.id, interval '20 seconds');
    end if;
    return new;
  end if;
  if new.status is distinct from old.status then
    k := case new.status when 'shipped' then 'order_shipped' when 'delivered' then 'order_delivered' when 'completed' then 'order_completed' when 'returned' then 'order_returned' else null end;
    if k is not null then perform gmt_push_enqueue(k, null, 'orders', 'gmt_orders', new.id::text, jsonb_build_object('num', num, 'company', new.shipping_company), k||':'||new.id, interval '15 seconds'); end if;
  end if;
  if (new.confirmation->>'confirmed_at') is not null and (old.confirmation is null or (old.confirmation->>'confirmed_at') is null) then
    perform gmt_push_enqueue('order_confirmed', null, 'orders', 'gmt_orders', new.id::text, jsonb_build_object('num', num), 'order_confirmed:'||new.id, interval '10 seconds');
  end if;
  return new;
exception when others then return new;
end $$;
drop trigger if exists gmt_push_order_all on public.gmt_orders;
create trigger gmt_push_order_all after insert or update of status, confirmation on public.gmt_orders for each row execute function public.gmt_push_on_order_all();

-- ② المبيعات والمرتجعات (المبيعات مجمَّعة: إشعار واحد لكلّ فرع كلّ 10 دقائق بعددها)
create or replace function public.gmt_push_on_invoice() returns trigger language plpgsql security definer set search_path = public as $$
declare bn text := coalesce(new.branch_name, new.branch_key);
begin
  if coalesce(new.is_refund, false) then
    perform gmt_push_enqueue('refund', null, 'admin', 'invoices', new.id::text, jsonb_build_object('branch', bn, 'inv', coalesce(new.inv_number, new.invoice_number)), 'refund:'||new.id, interval '30 seconds');
  else
    perform gmt_push_enqueue('sale', null, 'admin', 'invoices', new.id::text, jsonb_build_object('branch', bn, 'n', 1), 'sale:'||coalesce(new.branch_key,'?')||':'||to_char(now(),'YYYYMMDDHH24')||(extract(minute from now())::int / 10), interval '3 minutes');
  end if;
  return new;
exception when others then return new;
end $$;
drop trigger if exists gmt_push_invoice on public.invoices;
create trigger gmt_push_invoice after insert on public.invoices for each row execute function public.gmt_push_on_invoice();

-- ③ النقل: استلام الفاتورة ⇒ الإدارة والفرع المُرسِل
create or replace function public.gmt_push_on_transfer_done() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'received' and old.status is distinct from 'received' then
    perform gmt_push_enqueue('transfer_received', null, 'admin', 'branch_stock_transfers', new.id::text, jsonb_build_object('num', new.transfer_number, 'to', coalesce(new.to_branch_name, new.to_branch)), 'trd:'||new.id, interval '20 seconds');
    if new.from_branch is not null then
      perform gmt_push_enqueue('transfer_received', new.from_branch, 'pos', 'branch_stock_transfers', new.id::text, jsonb_build_object('num', new.transfer_number, 'to', coalesce(new.to_branch_name, new.to_branch)), 'trdp:'||new.id, interval '20 seconds');
    end if;
  end if;
  return new;
exception when others then return new;
end $$;
drop trigger if exists gmt_push_transfer_done on public.branch_stock_transfers;
create trigger gmt_push_transfer_done after update of status on public.branch_stock_transfers for each row execute function public.gmt_push_on_transfer_done();

-- ④ وصول بضاعة (مجمَّع لكلّ فرع كلّ 10 دقائق) · جرد · منتج جديد
create or replace function public.gmt_push_on_stock_in() returns trigger language plpgsql security definer set search_path = public as $$
declare bn text; dk text;
begin
  if coalesce(new.qty,0) <= 0 then return new; end if;
  select display_name into bn from inv_columns where key_name = new.branch_key limit 1;
  dk := ':'||coalesce(new.branch_key,'?')||':'||to_char(now(),'YYYYMMDDHH24')||(extract(minute from now())::int / 10);
  perform gmt_push_enqueue('stock_in', new.branch_key, 'pos', 'stock_receipts', new.id::text, jsonb_build_object('branch', coalesce(bn, new.branch_key), 'n', 1), 'stin'||dk, interval '3 minutes');
  perform gmt_push_enqueue('stock_in', null, 'admin', 'stock_receipts', new.id::text, jsonb_build_object('branch', coalesce(bn, new.branch_key), 'n', 1), 'stina'||dk, interval '3 minutes');
  return new;
exception when others then return new;
end $$;
drop trigger if exists gmt_push_stock_in on public.stock_receipts;
create trigger gmt_push_stock_in after insert on public.stock_receipts for each row execute function public.gmt_push_on_stock_in();

create or replace function public.gmt_push_on_count() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform gmt_push_enqueue('stock_count', null, 'admin', 'stock_counts', new.id::text, jsonb_build_object('branch', coalesce(new.branch_name, new.branch_key), 'short', new.shortages_count, 'surplus', new.surplus_count), 'count:'||new.id, interval '30 seconds');
  return new;
exception when others then return new;
end $$;
drop trigger if exists gmt_push_count on public.stock_counts;
create trigger gmt_push_count after insert on public.stock_counts for each row execute function public.gmt_push_on_count();

create or replace function public.gmt_push_on_product_new() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform gmt_push_enqueue('product_new', null, 'admin', 'products', new.id::text, jsonb_build_object('name', new.name, 'n', 1), 'prodnew:'||to_char(now(),'YYYYMMDDHH24')||(extract(minute from now())::int / 10), interval '3 minutes');
  return new;
exception when others then return new;
end $$;
drop trigger if exists gmt_push_product_new on public.products;
create trigger gmt_push_product_new after insert on public.products for each row execute function public.gmt_push_on_product_new();

-- ⑤ المالية: موافقة المصروف ⇒ الفرع · تحويل نقدي · إقفال يومي · تسوية عمولات
create or replace function public.gmt_push_on_expense_ok() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.approved is true and old.approved is not true and new.branch_key is not null then
    perform gmt_push_enqueue('expense_approved', new.branch_key, 'pos', 'gmt_expenses', new.id::text, '{}'::jsonb, 'expok:'||new.id, interval '15 seconds');
  end if;
  return new;
exception when others then return new;
end $$;
drop trigger if exists gmt_push_expense_ok on public.gmt_expenses;
create trigger gmt_push_expense_ok after update of approved on public.gmt_expenses for each row execute function public.gmt_push_on_expense_ok();

create or replace function public.gmt_push_on_cash() returns trigger language plpgsql security definer set search_path = public as $$
declare bn text;
begin
  select display_name into bn from inv_columns where key_name = new.branch_key limit 1;
  perform gmt_push_enqueue('cash_transfer', null, 'admin', 'branch_cash_transfers', new.id::text, jsonb_build_object('branch', coalesce(bn, new.branch_key)), 'cash:'||new.id, interval '20 seconds');
  return new;
exception when others then return new;
end $$;
drop trigger if exists gmt_push_cash on public.branch_cash_transfers;
create trigger gmt_push_cash after insert on public.branch_cash_transfers for each row execute function public.gmt_push_on_cash();

create or replace function public.gmt_push_on_close() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform gmt_push_enqueue('daily_close', null, 'admin', 'gmt_daily_closes', new.id::text, jsonb_build_object('branch', coalesce(new.branch_name, new.branch_key), 'diff', coalesce(new.variance,0) <> 0), 'close:'||new.id, interval '20 seconds');
  return new;
exception when others then return new;
end $$;
drop trigger if exists gmt_push_close on public.gmt_daily_closes;
create trigger gmt_push_close after insert on public.gmt_daily_closes for each row execute function public.gmt_push_on_close();

create or replace function public.gmt_push_on_settlement() returns trigger language plpgsql security definer set search_path = public as $$
declare bn text;
begin
  select display_name into bn from inv_columns where key_name = new.branch_key limit 1;
  perform gmt_push_enqueue('settlement', null, 'admin', 'gmt_settlements', new.id::text, jsonb_build_object('branch', coalesce(bn, new.branch_key), 'num', new.settlement_no), 'settle:'||new.id, interval '20 seconds');
  return new;
exception when others then return new;
end $$;
drop trigger if exists gmt_push_settlement on public.gmt_settlements;
create trigger gmt_push_settlement after insert on public.gmt_settlements for each row execute function public.gmt_push_on_settlement();

-- ⑥ المتجر والزبائن: طلب محادثة · تقييم · حجز · طلب توظيف · تفعيل كفالة
create or replace function public.gmt_push_on_misc() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'shop_chats' then
    perform gmt_push_enqueue('chat', null, 'orders', 'shop_chats', new.id::text, '{}'::jsonb, 'chat:'||new.id, interval '0');
    perform gmt_push_kick();
  elsif tg_table_name = 'gmt_comments' then
    perform gmt_push_enqueue('review', null, 'admin', 'gmt_comments', new.id::text, jsonb_build_object('rating', new.rating), 'review:'||new.id, interval '30 seconds');
  elsif tg_table_name = 'gmt_reservations' then
    perform gmt_push_enqueue('reservation', null, 'orders', 'gmt_reservations', new.id::text, jsonb_build_object('item', coalesce(new.product_name, new.item)), 'resv:'||new.id, interval '20 seconds');
  elsif tg_table_name = 'gmt_job_applications' then
    perform gmt_push_enqueue('job', null, 'admin', 'gmt_job_applications', new.id::text, '{}'::jsonb, 'job:'||new.id, interval '30 seconds');
  end if;
  return new;
exception when others then return new;
end $$;
drop trigger if exists gmt_push_chat on public.shop_chats;
create trigger gmt_push_chat after insert on public.shop_chats for each row execute function public.gmt_push_on_misc();
drop trigger if exists gmt_push_review on public.gmt_comments;
create trigger gmt_push_review after insert on public.gmt_comments for each row execute function public.gmt_push_on_misc();
drop trigger if exists gmt_push_resv on public.gmt_reservations;
create trigger gmt_push_resv after insert on public.gmt_reservations for each row execute function public.gmt_push_on_misc();
drop trigger if exists gmt_push_job on public.gmt_job_applications;
create trigger gmt_push_job after insert on public.gmt_job_applications for each row execute function public.gmt_push_on_misc();

create or replace function public.gmt_push_on_warranty() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.activated is true and old.activated is not true then
    perform gmt_push_enqueue('warranty_on', null, 'admin', 'warranties', new.id::text, jsonb_build_object('num', new.warranty_number), 'war:'||new.id, interval '30 seconds');
  end if;
  return new;
exception when others then return new;
end $$;
drop trigger if exists gmt_push_warranty on public.warranties;
create trigger gmt_push_warranty after update of activated on public.warranties for each row execute function public.gmt_push_on_warranty();
