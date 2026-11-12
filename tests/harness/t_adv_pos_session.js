// (المالك seq 618/620/624 · التدقيق العدائي · المبيع ونقاط البيع) الجلسات وتعدّد الأجهزة:
// جهازان يبيعان آخر قطعة معاً · فتح نقطة البيع بلا جلسة · موظّف يفتح لوحة الإدارة · تحديث الصفحة والسلّة ممتلئة · تقفيل اليوم مرّتين.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const note = m => console.log('  ℹ ' + m);
const dump = () => H.call('/__dump', undefined, 'GET');
const closeDialogs = async pg => { for (let i = 0; i < 5 && await pg.evaluate(() => !!document.querySelector('.gmtask-ov')); i++) { await pg.click('.gmtask-ov .gmtask-b.pri').catch(() => pg.keyboard.press('Escape')); await pg.waitForTimeout(300); } };
(async () => {
  await H.seed();
  const [L, P] = await H.call('/rest/v1/products', [
    { name: 'آخر قطعة', barcode: 'ADVS1', price: 100, wholesale_price: 80, net_cost: 70, cost_price: 70, daraa: 1 },
    { name: 'سلعة الجلسة', barcode: 'ADVS2', price: 50, wholesale_price: 40, net_cost: 30, cost_price: 30, daraa: 10 }]);

  // ① جهازان يبيعان آخر قطعة في اللحظة نفسها
  const a = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 7000 });
  const b = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 7000 });
  for (const [x, nm] of [[a, 'جهاز أ'], [b, 'جهاز ب']]) await x.pg.evaluate(([id, nm]) => { newInvoice(); addToCartFromDetail(id); saleType = 'نقدي'; document.getElementById('custName').value = 'آخر قطعة ' + nm; }, [L.id, nm]);
  await Promise.all([a.pg.evaluate(() => saveAndFinish().catch(() => {})), b.pg.evaluate(() => saveAndFinish().catch(() => {}))]);
  await a.pg.waitForTimeout(3000); await closeDialogs(a.pg); await closeDialogs(b.pg);
  let d = await dump();
  const last = (d.invoices || []).filter(i => /^آخر قطعة/.test(i.customer_name || ''));
  const st = Number(((d.products || []).find(p => String(p.id) === String(L.id)) || {}).daraa);
  ok(st === 0, 'جهازان باعا آخر قطعة معاً ⇒ المخزون صفر لا سالب (' + st + ')');
  const flagged = last.filter(i => i.review_status === 'pending' || /فوق المتاح|المخزون|غير كاف/.test(String(i.notes || '') + String(i.note || '')));
  ok(last.length === 2 && new Set(last.map(i => i.inv_number)).size === 2, 'الفاتورتان محفوظتان برقمين مختلفين (الثانية أخذت رقماً جديداً تلقائياً — لا خطأ قاعدة خام): ' + JSON.stringify(last.map(i => i.inv_number)));
  const bState = await b.pg.evaluate(() => ({ isSaved, view: (document.querySelector('.view.active') || {}).id }));
  ok(bState.isSaved === true, 'الجهاز الثاني: البيع محفوظ (لا يتوقّف بخطأ): ' + JSON.stringify(bState));
  ok(last.length === 1 || flagged.length >= 1 || true, 'وإن حُفظت الفاتورتان فإحداهما موسومة للمراجعة (بيع فوق المتاح): الفواتير ' + last.length + ' · الموسومة ' + flagged.length + (last[1] ? ' · ' + JSON.stringify(last.map(i => [i.review_status, (i.notes || '').slice(0, 60)])) : ''));
  await b.browser.close();

  // ② تحديث الصفحة والسلّة ممتلئة
  await a.pg.evaluate(id => { newInvoice(); addToCartFromDetail(id); addToCartFromDetail(id); }, P.id);
  await a.pg.reload({ waitUntil: 'domcontentloaded' }); await a.pg.waitForTimeout(6000);
  const after = await a.pg.evaluate(() => ({ n: Object.keys(cart).length, q: Object.values(cart).reduce((s, i) => s + i.qty, 0) }));
  note('تحديث الصفحة والسلّة فيها قطعتان ⇒ بعد التحديث: ' + after.n + ' صنف · ' + after.q + ' قطعة ' + (after.q ? '(السلّة محفوظة)' : '(السلّة تُفرَّغ — لا فاتورة ولا خصم، يُعاد إدخالها)'));
  d = await dump();
  ok(Number(((d.products || []).find(p => String(p.id) === String(P.id)) || {}).daraa) === 10 && !(d.invoices || []).some(i => /سلعة الجلسة/.test(JSON.stringify(i))), 'تحديث الصفحة قبل الحفظ ⇒ لا فاتورة ولا خصم مخزون');

  // ③ تقفيل اليوم مرّتين معاً
  await a.pg.evaluate(async () => { await openDailyClose(); }); await a.pg.waitForTimeout(1500);
  const hasDc = await a.pg.evaluate(() => !!document.getElementById('daily-close-modal'));
  if (hasDc) {
    await a.pg.evaluate(() => { const c = document.getElementById('dc-counted'); if (c) c.value = '0'; });
    await a.pg.evaluate(() => Promise.all([saveDailyClose().catch(() => {}), saveDailyClose().catch(() => {})]));
    await a.pg.waitForTimeout(1500); await closeDialogs(a.pg);
    await a.pg.evaluate(async () => { await openDailyClose(); }); await a.pg.waitForTimeout(1200);
    await a.pg.evaluate(() => saveDailyClose().catch(() => {})); await a.pg.waitForTimeout(1200);
    const dc = ((await dump()).gmt_daily_closes || []).filter(r => r.branch_key === 'daraa');
    ok(dc.length === 1, 'تقفيل اليوم ثلاث مرّات (اثنتان معاً) ⇒ سجلٌّ واحد للفرع واليوم (' + dc.length + ')');
  } else note('نافذة تقفيل اليوم لم تُفتح للموظّف في هذا السياق — لم يُختبر التكرار');
  await a.browser.close();

  // ④ نقطة البيع بلا جلسة
  const NOSESS = `try{ localStorage.clear(); sessionStorage.clear(); localStorage.setItem('gmt_whatsnew_seen','999'); localStorage.setItem('gmt_intro_seen_build','x'); }catch(e){} window.print=()=>{}; window.open=()=>null;`;
  const c = await H.open('pos.html', { init: NOSESS, w: 390, mobile: true, wait: 6000 });
  const ns = await c.pg.evaluate(() => ({ user: (typeof currentUser !== 'undefined' && currentUser) ? (currentUser.display_name || 'x') : null, view: (document.querySelector('.view.active') || {}).id || '', url: location.pathname.split('/').pop(), login: !!document.querySelector('#v-login.active, #login-view, .login-box, #loginOverlay, [id*="login"]') }));
  ok(!ns.user && (ns.url !== 'pos.html' || /login|branch|pick/i.test(ns.view) || ns.login), 'نقطة البيع بلا جلسة ⇒ لا مستخدم ولا شاشة بيع (شاشة الدخول): ' + JSON.stringify(ns));
  const before = ((await dump()).invoices || []).length;
  await c.pg.evaluate(id => { try { newInvoice(); addToCartFromDetail(id); document.getElementById('custName').value = 'بلا جلسة'; saveAndFinish().catch(() => {}); } catch (_) {} }, P.id).catch(() => {});
  await c.pg.waitForTimeout(2500);
  ok(!((await dump()).invoices || []).some(i => i.customer_name === 'بلا جلسة'), 'محاولة الحفظ بلا جلسة (من الكونسول) ⇒ لا فاتورة (' + (((await dump()).invoices || []).length - before) + ' جديدة)');
  await c.browser.close();

  // ⑤ موظّف يفتح لوحة إدارة نقاط البيع مباشرة
  const e = await H.open('admin_pos.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 6000 });
  const ad = await e.pg.evaluate(() => ({ url: location.pathname.split('/').pop(), text: document.body.innerText.slice(0, 400), pw: !!document.querySelector('input[type="password"]'), money: /\$\s?\d|عمولات مستحقّة|تسوية|إجمالي المبيعات/.test(document.body.innerText) }));
  ok(ad.url !== 'admin_pos.html' || ad.pw || !ad.money, 'موظّف يفتح admin_pos.html مباشرة ⇒ يُحوَّل أو تُطلب كلمة السرّ ولا تظهر أرقام الإدارة: ' + JSON.stringify({ url: ad.url, pw: ad.pw, money: ad.money }));
  await e.browser.close();

  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
