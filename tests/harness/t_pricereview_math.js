// (TASK-B0536 · seq B1040 «راجع كل شيء مسعر … اشياء مشتريه ومعاد موجود منها … لازم نعرف وين راح») الحساب بلا متصفّح
const R = require('../../gmt-pricereview.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const P = [
  { id: 'a', name: 'لوح 660', price: 77.4, cost_price: 40, net_cost: 60, haleb: 3 },
  { id: 'b', name: 'شاحن', price: 0, cost_price: 0, haleb: 5 },
  { id: 'c', name: 'درون نيو', price: 500, cost_price: 520, net_cost: 0, daraa: 1 },
  { id: 'd', name: 'ستاند ٢م', price: 20, cost_price: 8, net_cost: 25, haleb: 0 }];
const S = [{ id: 's1', inv_id: 'a', name: 'لوح 660', price: 66.4, options: [{ values: [{ name: 'بدون بطارية', inv_id: 'a', price: 66.4 }] }] }, { id: 's2', inv_id: 'zz', name: 'فلتر UV', price: 5 }];
const pr = R.pricing(P, S, [{ product_id: 'a', old_price: 90, new_price: 70, ends_at: '2026-01-01', reverted_at: null }], { now: Date.parse('2026-11-25') });
ok(pr.storeDiff.length === 1 && pr.storeDiff[0].store === 66.4 && pr.storeDiff[0].inv === 77.4, 'سعر المتجر ≠ الجرد يُكشف (66.4 ≠ 77.4)');
ok(pr.optDiff.length === 1, 'خيار المتجر المرتبط بمنتج جرد بسعر مختلف يُكشف');
ok(pr.storeOrphan.length === 1 && pr.storeOrphan[0].name === 'فلتر UV', 'منتج متجر بلا منتج جرد');
ok(pr.noSale.some(x => x.id === 'b' && x.stock === 5), 'بلا سعر مبيع وله مخزون (أوّلاً)');
ok(pr.noCost.some(x => x.id === 'b') && !pr.noCost.some(x => x.id === 'd'), 'له مخزون بلا كلفة (لا يُذكر ما لا مخزون له)');
ok(pr.loss.length === 1 && pr.loss[0].id === 'c', 'بيعٌ بخسارة يُقاس على cost_price وحده (net_cost = الحدّ الأدنى لا الكلفة)');
ok(pr.belowMin.length === 1 && pr.belowMin[0].id === 'd', 'المبيع تحت الحدّ الأدنى فحصٌ مستقلّ');
ok(pr.strike.length === 1 && pr.strike[0].expired, 'سعر مشطوب منتهٍ ولم يُرجَع يُكشف');
const T = R.trace({ salesStart: '2026-04-24', products: [
    { id: 'x', name: 'بطارية F550', cost_price: 3, haleb: 79, china: 50 }, { id: 'y', name: 'جلدة عين', cost_price: 1, haleb: 13 },
    { id: 'z', name: 'ستاند رينغ لايت', cost_price: 4 }, { id: 'w', name: 'كفر R50', cost_price: 8, haleb: 10 }],
  purchases: [
    { status: 'arrived', inv_number: 'CN-1', arrived_at: '2026-06-01', items_snapshot: [{ id: 'x', qty: 236 }, { id: 'z', qty: 96 }] },
    { status: 'arrived', inv_number: 'OLD-1', arrived_at: '2025-11-01', items_snapshot: [{ id: 'y', qty: 118 }] },
    { status: 'transit', inv_number: 'CN-2', items_snapshot: [{ id: 'x', qty: 999 }] }],
  rebuilds: [{ product_id: 'w', qty: 8, transfer_number: 'TRF-15' }],
  sales: [{ product_id: 'x', qty: 10 }, { product_id: 'x', qty: 2, is_refund: true }],
  orderTexts: ['ستاند رينغ لايت × 2'] });
const g = id => T.rows.find(r => r.id === id);
ok(g('x').gap === 236 - 8 - 79 - 50 && g('x').kind === 'lost', 'بطارية: 236 − (10−2) − 79 − 50 = ' + g('x').gap + ' ⇒ فاقد (اشتُريت بعد بدء تسجيل المبيعات) · الفاتورة بالطريق لا تُحسب');
ok(g('y').kind === 'before', 'جلدة عين اشتُريت قبل بدء تسجيل المبيعات ⇒ «قبل التسجيل» لا فاقد');
ok(g('z').kind === 'orders' && g('z').inOrders === 1, 'ستاند رينغ لايت مذكور بأوردر نصّي ⇒ «ربما بأوردر»');
ok(g('w').kind === 'surplus' && g('w').gap === -2, 'كفر R50: تسوية 8 والموجود 10 ⇒ زيادة 2');
ok(g('x').value === g('x').gap * 3 && T.rows[0].id === 'z' && T.rows[1].id === 'x', 'قيمة الفاقد = الفجوة × الكلفة · الأعلى قيمةً أوّلاً (ستاند 96×4=384 ثمّ بطارية 99×3=297)');
ok(T.lost.n === 1 && T.before.n === 1 && T.orders.n === 1 && T.surplus.n === 1, 'الملخّص بالتصنيفات الأربعة');
console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
