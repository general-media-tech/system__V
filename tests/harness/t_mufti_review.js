// (TASK-0217 · المالك seq 147) «بوت صغير يعمل فقط مع شركه المفتي يتحقق من جميع شحنات المفتي مره واحده … كلهم في صفحه واحده
// يعني يكتب لي الاوردر وتحته يعرض لي … مكان اللي اشرت لك عليه في الدائره … اذا استلم بعطيه تاكيد استلام»
// دالّة الخادم gmt-mufti مُحاكاة هنا بردود صفحة المفتي الحقيقية (قُرئت فعلاً من موقعهم بأرقامٍ حقيقية).
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const L = ['تم استلام الشحنة', 'على الطريق وقيد النقل', 'وصلت فرع الوجهة,يرجى مراجعة الفرع لاستلامها', 'تم التسليم للمرسل إليه'];
const R = (n, act, status, at, rcv, info) => ({ n, ok: true, found: true, steps: L.map((l, i) => ({ label: l, active: act.includes(i + 1) })), date: at.slice(0, 10), level: Math.max(...act), sender: { desc: 'مجموعة ميديا تك التجارية', info: 'حلب - الفرقان' }, receiver: { desc: rcv, info }, status, status_at: at });
const FAKE = {
  '214138': R('214138', [1, 2, 3, 4], 'تم استلام الشحنة من قبل المرسل إليه', '27-10-2026 15:36', 'غالب زيدان', 'دمشق - البرامكة'),
  '214244': R('214244', [1, 3], 'تم وصول الشحنة إلى الفرع الوجهة,بإمكانك زيارة الفرع لاستلامها', '27-10-2026 12:38', 'انفال عمر حسين', 'درعا - دوار الحمامة'),
  '210063': R('210063', [1], 'تم إعادة توجيه الشحنة إلى الفرع', '27-10-2026 10:29', 'شخص آخر تماماً', 'دمشق - فكتوريا'),
  '99999999': { n: '99999999', ok: true, found: false, steps: [], date: '', level: 0, sender: null, receiver: null, status: '', status_at: '' },
  '214248': R('214248', [1, 2, 3, 4], 'تم استلام الشحنة من قبل المرسل إليه', '26-10-2026 15:55', 'سيدرا سماعيل نصر', 'دمشق - جرمانا')
};
(async () => {
  for (const W of [390, 1366]) {
    await H.seed();
    const base = { qty: 1, branch: 'حلب', product: 'كاميرا', price: 100, shipping_company: 'المفتي' };
    const rows = await H.call('/rest/v1/gmt_orders', [
      Object.assign({ name: 'غالب زيدان', phone: '0933000901', status: 'shipped', tracking_number: '214138', address: 'دمشق', shipped_at: '2026-10-25T10:00:00Z' }, base),
      Object.assign({ name: 'انفال عمر حسين', phone: '0933000902', status: 'shipped', tracking_number: '214244', address: 'درعا', shipped_at: '2026-10-25T11:00:00Z' }, base),
      Object.assign({ name: 'عبد الهادي حمشو', phone: '0933000903', status: 'shipped', tracking_number: '210063', address: 'دمشق', shipped_at: '2026-10-22T10:00:00Z', notified_arrival_at: '2026-10-27T09:00:00Z' }, base),
      Object.assign({ name: 'رقم خاطئ', phone: '0933000904', status: 'shipped', tracking_number: '99999999', address: 'حمص', shipped_at: '2026-10-23T10:00:00Z' }, base),
      Object.assign({ name: 'سيدرا سماعيل نصر', phone: '0933000905', status: 'delivered', tracking_number: '214248', address: 'دمشق', shipped_at: '2026-10-25T10:00:00Z' }, base),
      Object.assign({ name: 'بلا رقم', phone: '0933000906', status: 'shipped', address: 'حلب', shipped_at: '2026-10-25T10:00:00Z' }, base),
      Object.assign({ name: 'زبون القدموس', phone: '0933000907', status: 'shipped', tracking_number: '555111', address: 'حلب', shipped_at: '2026-10-25T10:00:00Z' }, base, { shipping_company: 'القدموس' })]);
    const idOf = n => rows.find(r => r.tracking_number === n).id;
    const { browser, pg, errs } = await H.open('orders.html', { w: W, h: W < 500 ? 844 : 900, mobile: W < 500, wait: 4500 });
    const calls = []; let failNext = 0;
    await pg.route('**/functions/v1/gmt-mufti', async route => {
      const req = route.request();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, body: 'ok' });
      const b = JSON.parse(req.postData() || '{}'); calls.push({ nums: b.nums, auth: /^Bearer /.test(req.headers()['authorization'] || '') });
      await new Promise(r => setTimeout(r, 250));
      if (failNext > 0) { failNext--; return route.fulfill({ status: 500, contentType: 'application/json', body: '{"ok":false}' }); }
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, out: b.nums.map(n => FAKE[n] || { n, ok: true, found: false, steps: [], level: 0 }) }) });
    });
    const launch = await pg.$('[data-mr-launch]');
    ok(!!launch && await launch.isVisible(), W + ': زرّ «🔎 مراجعة شحنات المفتي» في شريط الفلاتر (لا زرّ عائم)');
    await launch.click();
    await pg.waitForFunction(() => /انتهى الفحص/.test((document.querySelector('#gmt-mr [data-mr-prog]') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
    const asked = calls.flatMap(c => c.nums).sort();
    ok(JSON.stringify(asked) === JSON.stringify(['210063', '214138', '214244', '99999999']) && calls.every(c => c.nums.length <= 3 && c.auth),
      W + ': فقط شحنات المفتي «في الطريق» برقم تتبّع (لا القدموس · لا بلا رقم · لا بانتظار التحصيل) · دفعات ≤٣ بمفتاح القاعدة: ' + JSON.stringify(calls.map(c => c.nums)));
    const cards = await pg.evaluate(() => [...document.querySelectorAll('#gmt-mr [data-mr-o]')].map(c => ({ id: c.getAttribute('data-mr-o'), k: c.getAttribute('data-mr-k'), t: c.innerText })));
    ok(cards.length === 4 && cards[0].k === 'got' && String(cards[0].id) === String(idOf('214138')), W + ': كلّهم في صفحةٍ واحدة · «استلمها الزبون» أوّلاً: ' + JSON.stringify(cards.map(c => c.k)));
    const A = cards.find(c => c.k === 'got'), B = cards.find(c => c.k === 'branch'), D = cards.find(c => c.k === 'ret'), N = cards.find(c => c.k === 'nf');
    // (TASK-0225 · seq 153) «كلمه تمت اعاده التوجيه لا يعني انه استلم بل انها انتقلت الى مرتجع»
    ok(JSON.stringify(cards.map(c => c.k)) === '["got","ret","branch","nf"]' && D && /مرتجع — أُعيد توجيهها/.test(D.t) && /ليست «تم التسليم»/.test(D.t) && !/ليست «تم التسليم»/.test(A.t + B.t),
      W + ': «تمت إعادة التوجيه» ⇒ ↩️ مرتجع (لا استلام) مع تنبيه · ثانياً بعد «استلمها»: ' + JSON.stringify(cards.map(c => c.k)));
    await pg.click('#gmt-mr [data-mr-f="ret"]'); await pg.waitForTimeout(150);
    ok(await pg.evaluate(() => document.querySelectorAll('#gmt-mr [data-mr-o]').length) === 1, W + ': فلتر «↩️ مرتجع» ⇒ واحدة');
    await pg.click('#gmt-mr [data-mr-f="all"]'); await pg.waitForTimeout(150);
    ok(A && /غالب زيدان/.test(A.t) && /214138/.test(A.t) && /حالة الشحنة/.test(A.t) && /تم استلام الشحنة من قبل المرسل إليه/.test(A.t) && /15:36/.test(A.t),
      W + ': الأوردر وتحته بطاقة «حالة الشحنة» (المكان المحاط بالدائرة) بنصّها وتاريخها');
    ok(B && /تم وصول الشحنة إلى الفرع الوجهة/.test(B.t) && /في فرع الوجهة/.test(B.t), W + ': «وصلت فرع الوجهة» ⇒ 🏢 في فرع الوجهة');
    const act = await pg.evaluate(id => [...document.querySelectorAll('#gmt-mr [data-mr-o="' + id + '"] .ml-st')].map(x => [x.className.replace('ml-st ', ''), x.dataset.on, !!x.querySelector('svg')]), String(idOf('214244')));
    ok(JSON.stringify(act) === '[["passed","1",true],["passed","0",true],["cur","1",true],["todo","0",true]]', W + ': شريط تتبّعنا: ما مضى أسود · «وصلت فرع الوجهة» الحاليّة · التسليم قادم (بأيقونات): ' + JSON.stringify(act));
    // (seq 149) هويّتنا: ترويسة بتدرّج الأحمر · الخطوة الحاليّة بتدرّج الأحمر · مستطيل الحالة بحدٍّ أحمر · الزرّ بجانب «تعديل»
    const id1 = await pg.evaluate(() => { const cs = s => getComputedStyle(document.querySelector(s)); return { h: cs('#gmt-mr .mr-h').backgroundImage, cur: cs('#gmt-mr .ml-st.cur i').backgroundImage, card: cs('#gmt-mr .ml-card').borderRightColor,
      nextToEdit: (() => { const b = document.querySelector('[data-mr-launch]'); const p = b.previousElementSibling; return !!p && /openSelectEditModal/.test(p.getAttribute('onclick') || '') && b.parentElement.contains(document.getElementById('searchInput')) === false && !b.closest('#appContent'); })() }; });
    ok(/213, 0, 28/.test(id1.h) && /213, 0, 28/.test(id1.cur) && /213, 0, 28/.test(id1.card) && id1.nextToEdit, W + ': بهويتنا البصرية (الأحمر #D5001C) · الزرّ بجانب «تعديل» في الأعلى: ' + JSON.stringify(id1));
    ok(N && /لا يعرف الرقم/.test(N.t) && D && /اسم المستلم عند المفتي لا يشبه/.test(D.t) && !/لا يشبه/.test(A.t + B.t), W + ': رقمٌ غير موجود عندهم ⇒ يُقال · اسم مستلمٍ مختلف ⇒ تنبيه (فقط حيث يختلف)');
    // (TASK-0221 · seq 151) «فقط زر تاكيد الاستلام زر مثلا تبليغ الوصول وزر مراسله فرع الشركه الوجهه» — من بطاقة الأوردر نفسها، لا غيرها
    const btns = await pg.evaluate(ids => { const row = id => [...document.querySelectorAll('#gmt-mr [data-mr-o="' + id + '"] button')].map(b => b.getAttribute('onclick') || b.textContent.trim());
      return { a: row(ids.a), b: row(ids.b), icons: !document.querySelector('#gmt-mr [data-mr-pbtns] i[data-lucide]') }; }, { a: idOf('214244'), b: idOf('210063') });
    ok(JSON.stringify(btns.a) === JSON.stringify(['requestConfirm(' + idOf('214244') + ",'delivered')", 'shareOrder(' + idOf('214244') + ",'arrived')", 'contactShipOffice(' + idOf('214244') + ')']) && btns.icons,
      W + ': ثلاثة أزرار فقط: تأكيد الاستلام · تبليغ الوصول · مراسلة فرع الشركة الوجهة (لا طباعة ولا بحث ولا PDF ولا ⋮): ' + JSON.stringify(btns.a));
    // (TASK-0248 · seq 166) المرتجعة «ليست تم التسليم»: لا شريط تقدّم ولا «تأكيد الاستلام» ولا «تبليغ الوصول» — يبقى «مراسلة فرع الشركة» فقط
    const retSteps = await pg.evaluate(id => !!document.querySelector('#gmt-mr [data-mr-o="' + id + '"] .ml-steps'), idOf('210063'));
    ok(JSON.stringify(btns.b) === JSON.stringify(['contactShipOffice(' + idOf('210063') + ')']) && !retSteps,
      W + ': المرتجعة: لا شريط تقدّم · لا «تأكيد الاستلام» ولا «تبليغ الوصول» · يبقى «مراسلة فرع الشركة»: ' + JSON.stringify(btns.b));
    // (TASK-0222 · seq 152) «في صحين للي تبلغ … زامنها» + «التبليغ الاول غير التبليغ الثاني»
    const nd0 = await pg.evaluate(ids => [ids.a, ids.b].map(id => ((document.querySelector('#gmt-mr [data-mr-o="' + id + '"] [data-mr-notified]') || {}).textContent || '').trim()), { a: idOf('214244'), b: idOf('210063') });
    ok(nd0[0] === '' && /بُلِّغ بالوصول/.test(nd0[1]), W + ': شارة «✓✓ بُلِّغ بالوصول» للمبلَّغ فقط: ' + JSON.stringify(nd0));
    await pg.evaluate(id => markNotified(orders.find(x => x.id == id), 'arrived'), idOf('214244')); await pg.waitForTimeout(1500);
    const nd1 = await pg.evaluate(id => ({ badge: ((document.querySelector('#gmt-mr [data-mr-o="' + id + '"] [data-mr-notified]') || {}).textContent || '').trim(),
      btns: [...document.querySelectorAll('#gmt-mr [data-mr-o="' + id + '"] button')].map(b => (b.getAttribute('onclick') || '').replace(/\(.*/, '')) }), idOf('214244'));
    ok(/بُلِّغ بالوصول/.test(nd1.badge) && JSON.stringify(nd1.btns) === '["requestConfirm","contactCustomerArrival","contactShipOffice"]',
      W + ': بعد التبليغ الأوّل: تظهر الشارة فوراً ويصير الزرّ «التبليغ الثاني» (مراسلة الزبون) كما في البطاقة: ' + JSON.stringify(nd1));
    await H.call('/rest/v1/gmt_orders?id=eq.' + idOf('214244'), { notified_arrival_at: null }, 'PATCH');
    await pg.evaluate(id => { const o = orders.find(x => x.id == id); o.notified_arrival_at = null; }, idOf('214244')); await pg.waitForTimeout(1000);
    await pg.evaluate(() => { window.__arr = null; window.shareOrder = (id, k) => { window.__arr = [id, k]; }; window.__off = null; window.contactShipOffice = id => { window.__off = id; }; });
    await pg.click('#gmt-mr [onclick="shareOrder(' + idOf('214244') + ',\'arrived\')"]'); await pg.click('#gmt-mr [onclick="contactShipOffice(' + idOf('214244') + ')"]'); await pg.waitForTimeout(200);
    ok(JSON.stringify(await pg.evaluate(() => [window.__arr, window.__off])) === JSON.stringify([[idOf('214244'), 'arrived'], idOf('214244')]), W + ': «تبليغ الوصول» و«مراسلة فرع الشركة» ينادِيان دوالّ البطاقة نفسها');
    // فلتر «استلمها»
    await pg.click('#gmt-mr [data-mr-f="got"]'); await pg.waitForTimeout(150);
    ok(await pg.evaluate(() => document.querySelectorAll('#gmt-mr [data-mr-o]').length) === 1, W + ': فلتر «✅ استلمها» ⇒ واحدة');
    // تأكيد الاستلام بالمسار القائم نفسه
    await pg.click('#gmt-mr [onclick="requestConfirm(' + idOf('214138') + ',\'delivered\')"]'); await pg.waitForTimeout(300);
    const cm = await pg.evaluate(() => !document.getElementById('confirmModal').classList.contains('hidden') && document.getElementById('confirmTitle').textContent);
    const cmTop = await pg.evaluate(() => { const b = document.querySelector('#confirmModal button[onclick="executeConfirm()"]'); const r = b.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!t && !t.closest('#gmt-mr'); });
    ok(cm === 'تأكيد الاستلام' && cmTop, W + ': «✅ تأكيد الاستلام» (زرّ البطاقة) يفتح نافذة التأكيد القائمة فوق المراجعة: ' + cm);
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(150);
    ok(!!(await pg.$('#gmt-mr')), W + ': Esc أثناء نافذة التأكيد لا يغلق المراجعة');
    await pg.evaluate(() => { const b = [...document.querySelectorAll('#confirmModal button')].find(x => /executeConfirm/.test(x.getAttribute('onclick') || '')); b && b.click(); });
    await pg.waitForTimeout(1500);
    const st = (await H.call('/__dump', undefined, 'GET')).gmt_orders.find(o => o.id === idOf('214138')).status;
    const after = await pg.evaluate(id => (document.querySelector('#gmt-mr [data-mr-o="' + id + '"]') || {}).innerText || '', String(idOf('214138')));
    ok(st === 'delivered' && /بانتظار التحصيل/.test(after) && !/تأكيد الاستلام/.test(after), W + ': بعد التأكيد: القاعدة «delivered» والبطاقة «✔ بانتظار التحصيل»: ' + st);
    await pg.evaluate(() => { try { closeModal('afterDeliveryModal'); } catch (_) {} document.querySelectorAll('.fixed:not(.hidden)').forEach(m => { if (m.id && m.id !== 'gmt-mr' && /Modal$/.test(m.id)) m.classList.add('hidden'); }); });
    // (TASK-0219 · seq 148) «كل مره اضغط يعمل بحث جديد … فقط شحنات التي لم نؤكد الاستلام»
    await pg.click('#gmt-mr [data-mr-f="all"]');
    const orig = FAKE['214244'];
    FAKE['214244'] = R('214244', [1, 2, 3, 4], 'تم استلام الشحنة من قبل المرسل إليه', '27-10-2026 17:05', 'انفال عمر حسين', 'درعا - دوار الحمامة');   // تغيّرت عندهم خلال دقائق
    calls.length = 0;
    await pg.click('#gmt-mr [data-mr-run]');
    const cleared = await pg.evaluate(() => [...document.querySelectorAll('#gmt-mr [data-mr-o]')].map(c => c.getAttribute('data-mr-k')));
    ok(cleared.length && cleared.every(k => k === 'wait'), W + ': «↻ تحقّق من الكل» يمسح النتائج القديمة فوراً (لا يعرض المخزَّن): ' + JSON.stringify(cleared));
    await pg.waitForFunction(() => /انتهى الفحص/.test((document.querySelector('#gmt-mr [data-mr-prog]') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
    const asked2 = calls.flatMap(c => c.nums).sort();
    const c2 = await pg.evaluate(() => [...document.querySelectorAll('#gmt-mr [data-mr-o]')].map(c => ({ id: c.getAttribute('data-mr-o'), k: c.getAttribute('data-mr-k'), t: c.innerText })));
    const n44 = c2.find(c => /214244/.test(c.t));
    ok(JSON.stringify(asked2) === JSON.stringify(['210063', '214244', '99999999']) && c2.length === 3 && !c2.some(c => /214138/.test(c.t)),
      W + ': بحثٌ جديد عن الكل من موقعهم · المؤكَّد استلامه خرج من القائمة: ' + JSON.stringify(asked2));
    ok(n44 && n44.k === 'got' && /17:05/.test(n44.t) && /من قبل المرسل إليه/.test(n44.t), W + ': الحالة الجديدة ظهرت («وصلت» ⇒ «تم التسليم») لا القديمة');
    FAKE['214244'] = orig;
    // إغلاق وفتح ⇒ بحثٌ جديد أيضاً
    await pg.click('#gmt-mr [data-mr-close]'); calls.length = 0;
    await pg.click('[data-mr-launch]');
    await pg.waitForFunction(() => /انتهى الفحص/.test((document.querySelector('#gmt-mr [data-mr-prog]') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
    ok(calls.flatMap(c => c.nums).length === 3 && await pg.evaluate(() => !document.querySelector('#gmt-mr [data-mr-withdel]')), W + ': كل فتحٍ يبحث من جديد · لا خيار «بانتظار التحصيل»');
    const bub = await pg.evaluate(() => [...document.querySelectorAll('body > *')].filter(e => e.id !== 'gmt-mr' && /يدخل رقم تتبّع كل شحنات المفتي/.test(e.textContent || '') && getComputedStyle(e).opacity !== '0' && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0).length);
    ok(bub === 0, W + ': لا يبقى تلميح زرّ الفتح فوق النافذة: ' + bub);
    // خطأ الخادم ⇒ «تعذّرت القراءة» + «↻ أعد» ينجح
    failNext = 1; calls.length = 0;
    await pg.click('#gmt-mr [data-mr-run]');
    await pg.waitForFunction(() => /انتهى الفحص/.test((document.querySelector('#gmt-mr [data-mr-prog]') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
    const errN = await pg.evaluate(() => [...document.querySelectorAll('#gmt-mr [data-mr-k="err"]')].length);
    ok(errN >= 1 && !(await pg.$('#gmt-mr [data-mr-retry],#gmt-mr [data-mr-site]')), W + ': ردّ خطأ من الخادم ⇒ «⚠️ تعذّرت القراءة» (بلا أزرار إضافية): ' + errN);
    await pg.click('#gmt-mr [data-mr-run]');
    await pg.waitForFunction(() => /انتهى الفحص/.test((document.querySelector('#gmt-mr [data-mr-prog]') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
    ok(await pg.evaluate(() => !document.querySelector('#gmt-mr [data-mr-k="err"]')), W + ': «↻ تحقّق من الكل» يقرأ من جديد بعد الخطأ');
    const hs = await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1 || [...document.querySelectorAll('#gmt-mr .mr-o')].some(c => c.scrollWidth > c.clientWidth + 1));
    ok(!hs, W + ': لا طفح أفقي');
    if (W === 390) await pg.screenshot({ path: '/tmp/gmt-out/mufti_review_390.png' });
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(150);
    ok(!(await pg.$('#gmt-mr')), W + ': Esc يغلق');
    const real = errs.filter(e => !/status of (400|401|404|406|500)|Failed to load resource/.test(e));
    ok(!real.length, W + ': لا أخطاء JS ' + real.slice(0, 2).join(' / '));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
