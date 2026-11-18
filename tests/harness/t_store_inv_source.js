// (TASK-B0526 · قرار المالك seq 824) المتجر يقرأ سعر القائمة المربوطة وكمّيتها من الجرد لحظة العرض — لا من نسخته المحفوظة
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const [A, B] = await H.call('/rest/v1/products', [{ name: 'إضاءة الجرد', barcode: 'IS0001', price: 55, haleb: 3, daraa: 2, germany: 9 }, { name: 'حقيبة الجرد', barcode: 'IS0002', price: 18, haleb: 0 }]);
  const cats = [{ id: 'c1', name: 'قسم', order: 1 }];
  await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-11-19T10:00:00Z', categories: cats, banners: [], offers: [],
    products: [{ id: 's1', name: 'إضاءة المتجر', price: 40, stock: 99, inv_id: A.id, category_id: 'c1', category_ids: ['c1'] },
               { id: 's2', name: 'حقيبة المتجر', price: 12, stock: 7, inv_id: B.id, category_id: 'c1', category_ids: ['c1'] },
               { id: 's3', name: 'منتج غير مربوط', price: 30, stock: 4, category_id: 'c1', category_ids: ['c1'] },
               { id: 's4', name: 'لوح بخيارات', price: 31.4, inv_id: A.id, category_id: 'c1', category_ids: ['c1'], options: [{ name: 'البطارية', values: [{ name: 'بدون', price: 31.4 }, { name: 'مع بطارية', price: 42.4 }] }] }] }]);
  const { browser, pg, errs } = await H.open('store.html', { w: 1366, h: 900, mobile: false, wait: 6500, init: H.STAFF_INIT + ';try{localStorage.removeItem("gmt_store_inv_v1")}catch(e){}' });
  await pg.waitForTimeout(1500);
  const P = await pg.evaluate(() => Object.fromEntries((store.products || []).map(p => [p.id, { price: Number(p.price), stock: p.stock }])));
  ok(P.s1 && Math.abs(P.s1.price - 55) < 0.02, 'السعر من الجرد (55 لا 40): ' + JSON.stringify(P.s1));
  ok(P.s1 && +P.s1.stock === 5, 'الكمّية = مجموع أعمدة الفروع (حلب 3 + درعا 2) بلا ألمانيا: ' + (P.s1 && P.s1.stock));
  ok(P.s2 && +P.s2.stock === 0, 'نفد في الجرد ⇒ نفد في المتجر (لا 7 المحفوظة): ' + (P.s2 && P.s2.stock));
  ok(P.s3 && Math.abs(P.s3.price - 30) < 0.02 && +P.s3.stock === 4, 'غير المربوط كما هو في المتجر');
  ok(P.s4 && Math.abs(P.s4.price - 31.4) < 0.02, 'القائمة بخيارات: سعر «ابتداءً من» يبقى كما في المتجر (لا يُستبدل بسعر الجرد): ' + JSON.stringify(P.s4));
  const real = errs.filter(e => !/status of (400|401|404|406)|Failed to load resource|favicon/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
