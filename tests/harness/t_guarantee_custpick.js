// (PLAN-B 3.3 · المالك seq 996) «اقتراح أسماء الزبائن في كلّ مكان يُكتب فيه اسم زبون — ناقص في الكفالة»
// صيد النمط: كلّ حقل «اسم العميل/الزبون» بصفحات الموظفين لازم يقترح من السجلّ (data-cust-pick أو اقتراح الصفحة الخاصّ)
const fs = require('fs'), path = require('path');
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
/* (١) فحص ثابت للعائلة: حقل اسم زبون بلا اقتراح ⇒ فشل — الحقول اللي إلها اقتراحها الخاصّ مكتوبة هون */
const ROOT = path.join(__dirname, '..', '..');
const OWN = { 'pos.html': ['custName'], 'orders.html': ['in-name'] };
const SKIP = /^(store|track_order|site|index|معاينة_.*)\.html$/;
const miss = [];
fs.readdirSync(ROOT).filter(f => f.endsWith('.html') && !SKIP.test(f)).forEach(f => {
  const s = fs.readFileSync(path.join(ROOT, f), 'utf8'); const re = /<input\b[^>]*>/g; let m;
  while ((m = re.exec(s))) {
    const t = m[0]; if (/type="(radio|checkbox|date|hidden|number|tel|search)"/.test(t) || /بحث|ابحث|search|filter/i.test(t) || /data-cust-pick/.test(t)) continue;
    const ctx = s.slice(Math.max(0, m.index - 200), m.index);
    if (!(/(اسم العميل|اسم الزبون)/.test(ctx.slice(-120)) || /placeholder="[^"]*(اسم العميل|اسم الزبون)/.test(t))) continue;
    const id = (t.match(/id="([^"]+)"/) || [])[1] || '?';
    if (/phone/i.test(id) || (OWN[f] || []).includes(id)) continue;
    miss.push(f + '#' + id);
  }
});
ok(!miss.length, '(١) كلّ حقل اسم زبون بصفحات الموظفين بيقترح من السجلّ' + (miss.length ? ' — ناقص: ' + miss.join(' · ') : ''));
(async () => {
  await H.seed();
  await H.call('/rest/v1/gmt_customers', [
    { name: 'سمير الكفالة', phone: '0933777888', address: 'حلب' },
    { name: 'سمير محظور', phone: '0933000111', is_blocked: true }]);
  const { browser, pg, errs } = await H.open('home.html', { init: H.ADMIN_INIT, w: 390, h: 844, wait: 2500 });
  await pg.goto(pg.url().replace(/home\.html.*$/, 'guarantee.html')); await sleep(4500);
  await pg.evaluate(() => { const el = document.getElementById('customerName'); el.scrollIntoView(); el.focus(); });
  await pg.keyboard.type('سمير'); await sleep(1400);
  const sug = await pg.evaluate(() => { const b = document.querySelector('[data-custpick-box]'); return b && b.style.display !== 'none' ? [...b.querySelectorAll('[data-i]')].map(x => x.textContent.replace(/\s+/g, ' ').trim()) : []; });
  ok(sug.length === 1 && /سمير الكفالة/.test(sug[0]), '(٢) الكفالة: «سمير» بيقترح من سجلّ الزبائن (بلا المحظور): ' + JSON.stringify(sug));
  await pg.evaluate(() => { const b = document.querySelector('[data-custpick-box] [data-i]'); b && b.click(); });
  const v = await pg.evaluate(() => [document.getElementById('customerName').value, document.getElementById('phoneNo').value]);
  ok(v[0] === 'سمير الكفالة' && v[1] === '0933777888', '(٣) الاختيار بيعبّي الاسم والهاتف سوا: ' + JSON.stringify(v));
  ok(!errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).length, 'لا أخطاء JS: ' + JSON.stringify(errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
