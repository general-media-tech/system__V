// (TASK-0381 · المالك C1125 «بحثت بالعربي ترايبود وطلعلي هولدر رقبة وحامل سيارة — شو اللي عم يصير؟»)
// ما الكلمة باسمه أوّلاً · المجموعة/التصنيف لا تُدخل منتجاً إلّا إن كان البحث باسم المجموعة كاملاً · «حامل» ≠ ترايبود
global.window = globalThis; global.self = globalThis; require('../../gmt-suggest.js'); const G = globalThis.GMTSuggest;
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const L = [
  { name: 'Neck holder telesin هولدر رقبة', category: 'المثبّتات والترايبود', group_name: 'هولدرات ومساند وملحقات هاتف' },
  { name: 'Sc-02 حامل كاميرا تثبيت على السيارة', category: 'المثبّتات والترايبود', group_name: 'هولدرات ومساند وملحقات هاتف' },
  { name: 'ميني ترايبود قابل للطي — قياس صغير', category: 'المثبّتات والترايبود', group_name: 'هولدرات ومساند وملحقات هاتف' },
  { name: 'Canon R50', category: 'الكاميرات', group_name: 'كاميرات' },
  { name: 'Manfrotto Tripod 190', category: 'المثبّتات والترايبود', group_name: 'ترايبودات' }];
const n = q => G.filterProducts(q, L).map(p => p.name);
const t = n('ترايبود');
ok(t.length === 2 && t.every(x => /ترايبود|Tripod/.test(x)), '«ترايبود» ⇐ الترايبودات وحدها (لا هولدر رقبة ولا حامل سيارة): ' + t.join(' | '));
ok(n('كاميرات').includes('Canon R50'), '«كاميرات» (اسم المجموعة كاملاً) ⇐ الكاميرات باقية');
ok(n('حامل').length === 2 && !n('حامل').some(x => /ترايبود|Tripod/.test(x)), '«حامل» ⇐ الحوامل لا الترايبودات');
ok(n('tripod').length === 2, '«tripod» بالإنكليزي = «ترايبود»');
ok(G.filterProducts('مجموعة لا وجود لها', L).length === 0 && G.filterProducts('', L).length === 5, 'لا شيء ⇐ فارغ · بلا بحث ⇐ الكلّ');
console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
