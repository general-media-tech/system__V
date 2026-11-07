// (TASK-0338 · المالك seq 570) «شوف شو عم يطلع لي لما عم ادخل» — «وُجدت مسودة فاتورة غير محفوظة سحابياً · 9 أصناف»
//  ① فتح فاتورة للتعديل بلا تغيير ⇒ لا مسودة  ② تغيير فعلي ⇒ مسودة تحمل رقم الفاتورة  ③ الاستعادة تفتح نفس الفاتورة بالتعديل (كانت تفتح فارغة)
//  ④ مسودة لفاتورة محذوفة أو فورية ⇒ تُحذف بلا سؤال ولا استعادة (كانت ستكتب «في الطريق» وتضيف للمخزون المؤقت)
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ASK = `document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{ if(window.GMTAsk) GMTAsk.confirm=async m=>{ const a=JSON.parse(localStorage.getItem('__asked')||'[]'); a.push(m); localStorage.setItem('__asked',JSON.stringify(a)); return localStorage.getItem('__ans')!=='no'; }; },0));`;
const readDraft = pg => pg.evaluate(() => new Promise(res => { const r = indexedDB.open('gmt_drafts', 1); r.onupgradeneeded = () => r.result.createObjectStore('drafts'); r.onsuccess = () => { const q = r.result.transaction('drafts', 'readonly').objectStore('drafts').get('gmt_purchase_draft'); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }; r.onerror = () => res(null); }));
const putDraft = (pg, v) => pg.evaluate(v => new Promise(res => { const r = indexedDB.open('gmt_drafts', 1); r.onupgradeneeded = () => r.result.createObjectStore('drafts'); r.onsuccess = () => { const tx = r.result.transaction('drafts', 'readwrite'); tx.objectStore('drafts').put(v, 'gmt_purchase_draft'); tx.oncomplete = res; }; }), v);
(async () => {
  await H.seed();
  const [A, B] = await H.call('/rest/v1/products', [
    { name: 'ستاند مسودة', barcode: 'DR0001', price: 10, cost_price: 3, china: 5 },
    { name: 'رأس مسودة', barcode: 'DR0002', price: 20, cost_price: 6, haleb: 2 }]);
  await H.call('/rest/v1/import_log', [
    { id: 811, inv_number: 'IMP-2026-0011', inv_type: 'china', supplier: 'شيشين', status: 'transit', items_snapshot: [{ id: A.id, name: A.name, qty: 5, unit_price: 3 }] },
    { id: 812, inv_number: 'PO-2026-0012', inv_type: 'instant', supplier: 'سمارت ستور', status: 'arrived', items_snapshot: [{ id: B.id, name: B.name, qty: 2, unit_price: 6 }] }]);
  const { browser, ctx, pg, errs } = await H.open('purchase.html', { w: 1366, h: 900, mobile: false, wait: 6000 });
  await ctx.addInitScript(ASK);
  await pg.reload(); await sleep(6000);
  // ①
  await pg.evaluate(() => openEdit('811')); await sleep(5500);
  ok(!(await readDraft(pg)), 'فتح فاتورة للتعديل بلا أيّ تغيير ⇒ لا مسودة');
  // ②
  await pg.evaluate(() => { cart[0].qty = 7; }); await sleep(5000);
  const dr = await readDraft(pg);
  ok(dr && String(dr.editId) === '811' && dr.invNum === 'IMP-2026-0011' && dr.cart[0].qty === 7, 'تغيير فعلي ⇒ مسودة برقم الفاتورة ' + JSON.stringify(dr && { e: dr.editId, n: dr.invNum, q: dr.cart[0].qty }));
  await pg.evaluate(() => closeAddModal()); await sleep(4500);
  // ③ الاستعادة
  await pg.evaluate(() => { localStorage.setItem('__asked', '[]'); localStorage.setItem('__ans', 'yes'); });
  await pg.reload(); await sleep(8000);
  let asked = await pg.evaluate(() => JSON.parse(localStorage.getItem('__asked') || '[]'));
  ok(asked.length === 1 && /تعديل الفاتورة IMP-2026-0011 · شيشين/.test(asked[0]), 'السؤال يذكر ما هي المسودة: ' + (asked[0] || '').replace(/\n+/g, ' | '));
  const rs = await pg.evaluate(() => ({ open: !document.getElementById('addModal').classList.contains('hidden'), editId: window.editId, n: cart.length, q: cart[0] && cart[0].qty, type: invType }));
  ok(rs.open && String(rs.editId) === '811' && rs.n === 1 && rs.q === 7 && rs.type === 'china', 'الاستعادة تفتح نفس الفاتورة بتعديلها (لا نافذة فارغة) ' + JSON.stringify(rs));
  await pg.evaluate(() => closeAddModal());
  // ④ مسودة لفاتورة محذوفة
  for (const [eid, lbl] of [[999, 'محذوفة'], [812, 'فورية']]) {
    await putDraft(pg, { at: new Date().toISOString(), invType: 'germany', editId: eid, cart: [{ product: { id: B.id, name: 'x' }, qty: 1 }, { product: { id: A.id, name: 'y' }, qty: 1 }], form: {} });
    await pg.evaluate(() => localStorage.setItem('__asked', '[]'));
    await pg.reload(); await sleep(8000);
    asked = await pg.evaluate(() => JSON.parse(localStorage.getItem('__asked') || '[]'));
    const st = await pg.evaluate(() => ({ open: !document.getElementById('addModal').classList.contains('hidden'), n: cart.length }));
    ok(!asked.length && !st.open && !(await readDraft(pg)), 'مسودة لفاتورة ' + lbl + ' ⇒ تُحذف بلا سؤال ولا استعادة ' + JSON.stringify({ asked: asked.length, st }));
  }
  // «إلغاء» ⇒ حذف نهائي
  await putDraft(pg, { at: new Date().toISOString(), invType: 'china', editId: null, cart: [{ product: { id: A.id, name: 'y' }, qty: 3 }], form: { 'in-supplier': 'تجربة' } });
  await pg.evaluate(() => { localStorage.setItem('__asked', '[]'); localStorage.setItem('__ans', 'no'); });
  await pg.reload(); await sleep(8000);
  asked = await pg.evaluate(() => JSON.parse(localStorage.getItem('__asked') || '[]'));
  ok(asked.length === 1 && /فاتورة استيراد جديدة \(الصين\) · تجربة/.test(asked[0]) && !(await readDraft(pg)), 'مسودة فاتورة جديدة: السؤال واضح و«إلغاء» يحذفها');
  const d = await H.call('/__dump', undefined, 'GET');
  ok(d.import_log.length === 2 && d.import_log.find(r => r.id === 812).inv_type === 'instant', 'لا كتابة في الفواتير خلال كل ذلك');
  const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource|favicon/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
