// مركز الإشعارات — المرحلة ٦: إشعارات العملاء برقم الطلب (المالك seq 803 §رابعاً و§ثامناً · seq 814)
// بلا حسابات للعملاء: الزبون يفعّل الإشعارات من صفحة التتبّع لطلبه هو فقط، بإثبات رقم جواله المسجَّل في الطلب.
// يرى سجلّ إشعارات طلبه وحده. الموظّف (جهاز موثَّق في صندوق الإشعارات) يرسل رسالة مخصّصة مربوطة بالطلب.
// الإرسال: مهمّة كل 30 ث (gmt_customer_kick) بسرّ داخلي. لا اسم ولا عنوان ولا مبلغ في أيّ إشعار.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-push-secret', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const j = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const fail = (err: string, msg: string, s = 400) => j({ ok: false, err, msg }, s);
const B64U = /^[A-Za-z0-9_-]+$/;
const HOSTS = ['fcm.googleapis.com', 'web.push.apple.com', 'updates.push.services.mozilla.com'];
function validEndpoint(url: unknown) {
  try { if (typeof url !== 'string' || url.length > 1000) return false; const u = new URL(url); if (u.protocol !== 'https:') return false;
    const h = u.hostname.toLowerCase(); return HOSTS.indexOf(h) !== -1 || h.endsWith('.notify.windows.com') || h.endsWith('.push.apple.com'); } catch (_) { return false; }
}
const digits = (p: unknown) => String(p ?? '').replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x6F0)).replace(/\D/g, '');
const last9 = (p: unknown) => digits(p).slice(-9);
const eqs = (a: string, b: string) => { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };
async function cfg(k: string) { const { data } = await sb.from('push_config').select('v').eq('k', k).maybeSingle(); return data?.v ?? null; }
async function sha(s: string) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))).map((b) => b.toString(16).padStart(2, '0')).join(''); }
async function rateOk(k: string, max: number) {
  await sb.from('push_rate').insert({ k });
  const { count } = await sb.from('push_rate').select('*', { count: 'exact', head: true }).eq('k', k).gte('at', new Date(Date.now() - 3600000).toISOString());
  return (count || 0) <= max;
}
/* إثبات الطلب: رقمه الداخلي + آخر 9 أرقام من جوال الطلب */
async function orderFor(id: unknown, phone: unknown) {
  if (!/^\d{1,12}$/.test(String(id ?? ''))) return null;
  const p = last9(phone); if (p.length !== 9) return null;
  const { data: o } = await sb.from('gmt_orders').select('id,phone,serial_code,order_number,status').eq('id', Number(id)).maybeSingle();
  return o && last9(o.phone) === p ? o : null;
}
function msgFor(kind: string, d: any) {
  const num = d.num || '';
  if (kind === 'confirmed') return { t: '✅ تمّ تأكيد طلبك', b: 'طلبك ' + num + ' قيد التجهيز الآن — شكراً لثقتك' };
  if (kind === 'shipped') return { t: '🚚 شُحن طلبك', b: num + (d.company ? ' مع ' + d.company : '') + (d.tracking ? ' — رقم التتبّع ' + d.tracking : '') };
  if (kind === 'delivered') return { t: '📬 وصل طلبك', b: 'طلبك ' + num + ' وصل — بانتظار استلامك' };
  if (kind === 'msg') return { t: '💬 رسالة بخصوص طلبك ' + num, b: String(d.text || '').slice(0, 300) };
  return { t: 'General Media Tech', b: num };
}
async function sendJob() {
  const pub = await cfg('vapid_public'), priv = await cfg('vapid_private'); if (!pub || !priv) return { ok: false, err: 'no vapid' };
  const { data: s } = await sb.from('gmt_settings').select('value').eq('key', 'push_site_url').maybeSingle();
  const site = String(s?.value || 'https://general-media-tech.github.io/system__V').replace(/\/?$/, '/');
  webpush.setVapidDetails(site, pub, priv);
  const { data: evs } = await sb.from('gmt_customer_events').select('*').eq('status', 'pending').order('id').limit(100);
  let sent = 0, failed = 0;
  for (const e of evs || []) {
    const { data: subs } = await sb.from('gmt_customer_push').select('*').eq('order_id', e.order_id).is('disabled_at', null);
    const m = msgFor(e.kind, e.data || {}); let es = 0, ef = 0;
    const payload = JSON.stringify({ t: m.t, b: m.b, u: './track_order.html?q=' + encodeURIComponent(e.data?.num || ''), k: 'cust_' + e.kind, tag: 'order-' + e.order_id });
    for (const sub of subs || []) {
      try { await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: 172800, urgency: 'high' }); es++; sent++;
        await sb.from('gmt_customer_push').update({ last_sent_at: new Date().toISOString(), fail_count: 0 }).eq('id', sub.id);
      } catch (er: any) { ef++; failed++; const sc = er?.statusCode, fc = (sub.fail_count || 0) + 1;
        await sb.from('gmt_customer_push').update(sc === 404 || sc === 410 || fc >= 5 ? { disabled_at: new Date().toISOString(), fail_count: fc } : { fail_count: fc }).eq('id', sub.id); }
    }
    await sb.from('gmt_customer_events').update({ status: 'sent', sent_at: new Date().toISOString(), result: { targets: (subs || []).length, sent: es, failed: ef } }).eq('id', e.id);
  }
  return { ok: true, events: (evs || []).length, sent, failed };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return fail('method', 'طريقة غير مدعومة', 405);
  let b: any; try { const t = await req.text(); if (t.length > 6000) return fail('size', 'الطلب كبير', 413); b = JSON.parse(t || '{}'); } catch (_) { return fail('json', 'طلب غير صالح'); }
  if (b.job === 'send') {
    const sec = (await cfg('cron_secret')) || '';
    if (!sec || !eqs(req.headers.get('x-push-secret') || '', sec)) return fail('unauthorized', 'غير مخوّل', 401);
    return j(await sendJob());
  }
  const act = String(b.action || ''), ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'na';
  if (act === 'key') { const k = await cfg('vapid_public'); return k ? j({ ok: true, key: k }) : fail('nokey', 'الإشعارات غير جاهزة'); }
  if (act === 'subscribe' || act === 'feed') {
    if (!(await rateOk('cust:' + ip, 40))) return fail('rate', 'محاولات كثيرة — حاول بعد قليل', 429);
    const o = await orderFor(b.order_id, b.phone);
    if (!o) return fail('proof', 'رقم الجوال لا يطابق الرقم المسجَّل في هذا الطلب', 403);
    if (act === 'feed') {
      const { data: evs } = await sb.from('gmt_customer_events').select('kind,data,created_at').eq('order_id', String(o.id)).order('id', { ascending: false }).limit(30);
      return j({ ok: true, items: (evs || []).map((e: any) => ({ ...msgFor(e.kind, e.data || {}), k: e.kind, at: e.created_at })) });
    }
    const s = b.sub || {}, k = s.keys || {};
    if (!validEndpoint(s.endpoint)) return fail('endpoint', 'عنوان الإشعارات غير مقبول');
    if (typeof k.p256dh !== 'string' || k.p256dh.length !== 87 || !B64U.test(k.p256dh) || typeof k.auth !== 'string' || k.auth.length !== 22 || !B64U.test(k.auth)) return fail('keys', 'مفاتيح الاشتراك غير صالحة');
    const { error } = await sb.from('gmt_customer_push').upsert({ endpoint: s.endpoint, p256dh: k.p256dh, auth: k.auth, order_id: String(o.id), disabled_at: null, fail_count: 0 }, { onConflict: 'endpoint' });
    return error ? fail('db', 'تعذّر الحفظ', 500) : j({ ok: true });
  }
  if (act === 'unsubscribe') {
    if (!validEndpoint(b.endpoint) || typeof b.auth !== 'string') return fail('proof', 'إثبات الجهاز ناقص', 403);
    await sb.from('gmt_customer_push').update({ disabled_at: new Date().toISOString() }).eq('endpoint', b.endpoint).eq('auth', b.auth);
    return j({ ok: true });
  }
  if (act === 'staff_msg') {
    /* الموظّف: جهازٌ موثَّق في صندوق الإشعارات (رمز notify-inbox) */
    if (typeof b.token !== 'string' || !/^[0-9a-f]{64}$/.test(b.token)) return fail('token', 'الجهاز غير موثَّق', 401);
    const { data: dev } = await sb.from('gmt_notify_devices').select('id,name').eq('token_hash', await sha('inbox|' + b.token)).is('revoked_at', null).maybeSingle();
    if (!dev) return fail('token', 'الجهاز غير موثَّق', 401);
    const text = String(b.text || '').trim().slice(0, 300); if (text.length < 2) return fail('text', 'اكتب الرسالة');
    const { data: o } = await sb.from('gmt_orders').select('id,serial_code,order_number').eq('id', Number(b.order_id) || 0).maybeSingle();
    if (!o) return fail('order', 'الطلب غير موجود');
    const { count } = await sb.from('gmt_customer_push').select('*', { count: 'exact', head: true }).eq('order_id', String(o.id)).is('disabled_at', null);
    await sb.from('gmt_customer_events').insert({ order_id: String(o.id), kind: 'msg', by_name: dev.name || null, data: { num: o.serial_code || o.order_number || String(o.id), text } });
    return j({ ok: true, devices: count || 0 });
  }
  return fail('action', 'إجراء غير معروف');
});
