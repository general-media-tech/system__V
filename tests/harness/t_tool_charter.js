// seq B1117 — «كلّ أداة بنعملها بنرجع نحسّنها بنفس النمط … حطّه كدستور» ⇒ الملحق «ح» بالدستور + هالفحص الآلي
// (١) كلّ نافذة كاملة الشاشة بأيّ وحدة gmt-*.js لازم تحمل data-gmt-modal (زرّ رجوع الهاتف بيسكّرها) — أو تكون بقائمة
//     الإعفاء (بسبب مكتوب) أو بقائمة «الدَّين القديم» اللي لازم بس تنقص. وحدة جديدة بنافذة بلا الوسم ⇒ الاختبار بيفشل.
// (٢) gmt-core بيحمّل gmt-back بكلّ صفحة · (٣) حيّ: صفحة ما فيها gmt-back صراحةً ⇐ نافذة ⇐ رجوع ⇐ انسكّرت وضلّينا بالصفحة.
const fs = require('fs'), path = require('path');
const H = require('./h.js');
const ROOT = path.join(__dirname, '..', '..');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
/* مُعفاة — مو نافذة بتنسكّر بالرجوع (قفل · شاشة بداية · توقيع · تنبيه عابر · طبقة تعليم) */
const EXEMPT = {
  'gmt-account.js': 'شاشة قفل الحساب — الرجوع ما لازم يتخطّاها',
  'gmt-screen.js': 'قفل الشاشة', 'gmt-warmup.js': 'شاشة تحميل', 'gmt-intro.js': 'جولة تعريف', 'gmt-hints.js': 'تلميح عابر',
  'gmt-signpad.js': 'لوح توقيع — الرجوع ما يمسح التوقيع', 'gmt-refresh.js': 'تنبيه تحديث', 'gmt-push.js': 'طلب إذن إشعارات',
  'gmt-sound.js': 'تفعيل الصوت', 'gmt-nofab.js': 'زرّ عائم', 'gmt-notify.js': 'إشعار عابر', 'gmt-launch.js': 'إطلاق', 'gmt-layers.js': 'إلها تاريخها الخاص',
  'gmt-core.js': 'طبقات عامّة صغيرة (تحميل/تنبيه)', 'gmt-endpoint.js': 'تنبيه اتصال', 'gmt-whatsnew.js': 'بطاقة شو الجديد'
};
/* الدَّين القديم (قبل الدستور) — ممنوع تزيد. كلّ ما وحدة صارت تحمل الوسم انشيلها من هون. */
const LEGACY = ['gmt-ask.js', 'gmt-brain.js', 'gmt-browser.js', 'gmt-camfinder.js', 'gmt-docscan.js', 'gmt-enrich-queue.js', 'gmt-learn.js',
  'gmt-lists.js', 'gmt-phomemo.js', 'gmt-road.js', 'gmt-scan.js', 'gmt-staff.js', 'gmt-sticker.js', 'gmt-studio.js'];
const RX = /position: ?fixed[^'"`]*inset: ?0|inset: ?0[^'"`]*position: ?fixed/;
const files = fs.readdirSync(ROOT).filter(f => /^gmt-.*\.js$/.test(f));
const bad = [], fixedLegacy = [];
files.forEach(f => {
  const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
  if (!RX.test(s) || EXEMPT[f]) return;
  const has = /data-gmt-modal/.test(s);
  if (!has && !LEGACY.includes(f)) bad.push(f);
  if (has && LEGACY.includes(f)) fixedLegacy.push(f);
});
ok(!bad.length, '(١) كلّ نافذة جديدة بتحمل data-gmt-modal' + (bad.length ? ' — ناقصة: ' + bad.join(' · ') : ''));
ok(!fixedLegacy.length, '(١ب) قائمة الدَّين القديم محدّثة' + (fixedLegacy.length ? ' — شيلها من LEGACY: ' + fixedLegacy.join(' · ') : ''));
ok(LEGACY.length <= 14, '(١ج) الدَّين القديم ما زاد (' + LEGACY.length + ' ≤ 14)');
ok(/gmt-back\.js\?v=/.test(fs.readFileSync(path.join(ROOT, 'gmt-core.js'), 'utf8')), '(٢) gmt-core بيحمّل gmt-back بكلّ صفحة');
(async () => {
  await H.seed();
  const { browser, pg, errs } = await H.open('home.html', { init: H.ADMIN_INIT, w: 390, h: 844, wait: 2500 });
  await pg.goto(pg.url().replace(/home\.html.*$/, 'سجل_العمليات.html')); await sleep(4000);
  const url0 = pg.url();
  ok(await pg.evaluate(() => !!window.GMTBack && !document.querySelector('script[src*="gmt-back.js"]:not([src*="?v=20261127b46"])')), '(٣) gmt-back انحمّل تلقائياً بصفحة ما فيها إياه');
  /* نافذة متل أيّ وحدة جديدة: الوسم + زرّ ✕ */
  await pg.evaluate(() => { const w = document.createElement('div'); w.id = 'tc-m'; w.setAttribute('data-gmt-modal', ''); w.style.cssText = 'position:fixed;inset:0'; w.innerHTML = '<button data-gmt-close>✕</button>'; w.querySelector('button').onclick = () => w.remove(); document.body.appendChild(w); });
  await sleep(200);
  await pg.goBack(); await sleep(500);
  ok(pg.url() === url0 && await pg.evaluate(() => !document.getElementById('tc-m')), '(٣ب) رجوع الهاتف ⇐ النافذة انسكّرت وضلّينا بالصفحة');
  /* نافذة بتنسكّر بـEsc بس (متل المعرض/تعديل المنتج) */
  await pg.evaluate(() => { const w = document.createElement('div'); w.id = 'tc-e'; w.setAttribute('data-gmt-modal', ''); const k = e => { if (e.key === 'Escape') { w.remove(); document.removeEventListener('keydown', k, true); window.__escClosed = 1; } }; document.addEventListener('keydown', k, true); document.body.appendChild(w); });
  await sleep(200); await pg.goBack(); await sleep(500);
  ok(pg.url() === url0 && await pg.evaluate(() => !document.getElementById('tc-e') && window.__escClosed === 1), '(٣ج) نافذة بتنسكّر بـEsc ⇐ تنظيفها تبعها اشتغل');
  /* تسكير بـ✕ ⇐ ما بيعلق التاريخ */
  await pg.evaluate(() => { const w = document.createElement('div'); w.id = 'tc-x'; w.setAttribute('data-gmt-modal', ''); document.body.appendChild(w); });
  await sleep(200); await pg.evaluate(() => document.getElementById('tc-x').remove()); await sleep(400);
  ok(pg.url() === url0 && await pg.evaluate(() => GMTBack._stack.length === 0), '(٣د) التسكير بـ✕ ⇐ بلا خطوات معلّقة');
  /* (٤) البند ٤ و١١ تلقائياً (seq B1127 «لمّا بعطيك أداة ما بتساويها فيها كلّشي»): جدول جوّا أيّ نافذة ⇐ 🔎 بحث · 🖨️ طباعة · ⬇️ إكسل */
  ok(await pg.evaluate(() => !!window.GMTListTools), '(٤) gmt-listtools انحمّل تلقائياً');
  await pg.evaluate(() => { const w = document.createElement('div'); w.id = 'tc-t'; w.setAttribute('data-gmt-modal', ''); w.innerHTML = '<h3>كشف تجربة</h3><table><thead><tr><th>الاسم</th><th>المبلغ</th></tr></thead><tbody>' + ['أحمد', 'مدى', 'الرائد', 'سامر', 'إكسسوار', 'ليلى', 'مدى ٢'].map((n, i) => '<tr><td>' + n + '</td><td>' + (i + 1) * 10 + '</td></tr>').join('') + '</tbody></table>'; document.body.appendChild(w); });
  await sleep(500);
  const tb = await pg.evaluate(() => { const b = document.querySelector('#tc-t [data-gmt-tools]'); return b ? { q: !!b.querySelector('[data-glt-q]'), p: !!b.querySelector('[data-glt-print]'), c: !!b.querySelector('[data-glt-csv]') } : null; });
  ok(tb && tb.q && tb.p && tb.c, '(٤ب) شريط تلقائي فوق الجدول: بحث + طباعة + إكسل ' + JSON.stringify(tb));
  await pg.fill('#tc-t [data-glt-q]', 'مدي'); await sleep(200);
  ok(await pg.evaluate(() => [...document.querySelectorAll('#tc-t tbody tr')].filter(r => r.style.display !== 'none').length) === 2, '(٤ج) البحث بيفلتر (مدي = مدى · بلا فرق الهمزة/الياء)');
  const csv = await pg.evaluate(() => GMTListTools.csv(document.querySelector('#tc-t table')));
  ok(/^\uFEFF?الاسم,المبلغ/.test(csv.replace(/^\uFEFF/, '')) && csv.split('\r\n').length === 3, '(٤د) الإكسل بياخد العناوين والصفوف الظاهرة بس');
  ok(/كشف تجربة/.test(await pg.evaluate(() => GMTListTools.printHtml(document.querySelector('#tc-t table')))), '(٤هـ) الطباعة بعنوان النافذة');
  await pg.evaluate(() => { const w = document.createElement('div'); w.id = 'tc-l'; w.setAttribute('data-gmt-modal', ''); w.innerHTML = '<input placeholder="🔎 بحث الأداة"><div data-gmt-list data-gmt-nosearch>' + [1, 2, 3, 4, 5, 6, 7].map(i => '<div>بطاقة ' + i + '</div>').join('') + '</div>'; document.body.appendChild(w); });
  await sleep(500);
  ok(await pg.evaluate(() => { const b = document.querySelector('#tc-l [data-gmt-tools]'); return !!b && !b.querySelector('[data-glt-q]') && !!b.querySelector('[data-glt-csv]'); }), '(٤و) قائمة بطاقات إلها بحثها ⇐ طباعة وإكسل بلا بحث تاني (ممنوع بحثين — B1083)');
  ok(!errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).length, 'لا أخطاء JS: ' + JSON.stringify(errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
