#!/usr/bin/env node
/* (TASK-B0380 · المالك seq B655) «ادرس كل منتجاتنا بحيث تعرف شو تخليه يعمل بكج واعطيه انت خصم … الخصم ما يكون فوراً … ارسل للحصول على عرض سعر»
   يبني products-images/store/kits.json: لكلّ منتج طقمه المقترح (المنتج + ٢–٣ ممّا يلزمه) ومجموع أسعاره و«سعر تقريبي» للطقم.
   ⚠️ التكلفة لا تُكتب في الملفّ إطلاقاً — تُستعمل هنا فقط لحساب الخصم الآمن.

   الطقم = ما تقترحه دالّة المتجر نفسها gmtComplements (تُشغَّل داخل store.html على البيانات الحيّة) ⇒ ما يراه الزبون في «كمّل طقمك» هو الطقم نفسه.
   (المالك seq B672) «لا تحط طقم كبير · حط اكسسوارات اسعارها البيع اضعاف سعر الشراء · وعند البكج بتنزل السعر ب 35 بالمية تقريبا»:
   كلّ قطعة في الطقم (والمنتج نفسه) سعر بيعها ≥ ضعف تكلفتها · قطعتان أو ثلاث فقط · مجموعها ≤ MAX_SUM$ ·
   سعر الطقم = المجموع − ٣٥٪ تقريباً (يُقرَّب لأقرب ١$، أو ٥$ فوق ١٠٠$) ويبقى ≥ ١٫٢ × التكلفة.

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

const MULT = 2, DISC = 0.35, MAX_ITEMS = 3, MAX_SUM = Number(process.env.MAX_SUM || 250);
function offerFor(items) {   // items: [{price, cost}]
  const sum = items.reduce((t, x) => t + x.price, 0), cost = items.reduce((t, x) => t + x.cost, 0);
  if (sum > MAX_SUM) return null;
  const step = sum > 100 ? 5 : 1;
  const offer = Math.round(sum * (1 - DISC) / step) * step;
  if (offer < cost * 1.2 || offer >= sum) return null;
  return { sum: Math.round(sum * 100) / 100, offer };
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
    if (!main || !rich(pid) || /محول|وصلة|كبل|كابل|adapter|cable/i.test(main.name || '')) { skipped++; continue; }   // الوصلات لا تُبنى عليها أطقم
    const picks = [];   // قطعةٌ واحدة من كلّ نوع (لا ذاكرتان في طقم واحد)
    for (const id of list.filter(rich)) { if (picks.length >= MAX_ITEMS - 1) break; if (picks.some(x => String(byId[x].category_id) === String(byId[id].category_id))) continue; picks.push(id); }
    if (!picks.length) { skipped++; continue; }
    const ids = [pid, ...picks];
    const o = offerFor(ids.map(id => ({ price: parseFloat(byId[id].price), cost: costOf[id] })));
    if (o) kits[pid] = { ids, sum: o.sum, offer: o.offer }; else skipped++;
  }
  const out = { built_at: new Date().toISOString(), rule: 'قطع ربحها ≥ ضعف التكلفة · ٢–٣ قطع · −٣٥٪ تقريباً', kits };
  fs.writeFileSync(OUT, JSON.stringify(out));
  const vals = Object.values(kits);
  console.log('أطقم:', vals.length, '· بلا عرض:', skipped, '· متوسّط الوفر:', vals.length ? (vals.reduce((t, k) => t + (k.sum - k.offer) / k.sum, 0) / vals.length * 100).toFixed(1) + '%' : '-');
  if (process.argv.includes('--upload')) {
    const r = await fetch(U + '/storage/v1/object/products-images/store/kits.json', { method: 'POST', body: JSON.stringify(out),
      headers: { ...hdr(K), 'x-upsert': 'true', 'cache-control': 'max-age=300', 'Content-Type': 'application/json' } });
    console.log('رفع kits.json:', r.status);
  }
})().catch(e => { console.error(e); process.exit(1); });
