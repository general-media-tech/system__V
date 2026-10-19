// (19 ت1 · TASK-0051) بنك بيانات فروع المفتي: أسماء بديلة · مطابقة القراءة · منتقٍ بالبحث · تعطيل · إضافة · مراجعة التصحيحات
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const dumpSet = async () => ((await H.call('/__dump', undefined, 'GET')).gmt_settings || []);
(async () => {
  for (const w of [390, 1366]) {
    console.log('— ' + w);
    await H.seed();
    await H.call('/__opts', { reject_cols: [], rls_block: [] });
    const { browser, pg, errs } = await H.open('orders.html', { w, mobile: w < 700, h: 900, wait: 4500, init: H.ADMIN_INIT });
    const mb = (seg) => pg.evaluate(s => GMTReceipt._matchBranch(s), seg);
    // ١) قبل البنك: «مازن دباغ» (اسم يقوله الناس) لا يُطابق السريان بثقة
    const before = await mb('حلب مازن دباغ');
    ok(before.key !== 'حلب|السريان', 'قبل الاسم البديل: «مازن دباغ» لا يُطابق السريان بثقة (' + before.key + ')');
    // ٢) نافذة البنك من إعدادات الأوردرات
    await pg.evaluate(() => openOrdersSettings()); await pg.waitForTimeout(300);
    await pg.click('#os-bank'); await pg.waitForTimeout(600);
    const first = await pg.evaluate(() => { const b = document.querySelector('#mufti-bank-ov [data-body]'); return b && b.innerText.split('\n')[0]; });
    ok(/حلب/.test(first || ''), 'البنك يُفتح من ⚙️ والقائمة تبدأ بحلب: ' + first);
    // اسم بديل
    await pg.evaluate(() => { GMTAsk.prompt = async () => 'مازن دباغ'; document.querySelector('#mufti-bank-ov [data-alias="حلب|السريان"]').click(); }); await pg.waitForTimeout(200);
    // تعطيل كراج الراموسة
    await pg.evaluate(() => document.querySelector('#mufti-bank-ov [data-toggle="حلب|كراج الراموسة"]').click()); await pg.waitForTimeout(150);
    // إضافة فرع
    await pg.evaluate(() => { const ov = document.getElementById('mufti-bank-ov'); ov.querySelector('details').open = true;
      ov.querySelector('[data-new="city"]').value = 'حلب'; ov.querySelector('[data-new="name"]').value = 'الجميلية'; ov.querySelector('[data-new="phone"]').value = '0965000000';
      ov.querySelector('[data-add]').click(); }); await pg.waitForTimeout(150);
    // البحث داخل البنك
    await pg.fill('#mufti-bank-ov [data-q]', 'مازن'); await pg.waitForTimeout(150);
    const found = await pg.evaluate(() => [...document.querySelectorAll('#mufti-bank-ov [data-row]')].map(r => r.getAttribute('data-row')));
    ok(found.length === 1 && found[0] === 'حلب|السريان', 'البحث في البنك بالاسم البديل يجد السريان');
    await pg.evaluate(() => document.querySelector('#mufti-bank-ov [data-save]').click()); await pg.waitForTimeout(900);
    const sm = await pg.evaluate(() => document.querySelector('#mufti-bank-ov [data-msg]').textContent);
    ok(/حُفظ بنك الفروع/.test(sm), 'الحفظ مؤكَّد من القاعدة: ' + sm);
    const row = (await dumpSet()).find(r => r.key === 'mufti_branch_bank'); const v = row && JSON.parse(row.value);
    ok(v && v.aliases['حلب|السريان'].includes('مازن دباغ') && v.disabled['حلب|كراج الراموسة'] && v.added.some(a => a.name === 'الجميلية'), 'القاعدة: الاسم البديل + التعطيل + الفرع المضاف');
    await pg.evaluate(() => document.querySelector('#mufti-bank-ov [data-x]').click());
    // ٣) أثرُه في القراءة والاختيار
    const after = await mb('حلب مازن دباغ');
    ok(after.key === 'حلب|السريان' && after.confident, 'بعد الاسم البديل: قراءة «مازن دباغ» ⇐ السريان بثقة');
    ok(!(await mb('كراج الراموسة')).candidates.includes('حلب|كراج الراموسة'), 'المعطَّل لا يُقرأ ولا يُرشَّح');
    const opts = await pg.evaluate(() => { const s = document.createElement('select'); document.body.appendChild(s); shipFromFill(s, ''); return [...s.options].map(o => o.value); });
    ok(!opts.includes('حلب|كراج الراموسة') && opts.includes('حلب|الجميلية'), 'قائمة الفرع المُرسِل: بلا المعطَّل ومعها المضاف');
    const keep = await pg.evaluate(() => { const s = document.createElement('select'); document.body.appendChild(s); shipFromFill(s, 'حلب|كراج الراموسة'); return s.options[0].textContent; });
    ok(/معطَّل/.test(keep), 'أوردرٌ قديم على فرعٍ معطَّل يبقى عليه ظاهراً «(معطَّل…)» لا يُستبدل بصمت');
    // ٤) المنتقي بالبحث
    const pick = await pg.evaluate(() => { const s = document.createElement('select'); s.id = 'tst-sel'; document.body.appendChild(s); shipFromFill(s, '');
      const q = s.previousElementSibling; q.value = 'فرقان'; q.dispatchEvent(new Event('input'));
      const many = [...s.options].filter(o => o.value && !o.hidden).map(o => o.value);
      q.value = 'بارون'; q.dispatchEvent(new Event('input'));
      return { has: q.hasAttribute('data-bank-q'), many, v: s.value }; });
    ok(pick.has && pick.many.length === 2 && pick.many.includes('حلب|الفرقان'), 'حقل البحث فوق القائمة: «فرقان» يُبقي الفرعين المطابقين فقط (الفرقان + السكن الجامعي في منطقة الفرقان)');
    ok(pick.v === 'حلب|شارع بارون', 'نتيجةٌ وحيدة («بارون») تُختار مباشرةً: ' + pick.v);
    const pick2 = await pg.evaluate(() => { const s = document.getElementById('tst-sel'), q = s.previousElementSibling; q.value = 'مازن'; q.dispatchEvent(new Event('input')); return s.value; });
    ok(pick2 === 'حلب|السريان', 'البحث بالاسم البديل في المنتقي ⇐ السريان');
    // ٥) التصحيحات ⇐ المراجعة ⇐ اعتماد اسمٍ بديل
    await pg.evaluate(() => GMTMuftiBank.recordCorrection({ read: 'سريان قديمه', readKey: null, confident: false, chosen: 'حلب|السريان', order: 7 }));
    await pg.evaluate(() => GMTMuftiBank.recordCorrection({ read: 'سريان قديمه', readKey: null, confident: false, chosen: 'حلب|السريان', order: 8 }));
    ok((await dumpSet()).filter(r => /^mufti_corr_/.test(r.key)).length === 2, 'التصحيحان محفوظان صفّاً لكلٍّ منهما');
    await pg.evaluate(() => GMTMuftiBank.openManager()); await pg.waitForTimeout(500);
    await pg.evaluate(() => document.querySelector('#mufti-bank-ov [data-tab="review"]').click()); await pg.waitForTimeout(800);
    const rv = await pg.evaluate(() => document.querySelector('#mufti-bank-ov [data-body]').innerText);
    ok(/سريان قديمه/.test(rv) && /×2/.test(rv), 'المراجعة تجمع التصحيحين المتطابقين (×2)');
    await pg.evaluate(() => document.querySelector('#mufti-bank-ov [data-adopt]').click()); await pg.waitForTimeout(900);
    const S2 = await dumpSet(); const v2 = JSON.parse(S2.find(r => r.key === 'mufti_branch_bank').value);
    ok(v2.aliases['حلب|السريان'].includes('سريان قديمه') && v2.aliases['حلب|السريان'].includes('مازن دباغ') && !S2.some(r => /^mufti_corr_/.test(r.key)), '«اعتمد» يضيف الاسم البديل (ويُبقي السابق) ويُزيل التصحيحين من المراجعة');
    await pg.evaluate(() => document.querySelector('#mufti-bank-ov [data-x]').click());
    ok(!(await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)), 'لا طفح أفقي');
    const real = errs.filter(e => !/Failed to load resource/.test(e)); ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
    await browser.close();
    // ٦) الموظّف: البنك للأدمن وحده، والحفظ يُرفض حتى لو استُدعي مباشرةً
    const S = await H.open('orders.html', { w, mobile: w < 700, h: 900, wait: 4000, init: H.STAFF_INIT });
    await S.pg.evaluate(() => { window.__asked = 0; GMTRole.requireAdmin = async () => { window.__asked++; return false; }; GMTMuftiBank.openManager(); }); await S.pg.waitForTimeout(400);
    ok(await S.pg.evaluate(() => window.__asked === 1 && !document.getElementById('mufti-bank-ov')), 'الموظّف: فتح البنك يطلب الأدمن ولا يُفتح');
    ok(/للأدمن وحده/.test(await S.pg.evaluate(() => GMTMuftiBank.save({}).then(() => 'saved', e => e.message))), 'الموظّف: الحفظ المباشر مرفوض');
    await S.browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
