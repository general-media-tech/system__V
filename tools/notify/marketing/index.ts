// مركز الإشعارات — المرحلتان ٧–٨ (المالك seq 803 §تاسعاً و§عاشراً · seq 816)
// • «ابقَ على اطلاع»: اشتراك الزوّار في أنواع الأخبار (موافقة صريحة لكل نوع · إلغاء بضغطة · لا حساب)
// • الحملات: عنوان · نص · صورة · رابط · جمهور (الأنواع) · قنوات (إشعار الجهاز · قناة تيليغرام العامة) · موعد · صلاحية · إحصائيات
// • لا بيانات عملاء ولا طلبات في أيّ قناة عامة. الإدارة: جهاز موثَّق في صندوق الإشعارات بحساب الأدمن (recipient=admin).
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-push-secret', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const j = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const fail = (err: string, msg: string, s = 400) => j({ ok: false, err, msg }, s);
const TOPICS = ['offers', 'new_products', 'discounts', 'canon', 'company', 'restock', 'services'];
const B64U = /^[A-Za-z0-9_-]+$/;
const HOSTS = ['fcm.googleapis.com', 'web.push.apple.com', 'updates.push.services.mozilla.com'];
const validEndpoint = (url: unknown) => { try { if (typeof url !== 'string' || url.length > 1000) return false; const u = new URL(url); const h = u.hostname.toLowerCase();
  return u.protocol === 'https:' && (HOSTS.indexOf(h) !== -1 || h.endsWith('.notify.windows.com') || h.endsWith('.push.apple.com')); } catch (_) { return false; } };
const eqs = (a: string, b: string) => { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };
async function cfg(k: string) { const { data } = await sb.from('push_config').select('v').eq('k', k).maybeSingle(); return data?.v ?? null; }
async function setting(k: string) { const { data } = await sb.from('gmt_settings').select('value').eq('key', k).maybeSingle(); return String(data?.value ?? ''); }
async function sha(s: string) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))).map((b) => b.toString(16).padStart(2, '0')).join(''); }
async function rateOk(k: string, max: number) {
  await sb.from('push_rate').insert({ k });
  const { count } = await sb.from('push_rate').select('*', { count: 'exact', head: true }).eq('k', k).gte('at', new Date(Date.now() - 3600000).toISOString());
  return (count || 0) <= max;
}
async function siteUrl() { return ((await setting('push_site_url')) || 'https://general-media-tech.github.io/system__V').replace(/\/?$/, '/'); }
const clean = (s: unknown, n: number) => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, n);
const safeUrl = (u: unknown) => { const s = clean(u, 400); if (!s) return null; if (/^[A-Za-z0-9_\-؀-ۿ]+\.html([?#].*)?$/.test(s)) return s; try { const x = new URL(s); return x.protocol === 'https:' ? s : null; } catch (_) { return null; } };
function channelChat(v: string) { const s = v.trim().replace(/^https?:\/\/t\.me\//i, '').replace(/^@/, ''); if (/^-?\d{5,}$/.test(s)) return s; return /^[A-Za-z0-9_]{4,}$/.test(s) ? '@' + s : ''; }
const escHtml = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));

async function tg(method: string, body: Record<string, unknown>) {
  const tok = Deno.env.get('TG_BOT_TOKEN'); if (!tok) return { ok: false, description: 'no bot token' };
  try { const r = await fetch('https://api.telegram.org/bot' + tok + '/' + method, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return await r.json(); }
  catch (e) { return { ok: false, description: String(e) }; }
}
async function sendCampaign(c: any) {
  const site = await siteUrl(), stats: any = { push: { targets: 0, sent: 0, failed: 0 }, telegram: null };
  const link = (c.url || 'store.html') + ((c.url || '').indexOf('?') === -1 ? '?' : '&') + 'gmt_c=' + c.id;
  if ((c.channels || []).indexOf('push') !== -1) {
    const pub = await cfg('vapid_public'), priv = await cfg('vapid_private');
    if (pub && priv) {
      webpush.setVapidDetails(site, pub, priv);
      let q = sb.from('gmt_subscribers').select('*').is('unsubscribed_at', null).limit(5000);
      if ((c.topics || []).length) q = q.overlaps('topics', c.topics);
      const { data: subs } = await q;
      const payload = JSON.stringify({ t: c.title, b: c.body, u: /^https:/.test(link) ? link : './' + link, k: 'mk', tag: 'mk-' + c.id, img: c.image_url || undefined });
      stats.push.targets = (subs || []).length;
      for (let i = 0; i < (subs || []).length; i += 20) {
        await Promise.all(subs!.slice(i, i + 20).map(async (s: any) => {
          try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400, urgency: 'normal' }); stats.push.sent++;
            await sb.from('gmt_subscribers').update({ last_sent_at: new Date().toISOString(), fail_count: 0 }).eq('id', s.id);
          } catch (e: any) { stats.push.failed++; const sc = e?.statusCode, fc = (s.fail_count || 0) + 1;
            await sb.from('gmt_subscribers').update(sc === 404 || sc === 410 || fc >= 5 ? { unsubscribed_at: new Date().toISOString(), fail_count: fc } : { fail_count: fc }).eq('id', s.id); }
        }));
      }
    }
  }
  if ((c.channels || []).indexOf('telegram') !== -1) {
    const chat = channelChat(await setting('telegram_public_channel'));
    if (!chat) stats.telegram = { ok: false, why: 'لم تُحدَّد قناة تيليغرام' };
    else {
      const full = /^https:/.test(link) ? link : site + link;
      const text = '<b>' + escHtml(c.title) + '</b>' + (c.body ? '\n' + escHtml(c.body) : '') + '\n\n' + full;
      const r: any = c.image_url ? await tg('sendPhoto', { chat_id: chat, photo: c.image_url, caption: text.slice(0, 1000), parse_mode: 'HTML' })
        : await tg('sendMessage', { chat_id: chat, text: text.slice(0, 4000), parse_mode: 'HTML' });
      stats.telegram = r && r.ok ? { ok: true } : { ok: false, why: String((r && r.description) || 'فشل').slice(0, 200) };
    }
  }
  return stats;
}
async function sendJob() {
  const now = new Date().toISOString();
  const { data: due } = await sb.from('gmt_campaigns').select('*').eq('status', 'scheduled').lte('scheduled_at', now).order('scheduled_at').limit(5);
  const done: any[] = [];
  for (const c of due || []) {
    const { data: claimed } = await sb.from('gmt_campaigns').update({ status: 'sending' }).eq('id', c.id).eq('status', 'scheduled').select('id');
    if (!claimed || !claimed.length) continue;   // حملة أخذها تشغيلٌ آخر (لا إرسال مزدوج)
    if (c.expires_at && c.expires_at < now) { await sb.from('gmt_campaigns').update({ status: 'expired' }).eq('id', c.id); continue; }
    const stats = await sendCampaign(c);
    await sb.from('gmt_campaigns').update({ status: 'sent', sent_at: new Date().toISOString(), stats }).eq('id', c.id);
    done.push({ id: c.id, stats });
  }
  return { ok: true, done };
}
async function admin(token: unknown) {
  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) return null;
  const { data } = await sb.from('gmt_notify_devices').select('id,name,recipient').eq('token_hash', await sha('inbox|' + token)).is('revoked_at', null).maybeSingle();
  return data && data.recipient === 'admin' ? data : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return fail('method', 'طريقة غير مدعومة', 405);
  let b: any; try { const t = await req.text(); if (t.length > 12000) return fail('size', 'الطلب كبير', 413); b = JSON.parse(t || '{}'); } catch (_) { return fail('json', 'طلب غير صالح'); }
  if (b.job === 'send') {
    const sec = (await cfg('cron_secret')) || '';
    if (!sec || !eqs(req.headers.get('x-push-secret') || '', sec)) return fail('unauthorized', 'غير مخوّل', 401);
    return j(await sendJob());
  }
  const act = String(b.action || ''), ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'na';
  /* ── عامّ (صفحة «ابقَ على اطلاع») ── */
  if (act === 'key') { const k = await cfg('vapid_public'); return k ? j({ ok: true, key: k }) : fail('nokey', 'الإشعارات غير جاهزة'); }
  if (act === 'channel') { const c = channelChat(await setting('telegram_public_channel')); return j({ ok: true, link: c && c[0] === '@' ? 'https://t.me/' + c.slice(1) : null }); }
  if (act === 'sub_set' || act === 'sub_get' || act === 'sub_off') {
    if (!(await rateOk('mk:' + ip, 60))) return fail('rate', 'محاولات كثيرة — حاول بعد قليل', 429);
    const s = b.sub || {}, k = s.keys || {}, ep = s.endpoint || b.endpoint, au = k.auth || b.auth;
    if (!validEndpoint(ep) || typeof au !== 'string') return fail('proof', 'إثبات الجهاز ناقص', 403);
    if (act === 'sub_get') { const { data } = await sb.from('gmt_subscribers').select('topics,unsubscribed_at').eq('endpoint', ep).eq('auth', au).maybeSingle(); return j({ ok: true, topics: data && !data.unsubscribed_at ? data.topics : [] }); }
    if (act === 'sub_off') { await sb.from('gmt_subscribers').update({ unsubscribed_at: new Date().toISOString(), topics: [] }).eq('endpoint', ep).eq('auth', au); return j({ ok: true }); }
    if (typeof k.p256dh !== 'string' || k.p256dh.length !== 87 || !B64U.test(k.p256dh) || au.length !== 22 || !B64U.test(au)) return fail('keys', 'مفاتيح الاشتراك غير صالحة');
    const topics = (Array.isArray(b.topics) ? b.topics : []).map(String).filter((t: string) => TOPICS.indexOf(t) !== -1);
    if (!topics.length) return fail('topics', 'اختر نوعاً واحداً على الأقل');
    const { error } = await sb.from('gmt_subscribers').upsert({ endpoint: ep, p256dh: k.p256dh, auth: au, topics, consent_at: new Date().toISOString(), updated_at: new Date().toISOString(), unsubscribed_at: null, fail_count: 0, source: clean(b.source, 40) || 'subscribe_page' }, { onConflict: 'endpoint' });
    return error ? fail('db', 'تعذّر الحفظ', 500) : j({ ok: true, topics });
  }
  if (act === 'click') {
    const id = Number(b.c); if (!(id > 0) || !(await rateOk('mkc:' + ip, 30))) return j({ ok: true });
    const { data } = await sb.from('gmt_campaigns').select('clicks').eq('id', id).maybeSingle();
    if (data) await sb.from('gmt_campaigns').update({ clicks: (data.clicks || 0) + 1 }).eq('id', id);
    return j({ ok: true });
  }
  /* ── الإدارة ── */
  const ad = await admin(b.token); if (!ad) return fail('admin', 'للإدارة فقط — فعّل صندوق الإشعارات بحساب الأدمن', 403);
  if (act === 'camp_list') {
    const { data: rows } = await sb.from('gmt_campaigns').select('*').order('id', { ascending: false }).limit(60);
    const { data: subs } = await sb.from('gmt_subscribers').select('topics').is('unsubscribed_at', null).limit(10000);
    const byTopic: Record<string, number> = {}; TOPICS.forEach((t) => { byTopic[t] = 0; });
    (subs || []).forEach((s: any) => (s.topics || []).forEach((t: string) => { if (byTopic[t] != null) byTopic[t]++; }));
    return j({ ok: true, items: rows || [], subscribers: (subs || []).length, byTopic, channel: await setting('telegram_public_channel'), auto: (await setting('mk_auto_offers')) === '1', bot: !!Deno.env.get('TG_BOT_TOKEN') });
  }
  if (act === 'camp_save') {
    const title = clean(b.title, 120), body = clean(b.body, 600); if (title.length < 2) return fail('title', 'اكتب عنوان الحملة');
    const row: any = { title, body, image_url: safeUrl(b.image_url), url: safeUrl(b.url) || 'store.html',
      topics: (Array.isArray(b.topics) ? b.topics : []).map(String).filter((t: string) => TOPICS.indexOf(t) !== -1),
      channels: (Array.isArray(b.channels) ? b.channels : []).map(String).filter((c: string) => c === 'push' || c === 'telegram'),
      scheduled_at: b.scheduled_at && !isNaN(Date.parse(b.scheduled_at)) ? new Date(b.scheduled_at).toISOString() : new Date().toISOString(),
      expires_at: b.expires_at && !isNaN(Date.parse(b.expires_at)) ? new Date(b.expires_at).toISOString() : null,
      status: b.status === 'draft' ? 'draft' : 'scheduled', created_by: ad.name || 'الإدارة', source: 'manual' };
    if (!row.channels.length) return fail('channels', 'اختر قناة واحدة على الأقل');
    if (b.id) {
      const { data: cur } = await sb.from('gmt_campaigns').select('status').eq('id', Number(b.id)).maybeSingle();
      if (!cur || ['draft', 'scheduled'].indexOf(cur.status) === -1) return fail('state', 'لا تُعدَّل حملة أُرسلت');
      delete row.source; const { data, error } = await sb.from('gmt_campaigns').update(row).eq('id', Number(b.id)).select('*');
      return error ? fail('db', 'تعذّر الحفظ', 500) : j({ ok: true, item: data && data[0] });
    }
    const { data, error } = await sb.from('gmt_campaigns').insert(row).select('*');
    return error ? fail('db', 'تعذّر الحفظ', 500) : j({ ok: true, item: data && data[0] });
  }
  if (act === 'camp_cancel') {
    const { data } = await sb.from('gmt_campaigns').update({ status: 'cancelled' }).eq('id', Number(b.id)).in('status', ['draft', 'scheduled']).select('id');
    return data && data.length ? j({ ok: true }) : fail('state', 'لا تُلغى حملة أُرسلت');
  }
  if (act === 'settings') {
    if (b.channel !== undefined) { const c = clean(b.channel, 100); if (c && !channelChat(c)) return fail('channel', 'اكتب رابط القناة مثل t.me/اسم_القناة أو @اسم_القناة');
      await sb.from('gmt_settings').upsert({ key: 'telegram_public_channel', value: c }, { onConflict: 'key' }); }
    if (b.auto !== undefined) await sb.from('gmt_settings').upsert({ key: 'mk_auto_offers', value: b.auto ? '1' : '0' }, { onConflict: 'key' });
    return j({ ok: true });
  }
  if (act === 'tg_test') {
    const chat = channelChat(await setting('telegram_public_channel')); if (!chat) return fail('channel', 'حدّد قناة تيليغرام أوّلاً');
    const r: any = await tg('getChat', { chat_id: chat });
    if (!r || !r.ok) return fail('tg', 'البوت لا يصل للقناة — أضفه مشرفاً فيها (' + String((r && r.description) || '').slice(0, 120) + ')');
    const m: any = await tg('getChatMember', { chat_id: chat, user_id: Number((await tg('getMe', {}) as any)?.result?.id || 0) });
    const st = m && m.ok ? m.result.status : '';
    return st === 'administrator' || st === 'creator' ? j({ ok: true, title: r.result.title || chat }) : fail('tg', 'البوت ليس مشرفاً في القناة — اجعله مشرفاً بصلاحية النشر');
  }
  return fail('action', 'إجراء غير معروف');
});
