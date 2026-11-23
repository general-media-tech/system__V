// (TASK-A0583 · المالك seq A1022 «تحتمل شو ممكن يوقع بأخطاء وتدرّبه عليها») — محرّك الباكينج بلا متصفّح: أشكال ملفّاتٍ متوقّعة
//  ① ترتيب أعمدة مختلف + عناوين إنجليزية · ② عمود «رقم الكرتونة» بدل الخلايا المدموجة · ③ نسختان متشابهتان (RGB / Pro) لا تتبادلان
//  ④ سطرٌ واحد = عدّة بنود (Propellers ×30 = ثلاثة بنود ×10) · ⑤ لا مطابقة بالكمّية وحدها · ⑥ الذاكرة: الوصف المكرّر في كرتونتين يُملأ بالقطع بالضبط
const P = require('../../gmt-packing.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const items = [
  { id: 'a', name: 'LED-660 RGB', alt_names: 'LED660 PRO RGB EU', qty: 10, unit_price: 50 },
  { id: 'b', name: 'Led 660 pro', alt_names: 'LED 660 Pro Studio Light، Neewer 660 Pro RGB/Bi-color، LED660 Pro studio panel', qty: 10, unit_price: 60 },
  { id: 'c', name: 'مراوح DJI Mini 3', alt_names: 'Mini 3 propellers، DJI Mini 3 propeller set', qty: 10, unit_price: 3 },
  { id: 'd', name: 'مراوح DJI Mini 4 Pro', alt_names: 'Mini 4 Pro propellers', qty: 10, unit_price: 3 },
  { id: 'e', name: 'مراوح DJI Neo', alt_names: 'Neo propellers', qty: 10, unit_price: 3 },
  { id: 'f', name: 'علبة عرض أكريليك', alt_names: 'acrylic display box 10cm', qty: 10, unit_price: 4 },
  { id: 'g', name: 'حقيبة كاميرا وسط', alt_names: 'Camera bag medium', qty: 6, unit_price: 9 },
  { id: 'h', name: 'حقيبة كاميرا كبيرة', alt_names: 'Camera bag large', qty: 5, unit_price: 12 }];
// ① + ② ملفّ بترتيب أعمدة مختلف وعناوين إنجليزية وعمود رقم الكرتونة
const rows = [
  ['HS CODE', 'Qty (pcs)', 'Description', 'G.W (kg)', 'CTN NO', 'Rate'],
  ['9405.40.00', 10, 'LED-660 RGB studio light panel', 9, '1', 1.5],
  ['9405.40.00', 10, 'LED-660 Pro studio light panel kit with bag', 10, '2', 1.5],
  ['8807.30.00', 30, 'Replacement propellers - multiple models', 4, '3', 1],
  ['', 10, '10 cm acrylic display box with LED base', '', '', ''],
  ['4202.29.00', 6, 'Camera bag - multiple models', 7, '4', 1.5],
  ['4202.29.00', 5, 'Camera bag - multiple models', 8, '5', 1.5]];
const p = P.parse(rows, []);
ok(p.ok && p.totals.cartons === 5 && p.cartons[2].lines.length === 2, '①② عناوين إنجليزية بترتيبٍ آخر + «CTN NO» بدل الدمج ⇒ 5 كراتين (الثالثة فيها سطران): ' + (p.ok ? p.totals.cartons : p.error));
const M = P.autoMap(p.lines, items);
const nm = li => M.map[li].map(ii => items[ii].id).sort().join(',');
ok(nm(0) === 'a' && nm(1) === 'b', '③ RGB ⇐ LED-660 RGB · Pro ⇐ Led 660 pro (الأسماء البديلة تخلطهما): ' + nm(0) + ' / ' + nm(1));
ok(nm(2) === 'c,d,e', '④ «Propellers ×30» ⇐ ثلاثة بنود مراوح ×10: ' + nm(2));
ok(nm(3) === 'f', '⑤ «acrylic display box ×10» ⇐ العلبة لا مراوح ×10 (لا مطابقة بالكمّية وحدها): ' + nm(3));
ok(nm(4) === 'g' && nm(5) === 'h', 'حقيبتان بالوصف نفسه ⇐ كلٌّ بكمّيتها: ' + nm(4) + ' / ' + nm(5));
// ⑥ الذاكرة
const mem = P.memoryOf(p.lines, M.map, items, p.cartons);
const M2 = P.autoMap(p.lines, items, { memory: mem, cartons: p.cartons });
ok(JSON.stringify(M2.map) === JSON.stringify(M.map), '⑥ من الذاكرة ⇒ المطابقة نفسها بالضبط (الوصف المكرّر يُملأ بقطعه)');
const A = P.allocate(p, M.map, items, { customs: 50, ship: 76, transport: 10 });
ok(Math.abs(A.check.customs - 50) < 0.02 && Math.abs(A.check.ship - 76) < 0.02, 'المجاميع = المدفوع: ' + JSON.stringify(A.check));
console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
