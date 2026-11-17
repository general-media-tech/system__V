// مركز الإشعارات — صندوق الوارد (المالك seq 803/808 · TASK-B0424)
// كل جهاز يُوثَّق مرّةً بكلمة السرّ (موظّف: gmt_pw_check · أدمن: بصمة PBKDF2 في admin_accounts) أو باشتراك الإشعارات القائم،
// فيأخذ رمزاً عشوائياً يُحفظ مُجزّأً فقط. بعدها يقرأ صندوق صاحبه وحده — لا يصل أحدٌ لإشعارات غيره.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { validEndpoint, buildMessage, scrub } from './push_logic.mjs';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const j = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const fail = (err: string, msg: string, s = 400) => j({ ok: false, err, msg }, s);
const hex = (u: Uint8Array) => Array.from(u).map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (h: string) => new Uint8Array((h.match(/../g) || []).map((x) => parseInt(x, 16)));
async function sha(s: string) { return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))); }
async function pbkdf2(pw: string, saltHex: string, iters: number) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  return hex(new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations: iters }, key, 256)));
}
const normName = (x: string) => String(x ?? '').normalize('NFKC').replace(/[ً-ٟـ]/g, '').replace(/\s+/g, '').toLowerCase();
function same(a: string, b: string) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }

async function rateOk(k: string, max: number) {
  const since = new Date(Date.now() - 3600000).toISOString();
  await sb.from('push_rate').insert({ k });
  const { count } = await sb.from('push_rate').select('*', { count: 'exact', head: true }).eq('k', k).gte('at', since);
  return (count || 0) <= max;
}
async function issue(recipient: string, user_id: string | null, branch_key: string | null, name: string, via: string) {
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  const { error } = await sb.from('gmt_notify_devices').insert({ token_hash: await sha('inbox|' + token), recipient, user_id, branch_key, name, via });
  if (error) return fail('db', 'تعذّر حفظ الجهاز', 500);
  return j({ ok: true, token, recipient, name });
}
async function me(token: unknown) {
  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) return null;
  const { data } = await sb.from('gmt_notify_devices').select('*').eq('token_hash', await sha('inbox|' + token)).is('revoked_at', null).maybeSingle();
  if (!data) return null;
  if (Date.now() - new Date(data.last_seen_at).getTime() > 3600000) await sb.from('gmt_notify_devices').update({ last_seen_at: new Date().toISOString() }).eq('id', data.id);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return fail('method', 'طريقة غير مدعومة', 405);
  let b: any;
  try { const t = await req.text(); if (t.length > 8192) return fail('size', 'الطلب كبير', 413); b = JSON.parse(t); } catch (_) { return fail('json', 'طلب غير صالح'); }
  const act = String(b.action || '');
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'na';

  if (act === 'register') {
    if (!(await rateOk('inbox-reg:' + ip, 15))) return fail('rate', 'محاولات كثيرة — حاول بعد قليل', 429);
    if (b.via === 'push') {
      if (!validEndpoint(b.endpoint) || typeof b.auth !== 'string') return fail('proof', 'إثبات الجهاز ناقص', 403);
      const { data: s } = await sb.from('push_subscriptions').select('user_id,username,branch_key,topics').eq('endpoint', b.endpoint).eq('auth', b.auth).is('disabled_at', null).maybeSingle();
      if (!s) return fail('none', 'الجهاز غير مسجّل للإشعارات', 403);
      if (s.user_id === 'admin') return issue('admin', null, null, 'الإدارة', 'push');
      return issue('user:' + s.user_id, s.user_id, s.branch_key, s.username || '', 'push');
    }
    if (b.via === 'admin') {
      const { data } = await sb.from('gmt_settings').select('value').eq('key', 'admin_accounts').maybeSingle();
      let list: any[] = []; try { list = JSON.parse(data?.value || '[]'); } catch (_) { list = []; }
      const acc = list.find((a) => a && a.k === normName(b.name));
      if (!acc || !(await (async () => { try { return same(await pbkdf2(String(b.pw || ''), acc.s, acc.i || 120000), String(acc.h)); } catch (_) { return false; } })()))
        return fail('auth', 'الاسم أو كلمة السرّ غير صحيحة', 403);
      return issue('admin', null, null, acc.n || 'الإدارة', 'password');
    }
    if (b.via === 'user') {
      const uid = String(b.user_id || '');
      if (!/^[0-9a-f-]{36}$/i.test(uid)) return fail('user', 'مستخدم غير معروف', 403);
      const { data: u } = await sb.from('gmt_users').select('id,username,display_name,branch_key,is_active,approved').eq('id', uid).maybeSingle();
      if (!u || u.is_active === false || u.approved === false) return fail('user', 'المستخدم غير معروف أو غير مفعّل', 403);
      const { data: okPw } = await sb.rpc('gmt_pw_check', { p_user: uid, p_pw: String(b.pw || '') });
      if (okPw !== true) return fail('auth', 'كلمة السرّ غير صحيحة', 403);
      return issue('user:' + uid, uid, u.branch_key, u.display_name || u.username || '', 'password');
    }
    return fail('via', 'طريقة توثيق غير معروفة');
  }

  const dev = await me(b.token);
  if (!dev) return fail('token', 'الجهاز غير موثَّق لصندوق الإشعارات', 401);
  const R = dev.recipient, now = new Date().toISOString();

  if (act === 'count') {
    const base = () => sb.from('gmt_notifications').select('*', { count: 'exact', head: true }).eq('recipient', R).is('read_at', null).is('archived_at', null).or('snoozed_until.is.null,snoozed_until.lt.' + now);
    const { count } = await base();
    const { data: pop } = await sb.from('gmt_notifications').select('id').eq('recipient', R).eq('popup', true).is('acted_at', null).is('archived_at', null).order('id', { ascending: false }).limit(1);
    return j({ ok: true, unread: count || 0, popup: pop && pop[0] ? pop[0].id : null, name: dev.name, recipient: R });
  }
  if (act === 'list') {
    const box = String(b.box || 'inbox'), lim = Math.min(Math.max(Number(b.limit) || 50, 1), 100);
    let q = sb.from('gmt_notifications').select('id,event_id,kind,priority,popup,branch_key,ref_id,created_at,read_at,archived_at,snoozed_until,acted_at').eq('recipient', R).order('id', { ascending: false }).limit(lim);
    if (box === 'archive') q = q.not('archived_at', 'is', null); else q = q.is('archived_at', null);
    if (box === 'unread') q = q.is('read_at', null);
    if (box === 'snoozed') q = q.gt('snoozed_until', now); else if (box !== 'archive') q = q.or('snoozed_until.is.null,snoozed_until.lt.' + now);
    if (b.kind) q = q.eq('kind', String(b.kind));
    if (b.before) q = q.lt('id', Number(b.before));
    const { data: rows, error } = await q;
    if (error) return fail('db', 'تعذّر القراءة', 500);
    const ids = [...new Set((rows || []).map((r: any) => r.event_id))];
    const { data: evs } = ids.length ? await sb.from('gmt_push_queue').select('id,kind,data,ref_id,branch_key').in('id', ids) : { data: [] as any[] };
    const E: Record<string, any> = {}; (evs || []).forEach((e: any) => { E[e.id] = e; });
    const qs = String(b.q || '').trim().toLowerCase();
    const items = (rows || []).map((r: any) => {
      const e = E[r.event_id] || { data: {} };
      const m = buildMessage(r.kind, [{ data: scrub(r.kind, e.data) }], { ref_id: r.ref_id, branch: r.branch_key || undefined });
      return { id: r.id, k: r.kind, t: m.t, b: m.b, u: m.u, p: r.priority, pop: r.popup, at: r.created_at, read: !!r.read_at, arch: !!r.archived_at, snz: r.snoozed_until, done: !!r.acted_at, br: r.branch_key };
    }).filter((x: any) => !qs || (x.t + ' ' + x.b).toLowerCase().includes(qs));
    return j({ ok: true, items, more: (rows || []).length === lim ? rows![rows!.length - 1].id : null });
  }
  if (['read', 'unread', 'archive', 'unarchive', 'snooze', 'act'].indexOf(act) !== -1) {
    const patch: any = act === 'read' ? { read_at: now } : act === 'unread' ? { read_at: null } : act === 'archive' ? { archived_at: now, read_at: now }
      : act === 'unarchive' ? { archived_at: null } : act === 'act' ? { acted_at: now, read_at: now }
      : { snoozed_until: new Date(Date.now() + Math.min(Math.max(Number(b.minutes) || 60, 5), 7 * 1440) * 60000).toISOString() };
    let q = sb.from('gmt_notifications').update(patch).eq('recipient', R);
    if (b.all === true && (act === 'read' || act === 'archive')) q = q.is('archived_at', null);
    else { const ids = (Array.isArray(b.ids) ? b.ids : [b.id]).map(Number).filter((x: number) => x > 0).slice(0, 200); if (!ids.length) return fail('ids', 'لا إشعار محدّد'); q = q.in('id', ids); }
    const { error } = await q;
    return error ? fail('db', 'تعذّر الحفظ', 500) : j({ ok: true });
  }
  if (act === 'logout') { await sb.from('gmt_notify_devices').update({ revoked_at: now }).eq('id', dev.id); return j({ ok: true }); }
  return fail('action', 'إجراء غير معروف');
});
