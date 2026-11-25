// TASK-B0555 · المالك A988 «فاتورة الشراء بوّابة لملفّ المنتج الكامل» · طابور Q1 · seq B1092
const H = require('./h.js');
const PI = require('../../gmt-poitem.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  const P = { id: 'p1', name: 'Godox SL60W', barcode: 'GSL60', price: 120, cost_price: 0, net_cost: 0, brand: 'Godox', group_name: 'هيد لايت', image_url: 'x.png', specs: { __desc: 'إضاءة' } };
  const PUR = [{ id: 1, inv_number: 'IMP-OLD', supplier: 'Godox', inv_date: '2026-09-01', status: 'arrived', items_snapshot: [{ id: 'p1', qty: 5, unit_price: 40 }] },
    { id: 2, inv_number: 'IMP-NEW', supplier: 'Godox', inv_date: '2026-11-01', status: 'transit', items_snapshot: [{ id: 'p1', qty: 3, unit_price: 50 }] }];
  const A = PI.analyze(P, { qty: 3, unit_price: 50 }, PUR, { invId: 2, at: '2026-11-01' });
  ok(A.history.length === 2 && A.history[0].inv === 'IMP-NEW' && A.history[1].arrived === true && A.history[0].arrived === false, 'كلّ مشترياته (الأحدث أوّلاً · وصل/بالطريق)');
  ok(A.alerts.some(a => a.k === 'pricier' && /40/.test(a.t)), 'تنبيه: السعر أعلى من آخر شراء (40 ⇐ 50)');
  ok(A.missing.includes('الكلفة') && A.missing.includes('الحدّ الأدنى') && A.missing.includes('التوافقيات') && A.completeness === 67, 'اكتمال الملفّ 67% + الناقص بالاسم');
  ok(PI.analyze({}, { qty: 1, unit_price: 0 }, [], {}).alerts.some(a => a.k === 'unlinked') && PI.analyze(P, { qty: 1, unit_price: 0, notes: 'هدية' }, [], {}).alerts.every(a => a.k !== 'zero'), 'غير مربوط ⇐ تنبيه · سعر 0 «هدية» ⇐ بلا تنبيه');
  await H.seed();
  const [X] = await H.call('/rest/v1/products', [{ name: 'منتج البوّابة', barcode: 'PI-1', price: 99, cost_price: 30, haleb: 4, brand: 'GMT', group_name: 'بانيل ليد' }]);
  await H.call('/rest/v1/import_log', [
    { id: 971, inv_number: 'IMP-PI-OLD', inv_type: 'china', supplier: 'مورد', inv_date: '2026-09-01', status: 'arrived', total_amount: 40, items_snapshot: [{ id: X.id, name: X.name, barcode: 'PI-1', qty: 2, unit_price: 20 }], created_at: '2026-09-01T00:00:00Z' },
    { id: 972, inv_number: 'IMP-PI-NEW', inv_type: 'china', supplier: 'مورد', inv_date: '2026-11-01', status: 'transit', total_amount: 75, items_snapshot: [{ id: X.id, name: X.name, barcode: 'PI-1', qty: 3, unit_price: 25 }], created_at: '2026-11-01T00:00:00Z' }]);
  const { browser, pg, errs } = await H.open('purchase.html', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 7000 });
  await pg.evaluate(() => openInvFromList('972')); await pg.waitForSelector('[data-pi-open]', { timeout: 10000 }).catch(() => {});
  ok(await pg.evaluate(() => !!document.querySelector('[data-pi-open]')), 'زرّ «ℹ️» جنب البند بالفاتورة');
  await pg.evaluate(() => document.querySelector('[data-pi-open]').click()); await pg.waitForSelector('[data-poitem]', { timeout: 10000 }).catch(() => {});
  const t = await pg.evaluate(() => (document.querySelector('[data-poitem]') || {}).textContent || '');
  const sum = await pg.evaluate(() => (document.querySelector('[data-pi-summary]') || {}).innerText || '');
  ok(/هالمرّة: 3 قطعة بـ25\.00\$/.test(sum) && /آخر مرّة اشتريته بـ20\.00\$/.test(sum) && /أغلى بـ5\.00\$/.test(sum), '«بالمختصر» ظاهر: هالمرّة 25$ · آخر مرّة 20$ ⇐ أغلى بـ5$ (B1096) — ' + sum.replace(/\n/g, ' | '));
  ok(/تفاصيل هالشراء/.test(t) && /25\.00\$/.test(t), '«🧾 تفاصيل هالشراء» (مسكّرة — بتنفتح بالضغط)');
  ok(/بالمحلّ هلّق: 4 قطعة/.test(sum) && /بيتباع بـ99\$/.test(sum) && /المنتج بالمحلّ هلّق/.test(t), '«📦 المنتج بالمحلّ هلّق» (4 قطع · 99$)');
  ok(/كلّ مرّات الشراء \(2\)/.test(t) && !/السعر أعلى من آخر شراء/.test(t), '«🛒 كلّ مرّات الشراء (2)» (والغلاء بـ«بالمختصر» بدل تنبيه مكرّر)');
  ok(await pg.evaluate(() => [...document.querySelectorAll('[data-poitem] a')].some(a => /view=det/.test(a.href)) && [...document.querySelectorAll('[data-poitem] a')].some(a => /purchase\.html\?open=971/.test(a.href))), 'روابط: ملفّ المنتج الكامل · الفاتورة القديمة (الربط العكسي)');
  ok(!errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).length, 'لا أخطاء JS: ' + JSON.stringify(errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).slice(0, 2)));
  await pg.screenshot({ path: '/tmp/claude-0/-home-user/c15c36cd-5ab9-561f-b25b-b44644a4d063/scratchpad/poitem.png' });
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
