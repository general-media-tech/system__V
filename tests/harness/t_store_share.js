// (TASK-0286 · المالك seq 227) «من داخل نقطه البيع او الجرد يصير في عندي مشاركه رابطه على المتجر بدلا من العرض في المتجر ثم ندخل عليه ثم ننسخ الرابط»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const SHARE = `window.__shared=[];window.__copied=[];try{Object.defineProperty(navigator,'share',{configurable:true,value:function(d){window.__shared.push(d);return Promise.resolve();}});}catch(e){}`;
const NOSHARE = `window.__shared=[];window.__copied=[];try{Object.defineProperty(navigator,'share',{configurable:true,value:undefined});
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:function(t){window.__copied.push(t);return Promise.resolve();}}});}catch(e){}`;
const real = (errs) => errs.filter(e => !/status of (400|401|404|406)|Failed to load resource/.test(e));
const CUST = H.BASE + 'store.html#product=s_a';

(async () => {
  await H.seed();
  const [A, B, C] = await H.call('/rest/v1/products', [
    { name: 'عدسة مشاركة', barcode: 'SHR1', price: 50, wholesale_price: 30, haleb: 3, daraa: 3, group_name: 'g', category: 'c', store_url: '#product=s_a' },
    { name: 'منتج برابط قديم', barcode: 'SHR2', price: 40, wholesale_price: 30, haleb: 2, daraa: 2, group_name: 'g', category: 'c', store_url: H.BASE + 'store.html?direct=1#product=s_b' },
    { name: 'غير مربوط بالمتجر', barcode: 'SHR3', price: 30, wholesale_price: 20, haleb: 1, daraa: 1, group_name: 'g', category: 'c' }]);

  // ── نقطة البيع ──
  let o = await H.open('pos.html', { w: 390, h: 844, mobile: true, wait: 7000, init: H.STAFF_INIT + SHARE });
  await o.pg.evaluate(id => openProductDetail(id), A.id); await o.pg.waitForTimeout(500);
  const pos = await o.pg.evaluate(() => { const b = document.querySelector('#pd-content [data-store-share]'); const a = document.querySelector('#pd-content a[target="_blank"]');
    return { btn: !!b, label: b ? b.textContent.trim() : '', view: a ? a.href : '' }; });
  ok(pos.btn && /مشاركة رابطه/.test(pos.label), 'نقطة البيع: زرّ «مشاركة رابطه» بجانب «عرض في المتجر»');
  await o.pg.click('#pd-content [data-store-share]'); await o.pg.waitForTimeout(400);
  let sh = await o.pg.evaluate(() => window.__shared.slice());
  ok(sh.length === 1 && sh[0].url === CUST && sh[0].title === 'عدسة مشاركة', 'الضغطة ⇒ قائمة المشاركة برابط الزبون نفسه (بلا direct) واسم المنتج: ' + JSON.stringify(sh[0] || {}));
  ok(/[?&]direct=1/.test(pos.view), 'زرّ «عرض في المتجر» كما هو (يدخل المنتج فوراً داخل التطبيق)');
  await o.pg.evaluate(id => { closeProductDetail(); openProductDetail(id); }, B.id); await o.pg.waitForTimeout(400);
  await o.pg.click('#pd-content [data-store-share]'); await o.pg.waitForTimeout(400);
  sh = await o.pg.evaluate(() => window.__shared.slice());
  ok(sh[1] && sh[1].url === H.BASE + 'store.html#product=s_b', 'رابطٌ محفوظ فيه ?direct=1 ⇒ يُشارَك بدونه: ' + (sh[1] && sh[1].url));
  await o.pg.evaluate(id => { closeProductDetail(); openProductDetail(id); }, C.id); await o.pg.waitForTimeout(400);
  ok(await o.pg.evaluate(() => !document.querySelector('#pd-content [data-store-share]')), 'منتجٌ غير مربوط بالمتجر ⇒ لا زرّ مشاركة');
  ok(!real(o.errs).length, 'نقطة البيع: لا أخطاء JS ' + real(o.errs).slice(0, 2).join(' / '));
  await o.browser.close();

  // ── نقطة البيع بلا قائمة مشاركة (كمبيوتر) ⇒ نسخ ──
  o = await H.open('pos.html', { w: 1366, h: 900, mobile: false, wait: 7000, init: H.STAFF_INIT + NOSHARE });
  await o.pg.evaluate(id => openProductDetail(id), A.id); await o.pg.waitForTimeout(500);
  await o.pg.click('#pd-content [data-store-share]'); await o.pg.waitForTimeout(500);
  const cp = await o.pg.evaluate(() => ({ c: window.__copied.slice(), t: [...document.querySelectorAll('.toast')].map(x => x.textContent).join(' | ') }));
  ok(cp.c[0] === CUST && /نُسخ رابط المنتج في المتجر/.test(cp.t), 'بلا قائمة مشاركة ⇒ يُنسخ الرابط ويُقال ذلك: ' + JSON.stringify(cp));
  ok(!real(o.errs).length, 'نقطة البيع (كمبيوتر): لا أخطاء JS ' + real(o.errs).slice(0, 2).join(' / '));
  await o.browser.close();

  // ── الجرد ──
  o = await H.open('inventory.html', { w: 390, h: 844, mobile: true, wait: 5000, init: H.ADMIN_INIT + SHARE });
  await o.pg.evaluate(id => openDetailModal(id), A.id); await o.pg.waitForTimeout(600);
  ok(await o.pg.evaluate(() => !!document.querySelector('#detail-modal-body [data-store-share]')), 'الجرد: زرّ «مشاركة رابطه على المتجر» تحت «عرض المنتج في المتجر»');
  await o.pg.click('#detail-modal-body [data-store-share]'); await o.pg.waitForTimeout(400);
  sh = await o.pg.evaluate(() => window.__shared.slice());
  ok(sh.length === 1 && sh[0].url === CUST, 'الجرد: الضغطة ⇒ رابط الزبون: ' + (sh[0] && sh[0].url));
  await o.pg.evaluate(id => gmtManageProduct(id), A.id); await o.pg.waitForTimeout(300);
  const tiles = await o.pg.evaluate(() => [...document.querySelectorAll('#gmt-manage-ov [data-k]')].map(b => b.dataset.k));
  ok(tiles.includes('share') && tiles.includes('view'), 'الجرد: «إدارة هذا المنتج» فيها «مشاركة رابطه على المتجر» بجانب «عرض المنتج في المتجر»: ' + tiles.join(','));
  await o.pg.click('#gmt-manage-ov [data-k="share"]'); await o.pg.waitForTimeout(400);
  sh = await o.pg.evaluate(() => window.__shared.slice());
  ok(sh.length === 2 && sh[1].url === CUST && !(await o.pg.evaluate(() => !!document.getElementById('gmt-manage-ov'))), 'من القائمة ⇒ مشاركةٌ وتُغلق القائمة');
  await o.pg.evaluate(id => gmtManageProduct(id), C.id); await o.pg.waitForTimeout(300);
  ok(!(await o.pg.evaluate(() => !!document.querySelector('#gmt-manage-ov [data-k="share"]'))), 'منتجٌ غير مربوط ⇒ لا خيار مشاركة');
  ok(!real(o.errs).length, 'الجرد: لا أخطاء JS ' + real(o.errs).slice(0, 2).join(' / '));
  await o.browser.close();

  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
