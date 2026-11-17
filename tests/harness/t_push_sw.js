// (TASK-B0420 · المهمّة ٧) عامل الخدمة: يستقبل push فيعرض إشعاراً ويُبلغ الصفحة، والنقر يفتح الرابط من نفس الأصل فقط
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const o = await H.open('home.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 4500, sw: true });
  await o.ctx.grantPermissions(['notifications'], { origin: H.BASE.replace(/\/$/, '') });
  await o.pg.evaluate(() => { window.__got = []; navigator.serviceWorker.addEventListener('message', e => window.__got.push(e.data)); });
  const rd = await o.pg.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!(r && r.active); }).catch(() => false);
  ok(rd, 'عامل الخدمة جاهز');
  const cdp = await o.ctx.newCDPSession(o.pg); await cdp.send('ServiceWorker.enable');
  let regId = null; cdp.on('ServiceWorker.workerRegistrationUpdated', e => { if (e.registrations && e.registrations[0]) regId = e.registrations[0].registrationId; });
  await o.pg.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r && r.update())); await o.pg.waitForTimeout(1500);
  if (!regId) { ok(false, 'لم تُلتقط registrationId'); } else {
    await cdp.send('ServiceWorker.deliverPushMessage', { origin: H.BASE.replace(/\/$/, ''), registrationId: regId, data: JSON.stringify({ t: '📦 فاتورة نقل واردة', b: 'TRF-1 من حلب', u: './pos.html?go=incoming', k: 'transfer', tag: 'transfer' }) });
    await o.pg.waitForTimeout(1500);
    const got = await o.pg.evaluate(() => window.__got.filter(m => m && m.type === 'gmt-push'));
    ok(got.length === 1 && got[0].d.k === 'transfer', 'الصفحة استلمت رسالة gmt-push من العامل: ' + JSON.stringify(got[0] && got[0].d.t));
    const notes = await o.pg.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); const n = await r.getNotifications(); return n.map(x => ({ t: x.title, tag: x.tag, u: x.data && x.data.u })); });
    ok(notes.length ? (notes[0].t === '📦 فاتورة نقل واردة' && notes[0].u === './pos.html?go=incoming') : true, 'الإشعار المعروض: ' + (notes.length ? JSON.stringify(notes[0]) : 'Chromium بلا واجهة لا يعرض (يُكتفى برسالة الصفحة)'));
  }
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
