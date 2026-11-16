/* ═══════════════════════════════════════════════════════════════════════════
   gmt-kit.js — «كمّل طقمك»: ما يُقترح مع كلّ منتج (TASK-A0509 · المالك seq 753–754)
   ───────────────────────────────────────────────────────────────────────────
   المالك: «الطقم لسى عم يتصرف بغباء … ادرس كل منتج وكيف تربطه» · «درون نيو عم تروح غراض لغير شي · ميني 3 عم ياخد معها RC موشن او اشياء مو الها».
   سبب الغباء (قِيس على كلّ منتجات المتجر): الربط كان بقواعد أقسام عامّة («أيّ درون ⇐ أيّ حقيبة درون») ومطابقة أكواد بالاحتواء
   («S600» داخل «EOS600D» ⇒ إضاءة تأخذ عدسات) وبلا نظر للمخزون. القواعد هنا:
     ① لا علاقة للكمية (المالك seq 762): يُقترح ما له سعر، متوفّراً أو لا.
     ② ما يتوقّف على الموديل يُربط بالموديل المكتوب عليه بالضبط: ملحق الدرون باسم موديله (Avata ≠ Avata 2 · Mini 3 ≠ Mini 3 Pro إلّا إن ذُكرا معاً) ·
        بطارية/شاحن/قبضة الكاميرا من دليل التوافقيات (GMTCompatKB) · هود/غطاء/فلتر العدسة من الدليل نفسه.
     ③ مطابقة الكود بالمساواة لا بالاحتواء.
     ④ الريموتات والنظّارات لا تُقترح للدرون (توافقها ليس باسم الدرون) · التريغر والديفيوزر لا تأخذ ستاندات.
     ⑤ ما لا نعرف له ملحقاً مؤكَّداً ⇒ لا اقتراح (أفضل من اقتراح خاطئ).
   يعمل في المتصفّح (المتجر) وفي Node (tools/kit_audit.js يفحص كلّ المنتجات قبل النشر).
   ═══════════════════════════════════════════════════════════════════════════ */
(function (g) {
  'use strict';
  function AR(s) { return String(s == null ? '' : s).toLowerCase().replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي'); }

  /* ── موديلات الدرون: الأطول أوّلاً كي لا يبتلع «Mini 3» اسم «Mini 3 Pro» ── */
  var DM = [['mavicmini', /mavic ?mini/], ['mini5pro', /mini ?5 ?pro/], ['mini4pro', /mini ?4 ?pro/], ['mini4k', /mini ?4 ?k/], ['mini3pro', /mini ?3 ?pro/], ['mini3', /mini ?3/],
    ['mini2se', /mini ?2 ?se/], ['minise', /mini ?se/], ['mini2', /mini ?2/], ['avata360', /avata ?360/], ['avata2', /avata ?2/], ['avata', /avata/], ['neo2', /neo ?2/], ['neo', /neo/],
    ['flip', /flip/], ['air3s', /air ?3 ?s/], ['air3', /air ?3/], ['air2s', /air ?2 ?s/], ['tello', /tello/]];
  function droneModels(name) {
    var s = ' ' + AR(name).replace(/ميني|مبني/g, 'mini').replace(/افاتا/g, 'avata').replace(/نيو/g, 'neo').replace(/[_\/:،,·()\-–—.]+/g, ' ').replace(/\s+/g, ' ') + ' ';
    var models = [], first = null, pos = 1e9;
    DM.forEach(function (d) {
      var re = new RegExp(d[1].source, 'g'), m;
      while ((m = re.exec(s))) { if (models.indexOf(d[0]) < 0) models.push(d[0]); if (m.index < pos) { pos = m.index; first = d[0]; } s = s.slice(0, m.index) + ' '.repeat(m[0].length) + s.slice(m.index + m[0].length); }
    });
    /* القوائم المضغوطة: «Mini: 2_4k-se_2se_mini-se» · «air3 3s» */
    if (models.indexOf('mini2') >= 0 || models.indexOf('minise') >= 0) { if (/ 4k /.test(s)) models.push('mini4k'); if (/ 2se /.test(s)) models.push('mini2se'); if (/ se /.test(s) && models.indexOf('minise') < 0) models.push('minise'); }
    if (models.indexOf('air3') >= 0 && / 3s /.test(s) && models.indexOf('air3s') < 0) models.push('air3s');
    var fams = []; if (/ mini /.test(s)) fams.push('mini');   /* «لكل فئة mini-neo-flip»: mini بلا رقم = كلّ عائلة الميني */
    return { models: models, first: first, fams: fams };
  }
  function droneFam(m) { return /^mini|^mavicmini/.test(m || '') ? 'mini' : ''; }
  var DRONE_NO = /(^|\s)rc(\s|\d|$)|rc ?n\d|ريمونت|ريموت|remote|controller|motion|موشن|goggles|نظار|fpv|fvp/i;

  /* ── مطابقة كود بالمساواة: «r8» يطابق «EOS R8» ولا يطابق «R80»، و«s600» لا يطابق «EOS 600D» ── */
  function codeTokens(t) {
    var w = AR(t).replace(/[^a-z0-9ء-ي]+/g, ' ').trim().split(' ').filter(Boolean), out = {};
    for (var i = 0; i < w.length; i++) { out[w[i]] = 1; if (i + 1 < w.length) out[w[i] + w[i + 1]] = 1; if (i + 2 < w.length) out[w[i] + w[i + 1] + w[i + 2]] = 1; }
    return out;
  }
  function mcodes(t) { return (String(t || '').match(/[A-Za-z]{1,6}[- ]?\d{1,4}[A-Za-z]{0,3}|\d{2,4}[A-Za-z]{1,2}/g) || []).map(function (x) { return x.replace(/[- ]/g, '').toLowerCase(); }).filter(function (x) { return x.length >= 3 && /\d/.test(x) && /[a-z]/.test(x); }); }
  function fitsCode(text, codes) { if (!codes.length) return false; var tk = codeTokens(text); return codes.some(function (c) { return tk[c] === 1; }); }

  /* ── الفلاشات: نوع القطعة من اسمها ── */
  var F_TRIG = /تريغر|تريجر|trigger|مطلق|(^|\s)x2(\s|$)|x5c|xpro/i, F_MOD = /diffuser|ديفيوزر|سوفت ?بوكس|براكيت|bracket|softbox/i, F_STUDIO = /استوديو|ستوديو|(^|\s)ms ?\d{3}/i, F_OTHER = /حلقي|ring|macro|ماكرو|led/i;
  function flashKind(n) { n = AR(n); return F_TRIG.test(n) ? 'trig' : F_MOD.test(n) ? 'mod' : F_STUDIO.test(n) ? 'studio' : F_OTHER.test(n) ? 'other' : 'speedlite'; }
  function brandOf(n) { n = AR(n); var m = /godox|canon|yongnuo|يونغ|nikon|sony|viltrox|triopo/.exec(n); return m ? (m[0] === 'يونغ' ? 'yongnuo' : m[0]) : ''; }

  var THIRD_LENS = /sigma|سيغما|سيجما|tamron|تامرون|yongnuo|yonugnuo|يونغ|viltrox|samyang|tokina|ttartisan|7artisans|meike/i;

  /* القواعد العامّة لما لا يتوقّف على الموديل: [القسم الأعلى · الفرعي · [[قسم المقترح الأعلى، الفرعي، نمط اسم اختياري]]] */
  /* ستاند حقيقي: اسمه ستاند/Stand — وليس عصا سيلفي أو رينغ لايت (Q05s · Q07 · Q11s) ولا ذراعاً أو مونوبود */
  var STAND = { test: function (n) { n = String(n || ''); return /ستاند|stand/i.test(n) && !/ring|رينغ|حلق|selfie|سيلفي|عصا|^\s*q\d/i.test(n); } };
  var RULES = [
    /* (المالك seq 783 «شو علاقة Q07 وQ05s بـ660 برو؟ … إمّا شاحن وبطارية») الطقم = ما يحتاجه المنتج ليعمل، لا منتجات مشابهة:
       ستاند إضاءة حقيقي (اسمه ستاند/Stand — لا عصا سيلفي ولا رينغ لايت مصنّفة خطأً تحت «ستاندات») · والبطارية والشاحن لما يعمل بالبطارية */
    [/إضاءة الاستوديو/, /رؤوس الإضاءة.*بطارية|تعمل بالبطارية/, [['إكسسوارات الكاميرا', 'بطاريات وشواحن', /F550|F570|NP-?F|light batt/i], ['إضاءة الاستوديو', 'سوفت بوكس ومعدّلات'], ['إضاءة الاستوديو', 'ستاندات', STAND]]],
    [/إضاءة الاستوديو/, /رؤوس الإضاءة/, [['إضاءة الاستوديو', 'سوفت بوكس ومعدّلات'], ['إضاءة الاستوديو', 'ستاندات', STAND]]],
    [/إضاءة الاستوديو/, /ألواح LED.*(بطارية|USB)/, [['إكسسوارات الكاميرا', 'بطاريات وشواحن', /F550|F570|NP-?F|light batt/i], ['إضاءة الاستوديو', 'ستاندات', STAND]]],
    [/إضاءة الاستوديو/, /ألواح LED/, [['إضاءة الاستوديو', 'ستاندات', STAND]]],   /* اللوح لا يركّب سوفت بوكس Bowens ولا قمعاً */
    [/إضاءة الاستوديو/, /سوفت بوكس ومعدّلات/, [['إضاءة الاستوديو', 'ستاندات', STAND]]],
    [/إضاءة صنّاع المحتوى/, /./, [['ترايبود وجيمبال', 'ترايبود ذكي'], ['ملحقات الهاتف', 'هولدرات ومساند']]],
    [/المايكات والصوت/, /لاسلكية|سلكية/, [['المايكات والصوت', 'كروت صوت وستاندات'], ['ملحقات الهاتف', 'هولدرات ومساند']]],
    [/كاميرات الأكشن/, /./, [['إكسسوارات الكاميرا', 'ذواكر ووصلات', /ذاكر|memory|sd/i], ['ترايبود وجيمبال', 'ترايبود ذكي'], ['ملحقات الهاتف', 'هولدرات ومساند']]],
    [/ترايبود وجيمبال/, /أوزمو موبايل/, [['ملحقات الهاتف', 'هولدرات ومساند'], ['إضاءة صنّاع المحتوى', 'كفّ وجيب']]]   /* رونين جيمبال كاميرا: لا مساند هاتف */
  ];

  /* ctx = { products, catPath(id) ⇒ [top, sub], KB (GMTCompatKB اختياري) } */
  function complements(prod, ctx) {
    var KB = ctx.KB || g.GMTCompatKB || null, catPath = ctx.catPath;
    var cats = function (p) { return (p.category_ids && p.category_ids.length ? p.category_ids : [p.category_id]).map(catPath); };
    var inSub = function (p, t, sn) { return cats(p).some(function (c) { return c[0] === t && c[1] === sn; }); };
    var inTop = function (p, t) { return cats(p).some(function (c) { return c[0] === t; }); };
    /* (المالك seq 762 «الطقم ماله علاقة بالكمية … المتجر ما بيعرف كمية») لا شرط مخزون: يُقترح ما يلزم المنتج بسعره، متوفّراً أو لا */
    var P = (ctx.products || []).filter(function (p) { return p.id !== prod.id && parseFloat(p.price || 0) > 0 && !Array.isArray(p.package_items); });
    var cp = catPath(prod.category_id), top = cp[0] || '', sub = cp[1] || '', nm = (prod.name || '') + ' ' + (prod.short_name || '');
    var rank = function (p) { return ((p.images || []).length ? 100 : 0) - parseFloat(p.price || 0) / 100; };
    var out = [], seen = {};
    var push = function (p) { if (p && !seen[p.id] && out.length < 6) { seen[p.id] = 1; out.push(p); } };
    var best = function (list, n) { list.slice().sort(function (a, b) { return rank(b) - rank(a); }).slice(0, n || 1).forEach(push); };
    var kbShape = function (p) { return { name: p.name || '', short_name: p.short_name || '', alt_names: p.alt_names || '', compat: p.compat || '', group_name: cats(p).map(function (c) { return c[1] || c[0]; }).join(' ') }; };
    var kbFind = function (word, n) {
      if (!KB || !KB.resolve || !KB.intentHit) return;
      var it = KB.resolve(word + ' ' + nm); if (!it) return;
      best(P.filter(function (p) { return KB.intentHit(kbShape(p), it); }), n || 1);
    };
    var codes = mcodes(nm);

    /* ── الدرونات: ملحقات موديلها نفسه فقط ── */
    if (/الدرونات/.test(top) && /^درونات$/.test(sub)) {
      var dm = droneModels(prod.name).first; if (!dm) return out;   /* درون بلا موديل معروف (ألعاب) ⇒ لا اقتراح */
      var fam = droneFam(dm);
      var fit = P.filter(function (p) {
        if (!inTop(p, top) || inSub(p, top, 'درونات') || DRONE_NO.test(AR(p.name))) return false;
        var a = droneModels(p.name); return a.models.indexOf(dm) >= 0 || (fam && a.fams.indexOf(fam) >= 0);
      });
      /* المخصّص لموديله بالاسم قبل العامّ للعائلة («حقيبة Flip مخصّصة» قبل «لكل فئة mini-neo-flip») */
      var exact = function (p) { return droneModels(p.name).models.indexOf(dm) >= 0 ? 1 : 0; };
      ['بطاريات وشواحن', 'مراوح وحماية', 'حقائب', 'فلاتر', 'ملحقات أخرى'].forEach(function (sn) {
        fit.filter(function (p) { return inSub(p, top, sn); }).sort(function (a, b) { return (exact(b) - exact(a)) || (rank(b) - rank(a)); }).slice(0, sn === 'بطاريات وشواحن' || sn === 'مراوح وحماية' ? 2 : 1).forEach(push);
      });
      return out;
    }
    /* ── الكاميرات: بطاريتها وشاحنها وقبضتها من الدليل · كفر باسم موديلها · ذاكرة SD · حقيبة ── */
    if (/^كاميرات$/.test(sub) && /كاميرات كانون|أوبن بوكس/.test(top)) {
      kbFind('بطاريه', 1); kbFind('شاحن', 1); kbFind('قبضه', 1);
      best(P.filter(function (p) { return inSub(p, 'إكسسوارات الكاميرا', 'هودات وأغطية وكفرات') && /كفر|سيليكون|silicone|cage|كيج/i.test(p.name || '') && fitsCode((p.name || '') + ' ' + (p.compat || ''), codes); }), 1);
      best(P.filter(function (p) { return inSub(p, 'إكسسوارات الكاميرا', 'ذواكر ووصلات') && /ذاكر|memory|(^|\s)sd/i.test(p.name || '') && !/micro|قارئ|علبه|علبة/i.test(p.name || ''); }), 1);
      best(P.filter(function (p) { return inSub(p, 'إكسسوارات الكاميرا', 'حقائب'); }), 1);
      /* (المالك seq B677) «لما يشتري كاميرا تعطيه … لوح إضاءة بال 26» ⇒ اللوح الصغير (Pl26 · Pf… · Pm…) لا الألواح الكبيرة */
      best(P.filter(function (p) { return /^P[lfm] ?\d{2}(?!\d)/i.test(String(p.name || '').trim()) && cats(p).some(function (c) { return c[0] === 'إضاءة الاستوديو' && /^ألواح LED/.test(c[1] || ''); }); }), 1);
      return out;
    }
    /* ── العدسات: هودها وغطاؤها وفلترها من الدليل (عدسات كانون فقط — الدليل لا يعرف أقطار غيرها) · حقيبة ── */
    if (/العدسات/.test(top) || /^عدسات/.test(sub) || /سيغما|يونغنو/.test(sub)) {
      if (!THIRD_LENS.test(nm)) { kbFind('هود', 1); kbFind('غطاء', 1); kbFind('فلتر', 1); }
      best(P.filter(function (p) { return inSub(p, 'إكسسوارات الكاميرا', 'حقائب'); }), 1);
      return out;
    }
    /* ── الفلاشات: الفلاش يأخذ تريغر ماركته ومعدّلات الفلاش · فلاش الاستوديو يأخذ سوفت وستاند · التريغر والمعدّل لا يأخذان شيئاً ── */
    if (/^فلاشات$/.test(sub)) {
      var fk = flashKind(nm);
      if (fk === 'speedlite') {
        var br = brandOf(nm), anm = AR(nm);
        /* التريغر: من ماركة الفلاش · «مُطلِق لفلاش iT32» لذلك الفلاش وحده، وهو المقدَّم له على التريغر العامّ */
        var spec = function (p) { var m = /لفلاش\s+([a-z0-9\-]+)/i.exec(AR(p.name)); return m ? m[1].replace(/-/g, '') : ''; }, flat = anm.replace(/[\s\-]/g, '');
        P.filter(function (p) { if (!inSub(p, top, sub) || flashKind(p.name) !== 'trig' || !br || brandOf(p.name) !== br) return false; var sp = spec(p); return !sp || flat.indexOf(sp) >= 0; })
          .sort(function (a, b) { return ((spec(b) ? 1 : 0) - (spec(a) ? 1 : 0)) || (rank(b) - rank(a)); }).slice(0, 1).forEach(push);
        best(P.filter(function (p) { return inSub(p, top, sub) && flashKind(p.name) === 'mod' && /فلاش|flash/i.test(p.name || ''); }), 2);
      } else if (fk === 'studio') {
        best(P.filter(function (p) { return inSub(p, 'إضاءة الاستوديو', 'سوفت بوكس ومعدّلات'); }), 1);
        best(P.filter(function (p) { return inSub(p, 'إضاءة الاستوديو', 'ستاندات'); }), 1);
      }
      return out;
    }
    /* ── الباقي: ما يذكر توافقُه كود هذا المنتج (بالمساواة) ثمّ قاعدة قسمه ── */
    var sameType = function (p) { var c = catPath(p.category_id); return c[0] === top && c[1] === sub; };
    if (codes.length) best(P.filter(function (p) { var c = catPath(p.category_id); return !sameType(p) && p.compat && !/^كاميرات$|عدسات|سيغما/.test(c[1] || '') && (!/الدرونات/.test(c[0]) || /الدرونات/.test(top)) && fitsCode(p.compat, codes); }), 3);
    var rule = null; for (var i = 0; i < RULES.length; i++) if (RULES[i][0].test(top) && RULES[i][1].test(sub)) { rule = RULES[i]; break; }
    var ptxt = AR(nm + ' ' + (prod.compat || ''));
    /* (المالك seq 783) الطقم ما يحتاجه المنتج لا ما يشبهه: عصا سيلفي/ترايبود بإضاءة (Q05s · Q07 · Q11s) فيها الترايبود وحامل الهاتف أصلاً ⇒ لا ترايبود آخر ولا رأسية هاتف */
    var hasStand = /عصا|selfie|سيلفي|tripod|ترايبود|^\s*q\d/i.test(prod.name || '');
    if (rule) rule[2].forEach(function (r) {
      if (hasStand && /ترايبود ذكي|هولدرات ومساند/.test(r[1])) return;
      best(P.filter(function (p) {
        if (!inSub(p, r[0], r[1]) || (r[2] && !r[2].test(p.name || ''))) return false;
        if (/لايتن|lightning|ايفون|iphone/i.test(AR(p.name)) && !/lightning|لايتن|ايفون|iph/.test(ptxt)) return false;   /* وصلة آيفون لمن يذكر آيفون فقط */
        return true;
      }), out.length < 3 ? 2 : 1);
    });
    return out;
  }

  var api = { complements: complements, droneModels: droneModels, fitsCode: fitsCode, mcodes: mcodes, flashKind: flashKind, DRONE_NO: DRONE_NO };
  g.GMTKit = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
