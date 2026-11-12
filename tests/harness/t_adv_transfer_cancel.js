// (المالك seq 632/636 · الفحص الشامل · مصفوفة التغطية: «إلغاء فاتورة النقل من الأدمن» بلا اختبار)
// الإلغاء يعيد المنقول فعلاً للمصدر مرّةً واحدة: ضغطتان معاً · إلغاء ثانٍ · فاتورة استُلمت · بند فاشل لم يُخصم · فشل إعادة الكمية ⇒ تراجع كامل.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const dump = () => H.call('/__dump', undefined, 'GET');
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function seed(haleb) {
  await H.call('/__reset', {});
  await H.call('/__opts', { reject_cols: [], unique_order_invoice: true, old_rpc_false: false, rls_block: [], no_pos_fn: false, sov: '2003', pos_protected: true, pos_locked: false });
  await H.call('/rest/v1/inv_columns', [['haleb', 'حلب'], ['daraa', 'درعا']].map(([k, nm], i) => ({ key_name: k, display_name: nm, col_type: 'number', include_in_total: true, is_branch: true, show_form: true, show_table: true, sort_order: i })));
  return await H.call('/rest/v1/products', haleb.map((h, i) => ({ name: `منتج ${i}`, barcode: `BC${i}`, price: 100 + i, wholesale_price: 80, cost_price: 60, haleb: h, daraa: 2, in_transit: {} })));
}
async function makeTransfer(ids, qs) {
  const { browser, pg } = await H.open('inventory.html', { init: H.ADMIN_INIT, w: 1366, h: 900, wait: 5500, mobile: false });
  await pg.evaluate(() => { switchAppMode('transfer'); });
  await pg.evaluate(([ids, qs]) => {
    window.GMTAsk.choose = async () => 'avail'; window.GMTAsk.confirm = async () => false; window.GMTAsk.alert = async () => true; window.GMTAsk.prompt = async () => 'سبب تجريبي';
    openNewStockTransferModal();
    document.getElementById('st-from-select').value = 'haleb'; document.getElementById('st-to-select').value = 'daraa';
    onStBranchChange(); stState.items = {};
    ids.forEach(id => stAddProduct(id));
    ids.forEach((id, i) => { stState.items[id].qty = qs[i]; stState.items[id].maxAvail = Math.max(stState.items[id].maxAvail || 0, qs[i]); });
    document.getElementById('st-creator-name').value = 'فاحص';
  }, [ids, qs]);
  await pg.evaluate(() => saveStockTransfer()); await sleep(2500); await browser.close();
}
async function admin() {
  const o = await H.open('admin_pos.html', { init: H.ADMIN_INIT, w: 1200, h: 900, wait: 7000, mobile: false });
  await o.pg.evaluate(async () => { window.__alerts = []; window.GMTAsk = Object.assign(window.GMTAsk || {}, { confirm: async () => true, alert: async m => { window.__alerts.push(String(m)); return true; } }); await loadStockTransfersAdmin(); });
  return o;
}
const haleb = async () => (await dump()).products.map(p => p.haleb).join();
(async () => {
  // ① ضغطتان معاً على «إلغاء» ⇒ الكمية تعود مرّة واحدة
  let prods = await seed([10, 10, 10]); let ids = prods.map(p => p.id);
  await makeTransfer(ids.slice(0, 2), [3, 4]);
  let d = await dump(); let T = d.branch_stock_transfers[0];
  ok(T && T.status === 'pending' && (await haleb()) === '7,6,10', 'نقل 3 و4 من حلب ⇒ الفاتورة معلّقة والمصدر 7,6,10 (' + (T && T.status) + ' · ' + (await haleb()) + ')');
  let o = await admin();
  await o.pg.evaluate(id => Promise.all([cancelStockTransferAdmin(id), cancelStockTransferAdmin(id)]), T.id); await sleep(1200);
  d = await dump(); T = d.branch_stock_transfers[0];
  ok(T.status === 'cancelled' && (await haleb()) === '10,10,10', 'ضغطتان معاً على «إلغاء» ⇒ مُلغاة والكمية عادت مرّةً واحدة: ' + (await haleb()));
  ok(d.products.every(p => !((p.in_transit || {}).daraa > 0)), 'العبور إلى درعا صُفِّر بعد الإلغاء');
  // ② إلغاء فاتورة مُلغاة ⇒ لا شيء
  await o.pg.evaluate(id => cancelStockTransferAdmin(id), T.id); await sleep(700);
  ok((await haleb()) === '10,10,10', 'إلغاء ثانٍ لفاتورة مُلغاة ⇒ المخزون لا يتضخّم: ' + (await haleb()));
  await o.browser.close();
  // ③ فاتورة استلمها الفرع قبل أن يضغط الأدمن (واجهته قديمة) ⇒ مرفوض بلا مسّ المخزون
  prods = await seed([10, 10]); ids = prods.map(p => p.id);
  await makeTransfer(ids, [5, 5]); d = await dump(); T = d.branch_stock_transfers[0];
  o = await admin();
  await H.call('/rest/v1/branch_stock_transfers?id=eq.' + T.id, { status: 'received', received_at: new Date().toISOString() }, 'PATCH');
  await o.pg.evaluate(id => cancelStockTransferAdmin(id), T.id); await sleep(900);
  d = await dump();
  ok(d.branch_stock_transfers[0].status === 'received' && (await haleb()) === '5,5', 'فاتورة استُلمت والأدمن على واجهة قديمة ⇒ الإلغاء مرفوض والمصدر كما هو: ' + (await haleb()));
  await o.browser.close();
  // ④ بند طُلب 6 والمتاح 3 (نُقل 3 فقط) ⇒ الإلغاء يعيد 3 لا 6
  prods = await seed([10, 3]); ids = prods.map(p => p.id);
  await makeTransfer(ids, [4, 6]); d = await dump(); T = d.branch_stock_transfers[0];
  ok(T.status === 'needs_settlement' && (await haleb()) === '6,0', 'طُلب 6 والمتاح 3 ⇒ نُقل المتاح والفاتورة «تحتاج تسوية»: ' + (await haleb()));
  o = await admin();
  await o.pg.evaluate(id => cancelStockTransferAdmin(id), T.id); await sleep(1200);
  d = await dump();
  ok(d.branch_stock_transfers[0].status === 'cancelled' && (await haleb()) === '10,3', 'إلغاؤها يعيد المنقول فعلاً (4 و3) لا المطلوب (4 و6): ' + (await haleb()));
  await o.browser.close();
  // ⑤ فشل إعادة الكمية للمصدر ⇒ تراجع كامل والفاتورة كما كانت
  prods = await seed([10, 10]); ids = prods.map(p => p.id);
  await makeTransfer(ids, [2, 3]); d = await dump(); T = d.branch_stock_transfers[0];
  o = await admin();
  await o.pg.evaluate(() => { const real = GMTStock.move; let n = 0; GMTStock.move = async function (kind) { if (kind === 'add' && ++n === 2) return { ok: false, error: 'انقطاع تجريبي' }; return real.apply(this, arguments); }; });
  await o.pg.evaluate(id => cancelStockTransferAdmin(id), T.id); await sleep(1500);
  d = await dump(); const al = await o.pg.evaluate(() => window.__alerts.join(' | '));
  ok(d.branch_stock_transfers[0].status === 'pending' && (await haleb()) === '8,7' && /لم يتغيّر شيء/.test(al), 'فشلت إعادة الصنف الثاني ⇒ تراجع كامل: الفاتورة معلّقة والمصدر 8,7 ورسالة واضحة (' + (await haleb()) + ')');
  const real = o.errs.filter(e => !/status of (400|401|404|406|409|503)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
