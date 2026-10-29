// (المالك seq 218) «ممكن ما تكون الصورة متطابقة ١٠٠٪ ولكن المنتج اللي في الصورة نفسه — أو الاسم أحياناً · المنتج بعد حفظه خلاص يطالعني منه
// ما يكتب لي فقط إشارة وأنا أستنّى · أيّ واحد من الاثنين المنتج نفسه ممكن أحتار — اعرضه لي في الجرد وفي المتجر سوا (الاسم والصور) يقسم الشاشة لنصفين».
// ① «◧ قارنها واحداً واحداً» ⇒ شاشةٌ مقسومة: نصف المتجر ونصف الجرد (جنباً إلى جنب على الكمبيوتر · فوق وتحت على الهاتف)
// ② بعد «💾 احفظ» ⇐ التالي مباشرةً · «✕ ليسا نفس المنتج» ⇐ التالي · «🔗 اربطهما» ⇐ صفحة التعديل والتالي خلفها
// ③ «🧠 دقّق بالصور بالعقل»: لوحةٌ واحدة (صورة المتجر + مرشّحو الجرد مرقّمين) إلى gmt-vision ⇒ منتجٌ اسمه مختلفٌ كلّياً يظهر بحكم العقل
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
(async () => {
  for (const W of [1366, 390]) {
    const { prods } = await H.seed();
    const [A, B, C, D] = prods.map(p => String(p.id));
    const P = { [A]: { name: 'Led 660 pro', group_name: 'بانيل ليد', price: 65 }, [B]: { name: 'MM4028 RGB', group_name: 'بانيل ليد', price: 90 },
      [C]: { name: 'Q12 ترايبود ذكي', group_name: 'ستاندات وترايبود', price: 30 }, [D]: { name: 'Bedirot T40 هيد', group_name: 'هيد لايت ورؤوس اضائة', price: 120, image_url: PNG } };
    for (const id of Object.keys(P)) await H.call('/rest/v1/products?id=eq.' + id, Object.assign({ image_url: null, images: null }, P[id]), 'PATCH');
    for (const p of prods.slice(4)) await H.call('/rest/v1/products?id=eq.' + p.id, { name: 'كاميرا تجربة لا تشبه', group_name: 'كاميرات جديد فقط' }, 'PATCH');
    await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-10-17T21:08:21.137229+00:00',
      categories: [{ id: 'c1', name: 'قسم الإضاءة اللوحية /ليد بانيل/' }, { id: 'c2', name: 'قسم الترايبود الذكي' }, { id: 'c3', name: 'قسم رأس الإضاءة المستمرة' }], products: [
      { id: 's1', name: 'لوح اضائة 660 pro مع ريمونت', price: 65, images: [], category_ids: ['c1'] },
      { id: 's2', name: 'MM4028-RGBW لوح يعمل بالبطارية', price: 90, images: [], category_ids: ['c1'] },
      { id: 's3', name: 'Q12 ترايبود ذكي مع ريمونت', price: 30, images: [], category_ids: ['c2'] },
      { id: 's4', name: 'رأس إضاءة مستمرة احترافي للاستوديو', price: 120, images: [PNG], category_ids: ['c3'] }] }]);
    const mob = W < 500;
    await H.call('/rest/v1/gmt_settings?key=eq.sim_ai_verdicts', undefined, 'DELETE');
    const { browser, pg, errs } = await H.open('inventory.html', { w: W, h: mob ? 844 : 900, mobile: mob, wait: 5000,
      init: H.ADMIN_INIT + ` try{ localStorage.removeItem('gmt_sim_ai'); localStorage.removeItem('gmt_sim_skip'); }catch(e){}` });
    const vis = []; await pg.route('**/functions/v1/gmt-vision', async route => { const b = JSON.parse(route.request().postData() || '{}'); vis.push({ q: b.question, img: (b.image || '').length });
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ answer: '{"pick":1,"confidence":88,"why":"نفس رأس الإضاءة وشكله"}', provider: 'gemini' }) }); });
    const prog = []; await pg.evaluate(() => { window.__p = []; const o = window._simProgress; window._simProgress = function (c, pc, m, x) { o(c, pc, m, x); window.__p.push(m); }; });
    await pg.evaluate(() => invOpenCheck('similar'));
    const idle = () => pg.waitForFunction(() => typeof _simRows !== 'undefined' && _simRows && !_simBusy && !_simAIRun && document.querySelector('#bulk-content [data-sa="reanalyze"]'), null, { timeout: 40000 }).catch(() => {});
    await idle();
    const ps = await pg.evaluate(() => window.__p);
    ok(ps.some(m => /العقل ينظر إلى صور/.test(m)), W + ': (seq 219) العقل يراجع بالصور تلقائياً ضمن التحليل الكامل قبل أن تُفتح النتائج (بلا زرّ): ' + ps.filter(m => /العقل/.test(m)).slice(-1)[0]);
    const ids = await pg.evaluate(() => _simVisible().map(x => x.sp.id));
    const s4 = await pg.evaluate(() => { const c = document.querySelector('#bulk-content [data-sim="s4"]'); return c ? c.innerText.replace(/\s+/g, ' ') : ''; });
    ok(ids.length === 4 && /Bedirot T40/.test(s4) && /العقل بالصور 88%/.test(s4), W + ': ٣ بالاسم والموديل + «رأس إضاءة احترافي» ⇐ «Bedirot T40 هيد» بحكم العقل بالصور (الاسم مختلف كلّياً): ' + ids.join(',') + ' · ' + s4.slice(0, 120));
    ok(vis.length === 1 && vis[0].img > 500 && /STORE/.test(vis[0].q) && /Bedirot T40/.test(vis[0].q), W + ': لوحةٌ واحدة (صورة + أسماء المرشّحين مرقّمة) إلى gmt-vision: ' + JSON.stringify(vis.map(v => ({ img: v.img, q: v.q.slice(0, 50) }))));
    await pg.waitForTimeout(500);
    const db = (await H.call('/rest/v1/gmt_settings?key=eq.sim_ai_verdicts&select=value', undefined, 'GET'))[0];
    const dv = db ? JSON.parse(db.value) : {};
    ok(dv.s4 && dv.s4.conf === 88 && String(dv.s4.iid) === D, W + ': حكم العقل محفوظ في القاعدة (gmt_settings) لا على جهازٍ واحد: ' + JSON.stringify(dv.s4 || null).slice(0, 100));
    // مرّة واحدة: إعادة التحليل الكامل — ومن «جهازٍ» آخر بلا ذاكرة محلّية — لا تسأل العقل ثانيةً
    await pg.evaluate(() => { localStorage.removeItem('gmt_sim_ai'); _simAIMem = null; document.querySelector('#bulk-content [data-sa="reanalyze"]').click(); });
    await pg.waitForTimeout(300); await idle();
    const again = await pg.evaluate(() => ({ s4: _simVisible().some(x => x.sp.id === 's4'), hdr: (document.querySelector('#bulk-content > div') || {}).innerText.replace(/\s+/g, ' ') }));
    ok(vis.length === 1 && again.s4 && /فحص بالصور 1 منتجاً/.test(again.hdr) && /لا يُعاد إلا بطلبك/.test(again.hdr), W + ': (seq 219) إعادة التحليل ومن جهازٍ آخر ⇒ لا يُستهلك العقل ثانيةً (طلبات العقل ما زالت ١) والحكم معروض: ' + again.hdr.slice(-260));
    // إعادة فحص العقل — يدوياً فقط
    await pg.evaluate(() => { GMTAsk.confirm = async () => true; const b = document.querySelector('#bulk-content [data-sa="aireset"]'); if (b) b.click(); });
    await pg.waitForTimeout(500); await idle();
    ok(vis.length >= 2, W + ': «أعد فحص العقل للكل» (يدوي بتأكيد) يسأل العقل من جديد: ' + vis.length);
    // ① الشاشة المقسومة
    await pg.evaluate(() => document.querySelector('#bulk-content [data-sa="splitall"]').click()); await pg.waitForTimeout(300);
    const L = await pg.evaluate(() => { const o = document.getElementById('sim-split'), body = o && o.querySelector('[data-spl-body]'), panes = body ? [...body.children] : [];
      return { open: !!o, dir: body ? getComputedStyle(body).flexDirection : '', n: panes.length, h: panes.map(p => Math.round(p.getBoundingClientRect().height)), w: panes.map(p => Math.round(p.getBoundingClientRect().width)),
        t: o ? o.innerText.replace(/\s+/g, ' ') : '', hscroll: document.documentElement.scrollWidth > innerWidth + 1 }; });
    ok(L.open && L.n === 2 && L.dir === (mob ? 'column' : 'row') && /في المتجر/.test(L.t) && /في الجرد/.test(L.t) && /1 \/ 4/.test(L.t) && !L.hscroll,
      W + ': شاشةٌ مقسومة نصفين (' + (mob ? 'فوق وتحت' : 'جنباً إلى جنب') + '): ' + JSON.stringify({ dir: L.dir, h: L.h, w: L.w }));
    await pg.screenshot({ path: '/tmp/gmt-out/sim_split_' + W + '.png' });
    // ② بعد الحفظ ⇐ التالي
    const st = () => pg.evaluate(() => ({ sid: _spl && _spl.sid, idx: _spl && _spl.idx, n: _simVisible().length, cands: _spl ? (_simVisible().find(x => x.sp.id === _spl.sid) || { cands: [] }).cands.length : 0 }));
    const s0 = await st();
    await pg.evaluate(() => { const o = document.getElementById('sim-split'); o.querySelector('[data-sf="brand"]').value = 'Godox'; o.querySelector('[data-spl="save"]').click(); }); await pg.waitForTimeout(800);
    const s1 = await st();
    ok(s1.sid && s1.sid !== s0.sid && s1.idx === s0.idx + 1, W + ': «💾 احفظ» ⇐ المنتج التالي مباشرةً (لا انتظار على إشارة): ' + JSON.stringify([s0, s1]));
    // «ليسا نفس المنتج» ⇐ التالي (أو المرشّح التالي)
    await pg.evaluate(() => document.querySelector('#sim-split [data-spl="skip"]').click()); await pg.waitForTimeout(400);
    const s2 = await st();
    ok(s2.sid !== s1.sid || s2.cands < s1.cands, W + ': «✕ ليسا نفس المنتج» ⇐ التالي: ' + JSON.stringify([s1, s2]));
    // «اربطهما» ⇐ صفحة التعديل والتالي خلفها
    await pg.evaluate(() => { window.__opened = null; window.invOpenFullEdit = id => { window.__opened = String(id); }; });
    await pg.evaluate(() => document.querySelector('#sim-split [data-spl="link"]').click());
    await pg.waitForFunction(() => window.__opened, null, { timeout: 8000 }).catch(() => {});
    const s3 = await st(), op = await pg.evaluate(() => window.__opened);
    ok(op && s3.sid && s3.sid !== s2.sid && s3.n === s2.n - 1, W + ': «🔗 اربطهما» ⇐ صفحة التعديل وخلفها المنتج التالي: ' + JSON.stringify([s2, s3]));
    await pg.evaluate(() => simSplitClose());
    const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
    ok(!real.length, W + ': لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
