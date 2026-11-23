// (TASK-A0583 · المالك seq A1018) «أرفع الفاتورة ثم ملفّي الأوبريشن والباكينج ليست … هو لحاله بيتصرّف» — محرّك الباكينج/الجمارك
//  ① يقرأ ملف المخلّص (الخلايا المدموجة = كرتونة) · ٣ كراتين · الرسوم = الوزن × الرسم (30 + 10 + 15 = 55 · إجمالي الملف 60)
//  ② يطابق أسطر الباكينج (إنجليزي) ببنود الفاتورة عبر الأسماء البديلة · الأصل خارج التوزيع
//  ③ التوزيع: الجمارك المدفوعة بنسبة رسم الكرتونة · الشحن بالوزن · الأخرى بالقيمة · داخل الكرتونة بقيمة البند — المجاميع = المدفوع
//  ④ «تطبيق» ثمّ «حفظ التعديلات» ⇒ alloc_unit/alloc في البنود + الجمارك/الشحن في الفاتورة ⇒ الكلفة الواصلة تظهر وتُحفظ
const H = require('./h.js'), path = require('path');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const P = await H.call('/rest/v1/products', [
    { name: 'سوفت بوكس 60x90', alt_names: 'Photography softbox 60x90، softbox 60x90', barcode: 'PK01', price: 30, cost_price: 1 },
    { name: 'ستاند إضاءة 2م', alt_names: 'Light stand 2m، light stand', barcode: 'PK02', price: 15, cost_price: 1 },
    { name: 'حقيبة كاميرا وسط', alt_names: 'Camera bag medium', barcode: 'PK03', price: 20, cost_price: 1 },
    { name: 'غطاء عدسة 58مم', alt_names: 'Lens cap 58mm', barcode: 'PK04', price: 3, cost_price: 0.5 }]);
  const snap = [
    { id: P[0].id, name: P[0].name, qty: 10, unit_price: 12, orig_unit_price: 12, barcode: 'PK01' },
    { id: P[1].id, name: P[1].name, qty: 20, unit_price: 5, orig_unit_price: 5, barcode: 'PK02' },
    { id: P[2].id, name: P[2].name, qty: 5, unit_price: 10, orig_unit_price: 10, barcode: 'PK03' },
    { id: P[3].id, name: P[3].name, qty: 30, unit_price: 1, orig_unit_price: 1, barcode: 'PK04' },
    { id: null, name: 'قارئ باركود (أصل)', qty: 1, unit_price: 40, orig_unit_price: 40, asset: true }];
  const [IV] = await H.call('/rest/v1/import_log', [{ inv_number: 'IMP-2026-0971', inv_type: 'china', supplier: 'Test Co', status: 'transit', total_amount: 340, items_count: 5, total_qty: 66,
    cost_shipping: 100, cost_customs: 55, cost_transport: 10, cost_local: 5, cost_transfer: 0, currency: 'USD', dest_branch: 'daraa', items_snapshot: snap }]);
  const { browser, pg, errs } = await H.open('purchase.html', { w: 1366, h: 900, mobile: false, wait: 6000 });
  pg.on('dialog', d => d.accept('الكلفة الواصلة من الباكينج'));
  await pg.evaluate(id => openInvForEdit(id), IV.id); await pg.waitForTimeout(700);
  ok(await pg.evaluate(() => getComputedStyle(document.getElementById('inv-pack-btn')).display !== 'none'), '(زرّ «📦 الباكينج والجمارك» في أدوات التعديل)');
  await pg.evaluate(() => packOpen()); await pg.waitForTimeout(300);
  await pg.evaluate(() => { document.getElementById('pack-c-customs').value = 60; });   // الجمارك المدفوعة فعلاً (إيصال)
  await pg.setInputFiles('#pack-file', path.join(__dirname, 'fixtures/packing_damas_test.xlsx'));
  await pg.waitForFunction(() => _PK && _PK.A, null, { timeout: 15000 });
  const s = await pg.evaluate(() => ({ T: _PK.P.totals, map: _PK.map.map(a => a.slice()), A: _PK.A, sum: document.getElementById('pack-sum').innerText }));
  ok(s.T.cartons === 3 && s.T.pieces === 65 && s.T.duty === 55 && s.T.dutyTotal === 60, '① ٣ كراتين · ٦٥ قطعة · رسوم 55 (20×1.5 + 20×0.5 + 10×1.5) · إجمالي الملف 60: ' + JSON.stringify(s.T));
  ok(JSON.stringify(s.map) === JSON.stringify([[0], [1], [2], [3]]), '② كلّ سطر بالبند الصحيح عبر الأسماء البديلة الإنجليزية · الأصل غير مطابق: ' + JSON.stringify(s.map));
  const A = s.A;
  ok(Math.abs(A.check.customs - 60) < 0.02 && Math.abs(A.check.ship - 100) < 0.02 && Math.abs(A.check.other - 15) < 0.02, '③ المجاميع = المدفوع: ' + JSON.stringify(A.check));
  // الكرتونة ١ (رسم 30 من 55) ⇒ جمارك 60×30/55 = 32.73 كلّها للسوفت بوكس · الكرتونة ٣ (15/55) ⇒ 16.36 بين الحقيبة (قيمة 50) والأغطية (30) ⇒ 10.23 و6.14
  ok(Math.abs(A.items[0].customs - 32.73) < 0.02 && Math.abs(A.items[2].customs - 10.23) < 0.02 && Math.abs(A.items[3].customs - 6.14) < 0.02, '③ الجمارك بنسبة رسم الكرتونة ثمّ بقيمة البند داخلها: ' + [A.items[0].customs, A.items[2].customs, A.items[3].customs].join(' · '));
  ok(A.items[4].customs === 0 && A.items[4].ship === 0 && A.items[4].unit == null, '③ الأصل خارج التوزيع');
  await pg.evaluate(() => packApply()); await pg.waitForTimeout(400);
  await pg.evaluate(() => saveInvEdits()); await pg.waitForTimeout(1800);
  await pg.evaluate(() => { const m = document.getElementById('conflictModal'); if (m && m.classList.contains('open')) applyAllFromInv(); }); await pg.waitForTimeout(800);
  const D = await H.call('/__dump', undefined, 'GET'); const r = D.import_log.find(x => x.id === IV.id);
  const it0 = r.items_snapshot[0];
  ok(r.cost_customs == 60 && it0.alloc_unit > 12 && it0.alloc && it0.alloc.codes[0] === '9007.91.00' && it0.alloc.ctn[0] === 1, '④ محفوظ: الجمارك 60 · البند الأوّل alloc_unit ' + it0.alloc_unit + ' · بند 9007.91.00 · كرتونة 1');
  ok(Math.abs(it0.alloc_tot - (100 + 60 + 10 + 5)) < 0.02, '④ alloc_tot = مجموع تكاليف الفاتورة (يعرف النظام أنّ التوزيع صالح): ' + it0.alloc_tot);
  ok(!r.items_snapshot[4].alloc_unit, '④ الأصل بلا كلفة موزّعة');
  ok(r.items_snapshot.slice(0, 4).map(x => x.ctn).join(',') === '1,2,3,3' && r.items_snapshot[0].ctn_of === 3, '⑤ (seq A1021) الفاتورة مرتّبة بالكراتين وكلّ بندٍ برقم كرتونته: ' + r.items_snapshot.map(x => x.ctn || '—').join(','));
  const lbl = await pg.evaluate(() => { let got = null; const o = window.GMTLabels; window.GMTLabels = { openSheet: (items, opt) => { got = items.map(x => (x.group || x.grp || '') + ':' + x.name); return true; } }; try { printBarcodes(); } catch (_) {} window.GMTLabels = o; return got; });
  ok(lbl && lbl.length === 4 && /كرتونة 1/.test(lbl[0]) && /كرتونة 3/.test(lbl[3]), '⑤ الباركودات مجموعات بالكراتين بالترتيب: ' + JSON.stringify(lbl));
  const real = errs.filter(x => !/status of (400|401|404|406|409|503)|Failed to load resource/.test(x));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
