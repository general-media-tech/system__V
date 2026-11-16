-- TASK-A0525 · الخطوة ٢: نسخ بيانات الكفالات من المشروع القديم إلى القاعدة الرئيسية (بعد warranty_move_to_main.sql).
-- يقرأ من داخل القاعدة الرئيسية عبر http بمفتاح المشروع القديم المحفوظ في gmt_keepalive_targets (لا مفتاح في هذا الملف).
-- آمن للتكرار: on conflict do nothing. لا يحذف من المشروع القديم شيئاً.
do $$
declare
  k text; base text := 'https://abppuwylukzpqckazegk.supabase.co/rest/v1/';
  resp extensions.http_response; j jsonb; t text;
begin
  select key into k from public.gmt_keepalive_targets where project = 'abppuwylukzpqckazegk';
  if k is null then raise exception 'مفتاح المشروع القديم غير موجود'; end if;
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '60');

  foreach t in array array['activation_logs', 'warranties', 'contracts', 'warranty_claims'] loop
    select * into resp from extensions.http(('GET', base || t || '?select=*&order=id', array[
      extensions.http_header('apikey', k), extensions.http_header('Authorization', 'Bearer ' || k)], null, null)::extensions.http_request);
    if resp.status <> 200 then raise exception '% ⇐ HTTP %', t, resp.status; end if;
    j := coalesce(resp.content::jsonb, '[]'::jsonb);

    if t = 'activation_logs' then
      insert into public.activation_logs select * from jsonb_populate_recordset(null::public.activation_logs, j) on conflict (id) do nothing;
      -- قبل إضافة سجلّات الأدلّة أدناه ⇒ لا تصطدم أرقامها بالأرقام المنسوخة
      perform setval(pg_get_serial_sequence('public.activation_logs', 'id'), greatest(coalesce((select max(id) from public.activation_logs), 0), 1));
    elsif t = 'warranties' then
      insert into public.warranties select * from jsonb_populate_recordset(null::public.warranties, j) on conflict (short_id) do nothing;
      -- كفالة مفعَّلة بلا سجلّ تفعيل ⇒ يُحفظ دليلها (التوقيع · IP · الجهاز) من صفّها القديم في السجلّ، لا يضيع
      insert into public.activation_logs (short_id, customer_name, product_name, serial_no, invoice_no, warranty_type, activation_status,
        activation_date, activation_time, customer_typed_name, signature_base64, agreement_accepted, receipt_accepted, signature_accepted,
        ip_address, user_agent, browser_name, browser_version, operating_system, device_type, language, timezone, screen_width, screen_height,
        referrer, first_visit_date, first_visit_time, activation_version, activation_method, logged_at, biometric_verified, biometric_credential_id)
      select r.short_id, r.customer_name, r.product_name, r.serial_no, r.invoice_no, r.warranty_type, r.activation_status,
        r.activation_date, r.activation_time, r.customer_typed_name, r.signature_base64, r.agreement_accepted, r.receipt_accepted, r.signature_accepted,
        r.ip_address, r.user_agent, r.browser_name, r.browser_version, r.operating_system, r.device_type, r.language, r.timezone, r.screen_width, r.screen_height,
        r.referrer, r.first_visit_date, r.first_visit_time, r.activation_version, coalesce(r.activation_method, 'Website') || ' · نُقل من صفّ الكفالة', coalesce(r.updated_at, r.created_at),
        r.biometric_verified, r.biometric_credential_id
      from jsonb_to_recordset(j) as r(short_id text, customer_name text, product_name text, serial_no text, invoice_no text, warranty_type text,
        activation_status text, activation_date date, activation_time text, customer_typed_name text, signature_base64 text, agreement_accepted boolean,
        receipt_accepted boolean, signature_accepted boolean, ip_address text, user_agent text, browser_name text, browser_version text,
        operating_system text, device_type text, language text, timezone text, screen_width int, screen_height int, referrer text,
        first_visit_date date, first_visit_time text, activation_version int, activation_method text, created_at timestamptz, updated_at timestamptz,
        biometric_verified boolean, biometric_credential_id text)
      where r.activation_status = 'activated'
        and not exists (select 1 from public.activation_logs l where l.short_id = r.short_id);
    elsif t = 'contracts' then
      insert into public.contracts select * from jsonb_populate_recordset(null::public.contracts, j) on conflict (id) do nothing;
    else
      insert into public.warranty_claims select * from jsonb_populate_recordset(null::public.warranty_claims, j) on conflict (id) do nothing;
    end if;
  end loop;

  -- العدّاد التلقائي بعد الأرقام المنسوخة
  perform setval(pg_get_serial_sequence('public.warranties', 'id'), greatest(coalesce((select max(id) from public.warranties), 0), 1));
  perform setval(pg_get_serial_sequence('public.contracts', 'id'), greatest(coalesce((select max(id) from public.contracts), 0), 1));
  perform setval(pg_get_serial_sequence('public.warranty_claims', 'id'), greatest(coalesce((select max(id) from public.warranty_claims), 0), 1));
end $$;

select (select count(*) from public.warranties) warranties, (select count(*) from public.activation_logs) logs,
       (select count(*) from public.contracts) contracts, (select count(*) from public.warranty_claims) claims;
