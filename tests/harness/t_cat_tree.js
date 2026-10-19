// (19 ت1 · TASK-0110) «تصنيفات داخل التصنيف»: إضاءة فيها ٥ مجموعات — كل مجموعتين في تصنيفٍ داخلي والخامسة مباشرةً
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const prods = async () => (await H.call('/__dump', undefined, 'GET')).products;
const catOf = (P, name) => (P.find(p => p.name === name) || {}).category;
(async () => {
  for (const [w, mob] of [[390, true], [1366, false]]) {
    console.log('— ' + w);
    await H.seed();
    const rows = [];
    for (let g = 1; g <= 5; g++) for (let k = 1; k <= 2; k++) rows.push({ name: `ضوء ${g}-${k}`, barcode: `LT${g}${k}`, price: 10, haleb: 1, group_name: `ض-مجموعة${g}` });
    rows.push({ name: 'ميكروفون', barcode: 'MC1', price: 5, haleb: 1, group_name: 'ص-ميكروفونات', category: 'صوت' });
    await H.call('/rest/v1/products', rows);
    const { browser, pg, errs } = await H.open('inventory.html', { init: H.ADMIN_INIT, w, wait: 7000, mobile: mob });
    const save = async () => { await pg.click('#cat-save-btn'); await pg.waitForTimeout(1300); };
    const pick = async gs => { for (const g of gs) await pg.click(`#cat-groups-list input[data-g="${g}"]`); };
    // ١) التصنيف الرئيسي «إضاءة» بالمجموعة الخامسة مباشرةً
    await pg.evaluate(() => gmCatOpen()); await pg.waitForTimeout(300);
    await pg.fill('#cat-name', 'إضاءة'); await pick(['ض-مجموعة5']); await save();
    // ٢) «＋ فرعي» من تبويب التصنيفات
    await pg.evaluate(() => switchAppMode('groups')); await pg.waitForTimeout(500);
    await pg.click('#gm-tab-categories'); await pg.waitForTimeout(400);
    await pg.click('#gm-cats-list button[data-c="إضاءة"][aria-label]'); await pg.waitForTimeout(400);
    ok(await pg.evaluate(() => document.getElementById('cat-parent').value === 'إضاءة' && /داخل «إضاءة»/.test(document.getElementById('cat-modal-title').textContent)), '«＋ فرعي» يفتح النافذة و«داخل التصنيف» = إضاءة');
    await pg.fill('#cat-name', 'ستوديو'); await pick(['ض-مجموعة1', 'ض-مجموعة2']); await save();
    // ٣) الفرع الثاني من صفّ الفلاتر في الشاشة الرئيسية
    await pg.evaluate(() => { switchAppMode('table'); setCategory('إضاءة'); }); await pg.waitForTimeout(500);
    const subTxt = await pg.evaluate(() => (document.getElementById('category-sub-row') || {}).innerText || '');
    ok(/داخل «إضاءة»/.test(subTxt) && /ستوديو/.test(subTxt), 'اختيار «إضاءة» يُظهر صفّ «داخل إضاءة» بفرعه: ' + subTxt.replace(/\s+/g, ' ').slice(0, 60));
    await pg.evaluate(() => document.querySelector('#category-sub-row .filter-chip[data-p]').click()); await pg.waitForTimeout(400);
    await pg.fill('#cat-name', 'محمولة'); await pick(['ض-مجموعة3', 'ض-مجموعة4']); await save();
    let P = await prods();
    ok(['1', '2'].every(g => catOf(P, `ضوء ${g}-1`) === 'إضاءة › ستوديو') && ['3', '4'].every(g => catOf(P, `ضوء ${g}-2`) === 'إضاءة › محمولة') && catOf(P, 'ضوء 5-1') === 'إضاءة' && catOf(P, 'ميكروفون') === 'صوت', 'القاعدة: ستوديو(١،٢) · محمولة(٣،٤) · إضاءة مباشرةً(٥) · صوت لم يُمسّ');
    // ٤) الفلترة بالمستويين
    const vis = () => pg.evaluate(() => { applyFilters(); return filteredProducts.map(p => p.name).sort(); });
    await pg.evaluate(() => { currentCategory = ''; setCategory('إضاءة'); }); await pg.waitForTimeout(300);
    ok((await vis()).length === 10, '«إضاءة» تعرض كل منتجاتها مع فروعها (١٠)');
    await pg.evaluate(() => setCategory('إضاءة › ستوديو')); await pg.waitForTimeout(300);
    const v2 = await vis(); ok(v2.length === 4 && v2.every(n => /ضوء [12]-/.test(n)), '«ستوديو» تعرض مجموعتيها فقط (٤)');
    const grp = await pg.evaluate(() => [...document.querySelectorAll('#group-chips-row .filter-chip')].map(c => c.textContent).join('|'));
    ok(/ض-مجموعة1/.test(grp) && !/ض-مجموعة3|ض-مجموعة5/.test(grp), 'صفّ المجموعات داخل «ستوديو» = مجموعتاها فقط');
    const subAgain = await pg.evaluate(() => (document.getElementById('category-sub-row') || {}).innerText || '');
    ok(/محمولة/.test(subAgain), 'داخل الفرع يبقى صفّ الإخوة للتنقّل (محمولة ظاهرة)');
    await pg.evaluate(() => setCategory('إضاءة › ستوديو')); await pg.waitForTimeout(200);
    ok(await pg.evaluate(() => currentCategory === 'إضاءة'), 'الضغطة الثانية على الفرع تعود لأبيه');
    // ٥) الشجرة في تبويب التصنيفات
    await pg.evaluate(() => switchAppMode('groups')); await pg.waitForTimeout(400); await pg.click('#gm-tab-categories'); await pg.waitForTimeout(400);
    const top = await pg.evaluate(() => { const n = document.querySelector('#gm-cats-list > [data-cat-node="إضاءة"]'); return n ? { t: n.innerText.replace(/\s+/g, ' '), kids: n.querySelectorAll('[data-cat-node^="إضاءة › "]').length } : null; });
    ok(top && top.kids === 2 && /1 مجموعة · 2 تصنيف فرعي · 10 منتج/.test(top.t), 'التبويب: «إضاءة» ١ مجموعة · ٢ فرعي · ١٠ منتج وتحتها الفرعان ' + (top && top.t.slice(0, 50)));
    // ٦) أخطاء: «›» في الاسم · النقل داخل الفرع
    await pg.evaluate(() => gmCatOpen()); await pg.fill('#cat-name', 'أ › ب'); await save();
    ok(/محجوز/.test(await pg.evaluate(() => document.getElementById('cat-msg').textContent)), 'الرمز «›» في الاسم يُرفض برسالة');
    await pg.evaluate(() => gmCatOpen('إضاءة')); await pg.fill('#cat-parent', 'إضاءة › ستوديو'); await save();
    ok(/داخل نفسه/.test(await pg.evaluate(() => document.getElementById('cat-msg').textContent)), 'نقل التصنيف داخل فرعه يُرفض');
    ok(await pg.evaluate(() => ![...document.querySelectorAll('#cat-parent-list option')].some(o => o.value.startsWith('إضاءة'))), 'قائمة «داخل التصنيف» تستثني التصنيف نفسه وفروعه');
    // ٧) إعادة تسمية الأب ⇒ الفروع تتبعه
    await pg.fill('#cat-parent', ''); await pg.fill('#cat-name', 'إنارة'); await save();
    P = await prods();
    ok(catOf(P, 'ضوء 1-1') === 'إنارة › ستوديو' && catOf(P, 'ضوء 3-1') === 'إنارة › محمولة' && catOf(P, 'ضوء 5-2') === 'إنارة', 'إعادة تسمية «إضاءة» ⇐ «إنارة»: الفرعان تبعاه');
    // ٨) نقل فرعٍ ليصير رئيسياً
    await pg.evaluate(() => gmCatOpen('إنارة › محمولة')); await pg.waitForTimeout(200);
    ok(await pg.evaluate(() => document.getElementById('cat-name').value === 'محمولة' && document.getElementById('cat-parent').value === 'إنارة'), 'تعديل فرع: الاسم = آخر جزء و«داخل» = الأب');
    await pg.fill('#cat-parent', ''); await save();
    P = await prods(); ok(catOf(P, 'ضوء 4-2') === 'محمولة', 'تفريغ «داخل التصنيف» ينقل الفرع ليصير رئيسياً');
    // ٩) حذف أبٍ له فرع: مباشرُه بلا تصنيف، وفرعُه يصعد
    await pg.evaluate(() => switchAppMode('groups')); await pg.waitForTimeout(300); await pg.click('#gm-tab-categories'); await pg.waitForTimeout(300);
    await pg.click('#gm-cats-list button[data-c="إنارة"][title]'); await pg.waitForSelector('.gmtask-ov .gmtask-b.pri', { timeout: 4000 });
    ok(/تصعد مستوىً واحداً/.test(await pg.evaluate(() => document.querySelector('.gmtask-ov').innerText)), 'تأكيد الحذف يشرح أنّ الفروع تصعد');
    await pg.click('.gmtask-ov .gmtask-b.pri'); await pg.waitForTimeout(1500);
    P = await prods(); ok(!catOf(P, 'ضوء 5-1') && catOf(P, 'ضوء 2-2') === 'ستوديو' && catOf(P, 'ميكروفون') === 'صوت', 'حذف «إنارة»: مباشرُها بلا تصنيف · «ستوديو» صار رئيسياً · غيرها لم يُمسّ');
    const hs = await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
    ok(!hs, 'لا طفح أفقي');
    const realErrs = errs.filter(e => !/Failed to load resource: the server responded with a status of (400|503)/.test(e));   /* 400 = rpc/add_branch_stock في القاعدة الوهمية (قائم قبل التعديل) · 503 = مرحّل تيليغرام غير مضبوط عمداً في h.js */
    ok(!realErrs.length, 'لا أخطاء JS ' + realErrs.slice(0, 2).join(' / '));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
