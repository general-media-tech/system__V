// (ARC-MD-06#19 · OWN-ROW-CAP) Supabase يُرجع 1000 صفّ كحدّ أقصى مهما كان limit ⇒ GMTFetchAll يجلب الكلّ صفحةً صفحة
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const N = 2500, now = Date.now();
  await H.call('/rest/v1/gmt_manual_debts', Array.from({ length: N }, (_, i) => ({ person_name: 'دين ' + i, amount: 1, created_at: new Date(now - i * 1000).toISOString() })));
  await H.call('/rest/v1/gmt_orders', Array.from({ length: N }, (_, i) => ({ name: 'زبون ' + i, phone: '09' + String(i).padStart(8, '0'), status: 'new', price: 1, branch: 'حلب', created_at: new Date(now - i * 1000).toISOString() })));
  await H.call('/rest/v1/products', Array.from({ length: 1500 }, (_, i) => ({ name: 'منتج سقف ' + i, barcode: 'RC' + String(i).padStart(5, '0'), price: 10, haleb: 1 })));
  await H.call('/__opts', { max_rows: 1000 });

  /* ① المساعد نفسه: قطعٌ صامت عند 1000 ⇒ الكلّ */
  let { browser, pg, errs } = await H.open('admin_pos.html', { w: 1366, h: 900, mobile: false, wait: 5000 });
  const r = await pg.evaluate(async () => {
    const one = await sb('GET', '/rest/v1/gmt_manual_debts?limit=5000');
    const all = await GMTFetchAll(p => sb('GET', p), '/rest/v1/gmt_manual_debts?order=created_at.desc&limit=5000');
    const ids = new Set(all.map(x => x.id));
    await loadManualDebts();
    return { one: one.length, all: all.length, uniq: ids.size, first: all[0] && all[0].person_name, debts: allManualDebts.length };
  });
  ok(r.one === 1000, 'المحاكي يقطع عند 1000 كـSupabase (limit=5000 ⇒ ' + r.one + ')');
  ok(r.all === N && r.uniq === N, 'GMTFetchAll يجلب الكلّ بلا تكرار: ' + r.all + ' / فريد ' + r.uniq);
  ok(r.first === 'دين 0', 'الترتيب المطلوب محفوظ (الأحدث أولاً): ' + r.first);
  ok(r.debts === N, 'الديون اليدوية في المحاسبة كلّها لا أوّل 1000: ' + r.debts);
  const real = errs.filter(e => !/status of (400|401|404|406)|Failed to load resource|favicon|vibrate/.test(e));
  ok(!real.length, 'لا أخطاء JS في الأدمن ' + real.slice(0, 2).join(' / '));
  await browser.close();

  /* ② الأوردرات: قائمة النافذة الزمنية كلّها */
  ({ browser, pg, errs } = await H.open('orders.html', { w: 1366, h: 900, mobile: false, wait: 5000 }));
  const o = await pg.evaluate(async () => (await sbGet()).length);
  ok(o === N, 'الأوردرات: sbGet يُرجع كلّ ' + N + ' (كان 1000): ' + o);
  await browser.close();

  /* ③ نقطة البيع/المشتريات: المساعد متاح وget يرمي عند الفشل فيُعاد بلا ترتيب id */
  ({ browser, pg, errs } = await H.open('purchase.html', { w: 1366, h: 900, mobile: false, wait: 5000 }));
  const np = await pg.evaluate(() => prods.length);
  ok(np >= 1512, 'كاش المنتجات (GMTCache.syncCollection) يحمّل كلّ المنتجات لا أوّل 1000: ' + np);
  const p = await pg.evaluate(async () => {
    const seen = [];
    const got = await GMTFetchAll(async (path) => { seen.push(path); if (/,id\.|order=id/.test(path)) throw new Error('42703'); return [{ k: 1 }]; }, '/rest/v1/gmt_settings?select=key&limit=5000');
    return { n: got.length, seen };
  });
  ok(p.n === 1 && p.seen.length === 2 && !/limit=5000/.test(p.seen.join(' ')), 'جدولٌ يرفض ترتيب id ⇒ رجوعٌ للمسار الأصلي (وlimit القديم يُزال): ' + p.seen.join(' | '));
  await browser.close();

  await H.call('/__opts', { max_rows: 0 });
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
