// (المالك seq 886) رابط التتبّع المرسل للزبون فيه رقم الشحنة (?o=): «الانترو الأوّل عم يخلص يكون خالص الانترو الثاني (أهلاً بك + الاسم)
// … أخّر إدخال الرقم لبعد ما تمرّ الشاحنة — الانترو ١ ثمّ ٢، ويشتغلوا أصواتهم الاثنين، وتجبر الشخص على اللمس»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const [o] = await H.call('/rest/v1/gmt_orders', [{ name: 'سامر الحلبي', phone: '0933111999', product: 'كاميرا', qty: 1, price: 100, status: 'shipped', branch: 'حلب',
    address: 'حمص', shipping_company: 'القدموس', tracking_number: '7788123', shipped_at: new Date(Date.now() - 86400000).toISOString() }]);
  const { browser, pg, errs } = await H.open('track_order.html?o=7788123', { w: 390, h: 844, mobile: true, wait: 50, autoplay: true, notap: false });
  await pg.evaluate(() => { window.__snd = []; const w = () => { if (window.GMTSound && GMTSound.play && !GMTSound.__spy) { const P = GMTSound.play; GMTSound.play = function (n) { window.__snd.push(n); return P.apply(this, arguments); }; GMTSound.__spy = 1; } else setTimeout(w, 30); }; w(); });
  const l2On = () => pg.evaluate(() => { const l = document.getElementById('layer2'); return !!l && !l.classList.contains('hidden') && getComputedStyle(l).display !== 'none'; });
  await sleep(2500);
  const s1 = await pg.evaluate(() => ({ intro: !!document.getElementById('gmt-launch'), hint: (document.querySelector('#gmt-launch .gl-bub') || {}).innerText || '', inp: (document.getElementById('searchInput') || {}).value }));
  ok(s1.intro && /اضغط على الشاشة/.test(s1.hint), 'الانترو الأوّل ينتظر لمسة الزبون (لمسة إجبارية): ' + s1.hint.replace(/\s+/g, ' ').trim());
  ok(!(await l2On()), 'قبل اللمسة: «أهلاً بك» (الانترو الثاني) لم يبدأ فوق الانترو الأوّل');
  ok(s1.inp === '7788123', 'رقم الشحنة من الرابط مكتوب في الخانة وينتظر');
  await pg.mouse.click(195, 700);
  let introGoneAt = 0, l2At = 0; const t0 = Date.now();
  while (Date.now() - t0 < 15000) {
    const st = await pg.evaluate(() => !!document.getElementById('gmt-launch'));
    if (!st && !introGoneAt) introGoneAt = Date.now();
    if (!l2At && await l2On()) l2At = Date.now();
    if (l2At && introGoneAt) break;
    await sleep(100);
  }
  ok(introGoneAt && l2At && l2At >= introGoneAt, 'بعد اللمسة: الانترو الأوّل ينتهي ثمّ يبدأ «أهلاً بك» (' + (l2At - introGoneAt) + 'ms بعده)');
  await sleep(1500);
  const name = await pg.evaluate(() => (document.getElementById('l2-name') || {}).innerText || '');
  ok(/أهلاً بك، سامر الحلبي/.test(name), 'الانترو الثاني باسم الزبون: ' + name);
  const snd = await pg.evaluate(() => window.__snd || []);
  ok(snd.includes('horn'), 'صوت الانترو الثاني («بيب بيب») يُشغَّل: ' + JSON.stringify(snd));
  let res = false; const t1 = Date.now(); while (Date.now() - t1 < 8000) { res = await pg.evaluate(() => !document.getElementById('resultCard').classList.contains('hidden')); if (res) break; await sleep(150); }
  ok(res, 'ثمّ تظهر نتيجة الشحنة');
  const real = errs.filter(e => !/Failed to load resource/.test(e)); ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
