/* ═══════════════════════════════════════════════════════════════════════════
   gmt-auth.js — مصدرٌ واحد لكل كلمات سرّ النظام
   ───────────────────────────────────────────────────────────────────────────
   طلب المالك (2026-09-27):
     «في الواجهة الرئيسية اعمل لي شيء… فيه كل كلمات السرّ بحسن بغيّرها **كلّها
      بدون استثناء**… مبدئياً كلمات السرّ السيادية وكلمة سرّ كل شيء خطّها 0000،
      بعدين أنا من هي الأداة بحسن بغيّرها».

   🔴 العطل الذي كشفه بناء هذه الوحدة — وهو أخطر ممّا طُلب إصلاحه:
      كان في النظام **مساران منفصلان** لكلمة السرّ السيادية:
        · `admin_sovereign.html` يحفظ `localStorage['gmt_pw_sovereign']`
        · و`inventory.html` و`purchase.html` و`gmt-staff.js` تقارن بـ
          `window.GMT_SOVEREIGN_PW || 'gmt-sovereign'`
      و`GMT_SOVEREIGN_PW` **لا يضبطها أي سطر في المشروع كلّه**.
      ⇒ فمن يغيّر كلمة السرّ من أداة السيادة يظنّ أنّه غيّرها، بينما فكّ ختم
        الجرد وفكّ ختم المشتريات يقبلان `gmt-sovereign` كما هي — وهي مكتوبة
        نصّاً في ملفّات منشورة على الإنترنت. أي أنّ أخطر الأزرار كان محروساً
        بكلمة يعرفها كل من فتح الشيفرة، **وتغييرها لا يفعل شيئاً**.
      هذه الوحدة تُلغي المسار الثاني: كل فحص يمرّ من هنا.

   أين تُحفَظ؟
     · **القاعدة** (`gmt_settings`) ⇒ تسري على كل الأجهزة. هي الافتراضي.
     · **الجهاز** (`localStorage`) ⇒ تسري على هذا الجهاز وحده، وتتقدّم على
       القاعدة. تبقى للتوافق مع ما هو محفوظ عندك الآن فلا ينكسر شيء اليوم.

   ⚠️ صراحةً في حدود الحماية — لأنّ الوهم أخطر من الضعف المعروف:
     هذه كلمات **واجهة** لا حراسة قاعدة. الصفحات تتّصل بمفتاح `anon` العام،
     ومن يفتح أدوات المطوّر يستطيع تجاوز أي فحص في المتصفّح. الحماية الحقيقية
     الوحيدة هي سياسات RLS في Supabase. فهذه تمنع الخطأ العابر وسوء الاستعمال
     اليومي — لا مهاجماً يعرف ما يفعل.
     ولذلك نحفظ **بصمة** (SHA-256 مع مِلح ثابت) لا النصّ الصريح حيثما أمكن:
     فمن يقرأ الجدول لا يقرأ كلمة السرّ جاهزة.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
    'use strict';

    var SALT = 'gmt::2026::auth';
    var CACHE_KEY = 'gmt_auth_cache_v1';
    var TTL = 5 * 60 * 1000;

    /* الأنواع المعروفة. `local` = مفتاح localStorage القديم (توافق)،
       `db` = مفتاح gmt_settings، `legacy` = ما كان مكتوباً في الشيفرة. */
    /* ═══════════════════════════════════════════════════════════════════════
       🔑 الكلمة الافتراضية — مصدرُ حقيقةٍ واحد (قرار المالك ت٤ · 2026-10-03)

       نصُّه: «أداة واحدة تحكم الكل — والقيمة قرارك» ثمّ «وخلّيها الكلمة **2003**».
       وقبله كان قد قال «مبدئياً كلمات السر… خطّها 0000»، وقال أيضاً «أدمن واحد
       … وكلمة المرور هي 2003». فحَسَم التضارب بنفسه: **2003**.

       ولماذا ثابتٌ واحد لا رقمٌ مكتوبٌ في كل موضع؟ لأنّ `0000` كانت مكتوبةً
       نصّاً في **ستّة** مواضع على الأقلّ (هذا الملفّ · أدمن الكفالات · الأدمن
       السيادي · gmt-staff · صفحة الأمان …)، فتغييرُها كان يعني تتبّعَ ستّة
       ملفّات ونسيانَ أحدها — ونسيانُ موضعٍ واحد في كلمة سرٍّ يعني بقاءَ بابٍ
       مفتوح. الآن الرقم في مكانٍ واحد، وكلُّ موضعٍ يقرؤه من `GMTAuth.DEFAULT`.

       ⚠️ و`0000` **لم تبقَ مقبولة**: لو أبقيتُها «للتوافق» لكان القرار بلا معنى —
       من يعرف 0000 يدخل كما كان. ومن ضبط كلمةً خاصّةً له (محلّياً أو في
       `gmt_settings`) فكلمتُه تعمل كما هي؛ المتغيّر هو **الافتراضيّ** وحده.
       ═══════════════════════════════════════════════════════════════════════ */
    var DEFAULT_PW = '2003';

    /* الأنواع المعروفة. `local` = مفتاح localStorage القديم (توافق)،
       `db` = مفتاح gmt_settings، `legacy` = الافتراضيّ حتى يضبطه المالك. */
    var KINDS = {
        /* ⚠️ `gmt-sovereign` أُزيلت من المقبول (2026-09-27): كانت مكتوبة نصّاً في
           ملفّات منشورة على الإنترنت ⇒ فكُّ الأختام مفتوحٌ لمن قرأ الشيفرة.
           و`0000` أُزيلت بدورها (2026-10-03 · ت٤) للسبب نفسه: صارت معروفة. */
        sovereign: { label: 'السيادية (فكّ الأختام · العمليات الخطرة)', local: 'gmt_pw_sovereign', db: 'pw_sovereign', legacy: [DEFAULT_PW] },
        store:     { label: 'إدارة المتجر الإلكتروني',                  local: 'gmt_pw_store',     db: 'pw_store',     legacy: [DEFAULT_PW] },
        warranty:  { label: 'إدارة الكفالات',                           local: 'gmt_pw_warranty',  db: 'pw_warranty',  legacy: [DEFAULT_PW] },
        pos:       { label: 'أدمن نقاط البيع',                          local: 'gmt_pw_pos',       db: 'admin_password', legacy: [DEFAULT_PW] },
        purchase:  { label: 'المشتريات — فكّ ختم فاتورة',               local: 'gmt_pw_purchase',  db: 'pw_purchase',  legacy: [DEFAULT_PW] },
        backup:    { label: 'النسخ الاحتياطي والاستعادة',               local: 'gmt_pw_backup',    db: 'pw_backup',    legacy: [DEFAULT_PW] }
    };

    var _mem = null;         // { key: value } من القاعدة
    var _loadedAt = 0;

    function db() {
        try {
            if (global.GMT_DB && global.GMT_DB.MAIN) return global.GMT_DB.MAIN;
        } catch (e) {}
        return null;
    }

    async function sha(text) {
        try {
            if (!global.crypto || !global.crypto.subtle) return null;
            var buf = new TextEncoder().encode(SALT + '|' + text);
            var h = await global.crypto.subtle.digest('SHA-256', buf);
            return Array.prototype.map.call(new Uint8Array(h), function (b) {
                return ('0' + b.toString(16)).slice(-2);
            }).join('');
        } catch (e) { return null; }
    }

    /* قراءة جدول الإعدادات — بصمت عند الفشل: صفحةٌ بلا شبكة يجب أن تبقى
       قابلة للاستعمال بكلمة الجهاز، لا أن تتعطّل. */
    async function load(force) {
        if (!force && _mem && (Date.now() - _loadedAt) < TTL) return _mem;
        try {
            var raw = localStorage.getItem(CACHE_KEY);
            if (!force && raw) {
                var c = JSON.parse(raw);
                if (c && (Date.now() - c.at) < TTL) { _mem = c.v; _loadedAt = c.at; return _mem; }
            }
        } catch (e) {}
        var d = db();
        if (!d) { _mem = _mem || {}; return _mem; }
        try {
            var r = await fetch(d.url + '/rest/v1/gmt_settings?select=key,value', {
                headers: { apikey: d.key, Authorization: 'Bearer ' + d.key }
            });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            var rows = await r.json();
            var map = {};
            (rows || []).forEach(function (x) { map[x.key] = x.value; });
            _mem = map; _loadedAt = Date.now();
            try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: _loadedAt, v: map })); } catch (e) {}
        } catch (e) {
            /* ⚠️ نُسجّل وقت المحاولة **حتى عند الفشل**. بلا ذلك يبقى _loadedAt
               صفراً فيُعاد النداء على الشبكة في كل فحص — ومع ستّ كلمات سرّ صار
               عرض الأداة يأخذ ثوانيَ بلا إنترنت، ويُغرق الصفحة بطلبات فاشلة.
               نُقصّر مهلة إعادة المحاولة إلى 20 ثانية بدل التعطيل الكامل. */
            _mem = _mem || {};
            _loadedAt = Date.now() - TTL + 20000;
        }
        return _mem;
    }

    /* هل يطابق ما كتبه المستخدم؟ نقبل ثلاث صيغ للتخزين:
         ① بصمة  sha256:<hex>      ② نصّ صريح (قديم)     ③ مفتاح الجهاز
       والقديمة (legacy) تبقى مقبولة **حتى تُضبط كلمة فعلية**، وإلّا انقلب
       النظام كلّه مقفولاً في وجه صاحبه لحظة نشر هذا الملفّ. */
    async function check(kind, input) {
        var k = KINDS[kind];
        if (!k) return false;
        var pw = String(input === null || input === undefined ? '' : input);

        var loc = null;
        try { loc = localStorage.getItem(k.local); } catch (e) {}
        if (loc) return pw === loc;

        var map = await load(false);
        var stored = map && map[k.db];
        if (stored) {
            if (String(stored).indexOf('sha256:') === 0) {
                var h = await sha(pw);
                return !!h && ('sha256:' + h) === String(stored);
            }
            return pw === String(stored);
        }
        /* لا شيء مضبوط ⇒ الافتراضية الواحدة (ت٤: 2003) */
        return (k.legacy || [DEFAULT_PW]).indexOf(pw) !== -1;
    }

    /* هل ما زالت الكلمة هي الافتراضية؟ — لتنبيهه في الأداة */
    async function isDefault(kind) {
        var k = KINDS[kind];
        if (!k) return false;
        try { if (localStorage.getItem(k.local)) return false; } catch (e) {}
        var map = await load(false);
        return !(map && map[k.db]);
    }

    async function setDb(kind, value) {
        var k = KINDS[kind];
        if (!k) throw new Error('نوع غير معروف: ' + kind);
        var d = db();
        if (!d) throw new Error('إعدادات القاعدة غير متاحة (gmt-core.js)');
        var h = await sha(value);
        var payload = [{ key: k.db, value: h ? ('sha256:' + h) : String(value) }];
        /* ⚠️ on_conflict في **المسار** لا في الترويسة: PostgREST يتجاهله بصمت
           في الترويسة فيفشل التعديل بـ409 ويبدو أنّه «لم يُحفَظ». */
        var r = await fetch(d.url + '/rest/v1/gmt_settings?on_conflict=key', {
            method: 'POST',
            headers: {
                apikey: d.key, Authorization: 'Bearer ' + d.key,
                'Content-Type': 'application/json',
                Prefer: 'resolution=merge-duplicates,return=minimal'
            },
            body: JSON.stringify(payload)
        });
        if (!r.ok) throw new Error('HTTP ' + r.status + ' — ' + (await r.text()).slice(0, 140));
        /* كلمةٌ على الجهاز تتقدّم على القاعدة، فلو بقيت قديمةً لظنّ أنّ الحفظ
           لم يُجدِ. نُزيلها كي تسري الجديدة فعلاً. */
        try { localStorage.removeItem(k.local); } catch (e) {}
        await load(true);
        return true;
    }

    function setLocal(kind, value) {
        var k = KINDS[kind];
        if (!k) return false;
        try {
            if (value) localStorage.setItem(k.local, value);
            else localStorage.removeItem(k.local);
            return true;
        } catch (e) { return false; }
    }

    /* نافذة سؤال موحّدة — كي لا تبقى كل صفحة تكتب prompt برسالتها الخاصّة */
    async function ask(kind, title) {
        var k = KINDS[kind] || { label: kind };
        /* 🎨 (2026-10-03 · طلبك ١٦١) كانت `prompt()` و`alert()` من المتصفّح —
           وهي **أكثرُ نافذةٍ يراها الموظّف يومياً** لأنّ كل عمليةٍ محميّة تمرّ
           بها. صارت نافذةَ النظام بحقل كلمة سرّ مُقنَّع (`type=password`)
           بدل نصٍّ مكشوفٍ أمام من يقف بجانب الكاشير. */
        var pw;
        if (global.GMTAsk) {
            pw = await global.GMTAsk.prompt(k.label, {
                title: title || '🔒 مطلوب كلمة السرّ',
                inputType: 'password', placeholder: '••••',
                icon: 'danger', okText: 'دخول'
            });
        } else {
            pw = global.prompt((title || '🔒 مطلوب كلمة السرّ') + '\n(' + k.label + ')');
        }
        if (pw === null) return false;
        var ok = await check(kind, pw);
        if (!ok) {
            if (global.GMTAsk) await global.GMTAsk.alert('كلمة السرّ غير صحيحة.', { title: '⛔ رُفض', icon: 'danger' });
            else { try { global.alert('⛔ كلمة سر غير صحيحة.'); } catch (e) {} }
        }
        return ok;
    }

    global.GMTAuth = {
        DEFAULT: DEFAULT_PW,          /* ⬅ تقرؤه كل صفحة بدل كتابة الرقم */
        KINDS: KINDS, check: check, ask: ask, isDefault: isDefault,
        setDb: setDb, setLocal: setLocal, load: load, sha: sha
    };
}(typeof window !== 'undefined' ? window : this));
