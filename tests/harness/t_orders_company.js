// TASK-0157 — المالك seq 62: «لقيت سبب المشكلة … لما بيعبّي لحاله عم يعتمد على شركة المفتي، فأنا إذا كاتب شيء في أفرع أخرى ما عم بيطلع لي
// في الشركات الأخرى … انا ممكن اكتب العنوان هو يقترح لشركة الشحن» + seq 60 «لازم يعرض لي مكاتب القدموس ومسارات وبابل … التركيز على المفتي».
// الجرد: الاقتراح من كل الشركات دائماً (المختارة ثمّ المفتي ثمّ البقية) · الشركة التي ملأها النظام لا تحصر ولا تمنع إعادة الحسم ·
// اختيار مكتب يحدّد شركته (اختيارٌ صريح) · نافذة الشحن: المفتي افتراضياً لأوردرٍ بلا شركة.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };

(async () => {
  await H.seed();
  for (const [w, h] of [[390, 844], [1366, 800]]) {
    console.log(`— ${w}×${h}`);
    const [o1] = await H.call('/rest/v1/gmt_orders', [{ name: 'زبون بلا شركة ' + w, phone: '0933000611', product: 'كاميرا', qty: 1, price: 100, status: 'pending', branch: 'حلب', address: 'حمص' }]);
    const { browser, pg, errs } = await H.open('orders.html', { w, h, wait: 4500 });
    const sug = async (val) => pg.evaluate((val) => {
      const a = document.getElementById('in-addr'); a.value = val; officeSuggest(val);
      const box = document.getElementById('in-addr-sug');
      return { hidden: box.classList.contains('hidden'), items: [...box.querySelectorAll('button')].map(b => b.textContent.replace(/\s+/g, ' ').trim()) };
    }, val);
    await pg.evaluate(() => { document.getElementById('addModal').classList.remove('hidden'); initAddModal(); });

    // ١) الشركة ملأها النظام (المفتي) ⇒ «الحريقة» (مكاتب مسارات والقدموس فقط) تظهر — كانت 0
    await pg.evaluate(() => gmtSetCompany('in', 'المفتي'));
    let r = await sug('الحريقة');
    ok(!r.hidden && r.items.some(t => /مسارات/.test(t)) && r.items.some(t => /القدموس/.test(t)),
      'المفتي ملأها النظام ⇒ «الحريقة» تعرض مكاتب مسارات والقدموس (كانت لا شيء): ' + r.items.length);

    // ٢) «البرامكة» موجودة عند كل الشركات ⇒ المفتي أوّلاً ثمّ البقية
    r = await sug('البرامكة');
    const cos = r.items.map(t => (t.match(/المفتي|مسارات|القدموس|بابل/) || [''])[0]);
    ok(cos[0] === 'المفتي' && ['مسارات', 'القدموس', 'بابل'].every(c => cos.includes(c)), 'البرامكة ⇒ المفتي أوّلاً ثمّ مسارات والقدموس وبابل: ' + cos.join(','));

    // ٣) شركةٌ اختارها الموظّف بيده ⇒ مكاتبها أوّلاً، والبقية ما زالت تظهر
    await pg.evaluate(() => { const s = document.getElementById('in-company'); s.value = 'القدموس'; s.dataset.auto = ''; });
    r = await sug('البرامكة');
    const cos2 = r.items.map(t => (t.match(/المفتي|مسارات|القدموس|بابل/) || [''])[0]);
    ok(cos2[0] === 'القدموس' && cos2.includes('المفتي') && cos2.includes('مسارات'), 'اختار القدموس ⇒ القدموس أوّلاً والمفتي ومسارات تظهر بعدها: ' + cos2.join(','));

    // ٤) اختيار مكتب مسارات من الاقتراحات ⇒ الشركة مسارات (اختيارٌ صريح · لا وسم auto)
    await pg.evaluate(() => { const s = document.getElementById('in-company'); s.value = 'المفتي'; s.dataset.auto = '1'; });
    await sug('الحريقة');
    const pick = await pg.evaluate(() => {
      const b = [...document.querySelectorAll('#in-addr-sug button')].find(x => /مسارات/.test(x.textContent)); if (!b) return null; b.click();
      const s = document.getElementById('in-company'); return { co: s.value, auto: s.dataset.auto, addr: document.getElementById('in-addr').value };
    });
    ok(pick && pick.co === 'مسارات' && pick.auto === '' && /الحريقة/.test(pick.addr), 'اختيار مكتب مسارات ⇒ الشركة مسارات واختيارٌ صريح: ' + JSON.stringify(pick));

    // ٥) اللصق الذكي والشركة ملأها النظام (المفتي) ⇒ عنوانٌ لا مكتب للمفتي فيه يُحسم لشركته (كان يُرفض «ما في مكتب لـالمفتي»)
    const sp = await pg.evaluate(() => {
      initAddModal(); gmtSetCompany('in', 'المفتي');
      const el = document.getElementById('in-addr'); const toasts = []; const T = window.showToast; window.showToast = (m, k) => { toasts.push(String(m)); };
      smartPasteAddr(el, 'الحريقة'); window.showToast = T;
      const s = document.getElementById('in-company'); return { addr: el.value, co: s.value, toasts };
    });
    ok(/الحريقة/.test(sp.addr) && /—/.test(sp.addr) && ['مسارات', 'القدموس'].includes(sp.co) && !sp.toasts.some(t => /ما في مكتب لـالمفتي/.test(t)),
      'لصق «الحريقة» والمفتي تلقائية ⇒ مكتبٌ من شركته (' + sp.co + ') بلا رفض: ' + sp.addr.slice(0, 50));

    // ٦) شركةٌ اختارها الموظّف بلا مكتبٍ مطابق ⇒ لا قفز صامت: يقول أيّ شركةٍ فيها المكتب ويعرض اقتراحاتها
    const sp2 = await pg.evaluate(() => {
      initAddModal(); const s = document.getElementById('in-company'); s.value = 'المفتي'; s.dataset.auto = '';
      const el = document.getElementById('in-addr'); const toasts = []; const T = window.showToast; window.showToast = (m) => { toasts.push(String(m)); };
      smartPasteAddr(el, 'الحريقة'); window.showToast = T;
      const box = document.getElementById('in-addr-sug');
      return { co: s.value, toasts, sug: box.classList.contains('hidden') ? [] : [...box.querySelectorAll('button')].map(b => b.textContent) };
    });
    ok(sp2.co === 'المفتي' && sp2.toasts.some(t => /ليس فيه مكتب لـالمفتي — فيه مكتب لـ(مسارات|القدموس)/.test(t)) && sp2.sug.some(t => /مسارات|القدموس/.test(t)),
      'المفتي اختارها الموظّف ⇒ تبقى، ويُقال إنّ المكتب لشركةٍ أخرى وتُعرض مكاتبها: ' + (sp2.toasts[0] || ''));

    // ٧) فتح نافذة إضافة جديدة يمسح الوسم القديم
    const fresh = await pg.evaluate(() => { const s = document.getElementById('in-company'); s.dataset.auto = '1'; initAddModal(); return s.dataset.auto; });
    ok(fresh === '', 'نافذة إضافة جديدة ⇒ لا وسم «تلقائي» قديم');

    // ٨) نافذة الشحن لأوردرٍ بلا شركة ⇒ المفتي افتراضياً (فيبدأ قارئ إيصال المفتي)
    await pg.evaluate(() => document.getElementById('addModal').classList.add('hidden'));
    const ship = await pg.evaluate(async (id) => { await loadOrders(); openShipModal(id); const s = document.getElementById('ship-company'); const w = document.getElementById('ship-company-warn'); return { v: s.value, auto: s.dataset.auto, warnHidden: !w || w.classList.contains('hidden'), mufti: shipIsMufti() }; }, o1.id);
    ok(ship.v === 'المفتي' && ship.auto === '1' && ship.warnHidden && ship.mufti, 'نافذة الشحن لأوردرٍ بلا شركة ⇒ المفتي افتراضياً: ' + JSON.stringify(ship));

    // ٩) الإيصال يحسم الشركة (seq 60 «إلا إذا غيّرنا أو حطّينا إيصال غير المفتي» · «التعرّف على الشركة من شكل الإيصال»)
    //    القارئ مُستبدَل بنتيجةٍ محدّدة: نختبر ما تفعله النافذة بالنتيجة (التعرّف نفسه في t_mufti_read وفي _companyOf أدناه)
    const [oQ, oN] = await H.call('/rest/v1/gmt_orders', [
      { name: 'محفوظ القدموس ' + w, phone: '0933000612', product: 'عدسة', qty: 1, price: 50, status: 'pending', branch: 'حلب', address: 'طرطوس', shipping_company: 'القدموس' },
      { name: 'بلا شركة ٢ ' + w, phone: '0933000613', product: 'حامل', qty: 1, price: 20, status: 'pending', branch: 'حلب', address: 'حماة' }]);
    const rcpt = (id, res, pickCo, answer) => pg.evaluate(async ({ id, res, pickCo, answer }) => {
      await loadOrders(); openShipModal(id);
      if (pickCo) { const s = document.getElementById('ship-company'); s.value = pickCo; s.dispatchEvent(new Event('change', { bubbles: true })); }
      const d = GMTOffices.data['المفتي']; const city = Object.keys(d).find(c => (d[c] || []).length); const key = city + '|' + d[city][0].name;
      window.__calls = 0; GMTReceipt.readMufti = async () => { __calls++; const r = JSON.parse(JSON.stringify(res)); if (r.branch && r.branch.key === 'K') r.branch.key = key; return r; };
      const cv = document.createElement('canvas'); cv.width = 300; cv.height = 200; const b = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.8));
      const f = new File([b], 'r.jpg', { type: 'image/jpeg' }); _shipScan = { original: f, scanned: f, mode: 'color' }; _shipRcptFile = f; _shipOrig = f;
      /* (TASK-0165 · seq 78) شركةٌ محفوظة عند الإنشاء والإيصال لغيرها ⇒ سؤال — يُجاب كما يجيب الموظّف */
      const p = shipReadTracking(); let asked = '';
      for (let i = 0; i < 600 && answer; i++) { const o = document.querySelector('.gmtask-ov'); if (o) { asked = o.innerText.replace(/\s+/g, ' '); [...o.querySelectorAll('button')].find(b => new RegExp(answer).test(b.textContent)).click(); break; } await new Promise(r => setTimeout(r, 100)); }
      await p;
      const s = document.getElementById('ship-company'), st = document.getElementById('ship-track-auto'), fr = document.getElementById('ship-from');
      return { asked, calls: __calls, co: s.value, auto: s.dataset.auto, track: document.getElementById('ship-tracking').value, key,
        from: fr.value, src: fr.getAttribute('data-src'), fromShown: !document.getElementById('ship-from-wrap').classList.contains('hidden'),
        stHidden: st.classList.contains('hidden'), st: st.innerText.replace(/\s+/g, ' ') };
    }, { id, res, pickCo, answer });
    const MUF = { tracking: { status: 'barcode', number: '778899' }, barcode: { number: '778899' }, type: { kind: 'mufti', why: 'اسم الشركة' }, branch: { key: 'K', confident: true, candidates: [], text: 'المصدر' }, company: 'المفتي' };
    const QAD = { tracking: { status: 'barcode', number: '5555' }, barcode: { number: '5555' }, type: { kind: 'unsure', why: 'بلا علامة' }, branch: { key: null, confident: false, candidates: [] }, company: 'القدموس', foreign: true };
    let R = await rcpt(oQ.id, MUF, null, 'غيّر إلى');
    ok(/إنت محدّد شركة «القدموس»/.test(R.asked) && /«المفتي»/.test(R.asked) && R.calls === 1 && R.co === 'المفتي' && R.track === '778899' && R.fromShown && R.from === R.key && R.src === 'receipt',
      'أوردر محفوظ «القدموس» + إيصال المفتي ⇒ سؤال (seq 78) ثمّ «غيّر إلى المفتي» ⇒ يُملأ الرقم والفرع: ' + JSON.stringify({ co: R.co, t: R.track, src: R.src, asked: R.asked.slice(0, 60) }));
    R = await rcpt(oN.id, QAD, null, 'غيّر إلى');
    // (TASK-0174 · seq 91 «دائماً يقول لي إنت محدّد … نكمل ولا نغيّر») الافتراضيّة أيضاً ⇒ سؤال · «غيّر» ⇒ القدموس
    // (TASK-0159) صار يُقرأ بقارئ القدموس بعدها — هنا الصورة فارغة فلا يجد رقمه ⇒ رقم قارئ المفتي يُعرض للضغط فقط · وخانة «الفرع المصدر» تظهر للقدموس
    // بافتراضيّها من الإعدادات «حلب|الفرقان» (seq 73: «الافتراضي في حالة تعذّر القراءة»)
    ok(/إنت محدّد شركة «المفتي»/.test(R.asked) && /«القدموس»/.test(R.asked) && R.calls === 1 && R.co === 'القدموس' && R.auto === '' && R.track === '' && R.fromShown && R.from === 'حلب|الفرقان' && R.src === 'default' && /5555/.test(R.st),
      'المفتي افتراضية + إيصالٌ عليه اسم القدموس ⇒ سؤال ثمّ «غيّر» ⇒ القدموس، ولا يُملأ رقمٌ تلقائياً (يُعرض للضغط): ' + JSON.stringify({ co: R.co, t: R.track, asked: R.asked.slice(0, 50), st: R.st.slice(0, 90) }));
    R = await rcpt(oN.id, QAD, null, 'نكمل مع');
    ok(/إنت محدّد شركة «المفتي»/.test(R.asked) && R.calls === 2 && R.co === 'المفتي' && R.track === '' && /أُبقيت «المفتي» كما اخترتها/.test(R.st),
      'المفتي افتراضية + إيصال القدموس ⇒ «نكمل مع المفتي» ⇒ تبقى ويُعاد بقارئ المفتي: ' + JSON.stringify({ calls: R.calls, co: R.co, st: R.st.slice(0, 80) }));
    R = await rcpt(oN.id, QAD, 'مسارات');
    // (TASK-0159 · seq 69–70) مسارات صارت تُقرأ — بقارئها لا بقارئ المفتي
    ok(R.calls === 0 && R.co === 'مسارات' && !R.stHidden && R.track === '' && /مسارات/.test(R.st), 'اخترتَ «مسارات» بيدك ⇒ يُقرأ بقارئ مسارات (لا المفتي) وتبقى مسارات: ' + JSON.stringify({ calls: R.calls, co: R.co, st: R.st.slice(0, 70) }));
    R = await rcpt(oN.id, QAD, 'المفتي', 'نكمل مع');
    ok(/إنت محدّد شركة «المفتي»/.test(R.asked) && R.calls === 2 && R.co === 'المفتي' && R.track === '' && /أُبقيت «المفتي» كما اخترتها/.test(R.st), 'اخترتَ «المفتي» بيدك وإيصالٌ عليه اسم القدموس ⇒ سؤالٌ أيضاً ثمّ «نكمل» ⇒ تبقى المفتي: ' + R.st.slice(0, 80));
    R = await rcpt(oN.id, MUF);
    ok(R.co === 'المفتي' && R.track === '778899' && R.src === 'receipt' && !/غيّرتُ/.test(R.st), 'المفتي افتراضية + إيصال المفتي ⇒ كما كان (رقمٌ وفرع، بلا رسالة تغيير)');
    if (w === 390) {
      const co = await pg.evaluate(() => ['شركة القدموس للنقل', 'شركه الفدموس', 'مسارات للشحن', 'Al Qadmous', 'المرسل محمد الوجهة حمص', 'شركة المفتي'].map(t => GMTReceipt._companyOf(t)));
      ok(JSON.stringify(co) === JSON.stringify(['القدموس', 'القدموس', 'مسارات', 'القدموس', null, null]), 'التعرّف على اسم الشركة في نصّ الإيصال (ومشوّه النقاط) بلا تخمين: ' + JSON.stringify(co));
    }

    const bad = errs.filter(e => !/favicon|أصول ناقصة|Failed to load resource|404/.test(e));
    ok(bad.length === 0, 'لا أخطاء JS: ' + JSON.stringify(bad.slice(0, 3)));
    await browser.close();
  }
  console.log(fails ? `FAIL=${fails} (pass ${pass})` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
