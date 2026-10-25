// (25 ت1 · TASK-0163) المالك seq 75: «ضع لهم فلترة حسب الفرع للحوالات — كل شركة إلها فلتر فروع للحوالات بالأوردرات — طبعاً بيظهر
// بالفلتر فقط يلي إلنا عندهم حوالات» + «فرع باب الفرج مو محطوط بالبنك فضيفه للبنك».
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  for (const W of [390, 1366]) {
    await H.seed();
    const base = { qty: 1, branch: 'حلب', product: 'كاميرا', shipped_at: '2026-10-20T10:00:00Z' };
    const rows = await H.call('/rest/v1/gmt_orders', [
      Object.assign({ name: 'زبون المفتي', phone: '0933000801', price: 100, status: 'shipped', shipping_company: 'المفتي', ship_from_office: 'حلب|الفرقان', address: 'دمشق' }, base),
      Object.assign({ name: 'زبون القدموس', phone: '0933000802', price: 50, status: 'delivered', shipping_company: 'القدموس', ship_from_office: 'حلب|الفرقان', address: 'حمص' }, base),
      Object.assign({ name: 'زبون مسارات باب الفرج', phone: '0933000803', price: 30, status: 'shipped', shipping_company: 'مسارات', ship_from_office: 'حلب|باب الفرج', address: 'دمشق' }, base),
      Object.assign({ name: 'زبون مسارات مدفوع', phone: '0933000804', price: 40, collect_amount: 0, status: 'shipped', shipping_company: 'مسارات', ship_from_office: 'حلب|السليمانية', address: 'حماة' }, base),
      Object.assign({ name: 'زبون القدموس جديد', phone: '0933000805', price: 20, status: 'pending', shipping_company: 'القدموس', ship_from_office: 'حلب|الجميلية', address: 'حلب' }, base)]);
    const [oM, oQ, oS, oP, oN] = rows;
    const { browser, pg, errs } = await H.open('orders.html', { w: W, h: W < 500 ? 844 : 900, mobile: W < 500, wait: 4500 });
    const opts = () => pg.evaluate(() => [...document.querySelectorAll('#filter-sendbranch optgroup')].map(g => [g.label, [...g.querySelectorAll('option')].map(o => o.textContent)]));
    const g = await opts();
    ok(JSON.stringify(g.map(x => x[0])) === JSON.stringify(['المفتي', 'القدموس', 'مسارات']), W + ': فلتر فروع الحوالات مجموعةٌ لكل شركة: ' + JSON.stringify(g));
    const flat = g.map(x => x[1].join('|')).join('|');
    ok(/القدموس · حلب – الفرقان/.test(flat) && /مسارات · حلب – باب الفرج/.test(flat) && !/السليمانية|الجميلية/.test(flat),
      W + ': فقط الفروع التي لنا عندها حوالات (لا المدفوع سلفاً ولا غير المشحون)');
    const vis = () => pg.evaluate(() => [...document.querySelectorAll('[id^="card-"]')].filter(c => c.offsetParent || c.getClientRects().length).map(c => c.id));
    await pg.selectOption('#filter-sendbranch', 'القدموس::حلب|الفرقان'); await pg.waitForTimeout(400);
    const v1 = await vis();
    ok(v1.includes('card-' + oQ.id) && !v1.includes('card-' + oM.id) && !v1.includes('card-' + oS.id), W + ': اختيار «القدموس · حلب – الفرقان» ⇐ أوردر القدموس وحده (لا المفتي من الفرع نفسه): ' + v1.join(','));
    await pg.selectOption('#filter-sendbranch', ''); await pg.selectOption('#filter-company', 'مسارات'); await pg.waitForTimeout(400);
    const g2 = await opts();
    ok(g2.length === 1 && g2[0][0] === 'مسارات', W + ': فلتر الشركة «مسارات» ⇐ فروع حوالات مسارات وحدها: ' + JSON.stringify(g2));
    await pg.selectOption('#filter-company', ''); await pg.waitForTimeout(300);
    // بطاقة القدموس: الفرع المُرسِل وحالة الحوالة و«💸 الحوالة» تراسل فرع القدموس من بنكه
    const cq = await pg.evaluate(id => { const c = document.getElementById('card-' + id); return { chip: (c.querySelector('[data-sender-info]') || {}).innerText || '', btn: !!c.querySelector('[onclick^="contactSendingBranch"]') }; }, oQ.id);
    ok(/المُرسِل/.test(cq.chip) && /الفرقان/.test(cq.chip) && /لم تُراسَل/.test(cq.chip) && cq.btn, W + ': بطاقة القدموس: الفرع المُرسِل + حالة الحوالة + «الحوالة»: ' + cq.chip.replace(/\s+/g, ' '));
    const wa = await pg.evaluate(id => { window.__wa = null; window.openWhatsAppChat = (ph, t) => { window.__wa = { ph, t }; return {}; }; contactSendingBranch(id); return window.__wa; }, oQ.id);
    ok(wa && /0944676555/.test(wa.ph) && /الحوالة/.test(wa.t), W + ': مراسلة الفرع المُرسِل ⇐ هاتف «القدموس حلب – الفرقان» من البنك: ' + (wa && wa.ph));
    // «باب الفرج» في بنك مسارات (بلا هاتف بعد ⇒ يُقال ذلك ولا يُخترع رقم)
    const bf = await pg.evaluate(() => (GMTOffices.data['مسارات']['حلب'] || []).find(x => x.name === 'باب الفرج'));
    ok(bf && !bf.phone, W + ': «باب الفرج» في بنك مسارات حلب (الهاتف فارغ حتى يُزوَّد)');
    await pg.evaluate(id => { window.__wa = null; contactSendingBranch(id); }, oS.id); await pg.waitForTimeout(300);
    const nophone = await pg.evaluate(() => document.body.innerText.includes('ليس له رقمٌ في دليل المكاتب') && !window.__wa);
    ok(nophone, W + ': فرعٌ بلا هاتف ⇐ تنبيهٌ صريح بلا مراسلة');
    await pg.keyboard.press('Escape').catch(() => {}); await pg.evaluate(() => document.querySelectorAll('.gmtask-ov, #gmtask-ov, [data-gmtask]').forEach(x => x.remove()));
    // نافذة التعديل: فروع القدموس والمحفوظ مختار
    const ed = await pg.evaluate(id => { openEditModal(id); const s = document.getElementById('edit-ship-from'); return { shown: !document.getElementById('edit-sender-wrap').classList.contains('hidden'), v: s.value, co: s.getAttribute('data-co') }; }, oQ.id);
    ok(ed.shown && ed.v === 'حلب|الفرقان' && ed.co === 'القدموس', W + ': تعديل أوردر القدموس ⇐ فرعه المُرسِل من بنك القدموس: ' + JSON.stringify(ed));
    ok(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), W + ': لا تمرير أفقي');
    const real = errs.filter(e => !/status of (400|503)/.test(e)); ok(!real.length, W + ': لا أخطاء JS ' + real.slice(0, 2).join(' / '));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
