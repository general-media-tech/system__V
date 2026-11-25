// TASK-B0558 · A1004 P6 · seq B1095 — تقارير المشتريات
const H = require('./h.js');
const PR = require('../../gmt-poreports.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  const INV = [
    { id: 1, inv_number: 'C-1', inv_type: 'china', supplier: 'مورد الصين', inv_date: '2026-09-10', status: 'arrived', currency: 'USD', cost_shipping: 100, cost_customs: 50, items_snapshot: [{ id: 'a', name: 'لمبة', qty: 10, unit_price: 25, orig_unit_price: 10 }, { id: 'b', name: 'حامل', qty: 5, unit_price: 20, orig_unit_price: 20 }] },
    { id: 2, inv_number: 'C-2', inv_type: 'china', supplier: 'مورّد  الصين', inv_date: '2026-11-01', status: 'transit', currency: 'USD', cost_transport: 30, items_snapshot: [{ id: 'a', name: 'لمبة', qty: 10, orig_unit_price: 12 }] },
    { id: 3, inv_number: 'I-1', inv_type: 'instant', supplier: 'محلّ', inv_date: '2026-10-05', status: 'arrived', currency: 'USD', items_snapshot: [{ id: 'b', name: 'حامل', qty: 2, unit_price: 19 }] },
    { id: 4, inv_number: 'E-1', inv_type: 'germany', supplier: 'DE', inv_date: '2026-10-07', status: 'arrived', currency: 'EUR', items_snapshot: [{ id: 'c', qty: 1, unit_price: 500 }] },
    { id: 5, inv_number: 'X-1', inv_type: 'china', supplier: 'مورد الصين', inv_date: '2026-10-07', status: 'cancelled', currency: 'USD', items_snapshot: [{ id: 'a', qty: 100, unit_price: 1 }] },
    { id: 6, inv_number: 'OLD', inv_type: 'china', supplier: 'قديم', inv_date: '2025-01-01', status: 'arrived', currency: 'USD', items_snapshot: [{ id: 'a', qty: 1, unit_price: 9 }] }];
  const R = PR.build(INV, { months: 12, now: '2026-11-25T00:00:00Z' });
  ok(R.kpi.n === 3 && R.kpi.value === 358 && R.kpi.costs === 180, 'القيمة بالسعر الأصلي (100+100+120+38=358) · التكاليف 180 · الملغاة والقديمة واليورو برّا ' + JSON.stringify(R.kpi));
  ok(R.kpi.overhead === 50.3 && R.kpi.landed === 538, 'نسبة التكاليف 50.3% · الواصلة 538');
  ok(R.others.length === 1 && R.others[0].cur === 'EUR' && R.others[0].n === 1, 'فاتورة اليورو محسوبة لحالها (ما منخلط العملات)');
  ok(R.months.map(m => m.m).join() === '2026-09,2026-10,2026-11' && R.months[0].costs === 150, 'الصرف بالشهر مرتّب');
  ok(R.suppliers[0].name.includes('الصين') && R.suppliers[0].n === 2 && R.suppliers.length === 2, 'المورّد بكتابتين = مورّد واحد · مرتّب بالصرف');
  const L = R.products.find(p => p.id === 'a');
  ok(L && L.qty === 20 && L.first === 10 && L.last === 12 && L.change === 20, 'المنتج: أوّل سعر 10 ⇐ آخر 12 (+20%)');
  ok(R.rises.length === 1 && R.rises[0].id === 'a' && R.rises[0].pct === 20 && R.rises[0].prevInv === 'C-1', 'ارتفاع الأسعار: اللمبة +20% (الحامل نزل ⇒ مو بالقائمة)');
  ok(PR.build(INV, { now: '2026-11-25T00:00:00Z' }).kpi.n === 4 && PR.build(INV, { months: 12, type: 'instant', now: '2026-11-25T00:00:00Z' }).kpi.n === 1 && PR.build(INV, { months: 12, supplier: 'مورد الصين', now: '2026-11-25T00:00:00Z' }).kpi.n === 2, 'الفلاتر: كلّ الفترة · النوع · المورّد');
  ok(/^﻿/.test(PR.csv(R)) && /ارتفاع سعر/.test(PR.csv(R)), 'CSV (مع BOM للإكسل)');
  /* الواجهة */
  await H.seed();
  await H.call('/rest/v1/import_log', INV.map(x => Object.assign({ created_at: x.inv_date + 'T00:00:00Z' }, x)));
  const { browser, pg, errs } = await H.open('purchase.html?reports=1', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 7000 });
  await pg.waitForSelector('[data-poreports]', { timeout: 12000 }).catch(() => {});
  let t = await pg.evaluate(() => (document.querySelector('[data-poreports]') || {}).innerText || '');
  ok(/تقارير المشتريات/.test(t) && /نسبة التكاليف/.test(t) && /EUR/.test(t) && !!(await pg.$('[data-pr-chart]')), '?reports=1 يفتح التقارير: البطاقات + الرسم + تنبيه العملة');
  await pg.click('[data-pr-tab="rise"]'); t = await pg.evaluate(() => document.querySelector('[data-poreports]').innerText);
  ok(/لمبة/.test(t) && /\+20%/.test(t), 'تبويب «ارتفاع الأسعار»');
  await pg.click('[data-pr-tab="sup"]'); await pg.click('[data-pr-sup]'); 
  const f = await pg.evaluate(() => document.querySelector('[data-pr-f="supplier"]').value);
  ok(/الصين/.test(f), 'الضغط على المورّد يصفّي التقرير عليه: ' + f);
  ok(await pg.evaluate(() => !!document.getElementById('btn-po-reports')), 'زرّ «📈 التقارير» بشريط المشتريات');
  ok(!errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).length, 'لا أخطاء JS: ' + JSON.stringify(errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).slice(0, 2)));
  await pg.click('[data-pr-tab="sum"]');
  await pg.screenshot({ path: '/tmp/claude-0/-home-user/c15c36cd-5ab9-561f-b25b-b44644a4d063/scratchpad/poreports.png' });
  await pg.setViewportSize({ width: 390, height: 844 }); await new Promise(r => setTimeout(r, 300));
  ok(await pg.evaluate(() => document.documentElement.scrollWidth <= 392), 'عالهاتف: بلا تمرير أفقي');
  await pg.screenshot({ path: '/tmp/claude-0/-home-user/c15c36cd-5ab9-561f-b25b-b44644a4d063/scratchpad/poreports_m.png' });
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
