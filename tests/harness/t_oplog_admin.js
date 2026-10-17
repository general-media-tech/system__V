const H = require('./h.js');
const GUEST = `try{ localStorage.setItem('gmt_whatsnew_seen','999'); localStorage.setItem('gmt_intro_seen_build','x'); localStorage.setItem('gmt_branch','haleb'); }catch(e){} window.print=()=>{}; window.open=()=>null;`;
const ok = (c, m) => console.log((c ? '✔ ' : '✘ ') + m);
(async () => {
  await H.seed();
  const { browser, pg, errs } = await H.open('home.html', { init: GUEST, w: 390, h: 800, wait: 5000 });
  const fill = async (n, p) => { const ins = await pg.$$('.gmtask-ov .gmtask-in'); await ins[0].fill(n); await ins[1].fill(p); };
  await pg.evaluate(() => document.querySelector('[data-act="admin"]').click()); await pg.waitForSelector('.gmtask-ov .gmtask-in');
  await fill('محمد خير', '2003'); await pg.click('.gmtask-ov .gmtask-b.pri'); await pg.waitForTimeout(2500);
  if (await pg.$('.gmtask-ov')) await pg.click('.gmtask-ov .gmtask-b.pri');
  await pg.evaluate(() => GMTRole.revoke());
  // محاولة فاشلة
  pg.evaluate(() => GMTRole.requireAdmin('t')).catch(() => {}); await pg.waitForSelector('.gmtask-ov .gmtask-in');
  await fill('محمد خير', 'غلط'); await pg.click('.gmtask-ov .gmtask-b.pri'); await pg.waitForTimeout(1500);
  await fill('محمد خير', '2003'); await pg.click('.gmtask-ov .gmtask-b.pri'); await pg.waitForTimeout(2500);
  await pg.evaluate(() => GMTOpLog.flush()); await pg.waitForTimeout(800);
  const a = ((await H.call('/__dump', undefined, 'GET')).gmt_audit || []).map(x => x.action + '|' + x.entity_name + '|' + x.actor);
  console.log(a.join('\n'));
  ok(a.some(x => x.startsWith('admin_add|محمد خير (أوّل حساب)')), 'أُسجّل إنشاء أوّل حساب');
  ok(a.filter(x => x.startsWith('admin_login|')).length === 2, 'تسجيلا دخول');
  ok(a.some(x => x.startsWith('admin_login_fail|')), 'محاولة فاشلة');
  ok(a.some(x => x.startsWith('admin_logout|')), 'خروج');
  ok(!JSON.stringify(a).includes('2003'), 'لا كلمة سرّ في السجلّ');
  await browser.close();
})();
