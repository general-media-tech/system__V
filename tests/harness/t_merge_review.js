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
    const done = await pg.evaluate(() => (document.querySelector('.mr-done') || {}).textContent || '');
    ok(/لا شيء ينتظر/.test(done), W + ': بعد آخر بطاقة: «لا شيء ينتظر قرارك»');
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
    await pg.click('.mr-ov [data-mr="bulk"]'); await pg.waitForTimeout(2500);
    const d = await H.call('/__dump', undefined, 'GET'), tg = d.products.find(p => p.id === TG.id);
    ok(!d.products.some(p => p.id === C1.id || p.id === C2.id), 'ضغطة واحدة ⇒ منتجات الألوان دُمجت وحُذفت');
    ok(d.products.some(p => p.id === CQ.id) && /تعذّر 1/.test(await pg.evaluate(() => (document.querySelector('.mr-err') || {}).textContent || '')), 'ما عليه كمية بقي ونُبّه عليه');
    ok(tg && !/زهري|soldiers/.test(tg.alt_names || '') && tg.invoice_names.length === 1 && tg.haleb === 19, 'الهدف بلا أسماء ألوان · اسم الفاتورة مرّة واحدة · كميته كما هي');
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
