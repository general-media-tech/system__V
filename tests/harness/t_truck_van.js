// وثيقة الطلبات ١٢ — شاحنة صفحة التتبّع: صورة المالك + فيديوه (الدواليب · الدخان · الصوت الحقيقي)
// يقود الصفحة الحقيقية track_order.html في Chromium مقابل القاعدة الوهمية، على 390 و1366:
//   شاشة الترحيب: الفيديو يعمل (readyState) مكتوماً · الصورة/الملصق ظاهران · زرّ الصوت داخل المشهد ويعمل
//   شاشة «جارٍ تتبع شحنتكم»: الفيديو لا يُحمَّل قبل ظهورها · يعمل عند ظهورها · يتوقّف عند اختفائها
//   «تقليل الحركة» ⇒ صورة ثابتة ولا طلبَ للفيديو · فيديو لم يصل ⇒ الصورة وحدها بلا زرّ صوت
//   متصفّح يرفض الصوت ⇒ الزرّ يعود «مكتوم» (لا ادّعاء) · لا طفح أفقي · لا أزرار عائمة · لا أخطاء
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const H = require('./h.js');
const OUT = process.env.OUT_DIR || '/tmp/gmt-out';
try { require('fs').mkdirSync(OUT, { recursive: true }); } catch (_) {}

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗', m); } };
const PUBLIC_INIT = `window.open=()=>null;`;   // صفحة زبون: لا جلسة موظّف

async function openTrack(browser, { w, h, url = 'track_order.html', reduced = false, block = false, init = PUBLIC_INIT }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 700, hasTouch: w < 700, serviceWorkers: 'block', reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const pg = await ctx.newPage(); const errs = []; const vidReqs = []; const n404 = [];
  pg.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  pg.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
  pg.on('request', r => { if (/img\/delivery\/van\.(mp4|webm)/.test(r.url())) vidReqs.push(r.url().replace(H.BASE, '')); });
  pg.on('response', r => {
    if (r.status() === 404 && r.url().startsWith(H.BASE)) n404.push(r.url().replace(H.BASE, ''));
    /* سابقٌ لهذا التغيير وخارجه: سكربتات النظام المشتركة تجسّ rpc/add_branch_stock والقاعدة الوهمية تردّ 400
       (يحدث بنفس الشكل على track_order.html في الإصدار الأساس 54b3328) — نُسقط سطرَ المتصفّح الخاصّ به فقط */
    if (r.status() === 400 && /\/rpc\/add_branch_stock/.test(r.url())) errs.known400 = (errs.known400 || 0) + 1;
  });
  await ctx.route('**/*.supabase.co/**', async route => {
    const u = route.request().url(); const i = u.indexOf('/rest/v1/');
    if (i < 0) return route.fulfill({ status: 200, body: '{}' });
    try { const r = await route.fetch({ url: H.M + u.slice(i) }); await route.fulfill({ response: r }); } catch (e) { try { await route.abort(); } catch (_) {} }
  });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, body: '', headers: { 'Content-Type': 'text/css' } }));
  await ctx.route(/^https:\/\/(?!127)/, r => { const u = r.request().url(); if (/supabase|fonts\./.test(u)) return r.fallback(); r.fulfill({ status: 404, body: '' }); });
  if (block) await ctx.route(/img\/delivery\/van\.(mp4|webm)/, r => r.fulfill({ status: 404, body: '' }));
  await ctx.addInitScript(init);
  await pg.goto(H.BASE + url, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs, vidReqs, n404 };
}

/* الأخطاء الحقيقية: كل خطأ JS/Console ما عدا سطر 400 المعروف أعلاه (بعدد مرّات ردّه فقط) */
function realErrors(errs) {
  let k = errs.known400 || 0;
  return errs.filter(e => { if (k > 0 && /status of 400/.test(e)) { k--; return false; } return true; });
}

/* حالة مشهدٍ واحد كما يراها الزبون */
function stageState(pg, id) {
  return pg.evaluate((id) => {
    const st = document.getElementById(id); if (!st) return null;
    const v = st.querySelector('video'); const img = st.querySelector('.van-still'); const b = st.querySelector('.van-sound');
    const r = st.getBoundingClientRect(); const br = b.getBoundingClientRect(); const bs = getComputedStyle(b);
    const vs = getComputedStyle(v);
    return {
      w: Math.round(r.width), h: Math.round(r.height), left: Math.round(r.left), right: Math.round(r.right),
      cls: st.className, src: v.currentSrc.replace(location.origin + '/', ''), rs: v.readyState, ns: v.networkState,
      paused: v.paused, muted: v.muted, t: +v.currentTime.toFixed(2), poster: v.getAttribute('poster'), preload: v.getAttribute('preload'),
      playsinline: v.hasAttribute('playsinline'), loop: v.loop, vOpacity: vs.opacity, vDisplay: vs.display,
      imgOk: img.complete && img.naturalWidth > 0, imgVis: getComputedStyle(img).visibility, imgDisplay: getComputedStyle(img).display,
      btnDisplay: bs.display, btnPos: bs.position, btnPressed: b.getAttribute('aria-pressed'), btnLabel: b.getAttribute('aria-label'),
      btnInside: br.width > 0 && br.left >= r.left - 1 && br.right <= r.right + 1 && br.top >= r.top - 1 && br.bottom <= r.bottom + 1,
      btnW: Math.round(br.width), btnSvg: b.querySelectorAll('svg').length,
    };
  }, id);
}
const pageChecks = pg => pg.evaluate(() => {
  const vis = e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0; };
  const fabs = [...document.querySelectorAll('body *')].filter(e => { const s = getComputedStyle(e); if (s.position !== 'fixed' || !vis(e)) return false; const r = e.getBoundingClientRect(); return r.width <= 90 && r.height <= 90 && r.width >= 28; }).map(e => e.id || e.className);
  return { hscroll: document.documentElement.scrollWidth > innerWidth + 1, sw: document.documentElement.scrollWidth, iw: innerWidth, fabs, oldTruck: !!document.querySelector('svg.truck-img, .truck-img, .smoke-container'), truckEmoji: /🚚/.test((document.getElementById('layer2') || {}).textContent || '') };
});

async function seedOrder() {
  await H.call('/__reset', {});
  await H.call('/rest/v1/gmt_orders', { id: 501, name: 'زبون التتبّع', phone: '0999000111', tracking_number: 'TRK777', status: 'shipped', price: 120, product: 'كاميرا تجربة', shipping_company: 'الفؤاد', address: 'حلب', shipped_at: new Date(Date.now() - 5 * 3600e3).toISOString() });
}

(async () => {
  await seedOrder();
  const browser = await chromium.launch();

  for (const [w, h, tag] of [[390, 800, 'هاتف 390'], [1366, 820, 'كمبيوتر 1366']]) {
    console.log(`\n══ ${tag} — المسار الكامل ══`);
    const { ctx, pg, errs, vidReqs, n404 } = await openTrack(browser, { w, h });
    await pg.waitForTimeout(1700);
    let s = await stageState(pg, 'van-welcome');
    ok(s && s.w > 0 && s.h > 0 && Math.abs(s.w / s.h - 16 / 9) < 0.03, `الترحيب: مشهد الشاحنة ظاهر بنسبة الفيديو (${s && s.w}×${s && s.h})`);
    ok(s.imgOk, 'الترحيب: صورة المالك (van.jpg) محمّلة');
    ok(s.poster === 'img/delivery/van.jpg' && s.preload === 'metadata' && s.playsinline && s.loop, 'الترحيب: poster=van.jpg · preload=metadata · playsinline · loop');
    ok(/img\/delivery\/van\.(mp4|webm)$/.test(s.src), 'الترحيب: الفيديو مربوط بمصدر المالك: ' + s.src);
    ok(s.rs >= 2 && !s.paused, `الترحيب: الفيديو يعمل فعلاً (readyState=${s.rs} · paused=${s.paused} · t=${s.t})`);
    ok(s.muted === true, 'الترحيب: يبدأ مكتوماً (شرط التشغيل التلقائي)');
    ok(/is-playing/.test(s.cls) && +s.vOpacity > 0.9, 'الترحيب: الفيديو ظاهر فوق الصورة (is-playing)');
    ok(s.btnDisplay !== 'none' && s.btnInside && s.btnPos === 'absolute' && s.btnPressed === 'false' && s.btnSvg >= 1, `الترحيب: زرّ الصوت داخل المشهد (لا عائم) بأيقونة · ${s.btnW}px · «${s.btnLabel}»`);
    let pc = await pageChecks(pg);
    ok(!pc.hscroll, `لا طفح أفقي (scrollWidth=${pc.sw} · innerWidth=${pc.iw})`);
    ok(!pc.oldTruck, 'الشاحنة القديمة (SVG/دخان مرسوم) أُزيلت');
    await pg.screenshot({ path: `${OUT}/truck_welcome_${w}.png` });

    // زرّ الصوت: تشغيل الصوت الحقيقي ثم كتمه
    await pg.click('#van-welcome .van-sound');
    await pg.waitForTimeout(300);
    s = await stageState(pg, 'van-welcome');
    ok(s.btnPressed === 'true' && s.muted === false && !s.paused, `الصوت: لمسة السمّاعة تفتح صوت الفيديو (muted=${s.muted} · «${s.btnLabel}»)`);
    await pg.click('#van-welcome .van-sound');
    await pg.waitForTimeout(200);
    s = await stageState(pg, 'van-welcome');
    ok(s.btnPressed === 'false' && s.muted === true && !s.paused, 'الصوت: لمسة ثانية تكتمه والحركة مستمرّة');

    // شاشة التحقق: لا تحميل قبل ظهورها
    let v2 = await stageState(pg, 'van-verify');
    ok(v2.src === '' && v2.ns === 0, `التحقق: فيديو شاشة «جارٍ تتبع شحنتكم» لم يُحمَّل قبل ظهورها (networkState=${v2.ns})`);
    await pg.waitForTimeout(3200);   // انتهاء الترحيب (3.5ث + 0.8ث)
    s = await stageState(pg, 'van-welcome');
    ok(s.paused && s.muted, 'الترحيب: بعد اختفاء الشاشة الفيديو متوقّف ومكتوم');

    // الصوت يُفتح ثم نبحث ⇒ شاشة التحقق تعمل بصوت (المستخدم تفاعل)
    await pg.fill('#searchInput', 'TRK777');
    await pg.click('#searchBtn');
    await pg.waitForTimeout(1600);
    v2 = await stageState(pg, 'van-verify');
    ok(v2.w > 0 && Math.abs(v2.w / v2.h - 16 / 9) < 0.03, `التحقق: المشهد ظاهر (${v2.w}×${v2.h})`);
    ok(/img\/delivery\/van\.(mp4|webm)$/.test(v2.src) && v2.rs >= 2 && !v2.paused && v2.muted, `التحقق: الفيديو يعمل عند الظهور مكتوماً (readyState=${v2.rs})`);
    ok(/is-playing/.test(v2.cls), 'التحقق: الفيديو ظاهر فوق الصورة');
    ok(v2.btnInside && v2.btnPos === 'absolute' && v2.btnDisplay !== 'none', 'التحقق: زرّ الصوت داخل المشهد');
    ok(v2.left >= 0 && v2.right <= w, `التحقق: المشهد داخل عرض الشاشة (${v2.left}..${v2.right})`);
    pc = await pageChecks(pg);
    ok(!pc.hscroll && pc.fabs.length === 0, `التحقق: لا طفح أفقي ولا أزرار عائمة (${pc.fabs.join(',')})`);
    ok(!pc.truckEmoji, 'التحقق: رمز 🚚 القديم أُزيل');
    await pg.screenshot({ path: `${OUT}/truck_verify_${w}.png` });
    await pg.click('#van-verify .van-sound');
    await pg.waitForTimeout(250);
    v2 = await stageState(pg, 'van-verify');
    ok(v2.btnPressed === 'true' && v2.muted === false && !v2.paused, 'التحقق: زرّ الصوت يفتح الصوت الحقيقي');
    const welcomeMuted = (await stageState(pg, 'van-welcome')).muted;
    ok(welcomeMuted === true, 'صوتٌ واحد فقط: فيديو الترحيب (المخفي) يبقى مكتوماً');
    await pg.waitForTimeout(3600);   // 4ث ثم 0.5ث اختفاء
    v2 = await stageState(pg, 'van-verify');
    const res = await pg.evaluate(() => !document.getElementById('resultCard').classList.contains('hidden'));
    ok(res && v2.paused && v2.muted, 'التحقق: بعد ظهور النتيجة الفيديو متوقّف ومكتوم — لا صوت من شاشة مخفيّة');
    const uniq = [...new Set(vidReqs)];
    ok(uniq.length >= 1 && uniq.every(u => /img\/delivery\/van\.(mp4|webm)/.test(u)), 'الطلبات: ملفّات الفيديو من مجلّد الأصول فقط: ' + uniq.join(' · '));
    ok(n404.length === 0, '404: لا ملفّات مفقودة ' + n404.join(','));
    { const re = realErrors(errs); ok(re.length === 0, 'لا أخطاء JS/Console ' + re.join(' | ') + (errs.known400 ? ' (أُسقط سطر 400 السابق لـrpc/add_branch_stock)' : '')); }
    await ctx.close();
  }

  console.log('\n══ تقليل الحركة (390) ══');
  {
    const { ctx, pg, errs, vidReqs } = await openTrack(browser, { w: 390, h: 800, reduced: true });
    await pg.waitForTimeout(1500);
    const s = await stageState(pg, 'van-welcome');
    ok(s.imgOk && s.imgDisplay !== 'none' && s.imgVis === 'visible', 'الصورة الثابتة ظاهرة');
    ok(s.vDisplay === 'none' && s.btnDisplay === 'none' && s.src === '', 'لا فيديو ولا زرّ صوت');
    const anim = await pg.evaluate(() => getComputedStyle(document.querySelector('#van-welcome .van-still')).animationName);
    ok(anim === 'none', 'الصورة بلا حركة (animation=none)');
    await pg.waitForTimeout(3300);
    await pg.fill('#searchInput', 'TRK777'); await pg.click('#searchBtn'); await pg.waitForTimeout(1200);
    const v2 = await stageState(pg, 'van-verify');
    ok(v2.imgOk && v2.src === '' && /van-novideo/.test(v2.cls), 'شاشة التحقق: صورة ثابتة أيضاً');
    ok(vidReqs.length === 0, 'لم يُطلب ملفّ الفيديو أصلاً (' + vidReqs.length + ')');
    { const re = realErrors(errs); ok(re.length === 0, 'لا أخطاء ' + re.join(' | ')); }
    await pg.screenshot({ path: `${OUT}/truck_reduced_390.png` });
    await ctx.close();
  }

  console.log('\n══ فيديو لم يصل (404) — 1366 ══');
  {
    const { ctx, pg, errs } = await openTrack(browser, { w: 1366, h: 820, block: true });
    await pg.waitForTimeout(1800);
    const s = await stageState(pg, 'van-welcome');
    ok(/van-novideo/.test(s.cls) && s.btnDisplay === 'none' && s.vDisplay === 'none', 'تبقى الصورة وحدها ويختفي زرّ الصوت');
    ok(s.imgOk && s.imgVis === 'visible', 'صورة المالك ظاهرة (تمشي على الطريق)');
    const anim = await pg.evaluate(() => getComputedStyle(document.querySelector('#van-welcome .van-still')).animationName);
    ok(anim === 'truckMove', 'حركة «تمشي على الطريق» القديمة باقية للصورة (' + anim + ')');
    const real = realErrors(errs).filter(e => !/status of 404/.test(e));
    ok(real.length === 0, 'لا أخطاء JS (سوى سطر المتصفّح عن الملف المفقود) ' + real.join(' | '));
    await ctx.close();
  }

  console.log('\n══ متصفّح يرفض الصوت — 390 ══');
  {
    const init = PUBLIC_INIT + `(() => { const P = HTMLMediaElement.prototype, orig = P.play;
      P.play = function () { if (!this.muted) return Promise.reject(new DOMException('no sound', 'NotAllowedError')); return orig.call(this); }; })();`;
    const { ctx, pg, errs } = await openTrack(browser, { w: 390, h: 800, init });
    await pg.waitForTimeout(1500);
    await pg.click('#van-welcome .van-sound');
    await pg.waitForTimeout(400);
    const s = await stageState(pg, 'van-welcome');
    ok(s.btnPressed === 'false' && s.muted === true && !s.paused, 'لا ادّعاء: الزرّ يعود «مكتوم» والفيديو يكمل بلا صوت');
    { const re = realErrors(errs); ok(re.length === 0, 'لا أخطاء ' + re.join(' | ')); }
    await ctx.close();
  }

  console.log('\n══ رابط المتجر ?o= (بحث تلقائي فوق شاشة الترحيب) — 390 ══');
  {
    const { ctx, pg, errs } = await openTrack(browser, { w: 390, h: 800, url: 'track_order.html?o=TRK777' });
    await pg.waitForTimeout(1500);
    const a = await stageState(pg, 'van-welcome'); const b = await stageState(pg, 'van-verify');
    ok(!a.paused && !b.paused && a.muted && b.muted, 'المشهدان يعملان مكتومَين معاً دون تعارض');
    await pg.waitForTimeout(4000);
    const a2 = await stageState(pg, 'van-welcome'); const b2 = await stageState(pg, 'van-verify');
    ok(a2.paused && b2.paused, 'بعد انتهاء الشاشتين: كلاهما متوقّف');
    { const re = realErrors(errs); ok(re.length === 0, 'لا أخطاء ' + re.join(' | ')); }
    await ctx.close();
  }

  await browser.close();
  console.log(`\nالنتيجة: ${pass} نجح · ${fail} فشل`);
  process.exit(fail ? 1 : 0);
})();
