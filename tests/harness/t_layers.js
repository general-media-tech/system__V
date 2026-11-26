// (TASK-B0518 · المالك seq 837) «اطلع واعيفه بالخلفية وارجع ادخل عليه يتم بالرئيسية — وفيه مثل ليرات الفوتوشوب بنتقل بين الادوات —
// برجع بدخل على التطبيق مثلا الجرد وانتقل للاوردر او المتجر وارجع اكمل». الأدوات طبقاتٌ داخل الرئيسيّة.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  for (const W of [390, 1366]) {
    const o = await H.open('home.html', { w: W, h: W < 700 ? 844 : 860, mobile: W < 700, wait: 5000, init: H.ADMIN_INIT + ";try{if(!sessionStorage.getItem('t_l')){localStorage.removeItem('gmt_layers_v1');sessionStorage.setItem('t_l','1')}}catch(e){}" });
    const pg = o.pg;
    const fr = f => pg.frames().find(x => decodeURIComponent(x.url()).split('/').pop().split('?')[0] === f);
    // ١) فتح الجرد من رابطٍ في الرئيسيّة ⇒ طبقة
    await pg.evaluate(() => { const a = document.querySelector('a[data-tool="inventory.html"]:not([data-locked])'); a.click(); });
    await sleep(5000);
    let st = await pg.evaluate(() => ({ act: GMTLayers.active(), on: document.getElementById('gmt-lh').classList.contains('on'), url: location.pathname.split('/').pop() }));
    ok(st.act === 'inventory.html' && st.on && st.url === 'home.html', W + ': الجرد طبقةٌ فوق الرئيسيّة (العنوان باقٍ home.html)');
    const fi = fr('inventory.html'); await fi.evaluate(() => { window.__mark = 7; });
    ok(await fi.evaluate(() => document.documentElement.classList.contains('gmt-embed')), W + ': الطبقة بلا شريطٍ علويّ ثانٍ');
    // ٢) من داخل الجرد رابط للأوردرات ⇒ طبقة ثانية والجرد حيّ
    await fi.evaluate(() => { const a = document.createElement('a'); a.href = 'orders.html'; a.id = 't-go'; a.textContent = 'x'; document.body.appendChild(a); a.click(); });
    await sleep(4500);
    st = await pg.evaluate(() => ({ act: GMTLayers.active(), n: GMTLayers.list().length }));
    ok(st.act === 'orders.html' && st.n === 2, W + ': رابط الأوردرات داخل الجرد فتح طبقة الأوردرات (' + st.n + ' طبقات)');
    // ٣) الرجوع للجرد من الشريط ⇒ كما تركته
    await pg.evaluate(() => document.querySelector('#gmt-ls .lc[data-f="inventory.html"]').click()); await sleep(300);
    ok(await fr('inventory.html').evaluate(() => window.__mark === 7), W + ': العودة للجرد بلا إعادة تحميل — كما تركته');
    // ٤) «الرئيسية» ⇒ الرئيسيّة وفيها «تكمل من حيث توقفت»
    await pg.evaluate(() => document.querySelector('#gmt-ls [data-lh]').click()); await sleep(400);
    st = await pg.evaluate(() => ({ on: document.getElementById('gmt-lh').classList.contains('on'), resume: [...document.querySelectorAll('#gl-resume a')].map(a => a.textContent.trim()) }));
    ok(!st.on && st.resume.length === 2, W + ': الرئيسيّة ظاهرة و«تكمل من حيث توقفت»: ' + st.resume.join(' · '));
    await pg.evaluate(() => document.querySelector('#gl-resume a[data-gl-resume="inventory.html"]').click()); await sleep(300);
    ok(await pg.evaluate(() => GMTLayers.active() === 'inventory.html') && await fr('inventory.html').evaluate(() => window.__mark === 7), W + ': «تكمل» أعاد الجرد كما هو');
    // ٥) الخروج للخلفية ثمّ الرجوع ⇒ الرئيسيّة
    await pg.evaluate(() => {
      const t0 = Date.now(); let off = 0; const real = Date.now; Date.now = () => real() + off;
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis || 'visible' });
      window.__vis = 'hidden'; document.dispatchEvent(new Event('visibilitychange'));
      off = 60000; window.__vis = 'visible'; document.dispatchEvent(new Event('visibilitychange'));
    });
    await sleep(300);
    st = await pg.evaluate(() => ({ act: GMTLayers.active(), n: GMTLayers.list().length }));
    ok(st.act === null && st.n === 2, W + ': الرجوع من الخلفية ⇒ الرئيسيّة والطبقات باقية');
    // ٦) غير المحفوظ ⇒ سؤال قبل الإغلاق
    await pg.evaluate(() => GMTLayers.open('orders.html')); await sleep(400);
    await fr('orders.html').evaluate(() => { document.getElementById('addModal').classList.remove('hidden'); const i = document.getElementById('in-name'); i.value = 'زبون'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    await sleep(200);
    ok(await pg.evaluate(() => !!document.querySelector('#gmt-ls .lc.on .d')), W + ': نقطة «غير محفوظ» على طبقة الأوردرات');
    await pg.evaluate(() => { GMTLayers.close('orders.html'); }); await sleep(500);
    ok(await pg.evaluate(() => /غير محفوظة/.test((document.querySelector('.gmtask-ov') || {}).innerText || '')), W + ': إغلاقها يسأل أوّلاً');
    await pg.evaluate(() => { const b = [...document.querySelectorAll('.gmtask-ov button')].find(x => !/أغلق/.test(x.textContent)); if (b) b.click(); });
    // ٧) زرّ الرجوع ⇒ الرئيسيّة
    await sleep(300); await pg.goBack().catch(() => {}); await sleep(500);
    ok(await pg.evaluate(() => GMTLayers.active() === null && location.pathname.endsWith('home.html')), W + ': زرّ الرجوع ⇒ الرئيسيّة (لا خروج من التطبيق)');
    /* (المالك seq B864 «تشوّه بصري») إعادة فتح التطبيق ⇒ «تكمل» مُنسَّق (لا روابط زرقاء خام) وفي سطرٍ واحد لا يغطّي البطاقة */
    await pg.evaluate(() => { try { GMTLayers.list(); } catch (_) {} }); await pg.reload().catch(() => {}); await sleep(3500);
    st = await pg.evaluate(() => { const r = document.getElementById('gl-resume'), a = r && r.querySelector('a'); if (!a) return null;
      const cr = getComputedStyle(r), ca = getComputedStyle(a), b = r.getBoundingClientRect(), nx = r.nextElementSibling && r.nextElementSibling.getBoundingClientRect();
      return { css: !!document.getElementById('gmt-layers-css'), deco: ca.textDecorationLine, bd: cr.borderTopStyle, h: b.height, overlap: nx ? nx.top < b.bottom - 1 : false }; });
    ok(st && st.css && st.deco === 'none' && st.bd === 'solid' && st.h < 70 && !st.overlap, W + ': بعد إعادة الفتح «تكمل» مُنسَّق وفي سطر: ' + JSON.stringify(st));
    /* (TASK-0379 · المالك C1123) ترتيب الطبقات = آخر استخدام أوّلاً: افتح الجرد ثمّ الأوردرات ثمّ المشتريات ⇐ المشتريات أوّلاً · ارجع للجرد ⇐ الجرد أوّلاً · ويبقى بعد إعادة الفتح */
    await pg.evaluate(() => { GMTLayers.open('inventory.html'); }); await sleep(500);
    await pg.evaluate(() => { GMTLayers.open('orders.html'); }); await sleep(500);
    await pg.evaluate(() => { GMTLayers.open('purchase.html'); }); await sleep(500);
    const ord1 = await pg.evaluate(() => [...document.querySelectorAll('#gmt-ls .lc')].map(c => c.getAttribute('data-f')).join(','));
    await pg.evaluate(() => { GMTLayers.open('inventory.html'); }); await sleep(500);
    const ord2 = await pg.evaluate(() => [...document.querySelectorAll('#gmt-ls .lc')].map(c => c.getAttribute('data-f')).join(','));
    const saved = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('gmt_layers_v1')).L.map(x => x.f).join(','); } catch (_) { return ''; } });
    ok(/^purchase\.html,orders\.html,inventory\.html/.test(ord1) && /^inventory\.html,purchase\.html,orders\.html/.test(ord2) && saved.indexOf('inventory.html') === 0,
       W + ': الشريط بترتيب آخر استخدام (الأحدث أوّلاً) ويُحفظ: ' + ord1 + ' ⇐ ' + ord2 + ' · محفوظ ' + saved);
    const real = o.errs.filter(e => !/status of (4\d\d|503)|Failed to load resource|favicon/.test(e));
    ok(!real.length, W + ': لا أخطاء JS ' + real.slice(0, 3).join(' | '));
    await o.browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
