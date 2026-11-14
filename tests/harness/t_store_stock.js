// (TASK-B0414 · المالك seq 727) «الأوردر اللي فيه فاتورة من المتجر … فوراً ينخصم من المخزون بعد تنفيذه أو شحنه»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dump = () => H.call('/__dump', undefined, 'GET');
(async () => {
  await H.seed();
  await H.call('/rest/v1/products', [{ id: 'p-aaa', name: 'منتج أ', haleb: 10, homs: 5 }, { id: 'p-bbb', name: 'منتج ب', haleb: 4, homs: 4 }]);
  const mk = (extra) => Object.assign({ name: 'زبون المتجر', phone: '0933700002', status: 'pending', qty: 3, branch: 'المتجر الإلكتروني', product: 'سلة', price: 100, address: 'حمص',
    items_json: JSON.stringify([{ name: 'منتج أ', qty: 2, price: 30, product_id: 'p-aaa' }, { name: 'منتج ب', qty: 1, price: 40, product_id: 'p-bbb' }]) }, extra || {});
  const [o1] = await H.call('/rest/v1/gmt_orders', [mk()]);
  const [o2] = await H.call('/rest/v1/gmt_orders', [mk({ name: 'مربوط بفاتورة', invoice_number: 'INV-77', phone: '0933700003' })]);
  const [o3] = await H.call('/rest/v1/gmt_orders', [mk({ name: 'تجهيز من حمص', prepared_branch: 'homs', phone: '0933700004' })]);
  const { browser, pg, errs } = await H.open('orders.html', { w: 390, h: 844, mobile: true, wait: 5000, init: H.ADMIN_INIT });
  const ship = async id => { await pg.evaluate(i => { openShipModal(i); const s = document.getElementById('ship-company'); s.value = 'شوفير'; s.dispatchEvent(new Event('change', { bubbles: true })); document.getElementById('ship-tracking').value = '0944 555 666'; confirmShipping(); }, id); await sleep(2200); };
  await ship(o1.id);
  let d = await dump(); let pa = d.products.find(p => p.id === 'p-aaa'), pb = d.products.find(p => p.id === 'p-bbb'); let r1 = d.gmt_orders.find(x => x.id === o1.id);
  ok(r1.status === 'shipped', 'الشحن تمّ');
  ok(pa.haleb === 8 && pb.haleb === 3, 'خُصم المخزون من فرع الإدارة (حلب): أ 10→8 · ب 4→3 ⇐ ' + pa.haleb + '/' + pb.haleb);
  ok(r1.stock_deducted && r1.stock_deducted.state === 'done' && r1.stock_deducted.lines.length === 2 && r1.stock_deducted.branch === 'haleb', 'سجلّ الخصم محفوظ في الأوردر');
  // مرّة واحدة فقط
  const again = await pg.evaluate(async id => { const x = orders.find(q => q.id == id); x.stock_deducted = null; const r = await deductStoreOrderStock(x); return r; }, o1.id);
  d = await dump(); pa = d.products.find(p => p.id === 'p-aaa');
  ok(again.skipped && pa.haleb === 8, 'لا خصم مزدوج (الحجز الشرطيّ): ' + pa.haleb);
  // مربوطٌ بفاتورة ⇒ لا خصم
  await ship(o2.id); d = await dump(); pa = d.products.find(p => p.id === 'p-aaa');
  ok(pa.haleb === 8 && !d.gmt_orders.find(x => x.id === o2.id).stock_deducted, 'أوردرٌ مربوط بفاتورة نقطة بيع ⇒ لا يُخصم ثانيةً');
  // فرع التجهيز
  await ship(o3.id); d = await dump(); pa = d.products.find(p => p.id === 'p-aaa');
  ok(pa.homs === 3 && pa.haleb === 8, 'فرع التجهيز (حمص) هو من يُخصم: homs 5→3 ⇐ ' + pa.homs);
  // إعادة عند المرتجع
  const rec = d.gmt_orders.find(x => x.id === o1.id).stock_deducted;
  await pg.evaluate(async ([id, rec]) => { const x = orders.find(q => q.id == id); x.stock_deducted = rec; await restoreStoreOrderStock(x); }, [o1.id, rec]);
  d = await dump(); pa = d.products.find(p => p.id === 'p-aaa'); pb = d.products.find(p => p.id === 'p-bbb');
  ok(pa.haleb === 10 && pb.haleb === 4 && d.gmt_orders.find(x => x.id === o1.id).stock_deducted.restored_at, 'المرتجع ⇒ تُعاد الكمّيات: ' + pa.haleb + '/' + pb.haleb);
  const realErr = errs.filter(e => !/status of (400|401|404|406|409)|Failed to load resource|Estimating resolution/.test(e));
  ok(!realErr.length, 'لا أخطاء JS ' + realErr.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
