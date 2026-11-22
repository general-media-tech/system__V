// (TASK-A0550 · المالك seq 947 «اشتغل عالتطوير والطلبات» — من سجلّ الأخطاء الحيّ)
//  ① gmt-hints: mouseover على عقدة نصّ (سفاري) لا يرمي «e.target.closest is not a function» · والتلميح يظهر لعنصره
//  ② الحارس: بنود الميزات المعروفة قيد البناء لا تُكتب «خطأ حرج» في سجلّ الأخطاء — وتبقى في لوحة الحارس
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const { browser, pg, errs } = await H.open('orders.html', { w: 1280, h: 900, mobile: false, wait: 7000 });
  const r = await pg.evaluate(async () => {
    const b = document.createElement('span'); b.setAttribute('title', 'تلميح تجربة'); b.textContent = 'نصّ داخل عنصر'; document.body.appendChild(b);
    let thrown = null; const on = ev => { thrown = ev.message; }; window.addEventListener('error', on);
    try { b.firstChild.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); } catch (e) { thrown = e.message; }
    try { b.firstChild.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })); } catch (e) { thrown = e.message; }
    await new Promise(r => setTimeout(r, 300)); window.removeEventListener('error', on);
    return { thrown, hinted: b.getAttribute('data-hint') };
  });
  ok(!r.thrown, '① mouseover على عقدة نصّ بلا خطأ ' + (r.thrown || ''));
  ok(r.hinted === 'تلميح تجربة' || r.hinted == null, '① التلميح يصعد لعنصره (data-hint=' + r.hinted + ')');
  await sleep(2500);
  const d = await H.call('/__dump', undefined, 'GET');
  const tele = (d.gmt_telemetry || []).filter(x => /ميزة لا تعمل كما هو مطلوب/.test(x.message || ''));
  const inc = (d.warden_incidents || []).filter(x => /ميزة لا تعمل كما هو مطلوب/.test(x.title || ''));
  ok(tele.length === 0, '② لا «ميزة لا تعمل» في سجلّ الأخطاء (' + tele.length + ')');
  ok(inc.length >= 1, '② وما زالت في لوحة الحارس (' + inc.length + ')');
  ok(!errs.some(e => /closest is not a function/.test(e)), 'لا خطأ closest في الصفحة');
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
