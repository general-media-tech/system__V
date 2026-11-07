// (TASK-0339 · المالك seq 573 «ابحث عن جذر الأخطاء … وصيد نفس النمط في كل مكان»)
// النمط: تحديد الفاتورة برقمها — والرقم IMP-2026-0001 لفاتورتين (صينية وأوروبية).
//  ① حذف بند من الأوروبية لا يسحب مورّد/تكاليف الصينية إلى الشاشة (ثم إلى الحفظ)
//  ② «استعادة فاتورة من نسخة» بالرقم المكرّر: تُرفض إن لم تتحدّد · وبالمعرّف تُستبدل في مكانها بلا حذف وبلا مضاعفة الكميات
//  ③ الفورية: الصورة والاسم من المنتج الحيّ · منتجٌ محذوف يُوسَم «حُذف من الجرد»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const [A, B, C] = await H.call('/rest/v1/products', [
    { name: 'منتج صيني', barcode: 'DN0001', price: 10, china: 7, germany: 0 },
    { name: 'منتج أوروبي', barcode: 'DN0002', price: 20, germany: 4, china: 0 },
    { name: 'منتج بصورة', barcode: 'DN0003', price: 30, image_url: 'https://example.com/live.jpg', haleb: 1 }]);
  await H.call('/rest/v1/import_log', [
    { id: 841, inv_number: 'IMP-2026-0001', inv_type: 'china', supplier: 'وايمن الصين', status: 'arrived', cost_transport: 55, cost_shipping: 300, items_snapshot: [{ id: A.id, name: A.name, qty: 7, unit_price: 3 }] },
    { id: 842, inv_number: 'IMP-2026-0001', inv_type: 'germany', supplier: 'EU', status: 'arrived', items_snapshot: [{ id: B.id, name: B.name, qty: 4, unit_price: 9 }, { id: A.id, name: A.name, qty: 1, unit_price: 3 }] },
    { id: 843, inv_number: 'PO-2026-0043', inv_type: 'instant', supplier: 'سمارت', status: 'arrived', items_snapshot: [{ id: C.id, name: 'اسم قديم', qty: 1, unit_price: 5, image_url: '' }, { id: '00000000-0000-4000-8000-000000000999', name: 'منتج حُذف', qty: 1, unit_price: 2 }] }]);
  const { browser, pg, errs } = await H.open('purchase.html', { w: 1366, h: 900, mobile: false, wait: 6000 });
  // ①
  await pg.evaluate(() => { openInvFromList('842'); window.GMTAsk = Object.assign(window.GMTAsk || {}, { confirm: async () => true }); });
  await pg.evaluate(() => deleteInvItem(1)); await sleep(500);
  const scr = await pg.evaluate(() => ({ sup: (document.querySelector('#invPage [data-field="supplier"]') || {}).textContent, ct: (document.querySelector('#invPage [data-field="ct"]') || {}).textContent, n: d_items_ref.length, open: window._invOpen }));
  ok(scr.sup === 'EU' && !/55/.test(scr.ct || '') && scr.n === 1 && String(scr.open.id) === '842', '① حذف بند من الأوروبية: المورّد EU وتكاليفها هي لا تكاليف الصينية ' + JSON.stringify(scr));
  // ②أ رقم مكرّر بلا معرّف ونوع مختلف عن الاثنين؟ — هنا نفس الرقم ونوع «china» ⇒ واحدة فقط ⇒ تُستبدل في مكانها
  const before = await H.call('/__dump', undefined, 'GET');
  const chinaQty0 = before.products.find(p => p.id === A.id).china;
  const restore = async data => pg.evaluate(async d => {
    const f = new File([JSON.stringify(d)], 'b.json', { type: 'application/json' });
    await importInvJSON({ files: [f], set value(v) {} });
  }, data);
  await restore({ _system: 'GMT-PURCHASES-BACKUP', id: 841, inv_number: 'IMP-2026-0001', inv_type: 'china', supplier: 'وايمن الصين', status: 'arrived', items_snapshot: [{ id: A.id, name: A.name, qty: 7, unit_price: 3.5 }] });
  await sleep(1500);
  let d = await H.call('/__dump', undefined, 'GET');
  const r841 = d.import_log.find(x => x.id === 841), r842 = d.import_log.find(x => x.id === 842);
  ok(r841 && +r841.items_snapshot[0].unit_price === 3.5 && d.import_log.length === before.import_log.length, '② الاستعادة بالمعرّف: استُبدلت الصينية 841 في مكانها (لا حذف ولا صفّ جديد)');
  ok(r842 && r842.supplier === 'EU' && r842.items_snapshot.length === 2, '② الأوروبية بنفس الرقم لم تُمسّ');
  ok(+d.products.find(p => p.id === A.id).china === +chinaQty0, '② الكميات لم تتضاعف (' + chinaQty0 + ' ⇐ ' + d.products.find(p => p.id === A.id).china + ')');
  // ②ب نسخة بلا معرّف ونوع غير محدّد يطابق الاثنتين؟ نجعل الاثنتين بنفس النوع لاختبار الرفض
  await H.call('/rest/v1/import_log?id=eq.842', { inv_type: 'china' }, 'PATCH');
  await pg.reload(); await sleep(6000);
  await pg.evaluate(() => { window.GMTAsk = Object.assign(window.GMTAsk || {}, { confirm: async () => true }); });
  const n0 = (await H.call('/__dump', undefined, 'GET')).import_log.length;
  await restore({ _system: 'GMT-PURCHASES-BACKUP', inv_number: 'IMP-2026-0001', inv_type: 'china', items_snapshot: [{ id: A.id, name: A.name, qty: 1, unit_price: 1 }] });
  await sleep(1200);
  d = await H.call('/__dump', undefined, 'GET');
  ok(d.import_log.length === n0 && d.import_log.find(x => x.id === 841).items_snapshot[0].unit_price === 3.5 && d.import_log.find(x => x.id === 842).items_snapshot.length === 2, '② رقم مكرّر بلا معرّف ⇒ رفض بلا أيّ تغيير');
  // ③
  await pg.evaluate(() => openInvFromList('843')); await sleep(400);
  const inst = await pg.evaluate(() => [...document.querySelectorAll('#inv-items-tbl tbody tr')].map(tr => ({ t: tr.innerText.replace(/\s+/g, ' ').slice(0, 60), img: (tr.querySelector('img') || {}).src || '' })));
  ok(/منتج بصورة/.test(inst[0].t) && /live\.jpg/.test(inst[0].img), '③ الفورية: الاسم والصورة من المنتج الحيّ ' + JSON.stringify(inst[0]));
  ok(/حُذف من الجرد/.test(inst[1].t) && !/غير مربوط/.test(inst[1].t), '③ منتج محذوف يُوسَم «حُذف من الجرد» ' + JSON.stringify(inst[1]));
  const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource|favicon|example\.com/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
