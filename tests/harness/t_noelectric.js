// (TASK-0196 · المالك seq 133) «منتجات ما فيها كهرباء مثل العدسات او الهولدرات عم يحط الجهد الكهربائي … ابدا ابدا»
// ① التصنيف: بلا كهرباء (عدسة · هولدر · فلتر · ترايبود · حقيبة · ستاند إضاءة …) مقابل كهربائي (بطارية · LED · فلاش · كاميرا · جيمبال · ذكي)
// ② المواصفات الكهربائية تُحذف لمنتجٍ بلا كهرباء — والحمولة/قدرة التحمّل تبقى ③ الطلب للعقل لا يسأل عن واط/جهد/بطارية له
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const { browser, pg, errs } = await H.open('inventory.html', { w: 1366, h: 900, wait: 4000, init: H.ADMIN_INIT + `try { localStorage.setItem('gmt_brain_endpoint', 'https://ysawzwtmodkqqbqoiojj.supabase.co/functions/v1/gmt-brain'); } catch (_) {}` });
  const cls = await pg.evaluate(() => {
    const t = (n, g) => GMTBrain._noElectric({ name: n }, '', g || '');
    return {
      no: ['عدسة كانون 50mm f/1.8 STM', 'Canon EF 24-105mm f/4L lens', 'هولدر موبايل', 'Phone holder clamp', 'فلتر UV 67mm', 'هود ES-68', 'غطاء عدسة 58mm', 'ترايبود ألمنيوم 1.6م', 'حقيبة كاميرا', 'Camera bag', 'Light stand 2.8m', 'حامل إضاءة 2.8 متر', 'softboxes*15', 'مظلة تصوير 105cm', 'عاكس 5 في 1', 'محول حربة EF إلى RF', 'Smallrig cage', 'Sc-02 حامل كاميرا تثبيت على السيارة', 'Nek holder max هولدر رقبة. ماغ سيف ماكس', 'ET-83II lens hood هود', 'ND2 400 -49mm فلتر'].filter(n => !t(n)),
      yes: ['Godox SL60W', 'Softbox with LED panel', 'فلاش Godox V860', 'بطارية LP-E6NH', 'Battery grip BG-R10', 'كاميرا Canon R50', 'DJI Ronin RS5 combo', 'L 12 ترايبود ذكي', 'مايك Rode Wireless', 'DJI OSMO POCKET 4 compo', 'Ym-600ss رأس موجه ابيض شمسي', 'إضاءة LED حلقية مع حامل', 'BD-300D حامل تصوير منتجات. مضيئ', 'E30 RGB حامل تصوير منتجات', 'X86 Vacuum Suction ستاند شفط', 'Dji air 3 s mor fly compo. Rc2 3 battary + bag', '4 in 1 E27 Base Socket Light Lamp 50*70cm softbox سوفت بوكس لمبات كيت', 'Q12 ترايبود ذكي'].filter(n => t(n))
    };
  });
  ok(!cls.no.length, 'بلا كهرباء (عدسة · هولدر · فلتر · هود · غطاء · ترايبود · حقيبة · ستاند إضاءة · سوفت بوكس · مظلّة · عاكس · محوّل حربة · كيج)' + (cls.no.length ? ' — أخطأ في: ' + cls.no.join('، ') : ''));
  ok(!cls.yes.length, 'كهربائي أو غير معروف ⇒ لا يُحذف شيء (إضاءة · فلاش · بطارية · قبضة بطارية · كاميرا · جيمبال · ترايبود ذكي · مايك لاسلكي)' + (cls.yes.length ? ' — أخطأ في: ' + cls.yes.join('، ') : ''));
  const dr = await pg.evaluate(() => GMTBrain._dropElectric([{ k: 'الجهد', v: '12V' }, { k: 'القدرة', v: '60 واط' }, { k: 'مصدر الطاقة', v: 'بطارية' }, { k: 'البطارية', v: 'LP-E6' }, { k: 'زمن الشحن', v: '2 ساعة' },
    { k: 'المدخل', v: 'DC 5V' }, { k: 'قطر الفلتر', v: '49mm' }, { k: 'الحمولة', v: '5 كغ' }, { k: 'قدرة التحمّل', v: '8 كغ' }, { k: 'الوزن', v: '160 غ' }, { k: 'الحربة', v: 'EF' }, { k: 'المادّة', v: 'ألمنيوم' }, { k: 'ملاحظة', v: 'يعمل على 12V' }]).map(s => s.k));
  ok(JSON.stringify(dr) === JSON.stringify(['قطر الفلتر', 'الحمولة', 'قدرة التحمّل', 'الوزن', 'الحربة', 'المادّة']), 'تُحذف: الجهد · القدرة · مصدر الطاقة · البطارية · الشحن · المدخل · قيمةٌ بالفولت — وتبقى: القطر · الحمولة · قدرة التحمّل · الوزن · الحربة · المادّة: ' + JSON.stringify(dr));
  // ③ من البداية للنهاية: عدسة ⇒ الطلب يقول «بلا كهرباء» · والنموذج كتب الجهد والبطارية ⇒ لا يصلان
  const e2e = await pg.evaluate(async () => {
    const seen = []; const of = window.fetch;
    window.fetch = async (u, o) => {
      if (/gmt-brain/.test(String(u))) {
        const b = JSON.parse(o.body || '{}'); seen.push(b);
        const body = b.mode === 'product'
          ? { product: { name_en: 'Canon EF 50mm f/1.8 STM', brand: 'Canon', model: 'EF 50mm f/1.8 STM', category: 'Lens', specs: [{ k: 'البعد البؤري', v: '50mm' }, { k: 'الجهد', v: '7.4V' }, { k: 'قطر الفلتر', v: '49mm' }], confidence: 'high' } }
          : { answer: JSON.stringify({ specs: [{ k: 'البطارية', v: 'لا تحتاج' }, { k: 'القدرة', v: '5 واط' }, { k: 'الوزن', v: '160 غ' }, { k: 'المادّة', v: 'بلاستيك وزجاج' }], aliases_ar: ['عدسة خمسين'], aliases_en: ['nifty fifty'] }) };
        return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return of(u, o);
    };
    const p = await GMTBrain.importProduct({ url: '', hint: 'عدسة كانون 50mm f/1.8 STM', pname: 'عدسة كانون 50 STM', group: 'عدسات', complete: true });
    window.fetch = of;
    return { specs: p.specs.map(s => s.k), meta: p._meta && { no: p._meta.no_electric, dropped: p._meta.dropped_electric }, hint: (seen[0] || {}).hint || '', q: (seen.find(b => b.question) || {}).question || '' };
  });
  ok(/منتجٌ بلا كهرباء ⇐ لا واط ولا جهد/.test(e2e.hint) && !/الجهد · البطارية/.test(e2e.hint), 'طلب المنتج للعقل لا يسأل عن واط/جهد/بطارية للعدسة: ' + e2e.hint.slice(-90));
  ok(/منتجٌ بلا كهرباء: لا واط ولا جهد/.test(e2e.q), 'طلب الإكمال يقول «بلا كهرباء»');
  ok(e2e.specs.indexOf('الجهد') === -1 && e2e.specs.indexOf('البطارية') === -1 && e2e.specs.indexOf('القدرة') === -1 && e2e.specs.indexOf('قطر الفلتر') !== -1 && e2e.specs.indexOf('الوزن') !== -1 && e2e.meta.no && e2e.meta.dropped === 3,
    'ما كتبه النموذج من جهدٍ وبطارية وقدرة للعدسة لا يصل · والبقيّة تبقى: ' + JSON.stringify(e2e));
  // ④ منتجٌ كهربائي ⇒ لا تغيير (الطلب يسأل عن الواط والجهد كما كان)
  const el = await pg.evaluate(() => GMTBrain._composeHint('Godox SL60W', false));
  ok(/واط · مصدر الطاقة بطارية\/كهرباء · الجهد/.test(el), 'الإضاءة: الطلب كما كان (واط · الجهد · البطارية)');
  const real = errs.filter(e => !/status of (400|404|406)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
