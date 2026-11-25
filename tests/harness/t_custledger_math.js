// (TASK-B0533 · seq B1045 «عملاء شراء دائمين … بالدين») حساب الكشف بلا متصفّح: الدين يزيد بالآجل · ينقص بالقبض الجزئيّ ·
//   السند المُلغى لا يُحسب · سند بالليرة يُحوَّل بسعر صرفه · مرتجع فاتورة دين يُنقص الدين بما لا يتجاوز الباقي · الرصيد المتراكم بالتاريخ
const L = require('../../gmt-custledger.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const inv = [
  { id: 'a', inv_number: 'S-1', created_at: '2026-11-01T10:00:00Z', total: 100, paid_amount: 0, remaining_amount: 100, sale_type: 'آجل' },
  { id: 'b', inv_number: 'S-2', created_at: '2026-11-03T10:00:00Z', total: 80, paid_amount: 30, remaining_amount: 50, sale_type: 'آجل' },
  { id: 'c', inv_number: 'S-3', created_at: '2026-11-04T10:00:00Z', total: 40, paid_amount: 40, remaining_amount: 0, sale_type: 'نقدي' },
  { id: 'r', inv_number: 'R-1', created_at: '2026-11-06T10:00:00Z', total: -70, is_refund: true, original_invoice_id: 'b' }];
const rc = [
  { id: 'x', created_at: '2026-11-02T10:00:00Z', amount: 40, currency: 'USD', method: 'cash' },
  { id: 'y', created_at: '2026-11-05T10:00:00Z', amount: 110000, currency: 'SYP', exchange_rate: 11000, method: 'cash' },
  { id: 'z', created_at: '2026-11-05T12:00:00Z', amount: 999, currency: 'USD', voided: true }];
const st = L.statement(inv, rc);
ok(st.debit === 150, 'الدين = الباقي على الآجل فقط (100 + 50 · النقدي المدفوع لا يُعدّ): ' + st.debit);
ok(st.rows.some(r => r.kind === 'rcpt' && r.credit === 10), 'سند 110000 ل.س بسعر 11000 = 10$');
ok(!st.rows.some(r => r.id === 'z'), 'السند المُلغى لا يدخل الحساب');
ok(st.rows.some(r => r.kind === 'ret' && r.credit === 50), 'مرتجع 70$ على فاتورة باقيها 50$ ⇒ يُنقص 50 فقط (لا يصير الزبون دائناً بما دفعه نقداً)');
ok(st.balance === 150 - 40 - 10 - 50, 'الرصيد = 150 − 40 − 10 − 50 = 50: ' + st.balance);
ok(st.rows.map(r => r.balance).join(',') === '100,60,110,100,50', 'الرصيد المتراكم بترتيب التاريخ: ' + st.rows.map(r => r.balance).join(','));
// (TASK-B0543) سند موزَّع على فاتورة: الباقي عليها نقص فعلاً ⇒ الكشف ما بيطرحه مرّتين
const st2 = L.statement([{ id: 'a', inv_number: 'S-1', created_at: '2026-11-01T10:00:00Z', total: 100, paid_amount: 40, remaining_amount: 60 }],
  [{ id: 'x', created_at: '2026-11-02T10:00:00Z', amount: 40, currency: 'USD', method: 'cash', allocations: [{ invoice_id: 'a', amount: 40 }] }]);
ok(st2.debit === 100 && st2.balance === 60, '(B0543) سند موزَّع 40$ على فاتورة باقيها صار 60 ⇒ دين 100 − 40 = 60 (لا 20): ' + st2.balance);
const st3 = L.statement([{ id: 'a', created_at: '2026-11-01T10:00:00Z', total: 100, paid_amount: 100, remaining_amount: 0 }],
  [{ id: 'x', created_at: '2026-11-02T10:00:00Z', amount: 100, currency: 'USD', allocations: [{ invoice_id: 'a', amount: 100 }] }]);
ok(st3.balance === 0 && st3.rows.length === 2, '(B0543) فاتورة سدّدها سند بالكامل بتضلّ بالكشف (دين 100 · سند 100 · رصيد 0)');
const empty = L.statement([], []);
ok(empty.balance === 0 && empty.rows.length === 0, 'عميل بلا شيء ⇒ رصيد 0');
console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
