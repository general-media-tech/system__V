// ARC-MD-10#42 (البند ١٤٢ «العقل يجرّب العمليات الكاملة») — زرّ «🧪 جرّب العمليات الكاملة» في لوحة العقل يشغّل الفاحص الشامل
// GMTAutoTest (الوضع التدريبي · بلا وسيط ولا رصيد) ويلخّص نتيجته · للأدمن فقط · لا يظهر حين لا يكون الفاحص محمّلاً.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const { browser, ctx, pg, errs } = await H.open('home.html', { init: H.ADMIN_INIT, w: 390, h: 800, wait: 3500 });
  let brainHits = 0; await ctx.route('**/functions/v1/gmt-brain**', r => { brainHits++; r.fulfill({ status: 200, body: '{}' }); });
  const chip = () => pg.evaluate(() => [...document.querySelectorAll('#gb-chips button')].some(b => /جرّب العمليات الكاملة/.test(b.textContent)));
  // الفاحص الحقيقي محمّل في الصفحة؟ (gmt-staff.js) — نستبدله ببديلٍ يسجّل النداء كي لا يضغط أزرار الصفحة فعلاً
  const real = await pg.evaluate(() => !!(window.GMTAutoTest && GMTAutoTest.run));
  await pg.evaluate(() => {
    window.__atCalls = 0;
    window.GMTAutoTest = { run: async () => { window.__atCalls++; }, results: () => [{ status: 'ok', title: 'أ' }, { status: 'ok', title: 'ب' }, { status: 'fail', title: 'زرّ الحفظ لا يستجيب', detail: 'مهلة' }] };
    window.GMTSandbox = Object.assign(window.GMTSandbox || {}, { active: true });
    GMTBrain.open();
  });
  await pg.waitForSelector('#gmt-brain-panel');
  ok(await chip(), 'زرّ «🧪 جرّب العمليات الكاملة» ظاهر للأدمن (الفاحص الحقيقي محمّل في الصفحة: ' + real + ')');
  await pg.evaluate(() => [...document.querySelectorAll('#gb-chips button')].find(b => /جرّب العمليات الكاملة/.test(b.textContent)).click());
  await pg.waitForFunction(() => /فشل/.test(document.getElementById('gb-log').innerText), null, { timeout: 5000 }).catch(() => {});
  const log = await pg.$eval('#gb-log', e => e.innerText);
  const calls = await pg.evaluate(() => window.__atCalls);
  ok(calls === 1 && /1 فشل/.test(log) && /2 نجح من 3/.test(log) && /زرّ الحفظ لا يستجيب/.test(log), 'يشغّل الفاحص مرّة ويلخّص: ' + log.replace(/\s+/g, ' ').slice(-120));
  ok(brainHits === 0, 'بلا نداءٍ للوسيط (لا رصيد): ' + brainHits);
  // بلا فاحص ⇒ لا زرّ
  await pg.evaluate(() => { delete window.GMTAutoTest; GMTBrain.open(); });
  ok(!(await chip()), 'الفاحص غير محمّل ⇒ لا زرّ');
  await browser.close();
  // الموظّف ⇒ لا زرّ
  const s = await H.open('home.html', { init: H.STAFF_INIT, w: 390, h: 800, wait: 3500 });
  await s.pg.evaluate(() => { window.GMTAutoTest = { run: async () => {}, results: () => [] }; window.GMTBrain && GMTBrain.open(); });
  const staffChip = await s.pg.evaluate(() => [...document.querySelectorAll('#gb-chips button')].some(b => /جرّب العمليات الكاملة/.test(b.textContent)));
  ok(!staffChip, 'الموظّف ⇒ لا زرّ');
  const bad = errs.filter(e => !/Failed to load|favicon|404|ERR_|qrserver|vibrate/.test(e));
  ok(bad.length === 0, 'لا أخطاء JS: ' + JSON.stringify(bad.slice(0, 3)));
  await s.browser.close();
  console.log(fails ? `FAIL=${fails} (pass ${pass})` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
