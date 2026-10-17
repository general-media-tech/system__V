const H = require('./h.js');
const OUT = '/tmp/gmt-out/';
(async () => {
  await H.seed();
  // جهازٌ جديد تماماً (يُمسح التخزين مرّة واحدة فقط، لا عند كل تحميل)
  const NEW = `try{ if(!sessionStorage.getItem('__t')){ localStorage.clear(); sessionStorage.setItem('__t','1'); } }catch(e){} window.print=()=>{};`;
  const { browser, pg, errs } = await H.open('home.html', { init: NEW, w: 390, h: 800, wait: 3500 });
  const a = await pg.evaluate(() => ({ intro: !!document.getElementById('gmt-intro'), running: window.GMTIntro && GMTIntro.running && GMTIntro.running(), seen: localStorage.getItem('gmt_intro_seen_build') }));
  console.log('بعد ٣٫٥ث على جهاز جديد:', JSON.stringify(a));
  await pg.screenshot({ path: OUT + 'intro_first.png' });
  // أنهِ الانترو (تخطٍّ برمجيّ للاختبار فقط) وتحقّق من ظهور الدخول وعدم تكراره
  await pg.evaluate(() => { try { GMTIntro.close ? GMTIntro.close() : GMTIntro.skip && GMTIntro.skip(); } catch (e) {} });
  await pg.waitForTimeout(1500);
  const b = await pg.evaluate(() => ({ intro: !!document.getElementById('gmt-intro'), login: /تسجيل الدخول/.test(document.body.innerText), seen: localStorage.getItem('gmt_intro_seen_build') }));
  console.log('بعد الإغلاق:', JSON.stringify(b));
  // إعادة التحميل: لا انترو ثانٍ، الدخول مباشرة
  await pg.reload({ waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(3000);
  const c = await pg.evaluate(() => ({ intro: !!document.getElementById('gmt-intro'), login: /تسجيل الدخول/.test(document.body.innerText) }));
  console.log('بعد إعادة التحميل:', JSON.stringify(c));
  console.log('errors:', errs.filter(e => !/404|400|Failed/.test(e)).slice(0, 3));
  await browser.close();
})();
