// وثيقة الطلبات ١٢ (تكملة) — صفحة التتبّع: الشاحنة الجديدة في الحالات الحدّية
//   أيقونتا السمّاعة (مكتوم/يعمل) تُرسمان فعلاً · هدف اللمس ≥ 40px · الزرّ يعمل بلوحة المفاتيح
//   ترتيب المصادر MP4 ثم WebM ولا <source> قبل أن يظهر المشهد · الصوت يستمرّ من الترحيب إلى شاشة التحقق
//   بحثٌ ثانٍ يعيد تشغيل مشهد التحقق · شاشات صغيرة (320 · 360 · 768 · هاتف أفقيّ 667×375): لا طفح ولا نصّ مقصوص
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const H = require('./h.js');
const OUT = process.env.OUT_DIR || '/tmp/gmt-out';
try { require('fs').mkdirSync(OUT, { recursive: true }); } catch (_) {}

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗', m); } };

async function openTrack(browser, { w, h, url = 'track_order.html' }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 700, hasTouch: w < 700, serviceWorkers: 'block' });
  const pg = await ctx.newPage(); const errs = []; let known400 = 0;
  pg.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  pg.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
  pg.on('response', r => { if (r.status() === 400 && /\/rpc\/add_branch_stock/.test(r.url())) known400++; });   // سابقٌ للتغيير: نفس السلوك على الإصدار الأساس
  await ctx.route('**/*.supabase.co/**', async route => {
    const u = route.request().url(); const i = u.indexOf('/rest/v1/');
    if (i < 0) return route.fulfill({ status: 200, body: '{}' });
    try { const r = await route.fetch({ url: H.M + u.slice(i) }); await route.fulfill({ response: r }); } catch (e) { try { await route.abort(); } catch (_) {} }
  });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, body: '', headers: { 'Content-Type': 'text/css' } }));
  await ctx.route(/^https:\/\/(?!127)/, r => { const u = r.request().url(); if (/supabase|fonts\./.test(u)) return r.fallback(); r.fulfill({ status: 404, body: '' }); });
  await ctx.addInitScript('window.open=()=>null;');
  await pg.goto(H.BASE + url, { waitUntil: 'domcontentloaded' });
  const real = () => { let k = known400; return errs.filter(e => { if (k > 0 && /status of 400/.test(e)) { k--; return false; } return true; }); };
  return { ctx, pg, real };
}

const st = (pg, id) => pg.evaluate(id => {
  const s = document.getElementById(id), v = s.querySelector('video'), b = s.querySelector('.van-sound');
  const r = s.getBoundingClientRect(), br = b.getBoundingClientRect();
  const srcs = [...v.querySelectorAll('source')].map(x => ({ src: x.getAttribute('src'), type: x.getAttribute('type') }));
  const vis = e => { const q = e.querySelector('svg'); return !!q && getComputedStyle(e).display !== 'none' && q.getBoundingClientRect().width > 0; };
  return {
    w: Math.round(r.width), h: Math.round(r.height), left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom),
    paused: v.paused, muted: v.muted, rs: v.readyState, ns: v.networkState, srcs,
    pressed: b.getAttribute('aria-pressed'), btnW: Math.round(br.width), btnH: Math.round(br.height),
    nosound: b.hasAttribute('data-nosound'), btnTag: b.tagName, btnType: b.getAttribute('type'),
    offSvg: b.querySelectorAll('.vs-off svg').length, onSvg: b.querySelectorAll('.vs-on svg').length,
    offPaths: b.querySelectorAll('.vs-off svg *').length, onPaths: b.querySelectorAll('.vs-on svg *').length,
    offVisible: vis(b.querySelector('.vs-off')), onVisible: vis(b.querySelector('.vs-on')),
  };
}, id);

async function seedOrder() {
  await H.call('/__reset', {});
  await H.call('/rest/v1/gmt_orders', { id: 501, name: 'زبون التتبّع', phone: '0999000111', tracking_number: 'TRK777', status: 'shipped', price: 120, product: 'كاميرا تجربة', shipping_company: 'الفؤاد', address: 'حلب', shipped_at: new Date(Date.now() - 5 * 3600e3).toISOString() });
}

(async () => {
  await seedOrder();
  const browser = await chromium.launch();

  for (const [w, h, tag] of [[390, 800, 'هاتف 390'], [1366, 820, 'كمبيوتر 1366']]) {
    console.log(`\n══ ${tag} — الأيقونات · الهدف · لوحة المفاتيح · الصوت المستمرّ ══`);
    const { ctx, pg, real } = await openTrack(browser, { w, h });
    await pg.waitForTimeout(1500);
    let a = await st(pg, 'van-welcome');
    ok(a.btnTag === 'BUTTON' && a.btnType === 'button' && a.nosound, 'الزرّ <button type=button> وعليه data-nosound (بلا نقرة واجهة فوق صوت الشاحنة)');
    ok(a.offSvg === 1 && a.onSvg === 1 && a.offPaths > 0 && a.onPaths > 0, `الأيقونتان مرسومتان (volume-x:${a.offPaths} · volume-2:${a.onPaths} عنصراً)`);
    ok(a.offVisible && !a.onVisible, 'مكتوم ⇒ تظهر أيقونة «مكتوم» وحدها');
    ok(a.btnW >= 40 && a.btnH >= 40, `هدف اللمس ${a.btnW}×${a.btnH} ≥ 40`);
    ok(a.srcs.length === 2 && /van\.mp4$/.test(a.srcs[0].src) && /^video\/mp4/.test(a.srcs[0].type) && /van\.webm$/.test(a.srcs[1].src) && /^video\/webm/.test(a.srcs[1].type), 'المصادر: MP4 أولاً ثم WebM احتياطاً (آيفون والهواتف تقرأ الأول)');
    let b = await st(pg, 'van-verify');
    ok(b.srcs.length === 0 && b.ns === 0, 'شاشة التحقق: لا <source> ولا تحميل قبل ظهورها');

    await pg.focus('#van-welcome .van-sound');
    await pg.keyboard.press('Enter');
    await pg.waitForTimeout(300);
    a = await st(pg, 'van-welcome');
    ok(a.pressed === 'true' && !a.muted && !a.paused && a.onVisible && !a.offVisible, 'لوحة المفاتيح: Enter يفتح الصوت وتتبدّل الأيقونة');
    await pg.keyboard.press('Space');
    await pg.waitForTimeout(200);
    a = await st(pg, 'van-welcome');
    ok(a.pressed === 'false' && a.muted && !a.paused, 'لوحة المفاتيح: Space يكتمه');
    await pg.click('#van-welcome .van-sound');            // الصوت يبقى مفتوحاً حتى شاشة التحقق
    await pg.waitForTimeout(200);

    await pg.waitForTimeout(3300);                        // انتهاء الترحيب
    await pg.fill('#searchInput', 'TRK777'); await pg.click('#searchBtn');
    await pg.waitForTimeout(1500);
    b = await st(pg, 'van-verify');
    ok(b.srcs.length === 2 && !b.paused && b.rs >= 2, `شاشة التحقق: ظهرت فحُمِّل الفيديو وبدأ (readyState=${b.rs})`);
    ok(b.muted === false && b.pressed === 'true' && b.onVisible, 'الصوت الذي فتحه الزبون في الترحيب يستمرّ في شاشة التحقق');
    ok(b.btnW >= 40 && b.left >= 0 && b.right <= w, `شاشة التحقق: الزرّ ${b.btnW}px والمشهد داخل الشاشة`);
    await pg.waitForTimeout(3800);                        // اختفاء شاشة التحقق ⇒ النتيجة
    b = await st(pg, 'van-verify');
    ok(b.paused && b.muted, 'بعد النتيجة: الفيديو متوقّف ومكتوم');

    // بحثٌ ثانٍ ⇒ يعاد تشغيل المشهد
    await pg.fill('#searchInput', 'TRK777'); await pg.click('#searchBtn');
    await pg.waitForTimeout(1600);
    b = await st(pg, 'van-verify');
    ok(!b.paused && b.rs >= 2 && b.w > 0, 'بحثٌ ثانٍ: مشهد التحقق يعمل من جديد');
    ok(real().length === 0, 'لا أخطاء JS/Console ' + real().join(' | '));
    await ctx.close();
  }

  console.log('\n══ شاشات صغيرة وهاتف أفقيّ — شاشة الترحيب لا تُقصّ ══');
  for (const [w, h, tag] of [[320, 568, 'iPhone SE 320×568'], [360, 640, 'أندرويد 360×640'], [768, 1024, 'تابلت 768×1024'], [667, 375, 'هاتف أفقيّ 667×375'], [844, 390, 'هاتف أفقيّ 844×390']]) {
    const { ctx, pg, real } = await openTrack(browser, { w, h });
    await pg.waitForTimeout(1700);
    const m = await pg.evaluate(() => {
      const q = id => { const r = document.getElementById(id).getBoundingClientRect(); return { t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height) }; };
      const btn = document.querySelector('#van-welcome .van-sound').getBoundingClientRect();
      return { stage: q('van-welcome'), t1: q('l1-text1'), t2: q('l1-text2'), hs: document.documentElement.scrollWidth, iw: innerWidth, ih: innerHeight, btnIn: btn.left >= q('van-welcome').l - 1 && btn.right <= q('van-welcome').r + 1 };
    });
    const inView = r => r.t >= 0 && r.b <= m.ih && r.l >= 0 && r.r <= m.iw;
    ok(inView(m.stage) && inView(m.t1) && inView(m.t2), `${tag}: المشهد والنصّان داخل الشاشة كاملين (مشهد ${m.stage.w}×${m.stage.h} · أسفل النصّ ${m.t2.b}/${m.ih})`);
    ok(m.hs <= m.iw + 1 && m.btnIn, `${tag}: لا طفح أفقي والزرّ داخل المشهد`);
    ok(real().length === 0, `${tag}: لا أخطاء`);
    if (w === 667 || w === 320) await pg.screenshot({ path: `${OUT}/truck_extra_${w}x${h}.png` });
    await ctx.close();
  }

  await browser.close();
  console.log(`\nالنتيجة: ${pass} نجح · ${fail} فشل`);
  process.exit(fail ? 1 : 0);
})();
