// (TASK-A0590 · المالك seq A1131/A1137) نافذة «طباعة باركود» في نقطة البيع: بحث بالاسم/الباركود/العدسة · عدد الباركودات لكلّ منتج · زرّ طابعة الملصقات
// + لا خروج عن الإطار (لا تمرير أفقي) عند 360px لنافذة الباركود ونافذة Phomemo وعدسة GMT
const H = require('./h.js');
let pass = 0, fails = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✔', m); } else { fails++; console.log('  ✘', m); } };
const OVER = `(root) => { const vw = innerWidth, bad = []; if (document.documentElement.scrollWidth > vw) bad.push('doc:' + document.documentElement.scrollWidth);
  (root ? root.querySelectorAll('*') : []).forEach(e => { const r = e.getBoundingClientRect(); if (r.width && (r.right > vw + 1 || r.left < -1) && getComputedStyle(e).position !== 'fixed') bad.push((e.tagName + '.' + (e.className || '') + '#' + (e.id || '') + ':' + Math.round(r.left) + '..' + Math.round(r.right)).slice(0, 60)); });
  return bad.slice(0, 6); }`;
(async () => {
  await H.seed();
  await H.call('/rest/v1/products', [{ name: 'منتج نادر للاختبار طويل الاسم جداً جداً جداً لاختبار الالتفاف على الهاتف', barcode: 'ZZ998877', price: 5, daraa: 3, haleb: 2 }]);
  const { browser, pg, errs } = await H.open('pos.html', { init: H.STAFF_INIT, w: 360, h: 740, wait: 5000 });
  const sel = () => pg.evaluate(() => Object.values(_bcSelectedProducts).map(x => ({ n: x.name, b: x.barcode, q: x.qty })));
  await pg.evaluate(async () => { openBarcodeModal(); await new Promise(r => setTimeout(r, 300)); });
  ok(await pg.evaluate(() => !!document.getElementById('bc-lens-btn') && !!document.getElementById('bc-phomemo-btn')), 'زرّ العدسة 📷 وزرّ «📶 طابعة الملصقات» موجودان');
  ok(await pg.evaluate(() => document.getElementById('bc-phomemo-btn').disabled), 'زرّ الطابعة معطّل بلا تحديد');
  // بحث بالاسم
  await pg.fill('#bc-search', 'كاميرا تجربة 3'); await pg.waitForTimeout(200);
  const byName = await pg.evaluate(() => document.querySelectorAll('#bc-product-list input[type=checkbox]').length);
  ok(byName >= 1 && byName < 12, 'البحث بالاسم يصفّي القائمة: ' + byName);
  // بحث بالباركود
  await pg.fill('#bc-search', 'BC0005'); await pg.waitForTimeout(200);
  ok(await pg.evaluate(() => /BC0005/.test(document.getElementById('bc-product-list').innerText)), 'البحث بالباركود يجد المنتج');
  // سكانر: كتابة الباركود + Enter ⇒ تحديد المنتج
  await pg.press('#bc-search', 'Enter'); await pg.waitForTimeout(200);
  const s1 = await sel();
  ok(s1.length === 1 && s1[0].b === 'BC0005', 'Enter بعد باركودٍ تامّ يحدّد المنتج: ' + JSON.stringify(s1));
  ok(await pg.evaluate(() => !document.getElementById('bc-phomemo-btn').disabled && !document.getElementById('bc-generate-btn').disabled), 'الزرّان يُفعَّلان بعد التحديد');
  const want = await pg.evaluate(() => Math.max(1, Number(allProducts.find(p => p.barcode === 'BC0005')[branch.key]) || 1));
  ok(s1.length && s1[0].q === want, 'العدد الافتراضي = مخزون الفرع (أو 1): ' + (s1[0] && s1[0].q) + '/' + want);
  // تغيير العدد بالحقل وبالخطوة
  await pg.fill('#bc-product-list input[data-bc-qty]', '7'); await pg.waitForTimeout(100);
  ok((await sel())[0].q === 7, 'الحقل يغيّر عدد الباركودات إلى 7');
  await pg.click('#bc-product-list button[aria-label="زِد"]'); await pg.waitForTimeout(100);
  ok((await sel())[0].q === 8, 'زرّ + يزيدها: 8');
  const sum = await pg.evaluate(() => document.getElementById('bc-sel-sum').textContent);
  ok(/8 ملصق/.test(sum), 'الملخّص: ' + sum);
  // عدد الملصقات المولَّدة
  const gen = await pg.evaluate(() => { let got = null; window.GMTLabels = { openSheet: (items) => { got = items; return true; } }; generateBarcodeSheet(); return got; });
  ok(gen && gen.length === 1 && gen[0].qty === 8 && gen[0].barcode === 'BC0005', 'توليد وطباعة يمرّر العدد 8: ' + JSON.stringify(gen));
  // العدسة
  await pg.evaluate(async () => { openBarcodeModal(); await new Promise(r => setTimeout(r, 200)); window.__lens = null; window.__realLens = window.GMTLens; window.GMTLens = Object.assign({}, window.GMTLens, { open: (ctx) => { window.__lens = ctx; } }); });
  await pg.click('#bc-lens-btn'); await pg.waitForTimeout(100);
  ok(await pg.evaluate(() => !!(window.__lens && typeof window.__lens.onPick === 'function')), 'زرّ 📷 يستدعي GMTLens.open بـ onPick');
  await pg.evaluate(() => window.__lens.onPick(allProducts.find(p => p.barcode === 'ZZ998877'), {}));
  await pg.waitForTimeout(200);
  const s2 = await sel();
  ok(s2.length === 1 && s2[0].b === 'ZZ998877' && s2[0].q === 3, 'اختيار العدسة يحدّد المنتج بعدده الافتراضي: ' + JSON.stringify(s2));
  // Phomemo: عناصر × أعداد
  await pg.evaluate(() => { document.getElementById('bc-search').value = ''; const id = String(allProducts.find(p => p.barcode === 'BC0001').id); toggleBcProduct(id, true); updateBcQty(id, '4'); });
  const ph = await pg.evaluate(() => { let got = null; window.GMTPhomemo = { open: (items) => { got = items; } }; bcPhomemo(); return got; });
  ok(ph && ph.length === 2 && ph.find(x => x.barcode === 'BC0001').qty === 4 && ph.find(x => x.barcode === 'ZZ998877').qty === 3, 'زرّ الطابعة يبني العناصر بأعدادها: ' + JSON.stringify(ph));
  ok(await pg.evaluate(() => document.getElementById('barcode-modal').style.display === 'none'), 'تُغلق نافذة الباركود عند فتح نافذة الطابعة');
  // لا تجاوز عند 360
  await pg.evaluate(() => { delete window.GMTPhomemo; openBarcodeModal(); switchBarcodeTab('manual'); bcSelectAllStock(); });
  await pg.waitForTimeout(300);
  let o = await pg.evaluate(`(${OVER})(document.getElementById('barcode-modal'))`);
  ok(!o.length, 'نافذة الباركود بلا تجاوز أفقيّ عند 360px: ' + JSON.stringify(o));
  ok(await pg.evaluate(() => document.getElementById('bc-generate-btn').getBoundingClientRect().bottom <= innerHeight + 1), 'زرّ «توليد وطباعة» ضمن الشاشة');
  // نافذة Phomemo الحقيقية
  await pg.evaluate(() => { closeBarcodeModal(); });
  await pg.addScriptTag({ url: H.BASE + 'gmt-phomemo.js?t=' + Date.now() }); await pg.waitForTimeout(100);
  await pg.evaluate(() => { GMTPhomemo.open([{ name: 'منتج نادر للاختبار طويل الاسم جداً جداً جداً لاختبار الالتفاف على الهاتف', barcode: 'ZZ998877', qty: 3 }, { name: 'ب', barcode: 'BC0002', qty: 2 }]); });
  await pg.waitForTimeout(1200);
  o = await pg.evaluate(`(${OVER})(document.getElementById('gmt-pm'))`);
  ok(!o.length, 'نافذة Phomemo بلا تجاوز أفقيّ عند 360px: ' + JSON.stringify(o));
  const g2 = await pg.evaluate(() => { const b = document.querySelector('#gmt-pm [data-box]'), go = document.querySelector('#gmt-pm [data-go]').getBoundingClientRect(); return { h: Math.round(b.getBoundingClientRect().height), go: go.bottom <= innerHeight + 1 && go.top >= 0, body: !!document.querySelector('#gmt-pm [data-body]') }; });
  ok(g2.go && g2.body && g2.h <= 740, 'شريط «اطبع» ضمن الشاشة وجسم النافذة قابل للتمرير: ' + JSON.stringify(g2));
  await pg.evaluate(() => document.getElementById('gmt-pm').remove());
  // عدسة GMT الحقيقية
  await pg.evaluate(() => { window.GMTLens = window.__realLens; try { GMTLens.open({ products: () => allProducts, branchKey: branch.key, onPick() {} }); } catch (e) {} });
  await pg.waitForTimeout(800);
  if (await pg.evaluate(() => !!document.getElementById('gmt-lens'))) {
    o = await pg.evaluate(`(${OVER})(document.getElementById('gmt-lens'))`);
    ok(!o.length, 'عدسة GMT بلا تجاوز أفقيّ عند 360px: ' + JSON.stringify(o));
  } else ok(false, 'تعذّر فتح العدسة للفحص');
  // ورقة الملصقات (gmt-labels.js) على شاشة هاتف: معاينة A4 مصغَّرة بلا تمرير أفقيّ
  await pg.addScriptTag({ url: H.BASE + 'gmt-labels.js?t=' + Date.now() });
  const html = await pg.evaluate(b => GMTLabels.sheetHtml(GMTLabels.expand([{ name: 'A', barcode: '111111', qty: 3 }]), { base: b }), H.BASE);
  const p2 = await pg.context().newPage(); await p2.setViewportSize({ width: 360, height: 740 }); await p2.goto(H.BASE + 'robots.txt').catch(() => {}); await p2.setContent(html); await p2.waitForTimeout(800);
  const sw = await p2.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  ok(sw[0] <= sw[1], 'ورقة الملصقات بلا تمرير أفقيّ عند 360px: ' + sw.join('/'));
  await p2.close();
  const mine = errs.filter(e => !/Failed to load resource|favicon|getUserMedia|NotAllowed|NotFound|Permission/i.test(e));
  ok(!mine.length, 'لا أخطاء JS: ' + JSON.stringify(mine.slice(0, 3)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
