// (TASK-A0527 · المالك seq 878–879) «الأوردرات الذكية»: تبويب «📍 تم الوصول» يُفرز وحده من حالة شركة الشحن المحفوظة (carrier_live)
// بثلاثة أقسام (بانتظار التبليغ · بُلّغ · استلمها) + الحوالة لكلّ أوردر ومجاميعها + «افحص الآن» يحفظ ما تغيّر فقط + بديل GMTAsk المبكّر
const H = require('./h.js');
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fails++; };
const CL = (cls, extra) => Object.assign({ cls, level: { road: 2, branch: 3, got: 4, ret: 3 }[cls] || 0, status: cls === 'ret' ? 'تمت إعادة التوجيه' : 'حالة', status_at: '20-11-2026 16:09', checked_at: new Date().toISOString(), changed_at: new Date(Date.now() - 2 * 86400000).toISOString() }, extra || {});
(async () => {
  await H.seed();
  const base = { phone: '0933000111', product: 'كاميرا', qty: 1, branch: 'حلب', address: 'حمص', status: 'shipped', shipping_company: 'المفتي', shipped_at: new Date(Date.now() - 3 * 86400000).toISOString() };
  const rows = await H.call('/rest/v1/gmt_orders', [
    Object.assign({}, base, { name: 'أ وصلت بلا تبليغ', price: 100, tracking_number: '1000001', carrier_live: CL('branch', { receiver: 'سمير الحلبي', status: 'تم وصول الشحنة إلى الفرع الوجهة' }) }),
    Object.assign({}, base, { name: 'ب وصلت وبُلّغ', price: 61, collect_amount: 50, tracking_number: '1000002', notified_arrival_at: new Date().toISOString(), carrier_live: CL('branch') }),
    Object.assign({}, base, { name: 'ج استلمها', price: 655, tracking_number: '1000003', carrier_live: CL('got') }),
    Object.assign({}, base, { name: 'د على الطريق', price: 40, tracking_number: '1000004', carrier_live: CL('road') }),
    Object.assign({}, base, { name: 'هـ مرتجع عند الشركة', price: 30, tracking_number: '1000005', carrier_live: CL('ret') }),
    Object.assign({}, base, { name: 'و القدموس بُلّغ يدوياً', price: 20, shipping_company: 'القدموس', tracking_number: 'Q77', notified_arrival_at: new Date().toISOString() }),
    Object.assign({}, base, { name: 'ز لم يُفحص', price: 15, tracking_number: '1000007' }),
    Object.assign({}, base, { name: 'ح سات وصل مدينتك', price: 44, shipping_company: 'سات', tracking_number: 'SAT482100001', carrier_live: CL('branch', { provider: 'sat', steps: ['استلمناه', 'في الطريق', 'وصل مدينتك · مع المندوب', 'وصلك'], status: 'وصل طردك إلى دمشق' }) }),
    Object.assign({}, base, { name: 'ط بابل في الطريق', price: 33, shipping_company: 'بابل', tracking_number: 'B77001' }),
  ]);
  const id = n => rows.find(r => r.name.startsWith(n)).id;
  const { browser, pg, errs } = await H.open('orders.html', { init: H.ADMIN_INIT, wait: 4500 });
  pg.on('response', r => { if (r.status() >= 400) console.log('   [' + r.status() + '] ' + r.request().method() + ' ' + r.url().replace(/^https?:\/\/[^/]+/, '').slice(0, 140)); });
  // ١) الأقسام
  await pg.evaluate(() => switchTab('arrived'));
  await pg.waitForTimeout(400);
  const where = await pg.evaluate(() => { const o = {}; ['notify', 'wait'].forEach(k => { o[k] = [...document.querySelectorAll('#list-arr-' + k + ' .order-card')].map(c => c.id.replace('card-', '')); }); return o; });
  await pg.evaluate(() => switchTab('got')); await pg.waitForTimeout(300);
  where.got = await pg.evaluate(() => [...document.querySelectorAll('#list-got .order-card')].map(c => c.id.replace('card-', '')));
  await pg.evaluate(() => switchTab('arrived')); await pg.waitForTimeout(300);
  ok(where.notify.includes(String(id('أ'))) && where.notify.includes(String(id('ح'))) && where.notify.length === 2, '🔴 «وصلت — بانتظار التبليغ» = أ (المفتي) + ح (سات): ' + JSON.stringify(where.notify));
  ok(where.wait.includes(String(id('ب'))) && where.wait.includes(String(id('و'))) && where.wait.length === 2, '🟠 «بُلّغ» = ب + القدموس المبلَّغ يدوياً: ' + JSON.stringify(where.wait));
  ok(where.got.length === 1 && where.got[0] === String(id('ج')), '(seq 892) تبويبٌ مستقلّ «✅ استلمها الزبون» = ج');
  /* (seq 892) الأحمر = عملٌ ينتظرك */
  const bd = await pg.evaluate(() => { const g = id => { const e = document.getElementById(id); return { n: e.textContent.trim(), red: /bg-red-600/.test(e.className) }; }; return { arr: g('badge-arrived'), got: g('badge-got') }; });
  ok(bd.arr.n === '2' && bd.arr.red, '«📍 وصلت» شارة حمراء = 2 لم يُبلَّغ زبونهما: ' + JSON.stringify(bd.arr));
  ok(bd.got.n === '1' && bd.got.red, '«✅ استلمها الزبون» شارة حمراء = 1: ' + JSON.stringify(bd.got));
  const bar = await pg.evaluate(() => { const b = document.getElementById('action-bar'); return b && !b.classList.contains('hidden') ? b.textContent.replace(/\s+/g, ' ') : ''; });
  ok(/المطلوب منك الآن/.test(bar) && /2\s*وصلت — بلّغ الزبون/.test(bar) && /1\s*استلمها الزبون — أكّد الاستلام/.test(bar) && /\$655/.test(bar) && /1\s*صارت مرتجعاً/.test(bar), 'شريط «المطلوب منك الآن»: وصلت ٢ · استلمها ١ ($655) · مرتجع ١: ' + bar.slice(0, 200));
  const rib = await pg.evaluate(ids => ids.map(id => ((document.querySelector('#card-' + id + ' [data-red-ribbon]') || {}).textContent || '')), [id('أ'), id('ب')]);
  ok(/جديد — بلّغ الزبون/.test(rib[0]) && !rib[1], 'شريطٌ أحمر على البطاقة التي لم يُبلَّغ زبونها فقط: ' + JSON.stringify(rib));
  await pg.evaluate(() => switchTab('shipped')); await pg.waitForTimeout(300);
  const ship = await pg.evaluate(() => [...document.querySelectorAll('#list-shipped .order-card')].map(c => c.id.replace('card-', '')));
  ok(ship.includes(String(id('د'))) && ship.includes(String(id('هـ'))) && ship.includes(String(id('ز'))) && ship.includes(String(id('ط'))) && ship.length === 4, '«في الطريق» = الطريق + المرتجع (للتنبيه) + غير المفحوص فقط: ' + JSON.stringify(ship));
  ok(await pg.evaluate(id => { const c = document.getElementById('card-' + id); return !!(c && c.querySelector('[data-ret-btn]') && /جديد|مرتجع عند الشركة/.test((c.querySelector('[data-red-ribbon]') || {}).textContent || '')); }, id('هـ')), '(seq 892) أعادتها الشركة: شريطٌ أحمر والزرّ الأساسي «أنشئ مرتجعاً» لا «تأكيد الاستلام»');
  // ٢) الحوالة والشارات
  const chip = await pg.evaluate(id => { const c = document.getElementById('card-' + id); return { h: (c.querySelector('[data-hawala]') || {}).textContent || '', k: (c.querySelector('[data-carrier]') || {}).textContent || '' }; }, id('هـ'));
  ok(/الحوالة \$30/.test(chip.h) && /مرتجع/.test(chip.k), 'بطاقة المرتجع: «⚠️ الشركة: مرتجع» + «💵 الحوالة $30»: ' + chip.k + ' | ' + chip.h);
  await pg.evaluate(() => switchTab('arrived')); await pg.waitForTimeout(300);
  const sums = await pg.evaluate(() => ({ n: document.getElementById('sum-arr-wait').textContent, all: document.getElementById('arr-sum').textContent, b: (document.querySelector('#list-arr-wait [data-carrier]') || {}).textContent || '' }));
  ok(/\$70/.test(sums.n), 'مجموع «بُلّغ» = 50 (المطلوب تحصيله لا القيمة) + 20 = $70: ' + sums.n);
  ok(/\$214/.test(sums.all), 'مجموع الحوالات في «📍 وصلت» = 100+50+20+44 = $214 (المستلَمة في تبويبها): ' + sums.all);
  ok(/منذ 2 أيام/.test(sums.b), '«في فرع الوجهة منذ 2 أيام» من changed_at: ' + sums.b);
  // ٢ب) (المالك seq 881 ⇐ 884) أداة المراجعة مدموجة في البطاقة — **الشريط قبل الوصول فقط**؛ بعده سطرٌ واحد صغير (نخفّف العجقة)
  /* (المالك seq B1041 «نرجع شريط الحاله ولكن بشكل اصغر على بطاقه الاوردر») الشريط الكبير ⇐ شريطٌ صغير على كلّ بطاقة نشطة */
  const road = await pg.evaluate(id => { const c = document.getElementById('card-' + id), f = c.querySelector('[data-carrier-full]'), m = c.querySelector('.ord-mini');
    return { full: !!f, big: c.querySelectorAll('.ml-st').length, mini: m ? m.querySelectorAll('span').length : 0, cur: m ? (m.querySelector('.om-c') || {}).textContent || '' : '', h: m ? parseFloat(getComputedStyle(m.querySelector('i')).height) + parseFloat(getComputedStyle(m.querySelector('span')).fontSize) : 0, card: f ? !!f.querySelector('.ml-card') : false }; }, id('د'));
  ok(road.full && road.card && road.big === 0 && road.mini === 5 && road.cur === 'بالطريق' && road.h > 0 && road.h < 18, 'على الطريق: الشريط الصغير (٥ مراحل · الحالية «بالطريق» · خطّ + نصّ ≈' + Math.round(road.h) + 'px) + «حالة الشحنة» بلا الشريط الكبير: ' + JSON.stringify(road));
  const lv = await pg.evaluate(ids => ids.map(id => { const m = document.querySelector('#card-' + id + ' .ord-mini'); return m ? m.dataset.miniLevel + ':' + ((m.querySelector('.om-c') || {}).textContent || '') : ''; }), [id('أ'), id('ح'), id('ج')]);
  ok(lv[0] === '4:وصل الفرع' && lv[1] === '4:وصل الفرع' && lv[2] === '5:استلمها', 'بعد الوصول: الشريط الصغير «وصل الفرع» (المفتي · سات) و«استلمها»: ' + JSON.stringify(lv));
  const arr = await pg.evaluate(ids => ids.map(id => { const c = document.getElementById('card-' + id); return { full: !!c.querySelector('[data-carrier-full]'), chip: (c.querySelector('[data-carrier]') || {}).textContent || '', diff: !!c.querySelector('[data-name-diff]') }; }), [id('أ'), id('ح'), id('ج')]);
  ok(arr.every(x => !x.full), 'بعد الوصول (المفتي · سات · استلمها): لا «حالة الشحنة» الكاملة — سطر واحد');
  ok(/في فرع الوجهة/.test(arr[0].chip) && /الحوالة \$100/.test(arr[0].chip) && arr[0].diff, 'المفتي وصلت: «📍 في فرع الوجهة» + الحوالة + ⚠️ اسم المستلم عندهم مختلف: ' + arr[0].chip);
  ok(/وصلت مدينة الوجهة/.test(arr[1].chip), 'سات (توصيل للباب): «📍 وصلت مدينة الوجهة»: ' + arr[1].chip);
  ok(/استلمها الزبون/.test(arr[2].chip), 'استلمها: «✅ استلمها الزبون»: ' + arr[2].chip);
  ok(await pg.evaluate(() => !document.querySelector('[data-mr-launch]') && !!document.querySelector('button[data-carrier-now]') && /تحديث فوري الآن/.test(document.querySelector('button[data-carrier-now]').textContent)), '(seq 884) زرّ «مراجعة شحنات المفتي» استُبدل بـ«⟳ تحديث فوري الآن» لكلّ الشركات');
  const carrierCalls = [];
  await pg.route('**/functions/v1/gmt-carrier', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 200, body: 'ok' });
    const b = JSON.parse(route.request().postData() || '{}'); carrierCalls.push(b.company + ':' + b.nums.join(','));
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, out: b.nums.map(n => b.company === 'babel' ? { n, ok: true, found: true, level: 3, status: 'خرجت للتسليم', steps: ['تكوين الشحنة', 'ضمن النقل', 'خرجت للتسليم', 'تم التسليم'].map((l, i) => ({ label: l, active: i === 2 })) } : { n, ok: true, found: true, level: 3, status: 'وصل طردك إلى دمشق', steps: [] }) }) });
  });
  // ٣) «افحص الآن»: يحفظ ما تغيّر فقط، بلا سجلّ تراجع
  const patches = [];
  pg.on('request', r => { if (r.method() === 'PATCH' && /gmt_orders/.test(r.url())) patches.push(r.url()); });
  await pg.route('**/functions/v1/gmt-mufti', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 200, body: 'ok' });
    const b = JSON.parse(route.request().postData() || '{}');
    const st = { '1000004': { level: 3, status: 'تم وصول الشحنة إلى الفرع الوجهة' }, '1000007': { level: 2, status: 'على الطريق' } };
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, out: b.nums.map(n => {
      const cur = { '1000001': [3, 'تم وصول الشحنة إلى الفرع الوجهة'], '1000002': [3, 'حالة'], '1000003': [4, 'حالة'], '1000005': [3, 'تمت إعادة التوجيه'] }[n];
      const s = st[n] || (cur ? { level: cur[0], status: cur[1] } : { level: 0, status: '' });
      return { n, ok: true, found: true, steps: [], level: s.level, status: s.status, status_at: '21-11-2026 10:00' }; }) }) });
  });
  const undoBefore = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem(OU_LS) || '[]').length; } catch (_) { return -1; } });
  await pg.evaluate(() => carrierCheckNow(true));
  await pg.waitForTimeout(800);
  ok(patches.length === 3, 'حُفظ ما تغيّر فقط: د وصل · ز فُحص أوّل مرّة · ط (بابل) خرجت للتسليم — لا التسعة: ' + patches.length);
  ok(carrierCalls.includes('babel:B77001') && carrierCalls.includes('sat:SAT482100001'), 'سات وبابل تُفحصان عبر gmt-carrier كلٌّ بشركته: ' + carrierCalls.join(' | '));
  const where2 = await pg.evaluate(() => [...document.querySelectorAll('#list-arr-notify .order-card')].map(c => c.id.replace('card-', '')));
  ok(where2.includes(String(id('د'))), 'د انتقل وحده إلى «وصلت — بانتظار التبليغ» بعد الفحص');
  ok(await pg.evaluate(b => { try { return JSON.parse(localStorage.getItem(OU_LS) || '[]').length === b; } catch (_) { return false; } }, undoBefore), 'الفحص لا يدخل سجلّ التراجع (ليس تعديلاً منك)');
  const log = await H.call('/rest/v1/gmt_carrier_log?select=*&order=at.desc&limit=1', undefined, 'GET').catch(() => null);
  ok(Array.isArray(log) && log[0] && log[0].source === 'page' && log[0].changed === 3, 'دورة الفحص مسجّلة في gmt_carrier_log (page · changed=3)');
  // ٤) لا فحص ثانٍ خلال ٣٠ دقيقة عند الفتح
  let fnCalls = 0; pg.on('request', r => { if (/functions\/v1\/gmt-mufti/.test(r.url()) && r.method() === 'POST') fnCalls++; });
  await pg.evaluate(() => carrierCheckNow(false)); await pg.waitForTimeout(500);
  ok(fnCalls === 0, 'عند الفتح خلال ٣٠ د من آخر فحص: لا نداء لموقع الشركة');
  // ٥) بديل GMTAsk المبكّر
  const stub = await pg.evaluate(() => !!(window.GMTAsk && !window.GMTAsk.__stub && typeof GMTAsk.choose === 'function'));
  ok(stub, 'GMTAsk الحقيقي حلّ محلّ البديل المؤقّت بعد التحميل');
  const realErrs = errs.filter(e => !/Failed to load resource: the server responded with a status of 400/.test(e));   /* فحص النظام الذاتي يجرّب add_branch_stock بمنتجٍ وهمي ⇒ 400 مقصود */
  ok(!realErrs.length, 'لا أخطاء JS: ' + realErrs.join(' | ').slice(0, 300));
  await browser.close();
  // ٦) زرّ قبل تحميل gmt-ask.js: البديل يستلم ولا خطأ
  const b2 = await H.open('orders.html', { init: H.ADMIN_INIT, wait: 500 });
  await b2.ctx.route(/gmt-ask\.js/, r => setTimeout(() => r.continue().catch(() => {}), 3500));   /* gmt-ask.js يتأخّر ٣٫٥ ث */
  b2.errs.length = 0;
  await b2.pg.goto(H.BASE + 'orders.html', { waitUntil: 'commit' });   /* الصفحة ظاهرة والسكربتات المؤجّلة لم تكتمل — كالشبكة البطيئة */
  await b2.pg.waitForFunction(() => typeof window.GMTUndo === 'object', null, { timeout: 15000 }).catch(() => {});
  const early = await b2.pg.evaluate(() => { try { const isStub = !!(window.GMTAsk && window.GMTAsk.__stub); GMTUndo.panel(); return isStub ? 'stub' : 'real'; } catch (e) { return 'ERR ' + e.message; } });
  await b2.pg.waitForTimeout(4500);
  const shown = await b2.pg.evaluate(() => !!document.querySelector('.gmtask-ov'));
  ok(early === 'stub' && shown, 'سجلّ التراجع قبل وصول gmt-ask.js (' + early + '): لا «GMTAsk is not defined» والنافذة ظهرت حين وصل');
  ok(!b2.errs.some(e => /GMTAsk/.test(e)), 'لا خطأ GMTAsk: ' + b2.errs.join(' | ').slice(0, 200));
  await b2.browser.close();
  console.log(fails ? 'FAILS=' + fails : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
