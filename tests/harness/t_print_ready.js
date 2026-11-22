// (TASK-A0579 · المالك seq 977) «الصور عم تطوّل أثناء الطباعة وأحياناً ما تظهر الفاتورة كاملة» — GMTPrintWhenReady
//  ① لا طباعة قبل تحميل الصور (صورة بطيئة 2.5ث) ② الصورة ⇐ نسختها الخفيفة img/t ③ لا نسخة خفيفة ⇒ الأصل ④ «كسولة» تُحمَّل
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const { browser, pg, ctx } = await H.open('center.html', { init: H.ADMIN_INIT.replace('window.open=()=>null;', ''), w: 1000, mobile: false, wait: 4000 });
  await ctx.route('**/img/t/catalog/f88a9047-1532-41f7-96ee-29dacae1ff3d/07c75432802b.webp', async r => { await new Promise(z => setTimeout(z, 2500)); r.continue(); });
  const t0 = Date.now();
  const res = await pg.evaluate(() => new Promise(res => {
    /* إطارٌ مخفيّ كطباعة فاتورة الشراء والأوردرات (نافذة window.open('') لا تحمّل صورها في المتصفّح الآليّ أصلاً) */
    const fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;left:-9999px;top:0;width:800px;height:1000px'; document.body.appendChild(fr);
    const w = fr.contentWindow;
    w.document.open(); w.document.write('<!doctype html><html><body><h1>فاتورة</h1>' +
      '<img id="a" loading="lazy" style="margin-top:3000px" src="/img/p/catalog/f88a9047-1532-41f7-96ee-29dacae1ff3d/07c75432802b.jpg">' +
      '<img id="b" src="/img/p/catalog/no-such-a0579/x.jpg"></body></html>');
    w.document.close();
    const s = Date.now();
    GMTPrintWhenReady(w, () => { const a = w.document.getElementById('a'), b = w.document.getElementById('b');
      res({ ms: Date.now() - s, aDone: a.complete && a.naturalWidth > 0, aSrc: a.src, bSrc: b.src, lazy: a.getAttribute('loading') }); });
  }));
  ok(res.ms >= 2400 && res.aDone, '① انتظرت الطباعة تحميل الصورة البطيئة (' + res.ms + 'ms) — كانت تُطبع بعد 320ms–1.2ث');
  ok(/\/img\/t\/catalog\/.*\.webp$/.test(res.aSrc), '② الصورة بنسختها الخفيفة: ' + res.aSrc.replace(/.*\/img\//, 'img/'));
  ok(/\/img\/p\/catalog\/no-such-a0579\/x\.jpg$/.test(res.bSrc), '③ لا نسخة خفيفة ⇒ عادت للأصل');
  ok(res.lazy !== 'lazy', '④ «التحميل الكسول» أُلغي في نافذة الطباعة');
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
