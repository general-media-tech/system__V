// (TASK-0176 · المالك seq 96) «الملفّ الشخصي»: الأدمن يفتحه بالضغط على اسم المستخدم — اسم المركز على الفاتورة · اسم الشخص · اسم الدخول · كلمة السرّ
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const dump = () => H.call('/__dump', undefined, 'GET');
(async () => {
  for (const W of [390, 1100]) {
    await H.seed();
    await H.call('/rest/v1/gmt_users', [{ username: 'ahmad', display_name: 'أحمد', branch_key: 'haleb', is_active: true, password_hash: 'MTIzNA==' }]);
    await H.call('/rest/v1/gmt_settings', { key: 'user_profile_' + (await dump()).gmt_users.find(u => u.username === 'ahmad').id, value: JSON.stringify({ center: 'مركز قديم', photo: 'data:x' }) });
    const { browser, pg, errs } = await H.open('الأمان_والمستخدمون.html', { init: H.ADMIN_INIT, w: W, h: 900, wait: 3500, mobile: W < 500 });
    await pg.fill('#gate-pw', '2003'); await pg.evaluate(() => unlock()); await pg.waitForTimeout(2500);
    const A = (await dump()).gmt_users.find(u => u.username === 'ahmad');
    await pg.click(`[data-u-prof="${A.id}"]`); await pg.waitForSelector('#u-prof #pf-center', { timeout: 5000 }).catch(() => {});
    const v = await pg.evaluate(() => ({ c: (document.getElementById('pf-center') || {}).value, n: (document.getElementById('pf-name') || {}).value, u: (document.getElementById('pf-user') || {}).value }));
    ok(v.c === 'مركز قديم' && v.n === 'أحمد' && v.u === 'ahmad', W + ': الضغط على اسم المستخدم ⇒ «الملفّ الشخصي» بقيمه الحاليّة: ' + JSON.stringify(v));
    // اسم دخولٍ لمستخدمٍ آخر ⇒ مرفوض بلا كتابة
    await pg.fill('#pf-user', 'samer'); await pg.click('#u-prof [data-ps]'); await pg.waitForTimeout(300);
    ok(/لمستخدمٍ آخر/.test(await pg.evaluate(() => document.querySelector('#u-prof [data-pm]').textContent)) && (await dump()).gmt_users.find(u => u.id === A.id).username === 'ahmad', W + ': اسم دخولٍ مستعمل ⇒ مرفوض');
    await pg.fill('#pf-user', 'Ahmad.H'); await pg.fill('#pf-name', 'أحمد حمدان'); await pg.fill('#pf-center', 'مركز الفرقان'); await pg.fill('#pf-pw', 'zz99');
    await pg.click('#u-prof [data-ps]'); await pg.waitForTimeout(1500);
    const d = await dump(), U = d.gmt_users.find(u => u.id === A.id), P = JSON.parse((d.gmt_settings.find(s => s.key === 'user_profile_' + A.id) || {}).value || '{}');
    ok(U.display_name === 'أحمد حمدان' && U.username === 'ahmad.h', W + ': الاسم على الفاتورة واسم الدخول (بالأحرف الصغيرة) حُفظا: ' + JSON.stringify([U.display_name, U.username]));
    ok(P.center === 'مركز الفرقان' && P.photo === 'data:x', W + ': اسم المركز في الملفّ الذي تقرؤه الفاتورة (والصورة باقية): ' + JSON.stringify(P.center));
    const pwOk = await pg.evaluate(async id => { try { return (await GMTPw.check({ id }, 'zz99')) && !(await GMTPw.check({ id }, '1234')); } catch (e) { return 'err:' + e.message; } }, A.id);
    ok(pwOk === true, W + ': كلمة السرّ الجديدة تعمل والقديمة لا: ' + JSON.stringify(pwOk));
    ok(!(await pg.$('#u-prof')) && /حُفظ الملفّ الشخصي/.test(await pg.evaluate(() => document.getElementById('u-msg').textContent)), W + ': النافذة أُغلقت ورسالة الحفظ');
    // بلا تغيير ⇒ لا كتابة · Esc يغلق
    await pg.waitForTimeout(800);
    await pg.click(`[data-u-prof="${A.id}"]`); await pg.waitForSelector('#u-prof #pf-center', { timeout: 5000 }).catch(() => {});
    await pg.click('#u-prof [data-ps]'); await pg.waitForTimeout(300);
    ok(/لا تغيير/.test(await pg.evaluate(() => document.querySelector('#u-prof [data-pm]').textContent)), W + ': بلا تغيير ⇒ «لا تغيير لحفظه»');
    const hs = await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    ok(!hs, W + ': لا طفح أفقي');
    if (W === 390) await pg.screenshot({ path: '/tmp/gmt-out/user_profile_390.png' });
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
    ok(!(await pg.$('#u-prof')), W + ': Esc يغلق');
    const real = errs.filter(e => !/status of (400|401|404|406)|Failed to load resource/.test(e));
    ok(!real.length, W + ': لا أخطاء JS ' + real.slice(0, 2).join(' / '));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
