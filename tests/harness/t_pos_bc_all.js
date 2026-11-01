// (TASK-0297 · المالك seq 313) «داخل نقطة البيع في لازم خيار طباعة باركود لكل المنتجات مع كمياتها»
// زرّ «☑️ كل منتجات فرعي بكمياتها» في نافذة «طباعة باركود» ⇒ كلّ منتج بكمية في الفرع · عدد الملصقات = الكمية · ما كميته صفر لا يُحدَّد
const H = require('./h.js');
let pass = 0, fails = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✔', m); } else { fails++; console.log('  ✘', m); } };
(async () => {
  await H.seed();
  await H.call('/rest/v1/products', [{ name: 'منتج نافد', barcode: 'BCZERO', price: 5, haleb: 3, daraa: 0 }, { name: 'منتج بلا كود', price: 7, daraa: 4 }]);
  const { browser, pg, errs } = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, h: 844, wait: 5000 });
  const errsBefore = errs.slice();
  const r = await pg.evaluate(async () => {
    openBarcodeModal(); await new Promise(r => setTimeout(r, 300));
    const btn = document.getElementById('bc-all-stock'); if (!btn) return { btn: false };
    btn.click(); await new Promise(r => setTimeout(r, 200));
    const v = Object.values(_bcSelectedProducts);
    return { btn: true, n: v.length, labels: v.reduce((s, x) => s + x.qty, 0), zero: v.some(x => x.name === 'منتج نافد'), noBc: v.filter(x => !x.barcode).length,
      sum: (document.getElementById('bc-sel-sum') || {}).textContent || '', gen: !document.getElementById('bc-generate-btn').disabled,
      branch: branch && branch.key, want: allProducts.filter(p => !p._is_offer && (Number(p[branch.key]) || 0) > 0).length };
  });
  ok(r.btn, 'الزرّ «☑️ كل منتجات فرعي بكمياتها» موجود في تبويب «منتجات فرعي»');
  ok(r.n === r.want && r.n >= 13, `كلّ منتجات الفرع (${r.branch}) بكمية ⇐ محدَّدة: ${r.n}/${r.want}`);
  ok(r.labels === 12 * 2 + 4, `عدد الملصقات = مجموع الكمّيات: ${r.labels}`);
  ok(!r.zero, 'المنتج الذي كميته في هذا الفرع صفر لا يُحدَّد');
  ok(r.noBc === 1 && /بلا باركود/.test(r.sum), 'المنتج بلا باركود يُذكر في الملخّص: ' + r.sum);
  ok(/13 منتج · 28 ملصق/.test(r.sum) && r.gen, 'الملخّص + زرّ الطباعة مفعّل: ' + r.sum);
  const r2 = await pg.evaluate(async () => { bcClearSel(); await new Promise(r => setTimeout(r, 100)); return { n: Object.keys(_bcSelectedProducts).length, gen: document.getElementById('bc-generate-btn').disabled }; });
  ok(r2.n === 0 && r2.gen, '«مسح التحديد» يفرغ الاختيار ويعطّل الطباعة');
  const mine = errs.filter(e => errsBefore.indexOf(e) === -1 && !/favicon/.test(e));
  console.log('    (قبل الضغط: ' + JSON.stringify(errsBefore) + ')');
  ok(!mine.length, 'لا أخطاء JS من الزرّ: ' + JSON.stringify(mine.slice(0, 3)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
