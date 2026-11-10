// (TASK-0355 · المالك seq 540) «فاتورة التسوية أول ما أفتح حلب أوافق عليها وأعمل لها طباعة باركودات · أشياء لسه ما مجرودة ⇐ فاتورة تسوية أخرى
//  إضافة فوقها وباركوداتها»
//  ① مطابقة الجرد: مسودة «إضافة» (mode=add) ⇐ «➕ إصدار فاتورة إضافية» ⇐ فاتورةٌ واردة بانتظار الاستلام (لا تصفير · لا مسّ المخزون الآن)
//  ② نقطة البيع: الفاتورة الواردة «🏷️ باركودات الفاتورة» بكمّياتها · الاستلام يضيف فوق الموجود (المصدر «تسوية من الجرد» لا يُخصم منه)
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dump = () => H.call('/__dump', undefined, 'GET');
(async () => {
  await H.seed();
  const [A, B] = await H.call('/rest/v1/products', [
    { name: 'إضافة أ — ريموت RC-N1', barcode: 'AD1', price: 60, daraa: 2, haleb: 0 },
    { name: 'إضافة ب — Canon 50 stm', barcode: 'AD2', price: 120, daraa: 1, haleb: 0 }]);
  await H.call('/rest/v1/stock_counts', [{ id: 88, branch_key: 'daraa', branch_name: 'درعا', created_at: '2026-11-10T10:00:00Z',
    details: { status: 'draft', mode: 'add', items: [
      { id: null, name: null, counted_as: 'ريموت DJI رمادي (صورة)', shop: null, store: 7, actual: 7, include: false, photos: [], pages: [] },
      { id: B.id, name: B.name, counted_as: 'EF 50 STM', shop: null, store: 8, actual: 8, include: true, photos: [], pages: [] }] } }]);
  let { browser, pg, errs } = await H.open('inventory.html', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 7000 });
  await pg.waitForFunction(() => !!window.GMTReconcile, null, { timeout: 8000 });
  await pg.evaluate(() => openReconcile()); await pg.waitForSelector('#gmt-rc [data-ix]', { timeout: 8000 }); await sleep(500);
  const ui = await pg.evaluate(() => ({ zeroHidden: document.querySelector('#gmt-rc [data-zero]').parentNode.hidden, btn: document.querySelector('#gmt-rc [data-apply]').textContent }));
  ok(ui.zeroHidden && /إضافية/.test(ui.btn), 'مسودة «إضافة»: لا خيار تصفير · الزرّ «➕ إصدار فاتورة إضافية»: ' + ui.btn);
  await pg.evaluate(n => { const r = [...document.querySelectorAll('#gmt-rc [data-ix]')].find(x => /ريموت/.test(x.innerText)); const i = r.querySelector('[data-link]'); i.value = n; i.dispatchEvent(new Event('change', { bubbles: true })); }, A.name);
  await sleep(600);
  await pg.evaluate(() => { window.GMTAuth = Object.assign(window.GMTAuth || {}, { ask: async () => true }); window.GMTAsk = Object.assign(window.GMTAsk || {}, { confirm: async () => true }); });
  await pg.click('#gmt-rc [data-apply]'); await sleep(2500);
  let D = await dump(); const P = id => D.products.find(p => p.id === id);
  const tr = (D.branch_stock_transfers || []).find(t => /إضافة/.test(t.title || ''));
  const its = tr ? D.stock_transfer_items.filter(i => i.transfer_id === tr.id) : [];
  ok(tr && tr.status === 'pending' && tr.to_branch === 'daraa' && tr.from_branch === 'rebuild' && its.length === 2 && its.find(i => i.product_id === A.id).qty === 7 && its.find(i => i.product_id === B.id).qty === 8,
    'صدرت فاتورةٌ واردة «تسوية من الجرد · إضافة» بانتظار الاستلام: ' + (tr && tr.transfer_number) + ' · ' + its.map(i => i.product_name.slice(0, 12) + '×' + i.qty).join(' + '));
  ok(P(A.id).daraa === 2 && P(B.id).daraa === 1, 'المخزون لم يتغيّر بعد — يُضاف عند الاستلام');
  ok(D.stock_counts.find(r => r.id === 88).details.status === 'applied', 'المسودة خُتمت «صدرت»');
  await browser.close();
  // ② نقطة البيع (درعا)
  ({ browser, pg, errs } = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 6000 }));
  await pg.evaluate(async () => { await loadIncomingTransfers(); await openIncomingTransfers(); }); await sleep(500);
  await pg.evaluate(id => viewIncomingItems(id), tr.id); await sleep(700);
  await pg.evaluate(() => { window.__lb = null; window.GMTLabels = Object.assign(window.GMTLabels || {}, { openSheet: (it, o) => { window.__lb = { it, o }; return true; } }); });
  await pg.click('[data-inc-labels]'); await sleep(600);
  const lb = await pg.evaluate(() => window.__lb);
  ok(lb && lb.it.length === 2 && lb.it.find(x => x.barcode === 'AD1').qty === 7 && lb.it.find(x => x.barcode === 'AD2').qty === 8 && /TRF/.test(lb.o.title), '«🏷️ باركودات الفاتورة» في نقطة البيع: ملصقاتٌ بكمّيات الفاتورة: ' + JSON.stringify(lb && lb.it.map(x => x.barcode + '×' + x.qty)));
  const R = await pg.evaluate(id => GMTStock.receiveTransfer({ transferId: id, toBranch: 'daraa' }), tr.id);
  D = await dump();
  ok(R.ok && P(A.id).daraa === 9 && P(B.id).daraa === 9, 'الاستلام يضيف فوق الموجود (2+7 · 1+8): ' + [P(A.id).daraa, P(B.id).daraa].join(','));
  const real = errs.filter(x => !/Failed to load resource|status of (400|404|406)/.test(x));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 3)));
  await browser.close();
  console.log(fails ? 'FAIL ' + fails + ' / ' + (pass + fails) : 'ALL PASS (' + pass + ')');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
