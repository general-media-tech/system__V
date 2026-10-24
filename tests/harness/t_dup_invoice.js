// TASK-0010 — منع تكرار/مضاعفة فواتير النقد (وثيقة الطلبات §٩: «في فواتير النقد … المضاعفة أو التكرار الغير المبرر امنع
// كل هذه الأشياء»). على نقطة البيع الحقيقية مقابل القاعدة الوهمية (فيها الفهرسان الفريدان كالقاعدة الحقيقية: inv_number · client_ref):
// ١) ضغطتان معاً على «حفظ» ⇒ فاتورة واحدة ومخزونٌ يُخصم مرّة · ٢) أُدرجت الفاتورة وضاع الردّ ⇒ تُتبنّى بالهويّة لا تُكرَّر ·
// ٣) البنود فشلت وتعذّر إلغاء الفاتورة ⇒ لا «حفظ ثانٍ» بفاتورةٍ جديدة: تُكمَل نفسها من الطابور · ٤) خطأ عرضٍ بعد الحفظ ⇒ محفوظة ·
// ٥) تبويبان يزامنان الطابور نفسه معاً ⇒ فاتورة واحدة وخصمٌ واحد · ٦) رقمها أخذه جهازٌ آخر أثناء الانقطاع ⇒ رقمٌ جديد لا تعلق ·
// ٧) سلّة حُفظت جزئياً ثمّ عُدّلت ⇒ لا فاتورة ثانية (تنبيه).
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const dump = async () => H.call('/__dump', undefined, 'GET');
const opts = o => H.call('/__opts', o);

async function stock(pid) { const d = await dump(); return Number(((d.products || []).find(p => String(p.id) === String(pid)) || {}).daraa); }
async function invoicesOf(name) { const d = await dump(); return (d.invoices || []).filter(i => i.customer_name === name); }
async function itemsOf(invId) { const d = await dump(); return (d.invoice_items || []).filter(i => String(i.invoice_id) === String(invId)); }
/* بيعٌ نقديّ لقطعة واحدة باسم زبونٍ مميّز */
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
    const [p] = await H.call('/rest/v1/products', [{ name: 'كاميرا التكرار', barcode: 'DUP1', price: 100, wholesale_price: 80, net_cost: 70, daraa: 20 }]);
    const { browser, pg, errs } = await H.open('pos.html', { init: H.STAFF_INIT, w, mobile: mob, wait: 7000 });

    // ١) ضغطتان معاً
    let s0 = await stock(p.id);
    await prepSale(pg, p.id, 'زبون الضغطتين');
    await pg.evaluate(() => Promise.all([saveAndFinish(), saveAndFinish()]));
    await pg.waitForTimeout(800);
    let inv = await invoicesOf('زبون الضغطتين');
    ok(inv.length === 1, 'ضغطتان معاً على «حفظ» ⇒ فاتورة واحدة (' + inv.length + ')');
    ok(await stock(p.id) === s0 - 1, 'والمخزون خُصم مرّة واحدة: ' + s0 + ' ⇐ ' + await stock(p.id));
    ok(inv[0] && /^pos-/.test(inv[0].client_ref || ''), 'الفاتورة تحمل هويّة البيع (client_ref)');
    await pg.evaluate(() => saveAndFinish()); await pg.waitForTimeout(500);
    ok((await invoicesOf('زبون الضغطتين')).length === 1, 'ضغطةٌ ثالثة بعد النجاح ⇒ لا فاتورة جديدة');

    // ٢) أُدرجت وضاع الردّ
    s0 = await stock(p.id);
    await prepSale(pg, p.id, 'زبون الردّ الضائع');
    await opts({ drop_reply: ['invoices'] });
    await pg.evaluate(() => saveAndFinish()); await pg.waitForTimeout(1200); await closeDialogs(pg);
    inv = await invoicesOf('زبون الردّ الضائع');
    ok(inv.length === 1, 'أُدرجت الفاتورة وضاع الردّ ⇒ تُتبنّى بهويّتها، فاتورة واحدة (' + inv.length + ')');
    ok(inv[0] && (await itemsOf(inv[0].id)).length === 1 && await stock(p.id) === s0 - 1, 'بنودها مرّة واحدة والمخزون خُصم مرّة');
    ok(await pg.evaluate(() => isSaved === true), 'والسلّة «محفوظة» (لا يُعاد حفظها)');

    // ٣) البنود فشلت مرّتين وتعذّر إلغاء الفاتورة ⇒ تُكمَل نفسها، لا فاتورة ثانية
    s0 = await stock(p.id);
    await prepSale(pg, p.id, 'زبون البنود');
    await opts({ fail_post: ['invoice_items', 'invoice_items'], block_delete: ['invoices'] });
    await pg.evaluate(() => saveAndFinish()); await pg.waitForTimeout(1500); await closeDialogs(pg);
    await opts({ block_delete: [] });
    ok(await pg.evaluate(() => isSaved === true), 'بعد فشل البنود وتعذّر الإلغاء: السلّة «محفوظة» — زرّ الحفظ لا يُنشئ فاتورةً ثانية');
    await pg.evaluate(() => syncPendingInvoices()); await pg.waitForTimeout(1500);
    await pg.evaluate(() => saveAndFinish()); await pg.waitForTimeout(600);
    inv = await invoicesOf('زبون البنود');
    ok(inv.length === 1, 'فاتورة واحدة فقط (' + inv.length + ')');
    ok(inv[0] && (await itemsOf(inv[0].id)).length === 1, 'وأُكملت بنودها من الطابور (' + (inv[0] ? (await itemsOf(inv[0].id)).length : 0) + ')');
    ok(await stock(p.id) === s0 - 1, 'والمخزون خُصم مرّة واحدة: ' + s0 + ' ⇐ ' + await stock(p.id));
    ok((await pg.evaluate(() => getPendingInvoices())).length === 0, 'والطابور فرغ');

    // ٤) خطأ عرضٍ بعد اكتمال الحفظ
    s0 = await stock(p.id);
    await prepSale(pg, p.id, 'زبون العرض');
    await pg.evaluate(() => { const o = window.gmtSnapshotLastInvoice; window.gmtSnapshotLastInvoice = function () { window.gmtSnapshotLastInvoice = o; throw new Error('عطل عرضٍ مُصطنع'); }; });
    await pg.evaluate(() => saveAndFinish()); await pg.waitForTimeout(800); await closeDialogs(pg);
    ok(await pg.evaluate(() => isSaved === true), 'خطأٌ في العرض بعد الحفظ ⇒ السلّة «محفوظة»');
    await pg.evaluate(() => saveAndFinish()); await pg.waitForTimeout(500);
    ok((await invoicesOf('زبون العرض')).length === 1 && await stock(p.id) === s0 - 1, 'وضغط «حفظ» ثانيةً لا يكرّرها ولا يخصم ثانيةً');

    if (w === 1366) {
      // ٥) تبويبان يزامنان الطابور نفسه معاً (IndexedDB واحد)
      s0 = await stock(p.id);
      await pg.evaluate(([pid]) => savePendingInvoice({
        invoiceData: { inv_number: 'OFF-TABS-1', branch_key: 'daraa', branch_name: 'درعا', total: 100, items_count: 1, customer_name: 'زبون التبويبين', client_ref: 'pos-test-tabs-1' },
        items: [{ product_id: pid, product_name: 'كاميرا التكرار', branch_key: 'daraa', qty: 1, unit_price: 100, total: 100 }],
        commissions: [], progress: {}, stockUpdates: [] }), [p.id]);
      const pg2 = await pg.context().newPage(); await pg2.goto(H.BASE + 'pos.html'); await pg2.waitForTimeout(5000);
      await Promise.all([pg.evaluate(() => syncPendingInvoices()), pg2.evaluate(() => syncPendingInvoices())]);
      await pg.waitForTimeout(1500);
      inv = await invoicesOf('زبون التبويبين');
      ok(inv.length === 1, 'تبويبان يزامنان الطابور نفسه معاً ⇒ فاتورة واحدة (' + inv.length + ')');
      ok(inv[0] && (await itemsOf(inv[0].id)).length === 1, 'وبنودها مرّة واحدة');
      ok(await stock(p.id) === s0 - 1, 'والمخزون خُصم مرّة واحدة: ' + s0 + ' ⇐ ' + await stock(p.id));
      await pg2.close();

      // ٦) رقمها أخذه جهازٌ آخر أثناء الانقطاع
      await H.call('/rest/v1/invoices', [{ inv_number: 'OFF-TAKEN-7', branch_key: 'haleb', total: 55, items_count: 2, customer_name: 'جهازٌ آخر', client_ref: 'pos-other-device' }]);
      await pg.evaluate(([pid]) => savePendingInvoice({
        invoiceData: { inv_number: 'OFF-TAKEN-7', branch_key: 'daraa', branch_name: 'درعا', total: 100, items_count: 1, customer_name: 'زبون الرقم المأخوذ', client_ref: 'pos-test-taken-1' },
        items: [{ product_id: pid, product_name: 'كاميرا التكرار', branch_key: 'daraa', qty: 1, unit_price: 100, total: 100 }],
        commissions: [], progress: {}, stockUpdates: [] }), [p.id]);
      await pg.evaluate(() => syncPendingInvoices()); await pg.waitForTimeout(1200);
      inv = await invoicesOf('زبون الرقم المأخوذ');
      ok(inv.length === 1 && inv[0].inv_number !== 'OFF-TAKEN-7' && /تغيّر عند المزامنة/.test(inv[0].notes || '') && inv[0].review_status === 'pending',
        'رقمٌ أخذه جهازٌ آخر ⇒ رقمٌ جديد مع ملاحظة «قيد المراجعة» (لا تعلق في الطابور): ' + (inv[0] && inv[0].inv_number));
      ok((await invoicesOf('جهازٌ آخر')).length === 1, 'وفاتورة الجهاز الآخر لم تُمسّ');
      ok((await pg.evaluate(() => getPendingInvoices())).length === 0, 'والطابور فرغ');

      // ٧) سلّة لها فاتورة من محاولةٍ سابقة ثمّ عُدّلت ⇒ لا فاتورة ثانية
      await prepSale(pg, p.id, 'زبون السلّة المعدّلة');
      const ref = await pg.evaluate(() => (_saleRef = mkSaleRef()));
      await H.call('/rest/v1/invoices', [{ inv_number: 'PREV-ATTEMPT-1', branch_key: 'daraa', total: 300, items_count: 3, customer_name: 'زبون السلّة المعدّلة', client_ref: ref }]);
      await pg.evaluate(() => saveAndFinish()); await pg.waitForTimeout(800);
      const dlg = await pg.evaluate(() => { const o = document.querySelector('.gmtask-ov'); return o ? o.innerText.replace(/\s+/g, ' ') : ''; });
      await closeDialogs(pg);
      ok((await invoicesOf('زبون السلّة المعدّلة')).length === 1 && /منعاً لتكرار الفاتورة/.test(dlg) && /PREV-ATTEMPT-1/.test(dlg),
        'السلّة نفسها لها فاتورة سابقة بإجماليٍ مختلف ⇒ لا فاتورة ثانية + تنبيهٌ يسمّي السابقة');
    }

    const fit = await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok(fit <= 2, 'لا طفح أفقي');
    const real = errs.filter(e => !/Failed to load resource|status of (400|404|409|500|503)|Failed to fetch|عطل عرضٍ مُصطنع/.test(e));
    ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 3).join(' | '));
    await browser.close();
  }
  await opts({ drop_reply: [], fail_post: [], block_delete: [] });
  console.log(fails ? `FAIL=${fails} PASS=${pass}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
