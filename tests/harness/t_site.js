const H = require('./h.js');
const OUT = __dirname + '/';
const ok = (c, m) => console.log((c ? '✔ ' : '✘ ') + m);
const PNG = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1e293b"/><stop offset="1" stop-color="#D5001C"/></linearGradient></defs><rect width="800" height="450" fill="url(#g)"/><circle cx="400" cy="225" r="120" fill="none" stroke="#fff" stroke-width="10"/></svg>');
const GUEST = `try{ localStorage.setItem('gmt_notif_prompted','1'); }catch(e){}`;
async function seed() {
  await H.seed();
  const T = (t, r) => H.call('/rest/v1/' + t, r);
  await T('site_settings', [{ key: 'copyright_ar', value: '© 2026 مجموعة ميديا تيك التجارية. جميع الحقوق محفوظة.', is_active: true }, { key: 'topbar_highlight_ar', value: 'كانون', is_active: true }]);
  await T('nav_items', [{ label_ar: 'الرئيسية', url: '#top', is_home: true, sort_order: 1, is_active: true }, { label_ar: 'المنتجات', url: 'store.html', sort_order: 2, is_active: true }, { label_ar: 'خدماتنا', url: '#svc-sec', sort_order: 3, is_active: true }, { label_ar: 'بلا رابط', url: '#', sort_order: 4, is_active: true }]);
  await T('hero_slides', [
    { title_ar: 'التصوير، الإبداع، الاحتراف', subtitle_ar: 'هذا هو عالم Canon', description_ar: 'اكتشف أحدث كاميرات وعدسات كانون الأصلية\nمع ضمان الوكيل الرسمي في سوريا', btn1_label_ar: 'اكتشف المزيد', btn1_url: 'store.html', btn2_label_ar: 'تصفح المنتجات', btn2_url: 'store.html', bg_color: 'light', sort_order: 1, is_active: true },
    { title_ar: 'خدمات ما بعد البيع', subtitle_ar: 'Canon', description_ar: 'راحة بالك مع ضمان الوكيل الرسمي', btn1_label_ar: 'تحقق من الكفالة', btn1_url: 'search.html', bg_color: '#111111', sort_order: 2, is_active: true },
    { title_ar: 'صورة من القاعدة', subtitle_ar: 'شريحة بصورة خلفية', description_ar: 'تظهر الصورة كخلفية كاملة', btn1_label_ar: 'اذهب', btn1_url: 'javascript:alert(1)', bg_color: '#0a0a1e', image_url: PNG, sort_order: 3, is_active: true }]);
  await T('service_cards', ['مراكز الخدمة|location|#branches', 'دعم فني مباشر|support|', 'كوبونات وعروض|coupon|store.html', 'تتبع الشحنات|shipping|track_order.html', 'ضمان وكفالة|warranty|search.html', 'تتبع طلباتك|orders|track_order.html', 'المتجر الإلكتروني|store|store.html'].map((x, i) => { const [l, ic, u] = x.split('|'); return { label_ar: l, icon_name: ic, url: u, sort_order: i + 1, is_active: true }; }));
  await T('quick_links', Array.from({ length: 8 }, (_, i) => ({ title_ar: 'رابط ' + (i + 1), description_ar: 'وصف قصير للرابط رقم ' + (i + 1), icon_name: ['store', 'orders', 'warranty', 'shipping', 'location', 'support', 'coupon', 'faq'][i], url: i % 3 ? 'store.html' : '', sort_order: i + 1, is_active: true })));
  await T('why_us_features', [['وكيل رسمي Canon', 'truck'], ['ضمان محلي معتمد', 'shield'], ['منتجات أصلية 100%', 'check-circle'], ['دعم فني متخصص', 'headphones'], ['شحن سريع وآمن', 'fast-delivery']].map((x, i) => ({ title_ar: x[0], description_ar: 'وصف ' + x[0], icon_name: x[1], sort_order: i + 1, is_active: true })));
  await T('banners', [{ slot: 'top', image_url: PNG, alt_text: 'بانر', display_secs: 4, sort_order: 1, is_active: true }]);
  await T('news_cards', [{ title_ar: 'خصومات تصل حتى 30%', description_ar: 'على مجموعة مختارة من العدسات الأصلية بكفالة الوكيل لفترة محدودة', tag_ar: 'عرض خاص', tag_color: '#D5001C', link_url: 'store.html', published_at: '2026-10-05', image_url: PNG, sort_order: 1, is_active: true }, { title_ar: 'خبر بلا رابط ولا صورة', description_ar: 'نصّ تجريبي', tag_ar: 'خبر', tag_color: 'javascript:x', link_url: '', published_at: '2026-10-01', sort_order: 2, is_active: true }]);
  await T('footer_links', [{ label_ar: 'Instagram', url: 'https://instagram.com/x', icon_name: 'instagram', link_type: 'social', sort_order: 1, is_active: true }, { label_ar: 'Facebook', url: '#', icon_name: 'facebook', link_type: 'social', sort_order: 2, is_active: true }]);
  await T('agents', [{ name: 'وكيل اللاذقية', city: 'اللاذقية', phone: '0944123456', is_active: true, sort_order: 1 }]);
  await T('gmt_store', [{ id: 1, branches: [{ name: 'فرع حلب', province: 'حلب', address: 'شارع التلل', phone: '0933111222' }, { name: 'فرع دمشق', province: 'دمشق', address: 'البرامكة', phone: '0933999888' }] }]);
}
(async () => {
  await seed();
  // ═ ١) الكمبيوتر
  let { browser, pg, errs } = await H.open('site.html', { init: GUEST, w: 1366, h: 900, wait: 5500, mobile: false });
  const m = await pg.evaluate(() => {
    const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const minFont = (() => { let mn = 99, who = ''; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const p = n.parentElement; if (!n.nodeValue.trim() || !p || /SCRIPT|STYLE/.test(p.tagName) || !vis(p)) continue; const f = parseFloat(getComputedStyle(p).fontSize); if (f < mn) { mn = f; who = n.nodeValue.trim().slice(0, 16); } } return [mn, who]; })();
    return { hscroll: document.documentElement.scrollWidth > innerWidth + 2, nav: [...document.querySelectorAll('#hdr-nav a, #hdr-nav span')].map(e => e.textContent.trim()), slides: document.querySelectorAll('.slide').length, dots: document.querySelectorAll('.h-dot').length,
      svc: document.querySelectorAll('#svc-grid > *').length, svcKey: document.querySelectorAll('.sv.key').length, ql: document.querySelectorAll('#ql-grid > *').length, why: document.querySelectorAll('.wc').length, news: document.querySelectorAll('#news-scroll > *').length,
      contactHref: (document.getElementById('tb-contact-btn') || {}).href || null, contactVis: vis(document.getElementById('tb-contact-btn')), nl: getComputedStyle(document.getElementById('nl-sec')).display, tabs: [...document.querySelectorAll('#bt-tabs .tb')].map(e => e.textContent), branches: document.querySelectorAll('#bt-body .bc').length,
      social: document.querySelectorAll('#ft-soc a').length, bannerTop: getComputedStyle(document.getElementById('banner-top')).display, minFont, pill: getComputedStyle(document.getElementById('pill')).display, copy: document.getElementById('ft-copy').textContent,
      jsLink: [...document.querySelectorAll('a')].some(a => /^javascript:/i.test(a.getAttribute('href') || '')), hdrH: document.getElementById('header').offsetHeight };
  });
  console.log(JSON.stringify(m));
  ok(!m.hscroll, 'لا تمرير أفقي على الكمبيوتر');
  ok(m.nav.includes('الأخبار') && m.nav.includes('الفروع والوكلاء') && m.nav.includes('المنتجات'), 'القائمة: عناصر القاعدة + «الأخبار» + «الفروع والوكلاء»: ' + m.nav.join(' | '));
  ok(m.slides === 3 && m.dots === 3, 'الهيرو ٣ شرائح بنقاط');
  ok(m.svc === 7 && m.svcKey === 2 && m.ql === 8 && m.why === 5 && m.news === 2, 'الخدمات ٧ (المتجر والتتبّع بارزان) · روابط ٨ · لماذا ٥ · أخبار ٢');
  ok(/wa\.me\/963939773715/.test(m.contactHref || '') && m.contactVis, '«تواصل معنا» يفتح واتساب الرقم المضبوط: ' + m.contactHref);
  ok(m.nl === 'block' || m.nl === 'grid', 'قسم الاشتراك ظاهر (كان مخفياً دائماً)');
  ok(m.tabs.length === 2 && m.branches === 2, 'الفروع والوكلاء: تبويبان، فرعان: ' + m.tabs.join(' | '));
  ok(m.social === 1 && m.bannerTop !== 'none', 'تواصل اجتماعي ١ (الرابط «#» يُهمَل) + بانر علوي ظاهر');
  ok(m.minFont[0] >= 11, 'أصغر خطّ ظاهر ' + m.minFont[0] + 'px («' + m.minFont[1] + '») — كان ٤٫٥px');
  ok(m.pill === 'none' && !m.jsLink, 'لا حبّة سفلية على الكمبيوتر · لا رابط javascript: من القاعدة');
  await pg.screenshot({ path: OUT + 'site_desk_top.png' });
  await pg.screenshot({ path: OUT + 'site_desk_full.png', fullPage: true });
  await pg.click('#bt-tabs [data-t="a"]'); ok(/وكيل اللاذقية/.test(await pg.evaluate(() => document.getElementById('bt-body').textContent)), 'تبويب الوكلاء');
  await pg.click('.h-next'); await pg.waitForTimeout(300); ok(await pg.evaluate(() => document.querySelectorAll('.slide')[1].classList.contains('on')), 'سهم التالي يبدّل الشريحة');
  console.log('errors:', errs.filter(e => !/404|400|Failed|favicon/.test(e)).slice(0, 4));
  await browser.close();

  // ═ ٢) الهاتف
  ({ browser, pg, errs } = await H.open('site.html', { init: GUEST, w: 390, h: 844, wait: 5500 }));
  const mm = await pg.evaluate(() => ({ hscroll: document.documentElement.scrollWidth > innerWidth + 2, pill: getComputedStyle(document.getElementById('pill')).display, menuBtn: getComputedStyle(document.getElementById('hdr-menu')).display, nav: getComputedStyle(document.getElementById('hdr-nav')).display, cta: getComputedStyle(document.getElementById('tb-contact-btn')).display,
    newsScroll: (() => { const n = document.getElementById('news-scroll'); return n.scrollWidth > n.clientWidth; })() }));
  console.log(JSON.stringify(mm));
  ok(!mm.hscroll && mm.pill === 'flex' && mm.menuBtn !== 'none' && mm.nav === 'none', 'الهاتف: لا تمرير أفقي · حبّة سفلية · زرّ قائمة · القائمة العلوية مخفية');
  await pg.screenshot({ path: OUT + 'site_mob_top.png' });
  await pg.click('#hdr-menu'); await pg.waitForTimeout(350);
  ok(await pg.evaluate(() => document.getElementById('header').classList.contains('open') && document.querySelectorAll('#mob-menu a').length >= 5), 'القائمة تُفتح تحت الرأس (لا نافذة عائمة)');
  await pg.screenshot({ path: OUT + 'site_mob_menu.png' });
  await pg.click('#hdr-menu');
  await pg.screenshot({ path: OUT + 'site_mob_full.png', fullPage: true });
  ok(await pg.evaluate(() => { const fabs = [...document.querySelectorAll('body *')].filter(e => { const s = getComputedStyle(e); if (s.position !== 'fixed') return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.width <= 90 && r.height <= 90 && r.width >= 28; }); return fabs.length === 0; }), 'لا أزرار عائمة صغيرة');
  console.log('errors:', errs.filter(e => !/404|400|Failed|favicon/.test(e)).slice(0, 4));
  await browser.close();

  // ═ ٣) الاحتياطي: قاعدة الموقع لا تردّ
  ({ browser, pg, errs } = await H.open('site.html', { init: GUEST, w: 1366, h: 900, wait: 500, mobile: false }));
  await browser.close();
  const b = await (async () => { const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 1366, height: 900 } }); const p = await ctx.newPage(); const e = [];
    p.on('pageerror', x => e.push(String(x).slice(0, 120))); await ctx.route('**/*.supabase.co/**', r => r.fulfill({ status: 500, body: '{}' })); await ctx.route(/^https:\/\/(?!127)/, r => { if (/supabase/.test(r.request().url())) return r.fallback(); r.fulfill({ status: 404, body: '' }); });
    await ctx.addInitScript(GUEST); await p.goto(H.BASE + 'site.html'); await p.waitForTimeout(4000);
    const r = await p.evaluate(() => ({ slides: document.querySelectorAll('.slide').length, svc: [...document.querySelectorAll('#svc-grid a')].map(a => a.getAttribute('href') || (a.dataset.gmtContact ? 'wa' : '')), news: document.getElementById('news-scroll').textContent.trim().slice(0, 40), br: document.getElementById('bt-body').textContent.trim().slice(0, 50), dead: [...document.querySelectorAll('#svc-grid a, #ql-grid a')].filter(a => !a.getAttribute('href') && !a.dataset.gmtContact).length, nav: [...document.querySelectorAll('#hdr-nav a')].map(a => a.textContent) }));
    await p.screenshot({ path: OUT + 'site_fallback.png' }); await br.close(); return { r, e }; })();
  console.log(JSON.stringify(b.r));
  ok(b.r.slides === 3 && b.r.dead === 0 && b.r.svc.includes('store.html') && b.r.svc.includes('track_order.html') && b.r.svc.includes('search.html'), 'الاحتياطي: ٣ شرائح، لا بطاقات ميّتة، روابط حقيقية (store · track_order · search)');
  ok(/لا توجد أخبار/.test(b.r.news) && /واتساب/.test(b.r.br), 'الاحتياطي: لا أخبار مختلَقة (حالة فارغة صادقة) + الفروع تقول «راسلنا على واتساب»');
  console.log('page errors:', b.e);
})();
