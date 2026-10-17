const H = require('./h.js');
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); return !!c; };
const dump = async () => await H.call('/__dump', undefined, 'GET');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function seed(haleb, n = 4) {
  await H.call('/__reset', {});
  await H.call('/__opts', { reject_cols: [], unique_order_invoice: true, old_rpc_false: false, rls_block: [], no_pos_fn: false, sov: '2003', pos_protected: true, pos_locked: false });
  await H.call('/rest/v1/inv_columns', [['haleb', 'حلب'], ['daraa', 'درعا']].map(([k, nm], i) => ({ key_name: k, display_name: nm, col_type: 'number', include_in_total: true, is_branch: true, show_form: true, show_table: true, sort_order: i })));
  return await H.call('/rest/v1/products', Array.from({ length: n }, (_, i) => ({ name: `منتج ${i}`, barcode: `BC${i}`, price: 100 + i, wholesale_price: 80, cost_price: 60, haleb: haleb[i] ?? 10, daraa: 2, in_transit: {} })));
}
async function open(w = 1366, mobile = false) {
  const r = await H.open('inventory.html', { init: H.ADMIN_INIT, w, h: 900, wait: 5500, mobile });
  await r.pg.evaluate(() => { switchAppMode('transfer'); });
  return r;
}
async function create(pg, ids, qs, raiseAnswer = false) {
  await pg.evaluate(([ids, qs, ans]) => {
    window.GMTAsk.choose = async () => (ans ? 'raise' : 'avail'); window.GMTAsk.confirm = async () => false; window.GMTAsk.alert = async () => true; window.GMTAsk.prompt = async () => 'سبب تجريبي';
    openNewStockTransferModal();
    document.getElementById('st-from-select').value = 'haleb'; document.getElementById('st-to-select').value = 'daraa';
    onStBranchChange(); stState.items = {};
    ids.forEach(id => stAddProduct(id));
    ids.forEach((id, i) => { stState.items[id].qty = qs[i]; stState.items[id].maxAvail = Math.max(stState.items[id].maxAvail || 0, qs[i]); });
    document.getElementById('st-creator-name').value = 'فاحص';
  }, [ids, qs, raiseAnswer]);
  await pg.evaluate(() => saveStockTransfer()); await sleep(2500);
}
(async () => {
  // ═══ S1: نقص في المصدر ⇒ خصم المتاح فقط + وسم ═══
  let prods = await seed([10, 10, 10, 3]);
  let { browser, pg, errs } = await open();
  const ids = prods.map(p => p.id);
  await create(pg, ids, [3, 4, 5, 6], false);
  let d = await dump(); const T = d.branch_stock_transfers[0];
  const items = d.stock_transfer_items;
  console.log('S1', JSON.stringify({ st: T.status, note: T.note, items: items.map(i => [i.product_name, i.qty, i.requested_qty, i.deduction_failed]), haleb: d.products.map(p => p.haleb) }));
  ok(T.status === 'needs_settlement' && /منتج 3/.test(T.note), 'S1 الفاتورة موسومة «تحتاج تسوية» وفي ملاحظتها الصنف الناقص');
  const i3 = items.find(i => i.product_name === 'منتج 3');
  ok(i3.qty === 3 && i3.requested_qty === 6 && i3.deduction_failed === true, 'S1 البند الناقص: المنقول 3 والمطلوب 6 موسوم فاشلاً (لا يُسجَّل 6 وهمياً)');
  ok(d.products.map(p => p.haleb).join() === '7,6,5,0', 'S1 المصدر خُصم بالمتاح فقط: 7,6,5,0');
  // قائمة الفواتير: نقطة حمراء
  await pg.evaluate(() => { renderStockTransferList(); });
  const dot = await pg.evaluate(() => !!document.querySelector('#transfer-panel-list .st-dot'));
  ok(dot, 'S1 النقطة الحمراء ظاهرة على الفاتورة في القائمة');
  // ═══ S2: لوحة التسوية ═══
  await pg.evaluate(([id]) => stOpenSettlements(), [T.id]); await sleep(1500);
  const panel = await pg.evaluate(() => document.getElementById('st-settle-body').innerText.replace(/\s+/g, ' '));
  console.log('S2 panel:', panel.slice(0, 400));
  ok(/منتج 3/.test(panel) && /المطلوب\s*6/.test(panel) && /المنقول\s*3/.test(panel) && /الناقص\s*3/.test(panel), 'S2 اللوحة تعرض المطلوب 6 · المنقول 3 · الناقص 3');
  await pg.screenshot({ path: 'tr_settle_1366.png' });
  // «انقل المتاح» لا يتوفر (المتاح 0) ⇒ نحاول ونتوقع رفضاً بلا تغيير
  let r = await pg.evaluate(([a, b]) => stFill(a, b, 'avail'), [String(i3.id), String(T.id)]); await sleep(500);
  d = await dump();
  ok(r && !r.ok && d.products.find(p => p.name === 'منتج 3').haleb === 0, 'S2 «انقل المتاح» مع مخزون صفر يُرفض بلا لمس المخزون');
  // رفع المصدر (أدمن) ثم إكمال
  r = await pg.evaluate(([a, b]) => stFill(a, b, 'raise'), [String(i3.id), String(T.id)]); await sleep(1500);
  d = await dump();
  const after3 = d.stock_transfer_items.find(i => i.product_name === 'منتج 3'); const T2 = d.branch_stock_transfers[0];
  console.log('S2 بعد الرفع:', JSON.stringify({ r, qty: after3.qty, req: after3.requested_qty, failed: after3.deduction_failed, st: T2.status, note: T2.note, haleb3: d.products.find(p => p.name === 'منتج 3').haleb, audit: (d.gmt_audit || []).filter(a => /raised|fill/.test(a.action || '')).length }));
  ok(r && r.ok && after3.qty === 6 && after3.deduction_failed === false, 'S2 بعد «ارفع المصدر وأضِف»: وصل البند بأعدادك (6 من 6)');
  ok(T2.status === 'pending' && !T2.note, 'S2 الفاتورة عادت تلقائياً «في الطريق» والملاحظة نُظِّفت');
  ok(d.products.find(p => p.name === 'منتج 3').haleb === 0, 'S2 مخزون المصدر 0 (رُفع 3 ثم خُصم 3) — لا تضخّم');
  // ضغطة ثانية آمنة (لا تضاعف)
  r = await pg.evaluate(([a, b]) => stFill(a, b, 'avail'), [String(i3.id), String(T.id)]); await sleep(500);
  d = await dump();
  ok(r && r.noop && d.stock_transfer_items.find(i => i.product_name === 'منتج 3').qty === 6 && d.products.find(p => p.name === 'منتج 3').haleb === 0, 'S2 ضغطة ثانية: لا خصم إضافي (noop)');
  // ═══ S3: الاستلام يضيف المنقول فقط ═══
  await pg.evaluate(async (id) => { await loadStockTransfers(); document.getElementById('st-received-by')?.setAttribute('value', 'x'); }, T.id);
  await pg.evaluate(async (id) => { await openStockTransferDetail(id); document.getElementById('st-received-by').value = 'مستلم'; await stConfirmReceived(id, null); }, T.id); await sleep(2500);
  d = await dump();
  console.log('S3', JSON.stringify({ st: d.branch_stock_transfers[0].status, daraa: d.products.map(p => p.daraa) }));
  ok(d.branch_stock_transfers[0].status === 'received' && d.products.map(p => p.daraa).join() === '5,6,7,8', 'S3 الاستلام أضاف 3,4,5,6 للوجهة (2+) = 5,6,7,8 — لا ضعف');
  await browser.close();

  // ═══ S4: فاتورة قديمة بلا أعمدة «المطلوب» (الحالة التي رأيتَها) ═══
  prods = await seed([10, 10, 10, 10]);
  ({ browser, pg, errs } = await open());
  const hdr = await H.call('/rest/v1/branch_stock_transfers', [{ transfer_number: 'TRF-00009', from_branch: 'haleb', from_branch_name: 'حلب', to_branch: 'daraa', to_branch_name: 'درعا', status: 'needs_settlement', note: 'تعذّر خصم 2 صنف: منتج 1، منتج 2', created_by: 'x', created_at: new Date().toISOString() }]);
  await H.call('/rest/v1/stock_transfer_items', prods.map((p, i) => ({ transfer_id: hdr[0].id, product_id: p.id, product_name: p.name, qty: 2, unit_cost: 60, sale_price: 100 })));
  await pg.evaluate(() => { window.GMTAsk.confirm = async () => true; window.GMTAsk.alert = async () => true; window.GMTAsk.prompt = async () => 'سبب'; });
  // الاستلام قبل التسوية يجب ألا يضيف الأصناف الفاشلة للوجهة
  const R = await pg.evaluate(async ([id]) => { const r = await GMTStock.receiveTransfer({ transferId: id, toBranch: 'daraa' }); return { added: r.added.map(a => a.name), waiting: r.waiting.map(a => a.name) }; }, [hdr[0].id]);
  console.log('S4 receive-before-settle:', JSON.stringify(R));
  ok(R.waiting.join() === 'منتج 1,منتج 2' && R.added.join() === 'منتج 0,منتج 3', 'S4 الاستلام يتخطّى الأصناف الفاشلة (المقروءة من الملاحظة) فلا تضاعف الوجهة');
  d = await dump();
  // أعد الاستلام للتجربة التالية: صفّر حالة الاستلام
  await H.call('/rest/v1/stock_transfer_items', { received_at: null, failed_reason: null }, 'PATCH');
  await H.call('/rest/v1/products', { daraa: 2 }, 'PATCH');
  await pg.evaluate(() => stOpenSettlements()); await sleep(1500);
  const panel4 = await pg.evaluate(() => document.getElementById('st-settle-body').innerText.replace(/\s+/g, ' '));
  console.log('S4 panel:', panel4.slice(0, 380));
  ok(/منتج 1/.test(panel4) && /منتج 2/.test(panel4) && !/منتج 0/.test(panel4) && /SQL|requested_qty/.test(panel4), 'S4 اللوحة تعرض الصنفين الفاشلين فقط + تنبيه SQL الأعمدة');
  const ids4 = (await dump()).stock_transfer_items;
  const it1 = ids4.find(i => i.product_name === 'منتج 1');
  const r4 = await pg.evaluate(([a, b]) => stFill(a, b, 'avail'), [String(it1.id), String(hdr[0].id)]); await sleep(1000);
  d = await dump();
  console.log('S4 بعد إعادة المحاولة:', JSON.stringify({ r: r4, haleb: d.products.map(p => p.haleb), note: d.branch_stock_transfers[0].note, st: d.branch_stock_transfers[0].status }));
  ok(r4 && r4.ok && d.products.find(p => p.name === 'منتج 1').haleb === 8, 'S4 إعادة المحاولة خصمت المطلوب (2) من المصدر مرّة واحدة');
  ok(/منتج 2/.test(d.branch_stock_transfers[0].note) && !/منتج 1/.test(d.branch_stock_transfers[0].note) && d.branch_stock_transfers[0].status === 'needs_settlement', 'S4 الملاحظة تحمل الباقي فقط (منتج 2)');
  const it2 = ids4.find(i => i.product_name === 'منتج 2');
  const r5 = await pg.evaluate(([a, b]) => stWaive(a, b), [String(it2.id), String(hdr[0].id)]); await sleep(1200);
  d = await dump();
  console.log('S4 بعد الشطب:', JSON.stringify({ st: d.branch_stock_transfers[0].status, note: d.branch_stock_transfers[0].note, items: d.stock_transfer_items.map(i => [i.product_name, i.qty]) }));
  ok(d.branch_stock_transfers[0].status === 'pending' && d.products.find(p => p.name === 'منتج 2').haleb === 10, 'S4 «لم تُنقل» لمنتج 2: الفاتورة عادت «في الطريق» والمخزون كما هو');
  ok(d.stock_transfer_items.find(i => i.product_name === 'منتج 2').qty === 0, 'S4 كمية المشطوب في الفاتورة صارت 0 (لا تُستلم)');
  await pg.screenshot({ path: 'tr_legacy_1366.png' });
  await browser.close();

  // ═══ S5: الهاتف 390 ═══
  prods = await seed([10, 10, 10, 1]);
  ({ browser, pg, errs } = await open(390, true));
  await create(pg, prods.map(p => p.id), [1, 1, 1, 5], false);
  await pg.evaluate(() => stOpenSettlements()); await sleep(1500);
  const geo = await pg.evaluate(() => { const o = document.getElementById('st-settle-ov'); const b = document.getElementById('st-settle-body'); return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bodyW: b.scrollWidth, boxW: b.clientWidth }; });
  console.log('S5 geo', JSON.stringify(geo));
  ok(geo.sw <= geo.cw + 1 && geo.bodyW <= geo.boxW + 1, 'S5 الهاتف: لا طفح أفقي في لوحة التسوية');
  await pg.screenshot({ path: 'tr_settle_390.png' });
  await browser.close();
  console.log('errs', errs.filter(e => !/404|400|Failed|qrserver|ERR_/.test(e)).slice(0, 5));
})();
