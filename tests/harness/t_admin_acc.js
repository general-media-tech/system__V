const H = require('./h.js');
const OUT = __dirname + '/';
const GUEST = `try{ localStorage.setItem('gmt_whatsnew_seen','999'); localStorage.setItem('gmt_intro_seen_build','x'); localStorage.setItem('gmt_branch','haleb'); }catch(e){} window.print=()=>{}; window.open=()=>null;`;
const ok = (c, m) => console.log((c ? '✔ ' : '✘ ') + m);
(async () => {
  await H.seed();
  const { browser, pg, errs } = await H.open('home.html', { init: GUEST, w: 390, h: 800, wait: 5000 });
  const state = () => pg.evaluate(() => ({ admin: GMTRole.isAdmin(), name: GMTRole.name(), ss: sessionStorage.getItem('gmt_admin_mode') }));
  const dbAcc = async () => { const d = await H.call('/__dump', undefined, 'GET'); const r = (d.settings || d.gmt_settings || []).find(x => x.key === 'admin_accounts'); return r ? r.value : null; };
  console.log('dump keys:', Object.keys(await H.call('/__dump', undefined, 'GET')).join(','));

  // 1) دخول الإدارة (أول مرة، لا حسابات)
  await pg.evaluate(() => document.querySelector('[data-act="admin"]').click());
  await pg.waitForSelector('.gmtask-ov .gmtask-in', { timeout: 5000 });
  ok(true, 'ظهرت نافذة اسم+كلمة سرّ');
  await pg.screenshot({ path: OUT + 'adm_dialog.png' });
  const fill = async (n, p) => { const ins = await pg.$$('.gmtask-ov .gmtask-in'); await ins[0].fill(n); await ins[1].fill(p); };
  await fill('محمد خير', 'خطأ-خطأ');
  await pg.click('.gmtask-ov .gmtask-b.pri'); await pg.waitForTimeout(1500);
  const er1 = await pg.evaluate(() => (document.querySelector('.gmtask-er') || {}).textContent);
  ok(/السيادية/.test(er1 || '') && !!(await pg.$('.gmtask-ov')), 'كلمة خاطئة ⇒ خطأ داخل النافذة ولم تُغلق: ' + er1);
  ok((await dbAcc()) === null, 'لم يُنشأ أي حساب');
  await fill('محمد خير', '2003');
  await pg.click('.gmtask-ov .gmtask-b.pri'); await pg.waitForTimeout(2500);
  let s = await state(); ok(s.admin && s.name === 'محمد خير', 'دخل بوضع الإدارة باسم: ' + JSON.stringify(s));
  const raw = await dbAcc(); const list = JSON.parse(raw);
  ok(list.length === 1 && list[0].n === 'محمد خير' && /^[0-9a-f]{64}$/.test(list[0].h) && !raw.includes('2003'), 'الحساب في القاعدة ببصمة PBKDF2 ومِلح، بلا نصّ صريح: ' + raw.slice(0, 110) + '…');
  // رسالة النجاح (alert info) تُغلق
  await pg.waitForTimeout(500);
  const info = await pg.evaluate(() => (document.querySelector('.gmtask-bd') || {}).textContent || '');
  ok(/أُنشئ حساب الأدمن/.test(info), 'رسالة إنشاء الحساب: ' + info.slice(0, 40));
  if (await pg.$('.gmtask-ov')) await pg.click('.gmtask-ov .gmtask-b.pri');

  // 2) خروج ثم دخول بنفس الاسم
  await pg.evaluate(() => GMTRole.revoke()); s = await state(); ok(!s.admin && !s.name, 'الخروج يمسح الجلسة والاسم');
  await pg.evaluate(() => { localStorage.setItem('gmt_admin_auth', '1'); GMTRole.revoke(); });
  ok(await pg.evaluate(() => localStorage.getItem('gmt_admin_auth')) === null, 'الخروج يمسح gmt_admin_auth (ثغرة أدمن النقاط الدائمة)');
  pg.evaluate(() => GMTRole.requireAdmin('اختبار')); await pg.waitForSelector('.gmtask-ov .gmtask-in');
  await fill('محمد خير', '0000'); await pg.click('.gmtask-ov .gmtask-b.pri'); await pg.waitForTimeout(1200);
  ok(/غير صحيحة/.test(await pg.evaluate(() => document.querySelector('.gmtask-er').textContent)), 'كلمة خاطئة بعد الإنشاء ⇒ مرفوضة');
  await fill('مخترق', '2003'); await pg.click('.gmtask-ov .gmtask-b.pri'); await pg.waitForTimeout(1200);
  ok(/غير صحيحة/.test(await pg.evaluate(() => document.querySelector('.gmtask-er').textContent)) && !(await state()).admin, 'السيادية 2003 لا تفتح الإدارة باسمٍ آخر بعد وجود حساب');
  await fill(' محمد  خير ', '2003'); await pg.click('.gmtask-ov .gmtask-b.pri'); await pg.waitForTimeout(2500);
  s = await state(); ok(s.admin && s.name === 'محمد خير', 'الدخول بالاسم (مع مسافات زائدة) وكلمة سرّه: ' + JSON.stringify(s));

  // 3) نموذج الدخول العادي
  await pg.evaluate(() => GMTRole.revoke());
  const r3 = await pg.evaluate(async () => { try { const r = await GMTAccount.login({ username: 'محمد خير', password: '2003' }); return { r, a: GMTRole.isAdmin(), n: GMTRole.name() }; } catch (e) { return { err: e.message }; } });
  ok(r3.r && r3.r.admin && r3.a && r3.n === 'محمد خير', 'GMTAccount.login(اسم الأدمن) ⇒ وضع الإدارة: ' + JSON.stringify(r3));
  await pg.evaluate(() => GMTRole.revoke());
  const r4 = await pg.evaluate(async () => { try { await GMTAccount.login({ username: 'محمد خير', password: 'xxxx' }); return 'دخل!'; } catch (e) { return e.message; } });
  ok(/كلمة السرّ غير صحيحة/.test(r4), 'كلمة خاطئة لأدمن معروف: ' + r4);
  const r5 = await pg.evaluate(async () => { try { await GMTAccount.login({ username: 'مجهول', password: 'xxxx' }); return 'دخل!'; } catch (e) { return e.message; } });
  ok(/غير موجود/.test(r5), 'اسم مجهول: ' + r5);
  const r6 = await pg.evaluate(async () => { try { const r = await GMTAccount.login({ username: 'samer', password: '1234' }); return { admin: !!r.admin, sess: !!r.session, a: GMTRole.isAdmin() }; } catch (e) { return { err: e.message }; } });
  ok(r6.sess && !r6.admin && !r6.a, 'موظّف عادي ما زال يدخل كموظّف: ' + JSON.stringify(r6));

  // 4) فشل القراءة ⇒ لا إنشاء ولا دخول
  await H.call('/__reset', {}); await H.seed();
  await pg.reload(); await pg.waitForTimeout(3500);
  await pg.route('**/gmt_settings?key=eq.admin_accounts*', r => r.fulfill({ status: 500, body: '{}' }));
  pg.evaluate(() => GMTRole.requireAdmin('اختبار')); await pg.waitForSelector('.gmtask-ov .gmtask-in');
  await fill('محمد خير', '2003'); await pg.click('.gmtask-ov .gmtask-b.pri'); await pg.waitForTimeout(1500);
  ok(/تعذّر/.test(await pg.evaluate(() => document.querySelector('.gmtask-er').textContent)) && !(await state()).admin && (await dbAcc()) === null, 'تعذّر قراءة الحسابات ⇒ فشل مغلق، لا إنشاء ولا دخول');
  console.log('errors:', errs.filter(e => !/404|400|Failed|500/.test(e)).slice(0, 4));
  await browser.close();
})();
