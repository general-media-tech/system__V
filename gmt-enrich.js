/* ═══════════════════════════════════════════════════════════════════════════
   gmt-enrich.js — إثراء المنتجات بالمواصفات والتوافقيات  ·  2026-09-26
   ───────────────────────────────────────────────────────────────────────────
   طلب المالك:
     «بدي أضفلي هيك أداة في عقل النظام. شغلتها: كل المنتجات اللي عندي، خاصة لمّا
      بدي أبني الجسر — يعني بدي أنقل منتجات الموجودة في الجرد للمتجر — شغلتها
      تبحث على الإنترنت بواسطة الذكاء الاصطناعي… عن المنتجات المتوافقة معهم، إن
      كان هود أو إن كان عدسة، وعن المواصفات الرئيسية **بدون مبالغة أو كتابات ما
      إلها طعمة من الذكاء الاصطناعي أو الفلسفة**: شركة التصنيع، وإذا منتج كهربائي
      شو جهده، إذا بشتغل على البطارية دقيقة عن كل منتج. وطبعاً **تخضع لمراجعة
      الشخص**».

   ⚠️ ثلاثة قيود مبنيّة في التصميم لا تُنقض:
     ① **لا كتابة بلا مراجعة.** الاقتراح يُعرض ويُعتمد بضغطة إنسان. سبب مبدئي:
        المواصفات الخاطئة أسوأ من غيابها — الموظّف يبيع بناءً عليها والزبون يرجع.
     ② **لا نثر ولا تسويق.** حقول قصيرة محدَّدة، والمخطَّط نفسه يمنع الإنشاء:
        ما لا يعرفه الذكاء الاصطناعي يتركه فارغاً ولا يخترعه.
     ③ **المفتاح لا يلمس المتصفّح.** كل النداءات تمرّ عبر وسيط gmt-brain
        (Edge Function) حيث يبقى المفتاح في الخادم.

   الاستعمال:
     const props = await GMTEnrich.propose(products);       // اقتراحات فقط
     GMTEnrich.renderReview(props, containerEl, onApprove);  // لوحة المراجعة
     await GMTEnrich.applyOne(prop);                         // كتابة بعد الموافقة
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  const CFG_KEY = 'gmt_brain_endpoint';      // نفس مفتاح gmt-brain.js — وسيط واحد
  const BATCH   = 6;                          // منتجات لكل نداء — يوازن الدقّة والتكلفة

  function endpoint() {
    try { return localStorage.getItem(CFG_KEY) || ''; } catch (_) { return ''; }
  }

  /* ══ المخطَّط المتَّفق عليه — نفس مفاتيح عمود specs في SQL 37 ══════════════
     المخطَّط هو الحرس: نطلب مفاتيح محدَّدة، ونرفض أي مفتاح خارجها عند التحقّق،
     فلا يتسرّب نصّ تسويقي في حقل لم نطلبه. */
  const ALLOWED = ['accessory_type','mount','filter_thread_mm','attachment','shape',
                   'fits','fits_bodies','voltage_v','capacity_mah','energy_wh',
                   'trigger_voltage_v','guide_number_m','radio_system','hotshoe_protocol',
                   'oem_code','replaces_oem','manufacturer','origin','warranty_months'];

  const TYPES = ['lens','camera','lens_hood','front_cap','rear_cap','body_cap','adapter',
                 'battery','charger','flash','trigger','filter','tripod','bag','memory_card',
                 'microphone','light','gimbal','printer','other'];

  const MOUNTS = ['EF','EF-S','EF-M','RF','RF-S','F','Z','E','A','MFT','L',''];

  /* ⚠️ الاسم `buildPrompt` لا `prompt`: الأخير يُظلّل `window.prompt` المدمجة،
     فأي نداء لها في هذا الملفّ كان سيُصيب دالّتنا بصمت. */
  function buildPrompt(items) {
    return [
      'أنت مساعد فهرسة في متجر تصوير في سوريا (وكيل كانون). مهمّتك: لكل منتج، استخرج',
      'المواصفات والتوافقيات الواقعية فقط.',
      '',
      'قواعد صارمة:',
      '· لا جُمل تسويقية ولا مقدّمات ولا شرح لماذا. حقول فقط.',
      '· ما لا تعرفه يقيناً اتركه فارغاً (null أو ""). **لا تخمّن ولا تخترع**.',
      '· كود الهود لا يُستنتج من قطر الفلتر إطلاقاً — إن لم تعرف العدسة المحدَّدة فاترك fits فارغة.',
      '· الأغطية الأمامية قطريّة: يكفي filter_thread_mm.',
      '· الأغطية الخلفية وأغطية البودي والمحوّلات: المهمّ mount.',
      '· البطاريات: fits_bodies بأسماء الأجسام، مع voltage_v و capacity_mah.',
      '· فلاشات Godox: اللاحقة تحدّد الشركة (-C كانون · -N نيكون · -S سوني · -F فوجي · -O أولمبس).',
      '· search_terms: كلمات **عربية** يكتبها موظّف أو زبون سوري للوصول لهذا المنتج،',
      '  بما فيها التسميات الشعبية والأخطاء الإملائية الشائعة. مثال لهود العدسة 85:',
      '  «هود 85 · هود العدسة 85 · حاجب شمس 85 · هود كانون 85».',
      '· compat: سطر واحد مقروء بالعربية لما يركّب عليه المنتج.',
      '· confidence: عالٍ فقط إن كنت واثقاً من المصدر؛ وإلا متوسّط أو منخفض.',
      '',
      'أعد **JSON صالحاً فقط** بلا أي نصّ قبله أو بعده، بهذا الشكل:',
      '{"items":[{"id":<نفس المعرّف>,"search_terms":"…","compat":"…",',
      ' "specs":{"accessory_type":"…","mount":"…","filter_thread_mm":null,"attachment":"…",',
      ' "shape":"…","fits":[{"brand":"","mount":"","model":"","focal_min":null,"focal_max":null,',
      ' "aperture":null,"version":""}],"fits_bodies":[],"manufacturer":"","voltage_v":null,',
      ' "capacity_mah":null,"oem_code":"","replaces_oem":""},',
      ' "confidence":"high|medium|low","image_queries":["…"],"notes":""}]}',
      '',
      'image_queries: حتى ثلاث عبارات بحث إنكليزية تجد **صوراً بخلفية بيضاء** لهذا',
      'المنتج (مثال: "Canon ET-67 lens hood white background product photo").',
      '',
      'المنتجات:',
      JSON.stringify(items.map(p => ({
        id: p.id, name: p.name, barcode: p.barcode || '', group: p.group_name || '',
        short: p.short || ''
      })), null, 0)
    ].join('\n');
  }

  /* ══ التحقّق — الحرس الحقيقي بين الذكاء الاصطناعي وقاعدتنا ════════════════
     نُنقّي كل حقل بنفسنا. لا نثق بأنّ الردّ التزم المخطَّط: نماذج اللغة تُضيف
     حقولاً وتكتب فقرات في مكان رقم، ومرّةً واحدة تكفي لتلويث الجرد. */
  function clean(raw, byId) {
    const out = [];
    const items = (raw && Array.isArray(raw.items)) ? raw.items : [];
    for (const it of items) {
      const src = byId[String(it && it.id)];
      if (!src) continue;                                  // معرّف لا نعرفه ⇒ يُهمل
      const sp = (it.specs && typeof it.specs === 'object') ? it.specs : {};
      const specs = {};
      for (const k of ALLOWED) {
        let v = sp[k];
        if (v === undefined || v === null || v === '') continue;
        if (k === 'accessory_type') { v = String(v).trim(); if (TYPES.indexOf(v) === -1) continue; }
        else if (k === 'mount')      { v = String(v).trim().toUpperCase(); if (MOUNTS.indexOf(v) === -1) continue; }
        else if (k === 'fits') {
          if (!Array.isArray(v)) continue;
          v = v.slice(0, 12).map(f => ({
            brand: txt(f.brand, 24), mount: txt(f.mount, 8), model: txt(f.model, 64),
            focal_min: numOrNull(f.focal_min), focal_max: numOrNull(f.focal_max),
            aperture: numOrNull(f.aperture), version: txt(f.version, 12)
          })).filter(f => f.model || f.focal_min);
          if (!v.length) continue;
        }
        else if (k === 'fits_bodies') {
          if (!Array.isArray(v)) continue;
          v = v.slice(0, 40).map(x => txt(x, 48)).filter(Boolean);
          if (!v.length) continue;
        }
        else if (/_mm$|_v$|_mah$|_wh$|_m$|_months$/.test(k)) {
          v = numOrNull(v); if (v === null) continue;
        }
        else v = txt(v, 64);
        specs[k] = v;
      }
      out.push({
        id: src.id,
        name: src.name,
        current: { search_terms: src.search_terms || '', compat: src.compat || '' },
        search_terms: txt(it.search_terms, 400),
        compat:       txt(it.compat, 400),
        specs,
        confidence: ['high','medium','low'].indexOf(String(it.confidence)) >= 0 ? String(it.confidence) : 'low',
        image_queries: Array.isArray(it.image_queries) ? it.image_queries.slice(0, 3).map(x => txt(x, 120)).filter(Boolean) : [],
        notes: txt(it.notes, 240),
        /* لا فقرات: أي حقل نصّي طويل جداً علامة نثر لا مواصفات */
        suspect: txt(it.search_terms, 1000).length > 380 || txt(it.compat, 1000).length > 380
      });
    }
    return out;
  }

  function txt(v, max) {
    let s = (v === null || v === undefined) ? '' : String(v);
    s = s.replace(/\s+/g, ' ').trim();
    return s.length > max ? s.slice(0, max).trim() : s;
  }
  function numOrNull(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(String(v).replace(/[^\d.\-]/g, ''));
    return isFinite(n) ? n : null;
  }

  /* يستخرج JSON من ردّ قد يحتويه داخل شرح أو داخل ```json */
  function parseJson(text) {
    const s = String(text || '');
    let t = s.trim();
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) t = fence[1].trim();
    try { return JSON.parse(t); } catch (_) {}
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (_) {} }
    return null;
  }

  async function askBrain(question) {
    const url = endpoint();
    if (!url) throw new Error('وسيط عقل النظام غير مضبوط — اضغط 🧠 ثم «أدخل رابط الوسيط»');
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, context: { mode: 'enrich' } })
    });
    if (!r.ok) throw new Error('HTTP ' + r.status + ' — ' + (await r.text().catch(() => '')).slice(0, 200));
    const d = await r.json();
    return d.answer || d.text || d.content || '';
  }

  /**
   * يقترح مواصفات لمجموعة منتجات. يعمل على دفعات ولا يفشل كلّه بفشل دفعة.
   * @param {Array} products صفوف الجرد
   * @param {Function} onProgress (done, total, message)
   */
  async function propose(products, onProgress) {
    const list = (products || []).filter(p => p && p.id && p.name);
    const out = [], errors = [];
    for (let i = 0; i < list.length; i += BATCH) {
      const chunk = list.slice(i, i + BATCH);
      const byId = {};
      chunk.forEach(p => { byId[String(p.id)] = p; });
      if (onProgress) onProgress(i, list.length, 'يسأل عن ' + chunk.length + ' منتجات…');
      try {
        const answer = await askBrain(buildPrompt(chunk));
        const parsed = parseJson(answer);
        if (!parsed) { errors.push({ ids: chunk.map(p => p.id), why: 'الردّ ليس JSON صالحاً' }); continue; }
        const cleaned = clean(parsed, byId);
        /* منتج طُلب ولم يرد له اقتراح ⇒ يُسجَّل صريحاً. الصمت يجعل المالك يظنّ
           أنّ المنتج أُثري وهو لم يُمسّ. */
        const got = {};
        cleaned.forEach(c => { got[String(c.id)] = 1; });
        chunk.forEach(p => { if (!got[String(p.id)]) errors.push({ ids: [p.id], why: 'ما رجع له اقتراح' }); });
        out.push(...cleaned);
      } catch (e) {
        errors.push({ ids: chunk.map(p => p.id), why: (e && e.message) || 'خطأ غير معروف' });
      }
    }
    if (onProgress) onProgress(list.length, list.length, 'تمّ');
    return { items: out, errors };
  }

  /* ══ الكتابة — بعد موافقة إنسان فقط ══════════════════════════════════════ */
  function mainDb() {
    if (global.GMT_DB && GMT_DB.MAIN) return GMT_DB.MAIN;
    return { url: global.SUPABASE_URL || '', key: global.SUPABASE_ANON_KEY || '' };
  }

  /**
   * يكتب اقتراحاً واحداً بعد اعتماده.
   * متسامح: إن غابت أعمدة SQL 37 يُحاول الحدّ الأدنى ويُخبر بصراحة.
   */
  async function applyOne(prop, who) {
    const db = mainDb();
    if (!db.url || !db.key) throw new Error('إعدادات القاعدة غير متاحة');
    const full = {
      search_terms: prop.search_terms || null,
      compat:       prop.compat || null,
      specs:        (prop.specs && Object.keys(prop.specs).length) ? prop.specs : null,
      specs_source: 'ai',
      specs_checked_at: new Date().toISOString(),
      specs_checked_by: who || (global.getOperatorName ? global.getOperatorName() : '') || null
    };
    const headers = {
      apikey: db.key, Authorization: 'Bearer ' + db.key,
      'Content-Type': 'application/json', Prefer: 'return=minimal'
    };
    const url = db.url + '/rest/v1/products?id=eq.' + encodeURIComponent(prop.id);
    let r = await fetch(url, { method: 'PATCH', headers, body: JSON.stringify(full) });
    if (r.ok) return { ok: true, partial: false };
    /* نمط P1: عمود غير موجود يرفض الطلب كلّه. نُجرّب الحدّ الأدنى كي لا يضيع
       عمل المراجعة، ونقول للمالك صراحةً أنّ SQL 37 لم يُشغَّل بعد. */
    const min = { search_terms: full.search_terms, compat: full.compat };
    r = await fetch(url, { method: 'PATCH', headers, body: JSON.stringify(min) });
    if (r.ok) return { ok: true, partial: true, why: 'حُفظت المرادفات والتوافقيات فقط — عمود specs غير موجود (شغّل SQL 37)' };
    const t = await r.text().catch(() => '');
    throw new Error('HTTP ' + r.status + ' — ' + t.slice(0, 200));
  }

  /* ══ دمج شعارنا على صورة منتج — بلا أي خدمة خارجية ═══════════════════════
     المالك طلب «صورة مدمج فيها شعارنا أو لوجو شركتنا». توليد صور جديدة يحتاج
     خدمة صور لا نملكها في الوسيط، لكن **دمج الشعار** عمل محلّي بحت على canvas
     — فننجزه هنا كاملاً بلا تكلفة ولا انتظار. */
  async function brandImage(imgUrl, opts) {
    opts = opts || {};
    const pad = opts.pad || 0.04, scale = opts.scale || 0.18;
    const img = await loadImg(imgUrl);
    const logoUrl = (global.GMT_BRAND && (GMT_BRAND.logo || GMT_BRAND.imgEmbed)) || 'logo.png';
    const logo = await loadImg(logoUrl).catch(() => null);
    const c = document.createElement('canvas');
    c.width = img.naturalWidth || img.width;
    c.height = img.naturalHeight || img.height;
    const x = c.getContext('2d');
    /* خلفية بيضاء: المالك يريد صوراً بخلفية بيضاء، والصور الشفّافة (PNG) تظهر
       سوداء في بعض تطبيقات المحادثة إن لم نُسطّحها. */
    x.fillStyle = '#ffffff';
    x.fillRect(0, 0, c.width, c.height);
    x.drawImage(img, 0, 0, c.width, c.height);
    if (logo) {
      const lw = c.width * scale;
      const lh = lw * ((logo.naturalHeight || logo.height) / (logo.naturalWidth || logo.width) || 0.3);
      const px = c.width * pad, py = c.height * pad;
      x.globalAlpha = opts.alpha || 0.92;
      x.drawImage(logo, c.width - lw - px, c.height - lh - py, lw, lh);
      x.globalAlpha = 1;
    }
    return c.toDataURL('image/jpeg', opts.quality || 0.92);
  }

  function loadImg(src) {
    return new Promise((res, rej) => {
      const i = new Image();
      i.crossOrigin = 'anonymous';
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('تعذّر تحميل الصورة'));
      i.src = src;
    });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     🧾 لوحة المراجعة — تبني واجهتها بنفسها
     ─────────────────────────────────────────────────────────────────────────
     لا تحتاج أي markup في الصفحة: سطر واحد يفتحها من الجرد أو من الجسر.
     سبب التصميم: نسخة واجهة في كل صفحة تعني اختلافاً في ما يراه المراجع —
     وهذه شاشة **قرار**، لا يجوز أن تختلف. (OWN-SINGLE-SOURCE)

     «طبعاً تخضع لمراجعة الشخص» ⇒ لا زرّ «اعتمد الكل» بلا قراءة: الاعتماد الجماعي
     مقصور على ما ثقته **عالية** وغير مشتبه به، ويُعلَن عدده قبل الضغط.
     ══════════════════════════════════════════════════════════════════════════ */
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  const CONF = { high: ['#065f46', '#d1fae5', 'ثقة عالية'],
                 medium: ['#92400e', '#fef3c7', 'ثقة متوسّطة'],
                 low: ['#991b1b', '#fee2e2', 'ثقة منخفضة'] };

  function specLines(sp) {
    const L = [];
    const label = {
      accessory_type: 'النوع', mount: 'الحربة', filter_thread_mm: 'قطر الفلتر (مم)',
      attachment: 'التثبيت', shape: 'الشكل', manufacturer: 'المصنّع', origin: 'المنشأ',
      voltage_v: 'الجهد (فولت)', capacity_mah: 'السعة (mAh)', energy_wh: 'الطاقة (Wh)',
      trigger_voltage_v: 'جهد الإطلاق', guide_number_m: 'الرقم الدليلي',
      radio_system: 'نظام الراديو', hotshoe_protocol: 'بروتوكول القاعدة',
      oem_code: 'الكود الأصلي', replaces_oem: 'يُكافئ', warranty_months: 'الكفالة (شهر)',
      fits_bodies: 'يعمل مع'
    };
    for (const k of Object.keys(sp || {})) {
      if (k === 'fits') continue;
      const v = Array.isArray(sp[k]) ? sp[k].join(' · ') : sp[k];
      L.push('<span style="display:inline-block;margin:0 0 4px 4px;padding:2px 8px;border-radius:8px;' +
             'background:#f1f5f9;font-size:11px"><b>' + esc(label[k] || k) + ':</b> ' + esc(v) + '</span>');
    }
    if (Array.isArray(sp && sp.fits) && sp.fits.length) {
      L.push('<div style="margin-top:4px;font-size:11px;color:#334155"><b>يركّب على:</b> ' +
        sp.fits.map(f => esc([f.brand, f.mount, f.model, f.version].filter(Boolean).join(' '))).join(' · ') +
        '</div>');
    }
    return L.join('');
  }

  function openPanel(products, opts) {
    opts = opts || {};
    const old = document.getElementById('gmt-enrich-ov');
    if (old) old.remove();
    const ov = document.createElement('div');
    ov.id = 'gmt-enrich-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:2147482000;background:rgba(4,6,10,.86);' +
      'backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;' +
      'font-family:Cairo,Tahoma,sans-serif;direction:rtl;padding:14px';
    ov.innerHTML =
      '<div style="background:#fff;border-radius:18px;width:min(980px,100%);max-height:92vh;display:flex;' +
           'flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.4)">' +
        '<div style="padding:14px 18px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:10px">' +
          '<div style="font-weight:900;font-size:15px;color:#0f172a">🧠 إثراء المنتجات — مواصفات وتوافقيات</div>' +
          '<div id="ge-count" style="font-size:11.5px;color:#526077;font-weight:700"></div>' +
          '<button id="ge-x" style="margin-inline-start:auto;background:#f1f5f9;border:0;border-radius:9px;' +
            'padding:6px 14px;font-weight:800;font-size:12px;cursor:pointer;font-family:inherit">إغلاق</button>' +
        '</div>' +
        '<div style="padding:10px 18px;background:#fffbeb;border-bottom:1px solid #fde68a;font-size:11.5px;' +
             'font-weight:700;color:#92400e;line-height:1.8">' +
          '⚠️ هذه <b>اقتراحات</b> من الذكاء الاصطناعي ولم تُكتب بعد. لا شيء يُحفظ إلا بضغطك «اعتمد». ' +
          'المواصفات الخاطئة أسوأ من غيابها — اقرأ قبل الاعتماد.' +
        '</div>' +
        '<div id="ge-body" style="padding:14px 18px;overflow-y:auto;flex:1"></div>' +
        '<div style="padding:12px 18px;border-top:1px solid #e2e8f0;display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
          '<button id="ge-run" style="background:#0f172a;color:#fff;border:0;border-radius:10px;padding:9px 18px;' +
            'font-weight:900;font-size:12.5px;cursor:pointer;font-family:inherit">▶️ ابدأ الاقتراح</button>' +
          '<button id="ge-all" style="background:#065f46;color:#fff;border:0;border-radius:10px;padding:9px 18px;' +
            'font-weight:900;font-size:12.5px;cursor:pointer;font-family:inherit;display:none">✅ اعتمد عاليةَ الثقة</button>' +
          '<div id="ge-status" style="font-size:11.5px;color:#526077;font-weight:700"></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.onclick = e => { if (e.target === ov) ov.remove(); };
    ov.querySelector('#ge-x').onclick = () => ov.remove();

    const body = ov.querySelector('#ge-body');
    const status = ov.querySelector('#ge-status');
    const cnt = ov.querySelector('#ge-count');
    const list = (products || []).filter(p => p && p.id && p.name);
    cnt.textContent = list.length + ' منتج محدَّد';

    if (!endpoint()) {
      body.innerHTML = '<div style="padding:18px;text-align:center;font-weight:800;color:#991b1b;font-size:13px;line-height:2">' +
        'وسيط عقل النظام غير مضبوط.<br>' +
        '<span style="font-weight:700;color:#475569;font-size:12px">افتح 🧠 عقل النظام ← «أدخل رابط الوسيط»، ' +
        'أو راجع ملفّ <b>تفعيل_عقل_النظام.html</b>. المفتاح يبقى في الخادم ولا يصل المتصفّح.</span></div>';
      ov.querySelector('#ge-run').disabled = true;
      ov.querySelector('#ge-run').style.opacity = .5;
      return ov;
    }

    body.innerHTML = '<div style="color:#526077;font-size:12.5px;font-weight:700;line-height:2">' +
      'سيُسأل عن <b>' + list.length + '</b> منتج على دفعات من ' + BATCH + '.<br>' +
      'المطلوب: مواصفات واقعية · توافقيات · كلمات بحث عربية · عبارات للعثور على صور بخلفية بيضاء.<br>' +
      'لا نثر ولا تسويق: ما لا يعرفه يتركه فارغاً.</div>';

    let props = [];
    ov.querySelector('#ge-run').onclick = async () => {
      const btn = ov.querySelector('#ge-run');
      btn.disabled = true; btn.style.opacity = .6;
      body.innerHTML = '';
      try {
        const res = await propose(list, (d, t, m) => { status.textContent = m + ' (' + d + '/' + t + ')'; });
        props = res.items;
        render(props, res.errors);
        status.textContent = props.length + ' اقتراح · ' + res.errors.length + ' تعذّر';
        const hi = props.filter(p => p.confidence === 'high' && !p.suspect).length;
        const all = ov.querySelector('#ge-all');
        if (hi) { all.style.display = ''; all.textContent = '✅ اعتمد عاليةَ الثقة (' + hi + ')'; }
      } catch (e) {
        body.innerHTML = '<div style="color:#991b1b;font-weight:800;font-size:12.5px">تعذّر: ' + esc(e.message) + '</div>';
      }
      btn.disabled = false; btn.style.opacity = 1;
    };

    ov.querySelector('#ge-all').onclick = async () => {
      const hi = props.filter(p => p.confidence === 'high' && !p.suspect);
      if (!hi.length) return;
      if (!await (window.GMTAsk ? GMTAsk.confirm : function (m) { return Promise.resolve(window.confirm(m)); })('اعتماد ' + hi.length + ' اقتراحاً عالي الثقة وكتابتها في الجرد؟')) return;
      let ok = 0, part = 0, bad = 0;
      for (const p of hi) {
        try { const r = await applyOne(p); ok++; if (r.partial) part++; }
        catch (_) { bad++; }
      }
      status.textContent = 'اعتُمد ' + ok + (part ? ' (منها ' + part + ' جزئياً — شغّل SQL 37)' : '') + (bad ? ' · فشل ' + bad : '');
    };

    function render(items, errors) {
      if (!items.length) {
        body.innerHTML = '<div style="color:#991b1b;font-weight:800;font-size:12.5px">ما رجع أي اقتراح.</div>';
      }
      body.innerHTML = items.map((p, i) => {
        const c = CONF[p.confidence] || CONF.low;
        return '<div data-ge="' + i + '" style="border:1px solid #e2e8f0;border-radius:14px;padding:12px;margin-bottom:10px">' +
          '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
            '<div style="font-weight:900;font-size:13.5px;color:#0f172a">' + esc(p.name) + '</div>' +
            '<span style="background:' + c[1] + ';color:' + c[0] + ';border-radius:8px;padding:2px 9px;' +
              'font-size:10.5px;font-weight:900">' + c[2] + '</span>' +
            (p.suspect ? '<span style="background:#fee2e2;color:#991b1b;border-radius:8px;padding:2px 9px;' +
              'font-size:10.5px;font-weight:900">نصّ طويل — راجعه</span>' : '') +
          '</div>' +
          (p.current.search_terms || p.current.compat
            ? '<div style="margin-top:6px;font-size:11px;color:#526077;font-weight:700">الحالي: ' +
              esc([p.current.search_terms, p.current.compat].filter(Boolean).join(' | ')) + '</div>' : '') +
          '<div style="margin-top:8px"><div style="font-size:11px;font-weight:900;color:#475569;margin-bottom:3px">كلمات البحث</div>' +
            '<textarea data-f="search_terms" rows="2" style="width:100%;font-family:inherit;font-size:12px;' +
              'font-weight:700;padding:7px;border:1px solid #cbd5e1;border-radius:9px;resize:vertical">' +
              esc(p.search_terms) + '</textarea></div>' +
          '<div style="margin-top:6px"><div style="font-size:11px;font-weight:900;color:#475569;margin-bottom:3px">التوافقيات</div>' +
            '<textarea data-f="compat" rows="2" style="width:100%;font-family:inherit;font-size:12px;' +
              'font-weight:700;padding:7px;border:1px solid #cbd5e1;border-radius:9px;resize:vertical">' +
              esc(p.compat) + '</textarea></div>' +
          (Object.keys(p.specs || {}).length
            ? '<div style="margin-top:8px">' + specLines(p.specs) + '</div>'
            : '<div style="margin-top:8px;font-size:11px;color:#5b6472;font-weight:700">بلا مواصفات منظَّمة — لم يعرفها</div>') +
          (p.image_queries.length
            ? '<div style="margin-top:8px;font-size:11px;color:#475569;font-weight:700">🖼️ للبحث عن صور: ' +
              p.image_queries.map(q =>
                '<a href="https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(q) +
                '" target="_blank" rel="noopener" style="color:#A80016;text-decoration:underline">' + esc(q) + '</a>'
              ).join(' · ') + '</div>' : '') +
          (p.notes ? '<div style="margin-top:6px;font-size:11px;color:#526077;font-weight:700">' + esc(p.notes) + '</div>' : '') +
          '<div style="margin-top:9px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">' +
            '<button data-a="ok" style="background:#065f46;color:#fff;border:0;border-radius:9px;padding:6px 15px;' +
              'font-weight:900;font-size:11.5px;cursor:pointer;font-family:inherit">✅ اعتمد</button>' +
            '<button data-a="skip" style="background:#f1f5f9;color:#475569;border:0;border-radius:9px;padding:6px 15px;' +
              'font-weight:900;font-size:11.5px;cursor:pointer;font-family:inherit">تجاهل</button>' +
            '<span data-a="msg" style="font-size:11px;font-weight:800"></span>' +
          '</div>' +
        '</div>';
      }).join('') + (errors && errors.length
        ? '<div style="border:1px dashed #fca5a5;border-radius:12px;padding:10px;font-size:11.5px;' +
          'font-weight:700;color:#991b1b;line-height:1.9">تعذّر على: ' +
          errors.map(e => esc(e.ids.join(',') + ' — ' + e.why)).join(' · ') + '</div>' : '');

      body.querySelectorAll('[data-ge]').forEach(card => {
        const i = Number(card.getAttribute('data-ge'));
        const msg = card.querySelector('[data-a="msg"]');
        card.querySelector('[data-a="skip"]').onclick = () => { card.style.opacity = .35; msg.textContent = 'تُجوهل'; };
        card.querySelector('[data-a="ok"]').onclick = async (ev) => {
          const b = ev.currentTarget;
          b.disabled = true; b.style.opacity = .6;
          /* نأخذ ما في الصندوقين لا ما جاء من الذكاء الاصطناعي: المراجع قد عدّل */
          const p = Object.assign({}, items[i], {
            search_terms: card.querySelector('[data-f="search_terms"]').value.trim(),
            compat:       card.querySelector('[data-f="compat"]').value.trim()
          });
          try {
            const r = await applyOne(p);
            msg.style.color = r.partial ? '#92400e' : '#065f46';
            msg.textContent = r.partial ? '⚠️ ' + r.why : '✅ حُفظ';
            card.style.background = '#f0fdf4';
          } catch (e) {
            msg.style.color = '#991b1b';
            msg.textContent = '❌ ' + e.message;
            b.disabled = false; b.style.opacity = 1;
          }
        };
      });
    }
    return ov;
  }

  global.GMTEnrich = {
    openPanel: openPanel,
    propose: propose,
    applyOne: applyOne,
    brandImage: brandImage,
    prompt: buildPrompt,     // مكشوفة للفحص — يجب أن يرى المالك ما نسأله بالحرف
    clean: clean,
    parseJson: parseJson,
    schema: { allowed: ALLOWED, types: TYPES, mounts: MOUNTS },
    configured: function () { return !!endpoint(); }
  };
})(typeof window !== 'undefined' ? window : this);
