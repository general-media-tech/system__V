// (19 ت1 · TASK-0106/0107) الانتقال: شاحنةٌ أصغر على طريق A⇐B ثمّ ضبابٌ متجانس · التحقّق: «أهلاً بك، [الاسم]» والشاحنة بدل التحميل + بيب بيب
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  for (const [w, h] of [[390, 844], [1366, 820]]) {
    console.log('— ' + w);
    await H.seed();
    await H.call('/rest/v1/gmt_orders', [{ name: 'أحمد الخطيب', phone: '0933111222', product: 'كاميرا', qty: 1, price: 100, status: 'shipped', branch: 'حلب', address: 'دمشق', shipping_company: 'المفتي', tracking_number: '196682' }]);
    // ١) الفتح المباشر: مشهد الترحيب على الطريق ثمّ الضباب ثمّ الصفحة
    const { browser, pg, errs } = await H.open('track_order.html', { w, h, mobile: w < 700, wait: 400 });
    const s0 = await pg.evaluate(() => { const ov = document.getElementById('gmt-launch'), van = ov && ov.querySelector('.gr-van'); return ov ? { vw: van.getBoundingClientRect().width / innerWidth, txt: ov.innerText, ab: ov.querySelectorAll('.gr-dot').length } : null; });
    ok(s0 && s0.ab === 2 && /أهلاً بكم/.test(s0.txt), 'الترحيب: طريقٌ بنقطتي A وB والنصّ «أهلاً بكم»');
    ok(s0 && (w < 700 ? s0.vw > .26 && s0.vw < .40 : s0.vw > .2 && s0.vw <= .26), 'حجم الشاحنة: ' + (s0 && s0.vw.toFixed(2)) + ' من العرض (ثلث الهاتف · ربع الكمبيوتر)');
    await sleep(1500);
    const mid = await pg.evaluate(() => { const ov = document.getElementById('gmt-launch'); if (!ov) return null; const f = ov.querySelector('.gr-fill'); return { fill: parseFloat(f.style.width) || 0, moving: !!ov.querySelector('.gr.moving') }; });
    ok(mid && mid.fill > 5 && mid.fill < 100 && mid.moving, 'أثناء السير: المقطوع يمتلئ خلفها (' + (mid && mid.fill.toFixed(0)) + '%) والدواليب تدور');
    let sawFog = false, t0 = Date.now();
    while (Date.now() - t0 < 9000) { const st = await pg.evaluate(() => ({ fog: !!document.querySelector('#gmt-launch .gr-fog'), ov: !!document.getElementById('gmt-launch') })); if (st.fog) sawFog = true; if (!st.ov) break; await sleep(150); }
    ok(sawFog, 'عند B يظهر الضباب (لوحة رسم، لا فيديو)');
    const end = await pg.evaluate(() => ({ ov: !!document.getElementById('gmt-launch'), l1: getComputedStyle(document.getElementById('layer1')).display, vid: document.querySelectorAll('video').length }));
    ok(!end.ov && end.l1 === 'none' && end.vid === 0, 'بعد الضباب: المشهد أُزيل وشاشة الترحيب أُخفيت · لا فيديو في الصفحة');
    ok(Date.now() - t0 < 8000, 'لا تعليق: الترحيب انتهى خلال ' + ((Date.now() - t0) / 1000 + 1.9).toFixed(1) + 'ث');
    // ٢) البحث: الشاحنة بدل التحميل ⇒ «أهلاً بك، أحمد الخطيب» + بيب بيب مرّة ⇒ B ⇒ النتيجة
    await pg.evaluate(() => { window.__snd = []; if (window.GMTSound) { const p = GMTSound.play; GMTSound.play = n => { window.__snd.push(n); }; } });
    await pg.fill('#searchInput', '196682');
    await pg.evaluate(() => { searchOrder(); });
    await sleep(250);
    const v1 = await pg.evaluate(() => ({ l2: !document.getElementById('layer2').classList.contains('hidden'), road: !!document.querySelector('#trk-road .gr'), spin: !document.getElementById('loader').classList.contains('hidden') }));
    ok(v1.l2 && v1.road && !v1.spin, 'أثناء البحث: الشاحنة على المسار بدل مؤشّر الدوران');
    let named = '', done = false; t0 = Date.now();
    while (Date.now() - t0 < 7000) { const st = await pg.evaluate(() => ({ n: document.getElementById('l2-name').innerText, d: !!document.querySelector('#trk-road .gr.done'), r: !document.getElementById('resultCard').classList.contains('hidden') })); if (/أهلاً بك/.test(st.n)) named = st.n; if (st.d) done = true; if (st.r) break; await sleep(100); }
    ok(named === 'أهلاً بك، أحمد الخطيب', 'الاسم الحقيقي من الطلب: «' + named + '»');
    ok(done, 'الشاحنة بلغت B قبل ظهور النتيجة');
    const v2 = await pg.evaluate(() => ({ res: !document.getElementById('resultCard').classList.contains('hidden'), l2: document.getElementById('layer2').classList.contains('hidden'), snd: window.__snd }));
    ok(v2.res && v2.l2, 'النتيجة ظهرت وشاشة التحقق اختفت');
    ok(v2.snd.filter(n => n === 'horn').length === 1, '«بيب بيب» مرّة واحدة: ' + JSON.stringify(v2.snd));
    // ٣) رقمٌ غير موجود
    await pg.fill('#searchInput', '999999'); await pg.evaluate(() => { searchOrder(); }); await sleep(1500);
    const nf = await pg.evaluate(() => ({ e: document.getElementById('errorMsg').innerText, hid: document.getElementById('errorMsg').classList.contains('hidden'), l2: document.getElementById('layer2').classList.contains('hidden') }));
    ok(!nf.hid && /لم نجد شحنةً بهذا الرقم/.test(nf.e) && nf.l2, 'رقمٌ غير موجود ⇒ رسالة واضحة والشاحنة اختفت');
    const real = errs.filter(e => !/Failed to load resource/.test(e)); ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
    ok(!(await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)), 'لا طفح أفقي');
    await browser.close();
    // ٤) الانتقال من رابط تتبّعٍ في الرئيسية ⇒ الوصول تحت الضباب ⇒ يرقّ
    const B = await H.open('home.html', { w, h, mobile: w < 700, wait: 3000 });
    await B.pg.evaluate(() => { const a = document.createElement('a'); a.href = 'track_order.html?q=196682'; a.id = 'tl'; a.textContent = 'تتبّع'; document.body.appendChild(a); });
    await B.pg.evaluate(() => document.getElementById('tl').click()); await sleep(300);
    ok(await B.pg.evaluate(() => !!document.querySelector('#gmt-launch .gr-van')), 'رابط التتبّع في الرئيسية يبدأ المشهد');
    const nav = Date.now(); await B.pg.waitForURL(/track_order\.html/, { timeout: 9000 }).catch(() => {});
    ok(/track_order/.test(B.pg.url()), 'انتقل إلى صفحة التتبّع بعد ' + ((Date.now() - nav) / 1000).toFixed(1) + 'ث');
    await sleep(200);
    const arr = await B.pg.evaluate(() => ({ cov: document.documentElement.classList.contains('gmt-arriving') || !!document.querySelector('.gr-fog'), l1: getComputedStyle(document.getElementById('layer1')).display }));
    ok(arr.cov && arr.l1 === 'none', 'الوصول: الصفحة تحت الضباب ولا ترحيب ثانٍ');
    t0 = Date.now(); while (Date.now() - t0 < 9000) { if (!(await B.pg.evaluate(() => document.documentElement.classList.contains('gmt-arriving') || !!document.querySelector('.gr-fog')))) break; await sleep(150); }
    ok(Date.now() - t0 < 9000, 'الضباب رقّ وانكشفت الصفحة (' + ((Date.now() - t0) / 1000).toFixed(1) + 'ث)');
    const real2 = B.errs.filter(e => !/Failed to load resource/.test(e) && !/أصول ناقصة: 1 favicon\.ico/.test(e));   /* حارس الصور يعدّ إلغاء تنزيل الأيقونة عند الانتقال «ناقصاً» — الملف موجود (مسجّل في السجل) */ ok(!real2.length, 'لا أخطاء JS في الانتقال ' + real2.slice(0, 2).join(' / '));
    await B.browser.close();
    // ٥) تقليل الحركة ⇒ انتقالٌ بسيط
    const C = await H.open('home.html', { w, h, mobile: w < 700, wait: 2500 });
    await C.pg.emulateMedia({ reducedMotion: 'reduce' });
    await C.pg.evaluate(() => { const a = document.createElement('a'); a.href = 'track_order.html'; a.id = 'tl'; document.body.appendChild(a); a.click(); });
    await sleep(150);
    ok(!(await C.pg.evaluate(() => !!document.getElementById('gmt-launch')).catch(() => false)), 'تقليل الحركة: لا مشهد — انتقالٌ مباشر');
    await C.browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
