const H = require('./h.js');
(async () => {
  await H.seed();
  await H.call('/rest/v1/gmt_users', [{ username: 'ahmad', display_name: 'أحمد', branch_key: 'haleb', is_active: true, password_hash: 'MTIzNA==' }, { username: 'khaled', display_name: 'خالد', branch_key: 'daraa', is_active: true, password_hash: 'MTIzNA==' }]);
  const { browser, ctx, pg, errs } = await H.open('الأمان_والمستخدمون.html', { init: H.ADMIN_INIT, w: 1100, h: 900, wait: 3500, mobile: false });
  // بوّابة كلمة السرّ السيادية
  await pg.fill('#gate-pw', '2003'); await pg.evaluate(() => unlock()); await pg.waitForTimeout(2500);
  const users = async () => (await H.call('/__dump', undefined, 'GET')).gmt_users.map(u => u.username);
  console.log('قبل:', JSON.stringify(await users()));
  const clickDelFor = async (username) => {
    const ids = (await H.call('/__dump', undefined, 'GET')).gmt_users;
    const row = ids.find(u => u.username === username);
    await pg.click(`[data-u-del="${row.id}"]`); await pg.waitForSelector('.gmtask-ov input', { timeout: 4000 });
    await pg.fill('.gmtask-ov input', username); await pg.keyboard.press('Enter'); await pg.waitForTimeout(1500);
  };
  // ١) حذف سليم
  await clickDelFor('ahmad');
  console.log('بعد حذف ahmad:', JSON.stringify(await users()), '| رسالة:', await pg.evaluate(() => document.getElementById('u-msg').textContent));
  // ٢) RLS صامت: الخادم يردّ 200 و [] ولا يحذف
  await pg.route('**/rest/v1/gmt_users?id=eq.*', async route => {
    if (route.request().method() === 'DELETE') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    return route.fallback();
  });
  await clickDelFor('khaled');
  await pg.waitForSelector('.gmtask-ov', { timeout: 4000 }).catch(() => {});
  const dlg = await pg.evaluate(() => (document.querySelector('.gmtask-ov') || {}).textContent || '');
  console.log('RLS صامت ⇒ حوار الخطأ:', dlg.replace(/\s+/g, ' ').slice(0, 170));
  console.log('khaled باقٍ (صحيح):', JSON.stringify(await users()));
  console.log('errors:', errs.filter(e => !/404|400/.test(e)).slice(0, 3));
  await browser.close();
})();
