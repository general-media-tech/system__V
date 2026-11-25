// TASK-B0548 · A1004 P3 · طابور Q1 (seq B1078/B1080): الموردون — ملفّ لكلّ مورّد (من فواتيره بلا اختراع) · ضمّ الأسماء بضغطتك · كشف حساب
const H = require('./h.js');
require('../../gmt-popay.js'); const SP = require('../../gmt-suppliers.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  const S = [{ id: 1, inv_number: 'A1', supplier: 'شركة مدى', inv_date: '2026-10-01', total_amount: 100, cash_payment: 60 },
    { id: 2, inv_number: 'A2', supplier: 'مدى', inv_date: '2026-11-01', total_amount: 50, cash_payment: 0 },
    { id: 3, inv_number: 'B1', supplier: 'EU', inv_date: '2026-11-05', total_amount: 200, cash_payment: null }];
  let G = SP.groups(S, [], null);
  ok(G.length === 3 && G[0].name === 'EU' && G[0].remaining === 0, 'بلا مورّدين مسجّلين: كلّ اسم مجموعة (الأكبر أوّلاً) · الفارغة = مدفوعة');
  const sim = SP.similar(G).map(p => [p[0].name, p[1].name].sort().join('|'));
  ok(sim.includes('شركة مدى|مدى'), '«شركة مدى» و«مدى» مقترحة كمتشابهة (للضمّ بضغطة لا تلقائي)');
  G = SP.groups(S, [{ id: 'm', name: 'شركة مدى', aliases: ['مدى'] }], null);
  const m = G.find(x => x.sup && x.sup.id === 'm');
  ok(m && m.invs.length === 2 && m.value === 150 && m.paid === 60 && m.remaining === 90, 'مسجّل + اسم بديل ⇒ فاتورتين · 150 · مدفوع 60 · باقي 90');
  const st = SP.statement(m, null);
  ok(st.balance === 90 && st.rows.map(r => r.balance).join(',') === '100,40,90', 'كشف الحساب بالتاريخ: 100 ⇐ دفعة 60 ⇐ 40 ⇐ فاتورة 50 ⇐ 90: ' + st.rows.map(r => r.balance).join(','));
  // الواجهة
  await H.seed();
  await H.call('/rest/v1/import_log', [
    { id: 901, inv_number: 'IMP-S1', inv_type: 'china', status: 'arrived', supplier: 'شركة الاختبار', supplier_phone: '011-555', inv_date: '2026-10-01', total_amount: 100, cash_payment: 100, items_snapshot: [] },
    { id: 902, inv_number: 'IMP-S2', inv_type: 'china', status: 'transit', supplier: 'الاختبار', inv_date: '2026-11-01', total_amount: 40, cash_payment: 0, items_snapshot: [] }]);
  const { browser, pg, errs } = await H.open('purchase.html', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 7000 });
  await pg.evaluate(() => { window.__ans = []; GMTAsk.form = async (m, o) => { const v = window.__ans.shift(); return v || null; }; GMTAsk.confirm = async () => true; GMTAsk.alert = async () => {}; });
  ok(await pg.evaluate(() => !!document.getElementById('btn-po-suppliers')), 'زرّ «🏭 الموردون» بالصفحة');
  await pg.evaluate(() => openSuppliers()); await pg.waitForSelector('#gmt-suppliers [data-sp-key]', { timeout: 10000 });
  ok(await pg.evaluate(() => /أسماء متشابهة/.test(document.getElementById('gmt-suppliers').innerText)), 'اقتراح «أسماء متشابهة» بالقائمة');
  await pg.evaluate(() => [...document.querySelectorAll('#gmt-suppliers [data-sp-key]')].find(x => /شركة الاختبار/.test(x.innerText)).click());
  await pg.evaluate(() => document.querySelector('[data-sp-reg]').click()); await pg.waitForTimeout(1500);
  let D = await H.call('/__dump', undefined, 'GET'); const sup = (D.gmt_suppliers || [])[0];
  ok(sup && sup.name === 'شركة الاختبار' && sup.phone === '011-555' && D.import_log.find(x => x.id === 901).supplier_id === sup.id, '⭐ سجّله كمورّد: الاسم والهاتف من فاتورته · الفاتورة انربطت');
  ok(D.import_log.find(x => x.id === 901).supplier === 'شركة الاختبار', 'النصّ القديم على الفاتورة ما تغيّر');
  await pg.evaluate(() => { window.__ans.push({ country: 'الصين', city: 'شنزن', pay_terms: '30% مقدّم' }); document.querySelector('[data-sp-edit]').click(); }); await pg.waitForTimeout(1200);
  D = await H.call('/__dump', undefined, 'GET');
  ok(D.gmt_suppliers[0].country === 'الصين' && D.gmt_suppliers[0].pay_terms === '30% مقدّم', '✏️ البيانات انحفظت (يلي كتبته بس)');
  await pg.evaluate(() => { window.__ans.push({ n: 'N:الاختبار' }); document.querySelector('[data-sp-link]').click(); }); await pg.waitForTimeout(1500);
  D = await H.call('/__dump', undefined, 'GET');
  ok((D.gmt_suppliers[0].aliases || []).includes('الاختبار') && D.import_log.find(x => x.id === 902).supplier_id === D.gmt_suppliers[0].id, '🔗 ضمّ «الاختبار» ⇒ اسم بديل + فاتورته انربطت');
  const t = await pg.evaluate(() => document.getElementById('gmt-suppliers').innerText);
  ok(/الباقي علينا هلّق\s*40\.00\$/.test(t) && /IMP-S2/.test(t), 'كشف الحساب بالفاتورتين · الباقي علينا 40$');
  ok(await pg.evaluate(() => { const ds = [...document.querySelectorAll('[data-sp-st] [data-sp-inv] span[dir="ltr"]')].map(x => x.textContent).filter(x => /^\d{4}-\d\d-\d\d$/.test(x)); return ds.length >= 2 && ds.every((d, i) => i === 0 || ds[i - 1] >= d); }), '(B1112) كشف الحساب: الأحدث فوق والقديم لتحت');
  ok(!errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).length, 'لا أخطاء JS: ' + JSON.stringify(errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
