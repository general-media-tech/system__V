// (المالك seq 775 «المنتجات اللي بالمانيا أو الصين حط أنها على الطريق · الأشياء اللي لساتها قادمة يكتب أنه تتوفر في تاريخ كذا»)
// ① منتج بلا مخزون + incoming بعد 30 يوماً ⇒ شارة «يتوفّر d/m» على البطاقة وفي النافذة «على الطريق · يتوفّر بتاريخ d/m/yyyy تقريباً»
// ② منتج متوفّر (stock>0) وله incoming ⇒ لا شارة ③ تاريخ فات ⇒ «يتوفّر قريباً» ④ بلا incoming ⇒ لا شيء ⑤ بطاقة نتائج البحث
// ⑥ GMTStoreSync.refreshIncoming على القاعدة الوهمية: بند في فاتورة transit ⇒ الحقل يُكتب · صارت arrived ⇒ يُحذف · بلا تغيير ⇒ لا كتابة
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const plus = n => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
const dmy = d => d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear(), dm = d => d.getDate() + '/' + (d.getMonth() + 1);
const VISITOR = `try{ localStorage.clear(); sessionStorage.clear(); localStorage.setItem('gmt_intro_seen_build','x'); }catch(e){}`;
const d30 = plus(30);
(async () => {
  await H.seed();
  const cats = [{ id: 'c1', name: 'درونات', order: 1 }];
  const prods = [
    { id: 's_a', name: 'درون قادم ثلاثين', price: 100, stock: 0, category_id: 'c1', images: [], incoming: { eta: iso(d30), from: 'germany' } },
    { id: 's_b', name: 'منتج متوفّر وقادم', price: 50, stock: 5, category_id: 'c1', images: [], incoming: { eta: iso(d30), from: 'china' } },
    { id: 's_c', name: 'منتج تاريخه فات', price: 60, stock: 0, category_id: 'c1', images: [], incoming: { eta: iso(plus(-3)), from: 'china' } },
    { id: 's_d', name: 'منتج عادي بلا قدوم', price: 70, stock: 0, category_id: 'c1', images: [] },
  ];
  await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-11-12T10:00:00Z', categories: cats, banners: [], offers: [], branches: [], products: prods }]);
  const o = await H.open('logo.jpg', { init: VISITOR, w: 412, h: 860, mobile: true, wait: 0 });
  await o.ctx.route(/\/storage\/v1\/object\/public\/products-images\/store\/home\.json/, r => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  await o.pg.goto(H.BASE + 'store.html', { waitUntil: 'domcontentloaded' });
  await o.pg.waitForFunction(() => typeof store !== 'undefined' && store.products && store.products.length >= 4 && document.querySelectorAll('h4').length >= 4, null, { timeout: 20000 });
  await o.pg.waitForTimeout(1500);
  const cardBadge = name => o.pg.evaluate(n => { const h = [...document.querySelectorAll('h4')].find(x => x.textContent.trim() === n); if (!h) return null; const b = h.parentElement.querySelector('.gmt-incoming'); return b ? b.textContent.replace(/‎|‏/g, '').trim() : ''; }, name);
  const a = await cardBadge('درون قادم ثلاثين');
  ok(a === '🚢 يتوفّر ' + dm(d30), '① البطاقة: «' + a + '» (المتوقّع 🚢 يتوفّر ' + dm(d30) + ')');
  ok(!/على الطريق/.test(a || ''), '① البطاقة الصغيرة بلا «على الطريق» (مساحة ضيّقة) ولا ذكر لبلد');
  await o.pg.evaluate(() => openProductModal('s_a')); await o.pg.waitForTimeout(800);
  const m = await o.pg.evaluate(() => { const e = document.getElementById('pm-incoming'); return e ? { t: e.textContent.replace(/‎|‏/g, '').trim(), shown: getComputedStyle(e).display !== 'none', ltr: !!e.querySelector('bdi[dir="ltr"]'), country: /ألمانيا|الصين|germany|china/i.test(e.textContent) } : null; });
  ok(m && m.shown && m.t === '🚢 على الطريق · يتوفّر بتاريخ ' + dmy(d30) + ' تقريباً', '① النافذة: «' + (m && m.t) + '»');
  ok(m && m.ltr && !m.country, '① التاريخ داخل bdi dir=ltr ولا يُذكر البلد');
  await o.pg.evaluate(() => openProductModal('s_b')); await o.pg.waitForTimeout(600);
  const mb = await o.pg.evaluate(() => { const e = document.getElementById('pm-incoming'); return !e || getComputedStyle(e).display === 'none' || !e.textContent.trim(); });
  ok(mb, '② منتج متوفّر (stock=5) ⇒ لا سطر «على الطريق» في النافذة');
  ok(await cardBadge('منتج متوفّر وقادم') === '', '② منتج متوفّر ⇒ لا شارة على البطاقة');
  const c = await cardBadge('منتج تاريخه فات');
  ok(c === '🚢 على الطريق · يتوفّر قريباً' || c === '🚢 يتوفّر قريباً', '③ تاريخ فات ⇒ «' + c + '» (لا رقم سالب)');
  await o.pg.evaluate(() => openProductModal('s_c')); await o.pg.waitForTimeout(600);
  const mc = await o.pg.evaluate(() => document.getElementById('pm-incoming').textContent.trim());
  ok(mc === '🚢 على الطريق · يتوفّر قريباً', '③ النافذة: «' + mc + '»');
  ok(await cardBadge('منتج عادي بلا قدوم') === '', '④ بلا incoming ⇒ لا شيء');
  await o.pg.evaluate(() => openProductModal('s_d')); await o.pg.waitForTimeout(600);
  ok(await o.pg.evaluate(() => { const e = document.getElementById('pm-incoming'); return !e || !e.textContent.trim(); }), '④ النافذة بلا incoming ⇒ لا سطر');
  const tot = await o.pg.evaluate(() => ({ g: gmtIncoming({ stock: 0, incoming: { eta: '2026-12-15', from: 'x' } }), none: gmtIncoming({ stock: 0 }), inStock: gmtIncoming({ stock: '3', incoming: { eta: '2026-12-15' } }) }));
  ok(tot.g && tot.g.dmy === '15/12/2026' && tot.g.dm === '15/12' && !tot.none && !tot.inStock, '⑤ gmtIncoming: صيغة 15/12/2026 · 15/12 · بلا incoming أو بمخزون ⇒ null');
  // بطاقة نتائج البحث
  await o.pg.evaluate(() => { const i = document.querySelector('input[type=search], #search-input, input[placeholder*="بحث"]'); if (i) { i.value = 'درون قادم'; i.dispatchEvent(new Event('input', { bubbles: true })); } if (window.performSearch) window.performSearch('درون قادم'); });
  await o.pg.waitForTimeout(1500);
  const sr = await o.pg.evaluate(() => { const c = document.querySelector('#search-results-section [data-sr-id="s_a"]'); const b = c && c.querySelector('.gmt-incoming'); return b ? b.textContent.replace(/‎|‏/g, '').trim() : (c ? '' : null); });
  ok(sr === '🚢 يتوفّر ' + dm(d30), '⑤ بطاقة نتيجة البحث: «' + sr + '»');

  // ⑥ refreshIncoming
  const P = await H.call('/rest/v1/products', [
    { name: 'درون حقيقي', barcode: 'DR0001', price: 100, wholesale_price: 0 }, { name: 'منتج آخر', barcode: 'OT0002', price: 10, wholesale_price: 0 }]);
  const pid = P[0].id, pid2 = P[1].id;
  const storeNow = async () => { const r = await fetch(H.M + '/rest/v1/gmt_store?id=eq.1&select=id,updated_at,products'); return (await r.json())[0]; };
  await H.call('/rest/v1/gmt_store?id=eq.1', { products: [
    { id: 'st1', name: 'درون حقيقي', price: 100, inv_id: pid, images: [] },
    { id: 'st2', name: 'منتج آخر', price: 10, inv_id: pid2, images: [] }] }, 'PATCH');
  const inv = await H.call('/rest/v1/import_log', [{ inv_number: 'IMP-T-1', inv_type: 'germany', status: 'transit', eta_date: '2026-12-15', items_snapshot: [{ id: pid, barcode: 'DR0001', qty: 2 }] }]);
  const invId = inv[0].id;
  const r1 = await o.pg.evaluate(() => GMTStoreSync.refreshIncoming());
  let s = await storeNow(); const p1 = s.products.find(x => x.id === 'st1'), p2 = s.products.find(x => x.id === 'st2');
  ok(r1 && r1.changed && p1.incoming && p1.incoming.eta === '2026-12-15' && p1.incoming.from === 'germany' && !('incoming' in p2), '⑥ فاتورة transit ⇒ p.incoming={2026-12-15, germany} على المنتج المطابق فقط: ' + JSON.stringify(p1.incoming));
  const u1 = s.updated_at;
  const r2 = await o.pg.evaluate(() => GMTStoreSync.refreshIncoming()); s = await storeNow();
  ok(r2 && !r2.changed && s.updated_at === u1, '⑥ لا تغيير ⇒ لا كتابة (updated_at ثابت)');
  await H.call('/rest/v1/import_log?id=eq.' + invId, { status: 'arrived' }, 'PATCH');
  const r3 = await o.pg.evaluate(() => GMTStoreSync.refreshIncoming()); s = await storeNow();
  ok(r3 && r3.changed && !('incoming' in s.products.find(x => x.id === 'st1')), '⑥ الفاتورة صارت arrived ⇒ الحقل يُحذف');
  const real = o.errs.filter(e => !/status of (400|401|404|406)|Failed to load resource|favicon|AudioContext|navigator\.vibrate/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
