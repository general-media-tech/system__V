// (seq B1067) ملصقات فاتورة النقل = الورقة الموحّدة (gmt-labels) بخياراتها حتى «٨ بالصفّ» · ملصق لكلّ قطعة
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const [P] = await H.call('/rest/v1/products', [{ name: 'منتج ملصقات', barcode: 'TLS001', haleb: 0 }]);
  const [T] = await H.call('/rest/v1/branch_stock_transfers', { transfer_number: 'TRF-00918', from_branch: 'rebuild', to_branch: 'haleb', status: 'pending', is_locked: true, created_at: new Date().toISOString() });
  await H.call('/rest/v1/stock_transfer_items', { transfer_id: T.id, product_id: P.id, product_name: 'منتج ملصقات', barcode: 'TLS001', qty: 3, requested_qty: 3 });
  const { browser, pg } = await H.open('inventory.html?trf=TRF-00918', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 8000 });
  await pg.waitForTimeout(1500);
  const r = await pg.evaluate(async id => {
    let html = ''; const fake = { document: { open() { html = ''; }, write(h) { html += h; }, close() {} }, close() {} };
    const o = window.open; window.open = () => fake;
    try { await printTransferLabels(id); } finally { window.open = o; }
    const d = new DOMParser().parseFromString(html, 'text/html');
    const lay = (html.match(/LAY\s*=\s*(\{[\s\S]*?\})\s*[,;]/) || [])[1] || '';
    return { opts: (html.match(/ORDER\s*=\s*(\[[^\]]*\])/) || [])[1] || '', has8: /٨ بالصف/.test(html), n: (html.match(/"barcode"\s*:\s*"TLS001"/g) || []).length, len: html.length };
  }, T.id);
  ok(r.has8 && /8/.test(r.opts), 'ملصقات النقل تفتح الورقة الموحّدة بخياراتها (فيها «٨ بالصفّ»): ' + r.opts);
  ok(r.n === 3, 'ملصق لكلّ قطعة (الكمية ٣ ⇒ ٣ ملصقات بالورقة): ' + r.n + ' · ' + r.len);
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
