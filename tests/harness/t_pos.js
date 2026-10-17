const H = require('./h.js');
const OUT = __dirname + '/';
const ok = (c, m) => console.log((c ? '✔ ' : '✘ ') + m);
const shown = (pg, sel) => pg.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); if (r.width <= 0 || r.height <= 0 || cs.display === 'none' || cs.visibility === 'hidden') return false; for (let p = e; p; p = p.parentElement) if (getComputedStyle(p).display === 'none') return false; const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!(top && (e === top || e.contains(top) || top.contains(e))); }, sel);
const dump = async () => await H.call('/__dump', undefined, 'GET');
const pw = async (pg, v) => { await pg.waitForSelector('.gmtask-ov .gmtask-in', { timeout: 5000 }); await pg.fill('.gmtask-ov .gmtask-in', v); await pg.click('.gmtask-ov .gmtask-b.pri'); };
(async () => {
  for (const [w, h, mob] of [[390, 844, true], [1366, 900, false]]) {
    await H.seed();
    // قاعدة بنقاط: حلب ودرعا (من الـseed) — نضيف تسجيلهما إن لم يكونا
    const cols = (await dump()).inv_columns || [];
    console.log('=====', w, 'registered cols:', cols.map(c => c.key_name + ':' + c.is_branch).join(','));
    const { browser, pg, errs } = await H.open('inventory.html', { init: H.ADMIN_INIT, w, h, wait: 7000, mobile: mob });
    // ١) فتح المدير
    if (mob) { await pg.locator('button:has-text("المزيد")').first().click(); await pg.waitForTimeout(600); await pg.click('#more-sheet .more-action-btn:has(.more-action-label:text-is("نقاط البيع"))'); }
    else await pg.click('button[onclick="posOpen()"]');
    await pg.waitForTimeout(600);
    ok(await shown(pg, '#pos-modal .modal'), 'نافذة نقاط البيع تظهر فعلاً');
    const list0 = await pg.evaluate(() => [...document.querySelectorAll('#pos-list > div')].map(d => d.innerText.replace(/\s+/g, ' ').trim()));
    console.log('   list:', JSON.stringify(list0));
    ok(list0.length >= 2 && list0.some(x => /حلب/.test(x) && /أساسية/.test(x)), 'القائمة تعرض النقاط (حلب أساسية)');
    // حالة الحماية
    ok(/حماية الخادم مفعّلة/.test(await pg.evaluate(() => document.getElementById('pos-sec').textContent)), 'سطر الحماية: مفعّلة');
    // ٢) مفتاح تلقائي من الاسم
    await pg.fill('#pos-new-name', 'اللاذقية');
    const auto = await pg.inputValue('#pos-new-key'); console.log('   auto key:', auto);
    const kk = await pg.evaluate(() => [posKeyFromName('فرع ١٢'), posKeyFromName('GMT مركز'), posKeyFromName('حلب الجديدة'), posKeyFromName('درعا')]);
    console.log('   suggested:', JSON.stringify(kk));
    ok(kk[0] === 'fr_12' || /12$/.test(kk[0]), 'الأرقام العربية تُحوَّل: ' + kk[0]);
    ok(!/^(gmt_|pg_)/.test(kk[1]), 'البادئة gmt_ لا تُقترَح: ' + kk[1]);
    ok(kk[3] !== 'dr3a' && /^[a-z][a-z0-9_]{2,23}$/.test(kk[3]) && kk[3] !== 'daraa', 'لا يقترح مفتاحاً مكرّراً (daraa موجود): ' + kk[3]);
    ok(/^[a-z][a-z0-9_]{2,23}$/.test(auto), 'المعرّف التلقائي من الاسم صالح: ' + auto);
    await pg.fill('#pos-new-key', 'latakia');
    // ٣) كلمة خاطئة
    await pg.click('#pos-create-btn'); await pw(pg, 'خطأ'); await pg.waitForTimeout(1200);
    ok(/غير صحيحة/.test(await pg.evaluate(() => document.getElementById('pos-msg').textContent)), 'كلمة خاطئة ⇒ رسالة صريحة');
    ok(!((await dump()).inv_columns || []).some(c => c.key_name === 'latakia'), 'ولم يُنشأ شيء');
    // ٤) صحيحة
    await pg.click('#pos-create-btn'); await pw(pg, '2003'); await pg.waitForTimeout(3500);
    const d1 = await dump(); const nc = (d1.inv_columns || []).find(c => c.key_name === 'latakia');
    ok(!!nc && nc.is_branch === true && nc.display_name === 'اللاذقية', 'القاعدة: سُجّلت النقطة كفرع فعّال');
    ok(await pg.evaluate(() => columns.some(c => c.key === 'latakia' && c.isBranch)), 'الواجهة أعادت تحميل الأعمدة وفيها النقطة الجديدة');
    ok(await pg.evaluate(() => allProducts.length > 0 && allProducts.every(p => p.latakia === 0)), 'كل المنتجات صار لها كمية 0 في النقطة الجديدة');
    ok(await pg.evaluate(() => [...document.querySelectorAll('#pos-list > div')].some(d => /اللاذقية/.test(d.innerText))) , 'النافذة تعرض النقطة الجديدة');
    ok(await pg.evaluate(() => [...document.querySelectorAll('#branch-filter-row .filter-chip')].some(c => /اللاذقية/.test(c.textContent))), 'صفّ فلتر الفروع يعرضها');
    await pg.screenshot({ path: OUT + `pos_${w}_1.png` });
    // ٥) تكرار
    await pg.fill('#pos-new-name', 'اللاذقية 2'); await pg.fill('#pos-new-key', 'latakia'); await pg.click('#pos-create-btn'); await pw(pg, '2003'); await pg.waitForTimeout(1200);
    ok(/فعّالة بهذا المعرّف/.test(await pg.evaluate(() => document.getElementById('pos-msg').textContent)), 'معرّف مكرّر ⇒ رسالة');
    // ٥ب) كلمة محجوزة / فارغة / بيانات
    await pg.fill('#pos-new-name', 'دير الزور'); await pg.fill('#pos-new-key', 'de_x'); await pg.click('#pos-create-btn'); await pg.waitForTimeout(400);
    ok(/محجوزة/.test(await pg.evaluate(() => document.getElementById('pos-msg').textContent)) && !(await pg.$('.gmtask-ov')), 'مفتاح محجوز (de_x) يُرفض قبل السؤال');
    await pg.fill('#pos-new-key', 'deirezzor'); await pg.click('#pos-create-btn'); await pg.waitForSelector('.gmtask-ov .gmtask-in'); await pg.click('.gmtask-ov .gmtask-b.pri'); await pg.waitForTimeout(500);
    ok(/غير صحيحة/.test(await pg.evaluate(() => document.getElementById('pos-msg').textContent)), 'كلمة فارغة تُرفض في الواجهة بلا إرسال');
    // ٦) تحقّق العميل قبل السؤال
    await pg.fill('#pos-new-key', 'Bad Key!'); await pg.click('#pos-create-btn'); await pg.waitForTimeout(400);
    ok(/المعرّف غير صالح/.test(await pg.evaluate(() => document.getElementById('pos-msg').textContent)) && !(await pg.$('.gmtask-ov')), 'معرّف غير صالح يُرفض قبل طلب كلمة السرّ');
    // ٧) إلغاء مع مخزون: يُمنع في الواجهة
    await H.call('/rest/v1/products', [{ name: 'منتج اللاذقية', barcode: 'LK1', price: 5, haleb: 0, latakia: 7 }]);
    await pg.evaluate(async () => { await loadProducts(); renderAll(); posRender(); });
    await pg.click('#pos-list button[data-k="latakia"]'); await pg.waitForTimeout(500);
    ok(/فيها مخزون: 7 قطعة/.test(await pg.evaluate(() => document.getElementById('pos-msg').textContent)) && !(await pg.$('.gmtask-ov')), 'إلغاء نقطة فيها مخزون ⇒ يُمنع برسالة (٧ قطع)');
    // تفريغ ثمّ مستخدم فعّال ⇒ رفض الخادم
    await H.call('/rest/v1/products?name=eq.' + encodeURIComponent('منتج اللاذقية'), { latakia: 0 }, 'PATCH');
    await H.call('/rest/v1/gmt_users', [{ username: 'lk', display_name: 'لاذقاني', branch_key: 'latakia', is_active: true }]);
    await pg.evaluate(async () => { await loadProducts(); renderAll(); posRender(); });
    await pg.click('#pos-list button[data-k="latakia"]'); await pg.waitForSelector('.gmtask-ov .gmtask-b.pri'); await pg.click('.gmtask-ov .gmtask-b.pri'); await pw(pg, '2003'); await pg.waitForTimeout(1500);
    ok(/مستخدم فعّال/.test(await pg.evaluate(() => document.getElementById('pos-msg').textContent)), 'مستخدم فعّال مُسنَد ⇒ رفض من الخادم بنصٍّ مفهوم');
    // ٨) إلغاء ناجح
    await H.call('/rest/v1/gmt_users?username=eq.lk', { is_active: false }, 'PATCH');
    await pg.click('#pos-list button[data-k="latakia"]'); await pg.waitForSelector('.gmtask-ov .gmtask-b.pri'); await pg.click('.gmtask-ov .gmtask-b.pri'); await pw(pg, '2003'); await pg.waitForTimeout(3500);
    const d2 = await dump(); const rc = (d2.inv_columns || []).find(c => c.key_name === 'latakia');
    ok(rc && rc.is_branch === false, 'القاعدة: النقطة أُلغيت (إخفاء)');
    ok(await pg.evaluate(() => !columns.some(c => c.key === 'latakia' && c.isBranch)) && await pg.evaluate(() => ![...document.querySelectorAll('#pos-list > div')].some(d => /اللاذقية/.test(d.innerText))), 'الواجهة: اختفت من القائمة والفروع');
    ok((d2.gmt_audit || []).some(a => a.action === 'pos_retire') && (d2.gmt_audit || []).some(a => a.action === 'pos_create') && (d2.gmt_audit || []).some(a => a.action === 'pos_secret_fail'), 'سجلّ التدقيق: إنشاء + إلغاء + محاولة خاطئة');
    // ٩) إعادة التفعيل بالمعرّف نفسه
    await pg.fill('#pos-new-name', 'اللاذقية'); await pg.fill('#pos-new-key', 'latakia'); await pg.click('#pos-create-btn'); await pw(pg, '2003'); await pg.waitForTimeout(3000);
    ok(/أُعيد تفعيل/.test(await pg.evaluate(() => document.getElementById('pos-msg').textContent)), 'إعادة التفعيل بالمعرّف نفسه');
    // ٩ب) عمولة غير مدفوعة تمنع الإلغاء + تنبيه الفواتير التاريخية
    await H.call('/rest/v1/invoices', [{ branch_key: 'latakia', total: 10 }]);
    await H.call('/rest/v1/invoice_commissions', [{ branch_key: 'latakia', amount: 4, paid: false }]);
    await pg.evaluate(async () => { await loadColumns(); posRender(); });
    await pg.click('#pos-list button[data-k="latakia"]'); await pg.waitForSelector('.gmtask-ov .gmtask-b.pri'); await pg.click('.gmtask-ov .gmtask-b.pri'); await pw(pg, '2003'); await pg.waitForTimeout(1500);
    ok(/عمولة غير مدفوعة/.test(await pg.evaluate(() => document.getElementById('pos-msg').textContent)), 'عمولة غير مدفوعة ⇒ رفض بنصٍّ مفهوم');
    await H.call('/rest/v1/invoice_commissions?branch_key=eq.latakia', { paid: true }, 'PATCH');
    await pg.click('#pos-list button[data-k="latakia"]'); await pg.waitForSelector('.gmtask-ov .gmtask-b.pri'); await pg.click('.gmtask-ov .gmtask-b.pri'); await pw(pg, '2003'); await pg.waitForTimeout(3000);
    ok(/فاتورة تاريخية/.test(await pg.evaluate(() => document.getElementById('pos-msg').textContent)), 'الإلغاء الثاني ينجح ويُنبّه لفاتورة تاريخية');
    await pg.fill('#pos-new-name', 'اللاذقية'); await pg.fill('#pos-new-key', 'latakia'); await pg.click('#pos-create-btn'); await pw(pg, '2003'); await pg.waitForTimeout(3000);
    // ٩ج) عدم تفعيل الحماية + القفل
    await H.call('/__opts', { pos_protected: false });
    await pg.evaluate(() => posLoadStatus()); await pg.waitForTimeout(600);
    ok(/غير مفعَّلة/.test(await pg.evaluate(() => document.getElementById('pos-sec').textContent)) && /gmt_pos_set_secret_admin/.test(await pg.evaluate(() => document.getElementById('pos-sec').textContent)), 'الحماية غير مفعّلة ⇒ تظهر تعليمات التفعيل (السطر الجاهز)');
    await pg.fill('#pos-new-name', 'طرطوس'); await pg.fill('#pos-new-key', 'tartous'); await pg.click('#pos-create-btn'); await pg.waitForTimeout(400);
    ok(/غير مفعَّلة/.test(await pg.evaluate(() => document.getElementById('pos-msg').textContent)) && !(await pg.$('.gmtask-ov')), 'قبل التفعيل: يُرفض بلا طلب كلمة سرّ');
    await H.call('/__opts', { pos_protected: true, pos_locked: true });
    await pg.evaluate(() => posLoadStatus()); await pg.waitForTimeout(400);
    await pg.click('#pos-create-btn'); await pw(pg, '2003'); await pg.waitForTimeout(1200);
    ok(/قُفل/.test(await pg.evaluate(() => document.getElementById('pos-msg').textContent)), 'القفل المؤقّت ⇒ رسالة');
    await H.call('/__opts', { pos_locked: false });
    // ٩د) تغيير الكلمة
    await pg.evaluate(() => { window.__pcs = posChangeSecret(); }); await pg.waitForSelector('.gmtask-ov .gmtask-in');
    const ins = await pg.$$('.gmtask-ov .gmtask-in'); await ins[0].fill('2003'); await ins[1].fill('قصيرة'); await ins[2].fill('قصيرة'); await pg.click('.gmtask-ov .gmtask-b.pri'); await pg.waitForTimeout(800);
    ok(/ضعيفة/.test(await pg.evaluate(() => (document.querySelector('.gmtask-er') || {}).textContent || '')), 'كلمة جديدة قصيرة ⇒ رفض داخل النافذة');
    const ins2 = await pg.$$('.gmtask-ov .gmtask-in'); await ins2[1].fill('كلمة-قويّة-جديدة-١'); await ins2[2].fill('كلمة-قويّة-جديدة-١'); await pg.click('.gmtask-ov .gmtask-b.pri'); await pg.waitForTimeout(1500);
    ok(!(await pg.$('.gmtask-ov')) && /غُيّرت/.test(await pg.evaluate(() => document.getElementById('pos-msg').textContent)), 'تغيير الكلمة ينجح');
    await H.call('/__opts', { sov: '2003' });
    // ١٠) الدالة غير منشورة
    await H.call('/__opts', { no_pos_fn: true });
    await pg.fill('#pos-new-name', 'طرطوس'); await pg.fill('#pos-new-key', 'tartous'); await pg.click('#pos-create-btn'); await pw(pg, '2003'); await pg.waitForTimeout(1500);
    ok(/SQL رقم ٣٤/.test(await pg.evaluate(() => document.getElementById('pos-msg').textContent)), 'قبل تشغيل ملف SQL: رسالة تدلّ على الملف ٣٤');
    await H.call('/__opts', { no_pos_fn: false });
    // ١١) إلغاء حلب لا يُعرض
    ok(await pg.evaluate(() => !document.querySelector('#pos-list button[data-k="haleb"]')), 'حلب بلا زرّ إلغاء');
    console.log('   errs', errs.filter(e => !/404|400|Failed|favicon|PGRST/.test(e)).slice(0, 3));
    await browser.close();
  }
})();
