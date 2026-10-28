// (المالك seq 206) «البحث التلقائي في الأغطية والهودات والبطاريات ما عم يعطيني العدسات المتوافقة — الغطاء قطر 77 ما بيعطيني كل العدسات المتوافقة».
// المرجع الثابت (gmt-compat-kb.js): كل عدسات كانون بقطر الفلتر · الهود بكوده · البطارية/الشاحن/القبضة ⇐ الكاميرات — ومعها عدسات الجرد بقطرها.
// يُقرأ قبل العقل ويعطي **الكل**، ولو كان العقل/الإنترنت متوقّفاً · ولا يُقصّ عند ٢٥ بنداً ولا عند ١٠٠٠ حرف.
const fs = require('fs'), path = require('path'), R = p => fs.readFileSync(path.join(__dirname, '../..', p), 'utf8');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
global.window = global; const LS = {}; global.localStorage = { getItem: k => LS[k] || null, setItem: (k, v) => { LS[k] = String(v); }, removeItem: k => { delete LS[k]; } };
global.allProducts = [
  { id: 9, name: 'عدسة سيغما 24-70 f2.8 DG DN', category: 'عدسات', specs: { 'قطر الفلتر': '82 مم' } },
  { id: 10, name: 'عدسة تامرون 28-75 f2.8 Di III', category: 'عدسات', specs: { 'قطر الفلتر': '67 مم' } },
  { id: 11, name: 'Sigma 18-35mm f/1.8 DC HSM Art lens', category: 'عدسات', specs: { 'Filter size': '72mm' } },
  { id: 12, name: 'غطاء عدسة 72mm', category: 'إكسسوارات', specs: {} }];
eval(R('gmt-compat-kb.js'));
const K = window.GMTCompatKB, L = n => K.refFor(K.keyOf({ id: 1, name: n }));
const c77 = L('غطاء عدسة 77mm كانون');
const must77 = ['RF 24-105mm f/4L IS USM', 'RF 70-200mm f/2.8L IS USM', 'EF 24-105mm f/4L IS USM', 'EF 24-105mm f/4L IS II USM', 'EF 17-40mm f/4L USM', 'EF-S 10-22mm f/3.5-4.5 USM', 'EF 100-400mm f/4.5-5.6L IS II USM', 'RF 50mm f/1.2L USM', 'EF 70-200mm f/2.8L IS III USM'];
ok(c77.length >= 25 && must77.every(m => c77.some(x => x.indexOf(m + ' (77مم)') !== -1)) && c77.every(x => /\(77مم\)$/.test(x)), 'غطاء 77مم ⇒ كل عدسات 77 (' + c77.length + ') ولا عدسة بقطرٍ آخر');
ok(!c77.some(x => /16-35mm f\/2\.8L II|24-70mm f\/2\.8L II USM/.test(x)), 'عدسات 82مم (16-35 II · 24-70 II) ليست في غطاء 77');
const f72 = L('فلتر UV 72mm');
ok(f72.some(x => /Sigma 18-35mm/.test(x)) && f72.some(x => /EF-S 15-85mm/.test(x)), 'فلتر 72مم ⇒ عدسات المرجع + عدسة الجرد (سيغما 18-35 بقطرها في مواصفاتها): ' + f72.length);
ok(!L('غطاء 67mm').some(x => /سيغما 24-70/.test(x)) && L('غطاء 82 مم').some(x => /سيغما 24-70/.test(x)), 'عدسة الجرد بقطرها هي (82) لا غيره');
ok(!f72.some(x => /غطاء عدسة 72mm/.test(x)), 'إكسسوارٌ في الجرد (غطاء 72) لا يُعدّ عدسة');
ok(L('هود ES-68').join() === 'Canon EF 50mm f/1.8 STM (49مم)' && L('هود ES-68 II').length === 0, 'الهود بكوده: ES-68 ⇐ 50 STM · ES-68 II لا (جيلٌ آخر)');
ok(L('هود EW-83M').length === 2 && L('هود EW-73D').length === 2, 'EW-83M ⇐ 24-105 L II و STM · EW-73D ⇐ RF 24-105 STM و EF-S 18-135 USM');
const bat = L('بطارية LP-E6NH');
ok(['EOS 5D Mark IV', 'EOS R5', 'EOS R6 Mark II', 'EOS 90D', 'EOS R7'].every(c => bat.includes('Canon ' + c)) && !bat.includes('Canon EOS R8'), 'بطارية LP-E6NH ⇐ ' + bat.length + ' كاميرا (و R8 لا: LP-E17)');
ok(L('بطارية LP-E17').includes('Canon EOS R8') && L('شاحن LC-E17')[0] === 'بطارية LP-E17' && L('قبضة BG-E14').join() === 'Canon EOS 70D,Canon EOS 80D,Canon EOS 90D', 'LP-E17 · شاحن LC-E17 ⇐ البطارية ثمّ الكاميرات · قبضة BG-E14');
ok(L('كاميرا كانون 2000D').length === 0 && L('فلاش غودوكس TT685').length === 0, 'ما ليس إكسسواراً بقطر/كود لا يأخذ شيئاً');
/* البحث: «غطاء لعدسة 24-105» يجد غطاء 77 ولو لم يُكتب توافقه */
const fit = K.fitsFor({ id: 5, name: 'غطاء عدسة 77mm' });
ok(/RF 24-105mm f\/4L/.test(fit), 'البحث يقرأ المرجع (fitsFor) — غطاء 77 بلا توافقٍ مكتوب');
/* العقل متوقّف (لا وسيط) ⇒ المرجع وحده */
(async () => {
  const src = R('gmt-brain.js');
  ok(/var ref = KB && KB\.refFor && k \? KB\.refFor\(k\) : \[\];/.test(src) && /if \(!url\) return ref\.length \?/.test(src), 'compatProduct: المرجع أوّلاً — وبلا وسيط العقل يعيد المرجع وحده');
  ok(/compat: f\.compat\.slice\(0, 6000\)/.test(R('gmt-enrich-queue.js')), 'الحفظ لا يقصّ التوافق عند ١٠٠٠ حرف (كان ≈٢٥ عدسة)');
  ok(c77.join(' · ').length > 1000, 'وطول قائمة غطاء 77 فعلاً > ١٠٠٠ حرف: ' + c77.join(' · ').length);
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
