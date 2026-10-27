// (TASK-0223 · المالك seq 152) «في موقع تتبع الشحنات التي لدينا تعمل مزامنه بنفس هذا البوت … الشخص يدخل هنيك رقم التتبع … سواء رقم تتبع
// المفتي او رقم الطلب … ابحث له في المفتي ويزامن فورا على موقع التتبع تبعنا شو مكتوب هنيك ويزامن الانتقالات والكتابه … نطول الانترو شوي لحتى يزامن»
// دالّة الخادم gmt-mufti مُحاكاة بردود صفحة المفتي الحقيقية.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const L = ['تم استلام الشحنة', 'على الطريق وقيد النقل', 'وصلت فرع الوجهة,يرجى مراجعة الفرع لاستلامها', 'تم التسليم للمرسل إليه'];
const R = (n, act, status, at, info) => ({ n, ok: true, found: true, steps: L.map((l, i) => ({ label: l, active: act.includes(i + 1) })), date: at.slice(0, 10), level: Math.max(...act), receiver: { desc: 'الزبون', info }, status, status_at: at });
const FAKE = {
  '214244': R('214244', [1, 3], 'تم وصول الشحنة إلى الفرع الوجهة,بإمكانك زيارة الفرع لاستلامها', '27-10-2026 12:38', 'درعا - دوار الحمامة'),
  '214138': R('214138', [1, 2, 3, 4], 'تم استلام الشحنة من قبل المرسل إليه', '27-10-2026 15:36', 'دمشق - البرامكة'),
  '210063': R('210063', [1], 'تم إعادة توجيه الشحنة إلى الفرع', '27-10-2026 10:29', 'دمشق - فكتوريا'),
  '99999999': { n: '99999999', ok: true, found: false, steps: [], level: 0 }
};
(async () => {
  for (const [w, h] of [[390, 844], [1366, 820]]) {
    await H.seed();
    const base = { qty: 1, price: 100, branch: 'حلب', product: 'كاميرا', shipping_company: 'المفتي', shipped_at: new Date(Date.now() - 5 * 3600e3).toISOString() };
    const rows = await H.call('/rest/v1/gmt_orders', [
      Object.assign({ name: 'انفال عمر حسين', phone: '0933500001', status: 'shipped', tracking_number: '214244', address: 'درعا' }, base),
      Object.assign({ name: 'غالب زيدان', phone: '0933500002', status: 'shipped', tracking_number: '214138', address: 'دمشق' }, base),
      Object.assign({ name: 'بطيء الردّ', phone: '0933500003', status: 'shipped', tracking_number: '210063', address: 'دمشق' }, base),
      Object.assign({ name: 'رقم غريب', phone: '0933500004', status: 'shipped', tracking_number: '99999999', address: 'حمص' }, base),
      Object.assign({ name: 'زبون القدموس', phone: '0933500005', status: 'shipped', tracking_number: '555111', address: 'حلب' }, base, { shipping_company: 'القدموس' })]);
    const { browser, pg, errs } = await H.open('track_order.html', { w, h, mobile: w < 700, wait: 400 });
    const calls = [];
    await pg.route('**/functions/v1/gmt-mufti', async route => {
      const req = route.request(); if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, body: 'ok' });
      const b = JSON.parse(req.postData() || '{}'); calls.push(b.nums.join(','));
      await sleep(b.nums[0] === '210063' ? 9500 : 1200);       // 210063: أبطأ من مهلة الانتظار ⇒ النتيجة تظهر ثمّ تتحدّث
      route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ ok: true, out: b.nums.map(n => FAKE[n] || { n, ok: true, found: false }) }) });
    });
    await pg.waitForFunction(() => !document.getElementById('gmt-launch') && getComputedStyle(document.getElementById('layer1')).display === 'none', null, { timeout: 15000 }).catch(() => {});
    const search = async (q, maxMs = 15000) => {
      await pg.fill('#searchInput', q); await pg.evaluate(() => { searchOrder(); });
      let syncing = false; const t0 = Date.now();
      while (Date.now() - t0 < maxMs) { const st = await pg.evaluate(() => ({ s: document.getElementById('l2-sub').innerText, r: !document.getElementById('resultCard').classList.contains('hidden') })); if (/نزامن حالة شحنتك مع شركة المفتي/.test(st.s)) syncing = true; if (st.r) break; await sleep(100); }
      await sleep(300);
      return { syncing, ms: Date.now() - t0, v: await view() };
    };
    const view = () => pg.evaluate(() => {
      const steps = [...document.querySelectorAll('#timelineContainer > div')];
      const notes = [...document.querySelectorAll('#timelineContainer [data-mufti-note]')];
      const at = notes[0] ? steps.findIndex(x => x.contains(notes[0])) : -1;
      return { active: steps.findIndex(x => x.classList.contains('step-active')), mufti: notes.length === 1, noteAt: at, mtxt: notes.map(n => n.innerText).join(' | '),
        noteBg: notes[0] ? notes[0].style.background : '', box: !!document.getElementById('res-mufti'), tl: document.getElementById('timelineContainer').innerText,
        eta: !document.getElementById('res-eta').classList.contains('hidden') };
    });
    // ① برقم تتبّع المفتي — (seq 153) «حافظ مراحل اللي عنا في الموقع على حالها ولكن اكتب كتابه بجانبها» · «ازل منها المؤقت تماما»
    let r = await search('214244');
    ok(r.syncing && calls.includes('214244'), w + ': أثناء الانترو «نزامن حالة شحنتك مع شركة المفتي…» · سُئل المفتي عن الرقم');
    ok(r.v.active === 3 && r.v.mufti && r.v.noteAt === 3 && /شركة المفتي الآن: تم وصول الشحنة إلى الفرع الوجهة/.test(r.v.mtxt) && /12:38/.test(r.v.mtxt) && /درعا - دوار الحمامة/.test(r.v.mtxt) && !r.v.box,
      w + ': (seq 154) «وصلت الفرع الوجهة» ⇒ مرحلتنا «وصلت — بانتظار الاستلام» · كتابة المفتي بجانبها (النصّ والتاريخ وفرع الاستلام): ' + JSON.stringify([r.v.active, r.v.noteAt]));
    ok(!r.v.eta && !/الوصول المتوقّع/.test(r.v.tl), w + ': شحنة المفتي ⇒ لا مؤقّت ولا «الوصول المتوقّع» إطلاقاً');
    // ② برقم الطلب عندنا (لا رقم المفتي)
    calls.length = 0;
    r = await search(String(rows[1].id));
    ok(calls.includes('214138') && r.v.active === 4 && r.v.noteAt === 4 && /تم استلام الشحنة من قبل المرسل إليه/.test(r.v.mtxt), w + ': برقم الطلب أيضاً ⇒ يسأل المفتي برقم تتبّعه · «تم التسليم للمرسل إليه» ⇒ «تم الاستلام»: ' + r.v.active);
    // ③ بالجوال · ردّ المفتي أبطأ من المهلة ⇒ النتيجة تظهر ثمّ تُكتب الكتابة وحدها · «إعادة التوجيه» = مرتجع (تنبيهٌ بلونٍ مختلف · لا استلام)
    calls.length = 0;
    r = await search('0933500003', 20000);
    ok(r.v.active === 2 && !r.v.mufti && r.ms < 9500 && !r.v.eta, w + ': ردٌّ بطيء ⇒ لا انتظار بلا حدّ (' + (r.ms / 1000).toFixed(1) + 'ث) · النتيجة بمراحلنا');
    await sleep(4500);
    const late = await view();
    ok(late.mufti && /تم إعادة توجيه الشحنة إلى الفرع/.test(late.mtxt) && late.active === 2 && /251, 235/.test(late.noteBg), w + ': ردٌّ متأخّر ⇒ الكتابة تُضاف وحدها · «إعادة التوجيه» = مرتجع ⇒ لا تتحرّك المرحلة وبلون التنبيه: ' + late.noteBg);
    // لا مؤقّت يحرّك شحنة المفتي: شُحنت قبل ٤٠ ساعة (بعد نافذة الوصول) ولا ردّ من المفتي ⇒ تبقى «تم الشحن» بلا عدّاد
    await H.call('/rest/v1/gmt_orders?id=eq.' + rows[3].id, { shipped_at: new Date(Date.now() - 40 * 3600e3).toISOString() }, 'PATCH');
    r = await search('0933500004');
    ok(r.v.active === 2 && !r.v.eta && !/الوصول المتوقّع|قريباً جداً/.test(r.v.tl), w + ': لا مؤقّت يحرّك شحنة المفتي (٤٠ ساعة بلا ردٍّ منهم ⇒ «تم الشحن» كما هي)');
    // ④ رقمٌ لا يعرفه المفتي ⇒ لا مستطيل (حالتنا كما هي) · ⑤ القدموس ⇒ لا سؤال للمفتي
    r = await search('99999999');
    ok(!r.v.mufti && r.v.active === 2 && !r.v.eta, w + ': رقمٌ لا يعرفه المفتي ⇒ مراحلنا كما هي بلا كتابة (ولا مؤقّت — شحنة مفتي)');
    calls.length = 0;
    r = await search('555111');
    ok(!calls.length && !r.v.mufti && !r.syncing && r.v.eta, w + ': شحنة القدموس ⇒ لا سؤال للمفتي ولا انتظار · مؤقّتها كما كان');
    // بحثٌ جديد كل مرّة (لا تخزين): نفس الرقم مرّتين ⇒ نداءان
    calls.length = 0; await search('214244'); await search('214244');
    ok(calls.filter(c => c === '214244').length === 2, w + ': نفس الرقم مرّتين ⇒ سؤالان للمفتي (لا تخزين)');
    const hs = await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    ok(!hs, w + ': لا طفح أفقي');
    if (w === 390) { await search('214244'); await pg.evaluate(() => document.getElementById('resultCard').scrollIntoView()); await sleep(300); await pg.screenshot({ path: '/tmp/gmt-out/track_mufti_390.png', fullPage: true }); }
    const real = errs.filter(e => !/status of (400|401|404|406|500)|Failed to load resource/.test(e));
    ok(!real.length, w + ': لا أخطاء JS ' + real.slice(0, 2).join(' / '));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
