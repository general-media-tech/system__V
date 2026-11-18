// (TASK-B0525 · تنبيه الحارس «نموذج بيانات المتجر: آخر كتابة تفوز») حفظ الأدمن لا يمحو ما عدّله/حذفه جهازٌ آخر منذ فتح الصفحة،
// والكتابة مشروطة بنسخة الكتالوج (updated_at) — تغيّرت بين القراءة والكتابة ⇒ يُعاد الدمج
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const store = () => H.call('/rest/v1/gmt_store?id=eq.1&select=*', undefined, 'GET').then(r => r[0]);
(async () => {
  await H.seed();
  const cats = [{ id: 'c1', name: 'قسم', order: 1 }];
  const prods = [{ id: 'a', name: 'منتج أ', price: 10, category_id: 'c1', category_ids: ['c1'] }, { id: 'b', name: 'منتج ب', price: 20, category_id: 'c1', category_ids: ['c1'] },
    { id: 'c', name: 'منتج ج', price: 30, category_id: 'c1', category_ids: ['c1'] }];
  await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-11-19T10:00:00Z', categories: cats, products: prods, banners: [], offers: [] }]);
  const { browser, pg, errs } = await H.open('admin_store.html', { w: 1366, h: 900, mobile: false, wait: 5500 });
  /* جهازٌ آخر بعد فتح الصفحة: غيّر سعر «ب» وحذف «ج» وأضاف «د» */
  await H.call('/rest/v1/gmt_store?id=eq.1', { updated_at: '2026-11-19T10:05:00Z', products: [prods[0], Object.assign({}, prods[1], { price: 25 }), { id: 'd', name: 'منتج د', price: 40, category_id: 'c1', category_ids: ['c1'] }] }, 'PATCH');
  /* هنا: نعدّل اسم «أ» ونحفظ */
  await pg.evaluate(() => openProdModal('a')); await pg.waitForTimeout(400);
  await pg.evaluate(() => { document.getElementById('prod-name').value = 'منتج أ معدَّل'; saveProduct(); }); await pg.waitForTimeout(1800);
  const st = await store(), P = Object.fromEntries((st.products || []).map(p => [p.id, p]));
  ok(P.a && P.a.name === 'منتج أ معدَّل', 'تعديلي على «أ» حُفظ: ' + (P.a && P.a.name));
  ok(P.b && +P.b.price === 25, 'سعر «ب» من الجهاز الآخر بقي 25 (لا يُكتب فوقه): ' + (P.b && P.b.price));
  ok(!P.c, '«ج» المحذوف من الجهاز الآخر لم يُعَد');
  ok(!!P.d, '«د» المضاف من الجهاز الآخر بقي');
  ok(st.updated_at && st.updated_at !== '2026-11-19T10:05:00Z', 'نسخة الكتالوج تقدّمت بعد الحفظ: ' + st.updated_at);
  const real = errs.filter(e => !/status of (400|401|404|406)|Failed to load resource|favicon/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
