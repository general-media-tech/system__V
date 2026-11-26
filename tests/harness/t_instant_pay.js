// (المالك seq B1127) «ضيف إنّو بحسن حطّلهن تسجيل دفعة» — فواتير الشراء الفوري (الرائد · مدى · عالم الإكسسوار) ما كان إلها 💳
// الجذر: بطاقة الشراء الفوري ما أخدت زرّ الدفعات ولا شارة «مدفوع/باقي» اللي بفواتير الصين وأوروبا ⇒ نفس الأداة بكلّ أنواع الفواتير
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const [I] = await H.call('/rest/v1/import_log', [{ id: 961, inv_number: 'PO-T-0001', inv_type: 'instant', supplier: 'شركة مدى', inv_date: '2026-10-13', status: 'arrived', dest_branch: 'daraa', total_amount: 59.89, cash_payment: 0, items_snapshot: [{ id: 'p1', name: 'كابل', qty: 2, cost: 29.945 }], created_at: '2026-10-13T00:00:00Z' }]);
  const { browser, pg, errs } = await H.open('purchase.html', { init: H.ADMIN_INIT, w: 390, h: 844, mobile: true, wait: 7000 });
  await pg.evaluate(() => { window.__ans = []; GMTAsk.form = async (m, o) => { const v = window.__ans.shift(); if (v && o.submit && o.submit(v) !== true) return null; return v || null; }; });
  await pg.waitForSelector('[data-popay-open="' + I.id + '"]', { timeout: 15000 }).catch(() => {});
  ok(await pg.evaluate(id => { const b = document.querySelector('#list-instant [data-popay-open="' + id + '"]'); return !!b; }, I.id), 'بطاقة الشراء الفوري فيها 💳 «تسجيل دفعة»');
  ok(await pg.evaluate(id => !!document.querySelector('#list-instant [data-popay-chip="' + id + '"]'), I.id), 'وفيها شارة الدفع (مدفوع/باقي)');
  ok(await pg.evaluate(id => !!document.querySelector('#list-instant [data-podocs-open="' + id + '"]'), I.id), 'وفيها 📎 المستندات');
  await pg.evaluate(id => openPoPay(id), I.id); await pg.waitForSelector('[data-popay-bar]', { timeout: 8000 }).catch(() => {});
  ok(/59\.89\$/.test(await pg.textContent('[data-popay-bar]').catch(() => '')), 'نافذة الدفعات بتفتح: الباقي 59.89$');
  await pg.evaluate(() => { window.__ans.push({ amount: '20', currency: 'USD', fx_rate: '1', kind: 'partial', method: 'cash', ref_no: '', paid_at: '2026-11-26', due_at: '', paid_by: 'المالك', note: '' }); document.querySelector('[data-popay-add]').click(); });
  await sleep(2500);
  const D = await H.call('/__dump', undefined, 'GET');
  const pays = (D.gmt_po_payments || []).filter(x => String(x.purchase_id) === String(I.id) && !x.voided);
  ok(pays.length === 1 && Number(pays[0].usd) === 20, 'الدفعة انحفظت (20$): ' + pays.length);
  ok(/39\.89\$/.test(await pg.textContent('[data-popay-bar]').catch(() => '')), 'الباقي صار 39.89$');
  ok(!errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).length, 'لا أخطاء JS: ' + JSON.stringify(errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
