// (TASK-B0538 · seq B1038 §٩ «البحث عن أي جهاز باستخدام رقمه والوصول إلى تاريخه الكامل») صفحة «سجلّ الأجهزة»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  await H.call('/rest/v1/gmt_serials', [{ code: '490154203237518', kind: 'imei', product_name: 'هاتف تجربة', status: 'sold', sale_inv_number: 'S-77', customer_name: 'زبون الجهاز', customer_phone: '0944000000', branch_key: 'haleb', sold_at: '2026-11-20T10:00:00Z', history: [{ at: '2026-11-20T10:00:00Z', ev: 'sold', by: 'سامر', ref: 'S-77' }] }]);
  await H.call('/rest/v1/warranties', [{ warranty_number: 'W-500', customer_name: 'زبون الجهاز', product_name: 'هاتف تجربة', serial_no: 'S/N (21)490154203237518', status: 'active', expiry_date: '2027-11-20' }]);
  const { browser, pg, errs } = await H.open('سجل_الأجهزة.html?q=' + encodeURIComponent('IMEI: 49-015420-323751-8'), { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 5000 });
  await pg.waitForTimeout(1500);
  const r = await pg.evaluate(() => ({ dev: (document.querySelector('[data-dev]') || {}).innerText || '', war: (document.querySelector('[data-war]') || {}).innerText || '' }));
  ok(/490154203237518/.test(r.dev) && /مبيع/.test(r.dev) && /S-77/.test(r.dev) && /زبون الجهاز/.test(r.dev) && /بِيع · S-77 · سامر/.test(r.dev), 'IMEI بفواصل ووسم ⇒ سجلّ الجهاز: مبيع · الفاتورة · الزبون · التاريخ: ' + r.dev.replace(/\s+/g, ' ').slice(0, 140));
  ok(/W-500/.test(r.war), 'كفالته تُوجد رغم تخزين الرقم خاماً («S/N (21)…»)');
  await pg.evaluate(() => GMTDeviceLookup.search('SN: ZZZ999XX1')); await pg.waitForTimeout(800);
  ok(/لا سجلّ لهذا الرقم/.test(await pg.evaluate(() => document.getElementById('out').innerText)), 'رقم غير معروف ⇒ «لا سجلّ» صريح');
  ok(!errs.filter(e => !/favicon|404|400|406|Failed to load/.test(e)).length, 'لا أخطاء JS: ' + JSON.stringify(errs.slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
