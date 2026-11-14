// (VER-3#REQ-0324 · TASK-B0409) رقم خدمة العملاء: كان في متصفّح المالك فقط ⇒ يُحفظ في gmt_settings ويصل لكلّ زائر (المتجر وغيره)
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const st = { categories: [{ id: 'c0', name: 'قسم', order: 0 }], banners: [], offers: [], branches: [], products: [{ id: 'x1', name: 'منتج', price: 10, category_id: 'c0' }] };
const VISITOR = `try{ localStorage.clear(); localStorage.setItem('gmt_intro_seen_build','x'); }catch(e){}`;
(async () => {
  await H.seed(); await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-11-14T10:00:00Z', ...st }]);
  // ① بلا إعداد ⇒ رقم المتجر الافتراضي
  let o = await H.open('logo.jpg', { init: VISITOR, w: 412, h: 860, mobile: true, wait: 0 });
  await o.ctx.route(/home\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(st) }));
  await o.pg.goto(H.BASE + 'store.html', { waitUntil: 'domcontentloaded' }); await o.pg.waitForTimeout(4000);
  const a = await o.pg.evaluate(() => CONFIG.WHATSAPP_NUMBER);
  ok(a === '963939773715', '① بلا إعداد عامّ ⇒ رقم المتجر ' + a);
  // ② المدير يحفظ الرقم ⇒ يُكتب في gmt_settings
  const saved = await o.pg.evaluate(async () => await GMTContact.set('0944123456'));
  const dump = await (await fetch('http://127.0.0.1:' + process.env.MOCK_PORT + '/__dump')).json();
  const row = (dump.gmt_settings || []).find(r => r.key === 'gmt_cs_phone');
  ok(row && row.value === '0944123456', '② الحفظ يكتب في إعدادات النظام (لا المتصفّح وحده) ' + JSON.stringify(saved));
  await o.browser.close();
  // ③ زائر على جهاز آخر (تخزين فارغ) ⇒ يقرأ الرقم من النظام
  o = await H.open('logo.jpg', { init: VISITOR, w: 412, h: 860, mobile: true, wait: 0 });
  await o.ctx.route(/home\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(st) }));
  await o.pg.goto(H.BASE + 'store.html', { waitUntil: 'domcontentloaded' }); await o.pg.waitForTimeout(4500);
  const b = await o.pg.evaluate(() => ({ cfg: CONFIG.WHATSAPP_NUMBER, gc: GMTContact.whatsapp() }));
  ok(b.cfg === '963944123456' && b.gc === '963944123456', '③ زائرٌ على جهاز آخر يرى الرقم المضبوط (المتجر يقرأ المصدر الواحد) ' + JSON.stringify(b));
  const real = o.errs.filter(e => !/status of (400|401|404|406)|Failed to load resource|favicon|AudioContext/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
