// (TASK-B0422 · المالك seq 798) «البكج مفروض يكون متل أيّ منتج: يعرض كلّ صوره ووصفه وحتى المنتجات متفرّقة — من نقطة البيع»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const [A, B] = await H.call('/rest/v1/products', [{ name: 'كاميرا أ', barcode: 'OD-A', price: 400, net_cost: 200, daraa: 0, homs: 3 }, { name: 'عدسة ب', barcode: 'OD-B', price: 120, net_cost: 60, daraa: 4, homs: 4 }]);
  await H.call('/rest/v1/gmt_offers', [{ name: 'باقة التفاصيل', offer_type: 'bundle', offer_price: 450, is_active: true, description: 'سطر أول\nسطر ثانٍ من الوصف', image_url: H.BASE + 'logo.jpg', images: [H.BASE + 'logo.jpg', H.BASE + 'favicon.ico', H.BASE + 'gmt-icon-192.png'],
    products: JSON.stringify([{ id: A.id, name: 'كاميرا أ', qty: 1 }, { id: B.id, name: 'عدسة ب', qty: 2 }]), targets: { pos: true, store: true } }]);
  const o = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 7000 });
  const id = await o.pg.evaluate(() => (allProducts.find(p => p._is_offer) || {}).id);
  ok(!!id, 'العرض موجود في نقطة البيع ولو مكوّنه الأوّل صفر في فرع درعا');
  await o.pg.evaluate(i => openProductDetail(i), id); await o.pg.waitForTimeout(500);
  const d = await o.pg.evaluate(() => { const c = document.getElementById('pd-content'); const add = c.querySelector('.pd-add-btn');
    return { thumbs: c.querySelectorAll('#pd-offer-gal [data-th]').length, desc: /سطر أول/.test(c.textContent) && /سطر ثانٍ/.test(c.textContent), comps: /منتجات الباقة \(2\)/.test(c.textContent), names: /كاميرا أ/.test(c.textContent) && /عدسة ب/.test(c.textContent), warn: /غير متوفّر بالكمّية الكافية/.test(c.textContent), split: !!c.querySelector('[data-offer-split]'), addDisabled: !!(add && add.disabled) }; });
  ok(d.thumbs === 3, 'كلّ صور الباقة (3) في المعرض: ' + d.thumbs);
  ok(d.desc, 'الوصف كاملاً (سطران)');
  ok(d.comps && d.names, 'منتجات الباقة متفرّقةً بأسمائها');
  ok(d.warn, 'تنبيه النقص في الفرع ظاهر');
  ok(d.split && !d.addDisabled, 'زرّ «منتجات منفصلة» ظاهر وزرّ الإضافة غير معطَّل رغم نقص الفرع');
  await o.pg.evaluate(() => posOfferPick(1)); const src = await o.pg.evaluate(() => document.querySelector('#pd-offer-gal [data-main] img').getAttribute('src'));
  ok(/favicon\.ico/.test(src), "الضغط على مصغّرة يبدّل الصورة الكبيرة: " + src);
  await o.pg.evaluate(() => { document.querySelector('#pd-content [onclick*="openProductDetail"]').click(); }); await o.pg.waitForTimeout(700);
  ok(await o.pg.evaluate(() => /عدسة ب|كاميرا أ/.test(document.querySelector('#pd-content .pd-name').textContent) && !document.getElementById('pd-offer-gal')), 'الضغط على منتج داخل الباقة يفتح تفاصيل المنتج نفسه');
  const real = o.errs.filter(e => !/status of (400|401|404|406|409)|Failed to load resource|navigator.vibrate|Estimating/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
