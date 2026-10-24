// TASK-0011 — الأدمن يدخل نقطة بيع «كأنّي موظّف فيها ولكنّي الأدمن، بنفس واجهتهم» (طلب المالك 11 ت1):
// «العمولة صفر · يُكتب أنّ الأدمن أنشأها · تُخصم من المخزون · يبين على الفواتير أنّني أنا من أنشأها من الفرع».
// ١) زرّ النقطة في «إنشاء فاتورة» بالإدارة يفتح pos.html نفسها على تلك النقطة · ٢) شريط «أنت داخلٌ كأدمن» وزرّ الخروج ·
// ٣) فاتورة البيع: الفرع والكاشير «الأدمن …» والملاحظة «نيابةً عن نقطة …» وبلا عمولة ومخزون النقطة يُخصم ·
// ٤) الفاتورة تظهر في قائمة فواتير الإدارة باسم الأدمن · ٥) الخروج يمسح الجلسة ويعيد للإدارة · ٦) بيع الموظّف نفسه له عمولة (ضابط) ·
// ٧) مفتاح gmt_acting بلا صلاحية أدمن يُتجاهل ويُمسح.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const dump = async () => H.call('/__dump', undefined, 'GET');
const ADMIN_NAME = 'فاحص النظام';

async function prepSale(pg, pid, cust) {
  await pg.evaluate(([pid, cust]) => {
    newInvoice(); addToCartFromDetail(pid); saleType = 'نقدي';
    const n = document.getElementById('custName'); if (n) n.value = cust;
    const ph = document.getElementById('custPhone'); if (ph) ph.value = '';
  }, [pid, cust]);
}
const closeDialogs = async pg => { for (let i = 0; i < 4 && await pg.evaluate(() => !!document.querySelector('.gmtask-ov')); i++) { await pg.keyboard.press('Escape'); await pg.waitForTimeout(250); } };

(async () => {
  for (const [w, mob] of [[390, true], [1366, false]]) {
    console.log('— ' + w);
    await H.seed();
    const [p] = await H.call('/rest/v1/products', [{ name: 'كاميرا الأدمن', barcode: 'ACT1', price: 120, wholesale_price: 90, net_cost: 70, haleb: 9, daraa: 5 }]);

    // ١) من الإدارة: «إنشاء فاتورة» ⇒ أزرار النقاط ⇒ درعا
    const { browser, pg, errs } = await H.open('admin_pos.html', { init: H.ADMIN_INIT, w, mobile: mob, wait: 6000 });
    await pg.evaluate(() => switchTab('adminInvoice')); await pg.waitForTimeout(800);
    const btns = await pg.evaluate(() => [...document.querySelectorAll('#app-content button[onclick^="adminEnterPos"]')].map(b => b.textContent.trim()));
    ok(btns.includes('درعا') && btns.includes('حلب'), 'شاشة «إنشاء فاتورة» تعرض نقاط البيع للدخول كموظّف: ' + JSON.stringify(btns));
    ok(await pg.evaluate(() => !!document.getElementById('ai-branch')), 'والنموذج المبسّط القديم باقٍ (لم تُلغَ الشاشة القديمة)');
    await Promise.all([pg.waitForURL(/pos\.html\?acting=1/, { timeout: 15000 }), pg.click('#app-content button[onclick="adminEnterPos(\'daraa\')"]')]);
    await pg.waitForTimeout(6000);
    const st = await pg.evaluate(() => ({ acting: !!(currentUser && currentUser.acting_admin), name: currentUser && currentUser.display_name, br: branch && branch.key,
      bar: (() => { const b = document.getElementById('acting-bar'); return b && getComputedStyle(b).display !== 'none' ? b.innerText : ''; })(),
      picker: getComputedStyle(document.getElementById('picker-screen')).display }));
    ok(st.acting && st.br === 'daraa' && st.picker === 'none', 'فُتحت نقطة البيع نفسها على «درعا» كأدمن، بلا شاشة اختيار: ' + JSON.stringify({ br: st.br, picker: st.picker }));
    ok(st.name === 'الأدمن ' + ADMIN_NAME, 'الكاشير الظاهر «الأدمن ' + ADMIN_NAME + '»: ' + st.name);
    ok(/أنت داخلٌ كأدمن/.test(st.bar) && st.bar.includes(ADMIN_NAME) && st.bar.includes('درعا') && /خروج للإدارة/.test(st.bar), 'الشريط الثابت يذكّر بالدخول كأدمن وفيه زرّ الخروج: ' + st.bar.replace(/\s+/g, ' ').slice(0, 90));
    ok((await dump()).gmt_audit.some(a => a.action === 'admin_enter_pos' && a.entity_id === 'daraa'), 'سجلّ التدقيق: دخول الأدمن إلى النقطة');

    // ٣) البيع
    const d0 = await dump(); const s0 = (d0.products.find(x => String(x.id) === String(p.id)) || {});
    await prepSale(pg, p.id, 'زبون الأدمن ' + w);
    await pg.evaluate(() => saveAndFinish()); await pg.waitForTimeout(2500); await closeDialogs(pg);
    const d1 = await dump();
    const inv = (d1.invoices || []).filter(i => i.customer_name === 'زبون الأدمن ' + w);
    ok(inv.length === 1, 'أُنشئت فاتورة واحدة (' + inv.length + ')');
    const iv = inv[0] || {};
    ok(iv.branch_key === 'daraa', 'على فرع النقطة: ' + iv.branch_key);
    ok(iv.cashier_name === 'الأدمن ' + ADMIN_NAME, 'مكتوبٌ عليها أنّ الأدمن أنشأها: ' + iv.cashier_name);
    ok(String(iv.notes || '').includes('أنشأها الأدمن ' + ADMIN_NAME + ' نيابةً عن نقطة «درعا»'), 'والملاحظة «نيابةً عن نقطة درعا»: ' + iv.notes);
    const comm = (d1.invoice_commissions || []).filter(c => String(c.invoice_id) === String(iv.id));
    ok(comm.length === 0 || comm.every(c => Number(c.amount) === 0), 'العمولة صفر — لا سطر عمولة (' + comm.length + ')');
    const s1 = (d1.products.find(x => String(x.id) === String(p.id)) || {});
    ok(Number(s1.daraa) === Number(s0.daraa) - 1 && Number(s1.haleb) === Number(s0.haleb), 'خُصمت من مخزون درعا وحدها: ' + s0.daraa + '⇐' + s1.daraa + ' · حلب ' + s0.haleb + '⇐' + s1.haleb);
    const its = (d1.invoice_items || []).filter(i => String(i.invoice_id) === String(iv.id));
    ok(its.length === 1, 'وبندها محفوظ');
    ok(its.length && its.every(i => Number(i.commission) === 0), 'وعمولة البند صفر أيضاً (منه تُعبّأ «مراجعة العمولات» في الإدارة): ' + its.map(i => i.commission).join(','));
    // سجلّ فواتير النقطة: البطاقة تقول إنّ الأدمن أنشأها وبلا عمولة (لا «قيد المراجعة»)
    await pg.evaluate(() => openInvoiceHistory()); await pg.waitForTimeout(1800);
    const card = await pg.evaluate((n) => { const c = [...document.querySelectorAll('#inv-hist-list [data-invid]')].find(e => e.innerText.includes('#' + n)); return c ? c.innerText.replace(/\s+/g, ' ') : ''; }, String(iv.inv_number));
    ok(card.includes('أنشأها الأدمن ' + ADMIN_NAME + ' · بلا عمولة') && !card.includes('قيد المراجعة'), 'بطاقتها في سجلّ فواتير النقطة: «أنشأها الأدمن · بلا عمولة»: ' + card.slice(0, 120));
    await pg.screenshot({ path: __dirname + '/acting_admin_hist_' + w + '.png' });
    await pg.evaluate((id) => openInvDetailModal(id), iv.id); await pg.waitForTimeout(600);
    const det = await pg.evaluate(() => document.getElementById('idm-body').innerText.replace(/\s+/g, ' '));
    ok(det.includes('أنشأها الأدمن ' + ADMIN_NAME + ' · بلا عمولة') && det.includes('الأدمن ' + ADMIN_NAME), 'وتفاصيلها: الحالة «بلا عمولة» والبائع «الأدمن …»');
    await pg.evaluate(() => { try { closeInvDetailModal(); } catch (_) {} }); await closeDialogs(pg);

    // ٥) الخروج
    await Promise.all([pg.waitForURL(/admin_pos\.html/, { timeout: 15000 }), pg.click('#acting-bar button')]);
    await pg.waitForTimeout(5000);
    ok(await pg.evaluate(() => sessionStorage.getItem('gmt_acting')) === null, 'الخروج يعيد للإدارة ويمسح جلسة الدخول');
    ok((await dump()).gmt_audit.some(a => a.action === 'admin_exit_pos'), 'سجلّ التدقيق: خروج الأدمن');

    // ٤) قائمة فواتير الإدارة تُظهر أنّه الأدمن
    await pg.evaluate(async () => { try { await loadInvoices(); } catch (_) {} switchTab('invoices'); }); await pg.waitForTimeout(1500);
    const listTxt = await pg.evaluate(() => document.getElementById('app-content').innerText);
    ok(listTxt.includes('الأدمن ' + ADMIN_NAME) && listTxt.includes(String(iv.inv_number || '#')), 'قائمة فواتير الإدارة تُظهر الفاتورة باسم «الأدمن ' + ADMIN_NAME + '»');
    await pg.screenshot({ path: __dirname + '/acting_admin_list_' + w + '.png' });
    // ٤ب) وقائمة فواتير النقطة نفسها (ما يراه الموظّف)
    await browser.close();

    // ٦) ضابط: الموظّف نفسه في درعا ⇒ له عمولة على البيع ذاته
    const o2 = await H.open('pos.html', { init: H.STAFF_INIT, w, mobile: mob, wait: 7000 });
    await prepSale(o2.pg, p.id, 'زبون الموظّف ' + w);
    await o2.pg.evaluate(() => saveAndFinish()); await o2.pg.waitForTimeout(2500); await closeDialogs(o2.pg);
    const d2 = await dump(); const iv2 = (d2.invoices || []).find(i => i.customer_name === 'زبون الموظّف ' + w) || {};
    ok(iv2.cashier_name === 'سامر' && (d2.invoice_commissions || []).some(c => String(c.invoice_id) === String(iv2.id) && Number(c.amount) > 0), 'ضابط: بيع الموظّف نفسه له عمولة (فالصفر أعلاه من الدخول كأدمن)');
    // ٤ب) الموظّف نفسه يرى في سجلّ نقطته أنّ الأدمن أنشأ تلك الفاتورة، وفاتورته هو بحالة عمولتها العادية
    await o2.pg.evaluate(() => openInvoiceHistory()); await o2.pg.waitForTimeout(1800);
    const cards = await o2.pg.evaluate(() => [...document.querySelectorAll('#inv-hist-list [data-invid]')].map(e => e.innerText.replace(/\s+/g, ' ')));
    const cA = cards.find(t => t.includes('#' + iv.inv_number)) || '', cS = cards.find(t => t.includes('#' + iv2.inv_number)) || '';
    ok(cA.includes('أنشأها الأدمن ' + ADMIN_NAME) && cS && !cS.includes('أنشأها الأدمن') && cS.includes('قيد المراجعة'), 'سجلّ الموظّف: فاتورة الأدمن موسومة، وفاتورته «قيد المراجعة»');
    await o2.browser.close();

    // ٧) مفتاح gmt_acting لدى موظّف بلا صلاحية أدمن ⇒ يُتجاهل ويُمسح
    const FAKE = H.STAFF_INIT + `try{sessionStorage.setItem('gmt_acting', JSON.stringify({branch_key:'haleb',branch_name:'حلب',admin:'مزوّر',at:Date.now()}))}catch(e){}`;
    const o3 = await H.open('pos.html?acting=1', { init: FAKE, w, mobile: mob, wait: 7000 });
    const st3 = await o3.pg.evaluate(() => ({ acting: !!(currentUser && currentUser.acting_admin), br: branch && branch.key, name: currentUser && currentUser.display_name, bar: getComputedStyle(document.getElementById('acting-bar')).display }));
    ok(!st3.acting && st3.br === 'daraa' && st3.name === 'سامر' && st3.bar === 'none', 'gmt_acting بلا صلاحية أدمن ⇒ يُتجاهل: الموظّف في نقطته وباسمه، بلا شريط: ' + JSON.stringify(st3));
    await o3.browser.close();

    const bad = errs.filter(e => !/favicon|أصول ناقصة|Failed to load resource/.test(e));
    ok(bad.length === 0, 'لا أخطاء JS في الإدارة/النقطة: ' + JSON.stringify(bad.slice(0, 3)));
  }
  console.log(fails ? `FAIL=${fails} (pass ${pass})` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
