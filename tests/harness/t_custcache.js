// اقتراح أسماء الزبائن بلا إنترنت: الأوردرات + نقطة البيع
const H = require('./h.js');
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fails++; };
(async () => {
  await H.seed();
  await H.call('/rest/v1/gmt_customers', [{ name: 'محمود الأحمد', phone: '0944555666', branch_key: 'haleb', branch_name: 'حلب', is_blocked: false }, { name: 'سلمى القاسم', phone: '0955111222', branch_key: 'haleb', is_blocked: false }, { name: 'محظور علي', phone: '0966000111', is_blocked: true }]);
  await H.call('/rest/v1/gmt_orders', [{ name: 'أبو خالد الحمصي', phone: '0933777888', address: 'حمص — جورة الشياح', product: 'x', qty: 1, price: 5, status: 'pending', branch: 'حلب' }]);
  // ١) الأوردرات
  const o = await H.open('orders.html', { w: 390, h: 900, wait: 4500 });
  const n = await o.pg.evaluate(async () => { await GMTCustCache.warm({ base: SUPA_URL, headers: SB_HEADERS, orders: true, force: true }); await new Promise(r => setTimeout(r, 400)); return GMTCustCache.count(); });
  ok(n >= 4, 'الذاكرة امتلأت بالخلفية: ' + n + ' سجلّاً');
  await o.pg.evaluate(() => { const f = window.fetch; window.fetch = (u, ...a) => String(u).includes('supabase') ? Promise.reject(new TypeError('Failed to fetch')) : f(u, ...a); });
  await o.pg.evaluate(() => { document.getElementById('addModal').classList.remove('hidden'); });
  await o.pg.evaluate(() => custSuggest('محمود')); await o.pg.waitForTimeout(900);
  let t = await o.pg.evaluate(() => document.getElementById('in-name-sug').innerText);
  ok(/محمود الأحمد/.test(t) && /لا اتصال/.test(t), 'بلا إنترنت: يقترح «محمود الأحمد» مع تنبيه الذاكرة المحلية');
  await o.pg.evaluate(() => custSuggest('الحمصى')); await o.pg.waitForTimeout(900);   // ى مقابل ي
  t = await o.pg.evaluate(() => document.getElementById('in-name-sug').innerText);
  ok(/أبو خالد الحمصي/.test(t), 'تطبيع الياء/الألف: «الحمصى» ⇠ «الحمصي»');
  await o.pg.evaluate(() => custSuggest('0933777')); await o.pg.waitForTimeout(900);
  t = await o.pg.evaluate(() => document.getElementById('in-name-sug').innerText);
  ok(/أبو خالد/.test(t), 'البحث برقم الهاتف');
  await o.pg.evaluate(() => custSuggest('محظور')); await o.pg.waitForTimeout(900);
  t = await o.pg.evaluate(() => document.getElementById('in-name-sug').innerText);
  ok(!/محظور علي/.test(t), 'المحظور لا يُقترَح');
  await o.pg.evaluate(() => { document.getElementById('in-name').value = ''; custSuggest('محمود'); }); await o.pg.waitForTimeout(900);
  await o.pg.evaluate(() => pickCust(0));
  ok(await o.pg.evaluate(() => document.getElementById('in-phone').value === '0944555666'), 'اختيار الاقتراح يملأ الهاتف');
  await o.browser.close();
  // ٢) نقطة البيع (موظف فرع)
  const p = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, h: 900, wait: 5000 });
  await p.pg.evaluate(async () => { await GMTCustCache.warm({ base: CONFIG.SUPABASE_URL, headers: sbHeaders(), orders: false, force: true }); await new Promise(r => setTimeout(r, 300)); });
  ok(await p.pg.evaluate(() => GMTCustCache.count()) >= 2, 'نقطة البيع: الذاكرة امتلأت');
  await p.pg.evaluate(() => { const f = window.fetch; window.fetch = (u, ...a) => String(u).includes('supabase') ? Promise.reject(new TypeError('Failed to fetch')) : f(u, ...a); });
  const exists = await p.pg.evaluate(() => typeof custSearchLive === 'function' && !!document.getElementById('cust-dropdown'));
  if (exists) {
    await p.pg.evaluate(() => custSearchLive('سلمى')); await p.pg.waitForTimeout(1800);
    const d = await p.pg.evaluate(() => document.getElementById('cust-dropdown').innerText);
    ok(/سلمى القاسم/.test(d) && /لا اتصال/.test(d), 'نقطة البيع بلا إنترنت: يقترح «سلمى القاسم» من الذاكرة');
  } else console.log('  (لا قائمة cust-dropdown ظاهرة في هذا الوضع — تخطّي)');
  console.log('errors:', [...o.errs, ...p.errs].filter(e => !/400|404|Failed|ERR_INTERNET|net::/.test(e)).slice(0, 4));
  await p.browser.close(); console.log(fails ? 'FAILS=' + fails : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
