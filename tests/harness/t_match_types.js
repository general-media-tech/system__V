// (المالك seq 216) «الأداة غبية — تربط هوداً بعدسة · لا تعرف أقسام الإكسسوار والبانيل ليد»: محرّك المطابقة (gmt-match.js) بلا متصفّح
// على أسماءٍ من المتجر والجرد الحقيقيّين: النوع · رمز الموديل الملتصق · الماركة · الجيل.
const fs = require('fs'), vm = require('vm'), R = __dirname + '/../../';
const ctx = { console }; ctx.window = ctx; vm.createContext(ctx);
['gmt-suggest.js', 'gmt-match.js'].forEach(f => vm.runInContext(fs.readFileSync(R + f, 'utf8'), ctx, { filename: f }));
const M = ctx.GMTMatch;
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const T = (n, g) => M.typeOf(n, g);
const P = (a, ga, b, gb, extra) => { const ts = T(a, ga), ti = T(b, gb); return M.pairScore(Object.assign({ name: a }, extra && extra[0]), Object.assign({ name: b }, extra && extra[1]), { ts, ti }); };
// ① النوع
[['Canon EF 70-200mm f/2.8L USM هود', '', 'hood'], ['Canon EF-S 18-135mm USM lens', '', 'lens'], ['M777', 'بانيل ليد', 'panel'], ['لوح اضائة 660 pro مع ريمونت', '', 'panel'],
 ['MCCELرأس اضائة مستمرة 300w مع ريمونت', '', 'head'], ['NP-8850 ترايبود 2.1 متر', '', 'tripod'], ['بطارية كوبي m50', 'بطاريات وشواحن', 'battery'], ['لزقة شاشة 250d', '', 'screen'],
 ['R6II COVER كفر سيليكون', '', 'cover'], ['Canon EOS 250D withaut lins 18-55', '', 'camera'], ['RØDE Interview GO', '', 'mic'], ['N-432PRO LED ليد اضائة يعمل بالبطارية والكهرباء', 'قسم الإضاءة اللوحية /ليد بانيل/', 'panel'],
 ['كوب حراري على شكل عدسة 24_105', '', 'gift'], ['Godox x2 تريغر', '', 'trigger']]
  .forEach(([n, g, t]) => ok(T(n, g) === t, 'النوع: «' + n + '» ⇐ ' + t + ' (وجد: ' + T(n, g) + ')'));
// ② نوعان مختلفان لا يجتمعان أبداً
ok(P('هود EW-73B لعدسة 18-135', '', 'Canon EF-S 18-135mm USM lens', 'عدسات') === null, 'هودٌ وعدسة ⇒ لا مقارنة أصلاً (null)');
ok(P('Canon eos r6 markii', '', 'R6II COVER كفر سيليكون', 'كفرات') === null, 'كاميرا وكفرها ⇒ لا مقارنة');
ok(P('Canon EOS 250D', '', 'لزقة شاشة 250d', '') === null, 'كاميرا ولزقة شاشتها ⇒ لا مقارنة');
// ③ رمز الموديل الملتصق
const hi = (a, ga, b, gb, min, why, ex) => { const r = P(a, ga, b, gb, ex); ok(r && r.score >= min && (!why || r.why.indexOf(why) !== -1), '«' + a + '» ⇐ «' + b + '» ≥ ' + min + (why ? ' (' + why + ')' : '') + ': ' + (r ? r.score.toFixed(2) + ' ' + r.why.join('،') : 'null')); };
const lo = (a, ga, b, gb, max, ex) => { const r = P(a, ga, b, gb, ex); ok(!r || r.score < max, '«' + a + '» ≠ «' + b + '» (< ' + max + '): ' + (r ? r.score.toFixed(2) + ' ' + r.why.join('،') : 'null')); };
hi('L12ترايبود ذكي مع ريمونت واضائة', 'قسم الترايبود الذكي', 'L 12 ترايبود ذكي', 'ستاندات وترايبود', 0.8, 'الموديل نفسه');
hi('Q12S', 'قسم الترايبود الذكي', 'Q12 s ترايبود ذكي', 'ستاندات وترايبود', 0.8, 'الموديل نفسه');
hi('MM4028-RGBW لوح اضائة ضخم مع ريمونت 100w', '', 'MM4028 RGB', 'بانيل ليد', 0.8, 'الموديل نفسه');
hi('لوح اضائة 660 pro مع ريمونت', '', 'Led 660 pro', 'بانيل ليد', 0.6, 'الموديل نفسه');
hi('DJI RONIN RS4MINI', '', 'DJI rs4 mini رونين', 'اوزمو ورونين', 0.8, 'الموديل نفسه');
hi('طراز ET-60IIهود من', '', 'ET-60II lens hood هود', 'هودات', 0.8, 'الموديل نفسه');
hi('Canon LP-E17 battery', '', 'CANON LPE17 orginal بطارية', 'بطاريات وشواحن', 0.8, 'الموديل نفسه');
lo('ET-87 هود عدسة 70_200', '', 'ET-86 lens hood هود', 'هودات', 0.42);
lo('Canon 6dmarkii', '', '6D', 'اوبن بوكس ومستعمل', 0.6);
lo('Dji osmo 7', '', 'DJI OSMO POCKET 3 standart', 'اوزمو ورونين', 0.42);
lo('Godox MoveLink II M2 مايك', '', 'Lark m2', 'مايك وتوابعه', 0.42);
lo('Canon 85 f1.8 عدسة', '', 'Yongo 85 1.8', 'عدسات', 0.42);
// ④ السعر بعيد جداً يخفض
const a1 = P('Canon m50', '', 'M 50 canon eos', 'كاميرات', [{ price: 430 }, { price: 550 }]), a2 = P('Canon m50', '', 'M 50 canon eos', 'كاميرات', [{ price: 430 }, { price: 25 }]);
ok(a1 && a2 && a2.score < a1.score && a2.why.indexOf('السعر بعيد') !== -1, 'السعر ×٣ ⇒ أبعد: ' + (a1 && a1.score.toFixed(2)) + ' > ' + (a2 && a2.score.toFixed(2)));
console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
