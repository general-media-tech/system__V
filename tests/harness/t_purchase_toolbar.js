// (TASK-0333 · المالك seq 562/563) «هذا الشريط العلوي على اللاب توب يخفي الأدوات» · «انظر إلى نشرة الأسعار أو القائمة المنسدلة بشكل عام»
// ① نافذة الفاتورة تبدأ تحت أشرطة النظام العلوية: شريط أدوات الفاتورة ظاهر وقابل للنقر (لا يغطّيه شريط التحديث)
// ② كلّ قائمة منسدلة في شريط الفاتورة تبقى داخل الشاشة كاملةً (هاتف ولابتوب)
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  for (const [W, Hh] of [[1366, 768], [412, 860]]) {
    await H.seed();
    const { browser, pg, errs } = await H.open('purchase.html', { w: W, h: Hh, mobile: W < 700, wait: 5000 });
    const a = await pg.evaluate(() => {
      document.getElementById('invModal').classList.add('inv-open');
      const tb = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--gmt-topbars')) || 0;
      const bar = document.querySelector('#invModal > .sticky'); const b = bar.getBoundingClientRect();
      const hit = document.elementFromPoint(b.left + b.width / 2, b.top + 6);
      return { tb, top: Math.round(b.top), visible: !!hit && bar.contains(hit) };
    });
    ok(a.visible && a.top >= a.tb, W + ': شريط أدوات الفاتورة ظاهر تحت شريط النظام ' + JSON.stringify(a));
    const ds = await pg.$$('#invModal details');
    let bad = [];
    for (let i = 0; i < ds.length; i++) {
      const r = await pg.evaluate(i => {
        const d = document.querySelectorAll('#invModal details')[i]; d.scrollIntoView({ block: 'nearest' });
        document.querySelectorAll('#invModal details[open]').forEach(x => x.open = false);
        d.open = true; return new Promise(z => setTimeout(() => { const p = d.querySelector(':scope > div').getBoundingClientRect();
          z({ name: d.querySelector('summary').textContent.trim(), l: Math.round(p.left), r: Math.round(p.right), vw: document.documentElement.clientWidth }); }, 250)); }, i);
      if (r.l < 0 || r.r > r.vw) bad.push(r);
    }
    ok(ds.length >= 2 && !bad.length, W + ': ' + ds.length + ' قوائم منسدلة كلّها داخل الشاشة ' + JSON.stringify(bad));
    const real = errs.filter(e => !/status of (400|401|404|406)|Failed to load resource|favicon/.test(e));
    ok(!real.length, W + ': لا أخطاء JS ' + real.slice(0, 2).join(' / '));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})();
