// (TASK-0291 · المالك seq 235) «الاشياء اللي بدها دمج او شاكك فيها خليها تطلع قدامي فورا اول ما ادخل على السيستم …
//  اعرضها لي مع الصور ومع كل شيء لحتى اوافق او قلك لا هي غيرها» — و«ضيف بين اساميها ايضا كما كانت مسميه هنا في الفاتوره»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const real = (errs) => errs.filter(e => !/status of (400|401|404|406)|Failed to load resource|favicon/.test(e));
(async () => {
  for (const [W, mob] of [[390, true], [1366, false]]) {
    await H.seed();
    const [OLD, NEW, STOCKED, PICK, KEEP2] = await H.call('/rest/v1/products', [
      { name: 'Godox v860', barcode: 'MR0001', price: 0, cost_price: 0, haleb: 0, daraa: 0, group_name: 'فلاشات', image_url: 'img/logo.png', specs: { '__brand': 'Godox' }, invoice_names: [] },
      { name: 'Godox V860III-C فلاش', barcode: 'MR0002', price: 0, cost_price: 137.91, haleb: 0, daraa: 0, group_name: 'فلاشات', compat: 'Canon EOS', specs: { 'الدليل': 'GN60', '__import': 'x' }, invoice_names: [{ n: 'Godox V860III-C', src: 'Shixin', usd: 137.91 }] },
      { name: 'منتج عليه كمية', barcode: 'MR0003', price: 5, haleb: 3, daraa: 0, group_name: 'فلاشات', invoice_names: [{ n: 'stocked line', src: 'Shixin' }] },
      { name: 'كفر سيليكون r8 r7', barcode: 'MR0004', price: 12, haleb: 0, daraa: 0, group_name: 'كفرات', compat: 'Canon EOS R8, Canon EOS R7' },
      { name: 'Led 660 pro', barcode: 'MR0005', price: 70, haleb: 11, daraa: 0, group_name: 'بانيل ليد' }]);
    await H.call('/rest/v1/gmt_merge_review', [
      { kind: 'merge', prio: 1, status: 'pending', subject_id: NEW.id, cands: [{ id: OLD.id, label: 'عندك في الجرد' }], title: 'هل «Godox V860III-C» هو «Godox v860» نفسه؟', note: 'صورة القديم مكتوب عليها V860III', conf: 90 },
      { kind: 'merge', prio: 2, status: 'pending', subject_id: STOCKED.id, cands: [{ id: KEEP2.id }], title: 'منتج عليه كمية', conf: 50 },
      { kind: 'pick', prio: 3, status: 'pending', subject_id: PICK.id, cands: [{ label: 'لكاميرا R8', name: 'كفر سيليكون EOS R8', compat: 'Canon EOS R8' }, { label: 'لكاميرا R7', name: 'كفر سيليكون EOS R7', compat: 'Canon EOS R7' }], title: 'هذا الكفر لأيّ كاميرا؟' },
      { kind: 'merge', prio: 4, status: 'pending', subject_id: KEEP2.id, cands: [{ id: OLD.id }], title: 'مختلفان؟', conf: 30 }]);
    const { browser, pg, errs } = await H.open('home.html', { w: W, h: mob ? 844 : 900, mobile: mob, wait: 5000, init: H.ADMIN_INIT });
    await pg.waitForSelector('.mr-ov .mr-col', { timeout: 12000 }).catch(() => {});
    const v1 = await pg.evaluate(() => ({ open: !!document.querySelector('.mr-ov'), cols: document.querySelectorAll('.mr-ov .mr-col').length, txt: (document.querySelector('.mr-ov') || {}).innerText || '', imgs: document.querySelectorAll('.mr-ov .mr-gal img').length, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    ok(v1.open, W + ': النافذة تفتح وحدها للأدمن عند الدخول');
    ok(v1.cols === 2 && /V860III-C/.test(v1.txt) && /Godox v860/.test(v1.txt) && /137\.91|Godox V860III-C/.test(v1.txt), W + ': المنتجان جنباً إلى جنب بالاسم واسم الفاتورة: ' + v1.cols);
    ok(v1.imgs >= 1 && /1 \/ 4/.test(v1.txt), W + ': بالصور وعدّاد «1 / 4»');
    ok(v1.sw <= v1.cw + 1, W + ': بلا طفحٍ أفقي ' + v1.sw + '/' + v1.cw);
    // ① نعم هو نفسه ⇒ دمج
    await pg.click('.mr-ov [data-mr="merge"]'); await pg.waitForTimeout(1500);
    let d = await H.call('/__dump', undefined, 'GET');
    const o = d.products.find(p => p.id === OLD.id), n = d.products.find(p => p.id === NEW.id);
    ok(!n, W + ': المنتج المكرّر حُذف بعد الدمج');
    ok(o && Array.isArray(o.invoice_names) && o.invoice_names.some(x => x.n === 'Godox V860III-C'), W + ': اسم الفاتورة صار على المنتج القديم (يُعرف في الفاتورة القادمة)');
    ok(o && /Godox V860III-C فلاش/.test(o.alt_names || ''), W + ': واسم المنتج المدموج صار بين أسمائه البديلة: ' + (o && o.alt_names));
    ok(o && o.compat === 'Canon EOS' && o.specs && o.specs['الدليل'] === 'GN60' && o.image_url === 'img/logo.png', W + ': القديم بلا توافق/مواصفات أخذها، وصورته بقيت كما هي');
    ok((d.gmt_audit || []).some(r => r.action === 'merge_review' && r.entity_id === String(NEW.id) && /V860III-C/.test(r.old_value || '')), W + ': لقطةٌ كاملة للمحذوف في سجلّ العمليات (قابل للاسترجاع)');
    ok((d.gmt_merge_review || []).find(r => r.subject_id === NEW.id).status === 'done', W + ': القرار محفوظ (done)');
    // ② له كمية ⇒ يرفض ولا يحذف
    await pg.click('.mr-ov [data-mr="merge"]'); await pg.waitForTimeout(1200);
    const er = await pg.evaluate(() => (document.querySelector('.mr-err') || {}).textContent || '');
    d = await H.call('/__dump', undefined, 'GET');
    ok(/كمية/.test(er) && d.products.some(p => p.id === STOCKED.id), W + ': منتجٌ له كمية لا يُدمج آلياً ويبقى: ' + er.slice(0, 60));
    await pg.click('.mr-ov [data-mr="later"]'); await pg.waitForTimeout(400);
    // ③ اختيار الاسم الصحيح
    await pg.click('.mr-ov [data-mr="pick"][data-i="0"]'); await pg.waitForTimeout(1200);
    d = await H.call('/__dump', undefined, 'GET');
    const pk = d.products.find(p => p.id === PICK.id);
    ok(pk && pk.name === 'كفر سيليكون EOS R8' && pk.compat === 'Canon EOS R8' && /r8 r7/.test(pk.alt_names || ''), W + ': «اسمان/توافقان» ⇒ الاسم والتوافق الصحيحان والقديم بين البديلة: ' + (pk && pk.name));
    // ④ لا، مختلف
    await pg.click('.mr-ov [data-mr="no"]'); await pg.waitForTimeout(1000);
    d = await H.call('/__dump', undefined, 'GET');
    ok((d.gmt_merge_review || []).find(r => r.subject_id === KEEP2.id).status === 'rejected' && d.products.some(p => p.id === KEEP2.id), W + ': «لا، مختلف» يُحفظ ولا يُحذف شيء');
    const back = await pg.evaluate(() => (document.querySelector('.mr-ov') || {}).innerText || '');
    ok(/منتج عليه كمية/.test(back) && /التقدّم: 3 \/ 4/.test(back), W + ': بعد آخر بطاقة تعود البطاقة المؤجَّلة «لاحقاً» والتقدّم 3 / 4');
    ok(!real(errs).length, W + ': لا أخطاء JS ' + real(errs).slice(0, 2).join(' / '));
    await browser.close();
  }
  // دفعة التوحيد (ألوان الكفر ⇐ كفر الموديل): ضغطةٌ واحدة · بلا أسماء ألوان بين البديلة · ما عليه كمية يبقى
  await H.seed();
  const [TG, C1, C2, CQ] = await H.call('/rest/v1/products', [
    { name: 'Eos R كفر سيليكون', barcode: 'BK1', price: 12, haleb: 19, group_name: 'كفرات', image_url: 'img/logo.png', invoice_names: [{ n: 'EOS R line', src: 'Shixin' }] },
    { name: 'كفر سيليكون EOS R · زهري (Pink)', barcode: 'BK2', haleb: 0, group_name: 'كفرات', invoice_names: [{ n: 'EOS R line', src: 'Shixin', color: 'Pink' }] },
    { name: 'كفر سيليكون EOS R · soldiers', barcode: 'BK3', haleb: 0, group_name: 'كفرات', invoice_names: [{ n: 'EOS R line', src: 'Shixin', color: 'soldiers' }] },
    { name: 'كفر عليه كمية', barcode: 'BK4', haleb: 2, group_name: 'كفرات' }]);
  await H.call('/rest/v1/gmt_merge_review', [{ kind: 'bulk', prio: 0, status: 'pending', title: 'توحيد ألوان الكفرات', cands: [{ into: TG.id, ids: [C1.id, C2.id, CQ.id], noAlt: true, label: 'EOS R' }] }]);
  {
    const { browser, pg, errs } = await H.open('home.html', { w: 390, h: 844, wait: 4500 });
    await pg.waitForSelector('.mr-ov [data-mr="bulk"]', { timeout: 10000 }).catch(() => {});
    const t = await pg.evaluate(() => (document.querySelector('.mr-ov') || {}).innerText || '');
    ok(/زهري/.test(t) && /soldiers/.test(t) && /Eos R كفر سيليكون/.test(t) && /كمية 2/.test(t), 'دفعة التوحيد تعرض كل منتج وهدفه وتنبّه لما عليه كمية');
    ok(/المرحلة: توحيد/.test(t) && (await pg.evaluate(() => document.querySelectorAll('.mr-ov [data-bk]:checked').length)) === 3, 'المرحلة ظاهرة وكلّ منتجٍ بمربّعٍ محدَّد افتراضياً');
    ok(/التقدّم: 0 \/ 1/.test(t) && (await pg.evaluate(() => document.querySelectorAll('.mr-ov .mr-chip').length)) === 1, 'شريط المراحل: التقدّم العامّ وشريحة لكلّ مرحلة بعدّادها');
    await pg.evaluate((id) => document.querySelector('.mr-ov [data-mr="peek"][data-p="' + id + '"]').click(), C1.id); await pg.waitForTimeout(300);
    const pk = await pg.evaluate((id) => { const b = document.querySelector('[data-peek="' + id + '"]'); return b ? { cols: b.querySelectorAll('.mr-col').length, t: b.innerText } : null; }, C1.id);
    ok(pk && pk.cols === 2 && /زهري/.test(pk.t) && /Eos R كفر سيليكون/.test(pk.t) && /الكمية/.test(pk.t), '«👁 راجع» يعرض المنتجين عرضاً كاملاً جنباً إلى جنب');
    await pg.evaluate((id) => { document.querySelector('.mr-ov [data-bk][value="' + id + '"]').checked = false; }, C2.id);   // «احدد شيء ما يندمج»
    const seen = []; const iv = setInterval(async () => { try { const x = await pg.evaluate(() => { const e = document.querySelector('.mr-prog'); return e && e.style.display !== 'none' && e.querySelector('.mr-bar') ? e.textContent : ''; }); if (x) seen.push(x); } catch (_) {} }, 60);
    await pg.click('.mr-ov [data-mr="bulk"]'); await pg.waitForTimeout(2500); clearInterval(iv);
    ok(seen.some(x => /يدمج… \d+ \/ 2/.test(x)), 'شريط التقدّم ظاهر أثناء الدمج: ' + (seen[0] || '—'));
    const d = await H.call('/__dump', undefined, 'GET'), tg = d.products.find(p => p.id === TG.id);
    ok(!d.products.some(p => p.id === C1.id) && d.products.some(p => p.id === C2.id), '«نفّذ المحدَّد»: المحدَّد دُمج، وغير المحدَّد بقي');
    ok(d.products.some(p => p.id === CQ.id) && /تعذّر 1/.test(await pg.evaluate(() => (document.querySelector('.mr-err') || {}).textContent || '')), 'ما عليه كمية بقي ونُبّه عليه');
    ok(tg && !/زهري|soldiers/.test(tg.alt_names || '') && tg.invoice_names.length === 1 && tg.haleb === 19, 'الهدف بلا أسماء ألوان · اسم الفاتورة مرّة واحدة · كميته كما هي');
    ok(!real(errs).length, 'لا أخطاء JS ' + real(errs).slice(0, 2).join(' / '));
    await browser.close();
  }
  // منتج متجر ⇐ مرشّحو الجرد: «هو نفسه» (مربوطٌ بغيره ⇒ inv_id في المتجر) · «ولا واحد منها» ⇒ يُعرَّف جديداً بكمية صفر مربوطاً
  await H.seed();
  const [LA, LB] = await H.call('/rest/v1/products', [
    { name: 'Dji mic mini', barcode: 'SL1', price: 70, haleb: 2, group_name: 'مايك وتوابعه', store_url: 'https://general-media-tech.github.io/system__V/store.html#product=s_other' },
    { name: 'Adapter rings EF-EOS R', barcode: 'SL2', price: 25, haleb: 25, group_name: 'ادابترات' }]);
  await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-10-31T10:00:00Z', categories: [{ id: 'c1', name: 'م', order: 1 }], products: [
    { id: 's_mic', name: 'DJI Mic Mini (1 Sender + 1 Empfänger)', price: 75, images: ['img/logo.png'], category_id: 'c1', description: 'مايك لاسلكي', specs: [{ label: 'المدى', value: '400م' }] },
    { id: 's_ad', name: 'ادابتر Canon ef _r', price: 130, images: [], category_id: 'c1' },
    { id: 's_dup', name: 'Dji mic mini (قائمة مكرّرة)', price: 75, images: [], category_id: 'c1' }] }]);
  const [CP] = await H.call('/rest/v1/products', [{ name: 'نسخة من المتجر', barcode: 'SL3', price: 75, haleb: 0, group_name: 'مايك وتوابعه', store_url: 'https://general-media-tech.github.io/system__V/store.html#product=s_dup' }]);
  await H.call('/rest/v1/gmt_merge_review', [
    { kind: 'link', prio: 1, status: 'pending', subject_id: null, cands: [{ store_id: 's_mic', group: 'مايك وتوابعه' }, { id: LA.id }], title: 'منتج المتجر هذا هو منتج الجرد؟' },
    { kind: 'link', prio: 2, status: 'pending', subject_id: null, cands: [{ store_id: 's_ad', group: 'ادابترات' }, { id: LB.id }], title: 'ادابتر' },
    { kind: 'merge', prio: 3, status: 'pending', subject_id: CP.id, cands: [{ id: LA.id }], title: 'نسخة المتجر = منتجك؟' }]);
  {
    const { browser, pg, errs } = await H.open('home.html', { w: 390, h: 844, wait: 4500 });
    await pg.waitForSelector('.mr-ov [data-mr="slink"]', { timeout: 10000 }).catch(() => {});
    const t = await pg.evaluate(() => (document.querySelector('.mr-ov') || {}).innerText || '');
    ok(/DJI Mic Mini \(1 Sender/.test(t) && /Dji mic mini/.test(t) && /ولا واحد منها/.test(t), 'بطاقة متجر ⇐ جرد: منتج المتجر ومرشّح الجرد و«ولا واحد منها — عرّفه جديداً»');
    await pg.click('.mr-ov [data-mr="slink"]'); await pg.waitForTimeout(1500);
    let d = await H.call('/__dump', undefined, 'GET');
    const sm = (d.gmt_store[0].products || []).find(x => x.id === 's_mic');
    ok(sm && sm.inv_id === String(LA.id) && d.products.find(p => p.id === LA.id).store_url.endsWith('s_other'), 'منتج الجرد مربوطٌ بغيره ⇒ رُبط من جهة المتجر (inv_id) ولم يُمسّ رابطه');
    await pg.click('.mr-ov [data-mr="no"]'); await pg.waitForTimeout(1800);
    d = await H.call('/__dump', undefined, 'GET');
    const nw = d.products.find(p => (p.store_url || '').endsWith('#product=s_ad'));
    ok(nw && nw.name === 'ادابتر Canon ef _r' && Number(nw.price) === 130 && nw.group_name === 'ادابترات' && !(nw.haleb > 0) && /^62\d{11}$/.test(nw.barcode || ''), '«ولا واحد منها» ⇒ منتجٌ جديد في الجرد بكمية صفر وباركود وسعر المتجر ومربوط: ' + (nw && nw.barcode));
    ok(d.products.some(p => p.id === LB.id) && !d.products.find(p => p.id === LB.id).store_url, 'ومرشّح الجرد بقي كما هو');
    await pg.click('.mr-ov [data-mr="merge"]'); await pg.waitForTimeout(1800);
    d = await H.call('/__dump', undefined, 'GET');
    const sdup = (d.gmt_store[0].products || []).find(x => x.id === 's_dup');
    ok(!d.products.some(p => p.id === CP.id) && sdup && sdup.inv_id === String(LA.id), 'دمج نسخة المتجر في منتجٍ مربوطٍ بغيره ⇒ قائمة المتجر رُبطت بالباقي قبل الحذف (لا منتج متجر بلا جرد)');
    ok(!real(errs).length, 'لا أخطاء JS ' + real(errs).slice(0, 2).join(' / '));
    await browser.close();
  }
  // الموظّف لا يرى النافذة
  await H.seed();
  const [x] = await H.call('/rest/v1/products', [{ name: 'س', barcode: 'MR9', haleb: 0 }]);
  await H.call('/rest/v1/gmt_merge_review', [{ kind: 'merge', prio: 1, status: 'pending', subject_id: x.id, cands: [{ id: x.id }] }]);
  const s = await H.open('home.html', { w: 390, h: 844, wait: 4500, init: H.STAFF_INIT });
  ok(!(await s.pg.evaluate(() => !!document.querySelector('.mr-ov'))), 'الموظّف لا تفتح له النافذة');
  await s.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
