/* ═══════════════════════════════════════════════════════════════════════════
   gmt-suggest.js — محرّك الاقتراح المشترك  ·  2026-09-26
   ───────────────────────────────────────────────────────────────────────────
   لماذا ملفّ مستقلّ؟
     المنطق نفسه مطلوب في **ثلاثة أمكنة على الأقلّ**:
       ① نافذة اللصق الذكي في الأوردرات (يعمل اليوم)
       ② كيبورد المبيعات على أندرويد — «أكتب راس إضاءة فيعرض أسماء منتجاتنا»
       ③ تطبيق ويندوز/أندرويد المستقبلي بالبيانات الأوفلاين
     نسخة في كل مكان تعني ثلاثة معاجم نقحرة تتباعد مع الوقت، وثلاث سلوكيات
     مختلفة للموظّف نفسه. هذا الملفّ هو **المصدر الواحد**. (OWN-SINGLE-SOURCE)

   لا يعتمد على DOM ولا على شبكة ولا على Supabase — دوالّ نقيّة تقبل الكتالوج
   كوسيط، فتعمل كما هي داخل صفحة ويب أو WebView أو Node أو أي غلاف مستقبلي.

   الاستعمال:
     GMTSuggest.match('كانون R6 مارك 2', catalog)   ⇒ {name, score, product}
     GMTSuggest.suggest('راس اضاء', catalog, 8)     ⇒ [{name, score, product}…]
     GMTSuggest.key('عدسة Canon')                   ⇒ مفتاح المقارنة المطبَّع
   حيث catalog = [{ id, name, barcode }]  (يُبنى مرّة عبر GMTSuggest.prepare)
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /* ══ معجم النقحرة (2026-09-26) ══
     الزبون يكتب «كانون R6 مارك 2» ونحن نسمّيه «Canon EOS R6 Mark II». بلا هذا
     المعجم لا يتطابقان إطلاقاً رغم أنهما المنتج نفسه — وهو الحال الغالب في مجالنا.
     يُوحَّد الطرفان إلى الشكل اللاتيني قبل المقارنة (لا يمسّ ما يُكتب للزبون). */
  const AR2LAT = {
      'كانون':'canon','كنون':'canon','سوني':'sony','نيكون':'nikon','نايكون':'nikon',
      'فوجي':'fuji','فوجيفيلم':'fujifilm','باناسونيك':'panasonic',
      'غودكس':'godox','جودكس':'godox','مانفروتو':'manfrotto','سانديسك':'sandisk','ساندسك':'sandisk',
      'لوبرو':'lowepro','زووم':'zoom','رود':'rode','دجي':'dji',
      'مارك':'mark','برو':'pro','ماكس':'max','ميني':'mini','بلس':'plus','اير':'air',
      'كاميرا':'camera','عدسة':'lens','عدسه':'lens','فلاش':'flash','بطارية':'battery','بطاريه':'battery',
      'شاحن':'charger','حامل':'tripod','ترايبود':'tripod','حقيبة':'bag','حقيبه':'bag',
      'ذاكرة':'memory','ذاكره':'memory','بطاقة':'card','بطاقه':'card','كرت':'card',
      'ميكروفون':'mic','مايك':'mic','مايكروفون':'mic','اضاءة':'light','اضاءه':'light','ضوء':'light',
      'راس':'head','ستاند':'stand','مثبت':'gimbal','جيمبل':'gimbal','طابعة':'printer','طابعه':'printer',
      /* (٨ ت — تدقيق المطابقة) طلبك: «اكتب جودوكس أو دي جي اي … أو ابحث هيد لايت 100 وات فيعرف أنّه هيد وأنّه 100 واطيّة» */
      'جودوكس':'godox','غودوكس':'godox','جودو':'godox','غودو':'godox','نانلايت':'nanlite','نان لايت':'nanlite',
      'هيد':'head','لايت':'light','تيوب':'tube','بانل':'panel','بانيل':'panel',
      'وات':'w','واط':'w','واطي':'w','واطيه':'w','فولت':'v','ملم':'mm','مم':'mm'
  };
  const AR_NUM = { 'واحد':'1','اثنين':'2','تنين':'2','ثلاثة':'3','ثلاثه':'3','اربعة':'4','اربعه':'4' };

  /* مفتاح مقارنة: عربي مطبَّع ⇐ لاتيني موحَّد + أرقام — بلا رموز ولا مسافات زائدة */
  /* أرقام شرقية ⇒ لاتينية. عربية-هندية (٠-٩) وفارسية (۰-۹) معاً: بعض لوحات
     المفاتيح على أندرويد تكتب الفارسية وهي تُشبهها بالعين ولا تساويها بالشيفرة. */
  function eastDigits(s) {
      return String(s || '')
          .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
          .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0));
  }

  function prodKey(s) {
      /* (2026-09-26) «r6ii» و«r6 mark ii» و«R6 2» يجب أن تقود للمنتج نفسه.
         نفصل الأرقام الرومانية الملتصقة برمز الموديل قبل التطبيع:
         r6ii ⇒ «r6 ii» ⇒ «r6 2» — وهي حالة كتبها المالك صراحةً في المواصفات. */
      /* ⚠️ الأرقام الشرقية أوّلاً — قبل كل شيء. (عطل حقيقي 2026-09-27)
         لوحة المفاتيح العربية تكتب «٢٤-٧٠» لا «24-70»، فكان مفتاح «عدسه ٢٤-٧٠»
         يخرج «lens ٢٤ ٧٠» ولا يطابق «Canon RF 24-70mm» **إطلاقاً** — العدسة
         الصحيحة تغيب والنتيجة الوحيدة كانت الهود بدرجة 0.30. وكانت قارئة الكميّة
         تحوّل الأرقام الشرقية («عدد ٤» تعمل) فظنّنا الأرقام محلولةً في كل مكان،
         وهي محلولة في مسار واحد فقط. */
      return prodKeyMap(eastDigits(String(s || ''))
          .replace(/([0-9])\s*(i{2,3}|iv)\b/gi, '$1 $2')
          .replace(/[ً-ْـ]/g, '')
          .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
          .toLowerCase()
          .replace(/[^\p{L}\p{N}]+/gu, ' ')
          /* وحدة القياس الملتصقة بالرقم تُفصل: «70mm» ⇒ «70 mm».
             وُلد هذا من حالة حقيقية: «عدسة 24-70» لم تطابق «Canon RF 24-70mm f/2.8»
             إطلاقاً لأنّ «70mm» كلمة لا تساوي «70». ⚠️ نفصل الرقم ثمّ الوحدة فقط،
             ولا نفصل الحرف عن الرقم بعده: «R6» و«V1» رموز موديلات، ولو صارت
             «r 6» لضاع المنتج (الحرف المفرد يُسقَط من الكلمات). */
          .replace(UNIT_RE, ' $1')
          .replace(/\s+/g, ' ').trim());
  }

  /* الأطول أوّلاً كي تُلتقط «mm» قبل «m» */
  const UNIT_RE = /(?<=[0-9])(mm|cm|gb|tb|mb|kb|mah|ah|fps|khz|ghz|hz|mp|nm|inch|kg|ml|in|ft|[wvlgkm])\b/gi;

  /* ══════════════════════════════════════════════════════════════════════════
     🔤 أسماء الحروف بالعربي — (2026-09-26 · بلاغ المالك)
     ─────────────────────────────────────────────────────────────────────────
     «كتبت له كانون ار بي، هو اختار كانون ار. كتبت له واي ام 600 اس اس فهو اختار
      واي ام 600 اس اس كومبو بلس».
     الزبون يهجّئ رمز الموديل بأسماء الحروف: «ار بي» = RP · «واي ام» = YM ·
     «اس اس» = SS. وبلا هذا المعجم لا تشبه «كانون ار بي» كلمةَ «RP» بحرف واحد،
     فيقع المحرّك على أقرب شيء ناقص («كانون ار») — وهو منتج **مختلف تماماً**.

     ⚠️ بعض الأسماء ملتبسة: «بي» = B أو P · «جي» = G أو J · «اي» = A أو E أو I.
     فنولّد **عدّة قراءات** (بسقف) ونأخذ أقواها بدل أن نخمّن قراءةً واحدة.
     ثمّ نلصق الحروف المفردة المتجاورة: «y m 600 s s» ⇒ «ym600ss».
     ══════════════════════════════════════════════════════════════════════════ */
  const AR_LETTER = {
      'اي':['a','e','i'], 'ايه':['a'], 'آي':['i'],
      'بي':['p','b'], 'سي':['c'], 'دي':['d'], 'اف':['f'],
      'جي':['g','j'], 'جاي':['j'], 'اتش':['h'], 'كي':['k'], 'كيه':['k'],
      'ال':['l'], 'ام':['m'], 'ان':['n'], 'او':['o'],
      'كيو':['q'], 'ار':['r'], 'اس':['s'], 'تي':['t'], 'يو':['u'],
      'في':['v'], 'دبليو':['w'], 'اكس':['x'], 'واي':['y'], 'زد':['z'], 'زي':['z']
  };
  const MAX_READINGS = 6;          // سقف: لا نُفجّر الاحتمالات على جملة طويلة

  /* هل في النصّ أسماء حروف أصلاً؟ (نتجنّب العمل الزائد على الغالب) */
  function hasLetterNames(s) {
      const w = String(s || '').split(/[^\p{L}\p{N}]+/u);
      for (let i = 0; i < w.length; i++) {
          const n = w[i].replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').toLowerCase();
          if (AR_LETTER[n]) return true;
      }
      return false;
  }

  /**
   * قراءات محتملة للنصّ بعد ترجمة أسماء الحروف ولصق المفردات.
   * يرجع مصفوفة نصوص (الأصل أوّلها دائماً).
   */
  function letterReadings(text) {
      const raw = String(text || '');
      if (!hasLetterNames(raw)) return [raw];
      const words = raw.split(/\s+/).filter(Boolean);
      /* نبني بدائل كل كلمة: إمّا [نفسها] أو قائمة حروفها المحتملة */
      const slots = words.map(w => {
          const n = w.replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').toLowerCase()
                     .replace(/[^\p{L}\p{N}]/gu, '');
          return AR_LETTER[n] ? AR_LETTER[n] : [w];
      });
      let outs = [[]];
      for (const alts of slots) {
          const next = [];
          for (const base of outs) {
              for (const a of alts) {
                  next.push(base.concat([a]));
                  if (next.length >= MAX_READINGS * 4) break;
              }
              if (next.length >= MAX_READINGS * 4) break;
          }
          outs = next;
      }
      /* لصق الحروف المفردة المتجاورة: «y m 600 s s» ⇒ «ym600ss» */
      const joined = outs.slice(0, MAX_READINGS).map(arr => {
          const parts = [];
          let buf = '';
          for (const t of arr) {
              if (t.length === 1 || /^[0-9]+$/.test(t)) buf += t;
              else { if (buf) { parts.push(buf); buf = ''; } parts.push(t); }
          }
          if (buf) parts.push(buf);
          return parts.join(' ');
      });
      const uniq = [raw];
      joined.forEach(j => { if (j && uniq.indexOf(j) === -1) uniq.push(j); });
      return uniq.slice(0, MAX_READINGS + 1);
  }

  /* ══════════════════════════════════════════════════════════════════════════
     💵 السعر من نصّ الزبون — (2026-09-26 · بلاغ المالك)
     ─────────────────────────────────────────────────────────────────────────
     «أصبح لا يفهم السعر: كلمة السعر بجانبها رقم ما عرفها وحطّها منتَج، أو كلمة
      100$ أيضاً ما عرفها».
     وهذا أخطر ممّا يبدو: «100$» دخلت حقلَ المنتجات فطابقها المحرّك بـ«ym s100»
     — منتج لا علاقة له. فالسعر يُنتزع **قبل** المطابقة، ويُحذف من نصّ المنتجات.
     ⚠️ لا نلتقط أي رقم: نطلب علامة صريحة (سعر · $ · دولار · ل.س) كي لا نأكل
     مقاس عدسة («24-70») ولا رمز موديل («R6»).
     ══════════════════════════════════════════════════════════════════════════ */
  const _NUM = '[0-9\u0660-\u0669]{1,3}(?:[.,][0-9\u0660-\u0669]{1,3})?(?:[0-9\u0660-\u0669]{0,3})?';
  const PRICE_RE = new RegExp(
        '(?:(?:ال)?(?:سعر|سعره|السعر|بسعر|الحساب|المبلغ|بمبلغ|القيمة|قيمته)\\s*[:：]?\\s*'
      +   '(' + _NUM + ')\\s*(?:\\$|دولار|usd|د\\.?أ|ل\\.?س|ليرة|ليره)?)'
      + '|(?:(' + _NUM + ')\\s*(?:\\$|دولار|usd))'
      + '|(?:\\$\\s*(' + _NUM + '))'
      + '|(?:(' + _NUM + ')\\s*(?:ل\\.?س|ليرة|ليره|سوري))',
        'giu');

  /**
   * ينتزع السعر وينظّف النصّ منه.
   * @returns {{amount:number|null, currency:'usd'|'syp'|'', clean:string, phrase:string}}
   */
  function priceOf(text) {
      const raw = String(text || '');
      let amount = null, currency = '', phrase = '';
      const cuts = [];
      PRICE_RE.lastIndex = 0;
      let m;
      while ((m = PRICE_RE.exec(raw)) !== null) {
          if (m[0].length === 0) { PRICE_RE.lastIndex++; continue; }
          const tok = m[1] || m[2] || m[3] || m[4] || '';
          if (!tok) continue;
          const v = parseFloat(digitsToLatin(tok).replace(',', '.'));
          if (!isFinite(v) || v <= 0) continue;
          if (amount === null) {
              amount = v;
              phrase = m[0].trim();
              /* ⚠️ الدولار يُفحَص أوّلاً، وعلامة الليرة تُطلَب **كلمةً مستقلّة**.
                 وقعتُ في هذا: النمط `ل.س` يطابق «لس» **داخل كلمة «السعر»** نفسها،
                 فصار «السعر 100$» يُقرأ ليرةً سورية. أي فحصٍ بلا حدود كلمة على
                 نصّ عربي يُصيب وسط الكلمات. */
              currency = /\$|دولار|usd/i.test(m[0]) ? 'usd'
                       : /(?:^|[\s\d])(?:ل\.?\s?س|ليرة|ليره|سوري)(?=$|[^\p{L}])/u.test(m[0]) ? 'syp'
                       : '';
          }
          cuts.push([m.index, m.index + m[0].length]);
      }
      let clean = raw;
      for (let i = cuts.length - 1; i >= 0; i--) clean = clean.slice(0, cuts[i][0]) + ' ' + clean.slice(cuts[i][1]);
      clean = clean.replace(/[ \t]+/g, ' ')
                   .replace(/^[\s,،\-–—:|]+/, '').replace(/[\s,،\-–—:|]+$/, '').trim();
      return { amount, currency, clean, phrase };
  }

  /* المفتاح بلا مسافات — حصانة ضدّ الفواصل والتباعد (طلب المالك):
     «أحياناً نكتب أساميهم مي نظامية مثلاً ym 600 ss… أو غلط في كتابة الأحرف أو
      تباعد أو فواصل ما انتبهنا عليها… ما ياخذ بس أوّل حرفين، وكان في فاصلة
      وما فيها ذاك فاصلة خلاص يعتبره غير شيء».
     فـ«YM600SS» و«ym 600 ss» و«ym-600-ss» تُصبح «ym600ss» ⇒ تطابق تامّ. */
  function prodFlat(s) { return prodKey(s).replace(/ /g, ''); }
  function isNum(w) { return /^[0-9]+$/.test(w || ''); }
  /* يطبّق المعجم كلمةً كلمة، ويوحّد الأرقام الرومانية الشائعة في أسماء الكاميرات */
  function prodKeyMap(base) {
      return base.split(' ').map(w => {
          if (AR2LAT[w]) return AR2LAT[w];
          if (AR_NUM[w]) return AR_NUM[w];
          if (w === 'ii')  return '2';
          if (w === 'iii') return '3';
          if (w === 'iv')  return '4';
          if (w === 'eos') return '';          // كلمة عامّة لا تميّز منتجاً
          return w;
      }).filter(Boolean).join(' ');
  }
  function prodTokens(s) { return prodKey(s).split(' ').filter(w => w.length >= 2); }


  /* ══════════════════════════════════════════════════════════════════════════
     🎯 دالّة التنقيط — **واحدة** يستعملها matchProduct و suggest معاً
     ─────────────────────────────────────────────────────────────────────────
     كان التنقيط مكتوباً مرّتين في هذا الملفّ نفسه بعتبات مختلفة (0.92 هنا
     و0.90 هناك)، فكان المنتج يُعتمد تلقائياً في مكان ويُعرض اقتراحاً في آخر —
     وهو بالضبط التضارب الذي أُنشئ هذا الملفّ لإنهائه. (OWN-SINGLE-SOURCE)
     ══════════════════════════════════════════════════════════════════════════ */
  /* نوافذ متجاورة من كلمات الاستعلام، بلا فواصل، الأطول أوّلاً.
     ─────────────────────────────────────────────────────────────────────────
     السبب: الزبون يكتب جملةً لا اسماً. «ym 600 ss عندكم؟» كان لا يُطابق
     «YM600SS» إطلاقاً لأنّ كلمة «عندكم» تُفسد المفتاح بلا فواصل للجملة كلّها.
     فنجرّب نوافذ داخلية أيضاً. حدّ 5 أحرف ونافذتان على الأقلّ مقصود: النوافذ
     القصيرة («2470») تطابق أرقام موديلات غير ذات علاقة. */
  function flatWindows(qt) {
      const out = [];
      for (let len = qt.length; len >= 2; len--) {
          for (let i = 0; i + len <= qt.length; i++) {
              const w = qt.slice(i, i + len).join('');
              if (w.length >= 5 && out.indexOf(w) === -1) out.push(w);
          }
      }
      /* كلمة مفردة طويلة **فيها رقم** هي غالباً رمز موديل («ym600ss») — دليل قويّ.
         شرط الرقم ليس تجميلاً: بلا شرطٍ صارت «flash» نافذةً مفردة، فطابقت
         «عندكم فلاش غودكس V1؟» منتجَ «YM600SS Studio **Flash**» — أي فلاشاً
         آخر تماماً. كلمات الفئة العامّة (فلاش · عدسة · كاميرا) لا تميّز منتجاً. */
      for (let i = 0; i < qt.length; i++)
          if (qt[i].length >= 5 && /[0-9]/.test(qt[i]) && out.indexOf(qt[i]) === -1) out.push(qt[i]);
      return out;
  }

  function scoreOf(pkey, pname, q, qt, qFlat, qWins) {
      if (!pkey) return null;
      const pFlat = pkey.replace(/ /g, '');
      if (pkey === q)                                      return { sc: 1.00, why: 'تطابق تامّ' };
      if (qFlat.length >= 3 && pFlat === qFlat)            return { sc: 0.97, why: 'تطابق بلا فواصل' };
      /* ⚠️ رقم قصير عريان (≤3 خانات) لا يُعتمد بالاحتواء: «100» موجودة داخل
         «YM S100» فكانت تُعطي 0.90 — أي اعتماداً تلقائياً لمنتج لا علاقة له.
         هذا جذر بلاغ المالك «أعطيته 100$ فاختار ym s100». الأرقام الطويلة
         (جزء باركود) تبقى مقبولة. */
      const weakQ = /^[0-9]{1,3}$/.test(q);
      if (!weakQ && q.length >= 2 && pkey.indexOf(q) !== -1) return { sc: 0.90, why: 'الاسم يحتوي ما كُتب' };
      /* ⚠️ «ما كُتب يحتوي الاسم» ليس دليل هويّة إن بقي في المكتوب ما لا يفسّره
         الاسم. (🔴 بلاغ المالك 2026-09-26: «كتبت له كانون ار بي فاختار كانون ار».)
         «canon r p» تحتوي «canon r» فأُعطيت 0.86 — أي فوق حدّ الاعتماد التلقائي —
         فاعتُمد منتجٌ آخر، والحرف الباقي «p» هو بالضبط ما يفرّق RP عن R.
         فالباقي إن كان **مميِّز موديل** (فيه رقم، أو حرفان لاتينيّان أو ثلاثة)
         ⇒ ننزل إلى نطاق «بدّه تحديد» فيسأل الموظّفَ ولا يقرّر عنه.
         والباقي إن كان كلمة طلب عاديّة («بدي» · «عندكم») فلا يغيّر شيئاً. */
      if (pkey.length >= 4) {
          const at = q.indexOf(pkey);
          if (at !== -1) {
              const rest = (q.slice(0, at) + ' ' + q.slice(at + pkey.length)).trim();
              const undecided = rest.split(/\s+/).some(function (w) {
                  return w && (/[0-9]/.test(w) || (/^[a-z]+$/.test(w) && w.length <= 3));
              });
              return undecided
                  ? { sc: 0.72, why: 'الاسم داخل المكتوب — وبقي ما لم يُفسَّر: ' + rest }
                  : { sc: 0.86, why: 'ما كُتب يحتوي الاسم' };
          }
      }

      /* ⚠️ من هنا لا نعود بأوّل ما نجد بل بـ**أقوى** ما نجد.
         أوّل نسخة كانت تُرجع نتيجة النوافذ فوراً، فهبط «فلاش غودكس V1» من 1.00
         إلى 0.82 لأنّ النافذة قصَرت الطريق على تشابه الكلمات الأقوى منها. */
      let best = null;
      const keep = (sc, why) => { if (!best || sc > best.sc) best = { sc: sc, why: why }; };

      if (qFlat.length >= 4 && pFlat.indexOf(qFlat) !== -1) keep(0.84, 'احتواء بلا فواصل');
      if (qWins) for (let i = 0; i < qWins.length; i++) {
          if (pFlat === qWins[i])             { keep(0.88, 'تطابق جزء من الجملة'); break; }
          if (pFlat.indexOf(qWins[i]) !== -1) { keep(0.82, 'جزء من الجملة في الاسم'); break; }
      }

      const pts = prodTokens(pname);
      if (!pts.length) return best;
      const pset = Object.create(null);
      for (let a = 0; a < pts.length; a++) pset[pts[a]] = 1;

      let hit = 0, qNums = 0, qNumsHit = 0;
      for (let b = 0; b < qt.length; b++) {
          const w = qt[b], num = isNum(w);
          if (num) qNums++;
          if (pset[w]) { hit += 1; if (num) qNumsHit++; continue; }
          /* بادئة: «اضاء» ⇒ «اضاءة». الأرقام من طول 2 لأنّها مميّزة أصلاً،
             والكلمات من طول 3 كي لا تتطابق بحروف عابرة. */
          const min = num ? 2 : 3;
          if (w.length >= min) {
              for (let c = 0; c < pts.length; c++)
                  if (pts[c].indexOf(w) === 0) { hit += 0.8; if (num) qNumsHit++; break; }
          }
      }
      if (!hit) return best;
      /* الاسم الرسمي أطول من كتابة الزبون دائماً، فالقسمة على طوله كانت تظلم
         المنتج الصحيح («عدسة 24-70» مقابل «Canon RF 24-70mm f/2.8»).
         المقام الآن الأكبر من الطرفين. */
      const cover = hit / qt.length;
      const focus = hit / Math.max(pts.length, qt.length);
      let sc = cover * 0.75 + focus * 0.25;
      /* كل أرقام الاستعلام موجودة ⇒ دليل قويّ (24-70 تكفي لتمييز العدسة).
         مكافأة محدودة: لا ترفع وحدها إلى حدّ الاعتماد التلقائي (0.80). */
      if (qNums > 0 && qNumsHit >= qNums) sc = Math.min(0.79, sc + 0.12);
      keep(sc, 'تشابه');
      return best;
  }

  /* يرجع {name, score, product, why} — score من 0 إلى 1 */
  function matchProduct(text, catalog) {
      const r = suggest(text, catalog, 1, 0);
      return r.length ? r[0] : null;
  }

  function suggest(query, catalog, limit, minScore) {
    if (!catalog || !catalog.length) return [];
    /* عدّة قراءات: الأصل + ترجمة أسماء الحروف («ار بي» ⇒ rp). نُنقّط كلّاً منها
       ونأخذ الأقوى — أفضل من تخمين قراءة واحدة والوقوع على منتج مختلف. */
    const reads = letterReadings(query).map(function (r) {
        return { q: prodKey(r), qt: prodTokens(r), flat: prodFlat(r) };
    }).filter(function (r) { return r.q && r.qt.length; });
    if (!reads.length) return [];
    for (let i = 0; i < reads.length; i++) reads[i].wins = flatWindows(reads[i].qt);
    const q = reads[0].q;
    const min = (typeof minScore === 'number') ? minScore : 0.3;

    /* باركود مكتوب صراحةً ⇒ تطابق مؤكّد يتقدّم على كل شيء */
    const digits = String(query || '').match(/\d{6,}/g) || [];
    for (let d = 0; d < digits.length; d++) {
      for (let i = 0; i < catalog.length; i++)
        if (catalog[i].barcode && String(catalog[i].barcode) === digits[d])
          return [{ name: catalog[i].name, score: 1, product: catalog[i], why: 'باركود' }];
    }

    const out = [];
    for (let i = 0; i < catalog.length; i++) {
      const p = catalog[i];
      const pk = p.k || prodKey(p.name);
      let r = null;
      for (let j = 0; j < reads.length; j++) {
        const rd = reads[j];
        const s1 = scoreOf(pk, p.name, rd.q, rd.qt, rd.flat, rd.wins);
        if (s1 && (!r || s1.sc > r.sc)) r = s1;
        /* لم يكفِ الاسم ⇒ جرّب المواصفات والتوافقيات. الوزن ×0.95 كي يتقدّم
           تطابق الاسم على تطابق الوصف عند تساوي القوّة — الاسم أدقّ دليل. */
        if (p.ak) {
          /* ⚠️ الوسيط الأخير هو مفتاح **الاستعلام** بلا فواصل — لا مفتاح المنتج.
             تمريري مفتاح المنتج هنا جعل الدالّة تقارن المنتج بنفسه فتُرجع 0.97
             لكل منتج له وصف، فتساوت كل النتائج عند 0.92 وصار البحث بلا معنى. */
          const ra = scoreOf(p.ak, p.aname, rd.q, rd.qt, rd.flat, rd.wins);
          if (ra) {
            const scA = ra.sc * 0.95;
            if (!r || scA > r.sc) r = { sc: scA, why: 'من المواصفات والتوافقيات' };
          }
        }
      }
      if (r && r.sc >= min) out.push({ name: p.name, score: r.sc, product: p, why: r.why, _k: pk });
    }
    /* ══ الترتيب: الدرجة أوّلاً، ثمّ **الأقرب طولاً** ══════════════════════════
       بلاغ المالك: «كتبت واي ام 600 اس اس فاختار YM600SS كومبو بلس».
       كلا الاسمين يحتوي ما كُتب، فتساوت درجتهما وفاز أوّلهما في ترتيب الجرد —
       أي بالحظّ. الأقرب طولاً إلى ما كتبه الزبون هو الأرجح أنّه مقصوده،
       والزيادة الطويلة («كومبو بلس») غالباً نسخة أخرى من المنتج. */
    out.sort(function (x, y) {
      if (y.score !== x.score) return y.score - x.score;
      const dx = Math.abs((x._k || '').length - q.length);
      const dy = Math.abs((y._k || '').length - q.length);
      if (dx !== dy) return dx - dy;
      return (x._k || '').length - (y._k || '').length;
    });
    /* ══ التقارب: نتيجتان متساويتان ⇒ **لا قرار** ═══════════════════════════
       🔴 بلاغ المالك: «كتبت واي ام 600 اس اس فاختار YM600SS كومبو بلس».
       الاسمان كلاهما يحتوي «ym600ss» فتساوت درجتهما (0.90)، وكان الفرق يُحسَم
       بأقرب طول — وهذا **حظّ لا دليل**: «كومبو بلس» أقصر من «Studio Flash»
       فكسب، مع أنّ المنتج الأساس هو الثاني. الطول لا يعرف أيّهما الأصل.
       ⇒ حين يتساوى الأوّلان (فرق ≤ 0.02) ولا يكون التطابق تامّاً ولا باركوداً،
         نضع علامة tie فلا يُعتمَد أحدهما تلقائياً ويُسأل الموظّف — وهو نصّ طلبه:
         «واذا ما عرف يحط المنتج ولكن يعطيه بلون انه اللي بده تعديل».
       ولا نحذف الترتيب: القائمة المنسدلة تحتاج ترتيباً، لكنّه صار عرضاً لا حكماً. */
    if (out.length > 1 && out[0].score < 1 && out[0].why !== 'باركود'
        && (out[0].score - out[1].score) <= 0.02) {
      for (let i = 0; i < out.length; i++)
        if ((out[0].score - out[i].score) <= 0.02) out[i].tie = true;
    }
    for (let i = 0; i < out.length; i++) delete out[i]._k;
    return out.slice(0, limit || 8);
  }

  /* يجهّز الكتالوج مرّة: يحسب مفتاح المقارنة سلفاً.
     حساب المفتاح لكل منتج مع كل ضغطة حرف يجعل القائمة تتلعثم على 3000 منتج. */
  function prepare(rows) {
    return (rows || []).filter(function (p) { return p && p.name; }).map(function (p) {
      /* ══ المفتاح الثاني: المواصفات والتوافقيات والمرادفات ══════════════════
         (2026-09-26 · طلب المالك) «عندي كلمة هود، فأنا كاتب اسم الهود ككود من
          الشركة… لمّا أكتب هود العدسة 85 — في الجرد ما راح يكون اسمه هود العدسة
          85، راح يكون اسمه ET-67 مثلاً. ولكن لمّا ألصق أو أبحث فهو يعرفها».
         فالاسم وحده لا يكفي: «ET-67» لا تشبه «هود العدسة 85» بحرف واحد.
         نبني مفتاحاً ثانياً من الوصف القصير + مصطلحات البحث + التوافقيات،
         ونُطابق عليه بوزن أقلّ قليلاً كي يتقدّم الاسم عند تساوي القوّة. */
      var alias = [p.short, p.search_terms, p.compat, p.group_name]
                    .filter(Boolean).join(' ');
      return { id: p.id, name: String(p.name),
               barcode: p.barcode ? String(p.barcode) : '',
               price: p.price, qty: p.qty,
               image_url: p.image_url, store_url: p.store_url, group_name: p.group_name,
               short: p.short || '', search_terms: p.search_terms || '', compat: p.compat || '',
               k: prodKey(p.name),
               ak: alias ? prodKey(alias) : '',
               aname: alias };
    });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     🔢 الكميّة من نصّ الزبون — (2026-09-26 · طلب المالك)
     ─────────────────────────────────────────────────────────────────────────
     «لما بكتب منتج بكتب جنبه عدد اثنين أو عدد ثلاثة، لحاله ياخذ العدد على أنّه
      عدد — ما يحطّوا عدد واحد. أوّل ما بكتب اكس 2 أو ضرب اثنين أو ضرب ثلاثة يعني
      هو يعرف إنّها قيمة عددية».
     فثلاث عائلات من العلامات: «عدد N» · «ضرب N» · «اكس N» (و x × *)، والرقم
     إمّا خانات (2 · ٢) أو كلمة (اثنين · تلاتة). تُحذف العبارة من الاسم قبل
     المطابقة، وإلا صار «عدسة 24-70 عدد 2» اسمَ منتجٍ لا يوجد في الجرد.

     ⚠️ حرّاس مقصودة — كلٌّ منها حالة تُفسد الأسماء لو غابت:
       · «x» بعد رقم ليست كميّة: «24x36» مقاس لا «24 عدد 36».
       · العلامة لا تُقتنص من داخل كلمة: «Max» فيها x لكنها ليست «اكس».
       · «R6 مارك 2» ليست كميّة — «مارك» ليست علامة كميّة إطلاقاً.
       · «عدد» **قبل** الرقم فقط. أضفتُ أوّلاً «رقم + عدد» (موروثة من نسخة قديمة)
         فصار «عدسة 24-70 عدد 2» يُقرأ كميّة **70**! والاسم «عدسة 24- 2».
         أي «70 عدد» ليست سبعين قطعة — والصيغة التي يكتبها المالك «عدد 2».
         الوحدات الصريحة (قطعة · حبة) تبقى مقبولة بعد الرقم لأنّها لا تلتبس.
     تُطابَق أشكال الإملاء العربية هنا مباشرةً ([اأإ] · [ةه]) بدل استدعاء مطبِّع
     خارجي: هذا الملفّ يجب أن يبقى نقيّاً بلا اعتماد على أي ملفّ آخر ليعمل
     كما هو داخل الكيبورد وتطبيق أندرويد. (OWN-SINGLE-SOURCE)
     ══════════════════════════════════════════════════════════════════════════ */
  const QTY_WORDS = {
      'واحد':1,'واحده':1,'واحدة':1,'وحده':1,'وحدة':1,
      'اثنين':2,'أثنين':2,'إثنين':2,'اتنين':2,'أتنين':2,'تنين':2,'اثنتين':2,
      'ثلاثة':3,'ثلاثه':3,'تلاتة':3,'تلاته':3,'ثلاث':3,
      'اربعة':4,'اربعه':4,'أربعة':4,'أربعه':4,'اربع':4,
      'خمسة':5,'خمسه':5,'خمس':5,'ستة':6,'سته':6,'ست':6,
      'سبعة':7,'سبعه':7,'سبع':7,'ثمانية':8,'ثمانيه':8,'تمانية':8,'تمانيه':8,
      'تسعة':9,'تسعه':9,'تسع':9,'عشرة':10,'عشره':10,'عشر':10
  };
  /* «٢٥» ⇒ 25 — الموظّف والزبون يكتبان بالخانات العربية كثيراً.
     مصدر واحد مع مفتاح المنتج (eastDigits) كي لا يعود مسارٌ يفهم الأرقام
     الشرقية ومسارٌ لا يفهمها. */
  function digitsToLatin(s) { return eastDigits(s); }

  const _W = Object.keys(QTY_WORDS).sort((a, b) => b.length - a.length).join('|');
  const _N = '[0-9٠-٩۰-۹]{1,3}';
  /* ① «عدد/ضرب/اكس» + رقم أو كلمة   ② رمز ضرب + رقم (ليس بعد رقم)   ③ رقم + قطعة/حبة */
  const QTY_RE = new RegExp(
      '(?:(?:عدد|العدد|ضرب|[اأإ]كس)\\s*[:：]?\\s*(' + _N + '|' + _W + '))'
    + '|(?:(?<![0-9٠-٩۰-۹\\p{L}])[x×X*✕]\\s*(' + _N + ')(?![\\p{L}]))'
    + '|(?:(' + _N + ')\\s*(?:قطع[ةه]|قطع|حب[ةه]|حبات))',
      'gu');

  /**
   * يستخرج الكميّة وينظّف النصّ منها.
   * @returns {{qty:number, clean:string, found:boolean, phrase:string}}
   */
  function qtyOf(text) {
      const raw = String(text || '');
      let qty = 1, found = false, phrase = '';
      const cuts = [];
      QTY_RE.lastIndex = 0;
      let m;
      while ((m = QTY_RE.exec(raw)) !== null) {
          const tok = m[1] || m[2] || m[3] || '';
          if (!tok) continue;
          let v = QTY_WORDS[tok];
          if (v === undefined) v = parseInt(digitsToLatin(tok), 10);
          if (!isFinite(v) || v < 1) continue;
          v = Math.min(999, Math.max(1, v));
          if (!found) { qty = v; phrase = m[0].trim(); found = true; }
          cuts.push([m.index, m.index + m[0].length]);
          if (m[0].length === 0) QTY_RE.lastIndex++;              // حارس ضدّ الدوران
      }
      let clean = raw;
      for (let i = cuts.length - 1; i >= 0; i--) clean = clean.slice(0, cuts[i][0]) + ' ' + clean.slice(cuts[i][1]);
      clean = clean.replace(/[ \t]+/g, ' ').replace(/^[\s,،\-–—:|*×x]+/i, '')
                   .replace(/[\s,،\-–—:|]+$/, '').trim();
      /* أرضية أمان: لو لم يبقَ اسم فالعبارة كانت هي المنتج نفسه ⇒ نُعيد الأصل بكميّة 1.
         («عدد 2» وحده على سطر ليس منتجاً، لكن حذفه يترك سطراً فارغاً — والأصل أنفع للموظّف.) */
      if (!clean) return { qty: 1, clean: raw.trim(), found: false, phrase: '' };
      return { qty, clean, found, phrase };
  }

  /* ═════════════════════════════════════════════════════════════════
     🔎 hits — بحثُ القوائم المشترك (٨ ت — تدقيق المطابقة · «صهر»)
     ─────────────────────────────────────────────────────────────────
     كان لكل صفحةٍ بحثُها: الجرد يطابق العبارة كاملةً متّصلة («هيد لايت 100» ⇐ صفر نتائج والمنتج
     اسمه «هيد لايت … 100W»)، ونقطة البيع تبحث في الاسم والباركود فقط (لا الماركة ولا المجموعة).
     الآن: كلُّ كلمةٍ في البحث يجب أن تُوجَد — بأيّ ترتيب — في الاسم أو الوصف أو الباركود أو المجموعة
     أو التصنيف أو الماركة أو الأسماء البديلة، بعد التطبيع والنقحرة نفسها التي يستعملها المطابِق
     («جودوكس» = Godox · «100 وات» = 100W · «دي جي اي» = DJI). مصدرٌ واحد للجرد ونقطة البيع وإدارة المنتجات.
     ═════════════════════════════════════════════════════════════════ */
  function _arN(s) {
      return eastDigits(String(s == null ? '' : s)).replace(/[ً-ْـ]/g, '')
          .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ء/g, '').toLowerCase()   // (TASK-0185) «غطاء» = «غطا»
          .replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
  }
  function hayOf(text) { return ' ' + _arN(text) + ' ' + prodKey(text) + ' ' + _arN(text).replace(/ /g, '') + ' '; }
  function _wordHit(hay, t) { return t.length === 1 ? (hay.indexOf(' ' + t + ' ') >= 0) : hay.indexOf(t) >= 0; }
  function _queryHit(q, hay) {
      const words = _arN(q).split(' ').filter(Boolean);
      if (!words.length) return true;
      return words.every(w => {
          if (_wordHit(hay, w)) return true;
          const kt = prodKey(w).split(' ').filter(Boolean);
          return kt.length > 0 && kt.every(t => _wordHit(hay, t));
      });
  }
  function hits(query, text) {
      const q = String(query == null ? '' : query).trim();
      if (!q) return true;
      const hay = hayOf(text);
      if (_queryHit(q, hay)) return true;
      /* «دي جي اي» ⇒ dji · «ار بي» ⇒ rp */
      if (hasLetterNames(q)) { const rs = letterReadings(q); for (let i = 1; i < rs.length; i++) if (_queryHit(rs[i], hay)) return true; }
      return false;
  }
  const _HAY = (typeof WeakMap !== 'undefined') ? new WeakMap() : null;
  function productText(p) {
      p = p || {};
      return [p.name, p.short, p.barcode, p.group_name, p.category, p.brand, p.alt_names, p.search_terms, p.short_name]
          .filter(Boolean).join(' ');
  }
  /* (TASK-0185 · المالك seq 118 «أكتب هود عدسة 50 STM 1.8 فهو لحاله يعطيني اسم الغطاء أو الهود … مسجّل في دليل التوافقيات، نفس الشيء البطاريات
     وكل شيء — ابحث في كل المنتجات») — البحث بالتوافق: كلمةٌ واحدة على الأقلّ من المنتج نفسه (هود · غطا · بطارية · الماركة…) والباقي في «متوافق مع»
     (compat). فـ«هود عدسة 50 STM 1.8» تجد ES-68 (متوافق مع Canon EF 50mm f/1.8 STM)، و«50mm» وحدها تبقى للعدسات لا لكل غطاءٍ يذكرها.
     كلمات الوصل («عدسة» · «لـ» · for…) لا تُشترط. */
  const COMPAT_FILLER = new Set(['عدسه', 'لعدسه', 'للعدسه', 'العدسه', 'عدسات', 'لعدسات', 'lens', 'for', 'ل', 'لل', 'على', 'علي', 'مع', 'تبع', 'حق', 'تبعها', 'الخاص', 'الخاصه', 'ب', 'من', 'الى', 'الي', 'يركب', 'متوافق', 'يناسب', 'كاميرا', 'كميرا', 'كمرا', 'camera']);
  function _wordIn(hay, w) {
      if (_wordHit(hay, w)) return true;
      const kt = prodKey(w).split(' ').filter(Boolean);
      return kt.length > 0 && kt.every(t => _wordHit(hay, t));
  }
  function _compatHit(q, hay, chay) {
      const words = _arN(q).split(' ').filter(Boolean);
      if (words.length < 2) return false;
      let own = 0, inC = 0;
      for (const w of words) {
          if (_wordIn(hay, w)) own++;
          else if (_wordIn(chay, w)) inC++;
          else if (!COMPAT_FILLER.has(w)) return false;
      }
      return own > 0 && inC > 0;
  }
  function hitsProduct(query, p) {
      const q = String(query == null ? '' : query).trim();
      if (!q) return true;
      if (!p || typeof p !== 'object') return hits(q, p);
      /* (TASK-0187 · المالك seq 121 «ينضاف للدليل مباشرة والبحث بيستعمله») وما أضافه العقل لدليل التوافقيات من الإنترنت (gmt-compat-kb.js) */
      const kb = global.GMTCompatKB && GMTCompatKB.fitsFor ? GMTCompatKB.fitsFor(p) : '';
      const txt = productText(p), ctx = [p.compat ? (Array.isArray(p.compat) ? p.compat.join(' ') : String(p.compat)) : '', kb].filter(Boolean).join(' ');
      let hay, chay;
      const c = _HAY && _HAY.get(p);
      if (c && c.t === txt && c.ct === ctx) { hay = c.h; chay = c.ch; } else { hay = hayOf(txt); chay = ctx ? hayOf(ctx) : ''; if (_HAY) _HAY.set(p, { t: txt, h: hay, ct: ctx, ch: chay }); }
      if (_queryHit(q, hay)) return true;
      if (hasLetterNames(q)) { const rs = letterReadings(q); for (let i = 1; i < rs.length; i++) if (_queryHit(rs[i], hay)) return true; }
      if (chay && _compatHit(q, hay, chay)) return true;
      return false;
  }

  global.GMTSuggest = {
    hits     : hits,
    hitsProduct: hitsProduct,
    qty      : qtyOf,
    price    : priceOf,
    readings : letterReadings,
    qtyWords : QTY_WORDS,
    digits   : digitsToLatin,
    key      : prodKey,
    tokens   : prodTokens,
    match    : matchProduct,
    suggest  : suggest,
    prepare  : prepare,
    aliases  : AR2LAT
  };
})(typeof window !== 'undefined' ? window : this);
