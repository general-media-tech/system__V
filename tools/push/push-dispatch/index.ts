// (TASK-B0420 · المهمّة ٤) push-dispatch — يحجز أحداث الطابور المستحقّة ويرسل Web Push. لا يُستدعى إلا بسرّ داخلي (push_config.cron_secret).
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { groupEvents, buildMessage, scrub, isQuiet, nextMorning, wants, isHigh } from './push_logic.mjs';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const j = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
async function cfg(k: string) { const { data } = await sb.from('push_config').select('v').eq('k', k).maybeSingle(); return data?.v ?? null; }
async function setting(k: string) { const { data } = await sb.from('gmt_settings').select('value').eq('key', k).maybeSingle(); return data?.value ?? ''; }
const eq = (a: string, b: string) => { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };

async function versionJob() {
  const url = String((await setting('push_site_url')) || '').replace(/\/$/, '');
  if (!url) return { ok: true, skipped: 'no url' };
  const t = await (await fetch(url + '/sw.js?ts=' + Date.now())).text();
  const m = t.match(/const VERSION\s*=\s*'([^']+)'/); if (!m) return { ok: false, err: 'no version' };
  const last = await setting('push_last_version');
  if (!last) { await sb.from('gmt_settings').upsert({ key: 'push_last_version', value: m[1] }, { onConflict: 'key' }); return { ok: true, init: m[1] }; }
  if (last === m[1]) return { ok: true, same: true };
  const since = new Date(Date.now() - 6 * 3600000).toISOString();
  const { data: recent } = await sb.from('gmt_push_queue').select('id').eq('kind', 'version').gte('created_at', since).limit(1);
  if (recent && recent.length) return { ok: true, throttled: true };
  await sb.from('gmt_settings').upsert({ key: 'push_last_version', value: m[1] }, { onConflict: 'key' });
  await sb.from('gmt_push_queue').insert({ kind: 'version', topic: 'pos', data: { v: m[1] }, dedupe_key: 'version', send_after: new Date(Date.now() + 600000).toISOString() });
  return { ok: true, queued: m[1] };
}

async function valid(r: any) {   // إعادة التحقّق لحظة الإرسال
  if (r.kind === 'transfer') { const { data } = await sb.from('branch_stock_transfers').select('status').eq('id', r.ref_id).maybeSingle(); return !!data && ['pending', 'needs_settlement'].indexOf(data.status) !== -1; }
  if (r.kind === 'order') { const { data } = await sb.from('gmt_orders').select('status').eq('id', r.ref_id).maybeSingle(); return !!data && data.status === 'pending'; }
  if (r.kind === 'offer') { const { data } = await sb.from('gmt_offers').select('is_active').eq('id', r.ref_id).maybeSingle(); return !!data && data.is_active === true; }
  return true;
}

async function shipBranch(): Promise<string | null> {   // فرع تجهيز أوردرات المتجر (إعداد orders_default_ship_from: «اسم|…»)
  const v = String(await setting('orders_default_ship_from') || '').split('|')[0].trim(); if (!v) return null;
  const { data } = await sb.from('inv_columns').select('key_name,display_name').eq('is_branch', true);
  const f = (data || []).find((c: any) => c.display_name === v || c.key_name === v); return f ? f.key_name : null;
}

Deno.serve(async (req) => {
  const sec = (await cfg('cron_secret')) || '';
  if (!sec || !eq(req.headers.get('x-push-secret') || '', sec)) return j({ ok: false, err: 'unauthorized' }, 401);
  let body: any = {}; try { body = await req.json(); } catch (_) { /* {} */ }
  if (body.job === 'version') return j(await versionJob());

  const pub = await cfg('vapid_public'), priv = await cfg('vapid_private');
  if (!pub || !priv) return j({ ok: false, err: 'no vapid yet' });
  webpush.setVapidDetails((String(await setting('push_site_url') || 'https://general-media-tech.github.io/system__V')).replace(/\/?$/, '/'), pub, priv);

  const { data: claimed } = await sb.rpc('gmt_push_claim', { lim: 200 });
  const rows: any[] = claimed || []; if (!rows.length) return j({ ok: true, groups: 0, sent: 0 });
  const good: any[] = [];
  for (const r of rows) { if (await valid(r)) good.push({ ...r, data: scrub(r.kind, r.data) }); else await sb.from('gmt_push_queue').update({ status: 'skipped', result: { why: 'invalid' } }).eq('id', r.id); }

  const enabled = String(await setting('push_enabled_branches') || '').trim();
  const { data: subsAll } = await sb.from('push_subscriptions').select('*').is('disabled_at', null);
  const subs: any[] = (subsAll || []).filter((s) => enabled === '*' || s.topics.indexOf('admin') !== -1 || (enabled && enabled.split(',').map((x) => x.trim()).indexOf(s.branch_key) !== -1));
  const ship = await shipBranch();
  let sent = 0, gone = 0, failed = 0, groups = 0;

  for (const g of groupEvents(good)) {
    groups++;
    const ids = g.rows.map((r: any) => r.id);
    if (!isHigh(g.kind) && isQuiet(new Date())) { await sb.from('gmt_push_queue').update({ status: 'pending', send_after: nextMorning(new Date()).toISOString(), attempts: 0 }).in('id', ids); continue; }
    const kindSubs = subs.filter((s) => wants(s, g.kind));
    // مستلمو المجموعة: (النوع ⇒ موضوع) + تصفية الفرع
    let targets: { sub: any; pos: boolean }[] = [];
    if (g.kind === 'order') {
      targets = kindSubs.filter((s) => s.topics.indexOf('orders') !== -1).map((s) => ({ sub: s, pos: false }))
        .concat(kindSubs.filter((s) => s.topics.indexOf('pos') !== -1 && s.topics.indexOf('orders') === -1 && (!ship || s.branch_key === ship)).map((s) => ({ sub: s, pos: true })));
    } else {
      targets = kindSubs.filter((s) => s.topics.indexOf(g.topic) !== -1 && (!g.branch_key || s.branch_key === g.branch_key || (g.topic !== 'pos' && s.topics.indexOf('admin') !== -1))).map((s) => ({ sub: s, pos: false }));
    }
    const items = g.rows.map((r: any) => ({ data: r.data, ref_id: r.ref_id }));
    const base = { ref_id: items.length === 1 ? g.rows[0].ref_id : undefined, branch: g.branch_key || undefined };
    const seen = new Set<string>(); let gs = 0, gf = 0;
    for (let i = 0; i < targets.length; i += 10) {
      await Promise.all(targets.slice(i, i + 10).map(async ({ sub, pos }) => {
        if (seen.has(sub.id)) return; seen.add(sub.id);
        const m = buildMessage(g.kind, items.map((x: any) => ({ data: x.data })), { ...base, pos });
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(m), { TTL: m.ttl, urgency: m.urgency as any, topic: m.topic });
          sent++; gs++; await sb.from('push_subscriptions').update({ last_sent_at: new Date().toISOString(), fail_count: 0 }).eq('id', sub.id);
        } catch (e: any) {
          const sc = e?.statusCode;
          if (sc === 404 || sc === 410) { gone++; await sb.from('push_subscriptions').update({ disabled_at: new Date().toISOString(), disabled_reason: 'gone' }).eq('id', sub.id); }
          else { failed++; gf++; const fc = (sub.fail_count || 0) + 1; await sb.from('push_subscriptions').update(fc >= 5 ? { fail_count: fc, disabled_at: new Date().toISOString(), disabled_reason: 'failing' } : { fail_count: fc }).eq('id', sub.id); }
        }
      }));
    }
    const totalFail = targets.length > 0 && gs === 0 && gf > 0;   // (B0423) عدّادات المجموعة لا الإجماليّة
    await sb.from('gmt_push_queue').update(totalFail && g.rows[0].attempts < 3
      ? { status: 'pending', send_after: new Date(Date.now() + 120000).toISOString(), result: { targets: targets.length, failed: gf } }
      : { status: 'sent', sent_at: new Date().toISOString(), result: { targets: targets.length, sent: gs, failed: gf } }).in('id', ids);
  }
  return j({ ok: true, groups, sent, gone, failed });
});
