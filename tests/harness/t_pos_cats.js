// (19 ت1 · TASK-0109) «التصنيفات أدخلها في نقاط البيع» + «تصنيفات داخل التصنيف» — وجذر الاختفاء: ذاكرة الأعمدة العالقة
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const count = pg => pg.evaluate(() => +((document.getElementById('prodsLabel') || {}).textContent || '').replace(/\D/g, ''));
const rowTxt = (pg, id) => pg.evaluate(id => { const e = document.getElementById(id); return e ? e.innerText.replace(/\s+/g, ' ') : null; }, id);
const click = (pg, id, path) => pg.evaluate(([id, path]) => { const b = [...document.querySelectorAll('#' + id + ' .cat-pill')].find(x => x.dataset.c === path); if (b) b.click(); return !!b; }, [id, path]);
(async () => {
  for (const [w, mob] of [[390, true], [1366, false]]) {
    console.log('— ' + w);
    await H.seed();
    const rows = [];
    for (let g = 1; g <= 5; g++) for (let k = 1; k <= 2; k++) rows.push({ name: `ضوء ${g}-${k}`, barcode: `LT${g}${k}`, price: 10, haleb: 1, daraa: 2, group_name: `ض-مجموعة${g}`, category: g <= 2 ? 'إضاءة › ستوديو' : g <= 4 ? 'إضاءة › محمولة' : 'إضاءة' });
    rows.push({ name: 'مايك', barcode: 'MC1', price: 5, daraa: 1, group_name: 'ص-ميكروفونات', category: 'صوت' });
    await H.call('/rest/v1/products', rows);
    // ١) جهازٌ عليه الذاكرة القديمة العالقة بلا «category» (حالة المالك)
    const stale = `try{localStorage.setItem('gmt_pos_xcols', JSON.stringify({c:['brand','min_stock'], t:Date.now()}));}catch(e){}`;
    const { browser, pg, errs } = await H.open('pos.html', { init: H.STAFF_INIT + stale, w, mobile: mob, wait: 7000 });
    const topT = await rowTxt(pg, 'catTopRow');
    ok(topT && /إضاءة/.test(topT) && /صوت/.test(topT) && !/›/.test(topT), 'صفّ التصنيف ظاهر رغم الذاكرة القديمة العالقة — الرئيسية فقط: ' + topT);
    const all = await count(pg);
    ok(await click(pg, 'catTopRow', 'إضاءة'), 'الضغط على «إضاءة»'); await pg.waitForTimeout(300);
    ok(await count(pg) === 10, '«إضاءة» = كل منتجاتها مع الفروع (١٠ من ' + all + ')');
    const subT = await rowTxt(pg, 'catSubRow');
    ok(subT && /داخل «إضاءة»/.test(subT) && /ستوديو/.test(subT) && /محمولة/.test(subT), 'صفّ «داخل إضاءة» بالفرعين: ' + subT);
    await click(pg, 'catSubRow', 'إضاءة › ستوديو'); await pg.waitForTimeout(300);
    ok(await count(pg) === 4, '«ستوديو» = ٤');
    const groups = await rowTxt(pg, 'catsRow');
    ok(/ض-مجموعة1/.test(groups) && /ض-مجموعة2/.test(groups) && !/ض-مجموعة3|ض-مجموعة5|ص-/.test(groups), 'المجموعات تحت «ستوديو» فقط: ' + groups);
    ok(/محمولة/.test(await rowTxt(pg, 'catSubRow') || ''), 'داخل الفرع يبقى صفّ الإخوة');
    await click(pg, 'catSubRow', 'إضاءة › ستوديو'); await pg.waitForTimeout(300);
    ok(await pg.evaluate(() => activeTopCat === 'إضاءة') && await count(pg) === 10, 'الضغطة الثانية على الفرع تعود لأبيه');
    await click(pg, 'catTopRow', 'all'); await pg.waitForTimeout(300);
    ok(await count(pg) === all && !(await rowTxt(pg, 'catSubRow')), '«الكل» يعيد كل شيء ويُخفي صفّ الفروع');
    ok(await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('gmt_pos_xcols2')).c.includes('category'); } catch (e) { return false; } }), 'الذاكرة الجديدة تحمل «category» بعد فحصٍ كامل');
    ok(!(await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)), 'لا طفح أفقي');
    const real = errs.filter(e => !/Failed to load resource/.test(e)); ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
    await browser.close();
    // ٢) الذاكرة الجديدة الصالحة تُحترم ولا يُعاد كتابة وقتها (فتنتهي فعلاً بعد يوم)
    const t0 = Date.now() - 3600e3;
    const B = await H.open('pos.html', { init: H.STAFF_INIT + `try{localStorage.setItem('gmt_pos_xcols2', JSON.stringify({c:['brand'], t:${t0}}));}catch(e){}`, w, mobile: mob, wait: 6000 });
    const k = await B.pg.evaluate(() => JSON.parse(localStorage.getItem('gmt_pos_xcols2')));
    ok(k.t === t0, 'تحميلٌ من الذاكرة لا يجدّد وقتها (كان هذا سبب بقاء العمود ساقطاً)');
    await B.browser.close();
    const C2 = await H.open('pos.html', { init: H.STAFF_INIT + `try{localStorage.setItem('gmt_pos_xcols2', JSON.stringify({c:['brand'], t:${Date.now() - 2 * 864e5}}));}catch(e){}`, w, mobile: mob, wait: 6000 });
    ok(/إضاءة/.test(await rowTxt(C2.pg, 'catTopRow') || ''), 'ذاكرةٌ عمرها يومان ⇐ فحصٌ كامل ⇐ يظهر التصنيف');
    await C2.browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
