// (TASK-A0593 · المالك seq A1144) لوحة «توزيع المخزون» (gmt-dist.js) في الجرد + وضع المنتج في ورقة التفاصيل
//  المخزن ≠ الطريق · ألوان مميّزة · فروع فارغة مطويّة · البطاقة = الفلتر · الكلفة الواصلة (net_cost) · إخفاء القيم عن غير الأدمن · 360px بلا طفح
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  await H.call('/rest/v1/inv_columns', ['china', 'homs', 'korani'].map((k, i) => ({ key_name: k, display_name: k === 'china' ? 'في الطريق 🇨🇳' : k === 'homs' ? 'حمص' : 'كوراني', col_type: 'number', include_in_total: true, is_branch: true, show_form: false, show_table: true, sort_order: 10 + i })));
  await H.call('/rest/v1/products', [
    { name: 'منتج توزيع أ', barcode: 'DS0001', price: 100, net_cost: 40, cost_price: 10, haleb: 5, daraa: 3, china: 50, group_name: 'ز', category: 'ت' },
    { name: 'منتج توزيع ب', barcode: 'DS0002', price: 60, net_cost: 0, cost_price: 20, haleb: 2, china: 7, group_name: 'ز', category: 'ت' },
    { name: 'منتج توزيع بلا كلفة', barcode: 'DS0003', price: 30, haleb: 1, group_name: 'ز', category: 'ت' }]);
  for (const adm of [true, false]) {
    const o = await H.open('inventory.html', { w: 360, h: 800, mobile: true, wait: 5000, init: adm ? H.ADMIN_INIT : H.STAFF_INIT });
    const pg = o.pg, tag = adm ? '[أدمن] ' : '[موظف] ';
    const st = await pg.evaluate(() => {
      const el = document.getElementById('branch-stats'); if (!el || !el.querySelector('.gd')) return { none: true };
      const sec = k => el.querySelector('[data-sec="' + k + '"]');
      const col = (s, k) => { const i = s && s.querySelector('.gd-card[data-key="' + k + '"] .gd-name i'); return i ? i.style.backgroundColor : null; };
      const onhand = sec('onhand'), tr = sec('transit');
      return { onHead: onhand.querySelector('.gd-head span').textContent, trHead: tr && tr.querySelector('.gd-head span').textContent,
        onKeys: [...onhand.querySelectorAll('.gd-card')].map(c => c.dataset.key), trKeys: tr ? [...tr.querySelectorAll('.gd-card')].map(c => c.dataset.key) : [],
        cH: col(onhand, 'haleb'), cC: col(tr, 'china'), empty: (onhand.querySelector('.gd-empty summary') || {}).textContent, emptyNames: (onhand.querySelector('.gd-empty') || { textContent: '' }).textContent,
        text: el.innerText, nocost: !!el.querySelector('[data-nocost]'), ovf: document.documentElement.scrollWidth > 361 || el.scrollWidth > el.clientWidth + 1,
        oldChipRow: getComputedStyle(document.getElementById('branch-filter-row')).display };
    });
    ok(!st.none, tag + 'اللوحة الجديدة مرسومة بالمكوّن المشترك');
    if (st.none) { await o.browser.close(); continue; }
    const exp = 8 + 72 + 3 + 24;
    ok(st.onHead.replace(/,/g, '').includes('بالمخزن: ' + exp + ' قطعة'), tag + 'مجموع «بالمخزن» لا يشمل الطريق: ' + st.onHead);
    ok(/بالطريق: 57 قطعة · 2 منتج/.test(st.trHead || ''), tag + '«بالطريق» منفصل: ' + st.trHead);
    ok(!st.onKeys.includes('china') && st.trKeys.join() === 'china' && st.onKeys.includes('haleb'), tag + 'الصين خارج بطاقات المخزن ' + st.onKeys);
    ok(/2 فروع فارغة/.test(st.empty || '') && /حمص/.test(st.emptyNames) && !st.onKeys.includes('homs'), tag + 'الفروع الفارغة مطويّة: ' + st.empty);
    ok(st.cH && st.cC && st.cH !== st.cC, tag + 'لون حلب ≠ لون الصين ' + st.cH + ' / ' + st.cC);
    ok(!st.ovf, tag + 'بلا طفح أفقي على 360px');
    ok(st.oldChipRow === 'none', tag + 'صفّ الفلتر المكرَّر مخفيّ والبطاقات بدله');
    if (adm) {
      ok(/بالكلفة الواصلة/.test(st.text) && /بسعر البيع/.test(st.text), tag + 'تسميات «بالكلفة الواصلة» و«بسعر البيع»');
      const v = await pg.evaluate(() => { const r = document.querySelector('#branch-stats [data-sec="onhand"] .gd-valrow span'); return r ? r.textContent.replace(/[^0-9$]/g, '') : ''; });
      // أ: (5+3)*40 (net_cost يتقدّم على cost_price=10) ؛ ب: 2*20 (net_cost=0 ⇒ cost_price) ؛ بلا كلفة: 0 ؛ seed: 12*(6+2)*60
      ok(v === '$' + (320 + 40 + 5760), tag + 'القيمة بالكلفة الواصلة تستعمل net_cost أولاً: ' + v);
      ok(st.nocost, tag + 'زرّ «N بلا كلفة» موجود');
      await pg.click('#branch-stats [data-sec="onhand"] [data-nocost]'); await sleep(500);
      const nm = await pg.evaluate(() => filteredProducts.map(p => p.name));
      ok(nm.length === 1 && /بلا كلفة/.test(nm[0]), tag + '«بلا كلفة» يفلتر القائمة: ' + nm.join('|'));
      await pg.click('#branch-stats [data-sec="onhand"] [data-nocost]'); await sleep(400);
    } else {
      ok(!/\$|بالكلفة الواصلة|بلا كلفة/.test(st.text) && !st.nocost, tag + 'غير الأدمن: لا قيم ولا كلفة');
    }
    await pg.click('#branch-stats .gd-card[data-key="daraa"]'); await sleep(500);
    const f = await pg.evaluate(() => ({ cur: currentBranchFilter, on: document.querySelector('#branch-stats .gd-card.on') && document.querySelector('#branch-stats .gd-card.on').dataset.key,
      n: filteredProducts.length, allHave: filteredProducts.every(p => Number(p.daraa) > 0) }));
    ok(f.cur === 'daraa' && f.on === 'daraa' && f.allHave && f.n === 13, tag + 'ضغط بطاقة درعا يفلتر القائمة ويُظهر الفعّال ' + JSON.stringify(f));
    await pg.click('#branch-stats [data-clear]'); await sleep(400);
    ok(await pg.evaluate(() => currentBranchFilter === ''), tag + 'إلغاء الفلتر');
    await pg.evaluate(() => { const p = allProducts.find(x => x.barcode === 'DS0001'); openDetailModal(p.id); }); await sleep(500);
    const d = await pg.evaluate(() => { const e = document.getElementById('detail-dist'); return { has: !!(e && e.querySelector('.gd[data-mode="product"]')), rows: e ? [...e.querySelectorAll('.gd-row')].map(r => r.dataset.key + ':' + r.querySelector('b').textContent) : [], hint: e && (e.querySelector('.gd-hint') || {}).textContent, tr: e && (e.querySelector('[data-sec="transit"] .gd-head') || {}).textContent, ovf: e && e.scrollWidth > e.clientWidth + 1 }; });
    ok(d.has && d.rows.includes('haleb:5') && d.rows.includes('daraa:3') && d.rows.includes('china:50'), tag + 'ورقة المنتج: توزيع منتجٍ واحد ' + d.rows.join(','));
    ok(/بالطريق: 50/.test(d.tr || '') && /حلب/.test(d.hint || ''), tag + 'المنتج: الطريق منفصل + أوفر فرع للتحويل ' + d.hint);
    const je = o.errs.filter(e => !/Failed to load resource/.test(e));   // 400 من مسبار أعمدة القاعدة الوهمية (قديم ولا علاقة له باللوحة)
    ok(!d.ovf && je.length === 0, tag + 'بلا طفح ولا أخطاء JS ' + JSON.stringify(je));
    await o.browser.close();
  }
  console.log(`\n${pass} نجح · ${fails} فشل`); process.exit(fails ? 1 : 0);
})();
