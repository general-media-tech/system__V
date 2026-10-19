// اختبار (١٨ ت1): انطلاق الشاحنة والانتقال إلى التتبّع (gmt-launch.js) · انترو افتتاح النظام (gmt-welcome.js) · «تم الاستلام» في التتبّع
const H = require('./h.js');
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fails++; };
const PUB = `try{ localStorage.setItem('gmt_sound','off'); }catch(e){}`;

async function trackDirect(w, h) {
  console.log(`— فتح التتبّع مباشرةً (رابط خارجي) ${w}×${h}`);
  const { browser, pg, errs } = await H.open('track_order.html', { init: PUB + `window.__ev=[];document.addEventListener('gmt:launch-cover',()=>__ev.push(['cover',performance.now()]));document.addEventListener('gmt:launch-done',()=>__ev.push(['done',performance.now()]));`, w, h, wait: 900 });
  /* (19 ت1 · TASK-0106) المشهد صار طريقاً من A إلى B بشاحنةٍ أصغر ثمّ ضباباً بالرسم — لا فيديو */
  const s1 = await pg.evaluate(() => { const o = document.getElementById('gmt-launch'); return { ov: !!o, road: !!(o && o.querySelector('.gr-van')), vid: o ? o.querySelectorAll('video').length : -1, blocks: o ? getComputedStyle(o).pointerEvents : '' }; });
  ok(s1.ov && s1.road && s1.vid === 0, 'طبقة الانطلاق فوق الصفحة: الشاحنة على الطريق (بلا فيديو)');
  ok(s1.blocks === 'auto', 'الطبقة تمنع النقر أثناء الانتقال');
  const key = await pg.evaluate(() => { const e = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }); document.dispatchEvent(e); return e.defaultPrevented; });
  ok(key, 'لوحة المفاتيح ممنوعة أثناء الانتقال');
  await pg.waitForFunction(() => window.__ev.some(e => e[0] === 'cover'), null, { timeout: 9000 }).catch(() => {});
  const cv = await pg.evaluate(() => ({ cov: window.__ev.some(e => e[0] === 'cover'), l1: getComputedStyle(document.getElementById('layer1')).display }));
  ok(cv.cov, 'إشارة التغطية الكاملة gmt:launch-cover أُطلقت');
  ok(cv.l1 === 'none', 'تحت الدخان أُزيلت شاشة الترحيب');
  await pg.waitForFunction(() => window.__ev.some(e => e[0] === 'done'), null, { timeout: 12000 }).catch(() => {});
  const end = await pg.evaluate(() => ({ done: window.__ev.some(e => e[0] === 'done'), left: !!document.getElementById('gmt-launch') || !!document.querySelector('.gr-fog'), input: !!document.getElementById('searchInput').offsetParent, ovf: document.documentElement.scrollWidth - innerWidth }));
  ok(end.done && !end.left, 'تبدّد الدخان وانكشفت الصفحة (لا طبقة باقية)');
  ok(end.input, 'صندوق البحث ظاهر وقابل للاستعمال');
  ok(end.ovf <= 1, 'لا طفح أفقي');
  await pg.fill('#searchInput', '12345').catch(() => {});
  ok(await pg.inputValue('#searchInput').catch(() => '') === '12345', 'الكتابة تعمل بعد الانتقال');
  ok(!errs.length, 'لا أخطاء JS ' + errs.join(' | '));
  await browser.close();
}

async function siteToTrack(w, h) {
  console.log(`— من الموقع إلى التتبّع بانتقال ${w}×${h}`);
  const { browser, pg, errs } = await H.open('site.html', { init: PUB, w, h, wait: 2500 });
  const href = await pg.evaluate(() => { const a = [...document.querySelectorAll('a[href]')].find(a => /track_order\.html/.test(a.getAttribute('href')) && (!a.target || a.target === '_self') && a.offsetParent); if (a) { a.id = '__t'; return a.getAttribute('href'); } return ''; });
  ok(!!href, 'رابط تتبّع ظاهر في الموقع: ' + href);
  /* الفحص الذاتي في الموقع (gmt-selfcheck) يفحص أصولاً ودالّةً في القاعدة الوهمية؛ الانتقال يقطع فحوصه الجارية فيكتب
     «أصول ناقصة (تعذّر)» و400 الدالّة الوهمية — سلوكٌ سابق للفحص الذاتي مع أيّ انتقالٍ سريع (مسار T-033)، لا من الانتقال. */
  const base = errs.length;
  await pg.click('#__t');
  await pg.waitForTimeout(500);
  ok(await pg.evaluate(() => !!document.getElementById('gmt-launch')), 'النقر شغّل طبقة الانطلاق بدل الانتقال الفوري');
  await pg.waitForURL(/track_order\.html/, { timeout: 12000 }).catch(() => {});
  ok(/track_order\.html/.test(pg.url()), 'انتقل إلى صفحة التتبّع عند التغطية');
  const a1 = await pg.evaluate(() => ({ cls: document.documentElement.classList.contains('gmt-arriving') || !!document.querySelector('.gr-fog'), l1: getComputedStyle(document.getElementById('layer1')).display }));
  ok(a1.cls, 'الصفحة الجديدة بدأت مغطّاةً بالدخان');
  ok(a1.l1 === 'none', 'لا ترحيب ثانٍ بعد الانتقال');
  await pg.waitForFunction(() => !document.documentElement.classList.contains('gmt-arriving') && !document.querySelector('.gr-fog'), null, { timeout: 12000 }).catch(() => {});
  ok(await pg.evaluate(() => !document.documentElement.classList.contains('gmt-arriving') && !document.querySelector('.gr-fog')), 'تبدّد الدخان بعد تحميل الصفحة');
  const own = errs.slice(base).filter(e => !/أصول ناقصة: 1 favicon\.ico \(تعذّر\)|status of 400 \(Bad Request\)/.test(e));
  ok(!errs.slice(0, base).length && !own.length, 'لا أخطاء JS من الانتقال ' + own.join(' | '));
  await browser.close();
}

async function homeNoIntro(w, h) {
  console.log(`— فتح النظام بلا انترو الشاحنة ${w}×${h}`);
  const { browser, pg, errs } = await H.open('home.html', { init: H.STAFF_INIT + PUB, w, h, wait: 1500 });
  const s = await pg.evaluate(() => ({ ov: !!document.getElementById('gmt-welcome'), pre: document.documentElement.classList.contains('gw-pre'), vis: getComputedStyle(document.body).visibility, mod: typeof window.GMTWelcome }));
  ok(!s.ov && !s.pre && s.vis === 'visible' && s.mod === 'undefined', 'الرئيسيّة تُفتح مباشرةً كما كانت (لا انترو شاحنة في النظام)');
  ok(!errs.length, 'لا أخطاء JS ' + errs.join(' | '));
  await browser.close();
}

async function trackReceived() {
  console.log('— التتبّع بعد «تم الاستلام» في الأوردرات');
  const rows = await H.call('/rest/v1/gmt_orders', [
    { name: 'زبون استلم', phone: '0933000111', product: 'كاميرا', qty: 1, price: 250, status: 'delivered', branch: 'حلب', address: 'حمص', shipping_company: 'المفتي', tracking_number: '7700112', shipped_at: '2026-10-15T09:00:00Z', delivered_at: '2026-10-17T10:00:00Z' },
    { name: 'زبون بالطريق', phone: '0933000222', product: 'كاميرا', qty: 1, price: 250, status: 'shipped', branch: 'حلب', address: 'حماة', shipping_company: 'المفتي', tracking_number: '7700113', shipped_at: '2026-10-17T09:00:00Z' }]);
  const { browser, pg, errs } = await H.open('track_order.html?o=' + rows[0].id, { init: PUB, w: 390, h: 900, wait: 500 });
  await pg.waitForFunction(() => !document.getElementById('gmt-launch') && getComputedStyle(document.getElementById('layer1')).display === 'none', null, { timeout: 15000 }).catch(() => {});
  async function stage(num) {
    await pg.fill('#searchInput', num); await pg.click('#searchBtn');
    await pg.waitForFunction(n => (document.getElementById('res-tracking') || {}).innerText === n && document.querySelector('#timelineContainer .step-active'), num, { timeout: 15000 }).catch(() => {});
    await pg.waitForTimeout(400);
    return pg.evaluate(() => { const a = document.querySelector('#timelineContainer .step-active'); return a ? a.querySelector('h4').textContent + ' | ' + a.querySelector('p').textContent : ''; });
  }
  const a = await stage('7700112');
  ok(/^تم الاستلام/.test(a), 'أوردر أُكّد استلامه ⇒ «تم الاستلام»: ' + a);
  ok(/بتاريخ/.test(a), 'مع تاريخ الاستلام');
  const b = await stage('7700113');
  ok(/^تم الشحن/.test(b), 'أوردر مشحون لم يُستلم ⇒ «تم الشحن»: ' + b.slice(0, 40));
  /* 400 = فحص gmt-selfcheck لدالّة add_branch_stock في القاعدة الوهمية (لا تنفّذها) — ليس من الصفحة */
  const own = errs.filter(e => !/status of 400 \(Bad Request\)/.test(e));
  ok(!own.length, 'لا أخطاء JS ' + own.join(' | '));
  await browser.close();
}

(async () => {
  await H.seed();
  await trackDirect(390, 844);
  await trackDirect(1366, 768);
  await siteToTrack(390, 844);
  await siteToTrack(1366, 768);
  await homeNoIntro(390, 844);
  await homeNoIntro(1366, 768);
  await trackReceived();
  console.log(fails ? `FAIL=${fails}` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
