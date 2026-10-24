// المستخدمون ونقاط البيع (١٨ ت١ · وثيقة الطلبات ٩): حسابات هذا الجهاز · تذكّر هذا الجهاز · فتح نقطة المستخدم مباشرة
// يُشغَّل: BASE_PORT=.. MOCK_PORT=.. node tests/harness/t_users_s_accounts.js
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const H = require('./h.js');
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fails++; };
const dump = () => H.call('/__dump', undefined, 'GET');
// جهازٌ جديد: لا جلسة، لكنّ علامات الانترو/ما الجديد مضبوطة كي لا تحجب الشاشة. لا نكتب فوق شيءٍ محفوظ عند إعادة الفتح.
const DEV_INIT = `try{ if(!localStorage.getItem('gmt_whatsnew_seen')) localStorage.setItem('gmt_whatsnew_seen','999'); if(!localStorage.getItem('gmt_intro_seen_build')) localStorage.setItem('gmt_intro_seen_build','x'); }catch(e){} window.print=()=>{}; window.open=()=>null;`;

async function openCtx(w, h, mobile) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block' });
  const M = 'http://127.0.0.1:' + (process.env.MOCK_PORT || 8197);
  await ctx.route('**/*.supabase.co/**', async route => {
    const u = route.request().url(); const i = u.indexOf('/rest/v1/');
    if (/\/functions\/v1\/gmt-tg\//.test(u)) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false}' });
    if (i < 0) return route.fulfill({ status: 200, body: '{}' });
    try { const r = await route.fetch({ url: M + u.slice(i) }); await route.fulfill({ response: r }); } catch (e) { try { await route.abort(); } catch (_) {} }
  });
  await ctx.route('https://api.telegram.org/**', r => r.fulfill({ status: 200, body: '{"ok":true}' }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, body: '', headers: { 'Content-Type': 'text/css' } }));
  await ctx.route(/^https:\/\/(?!127)/, r => { const u = r.request().url(); if (/supabase|telegram|fonts\./.test(u)) return r.fallback(); r.fulfill({ status: 404, body: '' }); });
  await ctx.addInitScript(DEV_INIT);
  const newPage = async (url, wait = 2500) => {
    const pg = await ctx.newPage(); const errs = [];
    pg.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    await pg.goto(H.BASE + url, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(wait);
    pg.errs = errs; return pg;
  };
  return { browser, ctx, newPage };
}
const url = pg => new URL(pg.url()).pathname.split('/').pop() + (new URL(pg.url()).hash || '');
const ls = (pg, k) => pg.evaluate(k => localStorage.getItem(k), k);
const ss = (pg, k) => pg.evaluate(k => sessionStorage.getItem(k), k);
const noHScroll = pg => pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2);

async function loginForm(pg, user, pw, remember) {
  await pg.fill('#f-user', user); await pg.fill('#f-pw', pw);
  if (remember) await pg.check('#f-rem'); else await pg.uncheck('#f-rem');
  await pg.click('#nx');
}

(async () => {
  for (const [w, h, mobile] of [[390, 844, true], [1366, 820, false]]) {
    console.log('\n===== ' + w + 'px =====');
    await H.seed();
    await H.call('/rest/v1/gmt_users', [{ username: 'ahmad', display_name: 'أحمد', branch_key: 'haleb', branch_name: 'حلب', is_active: true, password_hash: 'MTIzNA==', last_device_id: 'OPEN-ANY-DEVICE' }]);
    await H.call('/rest/v1/gmt_users?username=eq.samer', { last_device_id: 'OPEN-ANY-DEVICE' }, 'PATCH');
    const { browser, ctx, newPage } = await openCtx(w, h, mobile);

    // ── أدمن بحسابٍ مسمّى (يُنشأ بالصفحة نفسها كما تفعل الإدارة) ──
    let pg = await newPage('home.html');
    await pg.evaluate(async () => { GMTRole.grant('محمد خير'); await GMTAuth.admin.add('محمد خير', 'Pass1234'); GMTRole.revoke(); });
    await pg.close();

    // ══ ١) موظّفٌ يدخل مع «تذكّر هذا الجهاز» ⇒ نقطته مباشرةً ══
    pg = await newPage('home.html');
    ok(url(pg) === 'home.html', 'جهازٌ جديد بلا حساب ⇒ تبقى شاشة الدخول (لا انتقال)');
    ok(await pg.evaluate(() => !!document.getElementById('f-rem')), 'نموذج الدخول فيه خانة «تذكّر هذا الجهاز»');
    ok(!(await pg.evaluate(() => document.getElementById('f-rem').checked)), 'الخانة غير مفعّلة افتراضياً (لا نُضعف الأمان)');
    ok(await noHScroll(pg), 'بلا طفح أفقي على شاشة الدخول');
    await loginForm(pg, 'samer', '1234', true);
    await pg.waitForURL(/pos\.html/, { timeout: 8000 }).catch(() => {});
    ok(/pos\.html/.test(url(pg)), 'بعد دخول موظّفٍ عاديّ تُفتح نقطة بيعه مباشرةً (' + url(pg) + ')');
    const accts1 = JSON.parse(await ls(pg, 'gmt_accounts_v1') || '[]');
    const sam = accts1.find(a => a.username === 'samer');
    ok(sam && sam.rem === true && sam.sess && sam.sess.branch_key === 'daraa', 'القائمة حفظت «samer» مُذكَّراً ولقطة جلسته (فرع درعا)');
    const allLS = await pg.evaluate(() => JSON.stringify(Object.assign({}, localStorage)));
    ok(!/MTIzNA==/.test(allLS) && !/"password"/.test(allLS) && !/1234/.test(JSON.stringify(accts1)), 'لا كلمة سرّ (ولا بصمتها) محفوظة على الجهاز');
    ok(await ls(pg, 'gmt_active_acct') === 'staff:' + sam.id, 'آخر حسابٍ مُختار = samer');
    await pg.close();

    // ══ ٢) فتح التطبيق من جديد (تبويبٌ جديد، التخزين الدائم باقٍ) ⇒ نقطته مباشرة ══
    pg = await newPage('home.html', 3500);
    ok(/pos\.html/.test(url(pg)), 'فتحُ التطبيق من جديد والموظّف داخل ⇒ نقطة بيعه مباشرة بلا مرور بالرئيسية (' + url(pg) + ')');
    ok(await pg.evaluate(() => /درعا/.test(document.getElementById('h-branch').textContent)), 'هي نقطة فرعه (درعا)');
    // الرئيسية ما زالت في المتناول من شريط نقطة البيع
    const homeBtn = await pg.evaluate(() => { const a = document.getElementById('gmt-home-btn'); return a ? { href: a.getAttribute('href'), vis: a.getBoundingClientRect().width > 0 } : null; });
    ok(homeBtn && /home\.html/.test(homeBtn.href) && homeBtn.vis, 'زرّ «الرئيسية» ظاهر في شريط نقطة البيع');
    await pg.click('#gmt-home-btn'); await pg.waitForURL(/home\.html/, { timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(2500);
    ok(/home\.html/.test(url(pg)) && await pg.evaluate(() => document.body.classList.contains('role-staff')), 'من «الرئيسية» نصل الرئيسية ولا نرتدّ إلى النقطة (تنقّلٌ داخلي)');

    // ══ ٣) حسابٌ ثانٍ بلا تذكّر ثم التبديل ══
    const openAccts = async () => {
      if (mobile) { await pg.click('button[data-act="drawer"]'); await pg.waitForTimeout(400); await pg.click('.drw [data-act="accts"]'); }
      else await pg.click('.side [data-act="accts"]');
      await pg.waitForSelector('.md #a-list', { timeout: 4000 });
    };
    await openAccts();
    ok(await pg.evaluate(() => /samer|سامر/.test(document.querySelector('#a-list').innerText) && !!document.querySelector('#a-rem')), 'نافذة «حسابات هذا الجهاز» تعرض الحساب الحالي وخانة التذكّر');
    ok(await pg.evaluate(() => document.getElementById('a-rem').checked), 'الحالي مُذكَّر (خانة التذكّر مفعّلة)');
    await pg.screenshot({ path: `/tmp/gmt-out/users_s_accts_${w}.png` });
    await pg.click('.md [data-act="acct-add"]'); await pg.waitForTimeout(1200);
    ok(await pg.evaluate(() => document.body.classList.contains('role-guest') && !!document.querySelector('.acct')), '«دخول بحسابٍ آخر» ⇒ شاشة الدخول وفيها قائمة الحسابات');
    ok(await pg.evaluate(() => /ضغطة واحدة/.test(document.querySelector('.accts').innerText)), 'الحساب المُذكَّر عليه «ضغطة واحدة»');
    await pg.screenshot({ path: `/tmp/gmt-out/users_s_guest_${w}.png` });
    ok(await noHScroll(pg), 'بلا طفح أفقي مع قائمة الحسابات');
    await loginForm(pg, 'ahmad', '1234', false);
    await pg.waitForURL(/pos\.html/, { timeout: 8000 }).catch(() => {});
    ok(/pos\.html/.test(url(pg)) && (await ls(pg, 'gmt_session')).includes('ahmad'), 'دخل «ahmad» (جلسة الجهاز صارت له) ونقطته تُفتح');
    const accts2 = JSON.parse(await ls(pg, 'gmt_accounts_v1'));
    ok(accts2.length === 2 && accts2.find(a => a.username === 'ahmad').rem !== true && !accts2.find(a => a.username === 'ahmad').sess, 'قائمة الجهاز: حسابان — ahmad غير مُذكَّر (بلا لقطة جلسة)');

    // التبديل بضغطة إلى المُذكَّر
    await pg.click('#gmt-home-btn'); await pg.waitForURL(/home\.html/, { timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(2500);
    await openAccts();
    const rowsTxt = await pg.evaluate(() => [...document.querySelectorAll('#a-list .acct')].map(r => r.innerText.replace(/\s+/g, ' ').trim()));
    console.log('    rows:', JSON.stringify(rowsTxt));
    ok(rowsTxt.length === 2 && rowsTxt.some(t => /الحالي/.test(t)) && rowsTxt.some(t => /ضغطة واحدة/.test(t)), 'النافذة: الحالي + المُذكَّر عليه «ضغطة واحدة»');
    ok(!(await pg.evaluate(() => document.getElementById('a-rem').checked)), 'ahmad غير مُذكَّر ⇒ الخانة مطفأة');
    await pg.click('#a-list [data-acct="staff:' + sam.id + '"]');
    await pg.waitForURL(/pos\.html/, { timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(1500);
    ok(/pos\.html/.test(url(pg)) && (await ls(pg, 'gmt_session')).includes('"username":"samer"'), 'ضغطةٌ واحدة بلا كلمة سرّ ⇒ صرنا «samer» ونقطته مفتوحة');
    ok(await ls(pg, 'gmt_branch') === 'daraa', 'ومفتاح الفرع تبعَه (درعا)');

    // غير المُذكَّر ⇒ كلمة سرّه كما اليوم (من داخل التطبيق: نافذة كلمة سرّ، وكلمة خاطئة لا تُخرجنا)
    await pg.click('#gmt-home-btn'); await pg.waitForURL(/home\.html/, { timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(2500);
    await openAccts();
    const ahmId = (await dump()).gmt_users.find(u => u.username === 'ahmad').id;
    await pg.click('#a-list [data-acct="staff:' + ahmId + '"]'); await pg.waitForSelector('.gmtask-ov .gmtask-in', { timeout: 5000 });
    await pg.fill('.gmtask-ov .gmtask-in', 'خطأ'); await pg.click('.gmtask-ov .gmtask-b.pri'); await pg.waitForTimeout(1200);
    ok(/غير صحيحة/.test(await pg.evaluate(() => (document.querySelector('.gmtask-er') || {}).textContent || '')), 'غير المُذكَّر: كلمة سرّ خاطئة ⇒ رسالة داخل النافذة');
    ok((await ls(pg, 'gmt_session')).includes('"username":"samer"'), 'والجلسة الحالية لم تُمسّ بالخطأ');
    await pg.fill('.gmtask-ov .gmtask-in', '1234'); await pg.click('.gmtask-ov .gmtask-b.pri');
    await pg.waitForURL(/pos\.html/, { timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(1200);
    ok((await ls(pg, 'gmt_session')).includes('"username":"ahmad"'), 'كلمة السرّ الصحيحة ⇒ دخل «ahmad»');

    // ══ ٤) أدمن + تذكّر هذا الجهاز ⇒ لا يرتدّ إلى الموظّف عند فتح التطبيق ══
    await pg.click('#gmt-home-btn'); await pg.waitForURL(/home\.html/, { timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(2500);
    await openAccts(); await pg.click('.md [data-act="acct-add"]'); await pg.waitForTimeout(1200);
    await loginForm(pg, 'محمد خير', 'Pass1234', true);
    await pg.waitForFunction(() => document.body.classList.contains('role-admin'), null, { timeout: 8000 }).catch(() => {});
    ok(await pg.evaluate(() => GMTRole.isAdmin()) && /home\.html/.test(url(pg)), 'الأدمن يدخل (وضع الإدارة) ويبقى على الرئيسية — لا نقطة تلقائية للأدمن');
    await pg.waitForTimeout(1500);
    const devs = JSON.parse(await ls(pg, 'gmt_admin_devices_v2') || '[]');
    ok(devs.length === 1 && devs[0].k === 'محمدخير' && devs[0].t && devs[0].t.length === 64, 'رمز الجهاز العشوائي (٦٤ حرفاً hex) محفوظٌ محلياً للأدمن');
    const db1 = await dump(); const devRow = (db1.gmt_settings || []).find(x => /^admin_device_/.test(x.key));
    ok(devRow && !/Pass1234/.test(devRow.value) && !devRow.value.includes(devs[0].t) && /"h":"[0-9a-f]{64}"/.test(devRow.value), 'في القاعدة بصمةُ الرمز فقط — لا كلمة السرّ ولا الرمز نفسه');
    await pg.close();

    // فتح التطبيق من جديد (sessionStorage فارغ) — آخر من اختير = الأدمن المُذكَّر ⇒ وضع الإدارة لا الموظّف
    pg = await newPage('home.html', 4500);
    ok(await pg.evaluate(() => GMTRole.isAdmin() && GMTRole.name() === 'محمد خير'), 'فتح التطبيق من جديد ⇒ عاد وضع الإدارة باسم «محمد خير» (لا يرتدّ إلى الموظّف)');
    ok(/home\.html/.test(url(pg)) && await pg.evaluate(() => document.body.classList.contains('role-admin')), 'والرئيسية بنسخة الأدمن');
    ok(await noHScroll(pg), 'بلا طفح أفقي');
    await pg.screenshot({ path: `/tmp/gmt-out/users_s_admin_${w}.png` });

    // الأدمن يضغط «نقطة»/يبدّل إلى موظّفٍ مُذكَّر ثم يعود بضغطة
    await openAccts();
    const rows3 = await pg.evaluate(() => [...document.querySelectorAll('#a-list .acct')].map(r => r.innerText.replace(/\s+/g, ' ').trim()));
    console.log('    rows(admin):', JSON.stringify(rows3));
    ok(rows3.length === 3 && rows3.some(t => /محمد خير/.test(t) && /الحالي/.test(t)), 'الأدمن الحالي + الموظّفان في القائمة');
    await pg.click('#a-list [data-acct="staff:' + sam.id + '"]');
    await pg.waitForURL(/pos\.html/, { timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(1000);
    ok(await pg.evaluate(() => !GMTRole.isAdmin()) && (await ls(pg, 'gmt_session')).includes('"username":"samer"'), 'التبديل من الأدمن إلى موظّفٍ مُذكَّر يُغلق وضع الإدارة ويفتح نقطته');
    await pg.click('#gmt-home-btn'); await pg.waitForURL(/home\.html/, { timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(2500);
    await openAccts();
    await pg.click('#a-list [data-acct="admin:محمدخير"]'); await pg.waitForTimeout(2500);
    ok(await pg.evaluate(() => GMTRole.isAdmin() && GMTRole.name() === 'محمد خير'), 'والعودة إلى الأدمن المُذكَّر بضغطة واحدة بلا كلمة سرّ');
    await pg.close();

    // ══ ٥) تغيير كلمة سرّ الأدمن ⇒ التذكّر يسقط وحده ══
    pg = await newPage('home.html', 4000);
    ok(await pg.evaluate(() => GMTRole.isAdmin()), '(قبل) الأدمن مُستعاد من التذكّر');
    await pg.evaluate(async () => { await GMTAuth.admin.setPassword('محمد خير', 'NewPass99'); });
    await pg.close();
    pg = await newPage('home.html', 4000);
    ok(await pg.evaluate(() => !GMTRole.isAdmin()), 'بعد تغيير كلمة سرّ الأدمن لا يُفتح وضع الإدارة من التذكّر القديم');
    ok(JSON.parse(await ls(pg, 'gmt_admin_devices_v2') || '[]').length === 0, 'والتذكّر القديم مُحيَ من الجهاز');
    await pg.close();

    // ══ ٦) خروج صريح ينسى التذكّر ══
    pg = await newPage('home.html#t', 2500);      // # ⇒ لا انتقال تلقائي إلى النقطة (نريد شاشة الدخول)
    await pg.evaluate(() => { try { localStorage.removeItem('gmt_session'); } catch (_) {} });
    await pg.reload(); await pg.waitForTimeout(2500);
    await loginForm(pg, 'محمد خير', 'NewPass99', true);
    await pg.waitForFunction(() => document.body.classList.contains('role-admin'), null, { timeout: 8000 }).catch(() => {});
    await pg.waitForTimeout(1500);
    ok(JSON.parse(await ls(pg, 'gmt_admin_devices_v2') || '[]').length === 1, 'دخول جديد بكلمة السرّ الجديدة مع التذكّر ⇒ يُحفظ من جديد');
    await pg.evaluate(() => { GMTAsk.confirm = async () => true; });
    await pg.evaluate(() => document.querySelector('[data-act="logout"]') ? document.querySelector('[data-act="logout"]').click() : null);
    await pg.waitForTimeout(600);
    if (mobile && await pg.evaluate(() => document.body.classList.contains('role-admin'))) { await pg.click('button[data-act="drawer"]'); await pg.waitForTimeout(300); await pg.click('.drw [data-act="logout"]'); }
    await pg.waitForTimeout(2500);
    ok(JSON.parse(await ls(pg, 'gmt_admin_devices_v2') || '[]').length === 0, 'خروج الأدمن ⇒ التذكّر يسقط من الجهاز');
    ok(!((await dump()).gmt_settings || []).some(x => /^admin_device_/.test(x.key)), 'ومن القاعدة أيضاً (الرمز المنسوخ لا يصلح)');
    ok(await ls(pg, 'gmt_active_acct') === '' || await ls(pg, 'gmt_active_acct') === null, 'ولا حساب «نشط»');
    console.log('  errs:', pg.errs.filter(e => !/404|400|Failed|net::/.test(e)).slice(0, 3));
    await browser.close();
  }
  // ══ ٧) (TASK-0030) من يدخل من نقطة البيع نفسها يظهر في «حسابات هذا الجهاز» ══
  {
    await H.seed();
    const { browser, newPage } = await openCtx(390, 800, true);
    const pg = await newPage('pos.html', 1500);
    await pg.evaluate(() => { localStorage.setItem('gmt_branch', 'daraa'); }); await pg.reload(); await pg.waitForTimeout(4000);
    await pg.fill('#login-username', 'samer'); await pg.fill('#login-password', '1234'); await pg.evaluate(() => doLogin()); await pg.waitForTimeout(2200);
    const who = await pg.evaluate(() => (window.currentUser || {}).username || null);
    const list = JSON.parse(await ls(pg, 'gmt_accounts_v1') || '[]');
    ok(who === 'samer' && list.some(x => x.t === 'staff' && x.username === 'samer' && x.branch_key === 'daraa' && x.branch_name === 'درعا'), 'دخولٌ من نقطة البيع ⇒ الحساب في قائمة الجهاز باسمه وفرعه: ' + JSON.stringify(list.map(x => x.username + ':' + x.branch_name)));
    ok(!JSON.stringify(list).includes('1234'), 'ولا كلمة سرّ في القائمة');
    ok(await ls(pg, 'gmt_active_acct') === 'staff:' + list[0].id, 'وهو الحساب «النشط» على الجهاز');
    await browser.close();
  }
  console.log(fails ? '\nFAILS=' + fails : '\nALL PASS'); process.exit(fails ? 1 : 0);
})();
