// OWN-05#13 — «التقارير تُشارك مع العقل؛ العقل يعرف الأخطاء وطريقة إصلاحها ويصنّفها حسب الخطورة (خطير مقابل كماليات)».
// ١) نتائج الفاحص الذاتي والشامل (الفاشل والتحذير فقط، مع «الإصلاح») تُرفق في context.errors مع سؤال العقل ·
// ٢) البرومبت يطلب التصنيف 🔴/🟠/⚪ وفصل الخطير عن الكماليات وعدم اختراع الإصلاح · ٣) لا تقارير ⇒ لا حقل · ٤) الناجح لا يُرسل.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const { browser, ctx, pg, errs } = await H.open('home.html', { init: H.ADMIN_INIT, w: 390, h: 800, wait: 3500 });
  const bodies = [];
  await ctx.route('**/functions/v1/gmt-brain**', r => { bodies.push(JSON.parse(r.request().postData() || '{}')); r.fulfill({ status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ answer: 'تمام' }) }); });
  const c0 = await pg.evaluate(() => { window.GMTSelfTest = undefined; window.GMTAutoTest = undefined; return GMTBrain._context(); });
  ok(!('errors' in c0) || !c0.errors.some(e => /^\[الفاحص|^\[تقرير/.test(e)), 'لا تقارير ⇒ لا بنود تقارير');
  await pg.evaluate(() => {
    window.GMTSelfTest = { results: () => [{ status: 'ok', title: 'الاتصال سليم' }, { status: 'fail', area: 'المخزون', title: 'رصيد سالب في حلب', detail: '3 منتجات', todo: 'جرد يدوي من صفحة الجرد' }] };
    window.GMTAutoTest = { run: async () => {}, results: () => [{ status: 'warn', title: 'زرّ بلا تسمية', detail: 'أيقونة فقط' }, { status: 'ok', title: 'الطباعة' }] };
  });
  const c1 = await pg.evaluate(() => GMTBrain._context());
  const rp = (c1.errors || []).filter(e => /^\[الفاحص|^\[تقرير/.test(e));
  ok(rp.length === 2 && /\[الفاحص الذاتي\] فشل: رصيد سالب في حلب — 3 منتجات · الإصلاح: جرد يدوي/.test(rp[0]) && /\[الفاحص الشامل\] تحذير: زرّ بلا تسمية/.test(rp[1]),
    'الفاشل والتحذير فقط مع التفصيل والإصلاح: ' + JSON.stringify(rp));
  // سؤالٌ فعليّ للعقل ⇒ التقارير في الطلب والبرومبت يطلب التصنيف
  await pg.evaluate(() => GMTBrain.open());
  await pg.waitForSelector('#gmt-brain-panel');
  await pg.fill('#gb-in', 'شو أخطر المشاكل بالتقارير وكيف بصلحها بالتفصيل؟');
  await pg.click('#gb-send');
  await pg.waitForFunction(() => /تمام/.test(document.getElementById('gb-log').innerText), null, { timeout: 8000 }).catch(() => {});
  const q = bodies.filter(b => b.question).slice(-1)[0] || {};
  ok(q.context && Array.isArray(q.context.errors) && q.context.errors.filter(e => /^\[الفاحص/.test(e)).length === 2, 'الطلب إلى الوسيط يحمل بنود التقارير في context.errors (حقلٌ يرتّبه الوسيط أوّلاً فلا يُقصّ)');
  ok(/الفاحص الشامل/.test(q.system || '') && /الكماليات/.test(q.system || '') && /لا تخترعه/.test(q.system || ''), 'البرومبت: صنّف 🔴/🟠/⚪ وافصل الخطير عن الكماليات ولا تخترع الإصلاح');
  const bad = errs.filter(e => !/Failed to load|favicon|404|ERR_|qrserver|vibrate/.test(e));
  ok(bad.length === 0, 'لا أخطاء JS: ' + JSON.stringify(bad.slice(0, 3)));
  await browser.close();
  console.log(fails ? `FAIL=${fails} (pass ${pass})` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
