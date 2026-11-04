// (TASK-0311 ب) فروع المتجر: جدول المتجر بلا عمود branches ⇒ الحفظ يذهب لـgmt_settings (store_branches) في القاعدة الرئيسية،
// وإدارة المتجر تقرؤها بعد إعادة الفتح، وصفحة الموقع تعرضها.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  await H.call('/rest/v1/gmt_store', [{ id: 1, categories: [], products: [], banners: [] }]);
  let { browser, pg, errs } = await H.open('admin_store.html', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 6000 });
  const list = [{ id: 'br1', province: 'حلب', name: 'فرع حلب', address: 'شارع التلل', phone: '0933111222' }, { id: 'br2', province: 'دمشق', name: 'فرع دمشق', phone: '0933999888' }];
  const r1 = await pg.evaluate(async l => { try { await updateField('branches', l); return 'ok'; } catch (e) { return 'ERR ' + e.message; } }, list);
  ok(r1 === 'ok', 'الحفظ لا يفشل: ' + r1);
  const row = ((await H.call('/rest/v1/gmt_settings?key=eq.store_branches&select=value', undefined, 'GET')) || [])[0];
  let saved = []; try { saved = JSON.parse(row.value); } catch (_) {}
  ok(saved.length === 2 && saved[0].name === 'فرع حلب', 'محفوظة في gmt_settings · store_branches: ' + saved.length);
  const back = await pg.evaluate(async () => (await _branchesLoad() || []).length);
  ok(back === 2, 'إدارة المتجر تقرؤها بعد إعادة الفتح: ' + back);
  const real = errs.filter(x => !/Failed to load resource|status of (400|404|406)/.test(x));
  ok(!real.length, 'لا أخطاء JS في إدارة المتجر: ' + JSON.stringify(real.slice(0, 2)));
  await browser.close();
  ({ browser, pg, errs } = await H.open('site.html', { init: `try{ localStorage.setItem('gmt_notif_prompted','1'); }catch(e){}`, w: 1366, h: 900, wait: 5500, mobile: false }));
  const n = await pg.evaluate(() => document.querySelectorAll('#bt-body .bc').length);
  ok(n === 2, 'صفحة الموقع تعرض الفرعين: ' + n);
  await browser.close();
  console.log(fails ? 'FAIL ' + fails + ' / ' + (pass + fails) : 'ALL PASS (' + pass + ')');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
