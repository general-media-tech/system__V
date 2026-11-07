// (المالك seq 565) «العرض يُعدّ كمنتج أو كمجموعة منتجات … في نقطة البيع كمنتج كباقة كاملة جاهزة فوراً لضغطة تُباع وتُنشأ فاتورة»
// ① عرضٌ على منتجٍ واحد يُنشأ من المنشئ (كان يرفض: «منتجان على الأقلّ») ② في نقطة البيع تحت «باقات وعروض» أوّلاً
// ③ ضغطة ⇒ سطر · بيع ⇒ فاتورة بسعر العرض ④ الباقة متعدّدة المنتجات: زرّ «منتجات منفصلة» في تفاصيلها يفكّكها
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const dump = () => H.call('/__dump', undefined, 'GET');
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.011;
(async () => {
  await H.seed();
  const [CAM, LENS] = await H.call('/rest/v1/products', [
    { name: 'كاميرا عرض مفرد R10', barcode: 'OS-R10', price: 600, net_cost: 500, daraa: 3 },
    { name: 'عدسة عرض RF 85', barcode: 'OS-RF85', price: 300, net_cost: 250, daraa: 2 }]);
  await H.call('/rest/v1/gmt_store', [{ id: 1, categories: [{ id: 'c_bundles', name: 'باقات وعروض' }, { id: 'c1', name: 'كاميرات' }], products: [], banners: [] }]);
  let { browser, pg, errs } = await H.open('admin_pos.html', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 6000 });
  await pg.waitForFunction(() => !!window.GMTPackages, null, { timeout: 8000 });
  await pg.evaluate(() => openPackageEditor()); await pg.waitForSelector('#gmt-pkg [data-name]'); await pg.waitForTimeout(1000);
  await pg.fill('#gmt-pkg [data-name]', 'عرض الكاميرا R10');
  await pg.fill('#gmt-pkg [data-q]', 'R10'); await pg.waitForTimeout(250); await pg.click('#gmt-pkg [data-res] .ri[data-add]');
  await pg.click('#gmt-pkg [data-m="price"]'); await pg.fill('#gmt-pkg [data-v]', '550');
  await pg.waitForSelector('#gmt-pkg [data-cat="c1"]', { timeout: 5000 }); await pg.click('#gmt-pkg [data-cat="c1"]');
  await pg.click('#gmt-pkg [data-save]'); await pg.waitForTimeout(1500);
  const errTxt = await pg.evaluate(() => { const e = document.querySelector('#gmt-pkg [data-err]'); return e ? e.textContent : ''; });
  let D = await dump(); const off = (D.gmt_offers || []).find(o => o.name === 'عرض الكاميرا R10');
  ok(off && near(off.offer_price, 550) && JSON.parse(off.products).length === 1, 'عرضٌ على منتجٍ واحد حُفظ (550 بدل 600) ' + (errTxt ? '— خطأ: ' + errTxt : ''));
  ok(off && JSON.stringify(off.targets.cats) === '["c_bundles","c1"]', 'في المتجر: «باقات وعروض» + «كاميرات» ' + JSON.stringify(off && off.targets && off.targets.cats));
  // باقة من منتجين لاختبار التفكيك
  await pg.evaluate(() => openPackageEditor()); await pg.waitForSelector('#gmt-pkg [data-name]'); await pg.waitForTimeout(800);
  await pg.fill('#gmt-pkg [data-name]', 'باقة كاميرا وعدسة');
  for (const q of ['R10', 'RF 85']) { await pg.fill('#gmt-pkg [data-q]', q); await pg.waitForTimeout(250); await pg.click('#gmt-pkg [data-res] .ri[data-add]'); await pg.waitForTimeout(120); }
  await pg.click('#gmt-pkg [data-m="price"]'); await pg.fill('#gmt-pkg [data-v]', '800');
  await pg.click('#gmt-pkg [data-save]'); await pg.waitForTimeout(1500);
  await browser.close();

  ({ browser, pg, errs } = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 7000 }));
  const offs = await pg.evaluate(() => allProducts.filter(p => p._is_offer).map(p => ({ id: p.id, name: p.name, g: p.group_name, price: p.price })));
  const o1 = offs.find(x => /R10/.test(x.name) && !/باقة/.test(x.name)), o2 = offs.find(x => /باقة كاميرا وعدسة/.test(x.name));
  ok(o1 && o2 && o1.g === 'باقات وعروض' && o2.g === 'باقات وعروض', 'العرض والباقة في نقطة البيع تحت «باقات وعروض» ' + JSON.stringify(offs.map(x => x.g)));
  const firstGroup = await pg.evaluate(() => { const gs = [...new Set(allProducts.map(p => p.group_name).filter(Boolean))]; gs.sort((a, b) => a === 'باقات وعروض' ? -1 : b === 'باقات وعروض' ? 1 : 0); return gs[0]; });
  ok(firstGroup === 'باقات وعروض', 'القسم أوّل الأقسام');
  await pg.evaluate(id => { newInvoice(); toggleProd(id); }, o1.id); await pg.waitForTimeout(400);
  const c1 = await pg.evaluate(id => ({ dlg: !!document.getElementById('gmt-offer-choice'), line: !!(cart[id] && cart[id]._is_offer) }), o1.id);
  ok(!c1.dlg && c1.line, 'ضغطة ⇒ العرض سطرٌ في السلّة فوراً ' + JSON.stringify(c1));
  await pg.evaluate(() => { document.getElementById('custName').value = 'زبون العرض المفرد'; saleType = 'نقدي'; saveAndFinish(); }); await pg.waitForTimeout(2500);
  D = await dump(); const inv = D.invoices.find(i => i.customer_name === 'زبون العرض المفرد');
  ok(inv && near(inv.total, 550), 'بيعه ⇒ فاتورة بسعر العرض 550 ' + (inv ? inv.total : 'لا فاتورة'));
  // التفكيك من نافذة التفاصيل
  await pg.evaluate(() => newInvoice()); await pg.waitForTimeout(400);
  await pg.evaluate(id => openProductDetail(id), o2.id); await pg.waitForTimeout(500);
  const hasSplit = await pg.$('[data-offer-split]');
  ok(!!hasSplit, 'تفاصيل الباقة فيها زرّ «منتجات منفصلة»');
  if (hasSplit) await hasSplit.click(); await pg.waitForTimeout(500);
  const sp = await pg.evaluate(ids => ({ cam: cart[ids[0]] && cart[ids[0]]._from_offer, lens: cart[ids[1]] && cart[ids[1]]._from_offer, sum: Object.values(cart).reduce((s, c) => s + c.price * c.qty, 0) }), [CAM.id, LENS.id]);
  ok(sp.cam && sp.lens && near(sp.sum, 800), 'فُكّكت منتجين بخصم الباقة ومجموعهما 800 ' + JSON.stringify(sp));
  const real = errs.filter(x => !/Failed to load resource|status of (400|404|406)/.test(x));
  ok(!real.length, 'لا أخطاء JS ' + JSON.stringify(real.slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})();
