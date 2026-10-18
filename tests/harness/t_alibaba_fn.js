// اختبار منطق دالّة gmt-brain الجديدة (edge_brain_next/index.ts) بلا شبكة: يستبدل fetch ويحاكي Gemini وصفحات المنتجات ومحرّك البحث.
// التشغيل:  node tests/harness/t_alibaba_fn.js   (يقرأ المصدر من BRAIN_FN أو من مجلد الجلسة الافتراضي)
// يتحقّق من: الجذر (Gemini يرفض البحث ⇒ 502 بسببه الحقيقي لا {product:{}} بنجاحٍ كاذب) · قائمة المرشّحين · فحص الروابط · احتياطي DuckDuckGo ·
// تنزيل الصور (SSRF/النوع/الحجم) · سياق الأسئلة بالأولويّة · web:true وgrounded وsearch_failed.
const fs = require('fs'), path = require('path');
const SRC = process.env.BRAIN_FN || '/tmp/claude-0/-home-user-system--V/dfe65fb9-bcc1-5e5a-be94-906828e1c021/scratchpad/edge_brain_next/index.ts';
if (!fs.existsSync(SRC)) { console.log('تخطّي: مصدر الدالّة غير موجود: ' + SRC); process.exit(0); }
let bad = 0; const ok = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if (!c) bad++; };

const ENV = { GEMINI_API_KEY: 'test-key-1' };
let handler = null;
globalThis.Deno = { env: { get: k => ENV[k] }, serve: h => { handler = h; } };

// ── محاكاة الشبكة ──
let routes = [];            // [{ test(url, init) -> bool, reply(url, init) -> Response }]
const calls = [];
globalThis.fetch = async (url, init) => {
  url = String(url); calls.push({ url, init });
  for (const r of routes) if (r.test(url, init)) return r.reply(url, init);
  return new Response('not mocked: ' + url, { status: 599 });
};
const J = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
const HTML = (h, status = 200) => new Response(h, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });
const gem = (text, grounded) => J({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP', ...(grounded ? { groundingMetadata: { webSearchQueries: ['q1'], groundingChunks: [{ web: { uri: 'https://vertexaisearch.cloud.google.com/x', title: 'alibaba.com' } }] } } : {}) }] });
const isGem = u => /generativelanguage\.googleapis\.com/.test(u);
const gemBody = init => JSON.parse(init.body);

let n = 0;
async function call(body, { origin = 'https://general-media-tech.github.io', method = 'POST' } = {}) {
  const hdr = { 'x-real-ip': '10.1.' + (++n >> 8) + '.' + (n & 255) };
  if (origin) hdr.origin = origin;
  const req = new Request('http://fn.local/', { method, headers: hdr, body: method === 'POST' ? JSON.stringify(body) : undefined });
  const res = await handler(req);
  let j = null; try { j = await res.clone().json(); } catch (_) {}
  return { status: res.status, j, res };
}

const PNG = Uint8Array.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1]);
const PAGE_OK = '<html><head><title>Canon LP-E6NH Battery - Alibaba</title><meta property="og:title" content="LP-E6NH battery pack 2130mAh"><meta property="og:image" content="//s.alicdn.com/@sc04/kf/H111.jpg_960x960.jpg"><meta property="og:description" content="Rechargeable"></head><body><img src="/img/p2.jpg"><img src="/img/logo.png"><img data-src="https://cdn.example.com/p3_800x800.webp"></body></html>';
const CAPTCHA = '<html><head><title>Captcha Interception</title></head><body>unusual traffic slide to verify</body></html>';

(async () => {
  const m = await import(SRC);

  // 0) الأساسيات
  let r = await call({}, { origin: null });
  ok(r.status === 403, 'بلا Origin ⇒ 403');
  r = await call({}, { method: 'OPTIONS' }); ok(r.status === 200, 'OPTIONS ⇒ 200');
  r = await call({ mode: 'status' });
  ok(r.status === 200 && r.j.gemini === 1 && r.j.modes.includes('product_search') && r.j.modes.includes('image_fetch') && r.j.version, 'status يعلن modes (product_search · image_fetch) والإصدار: ' + JSON.stringify(r.j).slice(0, 120));

  // 1) الجذر: Gemini يرفض كل الطلبات (429 مثلاً) ⇒ كان {product:{}} بـ200؛ الآن 502 بالسبب الحقيقي
  routes = [{ test: (u) => isGem(u), reply: () => J({ error: { code: 429, message: 'Quota exceeded for metric: grounding limit: 0' } }, 429) }];
  r = await call({ mode: 'product', hint: 'Canon LP-E6NH battery' });
  ok(r.status === 502 && /429/.test(r.j.error) && /Quota/.test(r.j.error) && r.j.code === 'search_unavailable' && !r.j.product, 'product + رفض Gemini ⇒ 502 بسببه (لا {product:{}} بنجاح كاذب): ' + (r.j.error || '').slice(0, 110));
  const modelsTried = new Set(calls.filter(c => isGem(c.url)).map(c => (c.url.match(/models\/([^:]+):/) || [])[1]));
  ok(modelsTried.size === 3, 'جرّب كل النماذج الثلاثة لا الأول فقط: ' + [...modelsTried].join(','));
  ok(calls.filter(c => isGem(c.url)).every(c => gemBody(c.init).tools && gemBody(c.init).tools[0].google_search), 'كل المحاولات بأداة البحث google_search');

  // 2) النموذج الأوّل لا يدعم البحث (400) ⇒ الثاني ينجح ويُعلن grounded
  routes = [{ test: (u) => isGem(u), reply: (u) => /flash-lite/.test(u) ? J({ error: { message: 'Search tool is not supported for this model' } }, 400)
    : gem(JSON.stringify({ name_ar: 'بطارية LP-E6NH', brand: 'Canon', specs: [{ k: 'السعة', v: '2130mAh' }], description_ar: 'وصف', confidence: 'high', images: ['https://s.alicdn.com/@sc04/kf/A1.jpg'] }), true) }];
  r = await call({ mode: 'product', hint: 'LP-E6NH' });
  ok(r.status === 200 && r.j.searched === true && r.j.product.name_ar === 'بطارية LP-E6NH' && r.j.empty === false, 'نموذج أوّل يرفض البحث ⇒ الثاني يُكمل (searched=true)');
  ok(r.j.product.images.includes('https://s.alicdn.com/@sc04/kf/A1.jpg') && r.j.sources.length === 1, 'الصور والمصادر تُعاد');

  // 3) ردّ بلا بحث فعليّ (grounded=false) ⇒ ثقة low + تنبيه صريح
  routes = [{ test: isGem, reply: () => gem(JSON.stringify({ name_ar: 'منتج', specs: [{ k: 'a', v: 'b' }], confidence: 'high' }), false) }];
  r = await call({ mode: 'product', hint: 'x' });
  ok(r.status === 200 && r.j.searched === false && r.j.product.confidence === 'low' && /لم يثبت/.test(r.j.product.notes), 'بلا بحث فعلي ⇒ confidence=low + تنبيه «لم يثبت أنّ النموذج بحث»');

  // 4) فشل البحث لكن نصّ الصفحة المُدخَلة متاح ⇒ استخراج من الصفحة بلا بحث + إعلان ذلك
  routes = [
    { test: (u) => u === 'https://www.alibaba.com/product-detail/x_1.html', reply: () => HTML(PAGE_OK) },
    { test: isGem, reply: (u, init) => gemBody(init).tools ? J({ error: { message: 'no grounding' } }, 403) : gem(JSON.stringify({ name_ar: 'من الصفحة', specs: [{ k: 'k', v: 'v' }], confidence: 'medium', images: [] })) }];
  r = await call({ mode: 'product', url: 'https://www.alibaba.com/product-detail/x_1.html', hint: 'x' });
  ok(r.status === 200 && r.j.product.name_ar === 'من الصفحة' && /تعذّر البحث/.test(r.j.product.notes) && r.j.page_ok === true, 'تعذّر البحث + صفحة متاحة ⇒ يستخرج منها ويُعلن ذلك');
  ok(r.j.product.images.some(u => /alicdn\.com\/@sc04\/kf\/H111\.jpg$/.test(u)) && r.j.product.images.some(u => /p2\.jpg$/.test(u)) && !r.j.product.images.some(u => /logo/.test(u)), 'صور الصفحة: og:image بالحجم الكامل (بلا _960x960) + img، وبلا الشعار');

  // 5) product_search — Google مؤسَّس: ثلاثة مرشّحين (ok · محجوب 403 · ميّت 404) + رابط مخترَع على نطاق لا يُحَلّ
  const cand = (u, extra = {}) => ({ title: 'T ' + u.slice(-6), source_url: u, match: 'similar', match_reason: 'نفس الموديل', image_urls: [], specs_preview: [{ k: 'السعة', v: '2130mAh' }], price_hint: '$5', ...extra });
  routes = [
    { test: isGem, reply: () => gem(JSON.stringify({ identified: { name_en: 'LP-E6NH', brand: 'Canon' }, candidates: [
      cand('https://www.alibaba.com/product-detail/ok_1.html', { match: 'exact', image_urls: ['https://cdn.example.com/model_img.jpg'] }),
      cand('https://www.aliexpress.com/item/blocked_2.html'),
      cand('https://www.alibaba.com/product-detail/dead_3.html'),
      cand('https://fake-domain-zzz.invalid/item/4.html'),
      cand('https://www.alibaba.com/trade/search?SearchText=lp-e6nh'),
      cand('http://127.0.0.1/admin'),
    ], notes: '' }), true) },
    { test: (u) => u.endsWith('/ok_1.html'), reply: () => HTML(PAGE_OK) },
    { test: (u) => u.endsWith('/blocked_2.html'), reply: () => new Response('denied', { status: 403 }) },
    { test: (u) => u.endsWith('/dead_3.html'), reply: () => new Response('nf', { status: 404 }) },
    { test: (u) => /fake-domain-zzz/.test(u), reply: () => { throw new TypeError('error trying to connect: dns error: failed to lookup address information'); } },
  ];
  r = await call({ mode: 'product_search', hint: 'Canon LP-E6NH battery' });
  ok(r.status === 200 && r.j.searched === true && r.j.engine === 'google', 'product_search ⇒ 200 · searched · engine=google');
  const urls = (r.j.candidates || []).map(c => c.source_url);
  ok(urls.length === 2 && urls[0].endsWith('/ok_1.html') && urls[1].endsWith('/blocked_2.html'), 'يبقى المفحوص والمحجوب فقط (الميّت 404 + النطاق الذي لا يُحَلّ + صفحة بحث + عنوان داخلي ⇒ محذوفة): ' + urls.join(' | '));
  ok(r.j.candidates[0].match === 'exact' && r.j.candidates[0].link_check === 'ok' && r.j.candidates[1].link_check === 'blocked', 'link_check: ok / blocked');
  ok(r.j.candidates[0].image_urls.some(u => /H111\.jpg$/.test(u)) && r.j.candidates[0].image_urls.includes('https://cdn.example.com/model_img.jpg'), 'صور المرشّح = صور الصفحة المفحوصة + ما ذكره النموذج');
  ok(r.j.candidates[0].title.includes('LP-E6NH') && r.j.candidates[0].source_name === 'alibaba.com' && r.j.candidates[0].specs_preview[0].k === 'السعة', 'عنوان من الصفحة · اسم المصدر · معاينة المواصفات');

  // 6) الرابط الذي أدخله الموظّف يُعرَض أوّلاً ولو حجبه الموقع (captcha)
  routes = [
    { test: isGem, reply: () => gem(JSON.stringify({ candidates: [] , notes: 'لا شيء' }), true) },
    { test: (u) => /duckduckgo/.test(u), reply: () => HTML('<html>no results</html>') },
    { test: (u) => u === 'https://www.alibaba.com/product-detail/mine_9.html', reply: () => HTML(CAPTCHA) },
  ];
  r = await call({ mode: 'product_search', url: 'https://www.alibaba.com/product-detail/mine_9.html', hint: 'x' });
  ok(r.status === 200 && r.j.candidates.length === 1 && r.j.candidates[0].source_url.endsWith('mine_9.html') && r.j.candidates[0].link_check === 'blocked' && /الرابط الذي أدخلته/.test(r.j.candidates[0].match_reason), 'رابط الموظّف أوّلاً حتى لو captcha (محجوب) مع تسميته');

  // 7) Google يفشل كلّياً ⇒ احتياطي DuckDuckGo: لا يُقبل إلا رابط من نتائجه (المخترَع يُحذف)
  const DDG = '<html><body>' + [['https://www.alibaba.com/product-detail/dd_1.html', 'LP-E6NH Battery for Canon', 'snippet one'], ['https://www.alibaba.com/product-detail/dd_2.html', 'Another battery', 'snippet two']]
    .map(([u, t, s]) => `<div class="result"><a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=${encodeURIComponent(u)}&amp;rut=abc">${t}</a><a class="result__snippet" href="x">${s}</a></div>`).join('') + '</body></html>';
  routes = [
    { test: isGem, reply: (u, init) => gemBody(init).tools ? J({ error: { message: 'grounding not allowed' } }, 403)
      : gem(JSON.stringify({ candidates: [cand('https://www.alibaba.com/product-detail/dd_1.html', { match: 'exact' }), cand('https://www.alibaba.com/product-detail/invented_7.html')] })) },
    { test: (u) => /html\.duckduckgo\.com/.test(u), reply: () => HTML(DDG) },
    { test: (u) => /dd_1\.html$/.test(u), reply: () => HTML(PAGE_OK) },
    { test: (u) => /invented_7/.test(u), reply: () => HTML(PAGE_OK) },
  ];
  r = await call({ mode: 'product_search', hint: 'Canon LP-E6NH battery' });
  ok(r.status === 200 && r.j.engine === 'duckduckgo' && r.j.searched === true, 'احتياطي DuckDuckGo عند فشل Google: engine=duckduckgo');
  ok(r.j.candidates.length === 1 && r.j.candidates[0].source_url.endsWith('dd_1.html'), 'الرابط المخترَع (ليس في نتائج المحرّك) محذوف ولو كانت صفحته تُفتح: ' + (r.j.candidates || []).map(c => c.source_url).join('|'));
  ok(calls.some(c => /html\.duckduckgo\.com/.test(c.url) && /alibaba/.test(c.init.body)), 'استعلام alibaba أُرسل للمحرّك');

  // 8) كل شيء يفشل ⇒ 502 بسببٍ مقروء
  routes = [{ test: isGem, reply: () => J({ error: { message: 'API key not valid' } }, 400) }, { test: (u) => /duckduckgo/.test(u), reply: () => new Response('x', { status: 503 }) }];
  r = await call({ mode: 'product_search', hint: 'x' });
  ok(r.status === 502 && r.j.code === 'search_unavailable' && /400/.test(r.j.error), 'فشل شامل ⇒ 502 + السبب: ' + (r.j.error || '').slice(0, 100));

  // 9) image_fetch
  routes = [
    { test: (u) => u === 'https://cdn.example.com/a.png', reply: () => new Response(PNG, { status: 200, headers: { 'content-type': 'image/png' } }) },
    { test: (u) => u === 'https://cdn.example.com/evil.png', reply: () => new Response('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>', { status: 200, headers: { 'content-type': 'image/png' } }) },
    { test: (u) => u === 'https://cdn.example.com/big.jpg', reply: () => new Response(new Uint8Array(5 * 1024 * 1024), { status: 200, headers: { 'content-type': 'image/jpeg' } }) },
    { test: (u) => u === 'https://cdn.example.com/redir.jpg', reply: () => new Response('', { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data' } }) },
    { test: (u) => u === 'https://cdn.example.com/gone.jpg', reply: () => new Response('', { status: 403 }) },
  ];
  r = await call({ mode: 'image_fetch', url: 'https://cdn.example.com/a.png', referer: 'https://www.alibaba.com/product-detail/x.html' });
  ok(r.status === 200 && r.j.ok && r.j.type === 'image/png' && r.j.size === PNG.length && Buffer.from(r.j.data, 'base64').equals(Buffer.from(PNG)), 'image_fetch: PNG سليم يعود base64 مطابقاً بنوعه الحقيقي');
  ok(calls[calls.length - 1].init.headers.referer === 'https://www.alibaba.com/product-detail/x.html', 'يُرسَل Referer صفحة المصدر (حماية hotlink)');
  r = await call({ mode: 'image_fetch', url: 'https://cdn.example.com/evil.png' }); ok(r.status === 415 && r.j.code === 'not_image', 'ملف يدّعي image/png وهو SVG ⇒ 415 (الفحص بالبايتات لا بالترويسة)');
  r = await call({ mode: 'image_fetch', url: 'https://cdn.example.com/big.jpg' }); ok(r.status === 413, 'أكبر من 4MB ⇒ 413');
  r = await call({ mode: 'image_fetch', url: 'https://cdn.example.com/redir.jpg' }); ok(r.status === 502 && /غير مسموح/.test(r.j.error), 'تحويلة إلى عنوان داخلي (169.254…) ⇒ تُحجَب');
  r = await call({ mode: 'image_fetch', url: 'http://localhost:8080/x.png' }); ok(r.status === 400, 'localhost ⇒ 400');
  r = await call({ mode: 'image_fetch', url: 'https://10.0.0.5/x.png' }); ok(r.status === 400, 'عنوان خاص ⇒ 400');
  r = await call({ mode: 'image_fetch', url: 'https://user:pw@cdn.example.com/a.png' }); ok(r.status === 400, 'user:pass في الرابط ⇒ 400');
  r = await call({ mode: 'image_fetch', url: 'https://cdn.example.com/gone.jpg' }); ok(r.status === 502 && r.j.code === 'source_refused' && /403/.test(r.j.error), 'المصدر يرفض ⇒ رسالة بسببه (403)');

  // 10) السياق: liveData أوّلاً وقواعد المالك الضخمة لا تأكل الميزانية
  const rules = Array.from({ length: 19 }, (_, i) => 'R' + i + ' ' + 'قاعدة طويلة '.repeat(180));      // ≈ 40KB كما في الواقع
  const ctx = { page: 'inventory.html', rules, guide: { page: 'g', slides: ['شرح'] }, newFeatures: ['ميزة جديدة'], errors: ['خطأ مرصود'], liveData: { products: [{ name: 'عدسة زوم فريدة', haleb: 3 }] } };
  routes = [{ test: isGem, reply: () => gem('جواب من السياق', false) }];
  r = await call({ question: 'كم باقي من عدسة زوم؟', system: 'sys', context: ctx });
  const sent = gemBody(calls[calls.length - 1].init).contents.slice(-1)[0].parts[0].text;
  ok(r.status === 200 && r.j.answer === 'جواب من السياق', 'سؤال عادي ⇒ جواب');
  ok(/عدسة زوم فريدة/.test(sent) && /خطأ مرصود/.test(sent) && /ميزة جديدة/.test(sent), 'liveData + الأخطاء + الميزات الجديدة وصلت للنموذج (كانت تُقصّ بالقواعد)');
  ok(/"_cut":\[/.test(sent) && /rules \(\d+\/19\)/.test(sent), 'ما قُصّ يُعلَن في _cut: ' + (sent.match(/"_cut":\[[^\]]*\]/) || [''])[0]);
  ok(sent.length < 30000, 'حجم السياق ضمن الميزانية: ' + sent.length);
  ok(!('tools' in gemBody(calls[calls.length - 1].init)) && !('web' in r.j), 'بلا web ⇒ بلا أداة بحث ولا حقول grounded');

  // 11) web:true — بحث فعلي ⇒ grounded + sources
  routes = [{ test: isGem, reply: (u, init) => gem('نعم متوافقة [مصدر]', !!gemBody(init).tools) }];
  r = await call({ question: 'هل البطارية LP-E6NH متوافقة مع EOS R6؟', system: 'sys', context: {}, web: true });
  ok(r.status === 200 && r.j.web === true && r.j.grounded === true && r.j.sources.length === 1 && !r.j.search_failed, 'web:true ⇒ grounded + sources');
  ok(gemBody(calls[calls.length - 1].init).tools[0].google_search, 'طُلب البحث فعلاً من Gemini');
  // web:true والبحث مرفوض ⇒ جواب بلا بحث لكن search_failed معلن + ملاحظة للنموذج ألّا يخمّن
  routes = [{ test: isGem, reply: (u, init) => gemBody(init).tools ? J({ error: { message: 'tool not supported' } }, 400) : gem('ما قدرت أتحقق من الإنترنت', false) }];
  r = await call({ question: 'مواصفات Canon R5 II؟', system: 'sys', context: {}, web: true });
  ok(r.status === 200 && r.j.grounded === false && /400/.test(r.j.search_failed) && r.j.answer.includes('ما قدرت أتحقق'), 'web:true + فشل البحث ⇒ search_failed معلن + grounded=false');
  const lastSent = gemBody(calls[calls.length - 1].init).contents.slice(-1)[0].parts[0].text;
  ok(/البحث في الويب غير متاح/.test(lastSent) && /لا تخمّن/.test(lastSent), 'ويُطلب من النموذج صراحةً ألّا يخمّن الحقائق الخارجية');

  // 12) لا مفاتيح
  delete ENV.GEMINI_API_KEY;
  r = await call({ question: 'سؤال', system: '', context: {} }); ok(r.status === 500 && /لا يوجد مفتاح/.test(r.j.error), 'بلا مفاتيح ⇒ 500 برسالة واضحة');
  r = await call({ mode: 'product_search', hint: 'x' }); ok(r.status === 500 && r.j.code === 'no_keys', 'product_search بلا مفاتيح ⇒ no_keys');

  // 13) لا مفتاح API في أي ردّ خطأ
  ENV.GEMINI_API_KEY = 'AIzaSyFAKEFAKEFAKEFAKEFAKEFAKE1234567';
  routes = [{ test: isGem, reply: () => J({ error: { message: 'bad key AIzaSyFAKEFAKEFAKEFAKEFAKEFAKE1234567 rejected' } }, 400) }];
  r = await call({ mode: 'product', hint: 'x' });
  ok(r.status === 502 && !/AIzaSyFAKE/.test(JSON.stringify(r.j)), 'مفتاح API لا يتسرّب في رسالة الخطأ');

  console.log(bad ? ('\n✘ فشل ' + bad) : '\n✔ كل اختبارات الدالّة نجحت');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('استثناء الاختبار:', e); process.exit(2); });
