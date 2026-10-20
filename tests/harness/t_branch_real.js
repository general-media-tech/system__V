// (20 ت1 · TASK-0116) نصوص القراءة الحقيقية من إيصالات المالك الخمسة (الصور خارج المستودع — فيها بيانات زبائن)
// السطر كما قرأه التعرّف المحلّي حرفياً ⇒ الفرع الصحيح بثقة · الوجهة لا تُقرأ أبداً · ولا يُعتمد فرعٌ من نصٍّ غير مقروء
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const CASES = [
  ['المصدر: حلب-السريان _. - ال <<< -_الوجهة: دمشق-فكتوريا ا', 'حلب|السريان', 'إيصال ١ (السريان)'],
  ['المصدن: حلب الفرقان ٍّ الوجهة: درعا-دوار ‎١‏ اق نِ 1 م', 'حلب|الفرقان', 'إيصال ٢ (الفرقان · مدوّر) — «المصدن» والوجهة «درعا-دوار» لا تُقرأ'],
  ['المصدر: حلب-السريان _ | اشع لاع الوجهة: دمشق-فكتوريا', 'حلب|السريان', 'إيصال ٤ (السريان)'],
  ['المصدر: درعا-دوار الحمامة الجة: حماة-ساحة العاه', 'درعا|خلف دوار الحمامة', 'إيصال ٥ — «دوار الحمامة» = مكتب «خلف دوار الحمامة» (كانت 0.81 تحت العتبة)'],
  ['المصدر: درعا-دوار الحمامة الوجية: حماة-ساحة العاص تسسا', 'درعا|خلف دوار الحمامة', 'إيصال ٥ (قراءةٌ ثانية) — «الوجية» لا تُقرأ وجهةً']
];
(async () => {
  await H.seed();
  const { browser, pg, errs } = await H.open('orders.html', { init: H.ADMIN_INIT, w: 1366, mobile: false, wait: 3500 });
  for (const [line, want, why] of CASES) {
    const r = await pg.evaluate(l => { const s = GMTReceipt._sourceSegment(l); const m = s ? GMTReceipt._matchBranch(s.seg) : null; return { seg: s && s.seg, key: m && m.key, conf: m && m.confident }; }, line);
    ok(r.conf && r.key === want, why + ' ⇐ ' + r.key + ' (' + r.seg + ')');
  }
  // لا اندماج خاطئ: الاسم بلا كلمته العامّة لا يجعل فرعين مختلفين متطابقين
  const x = await pg.evaluate(() => [GMTReceipt._matchBranch('حلب شارع بارون'), GMTReceipt._matchBranch('دمشق القدم'), GMTReceipt._matchBranch('درعا الحمامة'), GMTReceipt._matchBranch('ـ ٍ اق')]);
  ok(x[0].key === 'حلب|شارع بارون' && x[0].confident, 'حلب شارع بارون ⇐ شارع بارون');
  ok(x[1].key === 'دمشق|القدم' && x[1].confident, 'دمشق القدم ⇐ القدم');
  ok((x[2].key === 'درعا|خلف دوار الحمامة') || (!x[2].key && x[2].candidates[0] === 'درعا|خلف دوار الحمامة'), '«درعا الحمامة» (ليست صيغة الإيصال): لا فرعَ خاطئ — المكتب الصحيح أوّل المرشّحين');
  ok(!x[3].key, 'نصٌّ غير مقروء ⇒ لا فرع');
  // الصورة الممسوحة وغير الممسوحة: غير الممسوحة تُحسَّن قبل القراءة (لا خطأ إن لم يتوفّر الماسح)
  ok(await pg.evaluate(() => typeof GMTDocScan === 'object' && typeof GMTDocScan.process === 'function'), 'طبقة الماسح متاحة للقراءة في صفحة الأوردرات');
  const real = errs.filter(e => !/Failed to load resource/.test(e)); ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
