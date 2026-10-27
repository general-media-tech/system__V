// (TASK-0218/0229 · المالك seq 146 · 160) «زر الحارس والازرار العائمه ما لازم تطلع في اي مكان … في لها مكان وندخل عليه ونسحب كل شيء تقارير»
// + «انتبه جيدا هذه صفحه كفاله للزبون عم يعرض لها التقارير»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  await H.call('/rest/v1/warranties', [{ short_id: 'W300', customer_name: 'سامي', product_name: 'Canon EOS R50', serial_no: 'SN-1', status: 'active', expiry_date: '2027-10-01', purchase_date: '2026-10-01', warranty_type: 'standard', activation_status: 'activated', created_at: '2026-10-01T10:00:00Z' }]);
  // ① صفحة كفالة الزبون (حتى لو كان الجهاز جهاز أدمن): لا زرّ حارس · لا لوحة بأيّ طريقة · لا أدوات داخلية
  let { browser, pg, errs } = await H.open('guarantee.html?w=W300', { w: 390, h: 844, wait: 6000, init: H.ADMIN_INIT });
  await pg.evaluate(() => { for (let i = 0; i < 5; i++) GMTBug.log('crit', 'خطأ تجريبي ' + i); });
  await sleep(2500);
  await pg.keyboard.down('Control'); await pg.keyboard.down('Shift'); await pg.keyboard.press('B'); await pg.keyboard.up('Shift'); await pg.keyboard.up('Control');
  const logo = await pg.$('img[src*="logo"]');
  if (logo) { const b = await logo.boundingBox(); if (b) { await pg.mouse.move(b.x + 5, b.y + 5); await pg.mouse.down(); await sleep(2200); await pg.mouse.up(); } }
  await sleep(500);
  const c = await pg.evaluate(() => ({ btn: !!document.getElementById('gmt-bug-btn'), panel: !!document.getElementById('gmt-bug-ta'), tools: !!document.getElementById('gmt-tools-btn'), cv: GMT_isCustomerView(),
    fabs: [...document.body.children].filter(e => { const cs = getComputedStyle(e); if (cs.position !== 'fixed' || cs.display === 'none' || e.hasAttribute('data-keep-fab')) return false; const r = e.getBoundingClientRect(); return r.width && r.width < 260 && r.height < 260 && innerHeight - r.bottom < 140 && (e.tagName === 'BUTTON' || e.querySelector('button,svg')); }).map(e => e.id || e.className) }));
  ok(c.cv && !c.btn && !c.panel, 'كفالة الزبون: لا زرّ حارس · Ctrl+Shift+B والضغط المطوّل على الشعار لا يفتحان التقارير: ' + JSON.stringify(c));
  ok(!c.tools && !c.fabs.length, 'كفالة الزبون: لا «أدوات الصفحة» ولا أيّ زرٍّ عائم: ' + JSON.stringify(c.fabs));
  await browser.close();
  // ② صفحة داخلية (الأوردرات): لا زرّ حارس عائم مهما كثرت الأخطاء · زرٌّ عائم يُعيد إظهار نفسه يبقى مخفيّاً
  ({ browser, pg, errs } = await H.open('orders.html', { w: 390, h: 844, wait: 4000, init: H.ADMIN_INIT }));
  await pg.evaluate(() => { for (let i = 0; i < 5; i++) GMTBug.log('crit', 'خطأ داخلي ' + i);
    const b = document.createElement('button'); b.id = 'fab-test'; b.textContent = '★'; b.style.cssText = 'position:fixed;bottom:16px;left:16px;width:50px;height:50px;z-index:99999'; document.body.appendChild(b);
    setTimeout(() => { b.style.display = 'flex'; }, 1500); });
  await sleep(7500);
  const o = await pg.evaluate(() => ({ btn: !!document.getElementById('gmt-bug-btn'), fab: getComputedStyle(document.getElementById('fab-test')).display }));
  ok(!o.btn && o.fab === 'none', 'الأوردرات: لا زرّ حارس عائم · زرٌّ عائم أعاد إظهار نفسه أُخفي من جديد: ' + JSON.stringify(o));
  await pg.keyboard.down('Control'); await pg.keyboard.down('Shift'); await pg.keyboard.press('B'); await pg.keyboard.up('Shift'); await pg.keyboard.up('Control'); await sleep(300);
  ok(await pg.evaluate(() => !!document.getElementById('gmt-bug-ta')), 'صفحة داخلية: Ctrl+Shift+B (للدعم) ما زال يفتح اللوحة');
  await browser.close();
  // ③ المكان الواحد: «التقرير الأسبوعي وتقارير الحارس» يعرض تقرير هذا الجهاز (من كل الصفحات) ونسخه ومسحه
  // (المتصفّح هنا جديد ⇒ نضع على «الجهاز» تقريراً محفوظاً من صفحة الأوردرات، كما يحدث فعلاً: التخزين مشترك بين صفحات الجهاز)
  ({ browser, pg, errs } = await H.open('weekly_report.html', { w: 1100, h: 900, mobile: false, wait: 3000, init: H.ADMIN_INIT + `try{localStorage.setItem('gmt_bugs_v3', JSON.stringify([{ sev: 'crit', type: 'silent', msg: 'خطأ داخلي 0', detail: '', t: '10:00:00', count: 1, page: 'الأوردرات' }]))}catch(e){}` }));
  await pg.evaluate(() => GMTBug.log('crit', 'خطأ من التقرير'));
  await sleep(5500);
  const w = await pg.evaluate(() => ({ sum: document.getElementById('guard-sum').textContent, ta: document.getElementById('guard-ta').value }));
  ok(/ملاحظة/.test(w.sum) && /تقرير الحارس/.test(w.ta) && /خطأ داخلي/.test(w.ta) && /خطأ من التقرير/.test(w.ta), 'التقرير الأسبوعي: تقرير الحارس لهذا الجهاز (من الأوردرات وغيرها): ' + w.sum);
  await pg.evaluate(() => document.getElementById('guard-clear').click()); await sleep(300);
  ok(/لا ملاحظات/.test(await pg.evaluate(() => document.getElementById('guard-sum').textContent)), 'مسح تقرير هذا الجهاز');
  const real = errs.filter(e => !/status of (400|401|404|406)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
