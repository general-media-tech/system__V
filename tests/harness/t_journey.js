// VER-4#REQ-0475 — «رحلة المشروع في مركز المعرفة ناقصة (خطير): يجب تسجيل كل ما عُمل في كل جلسة بما فيه الماضي — مقدّسة كالدستور».
// center.html ⇐ تبويب «رحلة المشروع»: يُقرأ حيّاً من ملفّات المشروع — لا شيء يُقصّ:
// ١) كل أسطر سجلّ العمل (§١٤ في docs/التسليم_الشامل.md) بعددها · ٢) كل مهمّة في TASK_REGISTRY.md · ٣) كل تحديث في «شو الجديد» ·
// ٤) البحث يرشّح · ٥) حرف الجلسة A/B · ٦) لا تمرير أفقيّ ولا أخطاء JS.
const fs = require('fs'), path = require('path');
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const ROOT = path.join(__dirname, '..', '..');
const md = fs.readFileSync(path.join(ROOT, 'docs', 'التسليم_الشامل.md'), 'utf8');
const logN = md.slice(md.search(/^## ١٤\)/m)).split('\n').filter(l => /^\|\s*\d{4}-\d{2}-\d{2}\s*\|/.test(l)).length;
const reg = fs.readFileSync(path.join(ROOT, 'TASK_REGISTRY.md'), 'utf8');
const heads = (reg.match(/^### (TASK-[A-Z]?\d+[a-z]?)/gm) || []).map(x => x.slice(4));   // كل قسم ### (والتحديث المكرّر لمهمّة قسمٌ مستقلّ لا يُدمج)
const ids = new Set(heads), tableOnly = new Set();
(reg.match(/^\|\s*(?:~~)?TASK-[A-Z]?\d+/gm) || []).forEach(x => { x = x.replace(/[|\s~]/g, ''); if (!ids.has(x)) tableOnly.add(x); });
const taskN = heads.length + tableOnly.size;
(async () => {
  for (const [w, mob] of [[390, true], [1366, false]]) {
    console.log('— ' + w);
    await H.seed();
    const { browser, pg, errs } = await H.open('center.html', { w, h: 900, mobile: mob, wait: 3000 });
    await pg.click('.tab[data-t="journey"]');
    await pg.waitForFunction(() => /سطر عمل/.test(document.getElementById('jr-sum').innerText), null, { timeout: 10000 });
    const rows = () => pg.$$eval('#jr-out [data-jr-row]', l => l.length);
    let n = await rows();
    ok(n === logN && logN > 100, 'كل أسطر سجلّ العمل معروضة بلا قصّ: ' + n + ' / ' + logN);
    const first = await pg.$eval('#jr-out .jr-day', e => e.innerText);
    const allDays = md.match(/^\|\s*(\d{4}-\d{2}-\d{2})\s*\|/gm).map(x => x.replace(/[|\s]/g, '')).sort();
    ok(first === allDays[allDays.length - 1], 'الأحدث أوّلاً: ' + first);
    const tags = await pg.$$eval('#jr-out .jr-tag', l => [...new Set(l.map(e => e.innerText))]);
    ok(tags.includes('الجلسة A') && tags.includes('الجلسة B'), 'حرف الجلسة A/B: ' + JSON.stringify(tags.slice(0, 5)));
    await pg.click('[data-j="tasks"]'); n = await rows();
    ok(n === taskN && n > 300, 'كل المهامّ منذ البداية (كل قسم ### + ما في الجداول وحدها): ' + n + ' / ' + taskN);
    const t1 = await pg.$eval('#jr-out [data-jr-row]', e => e.innerText);
    ok(/^TASK-0001/.test(t1), 'تبدأ من TASK-0001: ' + t1.slice(0, 60));
    await pg.click('[data-j="news"]'); n = await rows();
    const newsN = await pg.evaluate(() => (window.GMTWhatsNew && GMTWhatsNew.news || []).length);
    ok(n === newsN && n > 100, 'كل ما نُشر في «شو الجديد»: ' + n + ' / ' + newsN);
    await pg.click('[data-j="tasks"]'); await pg.fill('#jr-q', 'TASK-0040'); n = await rows();
    ok(n >= 1 && n < 5, 'البحث يرشّح (TASK-0040): ' + n);
    const hs = await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
    ok(!hs, 'لا تمرير أفقيّ');
    if (w === 390) { await pg.fill('#jr-q', ''); await pg.click('[data-j="log"]'); await pg.screenshot({ path: __dirname + '/journey_390.png' }); }
    const bad = errs.filter(e => !/Failed to load|favicon|404|ERR_|qrserver|vibrate/.test(e));
    ok(bad.length === 0, 'لا أخطاء JS: ' + JSON.stringify(bad.slice(0, 3)));
    await browser.close();
  }
  console.log(fails ? `FAIL=${fails} (pass ${pass})` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
