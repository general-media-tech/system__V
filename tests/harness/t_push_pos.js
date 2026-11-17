// (TASK-B0420 · المهمّة ٩ و١٠) ربط الصفحات: روابط ?go= العميقة وتحديث الصفحة المفتوحة عند حدث gmt-push
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  await H.call('/rest/v1/branch_stock_transfers', [{ transfer_number: 'TRF-77', from_branch: 'haleb', from_branch_name: 'حلب', to_branch: 'daraa', to_branch_name: 'درعا', status: 'pending' }]);
  const o = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 6500 });
  const hits = { tr: 0, off: 0 }; o.pg.on('request', r => { const u = r.url(); if (/branch_stock_transfers/.test(u)) hits.tr++; if (/gmt_offers/.test(u)) hits.off++; });
  ok(await o.pg.evaluate(() => !!document.querySelector('#hdr-more-menu .hdr-more-item[onclick*="GMTPush"]')), 'عنصر «🔔 الإشعارات» في قائمة المزيد');
  hits.tr = 0; await o.pg.evaluate(() => dispatchEvent(new CustomEvent('gmt-push', { detail: { k: 'transfer' } }))); await o.pg.waitForTimeout(1200);
  ok(hits.tr > 0, 'حدث إشعار «نقل» ⇒ تُعاد قراءة الوارد (' + hits.tr + ' طلب)');
  hits.off = 0; await o.pg.evaluate(() => dispatchEvent(new CustomEvent('gmt-push', { detail: { k: 'offer' } }))); await o.pg.waitForTimeout(1200);
  ok(hits.off > 0, 'حدث إشعار «عرض» ⇒ تُجدَّد العروض (' + hits.off + ' طلب)');
  const r = await o.pg.evaluate(async () => { window.__opened = 0; const orig = window.openIncomingTransfers; window.openIncomingTransfers = function () { window.__opened++; }; await _pushGo('incoming'); window.openIncomingTransfers = orig; return window.__opened; });
  ok(r === 1, 'رابط ?go=incoming ⇒ تُفتح نافذة الوارد');
  const r2 = await o.pg.evaluate(async () => { await _pushGo('offers'); return typeof activeCat !== 'undefined' ? activeCat : null; });
  ok(r2 === 'باقات وعروض', 'رابط ?go=offers ⇒ قسم «باقات وعروض»: ' + r2);
  const real = o.errs.filter(e => !/status of (400|401|404|406|409)|Failed to load resource|navigator.vibrate|Estimating/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await o.browser.close();
  // الأوردرات
  const o2 = await H.open('orders.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 5500 });
  let oh = 0; o2.pg.on('request', r => { if (/gmt_orders/.test(r.url())) oh++; });
  ok(await o2.pg.evaluate(() => !!document.getElementById('push-btn')), 'زرّ «🔔 الإشعارات» في رأس الأوردرات');
  oh = 0; await o2.pg.evaluate(() => dispatchEvent(new CustomEvent('gmt-push', { detail: { k: 'order' } }))); await o2.pg.waitForTimeout(1500);
  ok(oh > 0, 'حدث إشعار «أوردر» ⇒ تُعاد قراءة الأوردرات (' + oh + ' طلب)');
  await o2.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
