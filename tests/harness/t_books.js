// TASK-B0563 · seq B1101 — السجلّ المالي الكامل + ما لنا وما علينا + إقفال السنة
const H = require('./h.js');
global.window = globalThis;
require('../../gmt-ledger.js'); require('../../gmt-popay.js'); const B = require('../../gmt-books.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const ctx = {
    invoices: [{ id: 1, inv_number: 'S1', total: 100, paid_amount: 100, branch_key: 'haleb', created_at: '2026-03-01T10:00:00Z' },
      { id: 2, inv_number: 'S2', total: 50, paid_amount: 20, sale_type: 'آجل', branch_key: 'haleb', created_at: '2026-04-01T10:00:00Z' },
      { id: 3, inv_number: 'OLD', total: 70, paid_amount: 70, branch_key: 'haleb', created_at: '2025-12-30T10:00:00Z' }],
    expenses: [{ id: 'e1', title: 'كهربا', amount: 30, currency: 'usd', approved: true, is_general: true, created_at: '2026-03-05T00:00:00Z' },
      { id: 'e2', title: 'رفوف', amount: 200, currency: 'usd', approved: true, is_general: true, kind: 'رأسمالي', created_at: '2026-03-06T00:00:00Z' },
      { id: 'e3', title: 'دفعة شراء', amount: 500, currency: 'usd', approved: true, is_general: true, note: '[PO:9:g:1] دفعها: الإدارة', created_at: '2026-02-01T00:00:00Z' },
      { id: 'e4', title: 'جمارك', amount: 60, currency: 'usd', approved: true, is_general: true, note: '[PO:9:c:1] دفعها: أبو خالد', created_at: '2026-02-10T00:00:00Z' }],
    purchases: [{ id: 9, inv_number: 'CN-9', supplier: 'مورد', inv_type: 'china', status: 'transit', total_amount: 1000, cost_shipping: 100, cost_customs: 60, costs_paid: true, cash_payment: 500, inv_date: '2026-02-01' },
      { id: 10, inv_number: 'CN-10', supplier: 'مورد', inv_type: 'china', status: 'arrived', total_amount: 300, cost_shipping: 0, cost_customs: 40, costs_paid: false, cash_payment: 300, inv_date: '2026-05-01' }],
    poPays: [], receipts: [{ id: 'r1', customer_name: 'زبون', amount: 10, created_at: '2026-04-10T00:00:00Z' }],
    comm: [{ id: 'c1', amount: 5, paid: true, paid_at: '2026-04-02T00:00:00Z' }, { id: 'c2', amount: 7, paid: false }],
    debts: [{ id: 2, total: 50, remaining_amount: 20 }], manualDebts: [{ direction: 'i_owe', amount: 15 }, { direction: 'owed_to_me', amount: 25 }],
    reservations: [{ status: 'pending', deposit: 12 }], isMgmt: () => true, isExcluded: () => false, opening: 0, stock: { value: 400, units: 10, noCost: 2 } };
  const J = B.journal(ctx, B.yearRange(2026));
  ok(J.length === 8 && !J.some(e => e.ref === 'OLD'), 'كلّ حركات 2026 (مبيعين · تحصيل · مصروف · أصل · دفعة مورّد · جمارك · عمولة) — بلا 2025: ' + J.length);
  ok(J.find(e => e.kind === 'supplier').amount === -500 && J.find(e => e.kind === 'costs').amount === -60 && J.find(e => e.kind === 'asset').amount === -200, 'دفعة المورّد −500 · الشحن والجمارك −60 · الأصل −200 (مو مصروف)');
  const S = B.summary(ctx, B.yearRange(2026));
  ok(S.sales === 150 && S.cash === 120 && S.credit === 30 && S.expenses === 30 && S.assets === 200 && S.supplierPaid === 500 && S.costsPaid === 60 && S.collections === 10 && S.commPaid === 5, 'ملخّص السنة: مبيعات 150 (آجل 30) · مصاريف 30 · أصول 200 · مورّدين 500 · شحن وجمارك 60');
  ok(S.purchases.count === 2 && S.purchases.due === 1400 && S.purchases.transit === 1100 && S.purchases.arrived === 300, 'المشتريات: 1400 (مع شحن الصين) · بالطريق 1100 · واصل 300');
  const P = B.position(ctx);
  ok(P.payables.suppliers === 600 && P.payables.costs === 40 && P.payables.commissions === 7 && P.payables.manual === 15 && P.payables.deposits === 12 && P.payables.total === 674, 'علينا: مورّدين 600 (1100−500) · جمارك لسّا 40 · عمولات 7 · يدوي 15 · عرابين 12 = 674');
  ok(P.receivables.customers === 20 && P.receivables.manual === 25 && P.stock.value === 400 && P.assets === 200, 'لنا: آجل 20 · يدوي 25 · بضاعة 400 · أصول 200');
  const snap = B.closeSnapshot(ctx, 2026);
  ok(snap.year === 2026 && snap.position.payables.total === 674 && snap.summary.sales === 150 && snap.suppliers.length === 1, 'لقطة الإقفال: ما علينا وما لنا وملخّص السنة والمورّدين');
  ok(/^﻿/.test(B.csv(J)) && B.csv(J).split('\n').length === 9, 'CSV لكلّ الحركات');
  /* الواجهة */
  await H.seed();
  const { browser, pg, errs } = await H.open('admin_pos.html', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 6000 });
  await pg.evaluate(() => switchTab('accounting')); await sleep(800);
  ok(await pg.evaluate(() => !!document.querySelector('[data-books-open]')), 'زرّ «📒 السجلّ المالي الكامل» بالمحاسبة');
  await pg.click('[data-books-open]'); await pg.waitForFunction(() => document.querySelector('[data-books]') && !/عم يجمع/.test(document.querySelector('[data-books]').innerText), null, { timeout: 12000 }).catch(() => {});
  let t = await pg.evaluate(() => document.querySelector('[data-books]').innerText);
  ok(/المبيعات/.test(t) && /المال اللي دخل وطلع/.test(t) && /بالشهر/.test(t), 'تبويب السنة: المبيعات · الربح · المصاريف · المشتريات · دخل وطلع · بالشهر');
  await pg.click('[data-bk-tab="pos"]'); t = await pg.evaluate(() => document.querySelector('[data-books]').innerText);
  ok(/ما لنا/.test(t) && /علينا/.test(t) && /للمورّدين/.test(t) && /الصافي التقديري/.test(t), 'تبويب «ما لنا وما علينا»');
  await pg.click('[data-bk-tab="jr"]'); ok(await pg.evaluate(() => !!document.querySelector('[data-bk-q]')), 'تبويب «كلّ الحركات» + بحث + CSV');
  await pg.click('[data-bk-tab="close"]');
  await pg.evaluate(() => { window.GMTAsk = Object.assign(window.GMTAsk || {}, { confirm: () => Promise.resolve(true) }); });
  await pg.click('[data-bk-close]'); await sleep(900);
  const d = await H.call('/__dump', undefined, 'GET'), fy = (d.gmt_fiscal_years || [])[0];
  ok(fy && fy.year === new Date().getFullYear() && fy.snapshot && fy.snapshot.position && fy.snapshot.summary, 'إقفال السنة انحفظ بـgmt_fiscal_years مع اللقطة');
  t = await pg.evaluate(() => document.querySelector('[data-books]').innerText);
  ok(/انقفلت/.test(t), 'بعد الإقفال: «🔒 السنة انقفلت» + مقارنة إذا تغيّرت الأرقام');
  ok(!errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).length, 'لا أخطاء JS: ' + JSON.stringify(errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).slice(0, 2)));
  await pg.click('[data-bk-tab="pos"]');
  await pg.setViewportSize({ width: 390, height: 844 }); await sleep(300);
  ok(await pg.evaluate(() => document.documentElement.scrollWidth <= 392), 'عالهاتف: بلا تمرير أفقي');
  await pg.screenshot({ path: '/tmp/claude-0/-home-user/c15c36cd-5ab9-561f-b25b-b44644a4d063/scratchpad/books_m.png' });
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
