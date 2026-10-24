// TASK-0150 — المالك seq 57: «إذا في منتجات أو أصناف تعذّر نقلها لا تتعلّق الفاتورة كاملة … تنتقل الفاتورة … ننقصها هالبند
// وهذاك البند تتحوّل لفاتورة جديدة معلّقة لبين ما نصلح الموضوع». (TRF-00003 الحيّة علقت 8 محاولات على «SNBLY» المحذوف.)
// الجرد (تأكيد الأدمن): بندٌ منتجه محذوف ⇒ الأصلية «مستلَمة» بما وصل · البند المتعذّر في فاتورةٍ جديدة «في الطريق» «متبقٍّ من …»
// · الانقطاع لا يُفصل · فشل الفصل ⇒ تراجعٌ كامل (لا فاتورة فارغة).
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const dump = async () => H.call('/__dump', undefined, 'GET');
const GONE = '29f7fe2f-877a-44fe-8aa4-80ad6931fc57';   // منتجٌ محذوف (كـSNBLY)

(async () => {
  await H.seed();
  const [pa, pb] = await H.call('/rest/v1/products', [
    { name: 'YM-S60 هيد', barcode: 'SP1', price: 50, wholesale_price: 30, haleb: 0, daraa: 0 },
    { name: 'Stand 205 cm', barcode: 'SP2', price: 20, wholesale_price: 10, haleb: 0, daraa: 1 }]);
  const [T] = await H.call('/rest/v1/branch_stock_transfers', [{ transfer_number: 'TRF-00003', status: 'pending', from_branch: 'haleb', to_branch: 'daraa', from_branch_name: 'حلب', to_branch_name: 'درعا', note: 'تعذّر استلام: SNBLY' }]);
  await H.call('/rest/v1/stock_transfer_items', [
    { transfer_id: T.id, product_id: pa.id, product_name: pa.name, qty: 2 },
    { transfer_id: T.id, product_id: pb.id, product_name: pb.name, qty: 5 },
    { transfer_id: T.id, product_id: GONE, product_name: 'SNBLY', barcode: '67921593431287', qty: 1 }]);
  const { browser, pg, errs } = await H.open('inventory.html', { w: 1366, mobile: false, wait: 4500 });
  const alerts = await pg.evaluate(async (id) => {
    const out = []; GMTAsk.alert = async (m) => { out.push(String(m)); };
    await loadStockTransfers(); await openStockTransferDetail(id);
    document.getElementById('st-received-by').value = 'محمد'; await stConfirmReceived(id, null); return out;
  }, T.id);
  await pg.waitForTimeout(800);
  const d = await dump();
  const orig = d.branch_stock_transfers.find(x => x.id === T.id);
  const neu = d.branch_stock_transfers.find(x => x.id !== T.id);
  const items = d.stock_transfer_items;
  ok(orig.status === 'received', 'الأصلية TRF-00003 «مستلَمة» بما وصل (كانت تعود «في الطريق» في كل محاولة): ' + orig.status);
  ok(d.products.find(p => p.id === pa.id).daraa === 2 && d.products.find(p => p.id === pb.id).daraa === 6, 'البندان السليمان أُضيفا لدرعا (2 · 1+5)');
  ok(neu && neu.status === 'pending' && neu.from_branch === 'haleb' && neu.to_branch === 'daraa' && /^TRF-\d{5}$/.test(neu.transfer_number) && /متبقٍّ من TRF-00003/.test(neu.title || ''),
    'فاتورةٌ جديدة «في الطريق» بنفس المصدر والوجهة ورقمٍ متسلسل «متبقٍّ من TRF-00003»: ' + JSON.stringify(neu && { n: neu.transfer_number, s: neu.status, t: neu.title }));
  const snb = items.find(i => i.product_name === 'SNBLY');
  ok(snb && neu && snb.transfer_id === neu.id && !snb.received_at && items.filter(i => i.transfer_id === T.id).length === 2, 'بند «SNBLY» انتقل وحده إلى الجديدة (غير مستلَم) وبقي في الأصلية البندان المستلَمان');
  ok(/فُصل 1 بند إلى TRF-\d{5}: SNBLY/.test(orig.note || '') && /SNBLY/.test(neu.note || ''), 'الملاحظتان تسمّيان الفصل: ' + (orig.note || '').slice(-60));
  ok(alerts.some(a => /فُصل إلى فاتورةٍ جديدة معلّقة TRF-\d{5}/.test(a) && /اكتملت ولم تعلق/.test(a) && /غير موجود/.test(a)), 'الرسالة: تعذّرت إضافة SNBLY (غير موجود) ⇒ فُصل إلى فاتورة جديدة · وهذه اكتملت');

  // تراجعٌ كامل إن تعذّر نقل البنود: لا فاتورة جديدة فارغة، والأصلية «في الطريق» كما كانت
  await H.seed();
  const [pc] = await H.call('/rest/v1/products', [{ name: 'منتج سليم', barcode: 'SP3', price: 5, wholesale_price: 3, daraa: 0 }]);
  const [T2] = await H.call('/rest/v1/branch_stock_transfers', [{ transfer_number: 'TRF-00020', status: 'pending', from_branch: 'haleb', to_branch: 'daraa', from_branch_name: 'حلب', to_branch_name: 'درعا' }]);
  await H.call('/rest/v1/stock_transfer_items', [{ transfer_id: T2.id, product_id: pc.id, product_name: pc.name, qty: 1 }, { transfer_id: T2.id, product_id: GONE, product_name: 'SNBLY', qty: 1 }]);
  await pg.route(/stock_transfer_items\?transfer_id=eq\.[^&]+&id=in\./, r => r.request().method() === 'PATCH' ? r.fulfill({ status: 500, body: '{}' }) : r.fallback());
  const al2 = await pg.evaluate(async (id) => {
    const out = []; GMTAsk.alert = async (m) => { out.push(String(m)); };
    await loadStockTransfers(); await openStockTransferDetail(id);
    document.getElementById('st-received-by').value = 'محمد'; await stConfirmReceived(id, null); return out;
  }, T2.id);
  await pg.waitForTimeout(600);
  const d2 = await dump();
  ok(d2.branch_stock_transfers.length === 1 && d2.branch_stock_transfers[0].status === 'pending' && d2.stock_transfer_items.every(i => i.transfer_id === T2.id),
    'فشل الفصل ⇒ تراجعٌ كامل: لا فاتورة جديدة، والأصلية «في الطريق» بكل بنودها: ' + d2.branch_stock_transfers.map(x => x.transfer_number + '/' + x.status).join(','));
  ok(al2.some(a => /تعذّر فصلها إلى فاتورةٍ جديدة/.test(a)), 'والرسالة تقول إنّ الفصل تعذّر');
  const bad = errs.filter(e => !/favicon|أصول ناقصة|Failed to load resource|404/.test(e));
  ok(bad.length === 0, 'لا أخطاء JS: ' + JSON.stringify(bad.slice(0, 3)));
  await browser.close();
  console.log(fails ? `FAIL=${fails} (pass ${pass})` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
