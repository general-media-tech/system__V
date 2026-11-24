// (seq B1053 · خطأ حرج «invalid input syntax for type uuid: OFFER_…») فتح عرضٍ في نقطة البيع لا يطلب products بمعرّف «OFFER_» أبداً ·
//   عرض بمنتج واحد ⇒ مواصفات منتجه · باقة بعدّة منتجات ⇒ بلا طلب
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const o = await H.open('pos.html', { init: H.STAFF_INIT, w: 1366, h: 900, mobile: false, wait: 7000 });
  const urls = []; o.pg.on('request', r => { if (/\/rest\/v1\/products\?id=eq\./.test(r.url())) urls.push(decodeURIComponent(r.url())); });
  const r = await o.pg.evaluate(async () => {
    const real = allProducts.find(x => !x._is_offer && /^[0-9a-f-]{36}$/.test(String(x.id)));
    const single = { id: 'OFFER_11111111-1111-1111-1111-111111111111', name: '🎁 عرض واحد', price: 10, _is_offer: true, _offer_items: [{ id: real.id, name: real.name, qty: 1 }] };
    const bundle = { id: 'OFFER_22222222-2222-2222-2222-222222222222', name: '🎁 باقة', price: 20, _is_offer: true, _offer_items: [{ id: real.id, qty: 1 }, { id: allProducts[1].id, qty: 1 }] };
    allProducts.push(single, bundle);
    openProductDetail(single.id); await new Promise(z => setTimeout(z, 800)); closeProductDetail();
    openProductDetail(bundle.id); await new Promise(z => setTimeout(z, 800)); closeProductDetail();
    return real.id;
  });
  ok(!urls.some(u => /OFFER_/.test(u)), 'لا طلب products بمعرّف OFFER_: ' + JSON.stringify(urls.map(u => u.replace(/^.*id=eq\./, '').slice(0, 40))));
  ok(urls.some(u => u.includes('id=eq.' + r) && /specs,compat/.test(u)), 'العرض بمنتج واحد ⇒ مواصفات منتجه نفسه');
  ok(urls.filter(u => /specs,compat/.test(u)).length === 1, 'الباقة بعدّة منتجات ⇒ بلا طلب مواصفات');
  ok(!o.errs.filter(e => /OFFER_|22P02/.test(e)).length, 'لا خطأ 22P02: ' + JSON.stringify(o.errs.slice(0, 2)));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
