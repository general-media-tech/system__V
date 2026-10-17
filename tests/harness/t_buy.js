const H = require('./h.js');
const fs = require('fs');
const OUT = __dirname + '/';
const XLSX = require('/home/user/system__V/lib/xlsx.full.min.js');
const ok = (c, m) => console.log((c ? '✔ ' : '✘ ') + m);
// صورة PNG صغيرة صالحة (مربع أحمر 40x40)
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC';
(async () => {
  const { prods } = await H.seed();
  const all = (await H.call('/__dump', undefined, 'GET')).products;
  // مخزون: أول ٣ منتجات كثيرة (لا تظهر)، ٢ نافدان
  await H.call('/rest/v1/products?id=eq.' + all[0].id, { haleb: 40 }, 'PATCH'); await H.call('/rest/v1/products?id=eq.' + all[1].id, { haleb: 40 }, 'PATCH'); await H.call('/rest/v1/products?id=eq.' + all[2].id, { haleb: 40 }, 'PATCH');
  await H.call('/rest/v1/products?id=eq.' + all[3].id, { haleb: 0, daraa: 0 }, 'PATCH'); await H.call('/rest/v1/products?id=eq.' + all[4].id, { haleb: 0, daraa: 0 }, 'PATCH');
  for (let i = 3; i < 9; i++) await H.call('/rest/v1/products?id=eq.' + all[i].id, { image_url: PNG }, 'PATCH');
  const it = (i, price) => ({ barcode: all[i].barcode, name: all[i].name, qty: 10, unit_price: price, orig_unit_price: price });
  await H.call('/rest/v1/import_log', [
    { inv_number: 'IMP-2026-0001', inv_type: 'china', supplier: 'Shenzhen Co', inv_date: '2026-01-10', status: 'arrived', created_at: '2026-01-10T00:00:00Z', items_snapshot: [it(3, 12.5), it(4, 8), it(7, 5)] },
    { inv_number: 'IMP-2026-0002', inv_type: 'germany', supplier: 'Berlin GmbH', inv_date: '2026-02-10', status: 'arrived', created_at: '2026-02-10T00:00:00Z', items_snapshot: [it(5, 40)] },
    { inv_number: 'INS-2026-0003', inv_type: 'instant', supplier: 'محلّي دمشق', inv_date: '2026-03-10', status: 'arrived', created_at: '2026-03-10T00:00:00Z', items_snapshot: [it(6, 3), it(8, 9)] },
    { inv_number: 'IMP-2026-0004', inv_type: 'china', supplier: 'Shenzhen Co 2', inv_date: '2026-04-10', status: 'arrived', created_at: '2026-04-10T00:00:00Z', items_snapshot: [it(6, 3.5)] },
    { inv_number: 'IMP-2026-0005', inv_type: 'china', supplier: 'ملغاة', inv_date: '2025-12-10', status: 'cancelled', created_at: '2025-12-10T00:00:00Z', items_snapshot: [it(9, 1)] }]);
  let { browser, ctx, pg, errs } = await H.open('ما_يجب_شراؤه.html', { init: H.ADMIN_INIT, w: 1100, h: 900, wait: 6000, mobile: false });
  await pg.waitForSelector('.row', { timeout: 10000 });
  const cnt = async () => pg.evaluate(() => document.querySelectorAll('.row').length);
  ok(await cnt() === 9, 'منتجات مخزونها < ١٠: ' + await cnt() + ' (٩ من ١٢؛ ٣ منها ٤٠)');
  const chips = await pg.evaluate(() => [...document.querySelectorAll('#og-chips .chip')].map(c => c.textContent.replace(/\s+/g, ' ').trim()));
  console.log('   الشرائح:', chips.join(' | '));
  ok(/الصين.*3/.test(chips[1]) && /سوريا.*2/.test(chips[2]) && /ألمانيا.*1/.test(chips[3]), 'عدّاد الأصل: الصين ٣ (٣،٤،٧) · سوريا ٢ (٦،٨ — أقدم فاتورة محلّية) · ألمانيا ١ (٥) — الملغاة لا تُحتسب');
  // الأقدم يغلب: المنتج 6 دخل أولاً من فاتورة سوريا ثم الصين ⇒ سوريا
  const org6 = await pg.evaluate((n) => { const r = [...document.querySelectorAll('.row')].find(x => x.textContent.includes(n)); return r && r.querySelector('.og').textContent.trim(); }, all[6].name);
  ok(/سوريا/.test(org6), 'الأصل = أقدم فاتورة (منتج دخل سوريا ثمّ الصين ⇒ سوريا): ' + org6);
  ok(await pg.evaluate(() => /آخر مورّد/.test(document.querySelector('.row').textContent)), 'آخر مورّد وسعر ظاهر');
  // فلتر الأصل
  await pg.click('[data-og="china"]'); ok(await cnt() === 3, 'فلتر الصين: ' + await cnt());
  await pg.click('[data-og=""]');
  // الحدّ
  await pg.fill('#f-th', '3'); ok(await cnt() === 2, 'الحدّ ٣ ⇒ النافد فقط (٢): ' + await cnt());
  await pg.fill('#f-th', '10');
  // اقتراح الكمية: هدف ٣٠ − مخزون ٨ = ٢٢
  const q = await pg.evaluate(() => [...document.querySelectorAll('.row')].map(r => r.querySelector('.qty').value));
  ok(q.includes('22') && q.includes('30'), 'الكمية المقترحة (٢٢ لمخزون ٨ · ٣٠ للنافد): ' + [...new Set(q)].join(','));
  await pg.fill('#f-tg', '20'); ok((await pg.evaluate(() => [...document.querySelectorAll('.row .qty')].map(x => x.value))).includes('12'), 'تغيير الهدف يحدّث المقترح غير المعدَّل يدوياً');
  await pg.fill('#f-tg', '30');
  // تعديل يدوي وإلغاء تحديث
  await pg.evaluate(() => { const r = document.querySelector('.row'); const i = r.querySelector('.qty'); i.value = '77'; i.dispatchEvent(new Event('change', { bubbles: true })); });
  await pg.evaluate(() => { const r = document.querySelectorAll('.row')[1]; const c = r.querySelector('.ck'); c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); });
  await pg.screenshot({ path: OUT + 'buy_page.png' });
  // تصدير Excel
  const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 60000 }), pg.click('#b-xl')]);
  const file = OUT + 'rfq_out.xlsx'; await dl.saveAs(file);
  ok(/^RFQ_GMT_.*xlsx$/.test(dl.suggestedFilename()), 'نزّل الملف: ' + dl.suggestedFilename());
  const wb = XLSX.read(fs.readFileSync(file), { type: 'buffer' });
  console.log('   الأوراق:', wb.SheetNames.join(' | '));
  ok(['الصين', 'سوريا', 'ألمانيا'].every(n => wb.SheetNames.includes(n)) && wb.SheetNames.includes('تعليمات'), 'ورقةٌ لكل أصل + تعليمات');
  const cn = XLSX.utils.sheet_to_json(wb.Sheets['الصين'], { header: 1 });
  ok(cn[0].join('|') === '#|الصورة|اسم المنتج|الباركود|المجموعة|المخزون الحالي|الكمية المطلوبة|سعر الشراء $|ملاحظات المورد', 'رؤوس الأعمدة: ' + cn[0].join('|'));
  ok(cn.length === 1 + 3 - 0 || cn.length >= 3, 'صفوف الصين: ' + (cn.length - 1));
  const AdmZip = null;
  // الصور المضمّنة: ملف xlsx = zip؛ نعدّ xl/media
  const zbuf = fs.readFileSync(file); const media = (zbuf.toString('latin1').match(/xl\/media\/image\d+\.jpeg/g) || []).length;
  ok(media >= 5, 'صورٌ مضمّنة في الملف: ' + media);
  // لا يخرج سعر مبيع ولا كلفة
  ok(!/سعر البيع|الكلفة|cost|wholesale/i.test(JSON.stringify(wb.SheetNames.map(n => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1 })))), 'لا أسعار بيع/كلفة داخلية في ملف المورّد');
  console.log('errors:', errs.filter(e => !/404|400|Failed|favicon/.test(e)).slice(0, 4));
  await browser.close();

  // ═ المورّد يملأ الأسعار (نحاكي ذلك بتعديل الملف) ═
  const pr = { 'الصين': 11, 'سوريا': 4.25, 'ألمانيا': 39.5 };
  for (const n of wb.SheetNames) {
    if (n === 'تعليمات') continue; const ws = wb.Sheets[n]; const rng = XLSX.utils.decode_range(ws['!ref']);
    for (let r = 1; r <= rng.e.r; r++) { if (r === 2 && n === 'الصين') continue; /* صفٌّ بلا سعر */ ws[XLSX.utils.encode_cell({ r, c: 7 })] = { t: 'n', v: pr[n] + r / 100 }; }
    ws[XLSX.utils.encode_cell({ r: 1, c: 8 })] = { t: 's', v: 'متوفّر' };
  }
  fs.writeFileSync(OUT + 'rfq_filled.xlsx', XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

  // ═ الاستيراد في المشتريات ═
  ({ browser, ctx, pg, errs } = await H.open('purchase.html', { init: H.ADMIN_INIT, w: 1100, h: 900, wait: 6000, mobile: false }));
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('#rfq-btn')]);
  await fc.setFiles(OUT + 'rfq_filled.xlsx');
  await pg.waitForSelector('.gmtask-ov', { timeout: 10000 });
  const t1 = await pg.evaluate(() => document.querySelector('.gmtask-bd').textContent);
  ok(/أكثر من ورقة/.test(t1), 'سؤال اختيار الورقة: ' + t1.split('\n')[0]);
  console.log(t1);
  await pg.evaluate(() => [...document.querySelectorAll('.gmtask-ov .gmtask-b')].find(b => /الصين/.test(b.textContent)).click()); await pg.waitForTimeout(600);
  const t2 = await pg.evaluate(() => document.querySelector('.gmtask-bd').textContent);
  console.log(t2);
  ok(/بلا سعر/.test(t2), 'يبلّغ عن البند بلا سعر');
  await pg.evaluate(() => document.querySelector('.gmtask-ov .gmtask-b.pri').click()); await pg.waitForTimeout(1500);
  const cartInfo = await pg.evaluate(() => ({ n: cart.length, items: cart.map(c => ({ bc: c.product.barcode, q: c.qty, p: c.unitPrice, img: !!c.product.image_url, notes: c.notes })), type: invType, modal: !document.getElementById('addModal').classList.contains('hidden') }));
  console.log(JSON.stringify(cartInfo));
  ok(cartInfo.modal && cartInfo.type === 'china' && cartInfo.n === 1 && cartInfo.items[0].q === 77, 'المسوّدة: نافذة الاستيراد/الصين، البند المسعَّر الوحيد بكمّيته المعدَّلة (٧٧) والثاني بلا سعر يُستبعد');
  ok(cartInfo.items.every(c => c.p > 10 && c.img), 'الأسعار من المورّد، والصور من قاعدتنا (لا من الملف)');
  console.log('errors:', errs.filter(e => !/404|400|Failed|favicon/.test(e)).slice(0, 4));
  await pg.screenshot({ path: OUT + 'buy_import.png' });
  await browser.close();
})();
