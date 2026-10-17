const H = require('./h.js');
const OUT = __dirname + '/';
const INIT = `try{ localStorage.setItem('gmt_whatsnew_seen','999'); localStorage.setItem('gmt_intro_seen_build','x'); localStorage.setItem('gmt_branch','haleb');
 }catch(e){} window.print=()=>{}; window.open=()=>null;`;
const ok = (c, m) => console.log((c ? '✔ ' : '✘ ') + m);
(async () => {
  await H.seed();
  // حساب أول مبذور عبر دالّة الصفحة نفسها
  const { browser, pg, errs } = await H.open('الأمان_والمستخدمون.html', { init: INIT, w: 390, h: 900, wait: 4500 });
  // الصفحة مقفولة لغير الأدمن ⇒ «دخول الإدارة» من القفل: أوّل حساب
  await pg.waitForSelector('[data-lk="admin"]', { timeout: 8000 });
  await pg.screenshot({ path: OUT + 'adm_lock.png' });
  await pg.click('[data-lk="admin"]'); await pg.waitForSelector('.gmtask-ov .gmtask-in');
  let ins = await pg.$$('.gmtask-ov .gmtask-in'); await ins[0].fill('محمد خير'); await ins[1].fill('2003');
  await pg.click('.gmtask-ov .gmtask-b.pri'); await pg.waitForTimeout(2500);
  if (await pg.$('.gmtask-ov')) await pg.click('.gmtask-ov .gmtask-b.pri');
  await pg.waitForTimeout(800);
  ok(await pg.evaluate(() => !document.documentElement.classList.contains('gmt-locked')), 'القفل رُفع بعد الدخول باسمٍ وكلمة سرّ');
  await pg.fill('#gate-pw', '2003'); await pg.click('#gate .btn'); await pg.waitForTimeout(2000);
  let txt = await pg.evaluate(() => document.getElementById('ad-list').textContent);
  ok(/محمد خير/.test(txt) && /أنت/.test(txt), 'القائمة بعد الإنشاء: ' + txt.replace(/\s+/g, ' ').slice(0, 90));
  ok(await pg.evaluate(() => getComputedStyle(document.getElementById('ad-add-row')).display !== 'none'), 'نموذج الإضافة ظاهر للأدمن');
  // إضافة أدمن ثانٍ
  await pg.fill('#ad-name', 'سامر الأدمن'); await pg.fill('#ad-pw', 'abc12345'); await pg.click('#ad-add-row .btn'); await pg.waitForTimeout(2500);
  txt = await pg.evaluate(() => document.getElementById('ad-list').textContent);
  ok(/سامر الأدمن/.test(txt), 'أُضيف الأدمن الثاني: ' + (await pg.evaluate(() => document.getElementById('ad-msg').textContent)));
  // مكرّر
  await pg.fill('#ad-name', 'سامر  الأدمن'); await pg.fill('#ad-pw', 'abc12345'); await pg.click('#ad-add-row .btn'); await pg.waitForTimeout(1500);
  ok(/موجود/.test(await pg.evaluate(() => document.getElementById('ad-msg').textContent)), 'الاسم المكرّر مرفوض');
  // كلمة قصيرة
  await pg.fill('#ad-name', 'ثالث'); await pg.fill('#ad-pw', '12'); await pg.click('#ad-add-row .btn'); await pg.waitForTimeout(1200);
  ok(/قصيرة/.test(await pg.evaluate(() => document.getElementById('ad-msg').textContent)), 'كلمة سرّ قصيرة جداً مرفوضة');
  await pg.screenshot({ path: OUT + 'adm_card.png', fullPage: false });
  // تغيير كلمة سرّ سامر
  await pg.click('[data-adpw="سامر الأدمن"]'); await pg.waitForSelector('.gmtask-ov .gmtask-in');
  await pg.fill('.gmtask-ov .gmtask-in', 'newpass999'); await pg.click('.gmtask-ov .gmtask-b.pri'); await pg.waitForTimeout(2200);
  ok(/غُيّرت/.test(await pg.evaluate(() => document.getElementById('ad-msg').textContent)), 'تغيير كلمة السرّ: ' + (await pg.evaluate(() => document.getElementById('ad-msg').textContent)));
  const chk = await pg.evaluate(async () => ({ old: (await GMTAuth.admin.tryLogin('سامر الأدمن', 'abc12345')).ok, neu: (await GMTAuth.admin.tryLogin('سامر الأدمن', 'newpass999')).ok }));
  ok(!chk.old && chk.neu, 'القديمة لا تعمل والجديدة تعمل: ' + JSON.stringify(chk));
  // لا حذف للنفس
  ok(!(await pg.$('[data-addel="محمد خير"]')), 'لا زرّ حذف لحسابي');
  const selfErr = await pg.evaluate(async () => { try { await GMTAuth.admin.remove('محمد خير'); return 'حُذف!'; } catch (e) { return e.message; } });
  ok(/لا تحذف حسابك/.test(selfErr), 'حذف النفس مرفوض برمجياً: ' + selfErr);
  // حذف سامر
  await pg.click('[data-addel="سامر الأدمن"]'); await pg.waitForSelector('.gmtask-ov .gmtask-b.pri'); await pg.click('.gmtask-ov .gmtask-b.pri'); await pg.waitForTimeout(2200);
  txt = await pg.evaluate(() => document.getElementById('ad-list').textContent);
  ok(!/سامر الأدمن/.test(txt), 'حُذف سامر: ' + (await pg.evaluate(() => document.getElementById('ad-msg').textContent)));
  // آخر حساب لا يُحذف (حتى من حساب آخر افتراضياً)
  const last = await pg.evaluate(async () => { sessionStorage.setItem('gmt_admin_name', 'غيري'); try { await GMTAuth.admin.remove('محمد خير'); return 'حُذف!'; } catch (e) { return e.message; } });
  ok(/آخر حساب/.test(last), 'آخر حساب لا يُحذف: ' + last);
  // غير أدمن لا يستطيع الإدارة
  const non = await pg.evaluate(async () => { sessionStorage.removeItem('gmt_admin_mode'); try { await GMTAuth.admin.add('x', 'abcd1234'); return 'أُضيف!'; } catch (e) { return e.message; } });
  ok(/للأدمن وحده/.test(non), 'غير الأدمن لا يضيف: ' + non);
  console.log('errors:', errs.filter(e => !/404|400|Failed|favicon/.test(e)).slice(0, 4));
  await browser.close();
})();
