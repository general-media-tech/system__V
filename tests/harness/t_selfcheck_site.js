// (23 ت1 · TASK-0132) تقرير الصحّة (المالك seq 34): ① «ألوان خارج الهوية (#1e40af)» في orders.html — شارة «من أدخله» على كل أوردر
// كانت زرقاء ⇒ رماديّة · ② «SITE تعذّر الاتصال» في كل تقرير: مشروع قاعدة الموقع لم يعد له عنوان (DNS) ⇒ الفحص يقولها صراحةً
// (قاعدةٌ لا تردّ — محذوفة أو موقوفة) بدل «جداول مفقودة»، وsite.html يعمل بالاحتياطي.
const H = require('./h.js');
let pass = 0, fails = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✔', m); } else { fails++; console.log('  ✘', m); } };
(async () => {
  await H.seed();
  await H.call('/rest/v1/gmt_orders', [1, 2, 3, 4].map(i => ({ name: 'زبون ' + i, phone: '093300050' + i, product: 'كاميرا', qty: 1, price: 100, status: 'pending', branch: 'حلب', address: 'حمص', entered_by: 'سامر' })));
  const { browser, ctx, pg, errs } = await H.open('orders.html', { w: 1366, h: 900, wait: 4500, mobile: false });
  /* ① الهوية: بعد عرض الأوردرات (الشارة مكرّرة) */
  const brand = await pg.evaluate(() => window.GMTSelfCheck ? GMTSelfCheck.checkBrand() : null);
  const html = await pg.evaluate(() => (document.documentElement.innerHTML.match(/#1e40af/gi) || []).length);
  const badges = await pg.evaluate(() => [...document.querySelectorAll('span')].filter(s => /سامر/.test(s.textContent)).length);
  ok(brand && brand.level === 'ok' && html === 0 && badges >= 3, `orders.html: الهوية سليمة (#1e40af ×${html} · شارات «من أدخله» ${badges}) — ${brand && brand.title}`);
  /* ② قاعدة الموقع لا تردّ (كالواقع: لا DNS) والبقيّة تردّ */
  /* (TASK-0033 · seq 307) غيابٌ أوّل = تنبيهٌ يُعاد خلال ساعة (لا شريط أحمر) · تكرّره في فحصٍ منفصل = مشكلةٌ مؤكّدة */
  await pg.evaluate(() => localStorage.removeItem('gmt_selfcheck_gone'));
  await ctx.route('https://znpakcaizvkwqzhosxvm.supabase.co/**', r => r.abort('namenotresolved'));
  const db0 = await pg.evaluate(() => GMTSelfCheck.checkDatabase());
  const due = await pg.evaluate(() => Date.now() - Number(localStorage.getItem('gmt_selfcheck_last')) > 86400000 - 3700000);
  ok(db0.level === 'warn' && /لم تردّ الآن: SITE/.test(db0.title) && due, 'غيابٌ أوّل ⇒ تنبيه لا مشكلة + إعادة الفحص خلال ساعة: ' + db0.title);
  const db = await pg.evaluate(() => GMTSelfCheck.checkDatabase());
  ok(db.level === 'bad' && /قاعدةٌ لا تردّ: SITE/.test(db.title) && /محذوف أو موقوف/.test(db.detail) && !/جداول مفقودة/.test(db.title), 'تكرّر في فحصٍ ثانٍ ⇒ «قاعدةٌ لا تردّ» بسببٍ وحلّ: ' + db.title);
  await ctx.unroute('https://znpakcaizvkwqzhosxvm.supabase.co/**');
  const db2 = await pg.evaluate(() => GMTSelfCheck.checkDatabase());
  ok(db2.level === 'ok', 'كل القواعد تردّ ⇒ سليم: ' + db2.title);
  /* تعثّرٌ لحظيّ: أوّل طلبٍ يفشل ثمّ تردّ ⇒ سليم (كان «متوقّفة — محذوفة أو موقوفة») */
  let n = 0;
  await ctx.route('https://znpakcaizvkwqzhosxvm.supabase.co/**', r => (n++ === 0 ? r.abort('connectionreset') : r.fallback()));
  const db3 = await pg.evaluate(() => GMTSelfCheck.checkDatabase());
  ok(db3.level === 'ok' && n >= 2, `تعثّر لحظيّ ثمّ ردّ ⇒ سليم بعد إعادة المحاولة (${n} طلبات): ` + db3.title);
  await ctx.unroute('https://znpakcaizvkwqzhosxvm.supabase.co/**');
  const fresh = await pg.evaluate(() => localStorage.getItem('gmt_selfcheck_gone'));
  ok(fresh === null, 'بعد ردّها يُنسى الغياب السابق (لا يُؤكَّد لاحقاً على غيابٍ قديم)');
  /* كل القواعد لا تردّ (لا إنترنت) ⇒ تنبيه لا مشكلة */
  await ctx.route('**/*.supabase.co/**', r => r.abort('internetdisconnected'));
  const db4 = await pg.evaluate(() => GMTSelfCheck.checkDatabase());
  ok(db4.level === 'warn' && /لا اتصال/.test(db4.title), 'لا إنترنت ⇒ تنبيه «لا اتصال» لا «متوقّفة»: ' + db4.title);
  /* ملفٌّ لم يردّ (الشبكة) ⇒ ليس «ناقصاً» · ملفٌّ 404 ⇒ ناقص */
  await ctx.route('**/logo.jpg*', r => r.abort('connectionreset'));
  const as1 = await pg.evaluate(() => { const i = new Image(); i.src = 'logo.jpg'; i.style.display = 'none'; document.body.appendChild(i); return GMTSelfCheck.checkAssets(); });
  ok(as1.level !== 'bad', 'ملفٌّ لم يردّ بسبب الشبكة ⇒ ليس «أصول ناقصة»: ' + as1.title);
  await ctx.unroute('**/logo.jpg*');
  const as2 = await pg.evaluate(() => { const i = new Image(); i.src = 'no_such_file_xyz.png'; i.style.display = 'none'; document.body.appendChild(i); return GMTSelfCheck.checkAssets(); });
  ok(as2.level === 'bad' && /no_such_file_xyz/.test(as2.detail), 'ملفٌّ غير موجود فعلاً (404) ⇒ «أصول ناقصة»: ' + as2.title);
  await browser.close();
  /* site.html بلا قاعدته ⇒ احتياطيٌّ بلا أخطاء */
  const s = await H.open('site.html', { w: 390, h: 800, wait: 1 });
  await s.ctx.route('https://znpakcaizvkwqzhosxvm.supabase.co/**', r => r.abort('namenotresolved'));
  await s.pg.reload({ waitUntil: 'domcontentloaded' }); await s.pg.waitForTimeout(3500);
  const site = await s.pg.evaluate(() => ({ len: document.body.innerText.length, links: document.querySelectorAll('a[href]').length }));
  ok(site.len > 200 && site.links >= 3 && !s.errs.filter(e => !/Failed to load resource|ERR_NAME_NOT_RESOLVED/.test(e)).length, `site.html بلا قاعدته: يعمل بالاحتياطي (${site.len} حرفاً · ${site.links} روابط)`);
  await s.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
