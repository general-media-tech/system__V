// «📋 قوائمي»: قوائم تجميع المشتريات + مشاركتها برابط #list= (gmt-lists.js)
const H = require('./h.js');
let pass = 0, fails = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ✔', m); } else { fails++; console.log('  ✘', m); } };
const NOISE = /vibrate|favicon|net::ERR|Failed to load resource/i;
const VISITOR = `try{ localStorage.clear(); sessionStorage.clear(); localStorage.setItem('gmt_intro_seen_build','x'); }catch(e){}`;
const C = (id, name) => ({ id, name, order: 1 });
const Pr = (id, name, price) => ({ id, name, price, category_id: 'c1', category_ids: ['c1'], images: [], stock: 5 });
const prods = [Pr('p1', 'منتج أول', 100), Pr('p2', 'منتج ثاني', 50.5), Pr('p3', 'منتج بلا سعر', 0)];
async function visit(url) {
  const o = await H.open('logo.jpg', { init: VISITOR, w: 412, h: 860, mobile: true, wait: 0 });
  await o.ctx.route(/home\.json/, r => r.fulfill({ status: 404, body: '' }));
  await o.pg.goto(H.BASE + url, { waitUntil: 'domcontentloaded' }); await o.pg.waitForTimeout(6000); return o;
}
const errsOf = o => (o.errs || []).filter(x => !NOISE.test(x));
(async () => {
  await H.seed(); await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-11-16T10:00:00Z', categories: [C('c1', 'عام')], banners: [], offers: [], branches: [], products: prods }]);
  const o = await visit('store.html'); const pg = o.pg; const allErrs = [errsOf(o)];
  const wait = ms => pg.waitForTimeout(ms);
  /* ① إنشاء قائمة من نافذة المنتج وإضافة منتجين */
  await pg.evaluate(() => openProductModal('p1')); await wait(700);
  ok(await pg.evaluate(() => !!document.getElementById('product-modal-list-btn')), 'زرّ «📋 أضف لقائمة» في نافذة المنتج');
  await pg.evaluate(() => document.getElementById('product-modal-list-btn').click()); await wait(300);
  await pg.fill('#gls [data-gls-name]', 'تجهيز استوديو'); await pg.click('#gls [data-act="newadd"]'); await wait(300);
  await pg.evaluate(() => { GMTLists.close(); closeModal('product-modal'); openProductModal('p2'); }); await wait(700);
  await pg.evaluate(() => document.getElementById('product-modal-list-btn').click()); await wait(300);
  await pg.evaluate(() => document.querySelector('#gls [data-act="addto"]').click()); await wait(300);
  const s1 = await pg.evaluate(() => ({ ls: JSON.parse(localStorage.getItem('gmt_lists_v1')) }));
  ok(s1.ls.length === 1 && s1.ls[0].name === 'تجهيز استوديو' && s1.ls[0].items.map(i => i.id).join() === 'p1,p2', 'القائمة محفوظة بمنتجين: ' + JSON.stringify(s1.ls[0].items));
  await pg.evaluate(() => { GMTLists.close(); closeModal('product-modal'); });
  await pg.evaluate(() => { closeSidebar && 0; document.getElementById('sidebar-lists-link').click(); }); await wait(600);
  /* المتجر يعدّل السعر الظاهر (100 ⇒ 99.99) ⇒ المجموع المتوقّع يُحسب من أسعار المتجر نفسه */
  const exp = await pg.evaluate(() => String(Math.round((parseFloat(__gmtStore().products.find(p => p.id === 'p1').price) + parseFloat(__gmtStore().products.find(p => p.id === 'p2').price)) * 100) / 100));
  const home = await pg.evaluate(() => document.querySelector('#gls [data-list]').innerText);
  ok(exp === '150.49' && /2 منتج/.test(home) && home.includes('$' + exp), 'قوائمي: عدد المنتجات والمجموع بالأسعار الحالية (' + exp + '): ' + home.replace(/\s+/g, ' '));
  /* ② رابط المشاركة */
  const link = await pg.evaluate(() => GMTLists.linkFor(GMTLists.load()[0]));
  ok(/#list=.+~p1\.1,p2\.1$/.test(link) && !/price|100|50/.test(link.split('~')[1]), 'الرابط يحمل المعرّفات والكمّيات فقط: ' + link);
  const hash = link.slice(link.indexOf('#'));
  const o2 = await visit('store.html' + hash); allErrs.push(errsOf(o2));
  const sh = await o2.pg.evaluate(() => ({ open: document.getElementById('gls').classList.contains('on'), txt: document.getElementById('gls').innerText, cards: document.querySelectorAll('#gls [data-gls-grid] .it').length, saveBtn: !!document.querySelector('#gls [data-act="save"]'), allBtn: !!document.querySelector('#gls [data-act="cartall"]'), mine: localStorage.getItem('gmt_lists_v1') }));
  ok(sh.open && /تجهيز استوديو/.test(sh.txt) && sh.cards === 2 && sh.saveBtn && sh.allBtn && sh.txt.includes('$' + exp), 'متصفّح نظيف: الرابط يفتح نفس المنتجين مع «احفظها عندي» و«أضف الكلّ»: ' + sh.cards + ' بطاقة');
  ok(!sh.mine, 'القائمة المشاركة لا تُحفظ تلقائياً');
  await o2.pg.click('#gls [data-act="save"]'); await o2.pg.waitForTimeout(300);
  ok(await o2.pg.evaluate(() => JSON.parse(localStorage.getItem('gmt_lists_v1') || '[]').length === 1), '«احفظها عندي» تحفظ القائمة');
  await o2.browser.close();
  /* ③ XSS في الاسم */
  const evil = '<img src=x onerror="window.__x=1"> <script>window.__x=1<\/script>';
  await pg.evaluate(n => { window.__x = 0; GMTLists.open(); }, evil); await wait(300);
  await pg.fill('#gls [data-gls-name]', evil); await pg.click('#gls [data-act="new"]'); await wait(400);
  const x1 = await pg.evaluate(() => ({ x: window.__x, imgs: document.querySelectorAll('#gls img').length, scripts: document.querySelectorAll('#gls script').length, txt: document.querySelector('#gls').innerText }));
  ok(!x1.x && !x1.imgs && !x1.scripts && /onerror/.test(x1.txt), 'اسم فيه <img onerror>/<script> يُعرض نصّاً ولا يُنفَّذ (قائمتي)');
  const evilLink = 'store.html#list=' + encodeURIComponent(evil) + '~p1.1';
  const o3 = await visit(evilLink); allErrs.push(errsOf(o3));
  const x2 = await o3.pg.evaluate(() => ({ x: window.__x, imgs: document.querySelectorAll('#gls img').length, scripts: document.querySelectorAll('#gls script').length, open: document.getElementById('gls').classList.contains('on') }));
  ok(x2.open && !x2.x && !x2.imgs && !x2.scripts, 'اسم خبيث في الرابط لا يُنفَّذ (القائمة المشاركة)');
  await o3.browser.close();
  /* ④ «أضف الكلّ للسلّة» يتخطّى المحذوف وبلا السعر */
  const o4 = await visit('store.html#list=' + encodeURIComponent('مختلط') + '~p1.2,p2.1,p3.1,deleted-id.1'); allErrs.push(errsOf(o4));
  const g1 = await o4.pg.evaluate(() => document.getElementById('gls').innerText);
  ok(/لم يعد متوفّراً/.test(g1), 'المنتج المحذوف يُعرض «لم يعد متوفّراً»');
  await o4.pg.click('#gls [data-act="cartall"]'); await o4.pg.waitForTimeout(400);
  const cart = await o4.pg.evaluate(() => ({ c: JSON.parse(localStorage.getItem('gmt_cart') || '[]').map(i => i.id + 'x' + i.qty).join(','), badge: document.querySelector('[data-element="cart-badge"]').textContent, msg: (document.querySelector('#gls [data-gls-msg]') || {}).innerText }));
  ok(cart.c === 'p1x2,p2x1' && cart.badge === '3', 'السلّة: p1×2 وp2×1 فقط (المحذوف وبلا السعر متخطَّيان) والشارة 3: ' + JSON.stringify(cart));
  ok(/تخطّينا 2/.test(cart.msg || ''), 'رسالة التخطّي: ' + cart.msg);
  await o4.browser.close();
  /* ⑤ حذف بتأكيد داخل النافذة (بلا confirm) */
  await pg.evaluate(() => { window.__dlg = 0; window.confirm = window.alert = window.prompt = () => { window.__dlg++; return true; }; GMTLists.open(); }); await wait(300);
  await pg.click('#gls [data-list] [data-act="del"]'); await wait(200);
  ok(await pg.evaluate(() => !!document.querySelector('#gls [data-act="delyes"]')), 'تأكيد الحذف داخل النافذة');
  await pg.click('#gls [data-act="delyes"]'); await wait(300);
  const left = await pg.evaluate(() => ({ n: GMTLists.load().length, d: window.__dlg }));
  ok(left.n === 1 && left.d === 0, 'الحذف تمّ بلا alert/confirm/prompt: ' + JSON.stringify(left));
  allErrs.push(errsOf(o));
  const errs = [].concat(...allErrs);
  ok(!errs.length, 'بلا أخطاء JS: ' + JSON.stringify(errs.slice(0, 3)));
  await o.browser.close();
  console.log(fails ? 'FAIL ' + fails + ' / ' + (pass + fails) : 'ALL PASS (' + pass + ')'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
