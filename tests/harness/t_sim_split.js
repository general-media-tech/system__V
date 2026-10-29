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
    const { browser, pg, errs } = await H.open('inventory.html?check=similar', { w: W, h: mob ? 844 : 900, mobile: mob, wait: 5000,
      init: H.ADMIN_INIT + ` try{ localStorage.removeItem('gmt_sim_ai'); localStorage.removeItem('gmt_sim_skip'); }catch(e){}` });
    const vis = []; await pg.route('**/functions/v1/gmt-vision', async route => { const b = JSON.parse(route.request().postData() || '{}'); vis.push({ q: b.question, img: (b.image || '').length });
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ answer: '{"pick":1,"confidence":88,"why":"نفس رأس الإضاءة وشكله"}', provider: 'gemini' }) }); });
    await pg.waitForFunction(() => typeof _simRows !== 'undefined' && _simRows && !_simBusy && document.querySelector('#bulk-content [data-sa="reanalyze"]'), null, { timeout: 30000 }).catch(() => {});
    const ids = await pg.evaluate(() => _simVisible().map(x => x.sp.id));
    ok(ids.length === 3 && !ids.includes('s4'), W + ': ثلاثة متشابهات بالاسم والموديل (رأس الإضاءة باسمٍ مختلفٍ كلّياً لا يظهر بعد): ' + ids.join(','));
    // ① الشاشة المقسومة
    await pg.evaluate(() => document.querySelector('#bulk-content [data-sa="splitall"]').click()); await pg.waitForTimeout(300);
    const L = await pg.evaluate(() => { const o = document.getElementById('sim-split'), body = o && o.querySelector('[data-spl-body]'), panes = body ? [...body.children] : [];
      return { open: !!o, dir: body ? getComputedStyle(body).flexDirection : '', n: panes.length, h: panes.map(p => Math.round(p.getBoundingClientRect().height)), w: panes.map(p => Math.round(p.getBoundingClientRect().width)),
        t: o ? o.innerText.replace(/\s+/g, ' ') : '', hscroll: document.documentElement.scrollWidth > innerWidth + 1 }; });
    ok(L.open && L.n === 2 && L.dir === (mob ? 'column' : 'row') && /في المتجر/.test(L.t) && /في الجرد/.test(L.t) && /1 \/ 3/.test(L.t) && !L.hscroll,
      W + ': شاشةٌ مقسومة نصفين (' + (mob ? 'فوق وتحت' : 'جنباً إلى جنب') + '): ' + JSON.stringify({ dir: L.dir, h: L.h, w: L.w }));
    await pg.screenshot({ path: '/tmp/gmt-out/sim_split_' + W + '.png' });
    // ② بعد الحفظ ⇐ التالي
    const head = () => pg.evaluate(() => { const o = document.getElementById('sim-split'); return o ? o.innerText.replace(/\s+/g, ' ').slice(0, 220) : 'مغلقة'; });
    const first = await pg.evaluate(() => _spl.sid);
    await pg.evaluate(() => { const o = document.getElementById('sim-split'); o.querySelector('[data-sf="brand"]').value = 'Godox'; o.querySelector('[data-spl="save"]').click(); }); await pg.waitForTimeout(800);
    const h2 = await head(), second = await pg.evaluate(() => _spl && _spl.sid);
    ok(/2 \/ 3/.test(h2) && second && second !== first, W + ': «💾 احفظ» ⇐ المنتج التالي مباشرةً (لا انتظار على إشارة): ' + first + ' ⇒ ' + second);
    // «ليسا نفس المنتج» ⇐ التالي
    await pg.evaluate(() => document.querySelector('#sim-split [data-spl="skip"]').click()); await pg.waitForTimeout(400);
    const h3 = await head(), third = await pg.evaluate(() => _spl && _spl.sid);
    ok(/\/ 2/.test(h3) && third !== second, W + ': «✕ ليسا نفس المنتج» ⇐ التالي: ' + second + ' ⇒ ' + third + ' · ' + h3.slice(0, 40));
    // «اربطهما» ⇐ صفحة التعديل والتالي خلفها
    await pg.evaluate(() => { window.__opened = null; window.invOpenFullEdit = id => { window.__opened = String(id); }; });
    const linkSid = third;
    await pg.evaluate(() => document.querySelector('#sim-split [data-spl="link"]').click());
    await pg.waitForFunction(() => window.__opened, null, { timeout: 8000 }).catch(() => {});
    const after = await pg.evaluate(() => ({ op: window.__opened, sid: _spl && _spl.sid, n: _simVisible().length }));
    ok(after.op && after.sid && after.sid !== linkSid && after.n === 1, W + ': «🔗 اربطهما» ⇐ صفحة التعديل وخلفها المنتج التالي: ' + JSON.stringify(after));
    await pg.evaluate(() => simSplitClose());
    // ③ العقل بالصور
    const aiBtn = await pg.evaluate(() => { const b = document.querySelector('#bulk-content [data-sa="aiall"]'); return b ? b.textContent : ''; });
    ok(/دقّق بالصور بالعقل \(1\)/.test(aiBtn), W + ': زرّ «🧠 دقّق بالصور بالعقل» بعدد ما له صور: ' + aiBtn);
    await pg.evaluate(() => document.querySelector('#bulk-content [data-sa="aiall"]').click());
    await pg.waitForFunction(() => !_simAIRun && _simVisible().some(x => x.sp.id === 's4'), null, { timeout: 20000 }).catch(() => {});
    const s4 = await pg.evaluate(() => { const c = document.querySelector('#bulk-content [data-sim="s4"]'); return c ? c.innerText.replace(/\s+/g, ' ') : ''; });
    ok(/Bedirot T40/.test(s4) && /العقل بالصور 88%/.test(s4), W + ': بحكم العقل بالصور ظهر «رأس إضاءة مستمرة احترافي» ⇐ «Bedirot T40 هيد» (الاسم مختلف كلّياً): ' + s4.slice(0, 160));
    ok(vis.length === 1 && vis[0].img > 500 && /STORE/.test(vis[0].q) && /Bedirot T40/.test(vis[0].q), W + ': أُرسلت لوحةٌ واحدة (صورة + أسماء المرشّحين مرقّمة) إلى gmt-vision: ' + JSON.stringify(vis.map(v => ({ img: v.img, q: v.q.slice(0, 60) }))));
    const cache = await pg.evaluate(() => JSON.parse(localStorage.getItem('gmt_sim_ai') || '{}'));
    ok(cache.s4 && cache.s4.conf === 88 && String(cache.s4.iid) === D, W + ': حكم العقل محفوظ على الجهاز (لا يُسأل مرّتين): ' + JSON.stringify(cache.s4 || null).slice(0, 120));
    const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
    ok(!real.length, W + ': لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
