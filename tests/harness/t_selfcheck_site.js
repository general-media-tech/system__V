// (23 ت1 · TASK-0132) تقرير الصحّة (المالك seq 34): ① «ألوان خارج الهوية (#1e40af)» في orders.html — شارة «من أدخله» على كل أوردر
// كانت زرقاء ⇒ رماديّة · ② «SITE تعذّر الاتصال» في كل تقرير: مشروع قاعدة الموقع لم يعد له عنوان (DNS) ⇒ الفحص يقولها صراحةً
// (قاعدةٌ لا تردّ — محذوفة أو موقوفة) بدل «جداول مفقودة»، وsite.html يعمل بالاحتياطي.
const H = require('./h.js');
let pass = 0, fails = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✔', m); } else { fails++; console.log('  ✘', m); } };
(async () => {
  await H.seed();
  await H.call('/rest/v1/gmt_orders', [1, 2, 3, 4].map(i => ({ name: 'زبون ' + i, phone: '093300050' + i, product: 'كاميرا', qty: 1, price: 100, status: 'pending', branch: 'حلب', address: 'حمص', entered_by: 'سامر' })));
  const { browser, ctx, pg, errs } = await H.open('orders.html', { w: 1366, h: 900, wait: 4500, mobile: false, siteUrl: 'https://znpakcaizvkwqzhosxvm.supabase.co' });
  /* ① الهوية: بعد عرض الأوردرات (الشارة مكرّرة) */
  const brand = await pg.evaluate(() => window.GMTSelfCheck ? GMTSelfCheck.checkBrand() : null);
  const html = await pg.evaluate(() => (document.documentElement.innerHTML.match(/#1e40af/gi) || []).length);
  const badges = await pg.evaluate(() => [...document.querySelectorAll('span')].filter(s => /سامر/.test(s.textContent)).length);
  ok(brand && brand.level === 'ok' && html === 0 && badges >= 3, `orders.html: الهوية سليمة (#1e40af ×${html} · شارات «من أدخله» ${badges}) — ${brand && brand.title}`);
  /* ② قاعدة الموقع لا تردّ (كالواقع: لا DNS) والبقيّة تردّ */
  await ctx.route('https://znpakcaizvkwqzhosxvm.supabase.co/**', r => r.abort('namenotresolved'));
  const db = await pg.evaluate(() => GMTSelfCheck.checkDatabase());
  ok(db.level === 'bad' && /قاعدةٌ لا تردّ: SITE/.test(db.title) && /محذوف أو موقوف/.test(db.detail) && !/جداول مفقودة/.test(db.title), 'SITE لا تردّ ⇒ «قاعدةٌ لا تردّ» بسببٍ وحلّ: ' + db.title);
  await ctx.unroute('https://znpakcaizvkwqzhosxvm.supabase.co/**');
  const db2 = await pg.evaluate(() => GMTSelfCheck.checkDatabase());
  ok(db2.level === 'ok', 'كل القواعد تردّ ⇒ سليم: ' + db2.title);
  await browser.close();
  /* site.html بلا قاعدته ⇒ احتياطيٌّ بلا أخطاء */
  const s = await H.open('site.html', { w: 390, h: 800, wait: 1, siteUrl: 'https://znpakcaizvkwqzhosxvm.supabase.co' });
  await s.ctx.route('https://znpakcaizvkwqzhosxvm.supabase.co/**', r => r.abort('namenotresolved'));
  await s.pg.reload({ waitUntil: 'domcontentloaded' }); await s.pg.waitForTimeout(3500);
  const site = await s.pg.evaluate(() => ({ len: document.body.innerText.length, links: document.querySelectorAll('a[href]').length }));
  ok(site.len > 200 && site.links >= 3 && !s.errs.filter(e => !/Failed to load resource|ERR_NAME_NOT_RESOLVED/.test(e)).length, `site.html بلا قاعدته: يعمل بالاحتياطي (${site.len} حرفاً · ${site.links} روابط)`);
  await s.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
