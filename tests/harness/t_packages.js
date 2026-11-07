// (TASK-0321 · المالك seq 514) الباقات: إنشاء من الأدمن (منتجات بكمّيات · خصم %) ⇒ تظهر في نقطة البيع وتُباع (مخزون كلّ مكوّن)
// ⇒ تظهر في المتجر وتُضاف للسلّة ⇒ الطلب يُكتب بمكوّناتها بأسعارٍ مجموعها سعر الباقة · «للمتجر وحده» لا تظهر في نقطة البيع.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const dump = () => H.call('/__dump', undefined, 'GET');
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.011;
(async () => {
  await H.seed();
  const [CAM, LENS, BAT] = await H.call('/rest/v1/products', [
    { name: 'كاميرا Canon EOS R50 باقة', barcode: 'PK-R50', price: 700, wholesale_price: 600, net_cost: 550, daraa: 4, image_url: 'https://x.example/r50.jpg' },
    { name: 'عدسة RF 50mm باقة', barcode: 'PK-RF50', price: 200, wholesale_price: 160, net_cost: 140, daraa: 5, image_url: 'https://x.example/rf50.jpg' },
    { name: 'بطارية LP-E17 باقة', barcode: 'PK-E17', price: 30, net_cost: 15, daraa: 10 }]);
  await H.call('/rest/v1/gmt_store', [{ id: 1, categories: [{ id: 'c_bundles', name: 'باقات وعروض', icon: 'ph-package' }, { id: 'c1', name: 'كاميرات' }, { id: 'c_ex', name: 'العروض الحصرية' }], products: [
    { id: 's1', name: 'منتج متجر', price: 10, category_ids: ['c1'], images: [] },
    { id: 's_cam', name: 'كاميرا R50 في المتجر', price: 700, category_ids: ['c1'], images: ['https://x.example/r50-poster.jpg'], inv_id: CAM.id, specs: [{ label: 'الدقة', value: '24MP' }, { label: 'الحربة', value: 'RF' }], description: 'كاميرا خفيفة للمبتدئين — https://evil.example/x' },
    { id: 's_lens', name: 'عدسة RF 50 في المتجر', price: 200, category_ids: ['c1'], images: [] }], banners: [] }]);
  await H.call('/rest/v1/products?id=eq.' + LENS.id, { store_url: '#product=s_lens' }, 'PATCH');

  /* ① الأدمن ينشئ باقة: كاميرا + عدسة + بطاريتان · خصم 10% · نقاط البيع والمتجر */
  console.log('① الإنشاء');
  let { browser, pg, errs } = await H.open('admin_pos.html', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 6000 });
  await pg.waitForFunction(() => !!window.GMTPackages, null, { timeout: 8000 });
  await pg.evaluate(() => openPackageEditor()); await pg.waitForSelector('#gmt-pkg [data-name]'); await pg.waitForTimeout(1200);
  await pg.fill('#gmt-pkg [data-name]', 'باقة صانع المحتوى');
  for (const q of ['R50 باقة', 'RF 50mm', 'LP-E17 باقة']) { await pg.fill('#gmt-pkg [data-q]', q); await pg.waitForTimeout(250); await pg.click('#gmt-pkg [data-res] .ri[data-add]'); await pg.waitForTimeout(150); }
  await pg.click('#gmt-pkg [data-inc="2"]');                       // بطاريتان
  await pg.click('#gmt-pkg [data-m="percent"]'); await pg.fill('#gmt-pkg [data-v]', '10');
  const shown = await pg.evaluate(() => ['[data-s1]', '[data-s2]', '[data-s3]'].map(s => document.querySelector('#gmt-pkg ' + s).textContent));
  ok(shown[0] === '$960.00' && shown[1] === '$864.00' && /96\.00/.test(shown[2]) && /10%/.test(shown[2]), 'المجموع 700+200+2×30 = 960 · خصم 10% ⇒ 864 · توفير 96: ' + shown.join(' | '));
  await pg.click('#gmt-pkg [data-m="amount"]');
  const asAmt = await pg.evaluate(() => [document.querySelector('#gmt-pkg [data-v]').value, document.querySelector('#gmt-pkg [data-s2]').textContent]);
  ok(asAmt[0] === '96' && asAmt[1] === '$864.00', 'التبديل إلى «خصم مبلغ» يحافظ على السعر (96$): ' + asAmt.join(' · '));
  await pg.click('#gmt-pkg [data-m="price"]'); await pg.fill('#gmt-pkg [data-v]', '500');
  ok(/أقلّ من كلفة/.test(await pg.textContent('#gmt-pkg [data-warn]')), 'سعر تحت كلفة المكوّنات (500 < 720) ⇒ تنبيه');
  await pg.click('#gmt-pkg [data-m="percent"]'); await pg.fill('#gmt-pkg [data-v]', '10');
  await pg.waitForSelector('#gmt-pkg [data-cat="c1"]', { timeout: 5000 }); await pg.click('#gmt-pkg [data-cat="c1"]');
  await pg.click('#gmt-pkg [data-save]'); await pg.waitForTimeout(1500);
  let D = await dump(); let off = (D.gmt_offers || []).find(o => o.name === 'باقة صانع المحتوى');
  const items = off ? JSON.parse(off.products) : [];
  ok(off && off.offer_type === 'bundle' && near(off.offer_price, 864) && near(off.original_price, 960) && off.is_active, 'حُفظت في جدول العروض: باقة · 864 بدل 960');
  ok(items.length === 3 && items.find(x => x.id === BAT.id).qty === 2, 'المكوّنات بكمّياتها: ' + items.map(x => x.name + '×' + x.qty).join(' · '));
  ok(off && off.targets && off.targets.pos === true && off.targets.store === true && off.targets.mode === 'percent' && Number(off.targets.value) === 10, 'تظهر في نقاط البيع والمتجر · طريقة السعر محفوظة (خصم 10%)');
  ok(off && JSON.stringify(off.targets.cats) === '["c_bundles","c1"]', 'أقسامها في المتجر كالمنتج: «باقات وعروض» (افتراضياً) + «كاميرات»: ' + JSON.stringify(off && off.targets.cats));
  ok(!(await pg.$('#gmt-pkg')) && /باقة صانع المحتوى/.test(await pg.textContent('#app-content')), 'أُغلقت النافذة والقائمة تعرض الباقة');
  // التعديل: إيقافها مؤقّتاً ثمّ إعادتها
  await pg.evaluate(id => openPackageEditor(id), off.id); await pg.waitForSelector('#gmt-pkg [data-active]'); await pg.waitForTimeout(800);
  ok(await pg.inputValue('#gmt-pkg [data-name]') === 'باقة صانع المحتوى' && (await pg.$$('#gmt-pkg .it')).length === 3 && await pg.inputValue('#gmt-pkg [data-v]') === '10', 'التعديل يفتح بالباقة كما حُفظت');
  await pg.click('#gmt-pkg [data-close]');
  // باقة للمتجر وحده
  await pg.evaluate(() => openPackageEditor()); await pg.waitForSelector('#gmt-pkg [data-name]'); await pg.waitForTimeout(800);
  await pg.fill('#gmt-pkg [data-name]', 'باقة المتجر فقط');
  await pg.fill('#gmt-pkg [data-q]', 'RF 50mm'); await pg.waitForTimeout(250); await pg.click('#gmt-pkg [data-res] .ri[data-add]'); await pg.click('#gmt-pkg [data-inc="0"]');
  await pg.click('#gmt-pkg [data-m="price"]'); await pg.fill('#gmt-pkg [data-v]', '350'); await pg.uncheck('#gmt-pkg [data-pos]');
  await pg.click('#gmt-pkg [data-save]'); await pg.waitForTimeout(1200);
  D = await dump(); const off2 = (D.gmt_offers || []).find(o => o.name === 'باقة المتجر فقط');
  ok(off2 && off2.targets.pos === false && off2.targets.store === true && near(off2.offer_price, 350), 'باقة «للمتجر وحده» (عدستان بـ350)');
  const real1 = errs.filter(x => !/Failed to load resource|status of (400|404|406)/.test(x));
  ok(!real1.length, 'لا أخطاء JS في الأدمن: ' + JSON.stringify(real1.slice(0, 2)));
  await browser.close();

  /* ② نقطة البيع: الباقة تحت «العروض الخاصة» ⇒ بيعها سطراً واحداً */
  console.log('② نقطة البيع');
  ({ browser, pg, errs } = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 7000 }));
  const offs = await pg.evaluate(() => allProducts.filter(p => p._is_offer).map(p => ({ id: p.id, name: p.name, price: p.price, q: p.daraa })));
  const po = offs.find(x => /صانع المحتوى/.test(x.name));
  ok(po && near(po.price, 864) && po.q === 4, 'الباقة في نقطة البيع بسعر 864 · متاح 4 (أقلّ المكوّنات: الكاميرا 4 · البطارية 10÷2 = 5): ' + JSON.stringify(po));
  ok(!offs.some(x => /المتجر فقط/.test(x.name)), 'باقة «للمتجر وحده» لا تظهر في نقطة البيع');
  /* (المالك seq 565) ضغطةٌ واحدة ⇒ الباقة سطراً واحداً فوراً — بلا سؤال */
  await pg.evaluate(id => { newInvoice(); toggleProd(id); }, po.id); await pg.waitForTimeout(400);
  const oneTap = await pg.evaluate(id => ({ dlg: !!document.getElementById('gmt-offer-choice'), line: !!(cart[id] && cart[id]._is_offer && cart[id].qty === 1) }), po.id);
  ok(!oneTap.dlg && oneTap.line, 'ضغطةٌ واحدة على الباقة ⇒ سطرٌ واحد في السلّة فوراً بلا سؤال ' + JSON.stringify(oneTap));
  await pg.evaluate(() => { document.getElementById('custName').value = 'زبون الباقة'; saleType = 'نقدي'; });
  await pg.evaluate(() => saveAndFinish()); await pg.waitForTimeout(2500);
  D = await dump();
  const inv = D.invoices.find(i => i.customer_name === 'زبون الباقة');
  const its = inv ? D.invoice_items.filter(x => x.invoice_id === inv.id) : [];
  ok(inv && near(inv.total, 864), 'الفاتورة 864');
  ok(its.length === 3 && near(its.reduce((s, x) => s + Number(x.total), 0), 864) && its.every(x => /ضمن «/.test(x.product_name)), 'بنودها مكوّنات الباقة ومجموعها 864: ' + its.map(x => x.product_name + ' ' + x.qty + '×' + x.unit_price).join(' | '));
  const st = id => Number((D.products.find(p => p.id === id) || {}).daraa);
  ok(st(CAM.id) === 3 && st(LENS.id) === 4 && st(BAT.id) === 8, 'المخزون خُصم لكلّ مكوّن: كاميرا 4⇐3 · عدسة 5⇐4 · بطارية 10⇐8');
  await browser.close();

  /* ③ المتجر: قسم «الباقات» + داخل قسم «كاميرات» ⇒ صفحة التفاصيل ⇒ السلّة ⇒ الطلب بمكوّناتها */
  console.log('③ المتجر');
  // باقة قديمة: مكوّناتها بلا أسعار ولا صور (كما في القاعدة الحقيقية) ⇒ تُكمَل من الجرد
  await H.call('/rest/v1/gmt_offers', { name: 'باقة قديمة', offer_type: 'bundle', offer_price: 800, original_price: 1000, is_active: true, targets: { site: true, store: true },
    products: JSON.stringify([{ id: CAM.id, name: 'كاميرا Canon EOS R50 باقة', qty: 1 }, { id: LENS.id, name: 'عدسة RF 50mm باقة', qty: 1 }]) });
  ({ browser, pg, errs } = await H.open('store.html', { init: H.STAFF_INIT + ';window.open=function(u){(window.__op=window.__op||[]).push(String(u));return null;};', w: 390, mobile: true, wait: 7000 }));
  const sec = await pg.evaluate(() => { const a = document.querySelector('[data-container="products-area"]'), h = a.querySelector('section[data-category-section="c_bundles"]'), secs = [...a.querySelectorAll('section[data-category-section]')].map(x => x.dataset.categorySection);
    return h ? { txt: h.innerText.replace(/\s+/g, ' '), cards: h.querySelectorAll('[data-pkg]').length, w: (h.querySelector('[data-pkg]') || {}).offsetWidth || 0, emoji: /[\u{1F300}-\u{1FAFF}]/u.test(h.innerText), order: secs, blk: document.querySelector('[data-container="packages-area"]').innerHTML.trim() } : null; });
  ok(sec && sec.cards === 3 && /^باقات وعروض/.test(sec.txt) && !sec.emoji, 'قسم المتجر «باقات وعروض» فيه الباقات الثلاث (كقسمٍ عادي · بلا إيموجي): ' + (sec && sec.cards));
  ok(sec && sec.order.indexOf('c_bundles') < sec.order.indexOf('c1') && sec.blk === '', 'في موضعه بين الأقسام (قبل «كاميرات») — ولا كتلة منفصلة فوق المتجر: ' + (sec && sec.order.join(',')));
  ok(sec && sec.w === 160, 'كرت الباقة بحجم كرت المنتج (160px): ' + (sec && sec.w));
  const card = await pg.evaluate(() => [...document.querySelectorAll('[data-category-section="c_bundles"] [data-pkg]')].map(c => c.innerText.replace(/\s+/g, ' ')).find(t => /صانع/.test(t)) || '');
  ok(/\$864\.00/.test(card) && /\$960\.00/.test(card) && /-10%/.test(card) && /4 منتجات/.test(card), 'الكرت: السعر · قبل الخصم · -10% · عدد المنتجات: ' + card);
  const inCat = await pg.evaluate(() => { const s = document.querySelector('[data-container="products-area"] section[data-category-section="c1"]'); return s ? [...s.querySelectorAll('[data-pkg]')].map(c => c.innerText.replace(/\s+/g, ' ')) : null; });
  ok(inCat && inCat.length === 1 && /صانع/.test(inCat[0]), 'والباقة نفسها في قسم «كاميرات» أيضاً (أوّل الصفّ)');
  await pg.click('[data-category-section="c_bundles"] [data-pkg]:has-text("صانع")'); await pg.waitForTimeout(600);
  const det = await pg.evaluate(() => { const c = document.getElementById('package-content'); return { txt: c.innerText.replace(/\s+/g, ' '), rows: c.querySelectorAll('[role="button"]').length, imgs: [...c.querySelectorAll('.border-b img')].map(i => i.getAttribute('src')), open: document.getElementById('package-modal').classList.contains('active') }; });
  ok(det.open && /قبل الخصم \$960\.00/.test(det.txt) && /الخصم \$96\.00/.test(det.txt) && /\(10%\)/.test(det.txt) && /سعر الباقة \$864\.00/.test(det.txt), 'التفاصيل: قبل الخصم 960 · الخصم 96 (10%) · سعر الباقة 864');
  ok(/منتجات الباقة \(3\)/.test(det.txt) && /\$30\.00 × 2 = \$60\.00/.test(det.txt) && /مجموع أسعار المنتجات \$960\.00/.test(det.txt), 'كلّ المنتجات (3) بأسعارها والكمّية والمجموع: ' + det.txt.slice(det.txt.indexOf('منتجات الباقة'), det.txt.indexOf('منتجات الباقة') + 220));
  ok(det.imgs.includes('https://x.example/r50-poster.jpg') && det.imgs.includes('https://x.example/rf50.jpg'), 'صور المنتجات (صورة المتجر أوّلاً ثمّ صورة الجرد): ' + det.imgs.join(' · '));
  ok(det.rows === 2, 'المنتجان الموجودان في المتجر قابلان للضغط إلى صفحتيهما (2)');
  await pg.click('#package-content [role="button"] >> nth=0'); await pg.waitForTimeout(900);
  const pm = await pg.evaluate(() => ({ open: document.getElementById('product-modal').classList.contains('active'), name: document.getElementById('product-modal-name').textContent }));
  ok(pm.open && /R50 في المتجر/.test(pm.name), 'الضغط على منتجٍ في الباقة يفتح صفحته في المتجر: ' + pm.name);
  // زرّا جوجل للزائر في صفحة المنتج
  /* (seq 519) العدسة: بطاقة صورةٍ فيها صور المنتج ومواصفاتنا تُرفع ثمّ تُفتح العدسة عليها */
  const up = []; const cx = pg.context();
  await cx.route(/x\.example\/.*\.jpg/, r => r.fulfill({ status: 200, contentType: 'image/jpeg', headers: { 'Access-Control-Allow-Origin': '*' }, body: require('fs').readFileSync(__dirname + '/../../img/products/owner/lensgo_smoke_go.jpg') }));
  await cx.route('**/storage/v1/object/**', r => { const q = r.request(); if (q.method() === 'HEAD') return r.fulfill({ status: 404, body: '' }); up.push({ url: q.url(), n: (q.postDataBuffer() || Buffer.alloc(0)).length, type: q.headers()['content-type'] }); return r.fulfill({ status: 200, contentType: 'application/json', body: '{"Key":"ok"}' }); });
  await pg.evaluate(async () => { window.__op = []; gmtAskGoogle(); await gmtGoogleLens(); });
  const op = await pg.evaluate(() => window.__op);
  const lcard = await pg.evaluate(async () => { const b = await _gmtLensCard(_gmtProdData()); return await new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); }); });
  require('fs').writeFileSync(require('path').join(require('os').tmpdir(), 'lens_card.jpg'), Buffer.from(lcard.split(',')[1], 'base64'));   // (كان مسار جلسةٍ أخرى ثابتاً فيفشل في غيرها)
  ok(up.length === 1 && /products-images\/lens\/s_cam-[a-z0-9]+\.jpg$/.test(up[0].url) && up[0].type === 'image/jpeg' && up[0].n > 20000, '«عدسة جوجل» ترفع بطاقة المنتج (صوره + مواصفاتنا) صورةً واحدة: ' + (up[0] && up[0].url.replace(/^.*object\//, '') + ' · ' + Math.round(up[0].n / 1024) + 'KB'));
  const q = op[0] ? decodeURIComponent(new URL(op[0]).searchParams.get('q') || '') : '';
  ok(/^https:\/\/www\.google\.com\/search\?udm=50/.test(op[0] || '') && /R50 في المتجر من متجر General Media Tech/.test(q) && /مواصفاته: الدقة: 24MP، الحربة: RF/.test(q) && /كاميرا خفيفة للمبتدئين/.test(q) && /ما مزايا هذا المنتج/.test(q) && !/https?:|لا تضف|اعتماداً فقط/.test(q) && op[0].length < 3000, '«اسأل جوجل» يفتح جوجل في متصفّح الزائر بسؤالٍ طبيعيّ قصير من بياناتنا — بلا أوامر ولا روابط (ما يُظهر تحذير جوجل): ' + q);
  ok(/^https:\/\/lens\.google\.com\/uploadbyurl\?.*products-images\/lens\/s_cam-/.test(decodeURIComponent(op.find(u => /lens\.google/.test(u)) || '')), '… وتفتح عدسة جوجل على تلك البطاقة في متصفّح الزائر');
  await pg.evaluate(() => closeModal('product-modal'));
  // الباقة القديمة: أسعار وصور من الجرد
  const old = await pg.evaluate(() => { const p = store.packages.find(x => x.name === 'باقة قديمة'); return p && { orig: p.original, prices: p.items.map(x => x.price), imgs: p.items.map(x => !!x.image_url) }; });
  ok(old && old.orig === 900 && old.prices.join() === '700,200' && old.imgs.every(Boolean), 'باقة قديمة بلا أسعار ولا صور ⇒ تُكمَل من الجرد (قبل الخصم = 700+200): ' + JSON.stringify(old));
  const pid = await pg.evaluate(() => store.packages.find(p => /صانع/.test(p.name)).id);
  await pg.click(`[data-category-section="c_bundles"] [data-pkg-add="${pid}"]`); await pg.waitForTimeout(300);
  const cart = await pg.evaluate(() => store.cart.map(i => ({ n: i.name, p: i.price, q: i.qty, k: (i.package_items || []).length })));
  ok(cart.length === 1 && near(cart[0].p, 864) && cart[0].k === 3 && !/📦/.test(cart[0].n), 'في السلّة سطرٌ واحد: الباقة بـ864 ومعها مكوّناتها (بلا إيموجي)');
  await pg.evaluate(() => submitOrder('زبون باقة المتجر', '0933123123', 'حلب', '', 'cod')); await pg.waitForTimeout(2500);
  D = await dump();
  const ord = (D.gmt_orders || []).find(o => o.name === 'زبون باقة المتجر');
  const oi = ord ? JSON.parse(ord.items_json || '[]') : [];
  ok(ord && /باقة صانع المحتوى/.test(ord.product) && /LP-E17 باقة ×2/.test(ord.product), 'نصّ الطلب يذكر الباقة ومكوّناتها: ' + (ord && ord.product));
  ok(oi.length === 3 && near(oi.reduce((s, x) => s + x.price * x.qty, 0), 864) && oi.every(x => x.product_id), 'بنود الطلب = المكوّنات مربوطةً بالجرد ومجموعها 864: ' + oi.map(x => x.name.slice(0, 18) + ' ' + x.qty + '×' + x.price).join(' | '));
  ok(ord && near(ord.price, 864 + await pg.evaluate(() => DELIVERY_FEE)), 'إجمالي الطلب = 864 + التوصيل');
  // باقة انتهت وهي في سلّة قديمة ⇒ تُزال قبل الإرسال
  await H.call('/rest/v1/gmt_offers?id=eq.' + off2.id, { is_active: false }, 'PATCH');
  await pg.evaluate(() => { store.cart = [{ _cartId: 'pkg_x', id: 'pkg_x', name: 'باقة المتجر فقط', price: 350, qty: 1, package_items: [{ id: 'a', name: 'a', qty: 2, price: 200 }] }]; });
  await pg.evaluate(id => { store.cart[0].offer_id = id; }, off2.id);
  await pg.evaluate(() => submitOrder('زبون باقة منتهية', '0933123124', 'حلب', '', 'cod')); await pg.waitForTimeout(2000);
  D = await dump();
  ok(!(D.gmt_orders || []).some(o => o.name === 'زبون باقة منتهية') && await pg.evaluate(() => store.cart.length) === 0, 'باقةٌ أُوقفت وهي في سلّة قديمة ⇒ تُزال ولا يُرسَل طلبٌ بها');
  const real3 = errs.filter(x => !/Failed to load resource|status of (400|404|406)/.test(x));
  ok(!real3.length, 'لا أخطاء JS في المتجر: ' + JSON.stringify(real3.slice(0, 2)));
  await browser.close();
  console.log(fails ? 'FAIL ' + fails + ' / ' + (pass + fails) : 'ALL PASS (' + pass + ')');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
