// seq B1097 — «وايمن شنزن» = «Shenzhen Shixin Trading» ⇐ مورّد واحد بالمقارنة والتقارير (نصّ الفاتورة ما بيتغيّر)
global.window = globalThis;
const SU = require('../../gmt-suppliers.js'), PI = require('../../gmt-poitem.js'), PR = require('../../gmt-poreports.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
SU._setSups([{ id: 'u1', name: 'Shenzhen Shixin Trading Co., Ltd', aliases: ['وايمن شنزن'] }]);
ok(SU.canon({ supplier: 'وايمن  شنزن' }) === 'Shenzhen Shixin Trading Co., Ltd' && SU.canon({ supplier: 'x', supplier_id: 'u1' }) === 'Shenzhen Shixin Trading Co., Ltd' && SU.canon({ supplier: 'مورد تاني' }) === 'مورد تاني', 'الاسم الموحّد: من الاسم البديل · من supplier_id · غيره كما هو');
const INV = [
  { id: 1, inv_number: 'CN-1', inv_type: 'china', supplier: 'وايمن شنزن', inv_date: '2026-06-01', status: 'arrived', currency: 'USD', items_snapshot: [{ id: 'p', qty: 5, unit_price: 10 }] },
  { id: 2, inv_number: 'CN-8', inv_type: 'china', supplier: 'Shenzhen Shixin Trading Co., Ltd', inv_date: '2026-11-15', status: 'transit', currency: 'USD', items_snapshot: [{ id: 'p', qty: 5, unit_price: 9 }] }];
const A = PI.analyze({ id: 'p' }, { qty: 5, unit_price: 9 }, INV, { invId: 2 });
ok(A.suppliers.length === 1 && A.suppliers[0].n === 2 && A.alerts.every(a => a.k !== 'cheaper'), 'مقارنة الموردين: مورّد واحد (مرّتين) — بلا تنبيه «مورّد تاني أرخص» غلط');
const R = PR.build(INV, { now: '2026-11-25T00:00:00Z' });
ok(R.suppliers.length === 1 && R.suppliers[0].n === 2 && R.kpi.suppliers === 1, 'التقارير: مورّد واحد بفاتورتين');
console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
