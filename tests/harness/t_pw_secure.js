// (20 ت1 · TASK-0112) كلمات سرّ الموظّفين: تُفحص وتُحفظ في القاعدة (bcrypt في جدولٍ مغلق) لا base64 مكشوفاً يُقارَن في المتصفّح
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const dump = async () => await H.call('/__dump', undefined, 'GET');
const samer = async () => (await dump()).gmt_users.find(u => u.username === 'samer');
const NONE = `try{ localStorage.clear(); sessionStorage.clear(); localStorage.setItem('gmt_whatsnew_seen','999'); localStorage.setItem('gmt_intro_seen_build','x'); localStorage.setItem('gmt_branch','daraa'); }catch(e){} window.print=()=>{};`;
(async () => {
  // ١) الدخول من الرئيسية (GMTAccount.login) بحسابٍ قديم الصيغة ⇒ يُرحَّل
  await H.seed();
  let A = await H.open('home.html', { init: NONE, w: 390, wait: 2500 });
  const login = (u, p) => A.pg.evaluate(([u, p]) => GMTAccount.login({ username: u, password: p, branch: { key: 'daraa' } }).then(() => 'ok', e => e.message), [u, p]);
  ok(/غير صحيحة/.test(await login('samer', '9999')), 'كلمة خاطئة تُرفض');
  ok((await samer()).password_hash === 'MTIzNA==', '…والرفض لا يغيّر الحساب');
  ok(await login('samer', '1234') === 'ok', 'الكلمة الصحيحة (صيغة قديمة) تُدخل');
  let s = await samer(), D = await dump();
  ok(s.password_hash === '*' && D._secrets && D._secrets[s.id], 'بعد أوّل دخول: الكلمة رُحّلت إلى الجدول المغلق وأُفرغ الحقل المقروء («*»)');
  ok(await login('samer', '1234') === 'ok', 'الدخول بعد الترحيل يعمل');
  const rd = await A.pg.evaluate(async () => { const d = GMT_DB.MAIN; const r = await fetch(d.url + '/rest/v1/_secrets', { headers: { apikey: d.key } }); return r.status; });
  ok(rd === 401 || rd === 404, 'الجدول المغلق لا يُقرأ عبر الواجهة العامة (' + rd + ')');
  // ٢) تغيير الكلمة من حساب المستخدم: تلزم الحالية
  const ch1 = await A.pg.evaluate(() => GMTAccount.updateSelf({ oldPw: 'xxxx', newPw: '5678', newPw2: '5678' }).then(() => 'ok', e => e.message));
  ok(/غير صحيحة/.test(ch1), 'تغيير الكلمة بكلمةٍ حالية خاطئة يُرفض');
  const ch2 = await A.pg.evaluate(() => GMTAccount.updateSelf({ oldPw: '1234', newPw: '5678', newPw2: '5678' }).then(() => 'ok', e => e.message));
  ok(ch2 === 'ok', 'تغيير الكلمة بالحالية الصحيحة ينجح');
  ok(await login('samer', '5678') === 'ok' && /غير صحيحة/.test(await login('samer', '1234')), 'الجديدة تعمل والقديمة لم تعد تعمل');
  ok((await samer()).password_hash === '*', 'الكلمة الجديدة لم تُكتب في الحقل المقروء');
  const realA = A.errs.filter(e => !/Failed to load resource/.test(e)); ok(!realA.length, 'لا أخطاء JS (الرئيسية) ' + realA.slice(0, 2).join(' / '));
  await A.browser.close();
  // ٣) دخول نقطة البيع (مسار الكاشير اليومي) بحسابٍ قديم الصيغة
  await H.seed();
  const P = await H.open('pos.html', { init: NONE, w: 390, wait: 4000 });
  const posLogin = async (p) => { await P.pg.fill('#login-username', 'samer'); await P.pg.fill('#login-password', p); await P.pg.evaluate(() => doLogin()); await P.pg.waitForTimeout(1800);
    return P.pg.evaluate(() => ({ err: (document.getElementById('login-error') || {}).style ? document.getElementById('login-error').style.display !== 'none' && document.getElementById('login-error').textContent : '', user: (window.currentUser || {}).username || null })); };
  const pw1 = await posLogin('0000');
  ok(pw1.err && /غير صحيحة/.test(pw1.err) && !pw1.user, 'نقطة البيع: كلمة خاطئة تُرفض');
  const pw2 = await posLogin('1234');
  ok(!pw2.err && pw2.user === 'samer', 'نقطة البيع: الكلمة الصحيحة تُدخل ' + JSON.stringify(pw2));
  ok((await samer()).password_hash === '*', 'نقطة البيع: رُحّلت الكلمة بعد الدخول');
  const realP = P.errs.filter(e => !/Failed to load resource/.test(e)); ok(!realP.length, 'لا أخطاء JS (نقطة البيع) ' + realP.slice(0, 2).join(' / '));
  await P.browser.close();
  // ٤) الإدارة: إضافة مستخدم ⇒ لا كلمة مقروءة · وإعادة التعيين
  await H.seed();
  const S = await H.open('الأمان_والمستخدمون.html', { init: H.ADMIN_INIT, w: 1366, mobile: false, wait: 4000 });
  await S.pg.evaluate(() => { document.getElementById('u-name').value = 'موظف جديد'; document.getElementById('u-user').value = 'newguy'; document.getElementById('u-pw').value = 'abcd1'; const b = document.getElementById('u-branch'); if (b.options.length > 1) b.value = b.options[1].value; addUser(); });
  await S.pg.waitForTimeout(1500);
  const D2 = await dump(); const ng = D2.gmt_users.find(u => u.username === 'newguy');
  ok(ng && ng.password_hash === '*' && D2._secrets && D2._secrets[ng.id], 'إضافة مستخدم: الكلمة في الجدول المغلق والحقل «*» ' + (ng ? ng.password_hash : 'لم يُنشأ'));
  const v = await S.pg.evaluate((id) => GMTPw.check({ id }, 'abcd1'), ng && ng.id);
  ok(v === true, 'الكلمة التي وضعتها الإدارة تعمل');
  const realS = S.errs.filter(e => !/Failed to load resource/.test(e)); ok(!realS.length, 'لا أخطاء JS (الأمان) ' + realS.slice(0, 2).join(' / '));
  await S.browser.close();
  // ٥) احتياط: الدوال غير موجودة في القاعدة بعد ⇒ الدخول القديم يعمل كما كان
  await H.seed(); await H.call('/__opts', { no_pw_fn: true });
  const F = await H.open('home.html', { init: NONE, w: 390, wait: 2500 });
  const f1 = await F.pg.evaluate(() => GMTAccount.login({ username: 'samer', password: '1234', branch: { key: 'daraa' } }).then(() => 'ok', e => e.message));
  ok(f1 === 'ok', 'بلا دوال القاعدة: الدخول القديم يعمل (لا انقطاع أثناء النشر)');
  await F.browser.close();
  await H.call('/__opts', { no_pw_fn: false });
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
