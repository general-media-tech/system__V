// (TASK-B0516 · المالك seq 830 «ADVANCED MULTI-WINDOW & MULTI-WORKSPACE SYSTEM» · seq 834 «نفذها»)
// مساحة العمل: تبويبات تبقى حيّة بلا إعادة تحميل · نسختان مستقلّتان من القسم نفسه · تقسيم · نافذة عائمة · غير المحفوظ يُسأل عنه ·
// مركز الأوامر Ctrl+K · مساحات العمل · حفظ التبويبات بعد إعادة التحميل · الصفحة داخل الإطار بلا شريط علويّ ثانٍ.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  for (const W of [1366, 390]) {
    const o = await H.open('workspace.html', { w: W, h: W < 700 ? 844 : 860, mobile: W < 700, wait: 5000, init: H.ADMIN_INIT + ";try{if(!sessionStorage.getItem('t_ws')){localStorage.removeItem('gmt_ws_v1');sessionStorage.setItem('t_ws','1')}}catch(e){}" });
    const pg = o.pg;
    const st = () => pg.evaluate(() => JSON.parse(localStorage.getItem('gmt_ws_v1') || '{}'));
    let s = await st();
    ok(s.tabs && s.tabs.length === 1 && s.tabs[0].url === 'home.html', W + ': تبدأ بتبويب الرئيسية');
    // ١) فتح الأوردرات تبويباً · وضع علامة في نافذتها · التنقّل للرئيسية والعودة ⇒ العلامة باقية (لا إعادة تحميل)
    await pg.evaluate(() => GMTWS.open('orders.html')); await sleep(4500);
    const frameOf = url => pg.frames().find(f => decodeURIComponent(f.url()).includes(url));
    let fo = frameOf('orders.html');
    ok(!!fo, W + ': الأوردرات في إطارٍ داخل مساحة العمل');
    await fo.evaluate(() => { window.__mark = 42; const n = document.getElementById('in-notes'); if (n) n.value = 'مسودّة'; });
    const embed = await fo.evaluate(() => ({ e: document.documentElement.classList.contains('gmt-embed'), bar: !!document.getElementById('gmt-refresh-btn') && document.getElementById('gmt-refresh-btn').getBoundingClientRect().width > 0 }));
    ok(embed.e && !embed.bar, W + ': داخل الإطار بلا شريط علويّ ثانٍ');
    await pg.evaluate(() => document.querySelector('.tab').click()); await sleep(400);
    await pg.evaluate(() => [...document.querySelectorAll('.tab')].find(t => /الأوردرات/.test(t.textContent)).click()); await sleep(400);
    fo = frameOf('orders.html');
    ok(await fo.evaluate(() => window.__mark === 42), W + ': العودة للأوردرات بلا إعادة تحميل — ما كتبته باقٍ');
    // ٢) نسخة ثانية مستقلّة من القسم نفسه
    await pg.evaluate(() => GMTWS.open('orders.html')); await sleep(4000);
    const fos = pg.frames().filter(f => decodeURIComponent(f.url()).includes('orders.html'));
    ok(fos.length === 2 && (await fos[1].evaluate(() => window.__mark)) !== 42, W + ': نسختان من الأوردرات مستقلّتان');
    // ٣) غير المحفوظ: كتابة في نموذج ⇒ نقطة على التبويب وسؤال عند الإغلاق
    await fos[1].evaluate(() => { document.getElementById('addModal').classList.remove('hidden'); const i = document.getElementById('in-name'); i.value = 'زبون'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    await sleep(300);
    ok(await pg.evaluate(() => !!document.querySelector('.tab.on .dirty')), W + ': نقطة «غير محفوظ» على التبويب');
    await pg.evaluate(() => document.querySelector('.tab.on [data-close]').click()); await sleep(500);
    const asked = await pg.evaluate(() => /غير محفوظة/.test((document.querySelector('.gmtask-ov') || {}).innerText || ''));
    ok(asked, W + ': إغلاق صفحة فيها تغييرات ⇒ سؤال قبل الإغلاق');
    await pg.evaluate(() => { const b = [...document.querySelectorAll('.gmtask-ov button')].find(x => !/أغلق/.test(x.textContent)); if (b) b.click(); }); await sleep(400);
    ok((await st()).tabs.length === 3, W + ': «لا» ⇒ بقي التبويب');
    // ٤) التقسيم والنافذة العائمة (الكمبيوتر) · النافذة السفليّة (الهاتف)
    if (W > 700) {
      await pg.evaluate(() => GMTWS.split('inventory.html')); await sleep(4500);
      s = await st();
      ok(s.split && s.split.on, W + ': تقسيم الشاشة: صفحتان جنباً إلى جنب');
      const two = await pg.evaluate(() => [...document.querySelectorAll('.host iframe.on')].length);
      ok(two === 2, W + ': إطاران ظاهران معاً (' + two + ')');
      await pg.evaluate(() => document.querySelector('[data-unsplit]').click()); await sleep(300);
    }
    await pg.evaluate(() => GMTWS.float('sales_log.html')); await sleep(3500);
    const fw = await pg.evaluate(() => { const f = document.querySelector('.fw'); const r = f && f.getBoundingClientRect(); return f ? { w: Math.round(r.width), h: Math.round(r.height), bottom: Math.round(innerHeight - r.bottom) } : null; });
    ok(fw && fw.w > 250, W + ': نافذة عائمة مفتوحة ' + JSON.stringify(fw));
    await pg.evaluate(() => document.querySelector('.fw [data-a="min"]').click()); await sleep(200);
    ok(await pg.evaluate(() => !!document.querySelector('#dock [data-restore]')), W + ': التصغير ينقلها لشريط النوافذ المصغّرة');
    await pg.evaluate(() => document.querySelector('#dock [data-restore]').click()); await sleep(200);
    // ٥) مركز الأوامر Ctrl+K
    await pg.keyboard.press('Control+KeyK'); await sleep(300);
    await pg.keyboard.type('الجرد'); await sleep(300);
    const pal = await pg.evaluate(() => [...document.querySelectorAll('#pr .row b')].map(b => b.textContent).slice(0, 6));
    ok(pal.some(t => /الجرد/.test(t)), W + ': Ctrl+K يبحث في الصفحات والأوامر: ' + pal.join(' · '));
    await pg.keyboard.press('Escape');
    // ٦) الاختصار داخل خانة كتابة لا يُسرق (Ctrl+Z يبقى للخانة)
    // ٧) إعادة التحميل ⇒ التبويبات باقية
    const before = (await st()).tabs.length;
    await pg.reload({ waitUntil: 'domcontentloaded' }); await sleep(4000);
    const after = await pg.evaluate(() => document.querySelectorAll('.tab').length);
    ok(after === before, W + ': بعد إعادة التحميل التبويبات باقية (' + after + ')');
    // ٨) مساحة عمل جاهزة
    await pg.evaluate(() => document.getElementById('b-ws').click()); await sleep(200);
    const wsItems = await pg.evaluate(() => [...document.querySelectorAll('.menu button')].map(b => b.textContent));
    ok(wsItems.some(t => /المبيعات/.test(t)) && wsItems.some(t => /حفظ المفتوح/.test(t)), W + ': مساحات العمل: ' + wsItems.slice(0, 4).join(' · '));
    const real = o.errs.filter(e => !/status of (4\d\d|503)|Failed to load resource|favicon/.test(e));
    ok(!real.length, W + ': لا أخطاء JS ' + real.slice(0, 3).join(' | '));
    await o.browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
