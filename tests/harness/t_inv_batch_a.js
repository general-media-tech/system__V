// (دفعة «الجرد والمنتجات» · طابور سونيت) ARC-MD-09#7 · VER-2#REQ-0189 · OWN-05#17 · OWN-05#123 · OWN-12#13 · VER-4#REQ-0421
//  ١) فاتورة النقل: المنتج المُدخَل (أو المعاد مسحه) يظهر أعلى القائمة، والترتيب يبقى بعد استعادة المسوّدة
//  ٢) التصدير «المفلتر»: فلتر فرع ⇒ عمود ذلك الفرع وحده + الإجمالي · «الكل» ⇒ كلّ الأعمدة
//  ٣) فلتر الماركة في الجرد: يتقاطع مع التصنيف ويعيد الكلّ عند «كل الماركات» والتصدير المفلتر يتبعه
//  ٤) اسم ملف صورة المنتج: لاتيني صغير موحّد في المسارات الثلاثة
//  ٥) أصوات المخزون الـ١١: مسجَّلة بفئة INV ومربوطة بعملياتها
//  ٦) الفاحص الذاتي يتحقّق من ملفّات المكتبات المؤجَّلة (Excel…)
const H = require('./h.js');
let pass = 0, fails = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✔', m); } else { fails++; console.log('  ✘', m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.call('/__reset', {});
  await H.call('/__opts', { reject_cols: [], unique_order_invoice: true, old_rpc_false: false, rls_block: [], no_pos_fn: false, sov: '2003', pos_protected: true, pos_locked: false });
  await H.call('/rest/v1/inv_columns', [['haleb', 'حلب'], ['daraa', 'درعا']].map(([k, nm], i) => ({ key_name: k, display_name: nm, col_type: 'number', include_in_total: true, is_branch: true, show_form: true, show_table: true, sort_order: i + 3, col_order: i + 3 })));
  const prods = await H.call('/rest/v1/products', [
    { name: 'هيد لايت Godox 100 وات', barcode: 'G1', price: 100, wholesale_price: 80, cost_price: 60, haleb: 5, daraa: 3, brand: 'Godox', category: 'إضاءة', group_name: 'رؤوس' },
    { name: 'فلاش Godox TT600', barcode: 'G2', price: 120, wholesale_price: 90, cost_price: 70, haleb: 4, daraa: 0, brand: 'godox', category: 'فلاشات', group_name: 'فلاش' },
    { name: 'كاميرا Canon 80D', barcode: 'C1', price: 900, wholesale_price: 800, cost_price: 700, haleb: 2, daraa: 2, brand: 'Canon', category: 'إضاءة', group_name: 'كاميرات' },
    { name: 'حامل بلا ماركة', barcode: 'N1', price: 30, wholesale_price: 20, cost_price: 10, haleb: 9, daraa: 9, category: 'إكسسوار', group_name: 'حوامل' },
  ]);
  const { browser, pg, errs } = await H.open('inventory.html', { w: 1366, h: 900, wait: 5500, mobile: false });
  const ev = (f, a) => pg.evaluate(f, a);

  /* ══ ١) ARC-MD-09#7 — فاتورة النقل: الأحدث أعلى القائمة ══ */
  await ev(() => { switchAppMode('transfer'); openNewStockTransferModal(); document.getElementById('st-from-select').value = 'haleb'; document.getElementById('st-to-select').value = 'daraa'; onStBranchChange(); stState.items = {}; });
  const rows = () => ev(() => [...document.querySelectorAll('#st-selected-list tbody tr td:first-child')].map(td => td.textContent.trim()));
  await ev(([a, b, c]) => { stAddProduct(a); stAddProduct(b); stAddProduct(c); }, [prods[0].id, prods[1].id, prods[2].id]);
  let r = await rows();
  ok(r.join('|') === 'كاميرا Canon 80D|فلاش Godox TT600|هيد لايت Godox 100 وات', 'ثلاثة منتجات تباعاً ⇒ آخرها أوّل سطر: ' + r.join(' | '));
  await ev(id => stAddProduct(id), prods[0].id);
  r = await rows();
  ok(r[0] === 'هيد لايت Godox 100 وات' && r.length === 3, 'إعادة إدخال منتج موجود ⇒ يصعد للأعلى بلا تكرار: ' + r.join(' | '));
  /* المسوّدة تحفظ الترتيب ويستأنف العدّاد */
  const draft = await ev(async () => {
    stSaveDraft();
    const saved = JSON.parse(localStorage.getItem(ST_DRAFT_KEY)).state.items;
    stState = { fromBranch: 'haleb', toBranch: 'daraa', items: {} }; _stSeq = 0;
    GMTAsk.confirm = async () => true;
    const loaded = await stLoadDraft();
    renderStSelectedList();
    return { loaded, seqs: Object.values(saved).map(i => i._seq), order: [...document.querySelectorAll('#st-selected-list tbody tr td:first-child')].map(td => td.textContent.trim()) };
  });
  ok(draft.loaded && draft.order[0] === 'هيد لايت Godox 100 وات' && draft.order.join('|') === r.join('|'), 'استعادة المسوّدة تُبقي الترتيب نفسه: ' + draft.order.join(' | '));
  await ev(id => stAddProduct(id), prods[3].id);
  r = await rows();
  ok(r[0] === 'حامل بلا ماركة', 'بعد الاستعادة يستأنف العدّاد: الجديد أعلى القائمة: ' + r.join(' | '));
  /* بند بلا _seq (نسخٌ/تعديل/تفريغ) يبقى بعد المُدخَل ولا ينكسر الحفظ */
  const saved = await ev(async () => {
    delete stState.items[Object.keys(stState.items)[0]]._seq;
    renderStSelectedList();
    document.getElementById('st-creator-name').value = 'فاحص';
    GMTAsk.confirm = async () => false; GMTAsk.alert = async () => true;
    await saveStockTransfer();
    return true;
  });
  await sleep(2500);
  const dump = await H.call('/__dump', undefined, 'GET');
  ok((dump.stock_transfer_items || []).length === 4 && (dump.stock_transfer_items || []).every(i => !('_seq' in i)), 'حفظ الفاتورة سليم (٤ بنود) و_seq لا يتسرّب إلى القاعدة');

  /* ══ ٢) VER-2#REQ-0189 — التصدير المفلتر ══ */
  await ev(() => { switchAppMode('inventory'); });
  await sleep(500);
  const exportHeaders = async (mode, setup) => {
    await ev(() => { window.__blobs = []; const o = URL.createObjectURL.bind(URL); URL.createObjectURL = b => { window.__blobs.push(b); return o(b); }; HTMLAnchorElement.prototype.click = function () {}; });
    await ev(setup);
    await ev(m => { exportExcel(m); }, mode);
    await pg.waitForFunction(() => window.__blobs && window.__blobs.length, null, { timeout: 20000 }).catch(() => {});
    return ev(async () => {
      await GMTLazyLib.need('xlsx');
      const b = window.__blobs.pop(); const wb = XLSX.read(await b.arrayBuffer(), { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
      return { head: rows[0], n: rows.length - 1 };
    });
  };
  let ex = await exportHeaders('filtered', () => { currentBranchFilter = 'haleb'; applyFilters(); });
  ok(ex.head.includes('حلب') && !ex.head.includes('درعا') && ex.head.includes('الإجمالي'), 'فلتر «حلب» + تصدير المفلتر ⇒ عمود حلب وحده + الإجمالي: ' + ex.head.join(','));
  ex = await exportHeaders('all', () => { currentBranchFilter = 'haleb'; applyFilters(); });
  ok(ex.head.includes('حلب') && ex.head.includes('درعا'), 'تصدير «الكل» مع نفس الفلتر ⇒ كلّ أعمدة الفروع (ملفّ استيرادٍ كامل): ' + ex.head.join(','));
  ex = await exportHeaders('filtered', () => { currentBranchFilter = ''; applyFilters(); });
  ok(ex.head.includes('حلب') && ex.head.includes('درعا') && ex.n === 4, 'بلا فلتر فرع ⇒ المفلتر يعيد كلّ الأعمدة (' + ex.n + ' منتجات)');

  /* ══ ٣) OWN-05#17 — فلتر الماركة ══ */
  const bf = await ev(() => { const el = document.getElementById('inv-brand-filter'); return { shown: el && el.style.display !== 'none', opts: el ? [...el.options].map(o => o.value) : [] }; });
  ok(bf.shown && bf.opts.join('|').toLowerCase() === '|canon|godox', 'القائمة تُملأ من ماركات المنتجات (Godox/godox ماركة واحدة): ' + bf.opts.join('|'));
  let cnt = await ev(() => { currentBrand = ''; document.getElementById('inv-brand-filter').value = 'Godox'; invBrandSet('Godox'); return filteredProducts.map(p => p.barcode).sort(); });
  ok(cnt.join() === 'G1,G2', 'ماركة Godox ⇒ منتجاتها فقط (بلا حساسية لحالة الأحرف): ' + cnt.join());
  cnt = await ev(() => { invTreeSet('main', ''); currentCategory = 'إضاءة'; applyFilters(); return filteredProducts.map(p => p.barcode).sort(); });
  ok(cnt.join() === 'G1', 'ماركة + تصنيف ⇒ التقاطع: ' + cnt.join());
  ex = await exportHeaders('filtered', () => { });
  ok(ex.n === 1, 'التصدير المفلتر يتبع فلتر الماركة (صفّ واحد)');
  cnt = await ev(() => { currentCategory = ''; invBrandSet(''); return filteredProducts.length; });
  ok(cnt === 4, '«كل الماركات» يعيد الكل: ' + cnt);

  /* ══ ٤) OWN-05#123 — اسم ملف الصورة ══ */
  const nm = await ev(() => ({
    a: imgName('ABC-123', 'PNG'), b: imgName('حامل ١', 'jpg'), c: imgName(42, ''),
    e1: imgExt({ name: 'صورة كبيرة.JPEG', type: 'image/jpeg' }), e2: imgExt({ name: 'بلا امتداد', type: 'image/png' }), e3: imgExt({ name: 'x', type: '' }),
  }));
  ok(/^abc-123-\d+\.png$/.test(nm.a) && /^p-\d+\.jpg$/.test(nm.b) && /^42-\d+\.webp$/.test(nm.c), 'imgName: لاتيني صغير وأرقام وشرطات فقط: ' + [nm.a, nm.b, nm.c].join(' · '));
  ok(nm.e1 === 'jpg' && nm.e2 === 'png' && nm.e3 === 'webp', 'imgExt: من اسم الملف (jpeg⇒jpg) وإلا من نوعه وإلا webp: ' + [nm.e1, nm.e2, nm.e3].join(' · '));
  const up = await ev(async id => {
    const paths = []; sbUploadImg = async (p, f) => { paths.push(p); return { url: 'https://x.test/' + p, error: null }; };
    /* ١) المحرّر — تعديل */
    openProductModal(id); await new Promise(r => setTimeout(r, 400));
    const setF = (f) => { const dt = new DataTransfer(); dt.items.add(f); document.getElementById('f-img-file').files = dt.files; };
    setF(new File([new Uint8Array([1, 2, 3])], 'صورة كبيرة.PNG', { type: 'image/png' }));
    await saveProduct();
    /* ٢) المحرّر — إنشاء */
    openProductModal(); await new Promise(r => setTimeout(r, 400));
    document.getElementById('f-name').value = 'منتج جديد لاختبار الصورة';
    setF(new File([new Uint8Array([1, 2, 3])], 'صورة.JPG', { type: 'image/jpeg' }));
    await saveProduct();
    return paths;
  }, prods[3].id);
  ok(up.length === 2 && up.every(p => /^products\/[a-z0-9-]+-\d+\.(png|jpg)$/.test(p)), 'مسارا المحرّر (تعديل/إنشاء): لاتيني صغير بلا اسم عربيّ: ' + up.join(' · '));

  /* ══ ٥) OWN-12#13 — أصوات المخزون ══ */
  const names = ['invAdd', 'invEdit', 'invDel', 'invPhoto', 'invQty', 'invTransfer', 'countStart', 'countMatch', 'countMismatch', 'labelPrint', 'catNew'];
  const reg = await ev(n => ({ listed: n.every(k => GMTSound.list.includes(k)), cat: n.every(k => GMTSound.meta[k] && GMTSound.meta[k].cat === 'INV'), alias: GMTSound.alias.INV_ADD === 'invAdd' && GMTSound.alias.INV_CAT_NEW === 'catNew', ev: GMTAudio.eventMap()['inv.add'].key === 'invAdd', dur: n.every(k => GMTSound.duration(k) > 0 && GMTSound.duration(k) < 1.2), lab: n.every(k => GMTSound.labels.some(l => l[0] === k)) }), names);
  ok(reg.listed && reg.cat && reg.alias && reg.ev && reg.dur && reg.lab, 'الأصوات الـ١١ مسجّلة (فئة INV · أسماء مستعارة · أحداث · مدّة < 1.2ث · في المعرض): ' + JSON.stringify(reg));
  const last = () => ev(() => GMTSound.last());
  const wait = () => sleep(400);   /* cue يمنع صوتين خلال ٢٦٠ms */
  const fireAndSee = async (label, expect, fn) => { await wait(); await ev(() => GMTSound.cue('click')); await wait(); await fn(); const l = await last(); ok(l === expect, label + ' ⇒ ' + expect + ' (الفعلي: ' + l + ')'); };
  await fireAndSee('إضافة منتج', 'invAdd', () => ev(async () => { openProductModal(); await new Promise(r => setTimeout(r, 400)); document.getElementById('f-name').value = 'منتج للصوت'; await saveProduct(); }));
  await fireAndSee('تعديل منتج', 'invEdit', () => ev(async id => { openProductModal(id); await new Promise(r => setTimeout(r, 400)); await saveProduct(); }, prods[3].id));
  await fireAndSee('حذف منتج', 'invDel', () => ev(async id => { deletingProductId = id; if (window.GMTIntegrity) GMTIntegrity.guardDelete = async () => true; await confirmDelete(); }, prods[2].id));
  await fireAndSee('إضافة كمية (تسوية)', 'invQty', () => ev(async id => {
    GMTAsk.form = async (m, o) => ({ result: Object.assign({}, ...o.fields.map(f => ({ [f.k]: f.value })), { haleb: '20' }) });
    GMTAsk.confirm = async () => true; GMTAsk.alert = async () => {}; if (window.GMTAuth) GMTAuth.ask = async () => true;
    await invQtyAdjust(id);
  }, prods[0].id));
  await fireAndSee('تحويل بين فروع', 'invTransfer', async () => {
    await ev(async id => {
      switchAppMode('transfer'); openNewStockTransferModal(); document.getElementById('st-from-select').value = 'haleb'; document.getElementById('st-to-select').value = 'daraa'; onStBranchChange(); stState.items = {};
      stAddProduct(id); document.getElementById('st-creator-name').value = 'فاحص'; GMTAsk.confirm = async () => false; GMTAsk.alert = async () => true;
      await saveStockTransfer();
    }, prods[1].id);
  });
  await fireAndSee('بدء جرد', 'countStart', () => ev(async () => { if (window.GMTRole) GMTRole.requireAdmin = async () => true; window.GMTReconcile = Object.assign({}, window.GMTReconcile, { open() {} }); await openReconcile(); }));
  await fireAndSee('طباعة ملصقات (ورقة الباركود)', 'labelPrint', () => ev(() => { GMTLabels.openSheet = () => true; openBarcodeSheet('all'); }));
  await fireAndSee('إنشاء تصنيف', 'catNew', () => ev(async () => {
    gmCatOpen(); await new Promise(r => setTimeout(r, 400));
    document.getElementById('cat-name').value = 'تصنيف جديد للصوت';
    const first = document.querySelector('#cat-groups-list input[data-g]'); if (first) { first.checked = true; first.dispatchEvent(new Event('change', { bubbles: true })); gmCatSel.add(first.dataset.g); }
    await gmCatSave();
  }));
  await fireAndSee('رفع صورة (قائمة النقص)', 'invPhoto', () => ev(() => { invSnd('invPhoto'); }));   // الربط الفعلي مفحوص ساكناً أدناه
  const src = await ev(() => document.documentElement.outerHTML.length > 0 && [...document.scripts].map(s => s.textContent).join('\n'));
  ok(/invSnd\('invPhoto'\); showToast\('✅ رُفعت الصورة'/.test(src) && /if \(saved > 0\) invSnd\('invPhoto'\)/.test(src), 'نداءا صوت الصورة موصولان قبل toast في رفع الصورة الفردي والجماعي');
  const mm = await ev(() => { GMTSound.cue('click'); return 1; });

  /* ══ ٦) VER-4#REQ-0421 — الفاحص الذاتي يتحقّق من المكتبات المؤجَّلة ══ */
  const pdfBefore = await ev(() => GMTLazyLib.ready('pdfjs'));
  const sc = await ev(async () => ({ src: GMTLazyLib.src('xlsx'), names: GMTLazyLib.names.slice(), r: await GMTSelfCheck.checkLazyLibs() }));
  ok(sc.src === 'lib/xlsx.full.min.js' && sc.r.level === 'ok' && /مكتبة Excel/.test(sc.r.title), 'الفاحص: بند «مكتبة Excel» ✓ حين تكون الملفّات موجودة: ' + sc.r.title);
  await pg.route('**/lib/exceljs.min.js*', route => route.fulfill({ status: 404, body: 'nf' }));
  const sc2 = await ev(async () => GMTSelfCheck.checkLazyLibs());
  ok(sc2.level === 'bad' && /exceljs/.test(sc2.title) && /مفقودة/.test(sc2.title), 'ملفّ exceljs مفقود ⇒ ✗ «مكتبة … مفقودة»: ' + sc2.title);
  ok(await ev(t => GMTSelfCheck._plain({ title: t, detail: '' }).t.length > 0, sc2.title), 'نصّ الشريط للأدمن مفهوم (plain)');
  ok(!pdfBefore && !(await ev(() => GMTLazyLib.ready('pdfjs'))), 'الفحص لا يحمّل المكتبة نفسها (pdfjs غير محمَّلة قبل الفحص وبعده)');

  const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource|00000000-0000-0000-0000-000000000000/.test(e));   // (الأخير: مسبار الفاحص الذاتي checkRpc بمعرّفٍ صفريّ — متعمَّد)
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 3)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
