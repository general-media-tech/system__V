// TASK-B0549 · A1004 P4 · A0587 (طابور Q1): الاستلام بالمسح — «يمسح كلّ قطعة ⇐ يظهر المنتج ⇐ عدد ⇐ مطابقة ⇐ صحّ/نقص/زيادة»
// المسح بيعبّي خانات نافذة «وصلت» نفسها ⇒ نفس الترحيل (مرّة وحدة · دفتر الاستلام · لا ختم بلا وصول كامل)
const H = require('./h.js');
const SR = require('../../gmt-scanrecv.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  const idx = SR.index([{ id: 'a', barcode: '0012345678905' }, { id: 'b', barcode: 'ab-77' }], pid => pid === 'b' ? ['6900000000017'] : []);
  ok(SR.match('12345678905', idx) === 'a' && SR.match('0012345678905', idx) === 'a', 'باركود رقمي بصفر بادئ أو بدونه = نفس المنتج');
  ok(SR.match(' AB-77 ', idx) === 'b' && SR.match('ab-77', idx) === 'b' && SR.match('6900000000017', idx) === 'b', 'حروف كبيرة/صغيرة · مسافات · باركود المنتج من الجرد');
  ok(SR.match('٦٩٠٠٠٠٠٠٠٠٠١٧', idx) === 'b' && SR.match('999', idx) === null, 'أرقام عربية · المجهول null');
  const s = SR.summary({ a: 2, b: 1, c: 4 }, { a: 2, b: 3, c: 3 });
  ok(s.ok === 1 && s.short.join() === 'b' && s.over.join() === 'c' && s.scanned === 7 && s.need === 8, 'ملخّص: كامل · ناقص · زيادة');
  // الواجهة + الترحيل الحقيقي
  await H.seed();
  const [A, B] = await H.call('/rest/v1/products', [{ name: 'منتج المسح أ', barcode: 'SCAN-A', price: 10, china: 2, haleb: 0 }, { name: 'منتج المسح ب', barcode: 'SCAN-B', price: 10, china: 3, haleb: 0 }]);
  await H.call('/rest/v1/import_log', [{ id: 951, inv_number: 'IMP-SCAN-1', inv_type: 'china', status: 'transit', supplier: 'م', total_amount: 50, cash_payment: 0, transferred: false,
    items_snapshot: [{ id: A.id, name: A.name, barcode: 'SCAN-A', qty: 2, unit_price: 10 }, { id: B.id, name: B.name, qty: 3, unit_price: 10 }] }]);
  const { browser, pg, errs } = await H.open('purchase.html', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 7000 });
  await pg.evaluate(() => { window.__conf = []; GMTAsk.confirm = async (m) => { window.__conf.push(m); return true; }; });
  await pg.evaluate(() => markArrived('951')); await pg.waitForSelector('#gmt-arrival-ov [data-sr-start]', { timeout: 15000 });
  await pg.click('[data-sr-start]');
  ok(await pg.evaluate(() => [...document.querySelectorAll('#arr-body [data-mv]')].every(i => i.value === '0')), '«📷 استلام بالمسح» بيصفّر الكمّيات');
  for (const c of ['SCAN-A', 'scan-a', 'SCAN-B', 'XYZ-404']) { await pg.fill('[data-sr-in]', c); await pg.press('[data-sr-in]', 'Enter'); }
  const st = await pg.evaluate(() => ({ mv: [...document.querySelectorAll('#arr-body tr')].map(tr => tr.querySelector('[data-mv]').value), sum: document.querySelector('[data-sr-sum]').textContent, unk: document.querySelector('[data-sr-unk]').textContent, badge: [...document.querySelectorAll('[data-sr-badge]')].map(b => b.textContent) }));
  ok(st.mv.join() === '2,1', 'المسح عبّى «ينقل الآن»: أ 2 · ب 1 (ب بلا باركود بالفاتورة — انعرف من الجرد): ' + st.mv.join());
  ok(/مسحت 3 من 5/.test(st.sum) && /ناقص 1/.test(st.sum) && /غير معروف 1/.test(st.sum), 'الملخّص: ' + st.sum);
  ok(/XYZ-404/.test(st.unk) && st.badge[0].startsWith('✅') && st.badge[1].startsWith('⏳'), 'المجهول بينذكر · شارات ✅ كامل / ⏳ ناقص');
  await pg.fill('[data-sr-in]', 'SCAN-B'); await pg.press('[data-sr-in]', 'Enter'); await pg.click('[data-sr-undo]');
  ok(await pg.evaluate(() => document.querySelectorAll('#arr-body [data-mv]')[1].value) === '1', '↶ تراجع عن آخر مسحة');
  await pg.click('#arr-go'); await pg.waitForTimeout(4000);
  ok(await pg.evaluate(() => (window.__conf || []).some(m => /ناقص 1 صنف/.test(m))), 'التنفيذ وفيه نقص ⇒ بيسأل قبل');
  const D = await H.call('/__dump', undefined, 'GET');
  const pa = D.products.find(p => p.id === A.id), pb = D.products.find(p => p.id === B.id), inv = D.import_log.find(x => x.id === 951);
  const rec = (D.stock_receipts || []).filter(r => r.import_id === 951 || String(r.import_id) === '951');
  ok(Number(pa.china) === 0 && Number(pb.china) === 2, 'العبور نقص بقدر يلي انمسح (أ 2⇐0 · ب 3⇐2)');
  ok(rec.length === 2 && rec.reduce((t, r) => t + Number(r.qty), 0) === 3, 'دفتر الاستلام: 3 قطع (مرّة وحدة)');
  ok(inv.transferred === false && inv.status !== 'arrived', 'الفاتورة ما انختمت (ناقص قطعتين) — الباقي بيترحّل بعدين');
  ok(D.products.filter(p => p.barcode === 'SCAN-A').length === 1, '(صيد نمط) حارس الترحيل ما أنشأ نسخة مكرّرة لباركود بحروف كبيرة «SCAN-A»');
  ok(!errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).length, 'لا أخطاء JS: ' + JSON.stringify(errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
