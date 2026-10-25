// TASK-0158 (= TASK-0013) — المالك seq 60 «حدّد كل نقطة بيع شو عندها بضائع — ممكن بضائع ما هي معرّفة أنشئها جديدة … أعدّل كميات كل منتج أو كل
// المنتجات — تعديل سيادي كامل فقط في بداية الإنشاء … فاتورة مثل فاتورة النقل: فاتورة إعادة إنشاء» + seq 68 (عند إنشاء الفاتورة · خياران كل مرّة).
// الجرد: أدوات الأدمن في «جرد المخزون» (لا تظهر للموظّف) · منتجٌ غير معرَّف يُنشأ · ⓪/= لما لم يُعَدّ · الاعتماد ⇐ الخيار + المستلم + الكلمة السيادية ·
// الكمّية مطلقة (من قراءةٍ حديثة) · فاتورتان بحسب الاتّجاه (الزيادات إلى النقطة · النقص منها) مستلَمتان · «نقلٌ من/إلى فرع» يحرّك الفرع الآخر ·
// رصيدٌ غير كافٍ ⇒ البند لم يُطبَّق ويُذكر · من الجرد: الزرّ يدخل النقطة ويفتح الجرد · لا «تكرار» لفاتورة إعادة إنشاء.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const dump = async () => H.call('/__dump', undefined, 'GET');
const prod = (d, id) => d.products.find(p => p.id === id);

(async () => {
  for (const [w, mob] of [[390, true], [1366, false]]) {
    console.log('— ' + w);
    await H.seed();
    const [P1, P2, P3, P4] = await H.call('/rest/v1/products', [
      { name: 'Canon 50mm', barcode: 'RB1', price: 120, wholesale_price: 90, haleb: 10, daraa: 5 },
      { name: 'Godox TT600', barcode: 'RB2', price: 70, wholesale_price: 50, haleb: 0, daraa: 3 },
      { name: 'Ulanzi VL49', barcode: 'RB3', price: 15, wholesale_price: 9, haleb: 4, daraa: 0 },
      { name: 'Boya M1', barcode: 'RB4', price: 12, wholesale_price: 7, haleb: 0, daraa: 2 }]);
    const { browser, pg, errs } = await H.open('pos.html', { init: H.STAFF_INIT, w, mobile: mob, wait: 6000 });

    // ١) الموظّف: لا أدوات أدمن
    const staff = await pg.evaluate(() => { openStockCount(); const r = { tools: document.getElementById('sc-admin').style.display, btn: document.getElementById('sc-rebuild-btn').style.display }; closeStockCount(); return r; });
    ok(staff.tools === 'none' && staff.btn === 'none', 'الموظّف: «جرد المخزون» بلا أدوات إعادة الإنشاء: ' + JSON.stringify(staff));

    // ٢) الأدمن داخل النقطة
    await pg.evaluate(() => { GMTRole.grant('المالك'); openStockCount(); });
    const adm = await pg.evaluate(() => ({ tools: document.getElementById('sc-admin').style.display, btn: getComputedStyle(document.getElementById('sc-rebuild-btn')).display }));
    ok(adm.tools === 'flex' && adm.btn !== 'none', 'الأدمن: «➕ منتج غير معرَّف · ⓪ · =» و«🧾 اعتماد كفاتورة إعادة إنشاء» ظاهرة');

    // ٣) منتجٌ غير معرَّف يُنشأ (اسم مكرّر يُرفض)
    const np = await pg.evaluate(async () => {
      const errsF = [];
      GMTAsk.form = async (m, o) => { const e1 = await o.submit({ name: 'Canon 50mm', barcode: '', price: '', qty: '1' }); errsF.push(e1.error || ''); const r = await o.submit({ name: 'حامل جديد تجريبي', barcode: 'NEW-RB', price: '25', qty: '٤' }); return r.result; };
      await scNewProduct();
      const p = allProducts.find(x => x.name === 'حامل جديد تجريبي');
      return { dupErr: errsF[0], id: p && p.id, count: p ? _scCounts[p.id] : null };
    });
    ok(/موجودٌ أصلاً/.test(np.dupErr) && np.id && np.count === 4, 'منتجٌ غير معرَّف: يُنشأ في القاعدة وعدّه ٤ (والاسم الموجود يُرفض): ' + JSON.stringify(np));

    // ٤) العدّ + «في النقطة وحدها» · الكمّية مطلقة من قراءةٍ حديثة (بيعٌ حدث بعد فتح الشاشة)
    await pg.evaluate((ids) => { scSetCount(ids.p1, '8'); scSetCount(ids.p2, '1'); scSetCount(ids.p4, '0'); }, { p1: P1.id, p2: P2.id, p4: P4.id });
    await H.call('/rest/v1/products?id=eq.' + P4.id, { daraa: 1 }, 'PATCH');               // بيعٌ بعد فتح الشاشة: 2 ⇐ 1
    const run = (answers) => pg.evaluate(async (answers) => {
      const q = answers.slice(), alerts = [], choices = [];
      GMTAsk.choose = async (m, o) => { choices.push({ m: String(m).slice(0, 120), c: (o.choices || []).map(x => x.t) }); return q.shift(); };
      GMTAsk.prompt = async () => 'سامر';
      GMTAuth.ask = async (k) => { window.__askKind = k; return true; };
      GMTAsk.alert = async (m, o) => { alerts.push(String(m)); };
      await scRebuild();
      return { alerts, choices, kind: window.__askKind, open: document.getElementById('stockcount-modal').style.display, draft: localStorage.getItem(_scKey()) };
    }, answers);
    let R = await run(['local']);
    await pg.waitForTimeout(600);
    let d = await dump();
    ok(prod(d, P1.id).daraa === 8 && prod(d, P2.id).daraa === 1 && prod(d, P4.id).daraa === 0 && prod(d, P3.id).daraa === 0 && prod(d, np.id).daraa === 4,
      'النقطة صارت كما حُدِّد تماماً: 8 · 1 · 0 (رغم بيعٍ بعد فتح الشاشة) · غير المعدود كما هو · الجديد 4: ' +
      JSON.stringify([prod(d, P1.id).daraa, prod(d, P2.id).daraa, prod(d, P4.id).daraa, prod(d, P3.id).daraa, prod(d, np.id).daraa]));
    ok(prod(d, P1.id).haleb === 10 && prod(d, P3.id).haleb === 4, '«في النقطة وحدها» لا يمسّ فرعاً آخر (حلب كما هي)');
    let rb = d.branch_stock_transfers.filter(t => /^فاتورة إعادة إنشاء/.test(t.title || ''));
    const upT = rb.find(t => t.to_branch === 'daraa'), dnT = rb.find(t => t.from_branch === 'daraa');
    ok(rb.length === 2 && upT && dnT && upT.from_branch === 'rebuild' && dnT.to_branch === 'rebuild' && rb.every(t => t.status === 'received' && t.is_locked !== false && t.received_by === 'سامر'),
      'فاتورتا إعادة إنشاء مستلَمتان مقفلتان: الزيادات إلى درعا · النقص منها (الطرف الآخر «تعديل سيادي»): ' + JSON.stringify(rb.map(t => ({ n: t.transfer_number, f: t.from_branch, t: t.to_branch, s: t.status, title: t.title }))));
    const itUp = d.stock_transfer_items.filter(i => i.transfer_id === (upT || {}).id), itDn = d.stock_transfer_items.filter(i => i.transfer_id === (dnT || {}).id);
    ok(itUp.length === 2 && itUp.some(i => i.product_id === P1.id && i.qty === 3 && /قبل 5 ⇐ بعد 8 \(\+3\)/.test(i.notes || '')) && itUp.some(i => i.product_id === np.id && i.qty === 4) &&
       itDn.length === 2 && itDn.some(i => i.product_id === P2.id && i.qty === 2) && itDn.some(i => i.product_id === P4.id && i.qty === 1 && /قبل 1 ⇐ بعد 0/.test(i.notes || '')) &&
       itUp.concat(itDn).every(i => i.received_at),
      'البنود: الكمّية = الفرق، و«قبل ⇐ بعد» على كلٍّ (الفرق محسوبٌ من القراءة الحديثة 1 لا 2) · كلّها مختومة');
    ok(/مع TRF-/.test(upT.note || '') && /في النقطة وحدها/.test(upT.note || '') && /اعتمدها المالك/.test(upT.note || ''), 'الملاحظة: الطريقة · من اعتمد · الفاتورة الأخرى: ' + (upT.note || '').slice(0, 120));
    ok(R.kind === 'sovereign' && R.choices[0] && R.choices[0].c.length === 2 && /3 منتج|4 منتج/.test(R.choices[0].m), 'الاعتماد: سؤال الخيارين ثمّ الكلمة السيادية: ' + JSON.stringify(R.choices[0]));
    ok(R.open === 'none' && !R.draft && R.alerts.some(a => /طُبّق 4 منتج/.test(a)), 'بعد الاعتماد: أُغلق الجرد ومُسحت مسوّدته والرسالة «طُبّق 4 منتج»: ' + (R.alerts[0] || '').slice(0, 90));

    // ٥) «نقلٌ من/إلى فرع» (حلب) + رصيدٌ غير كافٍ في حلب
    await pg.waitForTimeout(800);
    await pg.evaluate(async (ids) => { await _loadProductsFromServer(false); openStockCount(); scSetCount(ids.p1, '6'); scSetCount(ids.p3, '3'); scSetCount(ids.p2, '5'); }, { p1: P1.id, p2: P2.id, p3: P3.id });
    R = await run(['move', 'haleb']);
    await pg.waitForTimeout(600);
    d = await dump();
    ok(prod(d, P1.id).daraa === 6 && prod(d, P1.id).haleb === 12 && prod(d, P3.id).daraa === 3 && prod(d, P3.id).haleb === 1,
      'نقلٌ من/إلى حلب: نقص درعا عاد لحلب (10⇐12) · زيادتها خُصمت من حلب (4⇐1): ' + JSON.stringify([prod(d, P1.id).daraa, prod(d, P1.id).haleb, prod(d, P3.id).daraa, prod(d, P3.id).haleb]));
    const p2it = d.stock_transfer_items.filter(i => i.product_id === P2.id && /لم يُطبَّق/.test(i.failed_reason || ''));
    ok(prod(d, P2.id).daraa === 1 && prod(d, P2.id).haleb === 0 && p2it.length === 1 && !p2it[0].received_at && R.alerts.some(a => /لم يُطبَّق 1/.test(a) && /Godox/.test(a)),
      'رصيد حلب لا يكفي (Godox) ⇒ لم يُطبَّق، لا شيء تحرّك، والفاتورة والرسالة تذكرانه: ' + (R.alerts[0] || '').replace(/\s+/g, ' ').slice(0, 140));
    rb = d.branch_stock_transfers.filter(t => /^فاتورة إعادة إنشاء/.test(t.title || '') && (t.from_branch === 'haleb' || t.to_branch === 'haleb'));
    ok(rb.length === 2 && rb.some(t => /لم يُطبَّق 1: Godox/.test(t.note || '')), 'فاتورتا النقل مع حلب · الملاحظة تذكر ما لم يُطبَّق');

    // ٦) ⓪ و= لما لم يُعَدّ
    const bulk = await pg.evaluate(async (ids) => {
      await _loadProductsFromServer(false); openStockCount(); _scCounts = {}; scSetCount(ids.p1, '9');
      scBulk('zero'); const z = { p1: _scCounts[ids.p1], p3: _scCounts[ids.p3], p2: _scCounts[ids.p2] };
      _scCounts = {}; scBulk('sys'); const s = { p1: _scCounts[ids.p1], p3: _scCounts[ids.p3] };
      _scCounts = {}; closeStockCount(); return { z, s };
    }, { p1: P1.id, p2: P2.id, p3: P3.id });
    ok(bulk.z.p1 === 9 && bulk.z.p3 === 0 && bulk.z.p2 === 0 && bulk.s.p1 === 6 && bulk.s.p3 === 3, '«⓪ تصفير ما لم يُعَدّ» لا يمسّ المعدود · «= المسجّل» يأخذ كمّيات النقطة: ' + JSON.stringify(bulk));

    const bad = errs.filter(e => !/favicon|أصول ناقصة|Failed to load resource|404/.test(e));
    ok(bad.length === 0, 'لا أخطاء JS (نقطة البيع): ' + JSON.stringify(bad.slice(0, 3)));
    await browser.close();

    // ٧) من الجرد: الزرّ يدخل النقطة المختارة ويفتح «جرد المخزون» بأدوات الأدمن · لا «تكرار» لفاتورة إعادة إنشاء
    const I = await H.open('inventory.html', { w, mobile: mob, wait: 5000 });
    const dup = await I.pg.evaluate(async (id) => {
      const out = []; GMTAsk.alert = async (m) => { out.push(String(m)); };
      await loadStockTransfers(); await stDuplicateTransfer(id); return out;
    }, upT.id);
    ok(dup.some(a => /فاتورة إعادة إنشاء — لا تُكرَّر/.test(a)), '«🔁 تكرار» على فاتورة إعادة إنشاء ⇒ مرفوض مع السبب');
    await I.pg.evaluate(() => { GMTAsk.choose = async () => 'daraa'; openRebuildPos(); });
    await I.pg.waitForURL(/pos\.html\?acting=1&rebuild=1/, { timeout: 15000 }).catch(() => {});
    await I.pg.waitForFunction(() => { const m = document.getElementById('stockcount-modal'); return m && m.style.display === 'block'; }, null, { timeout: 25000 }).catch(() => {});
    const fromInv = await I.pg.evaluate(() => ({ url: location.search, open: (document.getElementById('stockcount-modal') || {}).style.display, tools: (document.getElementById('sc-admin') || {}).style.display,
      label: (document.getElementById('sc-branch-label') || {}).textContent || '' }));
    ok(/acting=1&rebuild=1/.test(fromInv.url) && fromInv.open === 'block' && fromInv.tools === 'flex' && /درعا/.test(fromInv.label),
      'من الجرد: «🧾 فاتورة إعادة إنشاء» ⇒ الأدمن داخل درعا و«جرد المخزون» مفتوح بأدواته: ' + JSON.stringify(fromInv));
    const bad2 = I.errs.filter(e => !/favicon|أصول ناقصة|Failed to load resource|404/.test(e));
    ok(bad2.length === 0, 'لا أخطاء JS (الجرد ⇐ نقطة البيع): ' + JSON.stringify(bad2.slice(0, 3)));
    await I.browser.close();
  }
  console.log(fails ? `FAIL=${fails} (pass ${pass})` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
