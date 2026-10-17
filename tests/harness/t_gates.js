const H = require('./h.js');
const ok = (c, m) => console.log((c ? '✔ ' : '✘ ') + m);
const GUEST = `try{ localStorage.setItem('gmt_whatsnew_seen','999'); localStorage.setItem('gmt_intro_seen_build','x'); localStorage.setItem('gmt_branch','haleb'); }catch(e){} window.print=()=>{};`;
const vis = (pg, sel) => pg.evaluate(s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return r.width > 0 && r.height > 0 && c.display !== 'none' && !e.hidden; }, sel);
const fill = async (pg, n, p) => { const ins = await pg.$$('.gmtask-ov .gmtask-in'); await ins[0].fill(n); await ins[1].fill(p); };
(async () => {
  await H.seed();
  const STAFF = `try{ localStorage.setItem('gmt_whatsnew_seen','999'); localStorage.setItem('gmt_intro_seen_build','x'); localStorage.setItem('gmt_session', JSON.stringify({id:2,username:'samer',display_name:'سامر',branch_key:'daraa',branch_name:'درعا'})); localStorage.setItem('gmt_branch','daraa'); }catch(e){} window.print=()=>{};`;
  // ١) موظّف يفتح «الأدمن الكلي»: قفل الصلاحية (حساب باسم) ثم القفل الداخلي بلا كلمة سيادية ثانية
  let { browser, pg, errs } = await H.open('admin_sovereign.html', { init: STAFF, w: 1280, h: 800, wait: 2500, mobile: false });
  ok(await vis(pg, '[data-lk="admin"]'), 'قفل الصلاحية الخارجي ظاهر لموظف');
  ok(!(await pg.$('#lockPass')), 'لا حقل كلمة سرّ سيادية داخل الصفحة بعد الآن');
  await pg.click('[data-lk="admin"]'); await pg.waitForSelector('.gmtask-ov .gmtask-in', { timeout: 5000 });
  await fill(pg, 'محمد خير', 'خطأ-خطأ'); await pg.click('.gmtask-ov .gmtask-b.pri'); await pg.waitForTimeout(1500);
  ok(!(await vis(pg, '#content')), 'كلمة خاطئة ⇒ لا دخول');
  await fill(pg, 'محمد خير', '2003'); await pg.click('.gmtask-ov .gmtask-b.pri'); await pg.waitForTimeout(2500);
  if (await pg.$('.gmtask-ov')) await pg.click('.gmtask-ov .gmtask-b.pri');
  await pg.waitForTimeout(800);
  ok(await vis(pg, '#lock'), 'بعد القفل الخارجي: القفل الداخلي ظاهر');
  await pg.click('.lock-btn'); await pg.waitForTimeout(800);
  ok(await vis(pg, '#content') && !(await vis(pg, '#lock')) && !(await pg.$('.gmtask-ov')), 'زرّ «دخول الإدارة» الداخلي يفتح فوراً بلا سؤال ثانٍ (الجلسة أدمن)');
  ok(await pg.evaluate(() => GMTRole.name()) === 'محمد خير', 'الاسم في الجلسة: محمد خير');
  // القفل مرة أخرى ثم الدخول
  await pg.evaluate(() => lockAgain()); await pg.waitForTimeout(300);
  ok(await vis(pg, '#lock') && !(await vis(pg, '#content')), 'lockAgain يقفل');
  console.log('errs', errs.filter(e => !/404|400|Failed|favicon/.test(e)));
  await browser.close();
  // ٢) غير أدمن يضغط الزرّ الداخلي (لو وصل إليه): تُطلب نافذة اسم+كلمة، والسيادية باسمٍ آخر لا تفتح
  ({ browser, pg, errs } = await H.open('admin_sovereign.html', { init: STAFF + `try{sessionStorage.setItem('gmt_admin_mode','1')}catch(e){}`, w: 1280, h: 800, wait: 2500, mobile: false }));
  await pg.evaluate(() => { sessionStorage.removeItem('gmt_admin_mode'); lockAgain(); });
  await pg.click('.lock-btn'); await pg.waitForSelector('.gmtask-ov .gmtask-in', { timeout: 5000 });
  await fill(pg, 'دخيل', '2003'); await pg.click('.gmtask-ov .gmtask-b.pri'); await pg.waitForTimeout(1800);
  ok(!(await vis(pg, '#content')) && !!(await pg.$('.gmtask-ov')), 'بوجود حساب: «دخيل»+السيادية مرفوض والنافذة مفتوحة');
  await pg.click('.gmtask-ov .gmtask-b:not(.pri)'); await pg.waitForTimeout(600);
  ok(/لم يتمّ الدخول/.test(await pg.evaluate(() => document.getElementById('lockErr').textContent)) && await vis(pg, '#lockErr'), 'الإلغاء يُظهر رسالة الإرشاد');
  await browser.close();
  // ٣) العروض والتسعير (الباب الداخلي للصفحة)
  ({ browser, pg, errs } = await H.open('العروض_والتسعير.html', { init: STAFF, w: 390, h: 800, wait: 2500 }));
  ok(await pg.evaluate(() => !document.getElementById('gate').hidden && document.getElementById('app').hidden), 'العروض: البوّابة الداخلية قائمة بلا جلسة أدمن');
  await pg.evaluate(() => document.getElementById('open').click()); await pg.waitForSelector('.gmtask-ov .gmtask-in', { timeout: 5000 });
  ok((await pg.$$('.gmtask-ov .gmtask-in')).length === 2, 'تطلب اسماً وكلمة سرّ (لا كلمة سيادية وحدها)');
  await fill(pg, 'دخيل', '2003'); await pg.click('.gmtask-ov .gmtask-b.pri'); await pg.waitForTimeout(1800);
  ok(await pg.evaluate(() => document.getElementById('app').hidden), 'دخيل مرفوض');
  await pg.click('.gmtask-ov .gmtask-b:not(.pri)'); await pg.waitForTimeout(400);
  await pg.evaluate(() => document.getElementById('open').click()); await pg.waitForSelector('.gmtask-ov .gmtask-in'); await fill(pg, 'محمد خير', '2003'); await pg.click('.gmtask-ov .gmtask-b.pri'); await pg.waitForTimeout(2200);
  ok(await pg.evaluate(() => !document.getElementById('app').hidden), 'الأدمن المسمّى يدخل');
  console.log('errs', errs.filter(e => !/404|400|Failed|favicon/.test(e)));
  await browser.close();
  // ٤) جلسة أدمن قائمة تفتح العروض مباشرة
  ({ browser, pg, errs } = await H.open('العروض_والتسعير.html', { init: STAFF + `try{sessionStorage.setItem('gmt_admin_mode','1');sessionStorage.setItem('gmt_admin_name','محمد خير')}catch(e){}`, w: 390, h: 800, wait: 2500 }));
  ok(await pg.evaluate(() => !document.getElementById('app').hidden && document.getElementById('gate').hidden), 'جلسة أدمن قائمة ⇒ العروض تفتح مباشرة');
  await browser.close();
})();
