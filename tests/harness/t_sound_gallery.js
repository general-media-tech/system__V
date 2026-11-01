// (TASK-0032 · المالك seq 307) أصواتٌ لما كان صامتاً (نسخة جديدة · مزامنة · إشعار · تنزيل · انقطاع/عودة الإنترنت) + معرض الأصوات
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const { browser, pg, errs } = await H.open('home.html', { w: 390, h: 844, mobile: true, wait: 5000, init: H.ADMIN_INIT + "try{localStorage.setItem('gmt_sound','on');localStorage.removeItem('gmt_notify_last_n');}catch(e){}" });
  await pg.mouse.click(5, 400); await pg.waitForTimeout(300);
  const list = await pg.evaluate(() => GMTSound.list);
  ok(['update', 'sync', 'download', 'offline', 'online', 'notify'].every(k => list.includes(k)), 'الأصوات الجديدة موجودة: update · sync · download · offline · online (+ notify)');
  const fire = async (js) => { await pg.waitForTimeout(320); await pg.evaluate(js); await pg.waitForTimeout(80); return pg.evaluate(() => GMTSound.last()); };
  ok(await fire(() => dispatchEvent(new CustomEvent('gmt-update-available'))) === 'update', 'شريط «نسخة جديدة» ⇒ صوت update');
  ok(await fire(() => dispatchEvent(new CustomEvent('gmt-sync-done', { detail: { sent: 2 } }))) === 'sync', 'أُرسل ما حُفظ بلا إنترنت ⇒ صوت sync');
  ok(await fire(() => dispatchEvent(new Event('offline'))) === 'offline', 'انقطاع الإنترنت ⇒ صوت offline');
  ok(await fire(() => dispatchEvent(new Event('online'))) === 'online', 'عودة الإنترنت ⇒ صوت online');
  await pg.evaluate(() => localStorage.removeItem('gmt_notify_last_n'));        // العدّ الحقيقي أثناء التحميل حفظ رقماً ⇒ نبدأ من جهازٍ لم يعدّ بعد
  await fire(() => dispatchEvent(new CustomEvent('gmt-notify-count', { detail: { n: 2 } })));      // أوّل مرّة: يحفظ فقط
  const first = await pg.evaluate(() => GMTSound.last());
  ok(first !== 'notify', 'أوّل عدٍّ للإشعارات على الجهاز ⇒ بلا صوت (يُحفظ فقط)');
  ok(await fire(() => dispatchEvent(new CustomEvent('gmt-notify-count', { detail: { n: 3 } }))) === 'notify', 'زاد عدد الإشعارات ⇒ صوت notify');
  await pg.waitForTimeout(320);
  await pg.evaluate(() => dispatchEvent(new CustomEvent('gmt-notify-count', { detail: { n: 1 } })));
  ok(await pg.evaluate(() => GMTSound.last()) === 'notify' && (await pg.evaluate(() => localStorage.getItem('gmt_notify_last_n'))) === '1', 'نقص العدد ⇒ لا صوت جديد ويُحفظ العدد الجديد');
  ok(await fire(() => { const a = document.createElement('a'); a.href = 'data:text/plain,x'; a.download = 'x.txt'; document.body.appendChild(a); a.click(); a.remove(); }).then(async () => { await pg.waitForTimeout(450); return pg.evaluate(() => GMTSound.last()); }) === 'download', 'تنزيل ملف (a[download]) ⇒ صوت download');
  ok(await pg.evaluate(() => GMTSound.classify('✅ تم التنزيل') === 'download' && GMTSound.classify('تمّت المزامنة') === 'sync'), 'رسائل «تم التنزيل» و«تمّت المزامنة» تُصنَّف صوتياً');
  await pg.evaluate(() => GMTSound.gallery()); await pg.waitForSelector('#gmt-snd-gal');
  const g = await pg.evaluate(() => { const ov = document.getElementById('gmt-snd-gal'); const r = ov.firstElementChild.getBoundingClientRect(); return { n: ov.querySelectorAll('[data-snd]').length, labels: [...ov.querySelectorAll('[data-snd] span:last-child')].slice(0, 3).map(s => s.textContent), fit: r.width <= innerWidth && r.left >= 0, tog: ov.querySelector('[data-snd-toggle]').textContent }; });
  ok(g.n >= 30 && g.fit, 'معرض الأصوات: ' + g.n + ' صوتاً بأسمائها العربية · داخل الشاشة (' + g.labels.join(' · ') + ')');
  await pg.click('#gmt-snd-gal [data-snd="cash"]'); await pg.waitForTimeout(100);
  await pg.click('#gmt-snd-gal [data-snd-toggle]');
  const off = await pg.evaluate(() => ({ on: GMTSound.isOn(), t: document.querySelector('#gmt-snd-gal [data-snd-toggle]').textContent }));
  ok(!off.on && /مكتومة/.test(off.t), 'زرّ الكتم في المعرض يكتم ويُظهر الحالة: ' + off.t);
  await pg.click('#gmt-snd-gal [data-snd-x]');
  ok(await pg.evaluate(() => !document.getElementById('gmt-snd-gal')), 'المعرض يُغلق');
  const B = await H.open('home.html?sounds=1', { w: 1366, h: 900, wait: 5000, init: H.ADMIN_INIT });
  ok(await B.pg.evaluate(() => !!document.getElementById('gmt-snd-gal')), 'أداة «معرض الأصوات» (home.html?sounds=1) تفتح المعرض');
  await B.browser.close();
  const real = errs.filter(e => !/status of (400|404|406|503)|Failed to load resource|favicon/.test(e));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
