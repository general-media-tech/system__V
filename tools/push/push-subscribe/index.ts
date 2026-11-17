// (TASK-B0420 · المهمّة ٣) push-subscribe — تسجيل أجهزة الإشعارات والتحقّق منها. لا أسرار هنا: المفاتيح في جدول push_config (service_role فقط).
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { validEndpoint } from './push_logic.mjs';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const j = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const fail = (err: string, msg: string, s = 400) => j({ ok: false, err, msg }, s);
const B64U = /^[A-Za-z0-9_-]+$/;
const TOPICS = ['pos', 'orders', 'admin'];
const b64u = (u: Uint8Array) => btoa(String.fromCharCode(...u)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function cfg(k: string) { const { data } = await sb.from('push_config').select('v').eq('k', k).maybeSingle(); return data?.v ?? null; }
async function vapid() {
  let pub = await cfg('vapid_public'), priv = await cfg('vapid_private');
  if (!pub || !priv) {   // أوّل نداء: نولّد المفاتيح ونحفظها (لا تظهر لأحد — الجدول مقفل أمام anon)
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
    const raw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
    await sb.from('push_config').upsert([{ k: 'vapid_public', v: b64u(raw) }, { k: 'vapid_private', v: jwk.d as string }], { onConflict: 'k', ignoreDuplicates: true });
    pub = await cfg('vapid_public'); priv = await cfg('vapid_private');
  }
  return { pub: pub!, priv: priv! };
}
async function siteUrl() { const { data } = await sb.from('gmt_settings').select('value').eq('key', 'push_site_url').maybeSingle(); return (data?.value || 'https://general-media-tech.github.io/system__V').replace(/\/?$/, '/'); }
async function rateOk(ip: string, uid: string | null) {
  const since = new Date(Date.now() - 3600000).toISOString();
  await sb.from('push_rate').insert([{ k: 'ip:' + ip }].concat(uid ? [{ k: 'u:' + uid }] : []));
  const a = await sb.from('push_rate').select('*', { count: 'exact', head: true }).eq('k', 'ip:' + ip).gte('at', since);
  if ((a.count || 0) > 20) return false;
  if (uid) { const b = await sb.from('push_rate').select('*', { count: 'exact', head: true }).eq('k', 'u:' + uid).gte('at', since); if ((b.count || 0) > 10) return false; }
  return true;
}
async function isAdmin(u: any) {
  if (u && /admin|owner|مدير|أدمن/i.test(String(u.role || ''))) return true;
  const { data } = await sb.from('gmt_settings').select('value').eq('key', 'push_admin_users').maybeSingle();
  return String(data?.value || '').split(',').map((s) => s.trim()).filter(Boolean).indexOf(String(u?.id)) !== -1;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return fail('method', 'طريقة غير مدعومة', 405);
  let body: any;
  try { const t = await req.text(); if (t.length > 4096) return fail('size', 'الطلب كبير', 413); body = JSON.parse(t); } catch (_) { return fail('json', 'طلب غير صالح'); }
  const act = String(body.action || '');
  if (act === 'key') { const v = await vapid(); return j({ ok: true, key: v.pub }); }

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'na';
  const uidRaw = body.user_id ? String(body.user_id) : null;
  if (!(await rateOk(ip, uidRaw))) return fail('rate', 'محاولات كثيرة — حاول بعد قليل', 429);

  const ep = body.sub?.endpoint || body.endpoint, auth = body.sub?.keys?.auth || body.auth;
  if (act === 'subscribe') {
    const s = body.sub || {}, k = s.keys || {};
    if (!validEndpoint(s.endpoint)) return fail('endpoint', 'عنوان الإشعارات غير مقبول');
    if (typeof k.p256dh !== 'string' || k.p256dh.length !== 87 || !B64U.test(k.p256dh) || typeof k.auth !== 'string' || k.auth.length !== 22 || !B64U.test(k.auth)) return fail('keys', 'مفاتيح الاشتراك غير صالحة');
    // جهاز المالك/الأدمن: لا حساب له في gmt_users (الأدمن وضعٌ في الواجهة) ⇒ ادّعاءٌ مقيَّد: موضوعا pos/orders فقط (نصوصهما شبه علنيّة) وسقف 10 أجهزة — موضوع admin يبقى لمن في gmt_users/push_admin_users
    const adminClaim = body.claim === 'admin' && !uidRaw;
    let u: any = null;
    if (adminClaim) {
      const { count } = await sb.from('push_subscriptions').select('*', { count: 'exact', head: true }).eq('user_id', 'admin').is('disabled_at', null).neq('endpoint', s.endpoint);
      if ((count || 0) >= 10) return fail('limit', 'عدد أجهزة الأدمن بلغ الحدّ', 403);
      u = { id: 'admin', username: 'admin', branch_key: null };
    } else {
      const r = await sb.from('gmt_users').select('id,username,branch_key,is_active,role,approved').eq('id', uidRaw || '00000000-0000-0000-0000-000000000000').maybeSingle(); u = r.data;
      if (!u || u.is_active === false || u.approved === false) return fail('user', 'المستخدم غير معروف أو غير مفعّل', 403);
    }
    const topics = (Array.isArray(body.topics) ? body.topics : ['pos']).filter((t: string) => TOPICS.indexOf(t) !== -1 && !(adminClaim && t === 'admin'));
    if (!topics.length) return fail('topics', 'لا موضوع صالح');
    let branch = body.branch_key ? String(body.branch_key) : null;
    if (topics.indexOf('pos') !== -1) {
      const { data: b } = await sb.from('inv_columns').select('key_name').eq('is_branch', true).eq('key_name', branch || '');
      if (!b || !b.length) return fail('branch', 'فرع غير معروف', 403);
      if (u.branch_key && u.branch_key !== branch) return fail('branch', 'الفرع لا يطابق حساب المستخدم', 403);
    }
    if (topics.indexOf('admin') !== -1 && !(await isAdmin(u))) return fail('admin', 'غير مخوّل لإشعارات الإدارة', 403);
    const prefs = typeof body.prefs === 'object' && body.prefs ? body.prefs : {};
    const row = { endpoint: s.endpoint, p256dh: k.p256dh, auth: k.auth, user_id: String(u.id), username: u.username, branch_key: branch, topics, prefs,
      platform: String(body.platform || '').slice(0, 20), ua: String(req.headers.get('user-agent') || '').slice(0, 120), last_seen_at: new Date().toISOString(), disabled_at: null, disabled_reason: null, fail_count: 0 };
    const up = await sb.from('push_subscriptions').upsert(row, { onConflict: 'endpoint' });
    if (up.error) return fail('db', 'تعذّر الحفظ', 500);
    const { data: mine } = await sb.from('push_subscriptions').select('id,last_seen_at').eq('user_id', String(u.id)).is('disabled_at', null).order('last_seen_at', { ascending: false });
    if (mine && mine.length > 10) await sb.from('push_subscriptions').update({ disabled_at: new Date().toISOString(), disabled_reason: 'limit' }).in('id', mine.slice(10).map((x: any) => x.id));
    return j({ ok: true });
  }
  if (['prefs', 'unsubscribe', 'test'].indexOf(act) === -1) return fail('action', 'إجراء غير معروف');
  if (!validEndpoint(ep) || !auth) return fail('proof', 'إثبات الجهاز ناقص', 403);
  const { data: sub } = await sb.from('push_subscriptions').select('*').eq('endpoint', ep).eq('auth', auth).maybeSingle();
  if (!sub) return fail('none', 'الجهاز غير مسجّل', 403);
  if (act === 'unsubscribe') { await sb.from('push_subscriptions').update({ disabled_at: new Date().toISOString(), disabled_reason: 'user' }).eq('id', sub.id); return j({ ok: true }); }
  if (act === 'prefs') { const p = typeof body.prefs === 'object' && body.prefs ? body.prefs : {}; await sb.from('push_subscriptions').update({ prefs: { ...(sub.prefs || {}), ...p }, last_seen_at: new Date().toISOString() }).eq('id', sub.id); return j({ ok: true }); }
  // test — لهذا الجهاز فقط، ≤ 3/ساعة
  const since = new Date(Date.now() - 3600000).toISOString();
  const c = await sb.from('push_rate').select('*', { count: 'exact', head: true }).eq('k', 'test:' + sub.id).gte('at', since);
  if ((c.count || 0) >= 3) return fail('rate', 'تجارب كثيرة — حاول بعد ساعة', 429);
  await sb.from('push_rate').insert({ k: 'test:' + sub.id });
  try {
    const v = await vapid();
    webpush.setVapidDetails(await siteUrl(), v.pub, v.priv);
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify({ t: '✅ الإشعارات تعمل', b: 'تمّ تفعيل الإشعارات على هذا الجهاز', u: './home.html', k: 'test', tag: 'test' }), { TTL: 600, urgency: 'high' });
    return j({ ok: true });
  } catch (e: any) { return fail('send', 'تعذّر إرسال إشعار التجربة (' + (e?.statusCode || 'خطأ') + ')', 502); }
});
