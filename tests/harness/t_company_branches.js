// (TASK-0203 · المالك seq 133) «إجمالي غير محصّل — بحسب شركة الشحن»: النقر على الشركة ⇒ أفرع حوالاتها بمبلغ كلٍّ وعدد أوردراته
// (مفتي الفرقان · مفتي السريان …) · النقر على فرع ⇒ فلتر «فروع الحوالات» عليه
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  for (const W of [390, 1366]) {
    await H.seed();
    const base = { product: 'كاميرا', qty: 1, branch: 'حلب', address: 'دمشق', phone: '0933000000' };
    await H.call('/rest/v1/gmt_orders', [
      Object.assign({}, base, { name: 'أ', price: 100, status: 'shipped', shipping_company: 'المفتي', ship_from_office: 'حلب|الفرقان' }),
      Object.assign({}, base, { name: 'ب', price: 50, status: 'delivered', shipping_company: 'المفتي', ship_from_office: 'حلب|الفرقان' }),
      Object.assign({}, base, { name: 'ج', price: 70, status: 'delivered', shipping_company: 'المفتي', ship_from_office: 'حلب|السريان' }),
      Object.assign({}, base, { name: 'د', price: 30, collect_amount: 0, status: 'shipped', shipping_company: 'المفتي', ship_from_office: 'حلب|السريان' }),
      Object.assign({}, base, { name: 'هـ', price: 40, status: 'shipped', shipping_company: 'القدموس', ship_from_office: 'حلب|الجميلية' }),
      Object.assign({}, base, { name: 'و', price: 999, status: 'completed', shipping_company: 'المفتي', ship_from_office: 'حلب|الفرقان' })
    ]);
    const { browser, pg, errs } = await H.open('orders.html', { w: W, h: W < 500 ? 844 : 900, mobile: W < 500, wait: 4500, init: H.ADMIN_INIT });
    const cards = await pg.evaluate(() => [...document.querySelectorAll('#company-totals [data-co]')].map(b => b.innerText.replace(/\s+/g, ' ').trim()));
    ok(cards.length === 2 && cards.some(t => /المفتي/.test(t) && /\$220/.test(t) && /أفرع الحوالات \(2\)/.test(t)) && cards.some(t => /القدموس/.test(t) && /\$40/.test(t)), W + ': بطاقات الشركات أزرارٌ بمجموعها وعدد أفرعها: ' + JSON.stringify(cards));
    await pg.evaluate(() => { const d = document.getElementById('stats-detail'); if (d && d.classList.contains('hidden')) toggleStats(); }); await pg.waitForTimeout(300);
    await pg.click('#company-totals [data-co="المفتي"]'); await pg.waitForTimeout(300);
    const rows = await pg.evaluate(() => [...document.querySelectorAll('#company-branches button')].map(b => b.innerText.replace(/\s+/g, ' ').trim()));
    ok(rows.length === 3 && /حلب – الفرقان/.test(rows[0]) && /\$150/.test(rows[0]) && /2 أوردر/.test(rows[0]) && /حلب – السريان/.test(rows[1]) && /\$70/.test(rows[1]) && /بلا فرعٍ محدَّد/.test(rows[2]), W + ': أفرع حوالات المفتي (الأكبر أوّلاً · المكتمل خارجها): ' + JSON.stringify(rows));
    // الفرع ⇒ فلتر «فروع الحوالات» ⇒ تظهر أوردراته وحدها
    await pg.click('#company-branches [data-sk="المفتي::حلب|السريان"]'); await pg.waitForTimeout(400);
    const f = await pg.evaluate(() => ({ v: document.getElementById('filter-sendbranch').value, total: document.getElementById('grandTotal').textContent, open: !document.getElementById('company-branches').classList.contains('hidden') }));
    ok(f.v === 'المفتي::حلب|السريان' && f.total === '$70' && f.open, W + ': النقر على «حلب – السريان» ⇒ الفلتر عليه والمجموع $70: ' + JSON.stringify(f));
    await pg.click('#company-branches [data-sk=""]'); await pg.waitForTimeout(300);
    const g = await pg.evaluate(() => ({ v: document.getElementById('filter-sendbranch').value, total: document.getElementById('grandTotal').textContent }));
    ok(g.v === '' && g.total === '$260', W + ': «إلغاء فلتر الفرع» ⇒ كل الأوردرات من جديد: ' + JSON.stringify(g));
    await pg.click('#company-totals [data-co="المفتي"]'); await pg.waitForTimeout(300);
    ok(await pg.evaluate(() => document.getElementById('company-branches').classList.contains('hidden')), W + ': نقرةٌ ثانية على الشركة تُخفي الأفرع');
    const hs = await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    ok(!hs, W + ': لا طفح أفقي');
    const real = errs.filter(e => !/status of (400|404|406)|Failed to load resource/.test(e));
    ok(!real.length, W + ': لا أخطاء JS ' + real.slice(0, 2).join(' / '));
    if (W === 390) { await pg.click('#company-totals [data-co="المفتي"]'); await pg.waitForTimeout(300); await pg.screenshot({ path: '/tmp/gmt-out/company_branches_390.png', fullPage: false }); }
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
