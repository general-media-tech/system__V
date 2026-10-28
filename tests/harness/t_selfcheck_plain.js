// (25 ت1 · TASK-0177) المالك seq 97/99: «أخفِ الكلمات المكشوفة» (لقطة «نتيجة الفحص الذاتي»: «قاعدةٌ لا تردّ: SITE · المشروع لا يردّ (معرّف المشروع)
// محذوف أو موقوف في Supabase …») + «الاثنين» (كلمات السرّ والكلام التقني). الشريط والنافذة بكلامٍ واضح بلا معرّفات ولا أسماء جداول؛ السجلّ التقني كما هو.
const H = require('./h.js');
let pass = 0, fails = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✔', m); } else { fails++; console.log('  ✘', m); } };
(async () => {
  await H.seed();
  for (const W of [390, 1366]) {
    const { browser, ctx, pg, errs } = await H.open('orders.html', { w: W, h: W < 500 ? 844 : 900, wait: 4500, mobile: W < 500, init: H.ADMIN_INIT });
    await ctx.route('https://znpakcaizvkwqzhosxvm.supabase.co/**', r => r.abort('namenotresolved'));
    // ١) الترجمة نفسها
    const p = await pg.evaluate(async () => { const db = await GMTSelfCheck.checkDatabase(); return { raw: db, x: GMTSelfCheck._plain(db),
      t: GMTSelfCheck._plain({ title: 'جداول مفقودة أو غير متاحة: 2', detail: 'STORE.products مفقود · MAIN.gmt_x (500)' }), a: GMTSelfCheck._plain({ title: 'أصول ناقصة: 3', detail: 'img/a.png · lib/x.js' }) }; });
    const all = JSON.stringify([p.x, p.t, p.a]);
    ok(/قاعدة الموقع الإلكتروني/.test(p.x.t) && /متوقّفة/.test(p.x.t) && /النسخة الاحتياطية/.test(p.x.d) && /القرار عندك/.test(p.x.d), W + ': «SITE لا تردّ» ⇒ «' + p.x.t + '» — ' + p.x.d.slice(0, 70));
    ok(!/znpakcaizvkwqzhosxvm|Supabase|SITE|STORE|MAIN|gmt_|\.js|\.png|products/.test(all), W + ': بلا معرّف مشروع ولا أسماء قواعد/جداول/ملفّات: ' + all.slice(0, 160));
    ok(/قاعدةٌ لا تردّ: SITE/.test(p.raw.title) && /znpakcaizvkwqzhosxvm/.test(p.raw.detail), W + ': النتيجة التقنيّة (للسجلّ) كما هي');
    // ٢) الشريط والنافذة نفسيهما
    await pg.evaluate(async () => { localStorage.removeItem('gmt_selfcheck_last'); const b = document.getElementById('gmt-sc-bar'); if (b) b.remove(); await GMTSelfCheck.run(false); });
    await pg.waitForSelector('#gmt-sc-bar', { timeout: 15000 }).catch(() => {});
    const bar = await pg.evaluate(() => (document.getElementById('gmt-sc-bar') || {}).innerText || '');
    await pg.evaluate(() => { const m = document.getElementById('gmt-sc-more'); if (m) m.click(); });
    await pg.waitForSelector('.gmtask-ov', { timeout: 5000 }).catch(() => {});
    const dlg = await pg.evaluate(() => (document.querySelector('.gmtask-ov') || {}).innerText || '');
    ok(/قاعدة الموقع الإلكتروني/.test(bar) && !/SITE|znpak|Supabase/.test(bar), W + ': الشريط: ' + bar.replace(/\s+/g, ' ').slice(0, 110));
    ok(/نتيجة الفحص الذاتي/.test(dlg) && /قاعدة الموقع الإلكتروني/.test(dlg) && !/SITE|znpak|Supabase|gmt_|#[0-9a-f]{6}/i.test(dlg), W + ': النافذة بكلامٍ واضح: ' + dlg.replace(/\s+/g, ' ').slice(0, 140));
    if (W === 390) await pg.screenshot({ path: '/tmp/gmt-out/selfcheck_plain_' + W + '.png' });
    await browser.close();
  }
  // ٣) كلمة سرّ المستخدم الجديد لا تُكتب ظاهرة
  const o = await H.open('الأمان_والمستخدمون.html', { w: 1366, h: 900, wait: 4000, init: H.ADMIN_INIT });
  const t = await o.pg.evaluate(() => { const i = document.getElementById('u-pw'); return i ? i.type : 'none'; });
  ok(t === 'password', '«الأمان والمستخدمون»: كلمة سرّ المستخدم الجديد مخفيّة أثناء الكتابة (' + t + ')');
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
