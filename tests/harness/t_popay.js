// TASK-B0545 · A1004 P1 (seq B1076): دفعات متعدّدة لفاتورة الشراء — عملة + سعر صرف محفوظ · لا حذف (إلغاء بسبب) · شريط ملخّص ثابت ·
// القديمة على قاعدتها (مبلغ مسجَّل ⇐ «افتتاحية» مع أوّل دفعة) · المحاسبة نفس الآلية: cash_payment = المجموع ⇐ قيود [PO:] بالفرق
const H = require('./h.js');
const P = require('../../gmt-popay.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  // ① حساب صافٍ
  let s = P.summary({ total_amount: 100, cash_payment: null }, []);
  ok(s.status === 'paid' && s.source === 'legacy-full', 'قديمة بلا مبلغ ⇒ «مدفوعة» على قاعدتها');
  s = P.summary({ total_amount: 100, cash_payment: 30 }, []);
  ok(s.status === 'partial' && s.remaining === 70, 'قديمة بمبلغ 30 ⇒ جزئية · باقي 70');
  s = P.summary({ total_amount: 100, items_snapshot: [{ qty: 2 }, { qty: 3 }] }, [{ amount: 45, currency: 'EUR', fx_rate: 0.9, usd: 50 }, { amount: 20, currency: 'USD', usd: 20, due_at: '2020-01-01' }, { amount: 999, usd: 999, voided: true }]);
  ok(s.paid === 70 && s.remaining === 30 && s.items === 2 && s.qty === 5 && s.overdue, 'دفعات بعملات (45€ ÷ 0.9 = 50$) + 20$ · الملغاة ما بتنحسب · استحقاق فات ⇒ مستحقّة: ' + JSON.stringify(s));
  ok(P.usdOf({ amount: 72, currency: 'CNY', fx_rate: 7.2 }) === 10 && P.usdOf({ amount: 5, currency: 'SYP' }) === 0, 'لا تحويل بلا سعر صرف');
  // ② الواجهة + المحاسبة
  await H.seed();
  const [I] = await H.call('/rest/v1/import_log', [{ inv_number: 'IMP-PAY-1', inv_type: 'china', supplier: 'مورد الدفعات', inv_date: '2026-11-01', status: 'transit', total_amount: 100, cash_payment: 30, items_snapshot: [{ name: 'بند', qty: 2, unit_price: 50 }], created_at: '2026-11-01T00:00:00Z' }]);
  const { browser, pg, errs } = await H.open('purchase.html', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 7000 });
  await pg.evaluate(() => { window.__ans = []; GMTAsk.form = async (m, o) => { const v = window.__ans.shift(); if (v && o.submit && o.submit(v) !== true) return null; return v || null; }; GMTAsk.prompt = async () => window.__ans.shift() || null; GMTAsk.alert = async () => {}; });
  await pg.waitForSelector('[data-popay-open="' + I.id + '"]', { timeout: 15000 }).catch(() => {});
  ok(await pg.evaluate(id => !!document.querySelector('[data-popay-open="' + id + '"]') && /جزئية/.test((document.querySelector('[data-popay-chip="' + id + '"]') || {}).textContent || ''), I.id), 'زرّ 💳 + شارة «جزئية» على البطاقة');
  await pg.evaluate(id => openPoPay(id), I.id); await pg.waitForSelector('[data-popay-bar]', { timeout: 8000 });
  ok(/70\.00\$/.test(await pg.textContent('[data-popay-bar]')), 'الشريط الثابت: المتبقّي 70$');
  await pg.evaluate(() => { window.__ans.push({ amount: '45', currency: 'EUR', fx_rate: '0.9', kind: 'partial', method: 'transfer', ref_no: 'TR-1', paid_at: '2026-11-20', due_at: '2026-12-01', paid_by: 'المالك', note: '' }); document.querySelector('[data-popay-add]').click(); });
  await pg.waitForTimeout(2500);
  let D = await H.call('/__dump', undefined, 'GET');
  const pays = (D.gmt_po_payments || []).filter(x => String(x.purchase_id) === String(I.id));
  ok(pays.length === 2 && pays.some(x => x.kind === 'opening' && Number(x.usd) === 30) && pays.some(x => x.currency === 'EUR' && Number(x.usd) === 50 && Number(x.fx_rate) === 0.9), 'المبلغ القديم انحفظ «افتتاحية» + الدفعة باليورو بسعر صرفها');
  let row = D.import_log.find(x => x.id === I.id);
  ok(Number(row.cash_payment) === 80, 'cash_payment = مجموع الدفعات (80)');
  const led = () => H.call('/__dump', undefined, 'GET').then(d => (d.gmt_expenses || []).filter(e => /\[PO:/.test(e.note || '') && String(e.note).indexOf('[PO:' + I.id + ':g') >= 0).reduce((t, e) => t + Number(e.amount), 0));
  ok(Math.abs(await led() - 80) < 0.01, 'المحاسبة (قيود [PO:]) = 80 — نفس الآلية');
  ok(/20\.00\$/.test(await pg.textContent('[data-popay-bar]')), 'الشريط اتحدّث: المتبقّي 20$');
  await pg.evaluate(() => { window.__ans.push('حوالة رجعت'); document.querySelector('[data-popay-void]').click(); }); await pg.waitForTimeout(2500);
  D = await H.call('/__dump', undefined, 'GET'); row = D.import_log.find(x => x.id === I.id);
  const v = (D.gmt_po_payments || []).find(x => x.voided);
  ok(v && v.void_reason === 'حوالة رجعت' && D.gmt_po_payments.filter(x => String(x.purchase_id) === String(I.id)).length === 2, 'الإلغاء بسبب — الدفعة بتضلّ مسجّلة (لا حذف)');
  ok(Number(row.cash_payment) === 30 && Math.abs(await led() - 30) < 0.01, 'بعد الإلغاء: cash_payment والمحاسبة رجعوا 30 (قيد تخفيض لا حذف)');
  ok(!errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).length, 'لا أخطاء JS: ' + JSON.stringify(errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
