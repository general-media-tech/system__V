// (TASK-A0509 · المالك seq 753–754) «كمّل طقمك»: كلّ منتج يُربط بما يلزمه هو — «درون نيو عم تروح غراض لغير شي · ميني 3 عم ياخد RC موشن».
// اختبار منطقي بلا متصفّح على gmt-kit.js (والفحص الشامل على المتجر الحيّ: node tools/kit_audit.js).
const path = require('path');
global.window = global; global.GMT_COMPAT_NOLOAD = true;
require(path.join(__dirname, '../../gmt-compat-kb.js')); const Kit = require(path.join(__dirname, '../../gmt-kit.js'));
let pass = 0, fails = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✔', m); } else { fails++; console.log('  ✘', m); } };
const C = { dr: ['الدرونات وملحقاتها', 'درونات'], dbag: ['الدرونات وملحقاتها', 'حقائب'], dprop: ['الدرونات وملحقاتها', 'مراوح وحماية'], dbat: ['الدرونات وملحقاتها', 'بطاريات وشواحن'], doth: ['الدرونات وملحقاتها', 'ملحقات أخرى'],
  cam: ['كاميرات كانون', 'كاميرات'], lens: ['كاميرات كانون', 'عدسات كانون'], cbat: ['إكسسوارات الكاميرا', 'بطاريات وشواحن'], mem: ['إكسسوارات الكاميرا', 'ذواكر ووصلات'], cbag: ['إكسسوارات الكاميرا', 'حقائب'],
  head: ['إضاءة الاستوديو', 'رؤوس الإضاءة — كهرباء'], soft: ['إضاءة الاستوديو', 'سوفت بوكس ومعدّلات'], stand: ['إضاءة الاستوديو', 'ستاندات'], fl: ['إضاءة الاستوديو', 'فلاشات'], keyl: ['الإضاءة حسب الاستخدام', 'إضاءة رئيسية · Key Light'], tube: ['إضاءة صنّاع المحتوى', 'تيوب وعصا'], ring: ['إضاءة صنّاع المحتوى', 'إضاءة دائرية'] };
const P = []; const add = (id, name, cat, o) => { P.push(Object.assign({ id, name, category_id: cat, price: 10, stock: 3, images: ['x'] }, o || {})); };
add('neo', 'DJI Neo — الدرون فقط (بدون ريموت)', 'dr'); add('mini3', 'DJI Mini 3 — كومبو قياسي مع ريموت RC-N1', 'dr'); add('avata', 'DJI Avata — الدرون فقط', 'dr'); add('avata2', 'DJI Avata 2 — Fly More Combo', 'dr');
add('mini4k', 'DJI Mini 4K — كومبو قياسي مع ريموت RC-N1', 'dr'); add('m3pro', 'DJI Mini 3 Pro — كومبو', 'dr'); add('toy', 'درون E99 بكاميرا مزدوجة', 'dr');
add('bagflip', 'حقيبة dji flip مخصصة', 'dbag'); add('bagavata', 'حقيبة صلبة مقاومة للماء DJI Avata', 'dbag'); add('bagall', 'حقيبة dji اصلية لكل فئة  Dji mini-neo-flip', 'dbag');
add('propneo', 'مراوح DJI Neo الأصلية', 'dprop'); add('propneo2', 'مراوح DJI Neo 2 (طقم 4 قطع)', 'dprop'); add('guard3', 'واقي مراوح DJI Mini 3 / DJI Mini 3 Pro', 'dprop'); add('propav2', 'مراوح DJI Avata 2 (طقم 4 قطع)', 'dprop');
add('propav', 'DJI Avata  Propellers طقم مراوح  افاتا', 'dprop'); add('bat24', 'بطاريةDJI Mini: 2_4k-se_2se  Battery BWX161', 'dbat'); add('batneoOOS', 'بطارية درون dji neo', 'dbat', { stock: 0 });
add('rcm', 'Dji rc motion2  موشن', 'doth'); add('rcn1', 'Dji rc_ n1 remont', 'doth'); add('rcs', 'Dji rc ريمونت شاشة', 'doth'); add('pad', 'منصة هبوط درون 50*50', 'doth');
add('r8', 'Canon eos r8 body only', 'cam'); add('e17', 'CANON LP-E17 orginal', 'cbat'); add('e6', 'Canon LP-E6 بطارية أصلية', 'cbat'); add('micro', 'بطاقة ذاكرة Kingdrive MicroSD 16GB', 'mem'); add('sd', 'Memory card 32 G', 'mem'); add('cbag', 'شنتا كانون اساسي', 'cbag');
add('l1855', '18-55 stm', 'lens', { compat: 'Canon EOS 600D · EOS 700D' });
add('s600', 'YM-S600-SS light', 'head', { compat: 'ستاندات الإضاءة (مسمار 5/8 بوصة)' }); add('softb', 'سوفت بوكس عادي 90×70', 'soft', { compat: 'رؤوس الإضاءة المستمرة وفلاشات الاستوديو بحربة Bowens' }); add('st', 'Stand 205 cm ستاند', 'stand');
add('octa90', '90cm Octagonal Softbox with grids', 'soft', { compat: 'رؤوس الإضاءة المستمرة وفلاشات الاستوديو بحربة Bowens' }); add('ball75', 'سوفت بالون 75 cm', 'soft', { compat: 'رؤوس الإضاءة المستمرة وفلاشات الاستوديو بحربة Bowens' }); add('octa30', '30 cm octa softbox mini', 'soft', { compat: 'رؤوس الإضاءة الصغيرة بحربة Bowens' });
add('brk', 'براكيت  للسوفت', 'soft', { compat: 'Godox Bowens Mount' }); add('e27', 'سوفت بوكس 50x70 مع قاعدة لمبة', 'soft', { compat: 'لمبات E27' }); add('snoot', 'قمع اضاءة', 'soft', { compat: 'رؤوس الإضاءة المستمرة وفلاشات الاستوديو بحربة Bowens' });
add('ys60', 'YM-S60 RGBهيد', 'keyl', { compat: 'ترايبود صغير أو ستاند إضاءة (مسمار 1/4 بوصة) · يُمسك باليد' }); add('sl100', 'ZSYB-SL-100B رأس اضاءة', 'head', { compat: 'ستاندات الإضاءة (مسمار 5/8 بوصة)' });
add('zu60', 'Zu 60 هيد', 'head', { compat: 'ستاند إضاءة أو ترايبود · مقبض الطاقة «بور غريب ZU60»' }); add('grip', 'بور غريب zu 60', 'soft', { compat: 'Bowens · 1/4"' }); add('gobo', 'Ym 800', 'head', { compat: 'ستاندات الإضاءة (مسمار 5/8 بوصة) · شرائح الألوان والأشكال المرفقة' });
add('tube', 'عصا إضاءة فيديو LED RGB (RGB LED Video Light Stick)', 'tube'); add('q11', 'عصا سيلفي بإضاءة Q11s', 'ring');
add('x2', 'Godox x2 تريغر', 'fl'); add('v1', 'Godox v1', 'fl'); add('fsoft', 'سوفت بوكس فلاش 25x25سم', 'fl'); add('x5c', 'Godox X5C مُطلِق لفلاش iT32 — كانون', 'fl'); add('it32', 'Godox iT32-C فلاش', 'fl');
const ctx = { products: P, catPath: id => C[id] || ['', ''], KB: global.GMTCompatKB };
const kit = id => Kit.complements(P.find(p => p.id === id), ctx).map(p => p.id);

let k = kit('neo');
ok(k.includes('propneo') && k.includes('bagall'), 'Neo ⇐ مراوح Neo والحقيبة العامّة: ' + k.join(' · '));
ok(!k.includes('bagflip') && !k.includes('bagavata') && !k.includes('propneo2'), 'Neo لا يأخذ حقيبة Flip ولا حقيبة Avata ولا مراوح Neo 2');
ok(k.includes('batneoOOS'), '(seq 762 «الطقم ماله علاقة بالكمية») بطارية Neo تُقترح ولو كانت نافدة');
k = kit('mini3');
ok(k.includes('guard3') && !k.includes('rcm') && !k.includes('rcn1') && !k.includes('rcs'), 'Mini 3 ⇐ واقي مراوحه · بلا RC Motion ولا أيّ ريموت: ' + k.join(' · '));
ok(!k.includes('bat24') && !k.includes('pad'), 'Mini 3 لا يأخذ بطارية Mini 2/4K ولا ملحقاً بلا موديل');
ok(kit('m3pro').includes('guard3'), 'Mini 3 Pro ⇐ الواقي المكتوب عليه «Mini 3 / Mini 3 Pro»');
k = kit('avata'); ok(k.includes('propav') && k.includes('bagavata') && !k.includes('propav2'), 'Avata ⇐ مراوح وحقيبة Avata · لا مراوح Avata 2: ' + k.join(' · '));
k = kit('avata2'); ok(k.includes('propav2') && !k.includes('propav') && !k.includes('bagavata'), 'Avata 2 ⇐ مراوحه هو · لا ملحقات Avata الأولى: ' + k.join(' · '));
k = kit('mini4k'); ok(k.includes('bat24') && k.includes('bagall'), 'Mini 4K ⇐ بطارية «2_4k-se_2se» والحقيبة العامّة: ' + k.join(' · '));
ok(kit('toy').length === 0, 'درون بلا موديل معروف ⇒ لا اقتراح');
k = kit('r8'); ok(k.includes('e17') && !k.includes('e6') && k.includes('sd') && !k.includes('micro') && k.includes('cbag'), 'EOS R8 ⇐ LP-E17 (لا LP-E6) · ذاكرة SD (لا MicroSD) · حقيبة: ' + k.join(' · '));
k = kit('s600'); ok(!k.includes('l1855') && k.includes('softb') && k.includes('st'), 'إضاءة YM-S600 ⇐ سوفت وستاند · لا عدسة «EOS 600D»: ' + k.join(' · '));
ok(kit('fsoft').length === 0 && !kit('x2').includes('st'), 'معدّل الفلاش لا يأخذ شيئاً · التريغر لا يأخذ ستاند');
/* (المالك 17 ت2) «المطلق ايضا يطلع بالاطقم مع … اللي بيشتغلو معه» */
k = kit('x2'); ok(k.includes('v1') && !k.includes('it32'), 'تريغر X2 ⇐ فلاشات Godox التي يعمل معها (V1) · لا iT32 (له X5C): ' + k.join(' · '));
k = kit('x5c'); ok(k.length === 1 && k[0] === 'it32', 'X5C ⇐ فلاش iT32 وحده: ' + k.join(' · '));
/* «هدول الهيدات الهن طقم هو السوفت الصغير · البراكيت كمان مع سوفت كبير · الستاند» */
k = kit('ys60'); ok(['octa30', 'brk', 'st'].every(x => k.includes(x)) && k.some(x => ['octa90', 'softb', 'ball75'].includes(x)) && !k.includes('e27'), 'رأس صغير YM-S60 (في «إضاءة رئيسية») ⇐ سوفت صغير + براكيت + سوفت كبير + ستاند: ' + k.join(' · '));
/* «هدول الهن سوفتات بوكس كل الاشكال الكبار والقياسات · ما في داعي لبراكيت» */
k = kit('sl100'); ok(['octa90', 'softb', 'ball75', 'st'].every(x => k.includes(x)) && !k.includes('brk') && !k.includes('e27') && !k.includes('octa30'), 'رأس Bowens SL-100B ⇐ سوفتات كلّ الأشكال الكبيرة + ستاند · بلا براكيت ولا سوفت لمبات: ' + k.join(' · '));
k = kit('zu60'); ok(k[0] === 'grip' && k.includes('st') && !k.includes('snoot'), 'Zu 60 ⇐ «بور غريب ZU60» أوّلاً + طقم الرأس الصغير + ستاند · لا قمع وحده: ' + k.join(' · '));
k = kit('gobo'); ok(k.includes('st') && !k.some(x => ['octa90', 'softb', 'ball75', 'brk'].includes(x)), 'بروجكتور الأشكال YM 800 ⇐ ستاند فقط (لا سوفت): ' + k.join(' · '));
/* «كل اضائة لازم معها بمقترح الطقم ستاند» */
ok(kit('tube').includes('st'), 'عصا الإضاءة (تيوب) ⇐ ستاند');
ok(!kit('q11').includes('st'), 'عصا السيلفي بإضاءة Q11s فيها حاملها ⇐ بلا ستاند');
k = kit('v1'); ok(k.includes('x2') && k.includes('fsoft') && !k.includes('x5c') && !k.includes('st'), 'فلاش Godox V1 ⇐ تريغر Godox X2 وسوفت الفلاش · لا X5C (لـiT32 وحده) ولا ستاند: ' + k.join(' · '));
ok(kit('it32').includes('x5c'), 'فلاش iT32 ⇐ مُطلِقه X5C');
ok(Kit.fitsCode('Canon EOS 600D', ['s600']) === false && Kit.fitsCode('Canon EOS R8 · RP', ['r8']) === true && Kit.fitsCode('EOS R80', ['r8']) === false, 'مطابقة الكود بالمساواة لا بالاحتواء');
console.log(fails ? 'FAIL ' + fails + ' / ' + (pass + fails) : 'ALL PASS (' + pass + ')');
process.exit(fails ? 1 : 0);
