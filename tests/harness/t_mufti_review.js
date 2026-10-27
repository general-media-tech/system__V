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
      Object.assign({ name: 'عبد الهادي حمشو', phone: '0933000903', status: 'shipped', tracking_number: '210063', address: 'دمشق', shipped_at: '2026-10-22T10:00:00Z' }, base),
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
    const A = cards.find(c => c.k === 'got'), B = cards.find(c => c.k === 'branch'), D = cards.find(c => c.k === 'road'), N = cards.find(c => c.k === 'nf');
    ok(A && /غالب زيدان/.test(A.t) && /214138/.test(A.t) && /حالة الشحنة/.test(A.t) && /تم استلام الشحنة من قبل المرسل إليه/.test(A.t) && /15:36/.test(A.t),
      W + ': الأوردر وتحته بطاقة «حالة الشحنة» (المكان المحاط بالدائرة) بنصّها وتاريخها');
    ok(B && /تم وصول الشحنة إلى الفرع الوجهة/.test(B.t) && /في فرع الوجهة/.test(B.t), W + ': «وصلت فرع الوجهة» ⇒ 🏢 في فرع الوجهة');
    const act = await pg.evaluate(id => [...document.querySelectorAll('#gmt-mr [data-mr-o="' + id + '"] .mr-st')].map(x => x.classList.contains('on')), String(idOf('214244')));
    ok(JSON.stringify(act) === '[true,false,true,false]', W + ': الخطوات الأربع كما في موقعهم (١ و٣ مضاءتان): ' + JSON.stringify(act));
    ok(N && /لا يعرف الرقم/.test(N.t) && D && /اسم المستلم عند المفتي لا يشبه/.test(D.t) && !/لا يشبه/.test(A.t + B.t), W + ': رقمٌ غير موجود عندهم ⇒ يُقال · اسم مستلمٍ مختلف ⇒ تنبيه (فقط حيث يختلف)');
    // فلتر «استلمها»
    await pg.click('#gmt-mr [data-mr-f="got"]'); await pg.waitForTimeout(150);
    ok(await pg.evaluate(() => document.querySelectorAll('#gmt-mr [data-mr-o]').length) === 1, W + ': فلتر «✅ استلمها» ⇒ واحدة');
    // تأكيد الاستلام بالمسار القائم نفسه
    await pg.click('#gmt-mr [data-mr-confirm="' + idOf('214138') + '"]'); await pg.waitForTimeout(300);
    const cm = await pg.evaluate(() => !document.getElementById('confirmModal').classList.contains('hidden') && document.getElementById('confirmTitle').textContent);
    ok(cm === 'تأكيد الاستلام', W + ': «✅ تأكيد الاستلام» يفتح نافذة التأكيد القائمة فوق المراجعة: ' + cm);
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(150);
    ok(!!(await pg.$('#gmt-mr')), W + ': Esc أثناء نافذة التأكيد لا يغلق المراجعة');
    await pg.evaluate(() => { const b = [...document.querySelectorAll('#confirmModal button')].find(x => /executeConfirm/.test(x.getAttribute('onclick') || '')); b && b.click(); });
    await pg.waitForTimeout(1500);
    const st = (await H.call('/__dump', undefined, 'GET')).gmt_orders.find(o => o.id === idOf('214138')).status;
    const after = await pg.evaluate(id => (document.querySelector('#gmt-mr [data-mr-o="' + id + '"]') || {}).innerText || '', String(idOf('214138')));
    ok(st === 'delivered' && /بانتظار التحصيل/.test(after) && !/تأكيد الاستلام/.test(after), W + ': بعد التأكيد: القاعدة «delivered» والبطاقة «✔ بانتظار التحصيل»: ' + st);
    await pg.evaluate(() => { try { closeModal('afterDeliveryModal'); } catch (_) {} document.querySelectorAll('.fixed:not(.hidden)').forEach(m => { if (m.id && m.id !== 'gmt-mr' && /Modal$/.test(m.id)) m.classList.add('hidden'); }); });
    // خطأ الخادم ⇒ «تعذّرت القراءة» + «↻ أعد» ينجح
    await pg.click('#gmt-mr [data-mr-f="all"]');
    failNext = 1; calls.length = 0;
    await pg.click('#gmt-mr [data-mr-run]');
    await pg.waitForFunction(() => /انتهى الفحص/.test((document.querySelector('#gmt-mr [data-mr-prog]') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
    const errN = await pg.evaluate(() => [...document.querySelectorAll('#gmt-mr [data-mr-k="err"]')].length);
    ok(errN >= 1 && !!(await pg.$('#gmt-mr [data-mr-retry]')), W + ': ردّ خطأ من الخادم ⇒ «⚠️ تعذّرت القراءة» مع «↻ أعد»: ' + errN);
    const rn = await pg.evaluate(() => document.querySelector('#gmt-mr [data-mr-retry]').getAttribute('data-mr-retry'));
    await pg.click('#gmt-mr [data-mr-retry="' + rn + '"]'); await pg.waitForTimeout(1200);
    ok(await pg.evaluate(n => { const c = [...document.querySelectorAll('#gmt-mr [data-mr-o]')].find(x => x.innerText.includes(n)); return c && c.getAttribute('data-mr-k') !== 'err'; }, rn), W + ': «↻ أعد» يقرأ الرقم من جديد');
    // «وأيضاً بانتظار التحصيل»
    calls.length = 0;
    await pg.check('#gmt-mr [data-mr-withdel]'); await pg.waitForTimeout(1500);
    ok(calls.flatMap(c => c.nums).includes('214248') && await pg.evaluate(() => document.querySelectorAll('#gmt-mr [data-mr-o]').length) === 5,
      W + ': «وأيضاً بانتظار التحصيل» يضيفها ويفحص الجديدة فقط: ' + JSON.stringify(calls.map(c => c.nums)));
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
