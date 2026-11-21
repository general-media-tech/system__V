// (TASK-A0544 · المالك seq 929 «خلّيها مراقَبة وتسجّل وتفحص») — التقرير الأسبوعي: الأخطاء مجمّعة بحالتها + فحص الإصلاحات
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const now = Date.now(), iso = ms => new Date(ms).toISOString();
  await H.call('/rest/v1/gmt_telemetry', [
    { kind: 'error', severity: 'crit', page: 'الأوردرات', err_type: 'JS', message: 'Uncaught ReferenceError: rcptBatchOpen is not defined', detail: 'x', session_id: 'S1', count: 1, created_at: '2026-11-21T22:25:00Z' },   // قبل الإصلاح
    { kind: 'error', severity: 'crit', page: 'المتجر', err_type: 'HTTP 400', message: 'دالة/عمود غير موجود بالقاعدة (42703)', detail: 'column gmt_comments.text does not exist', session_id: 'S2', count: 1, created_at: '2026-11-21T23:45:00Z' },   // بعد الإصلاح ⇒ عاد
    { kind: 'error', severity: 'crit', page: 'الجرد', err_type: 'JS', message: 'TypeError: x is undefined at 1234', detail: '', session_id: 'S3', count: 2, created_at: iso(now - 2 * 3600e3) },   // جديد
    { kind: 'error', severity: 'crit', page: 'الجرد', err_type: 'JS', message: 'TypeError: x is undefined at 5678', detail: '', session_id: 'S4', count: 1, created_at: iso(now - 3 * 3600e3) },   // النوع نفسه (رقم مختلف)
    { kind: 'error', severity: 'warn', page: 'الرئيسية', err_type: 'بطء', message: 'الطلب استغرق 9.1 ثانية', detail: '', session_id: 'S5', count: 1, created_at: iso(now - 4 * 864e5) }]);   // مفتوح قديم
  const { browser, pg, errs } = await H.open('weekly_report.html', { w: 390, h: 844, wait: 4500 });
  await pg.evaluate(() => loadReport()); await pg.waitForSelector('[data-grouped]', { timeout: 15000, state: 'attached' });
  const r = await pg.evaluate(() => ({ rows: [...document.querySelectorAll('[data-grouped] tr[data-state]')].map(t => t.getAttribute('data-state') + ':' + t.cells[1].textContent + ':' + t.cells[3].textContent + ':' + t.cells[4].textContent),
    fix: [...document.querySelectorAll('[data-fixcheck] tr')].slice(1).map(t => t.cells[0].textContent.split(/TASK/)[0].trim().slice(0, 30) + ' ⇒ ' + t.cells[3].textContent.slice(0, 12)) }));
  ok(r.rows[0] && /^back:المتجر/.test(r.rows[0]), 'أوّلاً: «⚠️ رجع بعد الإصلاح» (تقييمات المتجر عاد بعد إصلاحه): ' + r.rows[0]);
  ok(r.rows.some(x => x === 'new:الجرد:3:2'), 'الخطأ نفسه بأرقامٍ مختلفة = نوعٌ واحد «🆕 جديد» · 3 مرّات · جهازان');
  ok(r.rows.some(x => /^fixed:الأوردرات/.test(x)) && r.rows.some(x => /^open:الرئيسية/.test(x)), 'المُصلَح الذي لم يعد «✅» · القديم «🔴 مفتوح»: ' + JSON.stringify(r.rows));
  ok(r.fix.some(x => /rcptBatchOpen/.test(x) && /لم يعد/.test(x)) && r.fix.some(x => /gmt_comments/.test(x) && /عاد 1/.test(x)), '«🛡️ فحص الإصلاحات»: لكلّ إصلاح «✅ لم يعد» أو «⚠️ عاد n مرّة»: ' + JSON.stringify(r.fix.slice(0, 6)));
  const real = errs.filter(e => !/Failed to load resource|status of (400|401|404)/.test(e)); ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
