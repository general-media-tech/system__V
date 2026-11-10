// (TASK-0352 · المالك seq 526) «هذا الباور للهيد … تحط في الهيد خيار اخر اللي هو مع الباور … السعر الاساسي هو سعره»
// خيار «مع باور غريب» على صفحة الهيد ⇒ سعر الخيار = الهيد + الباور · الطلب = سطران مربوطان بالجرد (يُخصم الاثنان) · «الهيد وحده» = سطر واحد بالسعر الأساسي.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.01;
const dump = () => H.call('/__dump', undefined, 'GET');
const GUEST = `try{ localStorage.removeItem('gmt_session'); localStorage.removeItem('gmt_cart'); localStorage.setItem('gmt_notif_prompted','1'); }catch(e){}`;
(async () => {
  await H.seed();
  const HEAD = 'inv-head-zu60', GRIP = 'inv-grip-zu60';
  await H.call('/rest/v1/gmt_store', [{ id: 1, categories: [{ id: 'c1', name: 'إضاءة' }], banners: [], products: [
    { id: 's_zu60', name: 'Zu 60 هيد', price: 130, stock: 8, inv_id: HEAD, barcode: 'B-HEAD', category_ids: ['c1'], images: [],
      options: [{ type: 'الإصدار', affectsPrice: true, values: [
        { name: 'الهيد وحده', price: 130, inv_id: HEAD, barcode: 'B-HEAD' },
        { name: 'مع باور غريب', price: 165, inv_id: HEAD, barcode: 'B-HEAD', with: [{ inv_id: GRIP, name: 'بور غريب zu 60', barcode: 'B-GRIP', qty: 1, price: 35 }] }] }] },
    { id: 's_grip', name: 'بور غريب zu 60', price: 35, stock: 7, inv_id: GRIP, category_ids: ['c1'], images: [] }] }]);
  const { browser, pg, errs } = await H.open('store.html', { init: GUEST, w: 1366, h: 900, wait: 5000 });
  const pick = async nm => { await pg.evaluate(() => openProductModal('s_zu60')); await pg.waitForTimeout(700);
    await pg.evaluate(n => { const b = [...document.querySelectorAll('#product-modal-variants button')].find(x => x.textContent.includes(n)); b && b.click(); }, nm); await pg.waitForTimeout(250);
    const price = await pg.evaluate(() => document.getElementById('product-modal-price').dataset.selectedPrice);
    await pg.evaluate(() => productModalAddToCart()); await pg.waitForTimeout(300); await pg.evaluate(() => closeModal('product-modal')); await pg.waitForTimeout(300); return price; };
  const p1 = await pick('مع باور غريب');
  ok(near(p1, 165), 'اختيار «مع باور غريب» ⇒ السعر 165 (130 الهيد + 35 الباور): ' + p1);
  await pg.evaluate(() => submitOrder('زبون هيد مع باور', '0933000111', 'حلب', '', 'cod')); await pg.waitForTimeout(2500);
  let D = await dump(); let o = (D.gmt_orders || []).find(x => x.name === 'زبون هيد مع باور'); let it = o ? JSON.parse(o.items_json || '[]') : [];
  ok(it.length === 2 && it[0].product_id === HEAD && near(it[0].price, 130) && it[1].product_id === GRIP && near(it[1].price, 35), 'الطلب سطران مربوطان بالجرد: الهيد 130 + الباور 35: ' + it.map(x => x.name + ' ' + x.qty + '×' + x.price + ' ‹' + x.product_id + '›').join(' | '));
  ok(o && /مع باور غريب/.test(o.product) && near(o.price, 165 + await pg.evaluate(() => DELIVERY_FEE)), 'نصّ الطلب يذكر الخيار · الإجمالي 165 + التوصيل: ' + (o && o.product));
  const p2 = await pick('الهيد وحده');
  await pg.evaluate(() => { store.cart.forEach(i => { i.qty = 2; }); });
  await pg.evaluate(() => submitOrder('زبون هيد وحده', '0933000112', 'حلب', '', 'cod')); await pg.waitForTimeout(2500);
  D = await dump(); o = (D.gmt_orders || []).find(x => x.name === 'زبون هيد وحده'); it = o ? JSON.parse(o.items_json || '[]') : [];
  ok(near(p2, 130) && it.length === 1 && it[0].product_id === HEAD && near(it[0].price, 130) && it[0].qty === 2, '«الهيد وحده» ⇒ السعر الأساسي 130 · سطر واحد ×2: ' + JSON.stringify(it.map(x => [x.qty, x.price, x.product_id])));
  const real = errs.filter(x => !/Failed to load resource|status of (400|404|406)/.test(x));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 3)));
  await browser.close();
  console.log(fails ? 'FAIL ' + fails + ' / ' + (pass + fails) : 'ALL PASS (' + pass + ')');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
