// (TASK-A0569 · المالك seq 966) إشعار «تمت الموافقة على عمولتك» في نقطة البيع — نقطة البدء كانت ساعة الجهاز
//  ① ساعة الجهاز متقدّمة ساعتين: موافقةٌ جديدة بعد الفتح ⇒ يظهر إشعارها (كانت تضيع)
//  ② الموافقات القديمة قبل الفتح ⇒ لا إشعار   ③ لا تكرار للموافقة نفسها في الدورة التالية
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const iso = t => new Date(t).toISOString();
  const SKEW = `;(function(){ const RD = Date, skew = 2 * 3600e3; window.Date = class extends RD { constructor(...a) { if (!a.length) super(RD.now() + skew); else super(...a); } static now() { return RD.now() + skew; } }; })();`;
  /* موافقةٌ قديمة قبل الفتح (بمفتاح فرع الجلسة: daraa) */
  await H.call('/rest/v1/invoice_commissions', [{ id: 8801, branch_key: 'daraa', amount: 3, approved: true, approved_at: iso(Date.now() - 3600e3), note: 'قديمة' }]);
  const { browser, pg, errs } = await H.open('pos.html', { init: H.STAFF_INIT + SKEW, w: 390, h: 800, wait: 7000 });   /* ساعة الجهاز متقدّمة ساعتين منذ الفتح */
  const key = await pg.evaluate(() => branch && branch.key);
  await pg.evaluate(() => { window.__notifs = []; showCommissionNotif = function (a, n) { window.__notifs.push(n); }; });
  await pg.evaluate(() => checkNewNotifications()); await sleep(300);
  let n = await pg.evaluate(() => window.__notifs.slice());
  ok(n.length === 0, '② الموافقات القديمة قبل الفتح ⇒ لا إشعار ' + JSON.stringify(n));
  await H.call('/rest/v1/invoice_commissions', [{ id: 8802, branch_key: key, amount: 5, approved: true, approved_at: iso(Date.now()), note: 'جديدة' }]);
  await pg.evaluate(() => checkNewNotifications()); await sleep(300);
  n = await pg.evaluate(() => window.__notifs.slice());
  ok(n.length === 1 && n[0] === 'جديدة', '① ساعة الجهاز متقدّمة: الموافقة الجديدة ظهرت ' + JSON.stringify(n));
  await pg.evaluate(() => checkNewNotifications()); await sleep(300);
  n = await pg.evaluate(() => window.__notifs.slice());
  ok(n.length === 1, '③ لا تكرار في الدورة التالية ' + JSON.stringify(n));
  const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource|favicon/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
