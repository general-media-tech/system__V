// (seq B1035 · B1036 · B1044) جرد نقطة البيع: «حفظ ومتابعة لاحقاً» يُحفظ على الخادم ويُسترجع من جهازٍ آخر ·
// القائمة: الموجود أوّلاً ثمّ الصفر · «يُعرض X من Y» بلا قطعٍ صامت · المسودّة لا تظهر في «مطابقة الجرد» · مسح الكاميرا بمعاينة
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const rows = [];
  for (let i = 0; i < 130; i++) rows.push({ name: 'منتج جرد ' + String(i).padStart(3, '0'), barcode: 'WIP' + i, price: 10, daraa: i === 120 ? 5 : 0 });
  const P = await H.call('/rest/v1/products', rows);
  const IN = P[120];
  const open = async () => { const o = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 7000 }); return o; };
  let { browser, pg, errs } = await open();
  await pg.evaluate(() => { try { Object.keys(localStorage).filter(k => /^gmt_stockcount/.test(k)).forEach(k => localStorage.removeItem(k)); } catch (_) {} openStockCount(); });
  await sleep(1500);
  const L = await pg.evaluate(() => { const ids = [...document.querySelectorAll('#sc-list [data-sc-id]')].map(x => x.getAttribute('data-sc-id'));
    const st = ids.map(id => (Number((allProducts.find(p => String(p.id) === id) || {})[branch.key]) || 0) > 0);
    return { ids, firstZero: st.indexOf(false), lastIn: st.lastIndexOf(true), foot: document.getElementById('sc-list').innerText }; });
  ok(L.lastIn < L.firstZero && L.ids.indexOf(String(IN.id)) > -1 && L.ids.indexOf(String(IN.id)) < L.firstZero, 'كلّ الموجود في الفرع قبل كلّ الأصفار (منتجنا المخزونه 5 في الأعلى لا مدفوناً بعد ١٢٠ صفراً)');
  ok(/يُعرض 100 من/.test(L.foot) && /عرض \d+ أخرى/.test(L.foot), 'لا قطع صامت: «يُعرض 100 من N» + «عرض المزيد»: ' + (L.foot.match(/يُعرض[^\n]*/) || [''])[0]);
  await pg.evaluate(() => { const b = [...document.querySelectorAll('#sc-list button')].find(x => /أخرى/.test(x.textContent)); b && b.click(); });
  ok(await pg.evaluate(n => document.querySelectorAll('#sc-list [data-sc-id]').length >= n, 131), '«عرض المزيد» يُظهر الباقي');
  await pg.evaluate(([a, b]) => { scSetCount(a, '4'); scSetCount(b, '2'); }, [IN.id, P[3].id]);
  await pg.evaluate(() => scSaveDraft()); await sleep(1500);
  let d = await H.call('/__dump', undefined, 'GET');
  let wip = (d.stock_counts || []).filter(r => r.details && r.details.source === 'pos_wip');
  ok(wip.length === 1 && wip[0].details.status === 'wip' && Number(wip[0].details.counts[IN.id]) === 4, '«حفظ ومتابعة لاحقاً» ⇒ نسخة على الخادم (pos_wip) بالأعداد');
  ok(!Array.isArray(wip[0].details.items), 'المسودّة بلا items ⇒ لا تظهر في «مطابقة الجرد» ولا تُعدّ «بانتظار المراجعة»');
  await browser.close();
  // جهازٌ آخر: ذاكرة فارغة
  ({ browser, pg, errs } = await open());
  await pg.evaluate(() => { try { Object.keys(localStorage).filter(k => /^gmt_stockcount/.test(k)).forEach(k => localStorage.removeItem(k)); } catch (_) {} openStockCount(); });
  await sleep(2500);
  const R = await pg.evaluate(([a, b]) => ({ a: _scCounts[a], b: _scCounts[b], lbl: document.getElementById('sc-branch-label').textContent }), [IN.id, P[3].id]);
  ok(Number(R.a) === 4 && Number(R.b) === 2, 'من جهازٍ آخر (ذاكرة فارغة) ⇒ المسودّة استُرجعت من الخادم: ' + JSON.stringify(R));
  ok(/مسودة محفوظة/.test(R.lbl), 'العنوان يقول «مسودة محفوظة»: ' + R.lbl);
  // تعديلٌ لاحق يُحفظ تلقائياً على النسخة نفسها
  await pg.evaluate(a => scSetCount(a, '6'), IN.id); await sleep(5200);
  d = await H.call('/__dump', undefined, 'GET');
  wip = (d.stock_counts || []).filter(r => r.details && r.details.source === 'pos_wip');
  ok(wip.length === 1 && Number(wip[0].details.counts[IN.id]) === 6, 'تعديلٌ لاحق ⇒ يُحفظ تلقائياً على نسخة الخادم نفسها (لا صفوف مكرّرة)');
  // الكاميرا: معاينة ظاهرة
  await pg.evaluate(() => { window.__gu = 0; navigator.mediaDevices && (navigator.mediaDevices.getUserMedia = () => { window.__gu++; return Promise.reject(new Error('لا كاميرا في الاختبار')); }); scStartScan(); });
  await sleep(1200);
  ok(await pg.evaluate(() => !!document.getElementById('gmt-scan-video')), 'مسح الكاميرا يفتح معاينةً ظاهرة (العدسة المشتركة) لا <video> مخفيّاً');
  await sleep(3000);
  const real = errs.filter(e => !/status of (400|401|404|406)|Failed to load resource|favicon|لا كاميرا/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
