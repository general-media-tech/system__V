// (TASK-0209 · المالك seq 139) «تفاصيل استخدام الضمان … الكاميرا مرتجع واستبدلنا له اياها ايمت استرجعناها وشو تقرير الفحص … اصلاح او استبدال
// وانه تمت الاستفاده من الضمان … الكفاله والضمان هو مره واحده استخدامه»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const claims = () => H.call('/__dump', undefined, 'GET').then(d => d.warranty_claims || []);
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
(async () => {
  for (const W of [390, 1366]) {
    await H.seed();
    await H.call('/rest/v1/warranties', [{ short_id: 'W100', customer_name: 'سامي', product_name: 'Canon EOS R50', serial_no: 'SN-1', invoice_no: 'INV-9', status: 'active', expiry_date: '2027-10-01', activation_status: 'activated', created_at: '2026-10-01T10:00:00Z' },
      { short_id: 'W200', customer_name: 'ريم', product_name: 'Canon RF 50mm', serial_no: 'SN-2', status: 'active', expiry_date: '2027-10-01', created_at: '2026-10-02T10:00:00Z' }]);
    const { browser, pg, errs } = await H.open('guarantee_admin.html', { init: H.ADMIN_INIT, w: W, h: 900, mobile: W < 500, wait: 4500 });
    await pg.waitForSelector('[data-wc-open="W100"]', { timeout: 8000 }).catch(() => {});
    ok(!!(await pg.$('[data-wc-open="W100"]')) && !(await pg.$('[data-wc-badge]')), W + ': زرّ «🛠 الضمان» لكل كفالة · لا شارة قبل أيّ استخدام');
    await pg.click('[data-wc-open="W100"]'); await pg.waitForSelector('#gmt-wc #wc-rec', { timeout: 4000 }).catch(() => {});
    const d0 = await pg.evaluate(() => ({ rec: document.getElementById('wc-rec').value, used: document.getElementById('wc-used').checked, hdr: document.querySelector('#gmt-wc .wc-h').innerText }));
    ok(d0.rec === ymd(new Date()) && !d0.used && /سامي/.test(d0.hdr) && /W100/.test(d0.hdr), W + ': النافذة: الكفالة واسم الزبون · تاريخ الاستلام اليوم: ' + JSON.stringify(d0.rec));
    // ① استلمناها للفحص (قيد الفحص) ⇒ لا «استُفيد» بعد
    const y = new Date(); y.setDate(y.getDate() - 3);
    await pg.fill('#wc-rec', ymd(y)); await pg.fill('#wc-cmp', 'لا تشتغل بعد أسبوع'); await pg.click('#gmt-wc [data-wc-save]'); await pg.waitForTimeout(900);
    let c = await claims();
    ok(c.length === 1 && c[0].warranty_short_id === 'W100' && c[0].resolution === 'pending' && c[0].consumed === false && c[0].received_at === ymd(y) && c[0].complaint === 'لا تشتغل بعد أسبوع' && c[0].created_by, W + ': استلامٌ للفحص حُفظ (قيد الفحص · غير مستفاد): ' + JSON.stringify(c.map(x => [x.resolution, x.consumed, x.received_at])));
    ok(/قيد الفحص/.test(await pg.evaluate(() => (document.querySelector('[data-wc-badge]') || {}).textContent || '')), W + ': الشارة في الجدول «🛠 قيد الفحص»');
    // ② تحديثه: تقرير الفحص + استبدال ⇒ «استُفيد» يُعلَّم تلقائياً · الرقم البديل إلزاميّ للاستبدال
    await pg.click('[data-wc-open="W100"]'); await pg.waitForSelector('#gmt-wc [data-wc-edit]');
    await pg.click('#gmt-wc [data-wc-edit]'); await pg.waitForTimeout(150);
    await pg.fill('#wc-rep', 'عطل في الحسّاس'); await pg.selectOption('#wc-res', 'replace');
    const autoUsed = await pg.evaluate(() => document.getElementById('wc-used').checked);
    await pg.click('#gmt-wc [data-wc-save]'); await pg.waitForTimeout(300);
    ok(autoUsed && /الرقم التسلسلي البديل/.test(await pg.evaluate(() => document.querySelector('#gmt-wc [data-wc-msg]').textContent)), W + ': «استبدال» ⇒ «تمت الاستفادة» تلقائياً · ويطلب الرقم البديل');
    await pg.fill('#wc-ser', 'SN-NEW-77'); await pg.fill('#wc-del', ymd(new Date())); await pg.click('#gmt-wc [data-wc-save]'); await pg.waitForTimeout(900);
    c = await claims();
    ok(c.length === 1 && c[0].resolution === 'replace' && c[0].consumed === true && c[0].inspection_report === 'عطل في الحسّاس' && c[0].replacement_serial === 'SN-NEW-77' && c[0].delivered_at === ymd(new Date()) && c[0].received_at === ymd(y),
      W + ': التحديث على الصفّ نفسه: تقرير الفحص · استبدال · الرقم البديل · تاريخ التسليم: ' + JSON.stringify(c.map(x => [x.resolution, x.consumed, x.replacement_serial])));
    ok(/استُخدم الضمان · استبدال/.test(await pg.evaluate(() => (document.querySelector('[data-wc-badge]') || {}).textContent || '')), W + ': الجدول: «🛠 استُخدم الضمان · استبدال»');
    // ③ الضمان مرّة واحدة: استخدامٌ ثانٍ ⇒ تنبيهٌ في النافذة وتأكيدٌ قبل «استُفيد» مرّة ثانية (تراجع ⇒ لا شيء)
    await pg.click('[data-wc-open="W100"]'); await pg.waitForSelector('#gmt-wc #wc-rec');
    const warn = await pg.evaluate(() => (document.querySelector('#gmt-wc [data-wc-used]') || {}).textContent || '');
    await pg.evaluate(() => { window.__asked = 0; GMTAsk.confirm = async () => { __asked++; return false; }; });
    await pg.selectOption('#wc-res', 'repair'); await pg.click('#gmt-wc [data-wc-save]'); await pg.waitForTimeout(500);
    ok(/استُخدم سابقاً/.test(warn) && /مرّةٌ واحدة/.test(warn) && await pg.evaluate(() => __asked) === 1 && (await claims()).length === 1, W + ': استخدامٌ ثانٍ ⇒ «الضمان استُخدم سابقاً — مرّةٌ واحدة» وتأكيد · تراجع ⇒ لم يُسجَّل');
    // تاريخ مستقبليّ مرفوض · Esc يغلق
    const t2 = new Date(); t2.setDate(t2.getDate() + 2);
    await pg.fill('#wc-rec', ymd(t2)); await pg.click('#gmt-wc [data-wc-save]'); await pg.waitForTimeout(200);
    ok(/المستقبل/.test(await pg.evaluate(() => document.querySelector('#gmt-wc [data-wc-msg]').textContent)), W + ': تاريخٌ في المستقبل مرفوض');
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(150);
    ok(!(await pg.$('#gmt-wc')), W + ': Esc يغلق');
    // الكفالة الأخرى بلا شارة
    ok(await pg.evaluate(() => document.querySelectorAll('[data-wc-badge]').length) === 1, W + ': الكفالة الأخرى بلا شارة');
    const hs = await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    ok(!hs, W + ': لا طفح أفقي');
    if (W === 390) { await pg.click('[data-wc-open="W100"]'); await pg.waitForTimeout(300); await pg.screenshot({ path: '/tmp/gmt-out/wclaims_390.png' }); }
    const real = errs.filter(e => !/status of (400|401|404|406)|Failed to load resource/.test(e));
    ok(!real.length, W + ': لا أخطاء JS ' + real.slice(0, 2).join(' / '));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
