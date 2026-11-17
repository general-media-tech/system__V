// (OWN-05#11 · REQ-0314 · REQ-0363) الفحص الشامل بزرّ واحد: فحص صحة القاعدة ضمن البوتات،
// والتقرير يُسلَّم لعقل النظام (محفوظ للجهاز ولـgmt_settings · ملخّص العقل أعلى التقرير · العقل يقرؤه في سياقه)
const H = require('./h.js');
let bad = 0; const ok = (c, m) => { console.log((c ? '✅ ' : '❌ ') + m); if (!c) bad++; };
(async () => {
  await H.seed();
  const { browser, pg, errs } = await H.open('checks.html', { w: 1200, h: 900, wait: 3500 });
  ok(await pg.evaluate(() => BOTS.some(b => b.id === 'dbhealth') && !!BOTS.find(b => b.id === 'dbhealth').get()), 'بوت «فحص صحة القاعدة» ضمن الزرّ الواحد ومحمّل');
  const r = await pg.evaluate(async () => { const b = BOTS.find(b => b.id === 'dbhealth'); return normalizeResult(await b.get().run()); });
  ok(r.length >= 10 && r.every(x => x.status && x.title), 'نتائجه بالشكل الموحّد (' + r.length + ' فحصاً)');

  // العقل مفعّل (وهمياً) ⇒ ملخّص أعلى التقرير
  await pg.evaluate(() => { GMTBrain.isReady = () => true; GMTBrain.ask = async (q) => { window.__q = q; return 'أخطر مشكلة: فاتورة بلا بنود — السبب انقطاع الحفظ.'; }; });
  await pg.evaluate(async () => { fullReport = ['═══ تقرير', 'x', 'y', 'z', '\n═══', '🗄️ فحص صحة القاعدة — بوت 1/1', '🔴 فواتير بلا بنود (2): #H-2', '     لماذا: انقطع الحفظ', '✅ مخزون سالب']; await handToBrain(1, 0, 1); });
  const st = await pg.evaluate(() => ({ txt: document.getElementById('brain-txt').textContent, q: window.__q || '', saved: JSON.parse(localStorage.getItem('gmt_last_check_report') || 'null'), rep: fullReport.join('\n') }));
  ok(/أخطر مشكلة/.test(st.txt), 'ملخّص العقل يظهر أعلى التقرير');
  ok(/فواتير بلا بنود/.test(st.q) && !/مخزون سالب/.test(st.q), 'العقل يقرأ المشاكل فقط (لا السليم)');
  ok(st.saved && st.saved.bad === 1 && /فواتير بلا بنود/.test(st.saved.problems), 'التقرير محفوظ على الجهاز');
  ok(/🧠 قراءة العقل/.test(st.rep), 'ملخّص العقل داخل التقرير المنسوخ');
  const row = await H.call('/rest/v1/gmt_settings?key=eq.gmt_last_check_report&select=value', undefined, 'GET');
  ok(row && row[0] && /فواتير بلا بنود/.test(row[0].value), 'التقرير محفوظ في gmt_settings (مشترك بين الأجهزة)');
  const ctx = await pg.evaluate(() => GMTBrain.context().lastCheckReport || '');
  ok(/فواتير بلا بنود/.test(ctx), 'سياق العقل في أي صفحة فيه آخر تقرير');

  // العقل غير مفعّل ⇒ رسالة واضحة + زرّ
  await pg.evaluate(async () => { document.getElementById('brain-sum').remove(); GMTBrain.isReady = () => false; await handToBrain(0, 1, 0); });
  ok(/غير مفعّل/.test(await pg.evaluate(() => document.getElementById('brain-txt').textContent)), 'بلا وسيط: «غير مفعّل» والتقرير محفوظ');
  const real = errs.filter(e => !/vibrate|favicon|ERR_|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS ← ' + real.slice(0, 3).join(' | '));
  await browser.close();
  console.log(bad ? `❌ ${bad} فشل` : '✅ كلّ الفحوص نجحت');
  process.exit(bad ? 1 : 0);
})();
