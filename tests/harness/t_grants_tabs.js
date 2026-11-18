// (TASK-B0512 · المالك seq 828) «تفرق بين حساب ادمن معه صلاحيات وبين مستخدم عادي — والاهم ممكن نعطي مستخدم عادي صلاحيات وصول لادوات معينة».
// موظّفٌ مُنح «المصاريف» وحدها من أدمن النقاط ⇒ تفتح له على المصاريف فقط · «الإدارة» تعرض له المصاريف وحدها · رئيسيته بلا أدوات إدارة مقفلة.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const G = JSON.stringify(['admin_pos.html?tab=expenses']);
const INIT = H.STAFF_INIT + `;try{localStorage.setItem('gmt_grants_2', ${JSON.stringify(G)});}catch(e){}`;
(async () => {
  await H.seed();
  await H.call('/rest/v1/gmt_settings', { key: 'tool_grants_2', value: G });
  let o = await H.open('admin_pos.html', { init: INIT, w: 1366, h: 860, mobile: false, wait: 5000 });
  let r = await o.pg.evaluate(() => ({ locked: document.documentElement.classList.contains('gmt-locked') && !!document.getElementById('gmt-lock'),
    tabs: [...document.querySelectorAll('.main-tab')].filter(t => t.offsetParent).map(t => t.textContent.trim()), act: (document.querySelector('.main-tab.active') || {}).textContent || '' }));
  ok(!r.locked, 'أدمن النقاط يفتح للموظّف الممنوح أداةً منه');
  ok(r.tabs.length === 1 && /المصاريف/.test(r.tabs[0]) && /المصاريف/.test(r.act), 'التبويب الظاهر والنشط: المصاريف وحدها — ' + r.tabs.join(','));
  await o.pg.evaluate(() => switchTab('accounting')); await o.pg.waitForTimeout(400);
  r = await o.pg.evaluate(() => (document.querySelector('.main-tab.active') || {}).textContent || '');
  ok(/المصاريف/.test(r), 'لا يفتح تبويباً غير ممنوح (المحاسبة ⇒ المصاريف)');
  await o.browser.close();
  o = await H.open('الإدارة.html', { init: INIT, w: 390, wait: 4000 });
  r = await o.pg.evaluate(() => ({ items: [...document.querySelectorAll('#secs a.t b')].map(b => b.textContent), main: !document.getElementById('main-l').hidden, locked: !!document.getElementById('gmt-lock') && document.documentElement.classList.contains('gmt-locked') }));
  ok(!r.locked && r.items.length === 1 && r.items[0] === 'المصاريف' && !r.main, '«الإدارة» للموظّف: المصاريف وحدها بلا اللوحة الكاملة — ' + r.items.join(','));
  await o.browser.close();
  o = await H.open('home.html', { init: INIT, w: 390, wait: 5000 });
  r = await o.pg.evaluate(() => ({ locked: document.querySelectorAll('#allp [data-locked="1"]').length, hub: !!document.querySelector('#allp a[data-tool="الإدارة.html"]'), note: /غير ممنوحة لحسابك/.test((document.getElementById('allp') || {}).textContent || '') }));
  ok(r.locked === 0 && r.hub && r.note, 'رئيسية الموظّف: لا أدوات مقفلة · «الإدارة» ظاهرة لأنّه مُنح منها · سطرٌ يقول كم أداة غير ممنوحة');
  await o.browser.close();
  o = await H.open('home.html', { w: 390, wait: 5000 });
  r = await o.pg.evaluate(() => document.querySelectorAll('#allp a.lr').length);
  ok(r > 40, 'الأدمن يرى كل الأدوات (' + r + ')');
  const real = o.errs.filter(e => !/status of (4\d\d|503)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' | '));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
