// (TASK-B0537 · seq B1038–B1039) نقطة البيع: منتجٌ يلزمه IMEI ⇒ لا حفظ ناقص · مسح متتالٍ (IMEI بفواصل · S/N غير مناسب يُرفض) · لا تكرار
//   داخل الفاتورة ولا جهاز مبيع سابقاً · الحفظ: الأرقام على البند + سجلّ الجهاز «مبيع» بالفاتورة · تظهر بالفاتورة · تمرّ للكفالة
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const closeDialogs = async pg => { for (let i = 0; i < 4 && await pg.evaluate(() => !!document.querySelector('.gmtask-ov')); i++) { await pg.keyboard.press('Escape'); await pg.waitForTimeout(250); } };
const A = '490154203237518', B = '353456789012348', OLD = '356938035643809';   // IMEI صالحة (Luhn)
(async () => {
  await H.seed();
  const [P] = await H.call('/rest/v1/products', [{ name: 'هاتف تجربة IMEI', barcode: 'IM01', price: 300, wholesale_price: 250, cost_price: 200, daraa: 5, serial_req: 'imei' }]);
  await H.call('/rest/v1/gmt_serials', [{ code: OLD, kind: 'imei', product_id: P.id, product_name: 'هاتف تجربة IMEI', status: 'sold', sale_inv_number: 'OLD-9', customer_name: 'زبون قديم' }]);
  const { browser, pg, errs } = await H.open('pos.html', { init: H.STAFF_INIT, w: 1366, h: 900, mobile: false, wait: 7000 });
  pg.on('dialog', d => d.accept());
  await pg.evaluate(pid => { newInvoice(); addToCartFromDetail(pid); cart[pid].qty = 2; saleType = 'نقدي'; const n = document.getElementById('custName'); if (n) n.value = 'زبون IMEI'; renderCart(); }, P.id);
  ok(await pg.evaluate(pid => /0\/2/.test((document.querySelector('[data-serial-chip="' + pid + '"]') || {}).innerText || ''), P.id), 'شريحة «🔢 IMEI 0/2» على سطر المنتج بالسلّة');
  await pg.evaluate(() => saveAndFinish()); await pg.waitForTimeout(1200); await closeDialogs(pg);
  let D = await H.call('/__dump', undefined, 'GET');
  ok(!(D.invoices || []).some(i => i.customer_name === 'زبون IMEI') && await pg.evaluate(() => !!document.getElementById('pos-serial-ov')), 'لا حفظ والأرقام ناقصة ⇒ تنفتح نافذة الأرقام');
  const res = await pg.evaluate(async ([pid, A, B, OLD]) => {
    const r = [];
    r.push(await posSerialAccept(pid, 'IMEI: 49-015420-323751-8'));
    r.push(await posSerialAccept(pid, 'IMEI ' + A));
    r.push(await posSerialAccept(pid, 'S/N: 0123ABCD4567'));
    r.push(await posSerialAccept(pid, OLD));
    r.push(await posSerialAccept(pid, B));
    return r.map(x => x.ok ? 'ok:' + x.code : 'no:' + x.why);
  }, [P.id, A, B, OLD]);
  ok(/^ok:490154203237518/.test(res[0]), 'IMEI بفواصل ومسبوق بوسم ⇒ يُقبل نظيفاً');
  ok(/^no:.*هذه الفاتورة/.test(res[1]), 'نفس الرقم مرّة ثانية ⇒ يُرفض (تكرار داخل الفاتورة): ' + res[1]);
  ok(/^no:/.test(res[2]), 'S/N لمنتجٍ يلزمه IMEI ⇒ يُرفض: ' + res[2]);
  ok(/^no:.*مبيعٌ سابقاً.*OLD-9/.test(res[3]), 'جهاز مبيع سابقاً بالنظام ⇒ يُرفض مع رقم فاتورته: ' + res[3]);
  ok(/^ok:353456789012348/.test(res[4]), 'الرقم الثاني يُقبل ⇒ 2/2');
  ok(await pg.evaluate(() => { liveUpdateInvoice(); const all = [...document.querySelectorAll('*')].filter(e => e.shadowRoot).map(e => e.shadowRoot.textContent).join(' ') + document.body.innerText; return /SN: 490154203237518/.test(all); }), 'الأرقام تظهر في معاينة الفاتورة (SN: …)');
  await pg.evaluate(() => { document.getElementById('pos-serial-ov')?.remove(); goTo('v-checkout'); });
  const toasts = []; await pg.exposeFunction('__tst', t => toasts.push(t)).catch(() => {}); await pg.evaluate(() => { const o = window.showToast; window.showToast = (m, k) => { try { __tst(String(m)); } catch (_) {} return o && o(m, k); }; });
  await pg.evaluate(() => saveAndFinish()); await pg.waitForTimeout(3000); await closeDialogs(pg);
  console.log('toasts:', JSON.stringify(toasts).slice(0, 400), 'cart:', await pg.evaluate(() => JSON.stringify(Object.values(cart).map(i => [i.qty, (i.serials||[]).length]))));
  D = await H.call('/__dump', undefined, 'GET');
  console.log('last inv:', JSON.stringify((D.invoices || []).slice(-1).map(i => [i.inv_number, i.customer_name, i.total])));
  const iv = (D.invoices || []).find(i => i.customer_name === 'زبون IMEI') || (D.invoices || []).slice(-1)[0] || {};
  const it = (D.invoice_items || []).find(x => String(x.invoice_id) === String(iv.id)) || {};
  ok(iv.id && Array.isArray(it.serials) && it.serials.map(x => x.code).join(',') === A + ',' + B, 'حُفظت الفاتورة والأرقام على البند نفسه: ' + JSON.stringify(it.serials));
  const sr = (D.gmt_serials || []).filter(x => x.code === A || x.code === B);
  ok(sr.length === 2 && sr.every(x => x.status === 'sold' && String(x.sale_invoice_id) === String(iv.id) && x.sale_inv_number === iv.inv_number && x.history && x.history.length === 1 && x.history[0].ev === 'sold'), 'سجلّ الجهاز: كلّ رقم «مبيع» بالفاتورة ورقمها وتاريخه: ' + JSON.stringify(sr.map(x => [x.status, x.sale_inv_number])));
  const w = await pg.evaluate(async inv => { try { allHistoryInvoices = [inv]; } catch (_) { window.allHistoryInvoices = [inv]; } await warrantyFromHistory(inv.id).catch(() => {}); return (window.__lastInvItems || [])[0] || {}; }, iv);
  ok(w.serial === A && (w.serials || []).length === 2, 'الكفالة: الرقم يُجلب من الفاتورة تلقائياً (لا إدخال يدوي ثانٍ): ' + w.serial);
  ok(!errs.filter(e => !/favicon|404|400|406|Failed to load/.test(e)).length, 'لا أخطاء JS: ' + JSON.stringify(errs.slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
