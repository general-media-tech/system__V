#!/usr/bin/env node
/* (TASK-B0403 · المالك seq 713) «الباقة … الصورة الثانية لازم تكون نفس هذه الصورة تماماً · وهذا ينطبق على الكل»
   يولّد صورة شبكة منتجات الباقة بنفس دالّة المدير GMTPackages.drawGrid (قالب بكج صناعة المحتوى) ويحفظها في المستودع
   img/p/s/pkg_grid_<أوّل 8 من المعرّف>.jpg — ومع --apply يضعها في الباقة: بوستر المالك أوّلاً ⇐ صورة الشبكة (والفيديو وبوسترات
   المنتجات يرتّبها المتجر بعدها: الأغلى أوّلاً).
   التشغيل (المفاتيح من البيئة فقط): U/K = القاعدة الرئيسية · BASE = الموقع المحلّي (افتراضياً http://127.0.0.1:8765/)
     node tools/pkg_grid.js <offer-id> [--apply]        ·  node tools/pkg_grid.js --all [--apply]   (الباقات النشطة بلا صورة شبكة) */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const env = k => { const v = process.env[k]; if (!v) { console.error('ينقص متغيّر البيئة ' + k); process.exit(2); } return v; };
const U = env('U'), K = env('K'), SU = process.env.SU, SK = process.env.SK, BASE = process.env.BASE || 'http://127.0.0.1:8765/';
const ROOT = path.resolve(__dirname, '..'), PUB = 'https://general-media-tech.github.io/system__V/';
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };
const isGrid = u => /pkg_grid_|\/grid_|pkg_content_creator_2026-11-14\.jpg/.test(String(u || ''));
const isVidFrame = u => /\/img\/v\//.test(String(u || ''));
async function dataUrl(u) {
  if (!u) return '';
  const m = String(u).match(/\/system__V\/(img\/.+?)(?:[?#].*)?$/);
  if (m && fs.existsSync(path.join(ROOT, m[1]))) { const f = path.join(ROOT, m[1]); const t = /\.png$/i.test(f) ? 'image/png' : /\.webp$/i.test(f) ? 'image/webp' : 'image/jpeg'; return 'data:' + t + ';base64,' + fs.readFileSync(f).toString('base64'); }
  try { const r = await fetch(u); if (!r.ok) return ''; const b = Buffer.from(await r.arrayBuffer()); return 'data:' + (r.headers.get('content-type') || 'image/jpeg') + ';base64,' + b.toString('base64'); } catch (_) { return ''; }
}
const parse = o => { let p = o.products; try { if (typeof p === 'string') p = JSON.parse(p); if (typeof p === 'string') p = JSON.parse(p); } catch (_) { p = []; } return Array.isArray(p) ? p : []; };
(async () => {
  const all = process.argv.includes('--all'), apply = process.argv.includes('--apply'), id = process.argv.slice(2).find(a => !a.startsWith('--'));
  const q = all ? 'gmt_offers?select=*&is_active=eq.true&offer_type=eq.bundle' : 'gmt_offers?select=*&id=eq.' + encodeURIComponent(id || '');
  let offers = await (await fetch(U + '/rest/v1/' + q, { headers: H })).json();
  if (all) offers = offers.filter(o => { const t = o.targets || {}; const im = Array.isArray(o.images) ? o.images : []; return t.store !== false && !im.concat(o.image_url || []).some(isGrid) && parse(o).length; });
  if (!offers.length) { console.log('لا باقات'); return; }
  /* (المالك seq 713 «للمنتجات بخلفيات بيضاء») صورة كلّ قطعة = أنصع خلفيةٍ بيضاء بين صورها في الجرد والمتجر */
  let storeById = {};
  if (SU && SK) { try { const st = (await (await fetch(SU + '/rest/v1/gmt_store?id=eq.1&select=products', { headers: { apikey: SK, Authorization: 'Bearer ' + SK } })).json())[0]; (st.products || []).forEach(p => { storeById[p.id] = p; }); } catch (_) {} }
  const b = await chromium.launch(); const pg = await b.newPage();
  await pg.goto(BASE + 'favicon.ico'); await pg.addScriptTag({ url: BASE + 'gmt-packages.js' });
  for (const o of offers) {
    const items = parse(o); const ids = items.map(x => x.id).filter(Boolean);
    const inv = ids.length ? await (await fetch(U + '/rest/v1/products?select=id,name,price,image_url,store_url&id=in.(' + ids.map(encodeURIComponent).join(',') + ')', { headers: H })).json() : [];
    const by = {}; inv.forEach(r => { by[r.id] = r; });
    const full = [];
    for (const x of items) {
      const r = by[x.id] || {}, sid = (String(r.store_url || '').match(/#product=([^&]+)/) || [])[1], sp = sid ? storeById[decodeURIComponent(sid)] : null;
      const cands = [r.image_url || x.image_url, ...((sp && sp.images) || [])].filter((u, i, a) => u && a.indexOf(u) === i).slice(0, 8);
      const urls = []; for (const u of cands) { const d = await dataUrl(u); if (d) urls.push(d); }
      const best = urls.length > 1 ? await pg.evaluate(async list => {   // زوايا وحوافّ بيضاء + المنتج يملأ مساحةً معقولة
        const sc = async u => { const im = new Image(); im.src = u; try { await im.decode(); } catch (_) { return -1; } const c = document.createElement('canvas'), W = 96, H = Math.max(8, Math.round(96 * im.height / im.width)); c.width = W; c.height = H; const g = c.getContext('2d'); g.drawImage(im, 0, 0, W, H); const d = g.getImageData(0, 0, W, H).data;
          let edge = 0, en = 0, ink = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, v = (d[i] + d[i + 1] + d[i + 2]) / 3, e = x < 5 || y < 5 || x >= W - 5 || y >= H - 5; if (e) { en++; if (v > 236) edge++; } if (v < 225) ink++; }
          const ar = im.width / im.height, frac = ink / (W * H); return (edge / en) * 2 + (frac > 0.12 && frac < 0.75 ? 0.5 : 0) + (ar > 0.7 && ar < 1.45 ? 0.3 : 0); };
        let bi = 0, bs = -9; for (let i = 0; i < list.length; i++) { const v = await sc(list[i]); if (v > bs) { bs = v; bi = i; } } return bi; }, urls) : 0;
      full.push({ name: x.name || r.name, qty: Number(x.qty) || 1, price: Number(r.price) || Number(x.price) || 0, image_url: urls[best] || '' });
    }
    const sum = Math.round(full.reduce((t, x) => t + x.price * x.qty, 0) * 100) / 100, price = Number(o.offer_price) || 0;
    const b64 = await pg.evaluate(async a => { const blob = await GMTPackages.drawGrid(document, a); return await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); }); },
      { name: o.name, items: full, sum, save: Math.max(0, Math.round((sum - price) * 100) / 100), price });
    const rel = 'img/p/s/pkg_grid_' + String(o.id).slice(0, 8) + '.jpg';
    fs.writeFileSync(path.join(ROOT, rel), Buffer.from(b64.split(',')[1], 'base64'));
    console.log('✔', o.name, '⇐', rel, '· قطع', full.length, '· مجموع', sum, '· سعر', price);
    if (apply) {
      const ownImgs = [].concat(o.image_url || [], Array.isArray(o.images) ? o.images : []).filter((u, i, a) => u && a.indexOf(u) === i);
      const itemImgs = new Set(inv.map(r => r.image_url).filter(Boolean));
      const posters = ownImgs.filter(u => !isGrid(u) && !isVidFrame(u) && !itemImgs.has(u));   // بوستر المالك (وصوره الخاصّة) فقط
      const images = [...posters.slice(0, 1), PUB + rel, ...posters.slice(1)];
      const r = await fetch(U + '/rest/v1/gmt_trash', { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify([{ tbl: 'gmt_offers', db: 'main', row_id: String(o.id), label: 'pkg_grid before: images', data: { image_url: o.image_url, images: o.images }, deleted_by: 'tools/pkg_grid.js', page: 'tools/pkg_grid' }]) });
      const p = await fetch(U + '/rest/v1/gmt_offers?id=eq.' + o.id, { method: 'PATCH', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify({ images, image_url: images[0] }) });
      console.log('  ⇐ الصور:', r.status, p.status, images.map(u => u.split('/').pop()).join(' · '));
    }
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
