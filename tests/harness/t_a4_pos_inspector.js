// (وكيل ٤) VER-3#REQ-0352 (hs-cart ميّت) · VER-4#REQ-0465 (أعمدة invoices في الفاحص العميق) — فحصٌ ساكن للمصدر
const fs = require('fs'); const path = require('path');
const R = f => fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fails++; };
const pos = R('pos.html'), insp = R('gmt-deep-inspector.js');
ok(!/getElementById\('hs-cart'\)/.test(pos), 'pos.html: لا قراءة لعنصر hs-cart غير الموجود');
ok(/fabBadge/.test(pos), 'pos.html: العدّاد الفعلي fabBadge باقٍ');
const invPosts = insp.match(/api\('POST', 'invoices', \{[^}]*\}/g) || [];
ok(invPosts.length >= 4, 'الفاحص: ' + invPosts.length + ' إدراجات فواتير');
ok(invPosts.every(x => !/\bdiscount:|\bpaid:|payment_method|user_name/.test(x)), 'الفاحص: لا أعمدة غير موجودة في invoices');
ok(/discount_amount: 0/.test(insp), 'الفاحص: discount_amount');
console.log(fails ? 'FAIL' : 'PASS'); process.exit(fails ? 1 : 0);
