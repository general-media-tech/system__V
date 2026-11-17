// (VER-4#REQ-0439) الاستعادة الكاملة: بعد الاستعادة تُعاد قراءة القاعدة وتُقارن بالنسخة (المتوقّع/الموجود/الناقص) ثم الفاحص الذاتي
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const { browser, pg, errs } = await H.open('backup.html', { w: 1366, h: 900, mobile: false, wait: 3000 });
  const prep = async (rows) => pg.evaluate((rows) => {
    window.__alerts = []; window.alert = (m) => { window.__alerts.push(String(m)); };
    GMTAsk.confirm = async () => true;
    restoreData = { main_test: { gmt_manual_debts: rows } };
  }, rows);
  const rows = Array.from({ length: 250 }, (_, i) => ({ id: 9000 + i, person_name: 'مستعاد ' + i, amount: i }));
  await prep(rows);
  await pg.evaluate(() => doRestore('main', 'main_test', 'gmt_manual_debts'));
  let r = await pg.evaluate(() => ({ a: window.__alerts.join('\n'), rep: lastRestoreReport, log: (document.getElementById('log') || {}).innerText || '' }));
  ok(r.rep && r.rep.checked && r.rep.expected === 250 && r.rep.found === 250 && r.rep.missing === 0, 'استعادة كاملة ⇒ المتوقّع 250 · الموجود 250: ' + JSON.stringify(r.rep));
  ok(/✅/.test(r.a) && /المتوقّع 250 · الموجود فعلاً 250/.test(r.a), 'الرسالة تعرض نتيجة التحقّق من القاعدة');
  ok(/الفاحص بعد الاستعادة/.test(r.log), 'الفاحص الذاتي يُشغَّل بعد الاستعادة: ' + r.log.split('\n').filter(l => /الفاحص/.test(l)).join(' | ').slice(0, 120));

  /* الردّ يقول «نجح» والقاعدة لم تحفظ الدفعة الثانية (إسقاطٌ صامت) ⇒ يظهر النقص */
  let n = 0;
  await pg.route('**/rest/v1/gmt_manual_debts?on_conflict=*', async route => {
    if (route.request().method() === 'POST' && ++n === 2) return route.fulfill({ status: 201, body: '' });
    return route.fallback();
  });
  await H.call('/__reset', {}); await H.seed();
  await prep(rows);
  await pg.evaluate(() => doRestore('main', 'main_test', 'gmt_manual_debts'));
  r = await pg.evaluate(() => ({ a: window.__alerts.join('\n'), rep: lastRestoreReport }));
  ok(r.rep && r.rep.missing === 50 && r.rep.found === 200, 'إسقاطٌ صامت لدفعة ⇒ ناقص 50 يُكشف رغم «نجاح» الإرسال: ' + JSON.stringify(r.rep));
  ok(/⚠️ استعادة غير مكتملة/.test(r.a) && /ناقص 50/.test(r.a), 'لا رسالة نجاح مع نقصٍ في القاعدة');

  /* جدول بلا مفتاح مميّز ⇒ يُصرَّح بتعذّر المطابقة */
  await prep([{ note: 'بلا مفتاح' }]);
  await pg.evaluate(() => doRestore('main', 'main_test', 'gmt_manual_debts'));
  r = await pg.evaluate(() => window.__alerts.join('\n'));
  ok(/تعذّرت المطابقة/.test(r), 'بلا مفتاح ⇒ تصريحٌ بتعذّر المطابقة لا صمت');
  const real = errs.filter(e => !/status of (400|401|404|406|409)|Failed to load resource|favicon|vibrate/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
