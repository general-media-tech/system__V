// (19 ت1 · TASK-0108) لقطة المالك: «لوحة الإشعارات لا يجب أن تُدخل مستخدماً عادياً إلى فواتير النقل والأشياء السياديّة»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const ADMIN_TABLES = /branch_stock_transfers|import_log|gmt_job_applications|gmt_expenses|invoice_commissions|gmt_users\?/;
async function probe(init, label, w) {
  const { browser, ctx, pg, errs } = await H.open('home.html', { init, w, mobile: w < 700, wait: 3500 });
  const asked = []; pg.on('request', r => { const u = decodeURIComponent(r.url()); if (/\/rest\/v1\//.test(u)) asked.push(u.split('/rest/v1/')[1]); });
  await pg.evaluate(() => GMTNotify.open()); await pg.waitForTimeout(1500);
  const rows = await pg.evaluate(() => [...document.querySelectorAll('.gn-row')].map(r => ({ t: r.querySelector('.gn-t').innerText, go: (r.querySelector('.gn-go') || {}).getAttribute ? r.querySelector('.gn-go').getAttribute('href') : '' })));
  const links = await pg.evaluate(() => [...document.querySelectorAll('.gn-go')].map(a => a.getAttribute('href')));
  const ids = await pg.evaluate(() => GMTNotify.visibleItems().map(i => i.id));
  await browser.close();
  return { rows, links, ids, asked: asked.filter(a => ADMIN_TABLES.test(a)), errs };
}
(async () => {
  await H.seed();
  // بيانات تجعل البنود الإداريّة غير صفريّة: فاتورة نقل لم تُستلم
  try { await H.call('/rest/v1/branch_stock_transfers', { transfer_number: 'TR-NP-1', status: 'sent', from_branch: 'haleb', to_branch: 'daraa' }); } catch (_) {}
  for (const w of [390, 1366]) {
    console.log('— ' + w);
    const a = await probe(H.ADMIN_INIT, 'admin', w);
    ok(a.ids.includes('transfers_unconfirmed') && a.ids.includes('expenses_pending') && a.ids.includes('accounts_pending'), 'الأدمن يرى كلّ البنود (' + a.ids.length + ')');
    ok(a.rows.some(r => /فواتير نقل/.test(r.t)), 'الأدمن: بند فواتير النقل ظاهر في اللوحة');
    const s = await probe(H.STAFF_INIT, 'staff', w);
    ok(!s.rows.some(r => /فواتير نقل|مصاريف|عمولات|حسابات|توظيف|استيراد/.test(r.t)), 'الموظّف: لا بند نقلٍ ولا سياديّ — ظاهر: ' + s.rows.map(r => r.t.slice(0, 18)).join(' | '));
    ok(!s.links.some(h => /admin_pos|purchase|الأمان|أدمن_التوظيف/.test(h)), 'الموظّف: لا زرّ يوصل لصفحة سياديّة');
    ok(s.asked.length === 0, 'الموظّف: لا سؤال للقاعدة عن جداول السياديّة' + (s.asked.length ? ' — سُئل: ' + s.asked.join(', ') : ''));
    ok(s.rows.some(r => /بانتظار التجهيز/.test(r.t)), 'الموظّف: بنود الأوردرات باقية');
    // موظّف مُنح «المشتريات» بالاسم ⇒ يظهر بند الاستيراد وحده من البنود الإداريّة
    try { await H.call('/rest/v1/gmt_settings?on_conflict=key', [{ key: 'tool_grants_2', value: JSON.stringify(['purchase.html']) }]); } catch (_) {}
    const g = await probe(H.STAFF_INIT + `try{localStorage.setItem('gmt_grants_2', JSON.stringify(['purchase.html']));}catch(e){}`, 'granted', w);
    try { await H.call('/rest/v1/gmt_settings?key=eq.tool_grants_2', null, 'DELETE'); } catch (_) {}
    ok(g.ids.includes('imports_not_transferred') && !g.ids.includes('transfers_unconfirmed') && !g.ids.includes('expenses_pending'), 'الموظّف الممنوح «المشتريات»: يظهر بندها فقط — ' + g.ids.join(','));
    ok(!a.errs.length && !s.errs.length && !g.errs.length, 'لا أخطاء JS ' + [...a.errs, ...s.errs, ...g.errs].slice(0, 2).join(' / '));
  }
  // الجرد: تبويب «النقل» للموظّف يطلب كلمة الأدمن ولا تُفتح الفواتير
  for (const w of [390, 1366]) {
    const { browser, pg, errs } = await H.open('inventory.html', { init: H.STAFF_INIT, w, mobile: w < 700, wait: 5000 });
    const r = await pg.evaluate(async () => {
      const b = document.getElementById('mode-btn-transfer'); if (!b) return { none: true };
      b.click(); await new Promise(z => setTimeout(z, 700));
      const p = document.getElementById('transfer-panel');
      return { open: !!p && p.style.display !== 'none' && p.offsetParent !== null, ask: !!document.querySelector('.gmtask-ov') };
    });
    ok(!r.none && !r.open && r.ask, w + ' الجرد: «النقل» للموظّف يطلب الأدمن ولا يفتح الفواتير ' + JSON.stringify(r));
    await browser.close();
    const A = await H.open('inventory.html', { init: H.ADMIN_INIT, w, mobile: w < 700, wait: 5000 });
    const ra = await A.pg.evaluate(async () => { document.getElementById('mode-btn-transfer').click(); await new Promise(z => setTimeout(z, 700)); const p = document.getElementById('transfer-panel'); return p && p.style.display !== 'none'; });
    ok(ra, w + ' الجرد: الأدمن يفتح «النقل» مباشرة');
    await A.browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
