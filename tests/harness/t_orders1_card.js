// وثيقة الطلبات §٤ — أزرار البطاقة في كل المراحل + قائمة ⋮ (ربط فاتورة نقل · المرتجع · الفرع المُرسِل) بالجوال وسطح المكتب
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const SHOT = '/tmp/claude-0/-home-user-system--V/dfe65fb9-bcc1-5e5a-be94-906828e1c021/scratchpad/harness/';
(async () => {
  for (const w of [390, 360, 1366]) {
    console.log('— ' + w);
    await H.seed();
    await H.call('/__opts', { reject_cols: [], rls_block: [] });
    await H.call('/rest/v1/branch_stock_transfers', [
      { transfer_number: 'TRF-20261001-1010', from_branch_name: 'حلب', to_branch_name: 'درعا', status: 'completed', created_at: '2026-10-01T10:10:00Z' },
      { transfer_number: 'TRF-20261005-0930', from_branch_name: 'حلب', to_branch_name: 'دمشق', status: 'pending', created_at: '2026-10-05T09:30:00Z' }]);
    const rows = await H.call('/rest/v1/gmt_orders', [
      { name: 'قيد التجهيز', phone: '0933000011', product: 'كاميرا', qty: 1, price: 100, status: 'pending', branch: 'حلب', address: 'دمشق' },
      { name: 'في الطريق مفتي', phone: '0933000012', product: 'كاميرا', qty: 1, price: 100, status: 'shipped', branch: 'حلب', address: 'دمشق — فكتوريا', shipping_company: 'المفتي', tracking_number: '5551', shipped_at: '2026-10-10T08:00:00Z', notified_arrival_at: '2026-10-12T08:00:00Z', receipt_img: 'data:image/png;base64,iVBORw0KGgo=' },
      { name: 'مكتمل مرتبط', phone: '0933000013', product: 'كاميرا', qty: 1, price: 100, status: 'completed', branch: 'حلب', address: 'حمص', shipping_company: 'مسارات', tracking_number: '5552', invoice_number: 'INV-77', is_locked: true },
      { name: 'متجر في الطريق', phone: '0933000014', product: 'كاميرا', qty: 1, price: 100, status: 'shipped', branch: 'حلب', address: 'حماة', shipping_company: 'مسارات', tracking_number: '5553', source: 'store' }]);
    const [P, S, C, ST] = rows.map(r => r.id);
    const { browser, pg, errs } = await H.open('orders.html', { w, mobile: w < 700, h: 900, wait: 4500, init: H.ADMIN_INIT + ' window.__opened=[]; window.open=(u)=>{window.__opened.push(u);return {};};' });
    const geo = (id) => pg.evaluate((id) => {
      const card = document.getElementById('card-' + id); if (!card) return null;
      const btns = [...card.querySelectorAll('button')];
      const prim = btns.find(b => /إرسال للشحن|تأكيد الاستلام|أرشفة نهائية/.test(b.textContent));
      const more = btns.find(b => /openCardMore/.test(b.getAttribute('onclick') || ''));
      const pr = prim && prim.getBoundingClientRect(), mr = more && more.getBoundingClientRect();
      const cardR = card.getBoundingClientRect();
      const over = btns.filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && (r.right > cardR.right + 1 || r.left < cardR.left - 1); }).length;
      return { prim: pr && { w: Math.round(pr.width), h: Math.round(pr.height) }, more: !!more, mw: mr && Math.round(mr.width), over: over, hs: document.documentElement.scrollWidth > innerWidth + 2 };
    }, id);
    for (const [nm, id] of [['قيد التجهيز', P], ['في الطريق', S], ['مكتمل', C], ['متجر', ST]]) {
      const g = await geo(id);
      ok(g && g.prim && g.more, nm + ': الزرّ الرئيسي و⋮ موجودان ' + JSON.stringify(g));
      ok(g && g.prim && g.prim.h <= 48 && g.prim.w >= (w < 700 ? 150 : 150), nm + ': الزرّ الرئيسي واضح بسطرٍ واحد ' + (g && JSON.stringify(g.prim)));
      ok(g && g.over === 0 && !g.hs, nm + ': لا شيء مقصوص ولا طفح أفقي');
      ok(g && g.mw >= 36, nm + ': زرّ ⋮ بحجم قابل للّمس (' + (g && g.mw) + 'px)');
    }
    // ⋮ لأوردر في الطريق (مفتي): الفرع المُرسِل + البحث + ربط فاتورة نقل
    await pg.evaluate((id) => openCardMore(id), S);
    await pg.waitForTimeout(250);
    let m = await pg.evaluate(() => [...document.querySelectorAll('#card-more-ov [data-i]')].map(b => b.textContent.replace(/\s+/g, ' ').trim()));
    ok(m.some(t => /التحقق من الشحنة/.test(t)) && m.some(t => /فرع الوجهة/.test(t)) && m.some(t => /الفرع المُرسِل وحالة الحوالة/.test(t)) && m.some(t => /بحث برقم التتبّع/.test(t)) && m.some(t => /إيصال/.test(t)) && m.some(t => /ربط فاتورة نقل/.test(t)), '⋮ (مفتي في الطريق): ' + m.join(' | '));
    await pg.evaluate(() => document.querySelector('#card-more-ov [data-x]').click());
    // ⋮ لقيد التجهيز: لا تتبّع ولا مراسلة فرع، لكن ربط فاتورة نقل موجود
    await pg.evaluate((id) => openCardMore(id), P);
    m = await pg.evaluate(() => [...document.querySelectorAll('#card-more-ov [data-i]')].map(b => b.textContent.replace(/\s+/g, ' ').trim()));
    ok(m.length === 1 && /ربط فاتورة نقل/.test(m[0]), '⋮ (قيد التجهيز): لا تتبّع ولا مراسلة، فقط ربط فاتورة نقل: ' + m.join(' | '));
    await pg.evaluate(() => document.querySelector('#card-more-ov [data-x]').click());
    // ⋮ للمكتمل المرتبط بفاتورة: مرتجع + بطاقة الفاتورة
    await pg.evaluate((id) => openCardMore(id), C);
    m = await pg.evaluate(() => [...document.querySelectorAll('#card-more-ov [data-i]')].map(b => b.textContent.replace(/\s+/g, ' ').trim()));
    ok(m.some(t => /مرتجع الفاتورة/.test(t)) && m.some(t => /بطاقة الفاتورة المرتبطة #INV-77/.test(t)), '⋮ (مرتبط بفاتورة): أزرار المرتجع: ' + m.join(' | '));
    await pg.evaluate(() => { window.__calls = []; window.openLinkedActions = (id) => window.__calls.push('linked:' + id); });
    await pg.evaluate(() => { [...document.querySelectorAll('#card-more-ov [data-i]')].find(b => /مرتجع الفاتورة/.test(b.textContent)).click(); });
    ok((await pg.evaluate(() => window.__calls)).includes('linked:' + C), 'خيار «مرتجع الفاتورة» يفتح قائمة المرتجع/فكّ الارتباط نفسها');
    // ⋮ لأوردر المتجر: فاتورة المتجر
    await pg.evaluate((id) => openCardMore(id), ST);
    m = await pg.evaluate(() => [...document.querySelectorAll('#card-more-ov [data-i]')].map(b => b.textContent.replace(/\s+/g, ' ').trim()));
    ok(m.some(t => /فاتورة طلب المتجر/.test(t)), '⋮ (متجر): فاتورة طلب المتجر');
    await pg.evaluate(() => document.querySelector('#card-more-ov [data-x]').click());

    // ═══ ربط فاتورة نقل ═══
    await pg.evaluate((id) => openLinkTransferInvoice(id), S);
    await pg.waitForSelector('#trf-link-ov [data-i]');
    const lst = await pg.evaluate(() => [...document.querySelectorAll('#trf-link-ov [data-i]')].map(b => b.textContent.replace(/\s+/g, ' ').trim()));
    ok(lst.length === 2 && /TRF-20261005-0930/.test(lst[0]) && /دمشق/.test(lst[0]) && /قيد الانتظار/.test(lst[0]), 'المنتقي يعرض فواتير النقل الموجودة (الأحدث أولاً): ' + lst.join(' || '));
    await pg.fill('#trf-link-ov [data-q]', '1010'); await pg.waitForTimeout(600);
    const lst2 = await pg.evaluate(() => [...document.querySelectorAll('#trf-link-ov [data-i]')].map(b => b.textContent.replace(/\s+/g, ' ').trim()));
    ok(lst2.length === 1 && /TRF-20261001-1010/.test(lst2[0]), 'البحث برقم الفاتورة: ' + lst2.join(' || '));
    const ovBox = await pg.evaluate(() => { const b = document.querySelector('#trf-link-ov > div').getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom), vw: innerWidth, vh: innerHeight }; });
    ok(ovBox.l >= 0 && ovBox.r <= ovBox.vw && ovBox.t >= 0 && ovBox.b <= ovBox.vh + 1, 'نافذة المنتقي داخل الشاشة ' + JSON.stringify(ovBox));
    await pg.screenshot({ path: SHOT + 'orders1_trf_picker_' + w + '.png' });
    await pg.evaluate(() => document.querySelector('#trf-link-ov [data-i]').click());
    await pg.waitForTimeout(900);
    let db = await H.call('/rest/v1/gmt_orders?id=eq.' + S, undefined, 'GET');
    ok(db[0].transfer_invoice_no === 'TRF-20261001-1010', 'الرابط محفوظ على الأوردر في القاعدة: ' + db[0].transfer_invoice_no);
    const line = await pg.evaluate((id) => (document.querySelector('#card-' + id + ' [data-transfer-link]') || {}).textContent, S);
    ok(/TRF-20261001-1010/.test(line || ''), 'سطر «🔗 فاتورة نقل» على البطاقة: ' + (line || '').trim());
    // ⋮ الآن يقول «تغيير أو فكّ»، والفكّ يمسح الرابط
    await pg.evaluate((id) => openLinkTransferInvoice(id), S);
    await pg.waitForSelector('#trf-link-ov [data-unlink]');
    await pg.evaluate(() => document.querySelector('#trf-link-ov [data-unlink]').click());
    await pg.waitForTimeout(900);
    db = await H.call('/rest/v1/gmt_orders?id=eq.' + S, undefined, 'GET');
    ok(db[0].transfer_invoice_no === null, 'فكّ الارتباط يمسح المرجع من القاعدة');
    // العمود غير موجود ⇒ يُحفَظ على الجهاز ويُقال صراحةً
    await H.call('/__opts', { reject_cols: ['transfer_invoice_no'] });
    await pg.evaluate((id) => openLinkTransferInvoice(id), S);
    await pg.waitForSelector('#trf-link-ov [data-i]');
    await pg.evaluate(() => document.querySelector('#trf-link-ov [data-i]').click());
    await pg.waitForTimeout(900);
    const toast = await pg.evaluate(() => [...document.querySelectorAll('#toast-wrap > div')].map(d => d.textContent).join(' | '));
    const loc = await pg.evaluate(() => localStorage.getItem('gmt_transfer_link'));
    ok(/على هذا الجهاز فقط/.test(toast) && /عمود القاعدة غير موجود/.test(toast), 'العمود ناقص: تنبيه صريح «على هذا الجهاز فقط»: ' + toast.slice(0, 120));
    ok(/TRF-20261005-0930/.test(loc || ''), 'الرابط في ذاكرة الجهاز: ' + loc);
    const line2 = await pg.evaluate((id) => (document.querySelector('#card-' + id + ' [data-transfer-link]') || {}).textContent, S);
    ok(/TRF-20261005-0930/.test(line2 || ''), 'والبطاقة تعرضه من الذاكرة المحلية');
    await H.call('/__opts', { reject_cols: [] });
    // لا فواتير نقل (الجدول فارغ)
    await H.call('/__reset', {});
    await pg.evaluate((id) => openLinkTransferInvoice(id), P);
    await pg.waitForTimeout(700);
    const empty = await pg.evaluate(() => (document.querySelector('#trf-link-ov [data-list]') || {}).textContent);
    ok(/لا توجد فواتير نقل/.test(empty || ''), 'لا فواتير نقل ⇒ رسالة صريحة: ' + (empty || '').trim());
    if (w !== 1366) {
      await pg.evaluate(() => document.getElementById('trf-link-ov') && document.getElementById('trf-link-ov').remove());
    }
    const real = errs.filter(e => !/404|400|favicon|Failed to load/.test(e));
    ok(real.length === 0, 'لا أخطاء JS ' + real.slice(0, 2).join(' | '));
    await browser.close();
  }
  console.log(`PASS=${pass} FAIL=${fails}`);
  process.exit(fails ? 1 : 0);
})();
