// ربط إيصال الشحن بالأوردر (برومبت «الماسح الضوئي الذكي» خامساً · 19 ت1): بيانات الإيصال تُحفظ (التحقّق · الفرع · من ومتى) ·
// رقم تتبّعٍ على أوردرٍ آخر ⇒ تحذير قبل الحفظ · إيصالٌ سابق ⇒ «الاحتفاظ بالنسختين» / «استبدال» / إلغاء (لا استبدال صامت) ·
// لا حفظ مزدوج · مسحُ إيصالٍ لأوردرٍ موجود من قائمة ⋮ بلا تغيير حالته · الفرع المحفوظ لا يُستبدل بما يُقرأ · «تم التحصيل» يمسح النسخ المؤقّتة.
const H = require('./h.js');
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fails++; };
const get = async id => (await H.call('/rest/v1/gmt_orders?id=eq.' + id, undefined, 'GET'))[0];

/* صورة إيصالٍ مصطنعة (بلا قراءة: نختبر الربط لا التعرّف — التعرّف في t_mufti_read) */
async function setReceipt(pg, color, read) {
  await pg.evaluate(async ({ color, read }) => {
    const cv = document.createElement('canvas'); cv.width = 600; cv.height = 300; const c = cv.getContext('2d');
    c.fillStyle = color; c.fillRect(0, 0, 600, 300); c.fillStyle = '#000'; c.font = '40px sans-serif'; c.fillText('RECEIPT ' + color, 40, 150);
    const b = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.9));
    const f = new File([b], 'r.jpg', { type: 'image/jpeg' });
    _shipScan = { original: f, scanned: f, mode: 'color' }; _shipRcptFile = f; _shipReading = false;
    _shipRead = read || null;
  }, { color, read });
}
async function dialog(pg) {
  await pg.waitForSelector('.gmtask-ov', { timeout: 6000 }).catch(() => {});
  return pg.evaluate(() => { const o = document.querySelector('.gmtask-ov'); return o ? { text: o.innerText.replace(/\s+/g, ' '), btns: [...o.querySelectorAll('button')].map(b => b.textContent.trim()) } : null; });
}
/* (TASK-0180) بعد كل إرفاقٍ محفوظ يُسأل «نرجع نبلّغ الزبون؟» ⇒ «لا» (كي لا تلتقطه نوافذ الخطوات التالية) — يُرجع هل ظهر */
async function noRenotify(pg) {
  const seen = await pg.waitForFunction(() => [...document.querySelectorAll('.gmtask-ov')].some(x => /عدّلتَ إيصال الشحن/.test(x.innerText)), null, { timeout: 5000 }).then(() => true, () => false);
  await pg.evaluate(() => { const o = [...document.querySelectorAll('.gmtask-ov')].find(x => /عدّلتَ إيصال الشحن/.test(x.innerText)); const b = o && [...o.querySelectorAll('button')].find(x => x.textContent.trim() === 'لا'); if (b) b.click(); });
  await pg.waitForTimeout(300);
  return seen;
}
async function press(pg, re) {
  await pg.evaluate(src => { const rx = new RegExp(src); const b = [...document.querySelectorAll('.gmtask-ov button')].find(x => rx.test(x.textContent)); if (b) b.click(); }, re.source);
  await pg.waitForTimeout(400);
}

(async () => {
  await H.seed();
  const tiny = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
  for (const [w, h] of [[390, 844], [1366, 800]]) {
    console.log(`— ${w}×${h}`);
    const sfx = String(w);
    const [oA, oB, oC] = await H.call('/rest/v1/gmt_orders', [
      { name: 'زبون الربط أ' + sfx, phone: '0933000501', product: 'كاميرا', qty: 1, price: 100, status: 'pending', branch: 'حلب', address: 'دمشق', shipping_company: 'المفتي' },
      { name: 'زبون الربط ب' + sfx, phone: '0933000502', product: 'عدسة', qty: 1, price: 50, status: 'shipped', branch: 'حلب', address: 'حمص', shipping_company: 'المفتي',
        tracking_number: 'DUP' + sfx, receipt_img: tiny, receipt_at: new Date(Date.now() - 86400000).toISOString(), receipt_meta: { v: 1, by: 'موظف سابق', track: { status: 'barcode', final: 'DUP' + sfx } }, ship_from_office: 'حلب|السريان' },
      { name: 'زبون الربط ج' + sfx, phone: '0933000503', product: 'حامل', qty: 1, price: 20, status: 'pending', branch: 'حلب', address: 'حماة', shipping_company: 'المفتي' }]);
    const { browser, pg, errs } = await H.open('orders.html', { w, h, wait: 4500 });
    const patches = [];
    pg.on('request', r => { if (r.method() === 'PATCH' && /gmt_orders\?id=eq\./.test(r.url())) patches.push({ url: r.url(), body: r.postData() || '' }); });

    // ١) رقمٌ مسجَّلٌ على أوردرٍ آخر ⇒ تحذير قبل الحفظ · «رجوع» لا يحفظ شيئاً
    await pg.evaluate(id => openShipModal(id), oA.id); await pg.waitForTimeout(400);
    await setReceipt(pg, '#fde68a', { tracking: { status: 'match', number: 'X1' + sfx }, barcode: { number: 'X1' + sfx }, printed: { number: 'X1' + sfx }, type: { kind: 'mufti', why: 'اسم الشركة' }, branch: { key: 'حلب|الفرقان', confident: true, text: 'حلب-الفرقان', candidates: [] } });
    await pg.fill('#ship-tracking', 'DUP' + sfx);
    pg.evaluate(() => confirmShipping());
    let d = await dialog(pg);
    ok(d && /رقم تتبّع مكرّر/.test(d.text) && d.text.indexOf('زبون الربط ب' + sfx) !== -1, 'رقم تتبّع على أوردرٍ آخر ⇒ تحذيرٌ يسمّي الأوردر الآخر: ' + (d ? d.text.slice(0, 90) : 'لا نافذة'));
    await press(pg, /رجوع للتصحيح/);
    await pg.waitForTimeout(500);
    ok((await get(oA.id)).status === 'pending', '«رجوع للتصحيح» ⇒ لم يُشحن ولم يُحفظ شيء');

    // ٢) رقمٌ سليم ⇒ يُشحن ومعه بيانات الإيصال · لا حفظ مزدوج (ضغطتان سريعتان = حفظٌ واحد)
    await pg.fill('#ship-tracking', 'X1' + sfx);
    await pg.evaluate(() => { _shipRcptAuto = true; });
    const before = patches.length;
    await pg.evaluate(() => { confirmShipping(); confirmShipping(); });
    await pg.waitForTimeout(3500);
    for (let i = 0; i < 4 && await pg.evaluate(() => !!document.querySelector('.gmtask-ov')); i++) { await pg.keyboard.press('Escape'); await pg.waitForTimeout(300); }
    const statusPatches = patches.slice(before).filter(p => p.url.indexOf('eq.' + oA.id) !== -1 && /"status"/.test(p.body));
    ok(statusPatches.length === 1, 'ضغطتان على «اعتماد الشحن» ⇒ حفظٌ واحد فقط (' + statusPatches.length + ')');
    let A = await get(oA.id);
    ok(A.status === 'shipped' && A.tracking_number === 'X1' + sfx && /^data:image\/jpeg/.test(A.receipt_img || ''), 'شُحن ومعه الإيصال الممسوح ورقم التتبّع');
    const m = A.receipt_meta || {};
    ok(m.track && m.track.status === 'match' && m.track.final === 'X1' + sfx && m.track.source === 'auto', 'حالة التحقّق محفوظة: تطابق المطبوع والباركود · مُلئ تلقائياً: ' + JSON.stringify(m.track));
    ok(m.branch && m.branch.read && m.branch.read.key === 'حلب|الفرقان' && m.at && m.via === 'ship' && m.scanned === true && m.company === 'المفتي', 'الفرع المقروء · الشركة · الوقت · «مُسح ضوئياً» محفوظة');
    ok('by' in m, 'من أضاف الإيصال: ' + JSON.stringify(m.by));

    // ٣) قائمة ⋮ لأوردرٍ موجود فيها «مسح إيصال…» ⇒ وضع الإرفاق (لا يغيّر الحالة) · الرقم المحفوظ معروض
    const menu = await pg.evaluate(id => cardMoreItems(orders.find(o => o.id == id)).map(i => i.t), oB.id);
    ok(menu.some(t => /مسح إيصال شحنٍ جديد/.test(t)), 'قائمة ⋮: «مسح إيصال شحنٍ جديد لهذا الأوردر»');
    await pg.evaluate(id => openReceiptAttach(id), oB.id); await pg.waitForTimeout(400);
    const att = await pg.evaluate(() => ({ title: document.getElementById('ship-title').textContent, btn: document.getElementById('ship-confirm-btn').textContent, track: document.getElementById('ship-tracking').value,
      from: document.getElementById('ship-from').value, src: document.getElementById('ship-from').getAttribute('data-src') }));
    ok(/إيصال الشحن/.test(att.title) && /حفظ الإيصال/.test(att.btn) && att.track === 'DUP' + sfx, 'نافذة «إيصال الشحن» · زرّ «حفظ الإيصال على الأوردر» · الرقم المحفوظ ظاهر: ' + att.title);
    // الفرع المحفوظ لا يُستبدل بما يُقرأ — يُعرض الفرق مع زرّ اعتماده
    const kept = await pg.evaluate(() => applyDetectedShipFrom({ key: 'حلب|الفرقان', confident: true, text: 'حلب-الفرقان' }));
    const box = await pg.evaluate(() => ({ v: document.getElementById('ship-from').value, t: document.getElementById('ship-from-src').innerText }));
    ok(att.src === 'saved' && kept === 'manual-kept' && box.v === 'حلب|السريان' && /الإيصال يشير إلى «حلب – الفرقان»/.test(box.t), 'الفرع المحفوظ على الأوردر يبقى، والإيصال المختلف يُذكر: ' + box.t.slice(0, 70));

    // ٤) إيصالٌ سابق ⇒ سؤال · «الاحتفاظ بالنسختين»
    await setReceipt(pg, '#bfdbfe', null);
    pg.evaluate(() => confirmShipping());
    d = await dialog(pg);
    ok(d && /إيصالٌ سابق/.test(d.text) && d.btns.some(b => /الاحتفاظ بالنسختين/.test(b)) && d.btns.some(b => /استبدال السابق/.test(b)) && d.btns.some(b => /إلغاء/.test(b)), 'إيصالٌ محفوظ ⇒ لا استبدال صامت: ' + (d ? d.btns.join(' · ') : 'لا نافذة'));
    await press(pg, /الاحتفاظ بالنسختين/);
    await pg.waitForTimeout(2500);
    ok(await noRenotify(pg), 'بعد حفظ الإيصال ⇒ «عدّلتَ إيصال الشحن — نرجع نبلّغ الزبون؟» (TASK-0180)');
    let B = await get(oB.id);
    ok(B.status === 'shipped' && B.tracking_number === 'DUP' + sfx, 'الإرفاق لا يغيّر حالة الأوردر ولا رقمه');
    ok(B.receipt_img && B.receipt_img !== tiny && B.receipt_meta && B.receipt_meta.prev && B.receipt_meta.prev.length === 1 && /^data:image/.test(B.receipt_meta.prev[0].img) && B.receipt_meta.prev[0].by === 'موظف سابق',
      'النسختان محفوظتان: الجديد على الأوردر والسابق في «إيصالات سابقة» (' + (B.receipt_meta && B.receipt_meta.prev ? B.receipt_meta.prev.length : 0) + ')');
    ok(B.receipt_meta.via === 'attach' && B.receipt_meta.track.status === 'not_read', 'بيانات الإرفاق: عبر «إيصال الشحن» · حالة القراءة «لم يُقرأ»');

    // ٥) «استبدال السابق» ⇒ يُستبدل الحالي فقط والمحتفَظ به سابقاً يبقى · «إلغاء» ⇒ لا شيء
    await pg.evaluate(id => openReceiptAttach(id), oB.id); await pg.waitForTimeout(300);
    await setReceipt(pg, '#fecaca', null);
    pg.evaluate(() => confirmShipping()); await dialog(pg); await press(pg, /استبدال السابق/); await pg.waitForTimeout(2500);
    await noRenotify(pg);
    const B2 = await get(oB.id);
    ok(B2.receipt_img !== B.receipt_img && B2.receipt_meta.prev.length === 1, 'استبدال ⇒ الجديد بدل الحالي، والسابق المحتفَظ به باقٍ (' + B2.receipt_meta.prev.length + ')');
    await pg.evaluate(id => openReceiptAttach(id), oB.id); await pg.waitForTimeout(300);
    await setReceipt(pg, '#ddd6fe', null);
    pg.evaluate(() => confirmShipping()); await dialog(pg); await press(pg, /^إلغاء$/); await pg.waitForTimeout(1200);
    const B3 = await get(oB.id);
    ok(B3.receipt_img === B2.receipt_img, 'إلغاء ⇒ لم يتغيّر شيء');
    await pg.evaluate(() => closeModal('shipModal'));

    // ٦) إرفاقٌ برقمٍ مسجَّلٍ على أوردرٍ آخر ⇒ تحذير
    await pg.evaluate(id => openReceiptAttach(id), oC.id); await pg.waitForTimeout(300);
    await setReceipt(pg, '#e5e7eb', null);
    await pg.fill('#ship-tracking', 'X1' + sfx);
    pg.evaluate(() => confirmShipping());
    d = await dialog(pg);
    ok(d && /رقم تتبّع مكرّر/.test(d.text), 'إرفاق إيصالٍ برقمٍ على أوردرٍ آخر ⇒ تحذير قبل الحفظ');
    await press(pg, /رجوع للتصحيح/); await pg.waitForTimeout(400);
    ok(!(await get(oC.id)).receipt_img, 'لم يُحفظ بعد التراجع');
    await pg.evaluate(() => closeModal('shipModal'));

    // ٧) عارض الإيصال: بيانات التحقّق + الإيصالات السابقة
    await pg.evaluate(id => { const i = orders.findIndex(o => o.id == id); }, oB.id);
    await pg.evaluate(async () => { await (window.loadOrders ? loadOrders() : Promise.resolve()); });
    await pg.waitForTimeout(800);
    const view = await pg.evaluate(id => { const o = orders.find(x => x.id == id); if (!o) return 'لا أوردر'; viewReceipt(id); const v = document.getElementById('receiptViewer'); const t = v ? v.innerText.replace(/\s+/g, ' ') : ''; if (v) v.remove(); return t; }, oB.id);
    ok(/إيصالات سابقة محتفَظ بها \(1\)/.test(view) && /👤/.test(view), 'عارض الإيصال يعرض من أضافه والإيصالات السابقة: ' + view.slice(0, 120));

    // ٨) «تم التحصيل» ⇒ تُمسح الصورة الحالية والسابقة (مؤقّتة) وتبقى بيانات التحقّق
    await pg.evaluate(id => { pendingAction = { id: id, type: 'completed' }; return executeConfirm(); }, oB.id);
    await pg.waitForTimeout(1500);
    const B4 = await get(oB.id);
    ok(B4.status === 'completed' && !B4.receipt_img && B4.receipt_meta && B4.receipt_meta.prev.every(p => !p.img) && B4.receipt_meta.track, 'تم التحصيل ⇒ الصور المؤقّتة مُسحت وبقيت بيانات التحقّق');

    const fit = await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok(fit <= 1, 'لا طفح أفقي');
    const own = errs.filter(e => !/status of (400|503)/.test(e));
    ok(!own.length, 'لا أخطاء JS ' + own.join(' | '));
    await browser.close();
  }
  console.log(fails ? `FAIL=${fails}` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
