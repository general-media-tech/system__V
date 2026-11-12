// (TASK-0361 · المالك seq 637) «اربط بنك معلومات شركات الشحن … في المتجر لما يدخل عنوانه — في البداية المفتي حصراً ثمّ يعرض له الخيارات الأخرى»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const VISITOR = `try{ localStorage.clear(); sessionStorage.clear(); localStorage.setItem('gmt_intro_seen_build','x'); }catch(e){}`;
(async () => {
  await H.seed();
  const store = { categories: [{ id: 'c0', name: 'قسم', order: 0 }], banners: [], offers: [], branches: [{ name: 'فرعنا في حلب', province: 'حلب' }], products: [{ id: 's_1', name: 'منتج الشحن', price: 25, category_id: 'c0', images: [] }] };
  await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-11-12T10:00:00Z', ...store }]);
  const o = await H.open('logo.jpg', { init: VISITOR, w: 412, h: 860, mobile: true, wait: 0 });
  await o.ctx.route(/\/storage\/v1\/object\/public\/products-images\/store\/home\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(store) }));
  await o.pg.goto(H.BASE + 'store.html', { waitUntil: 'domcontentloaded' }); await o.pg.waitForTimeout(6000);
  const pg = o.pg;
  await pg.evaluate(() => { store.cart = [{ id: 's_1', name: 'منتج الشحن', price: 25, qty: 1 }]; renderCartItems(); openModal('cart-modal'); window.__sent = null; window.submitOrder = function (n, p, a) { window.__sent = a; }; });
  const pick = gov => pg.evaluate(g => { const s = document.getElementById('cust-gov'); s.value = g; onGovChange(g); }, gov);
  const st = () => pg.evaluate(() => { const s = document.getElementById('cust-branch-select'); return { groups: [...s.querySelectorAll('optgroup')].map(g => g.label), opts: [...s.options].map(x => x.textContent.trim()), val: s.value, addr: document.getElementById('cust-address').value, info: document.getElementById('cust-office-info').textContent, infoShown: !document.getElementById('cust-office-info').classList.contains('hidden') }; });
  // ① دمشق: المفتي حصراً، والرئيسي (فكتوريا) أوّلاً ومختار
  await pick('دمشق'); let s = await st();
  ok(s.groups.length === 1 && /المفتي/.test(s.groups[0]) && s.opts.length === 7 && /^فكتوريا/.test(s.opts[0]) && /أخرى/.test(s.opts[6]), 'دمشق ⇒ مكاتب المفتي وحدها (6) والرئيسي «فكتوريا» أوّلاً ثمّ «شركة شحن أخرى…»: ' + s.opts.join(' | '));
  ok(!s.opts.some(x => /مسارات|القدموس|بابل|الرافدين/.test(x)) && !s.groups.some(g => /مسارات|القدموس/.test(g)), 'لا تظهر شركة أخرى قبل أن يطلبها الزبون');
  ok(s.addr === 'المفتي — فكتوريا' && s.infoShown && /0965112161/.test(s.info) && /البريد/.test(s.info), 'المكتب الرئيسي مختار تلقائياً، وعنوانه ورقمه يظهران للزبون: ' + s.info.slice(0, 90));
  // ② خيارات أخرى
  await pg.evaluate(() => { const b = document.getElementById('cust-branch-select'); b.value = '__others__'; onBranchSelect(b.value); }); s = await st();
  ok(['مسارات', 'القدموس', 'بابل', 'الرافدين'].every(c => s.groups.some(g => g.indexOf(c) >= 0)) && s.opts.some(x => x === 'توصيل للمنزل') && s.opts.some(x => x === 'إدخال يدوي') && s.opts.some(x => /↩ مكاتب شركة المفتي/.test(x)), '«خيارات أخرى» ⇒ بقية الشركات + التوصيل للمنزل + الإدخال اليدوي + الرجوع للمفتي: ' + s.groups.join(' · '));
  ok(s.addr === '' && await pg.evaluate(() => ![...document.getElementById('cust-branch-select').options].some(x => x.dataset.co === 'المفتي')), 'مكاتب المفتي لا تتكرّر في قائمة الشركات الأخرى، ولا شيء مختار حتى يختار الزبون');
  await pg.evaluate(() => { const b = document.getElementById('cust-branch-select'); b.value = [...b.options].find(x => x.dataset.co === 'مسارات').value; onBranchSelect(b.value); }); s = await st();
  ok(/^مسارات — /.test(s.addr) && /شركة مسارات/.test(s.info), 'اختيار مكتب لمسارات ⇒ يُكتب باسم الشركة: ' + s.addr);
  await pg.evaluate(() => { const b = document.getElementById('cust-branch-select'); b.value = '__primary__'; onBranchSelect(b.value); }); s = await st();
  ok(s.addr === 'المفتي — فكتوريا', 'الرجوع ⇒ مكاتب المفتي ثانيةً');
  // ③ محافظات: طرطوس تجمع بانياس · حلب فيها فرعنا في «الخيارات الأخرى» · الحسكة بلا مفتي ⇒ الخيارات الأخرى مباشرة
  await pick('طرطوس'); s = await st();
  ok(s.opts.some(x => /^بانياس — /.test(x)) && /^مول الحمرات/.test(s.opts[0]), 'طرطوس ⇒ مكاتب المفتي في طرطوس وبانياس والرئيسي أوّلاً: ' + s.opts.slice(0, 6).join(' | '));
  await pick('حلب'); await pg.evaluate(() => { const b = document.getElementById('cust-branch-select'); b.value = '__others__'; onBranchSelect(b.value); }); s = await st();
  ok(s.groups.indexOf('فروعنا') >= 0 && s.opts.indexOf('فرعنا في حلب') >= 0, 'فروع المتجر نفسه باقية ضمن الخيارات الأخرى');
  await pick('الحسكة'); s = await st();
  ok(!s.groups.some(g => /المفتي/.test(g)) && s.groups.some(g => /هافال|الرافدين/.test(g)) && !s.opts.some(x => /↩/.test(x)), 'الحسكة (لا مكتب للمفتي) ⇒ الشركات المتوفّرة مباشرةً: ' + s.groups.join(' · '));
  await pick('دير الزور'); s = await st();
  ok(s.opts.indexOf('توصيل للمنزل') >= 0 && s.opts.indexOf('إدخال يدوي') >= 0, 'محافظة بلا أيّ مكتب ⇒ التوصيل للمنزل والإدخال اليدوي متاحان');
  // ④ الطلب يحمل المحافظة والشركة والمكتب
  await pick('حمص'); await pg.fill('#cust-name', 'زبون الشحن'); await pg.fill('#cust-phone', '0944123123');
  await pg.evaluate(() => processCheckout()); await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => window.__sent) === 'حمص - المفتي — جورة الشياح', 'عنوان الطلب: ' + await pg.evaluate(() => window.__sent));
  const real = o.errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
