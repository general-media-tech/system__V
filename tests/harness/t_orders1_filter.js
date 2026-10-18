// وثيقة الطلبات §٢ — الفرع المُرسِل + حالة مراسلته (الحوالة) في الفلترة وعلى البطاقة، بالجوال وسطح المكتب
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const SHOT = '/tmp/claude-0/-home-user-system--V/dfe65fb9-bcc1-5e5a-be94-906828e1c021/scratchpad/harness/';
(async () => {
  for (const w of [390, 1366]) {
    console.log('— ' + w);
    await H.seed();
    await H.call('/__opts', { reject_cols: [] });
    const rows = await H.call('/rest/v1/gmt_orders', [
      { name: 'أ فرقان', phone: '0933000001', product: 'كاميرا', qty: 1, price: 100, status: 'shipped', branch: 'حلب', address: 'دمشق', shipping_company: 'المفتي', tracking_number: '111', ship_from_office: 'حلب|الفرقان', transfer_state: 'asked', shipped_at: '2026-10-10T08:00:00Z' },
      { name: 'ب سريان افتراضي', phone: '0933000002', product: 'كاميرا', qty: 1, price: 200, status: 'delivered', branch: 'حلب', address: 'حمص', shipping_company: 'المفتي', tracking_number: '222', shipped_at: '2026-10-10T08:00:00Z' },
      { name: 'ج سريان وصلت', phone: '0933000003', product: 'كاميرا', qty: 1, price: 300, status: 'delivered', branch: 'حلب', address: 'حماة', shipping_company: 'المفتي', tracking_number: '333', ship_from_office: 'حلب|السريان', transfer_state: 'received', shipped_at: '2026-10-10T08:00:00Z' },
      { name: 'د مسارات', phone: '0933000004', product: 'كاميرا', qty: 1, price: 400, status: 'shipped', branch: 'حلب', address: 'حمص', shipping_company: 'مسارات', tracking_number: '444' },
      { name: 'هـ مفتي لم يُشحن', phone: '0933000005', product: 'كاميرا', qty: 1, price: 500, status: 'pending', branch: 'حلب', address: 'دمشق', shipping_company: 'المفتي' }
    ]);
    const { browser, pg, errs } = await H.open('orders.html', { w, mobile: w < 700, h: 900, wait: 4500 });
    const names = () => pg.evaluate(() => [...document.querySelectorAll('.order-card h4')].map(h => h.childNodes[0].textContent.trim()));
    const opts = await pg.evaluate(() => [...document.querySelectorAll('#filter-sendbranch option')].map(o => o.value + '=' + o.textContent.trim()));
    ok(opts.length === 3 && opts.includes('حلب|الفرقان=حلب – الفرقان') && opts.includes('حلب|السريان=حلب – السريان'), 'خيارات الفرع المُرسِل من الأوردرات: ' + opts.join(' | '));
    ok(!opts.some(o => /مسارات|دمشق|حمص/.test(o)), 'لا فرع مُرسِل لغير المفتي ولا لما لم يُشحن بعد');
    // الفلتر بالفرع المُرسِل
    await pg.selectOption('#filter-sendbranch', 'حلب|الفرقان');
    let n = await names(); ok(n.length === 1 && /أ فرقان/.test(n[0]), 'فلتر «الفرقان» يُظهر أوردره فقط: ' + n.join(','));
    await pg.selectOption('#filter-sendbranch', 'حلب|السريان');
    n = await names(); ok(n.length === 2 && n.some(x => /ب سريان/.test(x)) && n.some(x => /ج سريان/.test(x)), 'فلتر «السريان» يشمل المحدَّد والافتراضي: ' + n.join(','));
    // إجمالي «بانتظار التحصيل» يتبع الفلتر (وين أموال التحصيل)
    const sumD = await pg.evaluate(() => document.getElementById('sumDelivered').textContent);
    ok(/500/.test(sumD), 'إجمالي بانتظار التحصيل للفرع المختار $500: ' + sumD);
    // فلتر الحوالة
    await pg.selectOption('#filter-sendbranch', '');
    await pg.selectOption('#filter-transfer', 'asked');
    n = await names(); ok(n.length === 1 && /أ فرقان/.test(n[0]), 'فلتر «رُوسِل — بانتظار الحوالة»: ' + n.join(','));
    await pg.selectOption('#filter-transfer', 'received');
    n = await names(); ok(n.length === 1 && /ج سريان/.test(n[0]), 'فلتر «وصلت الحوالة»: ' + n.join(','));
    await pg.selectOption('#filter-transfer', 'none');
    n = await names(); ok(n.length === 1 && /ب سريان/.test(n[0]), 'فلتر «لم تُراسَل» لا يلتقط غير المفتي ولا غير المشحون: ' + n.join(','));
    // جمع الفلترين
    await pg.selectOption('#filter-sendbranch', 'حلب|السريان'); await pg.selectOption('#filter-transfer', 'received');
    n = await names(); ok(n.length === 1 && /ج سريان/.test(n[0]), 'الفلترين معاً');
    const clr = await pg.evaluate(() => !document.getElementById('clear-filters-btn').classList.contains('hidden'));
    ok(clr, 'زرّ إزالة الفلتر ظاهر مع الفلاتر الجديدة');
    await pg.evaluate(() => clearFilters());
    const after = await pg.evaluate(() => ({ s: document.getElementById('filter-sendbranch').value, t: document.getElementById('filter-transfer').value }));
    n = await names(); ok(after.s === '' && after.t === '' && n.length === 5, 'إزالة الفلتر تمسح الفلترين وتُرجع كل الأوردرات (' + n.length + ')');
    // الشارة على البطاقة
    const chips = await pg.evaluate(() => [...document.querySelectorAll('[data-sender-info]')].map(d => d.innerText.replace(/\s+/g, ' ').trim()));
    ok(chips.length === 3, 'شارة الفرع/الحوالة على بطاقات المفتي المشحونة فقط (3): ' + chips.length);
    ok(chips.some(t => /الفرقان/.test(t) && /رُوسِل — بانتظار الحوالة/.test(t)) && chips.some(t => /السريان/.test(t) && /وصلت الحوالة/.test(t)) && chips.some(t => /السريان/.test(t) && /لم تُراسَل/.test(t)), 'الشارات: ' + chips.join(' || '));
    // تغيير الحالة من البطاقة: لم تُراسَل ← رُوسِل
    const bId = rows[1].id;
    await pg.evaluate((id) => { window.__p = openTransferState(id); }, bId);
    await pg.waitForSelector('.gmtask-b');
    const btns = await pg.evaluate(() => [...document.querySelectorAll('.gmtask-b')].map(b => (b.classList.contains('pri') ? '★' : '') + b.textContent.trim()));
    ok(/^★.*لم تُراسَل/.test(btns[0]) && btns.length === 4, 'نافذة الحالة: الحالية أوّلاً ومميَّزة (Enter لا يغيّر شيئاً): ' + btns.join(' | '));
    await pg.evaluate(() => { [...document.querySelectorAll('.gmtask-b')].find(b => /^رُوسِل/.test(b.textContent.trim())).click(); });
    await pg.waitForTimeout(900);
    const db = await H.call('/rest/v1/gmt_orders?id=eq.' + bId, undefined, 'GET');
    ok(db[0].transfer_state === 'asked' && !!db[0].transfer_at, 'حُفظ في القاعدة: ' + db[0].transfer_state + ' @ ' + db[0].transfer_at);
    const chip2 = await pg.evaluate((id) => document.querySelector('#card-' + id + ' [data-transfer-chip]').getAttribute('data-transfer-chip'), bId);
    ok(chip2 === 'asked', 'الشارة تغيّرت فوراً إلى asked');
    // العودة إلى «لم تُراسَل» تمسح العمودين
    await pg.evaluate((id) => { window.__p = openTransferState(id); }, bId);
    await pg.waitForSelector('.gmtask-b');
    await pg.evaluate(() => { [...document.querySelectorAll('.gmtask-b')].find(b => /لم تُراسَل/.test(b.textContent)).click(); });
    await pg.waitForTimeout(900);
    const db2 = await H.call('/rest/v1/gmt_orders?id=eq.' + bId, undefined, 'GET');
    ok(db2[0].transfer_state === null && db2[0].transfer_at === null, 'العودة إلى «لم تُراسَل» تُصفّر العمودين في القاعدة');
    const hs = await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
    ok(!hs, 'لا طفح أفقي');
    const filt = await pg.evaluate(() => { const r = document.getElementById('filter-transfer').getBoundingClientRect(); const r2 = document.getElementById('filter-sendbranch').getBoundingClientRect(); return { a: [Math.round(r.left), Math.round(r.right)], b: [Math.round(r2.left), Math.round(r2.right)], vw: innerWidth }; });
    ok(filt.a[0] >= 0 && filt.a[1] <= filt.vw && filt.b[0] >= 0 && filt.b[1] <= filt.vw, 'الفلترات الجديدة داخل الشاشة ' + JSON.stringify(filt));
    await pg.evaluate(() => { document.getElementById('filter-company').scrollIntoView(); });
    await pg.screenshot({ path: SHOT + 'orders1_filter_' + w + '.png' });
    const real = errs.filter(e => !/404|400|favicon|Failed to load/.test(e));
    ok(real.length === 0, 'لا أخطاء JS ' + real.slice(0, 2).join(' | '));
    await browser.close();
  }
  console.log(`PASS=${pass} FAIL=${fails}`);
  process.exit(fails ? 1 : 0);
})();
