const H = require('./h.js');
const OUT = __dirname + '/';
const ok = (c, m) => console.log((c ? '✔ ' : '✘ ') + m);
const shown = (pg, sel) => pg.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); if (r.width <= 0 || r.height <= 0 || cs.display === 'none' || cs.visibility === 'hidden') return false; for (let p = e; p; p = p.parentElement) if (getComputedStyle(p).display === 'none') return false; const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!(top && (e === top || e.contains(top) || top.contains(e))); }, sel);
const prods = async () => (await H.call('/__dump', undefined, 'GET')).products;
(async () => {
  for (const [w, h, mob] of [[390, 844, true], [1366, 900, false]]) {
    await H.seed();
    await H.call('/rest/v1/products', [
      { name: 'كاميرا A', barcode: 'C1', price: 500, haleb: 2, group_name: 'ك-كاميرات' }, { name: 'كاميرا B', barcode: 'C2', price: 600, haleb: 1, group_name: 'ك-كاميرات' },
      { name: 'عدسة A', barcode: 'L1', price: 300, haleb: 4, group_name: 'ك-عدسات' }, { name: 'ميكروفون', barcode: 'M1', price: 80, haleb: 6, group_name: 'ك-ميكروفونات', category: 'صوت' },
      { name: 'إضاءة 1', barcode: 'E1', price: 90, haleb: 3, group_name: 'ك-إضاءة' }]);
    const { browser, pg, errs } = await H.open('inventory.html', { init: H.ADMIN_INIT, w, h, wait: 7000, mobile: mob });
    console.log('=====', w);
    // ١) مدخلٌ ظاهر من الشاشة الرئيسية
    ok(await shown(pg, '#category-chips-row .filter-chip[onclick="gmCatOpen()"]'), 'زرّ «＋ تصنيف» ظاهر في صفّ التصنيف على الشاشة الرئيسية');
    ok(await shown(pg, '#group-chips-row .filter-chip[onclick="openGroupCreateModal()"]'), 'زرّ «＋ مجموعة» ظاهر في صفّ المجموعات');
    await pg.screenshot({ path: OUT + `cat_${w}_0.png` });
    // ٢) فتح النافذة بنقرة فعلية
    await pg.click('#category-chips-row .filter-chip[onclick="gmCatOpen()"]'); await pg.waitForTimeout(500);
    ok(await shown(pg, '#cat-modal .modal'), 'النافذة تظهر فعلاً أمام المستخدم');
    const rows = await pg.evaluate(() => [...document.querySelectorAll('#cat-groups-list label')].map(l => l.innerText.replace(/\s+/g, ' ').trim()));
    console.log('   groups:', JSON.stringify(rows));
    ok(['ك-كاميرات', 'ك-عدسات', 'ك-ميكروفونات', 'ك-إضاءة'].every(g => rows.some(r => r.startsWith(g))) && rows.some(r => /ك-ميكروفونات.*الآن في: صوت/.test(r)), 'قائمة المجموعات تضمّ الأربع وتنبيه «الآن في: صوت»');
    // ٣) إنشاء تصنيف «تصوير» من مجموعتين
    await pg.fill('#cat-name', 'فئة-أ');
    await pg.click('#cat-groups-list input[data-g="ك-كاميرات"]'); await pg.click('#cat-groups-list input[data-g="ك-عدسات"]');
    await pg.screenshot({ path: OUT + `cat_${w}_1.png` });
    await pg.click('#cat-save-btn'); await pg.waitForTimeout(1500);
    let P = await prods();
    ok(P.filter(p => p.category === 'فئة-أ').map(p => p.name).sort().join('|') === 'عدسة A|كاميرا A|كاميرا B', 'القاعدة: ٣ منتجات أصبحت «فئة-أ»');
    ok(P.find(p => p.name === 'ميكروفون').category === 'صوت' && !P.find(p => p.name === 'إضاءة 1').category, 'غيرها لم يُمسّ');
    ok(await pg.evaluate(() => getComputedStyle(document.getElementById('cat-modal')).display === 'none'), 'النافذة أُغلقت');
    ok(await pg.evaluate(() => [...document.querySelectorAll('#category-chips-row .filter-chip')].some(c => /فئة-أ/.test(c.textContent))), 'صفّ التصنيف يعرض «فئة-أ» فوراً');
    // ٤) تبويب التصنيفات
    await pg.evaluate(() => switchAppMode('groups')); await pg.waitForTimeout(800);
    await pg.click('#gm-tab-categories'); await pg.waitForTimeout(500);
    const cards = await pg.evaluate(() => [...document.querySelectorAll('#gm-cats-list > div')].map(c => c.innerText.replace(/\s+/g, ' ').trim()));
    console.log('   cats:', JSON.stringify(cards));
    ok(cards.length === 3 && cards.some(c => /فئة-أ/.test(c) && /2 مجموعة/.test(c) && /3 منتج/.test(c)) && cards.some(c => /صوت/.test(c)) && cards.some(c => /^تصوير/.test(c)), 'تبويب التصنيفات: «فئة-أ» ٢ مجموعة · ٣ منتج + «صوت» + «تصوير» (الموجود)');
    await pg.screenshot({ path: OUT + `cat_${w}_2.png` });
    // ٥) تعديل: إعادة تسمية + إزالة مجموعة + إضافة أخرى
    await pg.click('#gm-cats-list button[data-c="فئة-أ"]:not([title])'); await pg.waitForTimeout(500);
    await pg.fill('#cat-name', 'فئة-ب');
    await pg.click('#cat-groups-list input[data-g="ك-عدسات"]');       // إزالة
    await pg.click('#cat-groups-list input[data-g="ك-إضاءة"]');        // إضافة
    await pg.click('#cat-save-btn'); await pg.waitForTimeout(1800);
    P = await prods();
    const byCat = {}; P.forEach(p => { (byCat[p.category || '—'] = byCat[p.category || '—'] || []).push(p.name); });
    console.log('   ', JSON.stringify(byCat));
    ok((byCat['فئة-ب'] || []).sort().join('|') === 'إضاءة 1|كاميرا A|كاميرا B' && (byCat['—'] || []).includes('عدسة A') && !byCat['فئة-أ'], 'إعادة التسمية + إزالة «عدسات» + إضافة «إضاءة»');
    // ٥ب) تعديل تصنيفٍ لا يسحب منتجاً صنّفه المالك تحت تصنيفٍ آخر داخل مجموعةٍ مختلطة
    await H.call('/rest/v1/products', [{ name: 'منتج مختلط', barcode: 'MX1', price: 9, haleb: 1, group_name: 'ك-كاميرات', category: 'صوت' }]);
    await pg.evaluate(async () => { await loadProducts(); renderAll(); gmUpdateStats && gmUpdateStats(); });
    await pg.evaluate(() => switchAppMode('groups')); await pg.waitForTimeout(500);
    await pg.click('#gm-tab-categories'); await pg.waitForTimeout(400);
    await pg.click('#gm-cats-list button[data-c="فئة-ب"]:not([title])'); await pg.waitForTimeout(500);
    await pg.click('#cat-save-btn'); await pg.waitForTimeout(1800);
    P = await prods();
    ok(P.find(p => p.name === 'منتج مختلط').category === 'صوت', 'المنتج المصنَّف «صوت» داخل مجموعةٍ من فئة-ب لم يُسحب عند الحفظ');
    // ٥ج) إعادة تسمية تصنيفٍ منتجاته بلا مجموعة
    await H.call('/rest/v1/products', [{ name: 'يتيم', barcode: 'OR1', price: 3, haleb: 1, category: 'يتامى' }]);
    await pg.evaluate(async () => { await loadProducts(); renderAll(); });
    await pg.evaluate(() => switchAppMode('groups')); await pg.waitForTimeout(400);
    await pg.click('#gm-tab-categories'); await pg.waitForTimeout(400);
    await pg.click('#gm-cats-list button[data-c="يتامى"]:not([title])'); await pg.waitForTimeout(400);
    await pg.fill('#cat-name', 'أيتام'); await pg.click('#cat-save-btn'); await pg.waitForTimeout(1500);
    P = await prods();
    ok(P.find(p => p.name === 'يتيم').category === 'أيتام', 'إعادة تسمية تصنيفٍ بلا مجموعات تنجح');
    // ٦) حذف
    await pg.evaluate(() => switchAppMode('groups')); await pg.waitForTimeout(300);
    await pg.click('#gm-tab-categories'); await pg.waitForTimeout(400);
    await pg.click('#gm-cats-list button[data-c="صوت"][title]'); await pg.waitForSelector('.gmtask-ov .gmtask-b.pri', { timeout: 4000 });
    await pg.click('.gmtask-ov .gmtask-b.pri'); await pg.waitForTimeout(1500);
    P = await prods(); ok(!P.some(p => p.category === 'صوت') && P.find(p => p.name === 'ميكروفون').group_name === 'ك-ميكروفونات', 'حذف «صوت»: الاسم أُزيل والمجموعة والمنتج باقيان');
    // ٧) اسم مكرّر وحالات خطأ
    await pg.evaluate(() => gmCatOpen()); await pg.fill('#cat-name', ''); await pg.click('#cat-save-btn'); await pg.waitForTimeout(300);
    ok(/اكتب اسم/.test(await pg.evaluate(() => document.getElementById('cat-msg').textContent)), 'اسم فارغ يُرفض برسالة');
    await pg.fill('#cat-name', 'جديد'); await pg.click('#cat-save-btn'); await pg.waitForTimeout(300);
    ok(/مجموعة واحدة على الأقلّ/.test(await pg.evaluate(() => document.getElementById('cat-msg').textContent)), 'بلا مجموعات يُرفض برسالة');
    // ٨) RLS يمنع ⇒ لا «تمّ» كاذب
    await H.call('/__opts', { rls_block: ['products'] });
    await pg.click('#cat-groups-list input[data-g="ك-إضاءة"]'); await pg.fill('#cat-name', 'اختبار'); await pg.click('#cat-save-btn'); await pg.waitForTimeout(1500);
    const m2 = await pg.evaluate(() => document.getElementById('cat-msg').textContent);
    ok(/القاعدة/.test(m2) && /0 من/.test(m2) && await shown(pg, '#cat-modal .modal'), 'عند منع القاعدة: رسالة صريحة والنافذة تبقى (لا نجاح كاذب): ' + m2.slice(0, 60));
    await H.call('/__opts', { rls_block: [] });
    console.log('   errs', errs.filter(e => !/404|400|Failed|favicon/.test(e)).slice(0, 3));
    await browser.close();
  }
})();
