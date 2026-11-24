// (المالك seq B1048 «اشوف تفاصيل المنتج من داخل نقطه البيع اشوف سجل الفواتير … توصيل في كل مكان للوصول في كل شيء»)
// ① بطاقة المنتج بنقطة البيع: الأدمن يرى التكلفة + «🧾 سجلّ الفواتير والحركة» + «✏️ كلّ التفاصيل والتعديل» · الموظّف لا
// ② inventory.html?pid=…&view=mov|det يفتح المنتج نفسه مباشرةً (كشف الحركة · التفاصيل)
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const o = await H.open('pos.html', { init: H.STAFF_INIT, w: 1366, h: 900, mobile: false, wait: 7000 });
  const card = async adm => o.pg.evaluate(adm => { if (!window.GMTRole) window.GMTRole = {}; const k = GMTRole.isAdmin; GMTRole.isAdmin = () => adm;
    const p = allProducts.find(x => !x._is_offer); openProductDetail(p.id); GMTRole.isAdmin = k;
    const b = document.querySelector('#pd-content [data-pd-admin]'), m = document.querySelector('#pd-content [data-pd-mov]');
    const r = { box: !!b, mov: m ? m.getAttribute('href') : '', edit: (document.querySelector('#pd-content [data-pd-edit]') || {}).href || '', id: String(p.id), txt: b ? b.innerText : '' };
    try { closeProductDetail(); } catch (_) {} return r; }, adm);
  let r = await card(true);
  ok(r.box && r.mov === 'inventory.html?pid=' + encodeURIComponent(r.id) + '&view=mov' && /view=edit/.test(r.edit), '① الأدمن ⇒ زرّا «سجلّ الفواتير والحركة» و«كلّ التفاصيل والتعديل» بنفس المنتج: ' + r.mov);
  r = await card(false);
  ok(!r.box, '① الموظّف ⇒ لا أزرار أدمن ولا تكلفة');
  const pid = r.id; await o.browser.close();
  for (const [v, sel, nm] of [['mov', '#movement-modal', 'كشف الحركة'], ['det', '#detail-modal', 'التفاصيل']]) {
    const I = await H.open('inventory.html?pid=' + encodeURIComponent(pid) + '&view=' + v, { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 7000 });
    const s = await I.pg.evaluate(sel => { const m = document.querySelector(sel); return { shown: !!m && getComputedStyle(m).display !== 'none' && !m.classList.contains('hidden'), txt: m ? m.innerText.slice(0, 80) : '' }; }, sel);
    ok(s.shown, '② inventory.html?pid&view=' + v + ' ⇒ يفتح ' + nm + ' مباشرةً: ' + JSON.stringify(s).slice(0, 140));
    await I.browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
