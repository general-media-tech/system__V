// (seq B1031 · B1042 · B1043) الفاحص العميق «فواتير واصلة بلا ختم ترحيل»: الشراء الفوري (لا ترحيل له) والقديمة قبل دفتر الاستلام ليست خطراً ·
//   الخطر الحقيقي = فاتورة استيراد «واصلة» بعد بدء الدفتر بلا ختم ⇒ تُذكر باسمها
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const t = d => new Date(Date.now() - d * 864e5).toISOString();
  await H.call('/rest/v1/stock_receipts', { product_id: 'x', branch_key: 'haleb', qty: 1, kind: 'transfer_arrive', created_at: t(100) });
  await H.call('/rest/v1/import_log', [
    { inv_number: 'PO-2026-0019', inv_type: 'instant', status: 'arrived', transferred: false, arrived_at: t(10) },
    { inv_number: 'CN-2026-0005', inv_type: 'china', status: 'arrived', transferred: false, arrived_at: t(400) },
    { inv_number: 'CN-2026-0042', inv_type: 'china', status: 'arrived', transferred: false, arrived_at: t(5) },
    { inv_number: 'CN-2026-0043', inv_type: 'china', status: 'arrived', transferred: true, arrived_at: t(5) }]);
  const { browser, pg } = await H.open('purchase.html', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 3500 });
  await pg.addScriptTag({ url: '/gmt-deep-inspector.js' }).catch(() => {}); await pg.waitForTimeout(500);
  const row = await pg.evaluate(async () => { let r = null; window.__gmtInspectorTick = x => { if (/بلا ختم ترحيل/.test(x.step)) r = x; };
    try { await GMTDeepInspector.scan(); } catch (_) {} return r; });
  await browser.close();
  ok(!!row, 'الفحص شُغِّل: ' + JSON.stringify(row && { ok: row.ok, d: row.detail }));
  ok(row && row.ok === false && /^CN-2026-0042/.test(row.detail) && !/PO-2026-0019/.test(row.detail) && !/0043/.test(row.detail), 'الخطر الحقيقي وحده (CN-0042) · لا الفوري ولا المختومة');
  ok(row && /قديمة قبل دفتر الاستلام[^]*CN-2026-0005/.test(row.detail), 'القديمة تُذكر معلومةً لا خطراً (CN-0005)');
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
