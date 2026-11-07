// (TASK-0332 · المالك seq 559) «هكذا يظهر المتجر لأي زائر من الانستقرام … ما عم يفتح المتجر أبداً أبداً»
// متصفّح إنستغرام/فيسبوك على أندرويد (WebView) لا يعرف «Notification» ⇒ كان _applyRecord يرمي خطأً عند وجود عروض فيبقى المتجر هياكل رمادية.
// زائرٌ جديد (بلا جلسة · بلا نسخة محفوظة) + عروض حديثة ⇒ المنتجات والأقسام تُرسم · بلا أخطاء JS · ولا شريط «المتجر يتأخّر».
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const cats = [{ id: 'c1', name: 'عدسات', order: 1 }, { id: 'c2', name: 'إضاءة', order: 2 }];
const prods = Array.from({ length: 8 }, (_, i) => ({ id: 's_' + i, name: 'منتج ' + i, price: 10 + i, images: [], category_id: i % 2 ? 'c2' : 'c1' }));
const offers = [{ id: 'o1', title: 'عرض جديد', created_at: '2026-11-06T10:00:00Z', product_ids: ['s_1'], discount: 10 }];
const VISITOR = `try{ localStorage.clear(); sessionStorage.clear(); localStorage.setItem('gmt_intro_seen_build','x'); }catch(e){}`;
const NO_NOTIF = `try{ delete window.Notification; }catch(e){} try{ Object.defineProperty(window,'Notification',{value:undefined,configurable:true}); delete window.Notification; }catch(e){}`;
(async () => {
  for (const [label, init, lightOk] of [
    ['إنستغرام أندرويد (بلا Notification) · النسخة الخفيفة', VISITOR + NO_NOTIF, true],
    ['إنستغرام أندرويد (بلا Notification) · الكتالوج الكامل فقط', VISITOR + NO_NOTIF, false],
    ['متصفّح عادي (Notification موجود)', VISITOR, true]]) {
    await H.seed();
    await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-11-07T10:00:00Z', categories: cats, banners: [], offers, branches: [], products: prods }]);
    const o = await H.open('logo.jpg', { init, w: 412, h: 860, mobile: true, wait: 0 });
    await o.ctx.route(/\/storage\/v1\/object\/public\/products-images\/store\/home\.json/, r => lightOk
      ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ categories: cats, banners: [], offers, branches: [], products: prods }) })
      : r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
    await o.pg.goto(H.BASE + 'store.html', { waitUntil: 'domcontentloaded' });
    const hasN = await o.pg.evaluate(() => 'Notification' in window);
    await o.pg.waitForTimeout(6000);
    const a = await o.pg.evaluate(() => ({ cards: [...document.querySelectorAll('h4')].filter(h => /^منتج \d/.test(h.textContent.trim())).length,
      secs: document.querySelectorAll('[data-category-section]').length, ready: typeof _contentReady !== 'undefined' && _contentReady, stall: !!document.getElementById('gmt-stall') }));
    const real = o.errs.filter(e => !/status of (400|401|404|406)|Failed to load resource|favicon|AudioContext/.test(e));
    ok(a.cards >= 8 && a.secs === 2 && a.ready && !a.stall, label + ': المتجر رُسم (Notification ' + (hasN ? 'موجود' : 'غير موجود') + ') ' + JSON.stringify(a));
    ok(!real.length, label + ': لا أخطاء JS ' + real.slice(0, 2).join(' / '));
    await o.browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})();
