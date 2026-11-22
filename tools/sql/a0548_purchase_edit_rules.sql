-- TASK-A0548 (المالك seq 936 «حط شروط صارمة لموضوع فواتير الشراء: تعديلاتها والسجل تبعها»)
-- قواعد فواتير الشراء (import_log) — تُفرَض في القاعدة نفسها فلا تتجاوزها أيّ صفحة أو نسخةٍ قديمة:
--   ١) أيّ تغييرٍ في كمية/سعر شراء بند · إضافة/حذف بند · المجموع · الرقم · المورّد · التاريخ · النوع · العملة ⇒ يُرفض بلا «سبب» مكتوب.
--   ٢) حذف فاتورة ⇒ يُرفض بلا سبب، ويُرفض نهائياً إن كانت مُرحَّلة للمخزون (فكّ الختم أوّلاً).
--   ٣) رقم فاتورة مكرَّر ⇒ يُرفض عند الإنشاء أو تغيير الرقم (القديم المكرَّر يبقى حتى يقرّر المالك).
--   ٤) كلّ تغيير (مهما كان) يُسجَّل في import_log_history: النسخة قبل التعديل + من (x-gmt-actor) + الصفحة + السبب + الفروق.
-- الصفحات ترسل «من» و«السبب» في ترويسات الطلب (gmt-core.js) · من SQL مباشرة: set local gmt.reason = '…'; set local gmt.actor = '…';

alter table public.import_log_history add column if not exists actor text;
alter table public.import_log_history add column if not exists page text;
alter table public.import_log_history add column if not exists reason text;
alter table public.import_log_history add column if not exists diff jsonb;

-- القراءة للصفحات (زرّ «🕘 سجل التعديلات») — الكتابة من المشغّل وحده
drop policy if exists import_log_history_read on public.import_log_history;
create policy import_log_history_read on public.import_log_history for select using (true);

create or replace function public.gmt_urldecode(p text) returns text
language plpgsql immutable as $$
declare r bytea := ''::bytea; i int := 1; n int; c text;
begin
  if p is null then return null; end if;
  n := length(p);
  while i <= n loop
    c := substr(p, i, 1);
    if c = '%' and i + 2 <= n and substr(p, i + 1, 2) ~ '^[0-9A-Fa-f]{2}$' then
      r := r || decode(substr(p, i + 1, 2), 'hex'); i := i + 3;
    else
      r := r || convert_to(c, 'UTF8'); i := i + 1;
    end if;
  end loop;
  return convert_from(r, 'UTF8');
exception when others then return p;
end $$;

create or replace function public.gmt_req_hdr(p_name text) returns text
language plpgsql stable as $$
declare h text := current_setting('request.headers', true);
begin
  if h is null or h = '' then return null; end if;
  return nullif(btrim(public.gmt_urldecode((h::json) ->> p_name)), '');
exception when others then return null;
end $$;

create or replace function public.gmt_num(t text) returns numeric
language sql immutable as $$
  select case when t ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$' then t::numeric else 0 end
$$;

-- الفروق بين نسختين من الفاتورة ⇒ {sensitive, changes:[…]}
create or replace function public.gmt_purchase_diff(o jsonb, n jsonb) returns jsonb
language plpgsql immutable as $$
declare
  oa jsonb := coalesce(o -> 'items_snapshot', '[]'::jsonb);
  na jsonb := coalesce(n -> 'items_snapshot', '[]'::jsonb);
  res jsonb := '[]'::jsonb; sens boolean := false; k text; i int; a jsonb; b jsonb; x record;
begin
  if jsonb_typeof(oa) <> 'array' then oa := '[]'::jsonb; end if;
  if jsonb_typeof(na) <> 'array' then na := '[]'::jsonb; end if;
  -- رأس الفاتورة
  for k in select distinct key from (select jsonb_object_keys(o) key union select jsonb_object_keys(n)) z
           where key not in ('items_snapshot', 'updated_at') loop
    if (o -> k) is distinct from (n -> k) then
      res := res || jsonb_build_array(jsonb_build_object('f', k, 'from', o -> k, 'to', n -> k));
      if k in ('inv_number', 'supplier', 'inv_date', 'inv_type', 'currency') then sens := true; end if;
      if k = 'total_amount' and public.gmt_num(o ->> k) <> public.gmt_num(n ->> k) then sens := true; end if;
    end if;
  end loop;
  -- البنود: نفس العدد ⇒ مقارنةٌ بالموضع (الربط بمنتج يغيّر id/الاسم فقط فلا يُعدّ حسّاساً)
  if jsonb_array_length(oa) = jsonb_array_length(na) then
    for i in 0 .. jsonb_array_length(na) - 1 loop
      a := oa -> i; b := na -> i;
      if public.gmt_num(a ->> 'qty') <> public.gmt_num(b ->> 'qty') then
        sens := true; res := res || jsonb_build_array(jsonb_build_object('line', b ->> 'name', 'f', 'qty', 'from', a -> 'qty', 'to', b -> 'qty'));
      end if;
      if public.gmt_num(a ->> 'unit_price') <> public.gmt_num(b ->> 'unit_price') then
        sens := true; res := res || jsonb_build_array(jsonb_build_object('line', b ->> 'name', 'f', 'unit_price', 'from', a -> 'unit_price', 'to', b -> 'unit_price'));
      end if;
      if (a ->> 'id') is distinct from (b ->> 'id') or (a ->> 'name') is distinct from (b ->> 'name') then
        res := res || jsonb_build_array(jsonb_build_object('line', b ->> 'name', 'f', 'link', 'from', coalesce(a ->> 'name', '') || ' #' || coalesce(a ->> 'id', '—'), 'to', coalesce(b ->> 'name', '') || ' #' || coalesce(b ->> 'id', '—')));
      end if;
    end loop;
  else
    sens := true;
    for x in
      with oo as (select e, coalesce(e ->> 'id', e ->> 'name') k, row_number() over (partition by coalesce(e ->> 'id', e ->> 'name') order by ord) r
                  from jsonb_array_elements(oa) with ordinality t(e, ord)),
           nn as (select e, coalesce(e ->> 'id', e ->> 'name') k, row_number() over (partition by coalesce(e ->> 'id', e ->> 'name') order by ord) r
                  from jsonb_array_elements(na) with ordinality t(e, ord))
      select oo.e oe, nn.e ne from oo full join nn on oo.k = nn.k and oo.r = nn.r
    loop
      if x.oe is null then
        res := res || jsonb_build_array(jsonb_build_object('line', x.ne ->> 'name', 'f', 'added', 'to', jsonb_build_object('qty', x.ne -> 'qty', 'unit_price', x.ne -> 'unit_price')));
      elsif x.ne is null then
        res := res || jsonb_build_array(jsonb_build_object('line', x.oe ->> 'name', 'f', 'removed', 'from', jsonb_build_object('qty', x.oe -> 'qty', 'unit_price', x.oe -> 'unit_price')));
      else
        if public.gmt_num(x.oe ->> 'qty') <> public.gmt_num(x.ne ->> 'qty') then
          res := res || jsonb_build_array(jsonb_build_object('line', x.ne ->> 'name', 'f', 'qty', 'from', x.oe -> 'qty', 'to', x.ne -> 'qty'));
        end if;
        if public.gmt_num(x.oe ->> 'unit_price') <> public.gmt_num(x.ne ->> 'unit_price') then
          res := res || jsonb_build_array(jsonb_build_object('line', x.ne ->> 'name', 'f', 'unit_price', 'from', x.oe -> 'unit_price', 'to', x.ne -> 'unit_price'));
        end if;
      end if;
    end loop;
  end if;
  return jsonb_build_object('sensitive', sens, 'changes', res);
end $$;

create or replace function public.import_log_guard() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare v_actor text; v_page text; v_reason text; v_d jsonb; v_direct boolean;
begin
  v_direct := coalesce(current_setting('request.headers', true), '') = '';
  v_actor  := coalesce(public.gmt_req_hdr('x-gmt-actor'), nullif(current_setting('gmt.actor', true), ''), case when v_direct then 'SQL مباشر' else 'غير معروف (صفحة بلا تعريف)' end);
  v_page   := coalesce(public.gmt_req_hdr('x-gmt-page'), nullif(current_setting('gmt.page', true), ''));
  v_reason := coalesce(public.gmt_req_hdr('x-gmt-reason'), nullif(btrim(current_setting('gmt.reason', true)), ''));

  if tg_op = 'INSERT' then
    if new.inv_number ~ '[0-9]' and exists (select 1 from import_log where inv_number = new.inv_number) then
      raise exception 'GMT_DUP_INV_NUMBER: رقم فاتورة الشراء % مستخدَم لفاتورةٍ أخرى — لا يُكرَّر رقم فاتورة', new.inv_number using errcode = 'P0001';
    end if;
    insert into import_log_history (row_id, op, old_row, actor, page, reason, diff)
    values (new.id, 'INSERT', to_jsonb(new), v_actor, v_page, v_reason, null);
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.inv_number is distinct from old.inv_number and new.inv_number ~ '[0-9]'
       and exists (select 1 from import_log where inv_number = new.inv_number and id <> new.id) then
      raise exception 'GMT_DUP_INV_NUMBER: رقم فاتورة الشراء % مستخدَم لفاتورةٍ أخرى — لا يُكرَّر رقم فاتورة', new.inv_number using errcode = 'P0001';
    end if;
    if to_jsonb(old) - 'updated_at' is not distinct from to_jsonb(new) - 'updated_at' then return new; end if;
    v_d := public.gmt_purchase_diff(to_jsonb(old), to_jsonb(new));
    if (v_d ->> 'sensitive')::boolean and v_reason is null then
      raise exception 'GMT_REASON_REQUIRED: تعديل كميات أو أسعار أو بنود أو مجموع فاتورة الشراء % يحتاج سبباً مكتوباً — يُحفظ في سجلّها', coalesce(old.inv_number, '#' || old.id) using errcode = 'P0001';
    end if;
    insert into import_log_history (row_id, op, old_row, actor, page, reason, diff)
    values (old.id, 'UPDATE', to_jsonb(old), v_actor, v_page, v_reason, v_d -> 'changes');
    return new;
  end if;

  -- DELETE
  if coalesce(old.transferred, false) then
    raise exception 'GMT_DELETE_TRANSFERRED: فاتورة الشراء % مُرحَّلة للمخزون — لا تُحذف (فُكّ الختم أوّلاً بسببٍ مسجَّل)', coalesce(old.inv_number, '#' || old.id) using errcode = 'P0001';
  end if;
  if v_reason is null then
    raise exception 'GMT_REASON_REQUIRED: حذف فاتورة الشراء % يحتاج سبباً مكتوباً — يُحفظ في سجلّها', coalesce(old.inv_number, '#' || old.id) using errcode = 'P0001';
  end if;
  insert into import_log_history (row_id, op, old_row, actor, page, reason, diff)
  values (old.id, 'DELETE', to_jsonb(old), v_actor, v_page, v_reason, null);
  return old;
end $$;

-- المشغّل القديم (AFTER · نسخة فقط بلا «من/لماذا») يُستبدَل بالحارس (BEFORE · يرفض ويسجّل)
drop trigger if exists trg_import_log_history on public.import_log;
drop trigger if exists trg_import_log_guard on public.import_log;
create trigger trg_import_log_guard before insert or update or delete on public.import_log
  for each row execute function public.import_log_guard();
