// (TASK-0246 · 0238 · 0249 · المالك seq 164 · 167)
// ① «لما عبي بيانات تلقائيا لزبون قديم … عم يحط عنوان مكتب شحن … لكن ما عم يختار الشركه» ⇒ الشركة تُحدَّد مع المكتب
// ② «اذا في غير عنوان مره عن مره … يسالني نستخدم العنوان القديم ام الجديد وهل هذه المره فقط ولا نسيف العنوان الجديد ونحذف القديم»
// ③ «هذه محصله مسبقا لماذا يكتب لي تم التحصيل او الحواله؟»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const custs = () => H.call('/__dump', undefined, 'GET').then(d => d.gmt_customers || []);
const ordersOf = n => H.call('/rest/v1/gmt_orders?select=*&name=eq.' + encodeURIComponent(n), undefined, 'GET');
(async () => {
  await H.seed();
  const base = { qty: 1, branch: 'حلب', product: 'كاميرا', price: 100 };
  await H.call('/rest/v1/gmt_orders', [
    Object.assign({ name: 'سليم المحمد', phone: '0933700001', address: 'حمص', shipping_company: 'القدموس', status: 'completed', created_at: '2026-10-01T10:00:00Z' }, base),
    Object.assign({ name: 'زبون مدفوع', phone: '0933700005', address: 'دمشق', shipping_company: 'المفتي', status: 'shipped', collect_amount: 0, ship_from_office: 'حلب|الفرقان' }, base),
    Object.assign({ name: 'قديم بانتظار', phone: '0933700006', address: 'دمشق', shipping_company: 'المفتي', status: 'delivered', collect_amount: 0, ship_from_office: 'حلب|الفرقان' }, base),
    Object.assign({ name: 'عادي بانتظار', phone: '0933700007', address: 'دمشق', shipping_company: 'المفتي', status: 'delivered', ship_from_office: 'حلب|الفرقان' }, base)]);
  await H.call('/rest/v1/gmt_customers', [{ name: 'ريم الأحمد', phone: '0933700002', address: 'دمشق - المزة', branch_key: 'haleb' }]);
  const { browser, pg, errs } = await H.open('orders.html', { w: 390, h: 844, wait: 5000, init: H.ADMIN_INIT });
  await pg.evaluate(() => { window.open = () => ({ closed: false, close() {} }); });
  // ① اختيار زبونٍ قديم ⇒ الشركة تُحدَّد
  await pg.evaluate(() => { document.getElementById('addModal').classList.remove('hidden'); initAddModal(); });
  await pg.fill('#in-name', 'سليم'); await pg.evaluate(() => custSuggest('سليم'));
  await pg.waitForSelector('#in-name-sug:not(.hidden) button', { timeout: 6000 }).catch(() => {});
  await pg.evaluate(() => pickCust(0)); await sleep(300);
  const p1 = await pg.evaluate(() => ({ co: document.getElementById('in-company').value, addr: document.getElementById('in-addr').value, auto: document.getElementById('in-company').dataset.auto }));
  ok(p1.co === 'القدموس' && /حمص/.test(p1.addr) && p1.auto === '1', 'زبونٌ قديم ⇒ شركة آخر أوردرٍ له تُحدَّد مع المكتب (تلقائياً — تبقى قابلةً للتغيير): ' + JSON.stringify(p1));
  // ② العنوان القديم أم الجديد
  const fill = async (addr) => pg.evaluate(addr => {
    initAddModal();
    document.getElementById('in-name').value = 'ريم الأحمد'; document.getElementById('in-phone').value = '0933700002'; document.getElementById('in-addr').value = addr;
    const row = document.querySelector('#add-items-container .item-row');
    const nm = row.querySelector('[data-field="name"]'); nm.value = 'عدسة'; try { nm.dataset.confirmed = '1'; row.dataset.confirmed = '1'; } catch (_) {}
    document.getElementById('in-price').value = '50';
    try { window.blockIfUnconfirmed = () => false; } catch (_) {}
  }, addr);
  const answer = k => pg.evaluate(k => { window.__asked = []; GMTAsk.choose = async (msg, o) => { __asked.push({ msg, t: o && o.title, ch: (o.choices || []).map(c => c.t) }); return k; }; }, k);
  await answer('new_once'); await fill('حلب - الفرقان'); await pg.evaluate(() => document.getElementById('saveBtn').click()); await sleep(2500);
  let q = await pg.evaluate(() => window.__asked);
  let o = (await ordersOf('ريم الأحمد')).slice(-1)[0], c = (await custs()).find(x => x.phone === '0933700002');
  ok(q.length === 1 && /القديم: دمشق - المزة/.test(q[0].msg) && /الجديد: حلب - الفرقان/.test(q[0].msg) && JSON.stringify(q[0].ch) === JSON.stringify(['الجديد — لهذه المرّة فقط', 'الجديد — واحفظه بدل القديم', 'القديم']),
    'زبونٌ معروف بعنوانٍ مختلف ⇒ سؤال: القديم أم الجديد · لهذه المرّة فقط أم يُحفظ بدل القديم: ' + JSON.stringify(q[0] && q[0].ch));
  ok(o && o.address === 'حلب - الفرقان' && /عنوانٌ لهذه المرّة فقط/.test(o.notes || '') && c && c.address === 'دمشق - المزة', '«لهذه المرّة فقط» ⇒ الأوردر بالجديد · سجلّ الزبون بقي على القديم: ' + JSON.stringify([o && o.address, c && c.address]));
  await answer('new_save'); await fill('حلب - السريان'); await pg.evaluate(() => document.getElementById('saveBtn').click()); await sleep(2500);
  c = (await custs()).find(x => x.phone === '0933700002');
  ok(c && c.address === 'حلب - السريان', '«احفظه بدل القديم» ⇒ سجلّ الزبون صار بالجديد: ' + (c && c.address));
  await answer('old'); await fill('اللاذقية'); await pg.evaluate(() => document.getElementById('saveBtn').click()); await sleep(2500);
  o = (await ordersOf('ريم الأحمد')).slice(-1)[0];
  ok(o && o.address === 'حلب - السريان', '«القديم» ⇒ الأوردر بالعنوان المحفوظ: ' + (o && o.address));
  await answer('new_once'); await fill('حلب - السريان'); await pg.evaluate(() => document.getElementById('saveBtn').click()); await sleep(2500);
  ok((await pg.evaluate(() => window.__asked.length)) === 0, 'نفس العنوان المحفوظ ⇒ لا سؤال');
  // ③ المحصَّل مسبقاً
  await pg.evaluate(() => { closeModal('addModal'); });
  const all = await H.call('/rest/v1/gmt_orders?select=id,name,status', undefined, 'GET');
  const idOf = n => all.find(x => x.name === n).id;
  await pg.evaluate(() => loadOrders ? loadOrders() : null).catch(() => {}); await sleep(1500);
  await pg.evaluate(() => switchTab('delivered')); await sleep(400);
  const cards = await pg.evaluate(ids => ids.map(id => { const c = document.getElementById('card-' + id); return c ? { t: c.innerText, prepaid: !!c.querySelector('[data-prepaid-done]') } : null; }), [idOf('قديم بانتظار'), idOf('عادي بانتظار')]);
  ok(cards[0] && cards[0].prepaid && !/تم التحصيل/.test(cards[0].t) && !/الحوالة/.test(cards[0].t), 'محصَّلٌ مسبقاً في «بانتظار التحصيل» ⇒ «✅ إنهاء — محصَّل مسبقاً» بلا «تم التحصيل» ولا «الحوالة»');
  ok(cards[1] && !cards[1].prepaid && /تم التحصيل/.test(cards[1].t) && /الحوالة/.test(cards[1].t), 'العاديّ (له مبلغٌ للتحصيل) ⇒ «تم التحصيل» و«الحوالة» كما كانا');
  await pg.evaluate(id => { requestConfirm(id, 'delivered'); }, idOf('زبون مدفوع')); await sleep(300);
  await pg.evaluate(() => { const b = [...document.querySelectorAll('#confirmModal button')].find(x => /executeConfirm/.test(x.getAttribute('onclick') || '')); b && b.click(); }); await sleep(1800);
  const st = (await ordersOf('زبون مدفوع'))[0].status;
  ok(st === 'completed', 'تأكيد استلام المحصَّل مسبقاً ⇒ يكتمل مباشرةً (لا «بانتظار التحصيل»): ' + st);
  const real = errs.filter(e => !/status of (400|401|404|406|409)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
