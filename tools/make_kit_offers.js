#!/usr/bin/env node
/* (TASK-B0380 · المالك seq B655) «ادرس كل منتجاتنا بحيث تعرف شو تخليه يعمل بكج واعطيه انت خصم … الخصم ما يكون فوراً … ارسل للحصول على عرض سعر»
   يبني products-images/store/kits.json: لكلّ منتج طقمه المقترح (المنتج + ٢–٣ ممّا يلزمه) ومجموع أسعاره و«سعر تقريبي» للطقم.
   ⚠️ التكلفة لا تُكتب في الملفّ إطلاقاً — تُستعمل هنا فقط لحساب الخصم الآمن.

   الطقم = ما تقترحه دالّة المتجر نفسها gmtComplements (تُشغَّل داخل store.html على البيانات الحيّة) ⇒ ما يراه الزبون في «كمّل طقمك» هو الطقم نفسه.
   (المالك seq B672) «لا تحط طقم كبير · حط اكسسوارات اسعارها البيع اضعاف سعر الشراء · وعند البكج بتنزل السعر ب 35 بالمية تقريبا»:
   (seq B677) «ما بدي قسم للأطقم — لما يشتري درون تعطيه ملحقاته الموجودة: حماية الشفرات · الحقيبة · بطاريات إضافية؛ كاميرا: الحقيبة · لوح إضاءة · كفر»
   ⇒ الطقم = المنتج (بسعره كاملاً) + حتى ٣ ملحقات من gmtComplements، كلّ ملحق سعره ≥ ضعف تكلفته، قطعة من كلّ نوع ·
   الخصم ~٣٥٪ على الملحقات وحدها (يُقرَّب لأقرب ١$) ويبقى ≥ ١٫٢ × تكلفتها. يظهر في صفحة المنتج فقط.

   التشغيل (المفاتيح من البيئة فقط — لا أسرار في المستودع):
     U/K   = القاعدة الرئيسية (رابط + مفتاح يقرأ products.cost_price/net_cost)
     SU/SK = قاعدة المتجر (gmt_store) · BASE = رابط الموقع المحلّي (افتراضياً http://127.0.0.1:8765/)
     node tools/make_kit_offers.js [--upload]      ⇒ يكتب kits.json محلّياً، ومع --upload يرفعه للتخزين */
const fs = require('fs');
const { chromium } = require('playwright');
const env = k => { const v = process.env[k]; if (!v) { console.error('ينقص متغيّر البيئة ' + k); process.exit(2); } return v; };
const U = env('U'), K = env('K'), SU = env('SU'), SK = env('SK');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/';
const OUT = process.env.OUT || 'kits.json';
const hdr = k => ({ apikey: k, Authorization: 'Bearer ' + k });

const MULT = 2, DISC = 0.35, MAX_ITEMS = 5;   /* (المالك 17 ت2) طقم الرأس الصغير: سوفت صغير + براكيت + سوفت كبير + ستاند */
// المنتجات الأساسية: كاميرات · عدسات · أوبن بوكس · ألواح ورؤوس وفلاشات · إضاءة المحتوى · مايكات · جيمبال وترايبود ذكي · أكشن · درونات
const MAINCATS = new Set((process.env.MAINCATS || 'h1_1,h1_2,h2_1,h2_2,h3_1,h3_2,h3_3,h4_1,h4_2,h4_3,h5_1,h5_2,h6_2,h6_3,h6_4,h7_1,h8_1,h11_1,h11_2').split(','));
function offerFor(main, acc, need) {   // main: {price} · acc: ملحقات بخصم [{price, cost}] · need: ما يلزم المنتج ليعمل [{price}] بسعره كاملاً
  need = need || [];
  const accSum = acc.reduce((t, x) => t + x.price, 0), accCost = acc.reduce((t, x) => t + x.cost, 0), needSum = need.reduce((t, x) => t + x.price, 0);
  const accOffer = Math.round(accSum * (1 - DISC));
  if (acc.length && (accOffer < accCost * 1.2 || accOffer >= accSum)) return null;
  if (!acc.length && !need.length) return null;
  const sum = main.price + accSum + needSum, offer = main.price + accOffer + needSum;
  if (offer >= sum) return null;   // بلا توفير ⇒ لا «عرض»
  return { sum: Math.round(sum * 100) / 100, offer: Math.round(offer * 100) / 100 };
}
/* (صيد النمط · المالك 17 ت2 «هدول لازم يكونو مع بعض بالطقم») نوع القطعة داخل قسمها — كان «قطعة واحدة من كلّ قسم» يُسقط البراكيت
   والسوفت الكبير لأنّهما في قسم السوفت الصغير نفسه، فيبقى قمعٌ وحده */
function kindOf(p) {
  const n = String(p.name || '').toLowerCase(), m = n.match(/\d{2,3}/g), sz = m ? Math.max(...m.map(Number).filter(x => x <= 200), 0) : 0;
  if (/براكيت|bracket/.test(n)) return 'bracket';
  if (/سوفت|softbox|octa|اوكتا|بالون/.test(n)) return sz && sz <= 40 ? 'soft-s' : 'soft-l';
  return '';
}

(async () => {
  const store = (await (await fetch(SU + '/rest/v1/gmt_store?id=eq.1&select=*', { headers: hdr(SK) })).json())[0];
  const inv = await (await fetch(U + '/rest/v1/products?select=id,store_url,net_cost,cost_price&limit=5000', { headers: hdr(K) })).json();
  const costOf = {};
  inv.forEach(r => { const m = String(r.store_url || '').match(/#product=([^&]+)/); const c = Number(r.net_cost) > 0 ? Number(r.net_cost) : Number(r.cost_price); if (m && c > 0) costOf[decodeURIComponent(m[1])] = c; });
  const b = await chromium.launch(); const ctx = await b.newContext();
  await ctx.addInitScript(() => { try { localStorage.setItem('gmt_intro_seen_build', 'x'); } catch (e) {} });
  const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };   // بدونه يحجب المتصفّح الردّ المعترَض (طلبٌ لأصلٍ آخر)
  await ctx.route('**/*', r => {
    const u = r.request().url();
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
    if (u.startsWith(BASE)) return r.continue();
    if (/gmt_store|home\.json/.test(u)) { const one = /vnd\.pgrst\.object/.test(r.request().headers()['accept'] || '');   // supabase-js .single() يطلب كائناً لا مصفوفة
      return r.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify(/gmt_store/.test(u) && !one ? [store] : store) }); }
    return r.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: '[]' });
  });
  const pg = await ctx.newPage();
  await pg.goto(BASE + 'store.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => typeof gmtComplements === 'function' && typeof store !== 'undefined' && store.products && store.products.length > 0, null, { timeout: 30000 });
  const comp = await pg.evaluate(() => { const o = {}; store.products.forEach(p => { if (parseFloat(p.price || 0) > 0 && !Array.isArray(p.package_items)) o[p.id] = gmtComplements(p).map(x => x.id); }); return o; });
  await b.close();
  const byId = {}; store.products.forEach(p => { byId[p.id] = p; });
  const kits = {}; let skipped = 0;
  for (const [pid, list] of Object.entries(comp)) {
    const main = byId[pid]; const mc = costOf[pid];
    const rich = id => costOf[id] > 0 && byId[id] && parseFloat(byId[id].price || 0) >= MULT * costOf[id];   // إكسسوار ربحه أضعاف
    const isMain = (main && (main.category_ids || [main.category_id])).some(c => MAINCATS.has(String(c)));   // الطقم حول المنتج الأساسي لا حول ملحق
    if (!main || !isMain || !(parseFloat(main.price || 0) > 0) || /محول|وصلة|كبل|كابل|adapter|cable/i.test(main.name || '')) { skipped++; continue; }   // الوصلات لا تُبنى عليها أطقم
    /* ما صُنع لهذا المنتج باسمه (مُطلِق لفلاش iT32 · بور غريب ZU60) يلزمه ليعمل ⇒ في الطقم دائماً بسعره، ولو لم يكن ربحه أضعافاً */
    const codes = (String(main.name || '').match(/[A-Za-z]{1,6}[- ]?\d{1,4}[A-Za-z]{0,3}/g) || []).map(x => x.replace(/[- ]/g, '').toLowerCase()).filter(x => x.length >= 3 && /\d/.test(x));
    const madeFor = id => { const t = String(byId[id].name || '').toLowerCase().replace(/[- ]/g, ''); return codes.some(c => t.includes(c)); };
    const need = list.filter(id => byId[id] && madeFor(id) && !rich(id)).slice(0, 1);
    const key = id => String(byId[id].category_id) + '|' + kindOf(byId[id]);
    /* (المالك 17 ت2) الطقم = ما يلزم المنتج كلّه (لا ما ربحه أضعاف فقط): الغنيّ بخصم ~٣٥٪، والباقي بخصمٍ لا ينزل تحت التكلفة +٢٠٪، ومجهول التكلفة بسعره */
    const picks = [], more = [];   // قطعةٌ واحدة من كلّ نوع (لا ذاكرتان في طقم واحد)
    for (const id of list) { if (picks.length + more.length + need.length >= MAX_ITEMS - 1) break; if (need.includes(id) || picks.concat(more, need).some(x => key(x) === key(id))) continue; (rich(id) ? picks : more).push(id); }
    /* (المالك 17 ت2 «كل اضائة لازم معها … ستاند») الستاند المقترح لا يسقط من العرض لامتلاء الطقم: يأخذ مكان آخر قطعة */
    const stId = list.find(id => /ستاند|stand/i.test(byId[id].name || '') && !/عصا|selfie|ring|رينغ/i.test(byId[id].name || ''));
    if (stId && !picks.concat(more, need).includes(stId)) { const arr = more.length ? more : picks; if (picks.length + more.length + need.length >= MAX_ITEMS - 1 && arr.length) arr.pop(); (rich(stId) ? picks : more).push(stId); }
    if (!picks.length && !need.length && !more.length) { skipped++; continue; }
    const ids = [pid, ...need, ...list.filter(id => picks.includes(id) || more.includes(id))];
    const safe = id => { const pr = parseFloat(byId[id].price), c = costOf[id]; const d = c > 0 ? Math.max(0, Math.min(DISC, 1 - c * 1.2 / pr)) : 0; return Math.round(pr * d * 100) / 100; };
    const o0 = offerFor({ price: parseFloat(main.price) }, picks.map(id => ({ price: parseFloat(byId[id].price), cost: costOf[id] })), need.map(id => ({ price: parseFloat(byId[id].price) })).concat(more.map(id => ({ price: parseFloat(byId[id].price) }))));
    const extra = more.reduce((t, id) => t + safe(id), 0);
    const base = o0 || (picks.length ? null : { sum: parseFloat(main.price) + need.concat(more).reduce((t, id) => t + parseFloat(byId[id].price), 0), offer: parseFloat(main.price) + need.concat(more).reduce((t, id) => t + parseFloat(byId[id].price), 0) });
    const o = base && (base.offer - extra < base.sum) ? { sum: Math.round(base.sum * 100) / 100, offer: Math.round((base.offer - extra) * 100) / 100 } : null;
    if (o) kits[pid] = { ids, sum: o.sum, offer: o.offer }; else skipped++;
  }
  const out = { built_at: new Date().toISOString(), rule: 'المنتج بسعره + حتى ٣ ملحقات ربحها ≥ ضعف التكلفة بخصم ~٣٥٪', kits };
  fs.writeFileSync(OUT, JSON.stringify(out));
  const vals = Object.values(kits);
  console.log('أطقم:', vals.length, '· بلا عرض:', skipped, '· متوسّط الوفر:', vals.length ? (vals.reduce((t, k) => t + (k.sum - k.offer) / k.sum, 0) / vals.length * 100).toFixed(1) + '%' : '-');
  if (process.argv.includes('--upload')) {
    const r = await fetch(U + '/storage/v1/object/products-images/store/kits.json', { method: 'POST', body: JSON.stringify(out),
      headers: { ...hdr(K), 'x-upsert': 'true', 'cache-control': 'max-age=300', 'Content-Type': 'application/json' } });
    console.log('رفع kits.json:', r.status);
  }
})().catch(e => { console.error(e); process.exit(1); });
