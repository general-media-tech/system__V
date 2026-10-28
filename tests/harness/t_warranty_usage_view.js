// (TASK-0214 · المالك seq 144) «انت اضفت الى الكفاله انه تم الاستبدال وتم كذا ولكن هي لا تعرض في الكفاله في صفحه الزبون وهذا الشيء خاطئ
// يجب ان تتزامن ان الحاله ساريه مفعول ولكن تم استخدامها بسبب حط الاسباب مثلا تمت صيانه تم الاستبدال وتاريخ الاستبدال»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const W = { status: 'active', expiry_date: '2027-10-01', purchase_date: '2026-10-01', warranty_type: 'standard', activation_status: 'activated', customer_typed_name: 'سامي', activation_date: '2026-10-02', created_at: '2026-10-01T10:00:00Z' };
  await H.call('/rest/v1/warranties', [Object.assign({ short_id: 'W300', customer_name: 'سامي', product_name: 'Canon EOS R50', serial_no: 'SN-1' }, W),
    Object.assign({ short_id: 'W400', customer_name: 'ريم', product_name: 'Canon RF 50mm', serial_no: 'SN-2' }, W),
    Object.assign({ short_id: 'W500', customer_name: 'هادي', product_name: 'Canon G7X', serial_no: 'SN-3' }, W)]);
  await H.call('/rest/v1/warranty_claims', [
    { warranty_short_id: 'W300', received_at: '2026-10-10', complaint: 'لا تشتغل بعد أسبوع', inspection_report: 'عطل في الحسّاس — تقرير فحص فني في نوع الجهاز بعد شكوى الزبون انخفاض دقة الصور بعد استلام الكاميرا بحوالي ثلاثة أيام، تبيّن أن دقة الصور منخفضة بالفعل ولم يتم العثور على أي آثار لعيوب مصنعية', resolution: 'replace', replacement_serial: 'SN-NEW-77', delivered_at: '2026-10-12', consumed: true, created_by: 'موظّف سرّي', voided: false },
    { warranty_short_id: 'W400', received_at: '2026-10-20', complaint: 'صوت في العدسة', resolution: 'pending', consumed: false, created_by: 'x', voided: false },
    { warranty_short_id: 'W500', received_at: '2026-10-05', resolution: 'repair', consumed: true, delivered_at: '2026-10-06', voided: true, void_reason: 'خطأ إدخال', created_by: 'x' }]);
  const view = async (sid, w) => {
    const { browser, pg, errs } = await H.open('guarantee.html?w=' + sid, { w, h: 900, mobile: w < 700, wait: 1500, init: H.STAFF_INIT });
    await pg.waitForFunction(() => { const v = document.getElementById('warranty-view'); return v && !v.classList.contains('hidden') && /حالة الكفالة/.test(document.getElementById('statusTitle').textContent); }, null, { timeout: 25000 }).catch(() => {});
    await sleep(1500);
    const r = await pg.evaluate(() => ({ title: document.getElementById('statusTitle').textContent, used: document.getElementById('statusUsed').textContent, usedShown: !document.getElementById('statusUsed').classList.contains('hidden'),
      box: !document.getElementById('claimsDisplay').classList.contains('hidden'), boxT: document.getElementById('claimsDisplay').innerText, hs: document.documentElement.scrollWidth > innerWidth + 1,
      // (TASK-0251) مكانه أسفل الوثيقة (بعد جدول البيانات والعدّاد والتوقيع) · بلا ألوانٍ بنفسجية · عناصر الوثيقة نفسها
      below: (() => { const b = document.getElementById('claimsDisplay'), t = document.getElementById('dispCustomer'), c = document.getElementById('countdownBox'); return !!(b && t && c && (t.compareDocumentPosition(b) & 4) && (c.compareDocumentPosition(b) & 4)); })(),
      purple: [...document.querySelectorAll('#claimsDisplay *, #statusUsed')].some(e => /rgb\((91, 33, 182|76, 29, 149|196, 181, 253|250, 245, 255|167, 139, 250)\)/.test(getComputedStyle(e).color + getComputedStyle(e).backgroundColor + getComputedStyle(e).borderTopColor)),
      table: !!document.querySelector('#claimsDisplay .data-table-container table .data-row td.bg-gray-50'),
      repH: (() => { const e = document.querySelector('#claimsDisplay [data-wcc-rep]'); return e ? e.getBoundingClientRect().height : 0; })() }));
    return { r, browser, pg, errs };
  };
  for (const w of [390, 1100]) {
    // ① استُخدم الضمان (استبدال) ⇒ سارية — تم استخدام الضمان · الأسباب وتاريخ الاستبدال · لا «سجّله»
    let { r, browser, pg, errs } = await view('W300', w);
    ok(/سارية المفعول \(Active\)/.test(r.title) && r.usedShown && r.used === 'استُخدمت خدمة الضمان: استبدال الجهاز · 12/10/2026', w + ': العنوان «سارية المفعول (Active)» كما هو + سطرٌ رسميّ قصير: ' + r.title + ' | ' + r.used);
    ok(r.box && /سجلّ خدمة الضمان/.test(r.boxT) && /Service Record/i.test(r.boxT) && /استبدال الجهاز/.test(r.boxT) && /لا تشتغل بعد أسبوع/.test(r.boxT) && /عطل في الحسّاس/.test(r.boxT) && /SN-NEW-77/.test(r.boxT) && /تاريخ الاستبدال/.test(r.boxT) && /10\/10\/2026/.test(r.boxT) && /مرّةً واحدة/.test(r.boxT),
      w + ': سجلّ خدمة الضمان: نوع الخدمة · تاريخ الاستلام · الشكوى · نتيجة الفحص · الجهاز البديل · تاريخ الاستبدال · «مرّةً واحدة»');
    ok(r.below && r.table && !r.purple && !/⚠/.test(r.used), w + ': في أسفل الوثيقة · بجدول الوثيقة نفسه · لا بنفسجيّ ولا ⚠: ' + JSON.stringify({ below: r.below, table: r.table, purple: r.purple }));
    ok(!/موظّف سرّي|سجّله/.test(r.boxT), w + ': لا يظهر للزبون من سجّل الاستخدام');
    ok(!r.hs, w + ': لا طفح أفقي');
    if (w === 390) { await pg.evaluate(() => document.getElementById('statusContainer').scrollIntoView()); await sleep(300); await pg.screenshot({ path: '/tmp/gmt-out/warranty_usage_390.png' }); await sleep(4500); await pg.evaluate(() => document.getElementById('claimsDisplay').scrollIntoView()); await sleep(300); await pg.screenshot({ path: '/tmp/gmt-out/warranty_record_390.png' }); }
    const real = errs.filter(e => !/status of (400|401|404|406)|Failed to load resource/.test(e));
    ok(!real.length, w + ': لا أخطاء JS ' + real.slice(0, 2).join(' / '));
    await browser.close();
    // ② قيد الفحص ⇒ الحالة سارية كما هي + «الجهاز قيد الفحص لدينا منذ …»
    ({ r, browser } = await view('W400', w));
    ok(/سارية المفعول \(Active\)/.test(r.title) && /قيد الفحص لدينا منذ 20\/10\/2026/.test(r.used) && r.box && /صوت في العدسة/.test(r.boxT) && /قيد الفحص/.test(r.boxT), w + ': قيد الفحص ⇒ «سارية» + «الجهاز قيد الفحص لدينا منذ 20/10/2026»: ' + r.used);
    await browser.close();
    // ③ استخدامٌ مُلغى (voided) ⇒ لا شيء
    ({ r, browser } = await view('W500', w));
    ok(/سارية المفعول \(Active\)/.test(r.title) && !r.usedShown && !r.box, w + ': استخدامٌ ملغى ⇒ لا يظهر شيء والحالة سارية');
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
