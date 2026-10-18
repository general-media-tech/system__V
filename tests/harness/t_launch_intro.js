// اختبار (١٨ ت1): انطلاق الشاحنة والانتقال إلى التتبّع (gmt-launch.js) · انترو افتتاح النظام (gmt-welcome.js) · «تم الاستلام» في التتبّع
const H = require('./h.js');
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fails++; };
const PUB = `try{ localStorage.setItem('gmt_sound','off'); }catch(e){}`;

async function trackDirect(w, h) {
  console.log(`— فتح التتبّع مباشرةً (رابط خارجي) ${w}×${h}`);
  const { browser, pg, errs } = await H.open('track_order.html', { init: PUB + `window.__ev=[];document.addEventListener('gmt:launch-cover',()=>__ev.push(['cover',performance.now()]));document.addEventListener('gmt:launch-done',()=>__ev.push(['done',performance.now()]));`, w, h, wait: 900 });
  const s1 = await pg.evaluate(() => { const o = document.getElementById('gmt-launch'); const v = o && o.querySelector('video'); return { ov: !!o, src: v ? v.currentSrc || v.src : '', blocks: o ? getComputedStyle(o).pointerEvents : '' }; });
  ok(s1.ov && /launch-[lp]\.(mp4|webm)/.test(s1.src), 'طبقة الفيديو فوق الصفحة: ' + s1.src.split('/').pop());
  ok(s1.blocks === 'auto', 'الطبقة تمنع النقر أثناء الانتقال');
  const key = await pg.evaluate(() => { const e = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }); document.dispatchEvent(e); return e.defaultPrevented; });
  ok(key, 'لوحة المفاتيح ممنوعة أثناء الانتقال');
  await pg.waitForFunction(() => window.__ev.some(e => e[0] === 'cover'), null, { timeout: 9000 }).catch(() => {});
  const cv = await pg.evaluate(() => ({ cov: window.__ev.some(e => e[0] === 'cover'), l1: getComputedStyle(document.getElementById('layer1')).display }));
  ok(cv.cov, 'إشارة التغطية الكاملة gmt:launch-cover أُطلقت');
  ok(cv.l1 === 'none', 'تحت الدخان أُزيلت شاشة الترحيب');
  await pg.waitForFunction(() => window.__ev.some(e => e[0] === 'done'), null, { timeout: 12000 }).catch(() => {});
  const end = await pg.evaluate(() => ({ done: window.__ev.some(e => e[0] === 'done'), left: !!document.getElementById('gmt-launch') || !!document.querySelector('.gmt-launch-dis,.gmt-launch-fade'), input: !!document.getElementById('searchInput').offsetParent, ovf: document.documentElement.scrollWidth - innerWidth }));
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
  const a1 = await pg.evaluate(() => ({ cls: document.documentElement.classList.contains('gmt-arriving') || !!document.querySelector('.gmt-launch-dis,.gmt-launch-fade'), l1: getComputedStyle(document.getElementById('layer1')).display }));
  ok(a1.cls, 'الصفحة الجديدة بدأت مغطّاةً بالدخان');
  ok(a1.l1 === 'none', 'لا ترحيب ثانٍ بعد الانتقال');
  await pg.waitForFunction(() => !document.documentElement.classList.contains('gmt-arriving') && !document.querySelector('.gmt-launch-dis,.gmt-launch-fade'), null, { timeout: 12000 }).catch(() => {});
  ok(await pg.evaluate(() => !document.documentElement.classList.contains('gmt-arriving') && !document.querySelector('.gmt-launch-dis,.gmt-launch-fade')), 'تبدّد الدخان بعد تحميل الصفحة');
  const own = errs.slice(base).filter(e => !/أصول ناقصة: 1 favicon\.ico \(تعذّر\)|status of 400 \(Bad Request\)/.test(e));
  ok(!errs.slice(0, base).length && !own.length, 'لا أخطاء JS من الانتقال ' + own.join(' | '));
  await browser.close();
}

async function homeWelcome(w, h) {
  console.log(`— انترو افتتاح النظام ${w}×${h}`);
  const { browser, pg, errs } = await H.open('home.html', { init: H.STAFF_INIT + PUB, w, h, wait: 300 });
  const s = await pg.evaluate(() => { const g = document.getElementById('gmt-welcome'); return { on: !!g, h2: g ? g.querySelector('h2').textContent : '', sub: g ? g.querySelector('.gw-sub').textContent : '', vid: !!(g && g.querySelector('video')) }; });
  ok(s.on, 'الانترو ظاهر عند فتح النظام');
  ok(s.h2 === 'أهلاً بك، سامر', 'الترحيب باسم الجلسة الحقيقي: ' + s.h2);
  ok(/جارٍ تجهيز النظام، يرجى الانتظار/.test(s.sub), 'نصّ «جارٍ تجهيز النظام…»');
  ok(s.vid, 'فيديو الشاحنة طبقةً في الانترو');
  const hidden = await pg.evaluate(() => { const g = document.getElementById('gmt-welcome'); const r = g.getBoundingClientRect(); return r.width >= innerWidth - 1 && r.height >= innerHeight - 1 && getComputedStyle(g).zIndex > 1000; });
  ok(hidden, 'الانترو يغطّي النظام كلّه حتى يجهز');
  const widths = [];
  for (let i = 0; i < 30; i++) {
    const v = await pg.evaluate(() => { const b = document.querySelector('#gmt-welcome .gw-bar'); return b ? Number(b.getAttribute('aria-valuenow')) : -1; });
    widths.push(v); if (v < 0) break; await pg.waitForTimeout(150);
  }
  const seen = widths.filter(x => x >= 0);
  ok(seen.every((x, i) => i === 0 || x >= seen[i - 1]), 'الشريط لا يتراجع: ' + seen.join(','));
  await pg.waitForFunction(() => !document.getElementById('gmt-welcome'), null, { timeout: 15000 }).catch(() => {});
  ok(await pg.evaluate(() => !document.getElementById('gmt-welcome')), 'اختفى الانترو حين جهز النظام');
  ok(await pg.evaluate(() => !document.documentElement.classList.contains('gw-pre') && getComputedStyle(document.body).visibility === 'visible'), 'الرئيسيّة ظاهرة بعده');
  ok(await pg.evaluate(() => sessionStorage.getItem('gmt_welcome_shown') === '1'), 'سُجّل «رُئي» لهذه الجلسة');
  await pg.reload({ waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(800);
  ok(await pg.evaluate(() => !document.getElementById('gmt-welcome')), 'لا يتكرّر عند إعادة التحميل في الجلسة نفسها');
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
  await homeWelcome(390, 844);
  await homeWelcome(1366, 768);
  await trackReceived();
  console.log(fails ? `FAIL=${fails}` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
