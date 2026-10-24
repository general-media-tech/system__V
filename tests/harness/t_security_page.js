// TASK-0143 — «الأمان والمستخدمون» (رسالة المالك seq 43 + طلب 9 ت1 «كل الصفحات بهذا اللون اعد صقلها»):
// كانت تنقلب داكنةً على هاتفٍ بالوضع الليليّ، والمستخدمون جدولٌ بستّة أعمدة يُقصّ على الهاتف وشاراته تنكسر عمودياً.
// ١) فاتحةٌ دائماً حتى والهاتف على الوضع الداكن · ٢) لا تمرير أفقيّ · ٣) بطاقةٌ لكلّ مستخدم بأزرارٍ مسمّاة لا تُقصّ ·
// ٤) البحث وفلتر الفرع · ٥) ملخّص «ما يحتاج انتباهك» · ٦) الأزرار القديمة تعمل (موافقة · إيقاف) · ٧) زرّ «إظهار» كلمة السرّ نصّاً.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const dump = async () => H.call('/__dump', undefined, 'GET');
const lum = rgb => { const m = String(rgb).match(/\d+/g) || [0, 0, 0]; return (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) / 255; };

(async () => {
  for (const [w, mob] of [[390, true], [1366, false]]) {
    console.log('— ' + w);
    await H.seed();
    await H.call('/rest/v1/gmt_users', [
      { username: 'ahmad', display_name: 'أحمد', branch_key: 'haleb', is_active: true, password_hash: '*', last_device_id: 'OPEN-ANY-DEVICE' },
      { username: 'mohammad', display_name: 'Mohammad', branch_key: 'daraa', is_active: false, password_hash: '*', last_device_id: 'abc' },
      { username: 'n0930', display_name: 'موظّف جديد', branch_key: 'daraa', is_active: true, approved: false, password_hash: '*' },
      { username: 'longname', display_name: 'مستخدم تجربة اسمه طويل جداً للاختبار على الهاتف', branch_key: 'haleb', is_active: true, password_hash: '*' }]);
    const { browser, pg, errs } = await H.open('الأمان_والمستخدمون.html', { init: H.ADMIN_INIT + `try{sessionStorage.setItem('gmt_admin_name','محمد خير')}catch(e){}`, w, h: 900, mobile: mob, wait: 1500 });
    await pg.emulateMedia({ colorScheme: 'dark' }); await pg.reload(); await pg.waitForTimeout(2500);
    ok(lum(await pg.evaluate(() => getComputedStyle(document.body).backgroundColor)) > 0.9, 'البوّابة فاتحة والهاتف على الوضع الداكن');
    await pg.fill('#gate-pw', '2003'); await pg.click('#gate .btn'); await pg.waitForTimeout(3500);
    const look = await pg.evaluate(() => {
      const card = document.querySelector('#s-users');
      return { body: getComputedStyle(document.body).backgroundColor, card: getComputedStyle(card).backgroundColor, ink: getComputedStyle(document.querySelector('h1')).color,
        hs: document.documentElement.scrollWidth > innerWidth + 2 };
    });
    ok(lum(look.body) > 0.9 && lum(look.card) > 0.95 && lum(look.ink) < 0.25, 'الصفحة فاتحة بهويّة النظام حتى على الوضع الداكن: ' + JSON.stringify(look));
    ok(!look.hs, 'لا تمرير أفقيّ');
    const cards = await pg.evaluate(() => [...document.querySelectorAll('.ucard')].map(c => {
      const r = c.getBoundingClientRect();
      const btns = [...c.querySelectorAll('.uact .btn')].map(b => ({ t: b.innerText.trim(), cut: b.scrollWidth > b.clientWidth + 1, h: b.getBoundingClientRect().height }));
      const tags = [...c.querySelectorAll('.tag')].map(t => ({ t: t.innerText.trim(), h: t.getBoundingClientRect().height }));
      return { uid: c.getAttribute('data-uid'), name: c.querySelector('.uname').innerText, w: r.width, right: r.right <= innerWidth + 1, btns, tags };
    }));
    ok(cards.length === 5, 'بطاقةٌ لكلّ مستخدم (' + cards.length + ')');
    ok(cards.every(c => c.right && c.btns.every(b => !b.cut && b.h >= 36)), 'أزرار البطاقات كاملة الكتابة وبارتفاع اللمس (لا قصّ)');
    ok(cards.every(c => c.tags.every(t => t.h < 30)), 'الشارات سطرٌ واحد (كانت تنكسر عمودياً)');
    ok(cards.every(c => ['الاسم', 'كلمة السرّ', 'الصلاحيات', 'حذف'].every(l => c.btns.some(b => b.t.includes(l)))), 'كلّ بطاقة: الاسم · كلمة السرّ · الصلاحيات · حذف');
    const pend = cards.find(c => c.name === 'موظّف جديد');
    ok(pend && pend.btns.some(b => /موافقة/.test(b.t)) && pend.tags.some(t => /بانتظار الموافقة/.test(t.t)), 'الحساب الجديد: «بانتظار الموافقة» وزرّ «موافقة»');
    const sum = await pg.evaluate(() => document.getElementById('sec-sum').innerText.replace(/\s+/g, ' '));
    ok(/ما زالت الافتراضيّة/.test(sum) && /1 حساب بانتظار موافقتك/.test(sum), 'الملخّص أعلى الصفحة: كلمات سرٍّ افتراضيّة + حسابٌ بانتظار الموافقة: ' + sum.slice(0, 90));
    // البحث والفلتر
    await pg.fill('#u-q', 'أحمد'); await pg.waitForTimeout(300);
    ok(await pg.evaluate(() => document.querySelectorAll('.ucard').length) === 1, 'البحث «أحمد» ⇒ بطاقةٌ واحدة');
    await pg.fill('#u-q', ''); await pg.selectOption('#u-fbr', 'daraa'); await pg.waitForTimeout(300);
    ok(await pg.evaluate(() => [...document.querySelectorAll('.ucard .uname')].map(e => e.innerText).sort().join('|')) === ['Mohammad', 'موظّف جديد', 'سامر'].sort().join('|'), 'فلتر الفرع «درعا» ⇒ موظّفو درعا فقط');
    await pg.selectOption('#u-fbr', ''); await pg.waitForTimeout(200);
    await pg.click('[data-pend-go]'); await pg.waitForTimeout(400);
    ok(await pg.evaluate(() => [...document.querySelectorAll('.ucard .uname')].map(e => e.innerText).join('|')) === 'موظّف جديد', '«اعرضها» في الملخّص ⇒ الحسابات بانتظار الموافقة فقط');
    await pg.click('[data-pend-all]'); await pg.waitForTimeout(300);
    // موافقة وإيقاف من البطاقة
    const pid = pend.uid;
    await pg.click(`[data-u-appr="${pid}"]`); await pg.waitForSelector('.gmtask-ov .gmtask-b.pri', { timeout: 5000 }); await pg.click('.gmtask-ov .gmtask-b.pri'); await pg.waitForTimeout(1800);
    ok(((await dump()).gmt_users.find(u => String(u.id) === String(pid)) || {}).approved === true, 'زرّ «موافقة» في البطاقة يعمل (القاعدة: approved)');
    const aid = cards.find(c => c.name === 'أحمد').uid;
    await pg.click(`[data-u-tog="${aid}"]`); await pg.waitForTimeout(1800);
    ok(((await dump()).gmt_users.find(u => String(u.id) === String(aid)) || {}).is_active === false, 'زرّ «إيقاف» في البطاقة يعمل');
    ok(!/بانتظار موافقتك/.test(await pg.evaluate(() => document.getElementById('sec-sum').innerText)), 'بعد الموافقة لا «حساب بانتظار الموافقة» في الملخّص');
    // زرّ إظهار كلمة السرّ
    const eye = await pg.evaluate(() => { const b = document.querySelector('[data-eye]'); const t0 = b.innerText; b.click(); const inp = document.getElementById('p_' + b.getAttribute('data-eye')); return { t0, t1: b.innerText, type: inp.type }; });
    ok(eye.t0 === 'إظهار' && eye.t1 === 'إخفاء' && eye.type === 'text', 'زرّ «إظهار» نصّيّ ويعمل (كان رمزاً يظهر مربّعاً فارغاً)');
    await pg.screenshot({ path: __dirname + '/security_page_' + w + '.png', fullPage: true });
    const bad = errs.filter(e => !/Failed to load|favicon|أصول/.test(e));
    ok(bad.length === 0, 'لا أخطاء JS: ' + JSON.stringify(bad.slice(0, 3)));
    await browser.close();
  }
  console.log(fails ? `FAIL=${fails} (pass ${pass})` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
