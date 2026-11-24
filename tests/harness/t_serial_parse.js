// (TASK-B0537 · seq B1038 «حلّل · استخرج · IMEI ضمن نصّ أطول · Serial مسبوقاً بكلمات · لا تعتمد على الطول وحده · لا تخمّن») المحلّل المحلّي
const S = require('../../gmt-serial.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const IMEI = '490154203237518';   // IMEI صالح (Luhn) — مثال قياسي
ok(S.luhn(IMEI) && !S.luhn('490154203237519'), 'Luhn: الصالح ✓ والمعدَّل رقماً ✗');
let r = S.parse(IMEI); ok(r.clear && r.candidates[0].kind === 'imei', 'رقم ١٥ يحقّق Luhn ⇒ IMEI واضح');
r = S.parse('IMEI: 49-015420-323751-8'); ok(r.clear && r.candidates[0].code === IMEI, 'IMEI بفواصل وشرطات ومسبوق بـ«IMEI:» ⇒ يُستخرج نظيفاً');
r = S.parse('Model: SM-A546E IMEI1 490154203237518 IMEI2 353456789012345'); ok(r.candidates.length === 2 && !r.clear, 'قراءة فيها رقمان ⇒ تُعرض للاختيار (لا اعتماد تلقائي): ' + r.candidates.map(c => c.code + ':' + c.sure).join(' '));
r = S.parse('S/N: 0123ABCD4567'); ok(r.clear && r.candidates[0].kind === 'serial' && r.candidates[0].code === '0123ABCD4567', 'S/N موسوم ⇒ رقم تسلسلي');
r = S.parse('الرقم التسلسلي: 1F2E3D4C'); ok(r.clear && r.candidates[0].code === '1F2E3D4C', 'وسم عربي «الرقم التسلسلي»');
r = S.parse('(01)06941565958025(21)5YSZK1T0012345'); ok(r.clear && r.candidates[0].code === '5YSZK1T0012345', 'GS1: المعرّف (21) رقم تسلسلي (DJI)');
r = S.parse('6941565958025'); ok(!r.clear && r.candidates.length === 1 && !r.candidates[0].sure, 'رقمٌ صرف ١٣ خانة (باركود صنف) ⇒ غير واضح — لا يُحفظ تلقائياً');
r = S.parse('490154203237519'); ok(!r.clear, '١٥ رقماً لا تحقّق Luhn ⇒ لا يُسمّى IMEI ولا يُعتمد (لا اعتماد على الطول وحده)');
r = S.parse('٤٩٠١٥٤٢٠٣٢٣٧٥١٨'); ok(r.clear && r.candidates[0].code === IMEI, 'أرقام عربية ⇒ تُقرأ');
r = S.parse('053021012345'); ok(!r.clear, 'رقم كاميرا صرف بلا وسم ⇒ للاختيار (قد يكون باركوداً)');
r = S.parse('ABC'); ok(!r.candidates.length, 'نصّ قصير ⇒ لا شيء');
ok(S.need({ serial_req: 'imei' }) === 'imei' && S.need({}) === '' && S.need({ serial_req: 'x' }) === '', 'متطلّب المنتج من إعداده وحده');
ok(S.fits({ kind: 'imei' }, 'imei') && !S.fits({ kind: 'serial' }, 'imei') && S.fits({ kind: 'serial' }, 'both'), 'الرقم يناسب متطلّب المنتج');
console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
