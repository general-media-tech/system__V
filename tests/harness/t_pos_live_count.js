// (TASK-A0571/A0572 · المالك seq 970) نقطة البيع:
//  ① أوّل فتح بإنترنت بطيء ⇒ شاشة تجهيز فوراً (لا شاشة بيضاء) · وتختفي حين تجهز الصفحة
//  ② التحديث من الخادم ليس مرّةً واحدة: دورةٌ تلتقط تغيّر السعر والكمّية بعد الفتح
//  ③ الجرد: «المسجّل» من الخادم الآن لا من ذاكرة الجهاز
//  ④ مسح الباركود ⇒ يظهر المنتج والمؤشّر في خانة العدد (لا +١ تلقائيّ) ⇒ اكتب الحقيقيّ + Enter ⇒ عودة لخانة المسح
//  ⑤ «كل مسحة تعدّ قطعة» اختياريّ · ⑥ تقرير الجرد يحسب على كمّيات الخادم لحظة الإرسال
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const [P] = await H.call('/rest/v1/products', [{ name: 'منتج جرد A0572', barcode: 'SC0572', price: 20, wholesale_price: 12, net_cost: 8, cost_price: 8, daraa: 5, updated_at: new Date(Date.now() - 3600e3).toISOString() }]);
  // ① شاشة التجهيز مع سكربتٍ بطيء
  {
    const { chromium } = require('playwright');
    const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 800 } });
    await ctx.addInitScript(H.STAFF_INIT);
    await ctx.route('**/gmt-core.js*', async r => { await sleep(3000); r.continue(); });
    const pg = await ctx.newPage();
    pg.goto(H.BASE + '/pos.html').catch(() => {});
    await sleep(1500);
    const early = await pg.evaluate(() => { const s = document.getElementById('gmt-first-splash'); return !!s && getComputedStyle(s).display !== 'none' && /تجهيز نقطة البيع/.test(s.innerText); }).catch(() => false);
    ok(early, '① أثناء تنزيل الملفّات: شاشة «جارٍ تجهيز نقطة البيع» ظاهرة (لا شاشة بيضاء)');
    await sleep(6000);
    const gone = await pg.evaluate(() => !document.getElementById('gmt-first-splash')).catch(() => false);
    ok(gone, '① وتختفي حين تجهز الصفحة');
    await b.close();
  }
  const { browser, pg, errs } = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 7000 });
  const prodOf = () => pg.evaluate((id) => { const p = allProducts.find(x => String(x.id) === String(id)); return p ? { price: p.price, daraa: p.daraa } : null; }, P.id);
  ok(!!(await prodOf()), 'المنتج محمَّل في نقطة البيع');
  // ②
  await H.call('/rest/v1/products?id=eq.' + P.id, { price: 23, daraa: 6, updated_at: new Date().toISOString() }, 'PATCH');
  const hasTimer = await pg.evaluate(() => !!_posSyncTimer);
  await pg.evaluate(() => { _posSyncAt = 0; return _posLiveSync({}); }); await sleep(800);
  const p2 = await prodOf();
  ok(hasTimer && p2.price === 23 && p2.daraa === 6, '② التحديث الدوريّ مفعَّل ويلتقط السعر والكمّية بعد الفتح (' + JSON.stringify(p2) + ')');
  // ③ الخادم 7 والجهاز 6
  await H.call('/rest/v1/products?id=eq.' + P.id, { daraa: 7 }, 'PATCH');
  await pg.evaluate(() => { try { localStorage.removeItem('gmt_stockcount_' + branch.key); localStorage.removeItem('gmt_sc_scan_adds'); } catch (_) {} openStockCount(); });
  await sleep(1200);
  const s3 = await pg.evaluate((id) => ({ sys: allProducts.find(x => String(x.id) === String(id)).daraa, live: document.getElementById('sc-live-at').textContent }), P.id);
  ok(s3.sys === 7 && /من الخادم الآن/.test(s3.live), '③ الجرد: «المسجّل» من الخادم (7 لا 6): ' + s3.sys + ' · ' + s3.live);
  // ④
  await pg.fill('#sc-search', 'SC0572'); await pg.press('#sc-search', 'Enter'); await sleep(300);
  const s4 = await pg.evaluate((id) => ({ act: document.activeElement && document.activeElement.getAttribute('data-sc-id'), cnt: _scCounts[id], rows: document.querySelectorAll('#sc-list input[data-sc-id]').length, txt: document.getElementById('sc-list').innerText }), P.id);
  ok(s4.act === String(P.id) && s4.cnt === undefined && s4.rows === 1 && /المسجّل في النظام: 7/.test(s4.txt), '④ المسح ⇒ المنتج وحده بكمّيته المسجّلة (7) والمؤشّر في خانة العدد · بلا +١ ' + JSON.stringify({ act: s4.act, cnt: s4.cnt, rows: s4.rows }));
  await pg.keyboard.type('5'); await pg.keyboard.press('Enter'); await sleep(300);
  const s4b = await pg.evaluate((id) => ({ cnt: _scCounts[id], act: document.activeElement && document.activeElement.id, q: document.getElementById('sc-search').value, txt: document.getElementById('sc-list').innerText }), P.id);
  ok(s4b.cnt === 5 && s4b.act === 'sc-search' && s4b.q === '', '④ كتب العدد الحقيقيّ 5 + Enter ⇒ حُفظ وعاد المؤشّر لخانة المسح ' + JSON.stringify({ cnt: s4b.cnt, act: s4b.act }));
  ok(/2- نقص|-2 نقص/.test(s4b.txt), '④ والفرق «2- نقص» ظاهر');
  // ⑤
  await pg.check('#sc-scan-adds');
  for (let i = 0; i < 2; i++) { await pg.fill('#sc-search', 'SC0572'); await pg.press('#sc-search', 'Enter'); await sleep(200); }
  const c5 = await pg.evaluate((id) => _scCounts[id], P.id);
  ok(c5 === 7, '⑤ «كل مسحة تعدّ قطعة» (اختياريّ): 5 + مسحتان = 7: ' + c5);
  await pg.uncheck('#sc-scan-adds');
  // ⑥ بيعٌ أثناء الجرد: الخادم 4
  await H.call('/rest/v1/products?id=eq.' + P.id, { daraa: 4 }, 'PATCH');
  await pg.evaluate((id) => { _posSign = async () => { window.__sysAtReport = allProducts.find(x => String(x.id) === String(id)).daraa; return null; }; return scFinishAndReport(); }, P.id);
  await sleep(500);
  const s6 = await pg.evaluate(() => window.__sysAtReport);
  ok(s6 === 4, '⑥ تقرير الجرد يحسب الفرق على كمّية الخادم لحظة الإرسال (4): ' + s6);
  const real = errs.filter(x => !/status of (400|401|404|406|409|503)|Failed to load resource/.test(x));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
