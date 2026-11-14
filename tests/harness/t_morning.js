// (TASK-B0395 · seq B693–B694 «كمل كلشي» · اقتراح الأدمن هـ١) اللوحة الصباحية: مبيعات الأمس/اليوم لكلّ فرع · آخر بيع · التحويلات والطلبات المعلّقة
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const D = 864e5, now = Date.now();
const mid = (() => { const x = new Date(); x.setHours(0, 0, 0, 0); return x.getTime(); })();
const iso = t => new Date(t).toISOString();
(async () => {
  await H.seed();
  await H.call('/rest/v1/invoices', [
    { id: 'i1', branch_key: 'haleb', branch_name: 'حلب', total: 100, created_at: iso(mid - D + 3600e3) },          // أمس
    { id: 'i2', branch_key: 'haleb', branch_name: 'حلب', total: 50, created_at: iso(mid - D + 7200e3) },           // أمس
    { id: 'i3', branch_key: 'haleb', branch_name: 'حلب', total: 30, created_at: iso(Math.max(mid + 60e3, now - 60e3)) }, // اليوم
    { id: 'i4', branch_key: 'haleb', branch_name: 'حلب', total: -20, is_refund: true, created_at: iso(mid - D + 9000e3) }, // مرتجع أمس
    { id: 'i5', branch_key: 'kurani', branch_name: 'كوراني', total: 999, created_at: iso(mid - 10 * D) },          // قديم ⇒ آخر بيع أحمر
  ]);
  await H.call('/rest/v1/branch_stock_transfers', [
    { id: 't1', transfer_number: 'TRF-00015', from_branch_name: 'الإدارة', to_branch_name: 'حلب', status: 'pending', created_at: iso(now - 4 * D) },
    { id: 't2', transfer_number: 'TRF-00009', from_branch_name: 'حلب', to_branch_name: 'كوراني', status: 'received', created_at: iso(now - 9 * D) },
  ]);
  await H.call('/rest/v1/stock_transfer_items', [{ id: 's1', transfer_id: 't1', qty: 5 }, { id: 's2', transfer_id: 't1', qty: 3 }]);
  await H.call('/rest/v1/gmt_orders', [
    { id: 1, order_number: 'ORD-1', name: 'زبون أ', product: 'كاميرا', price: 700, status: 'pending', created_at: iso(now - 5 * D) },
    { id: 2, order_number: 'ORD-2', name: 'زبون ب', product: 'عدسة', price: 300, status: 'pending', is_deleted: true, created_at: iso(now - D) },
    { id: 3, order_number: 'ORD-3', name: 'زبون ج', product: 'حقيبة', price: 30, status: 'completed', created_at: iso(now - D) },
  ]);
  await H.call('/rest/v1/gmt_audit', [{ id: 'a1', action: 'unmet_demand', entity_name: 'DJI Mini 4', at: iso(now - D) }, { id: 'a2', action: 'unmet_demand', entity_name: 'DJI Mini 4', at: iso(now - 2 * D) }, { id: 'a3', action: 'unmet_demand', entity_name: 'R5', at: iso(now - 20 * D) }]);
  const o = await H.open('morning.html', { w: 1100, h: 1000, mobile: false, wait: 4000 });
  const r = await o.pg.evaluate(() => {
    const v = id => document.querySelector('#' + id + ' .v').textContent, k = id => document.querySelector('#' + id + ' .k').textContent;
    const row = b => { const tr = document.querySelector('#m-br tr[data-br="' + b + '"]'); return tr ? [...tr.children].map(td => td.innerText.trim()) : null; };
    return { y: v('s-y'), yk: k('s-y'), t: v('s-t'), trf: v('s-trf'), ord: v('s-ord'), dem: v('s-dem'), h: row('حلب'), k: row('كوراني'),
      kOld: !!document.querySelector('#m-br tr[data-br="كوراني"] td.old'), trfRows: document.querySelectorAll('#m-trf tr[data-trf]').length, trfTxt: document.getElementById('m-trf').innerText,
      ordRows: [...document.querySelectorAll('#m-ord tr[data-ord]')].map(x => x.dataset.ord), locked: document.documentElement.classList.contains('gmt-locked') };
  });
  ok(!r.locked, '⓪ الأدمن يفتح اللوحة');
  ok(r.y === '$150' && /2 فاتورة/.test(r.yk) && r.t === '$30', '① مبيعات الأمس $150 (فاتورتان، بلا المرتجع) واليوم $30 ' + JSON.stringify([r.y, r.yk, r.t]));
  ok(r.h && /\$150/.test(r.h[1]) && /\$30/.test(r.h[2]) && /\$20/.test(r.h[3]), '② صفّ حلب: الأمس · اليوم · المرتجع ' + JSON.stringify(r.h));
  ok(r.k && r.k[1] === '—' && r.kOld, '③ كوراني لم يبع منذ ١٠ أيام ⇒ آخر بيع بالأحمر ' + JSON.stringify(r.k));
  ok(r.trf === '1' && r.trfRows === 1 && /TRF-00015/.test(r.trfTxt) && /الإدارة ← حلب/.test(r.trfTxt) && /2 بند · 8 قطعة/.test(r.trfTxt), '④ التحويل المعلّق وحده (من ← إلى · البنود والقطع) ' + r.trfTxt.replace(/\s+/g, ' ').slice(0, 120));
  ok(r.ord === '1' && JSON.stringify(r.ordRows) === '["1"]', '⑤ الطلبات المعلّقة بلا المحذوف ولا المكتمل ' + JSON.stringify(r.ordRows));
  ok(r.dem === '1', '⑥ طلبات غير متوفّرة آخر ٧ أيام = منتج واحد (بلا تكرار ولا القديم) ' + r.dem);
  const real = o.errs.filter(e => !/status of (400|401|404|406)|Failed to load resource|favicon|AudioContext/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await o.pg.screenshot({ path: '/tmp/claude-0/-home-user/c15c36cd-5ab9-561f-b25b-b44644a4d063/scratchpad/morning.jpg', type: 'jpeg', quality: 70 });
  await o.browser.close();
  const o2 = await H.open('morning.html', { init: H.STAFF_INIT, w: 600, h: 800, mobile: false, wait: 3000 });
  const lk = await o2.pg.evaluate(() => document.documentElement.classList.contains('gmt-locked'));
  ok(lk, '⑦ الموظّف العادي: الصفحة مقفولة (للإدارة)');
  await o2.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
