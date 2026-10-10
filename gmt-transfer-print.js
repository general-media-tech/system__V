/* ═══════════════════════════════════════════════════════════════════════════
   gmt-transfer-print.js — فاتورةُ النقل الداخليّ المطبوعة · مصدرٌ واحد  (٨ ت — تدقيق المطابقة · «الصهر»)
   ───────────────────────────────────────────────────────────────────────────
   كانت الدالّة `printStockTransferInvoice` منسوخةً في الجرد وفي أدمن نقاط البيع (~٢٤٠ سطراً لكلٍّ منهما)،
   وتباعدت النسختان: نسخةُ الجرد صُلِّحت لتطبع الصور، ونسخةُ الأدمن بقيت تكتب مكان الصورة مربّعاً
   رماديّاً بانتظار «محمِّل الصور» — وهو غير موجودٍ في نافذة الطباعة ⇒ فاتورة نقل **بلا صور المنتجات**
   (طلبك في القسم ١٠: «فاتورة النقل أن تظهر بدون صور المنتجات»).
   الآن: نسخةٌ واحدة هنا (نسخةُ الجرد المصلَّحة)، والصفحتان تناديانها وتمرّران فقط طريقةَ جلب البنود.
     GMTTransferPrint.print(transfer, { fetchItems: async id => [...], products: [...] })
   ⚠️ تُفتح نافذة الطباعة أوّلَ شيء (قبل أيّ انتظار) كي لا يحظرها المتصفّح.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.GMTTransferPrint) return;
  function escHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function _L(m) { try { if (global.showLoading) global.showLoading(m); } catch (_) {} }
  function _H() { try { if (global.hideLoading) global.hideLoading(); } catch (_) {} }
  function _T(m, t) { try { if (global.showToast) global.showToast(m, t); } catch (_) {} }

function print(t, o) {
  o = o || {};
  if (!t || !t.id) return;
  var transferId = t.id;

  // حرج: افتح النافذة فوراً (sync) قبل أي await — وإلا يحظرها المتصفح كـ popup blocker
  const printWin = window.open('', '_blank', 'width=850,height=1100');
  if (!printWin) { _T('السماح بالنوافذ المنبثقة مطلوبة للطباعة', 'warning'); return; }
  printWin.document.write('<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>جارٍ التجهيز...</title><style>body{font-family:Arial,Tahoma,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fafafa;color:#5b6472;}</style></head><body>جارٍ تجهيز الفاتورة للطباعة...</body></html>');
  printWin.document.close();

  _L('جارٍ تجهيز الفاتورة للطباعة...');
  return (async function () {
  let items = [];
  try {
    items = await o.fetchItems(transferId);
    if (!Array.isArray(items)) items = [];
  } catch (e) {
    _H();
    if (printWin && !printWin.closed) printWin.close();
    _T('تعذّر جلب بيانات الفاتورة: ' + e.message, 'error');
    return;
  }
  _H();

  if (printWin.closed) {
    _T('تم إغلاق نافذة الطباعة قبل اكتمال التحميل', 'warning');
    return;
  }

  const list = items;
  const totalQty   = list.reduce((s,i)=>s+(Number(i.qty)||0), 0);
  const totalCost  = list.reduce((s,i)=>s+((Number(i.unit_cost)||0)*(Number(i.qty)||0)), 0);
  const totalSale  = list.reduce((s,i)=>s+((Number(i.sale_price)||0)*(Number(i.qty)||0)), 0);
  const profit     = totalSale - totalCost;
  const dateStr    = new Date(t.created_at).toLocaleDateString('ar-SY');
  const timeStr    = new Date(t.created_at).toLocaleTimeString('ar-SY',{hour:'2-digit',minute:'2-digit'});
  const statusMap  = { pending: '🟡 في الطريق', received: '✅ مستلمة', cancelled: '❌ ملغاة' };
  const statusTxt  = statusMap[t.status] || t.status;

  // صفوف جدول المنتجات — بنفس نمط جدول فاتورة المشتريات (dual cell: سعر فردي + إجمالي)
  const dualCell = (val, qty) => {
    const v = Number(val) || 0;
    const tot = v && qty ? (v * qty).toFixed(2) : '';
    return `<td style="border:2px solid #222;text-align:center;padding:2px 2px;vertical-align:middle;">
      <div style="display:block;color:#111;font-size:11px;font-weight:700;min-width:44px;">${v ? v.toFixed(2) : ''}</div>
      <div style="color:#D5001C;font-size:10px;font-weight:700;margin-top:1px;border-top:1px solid #ffd6da;min-height:13px;">${tot}</div>
    </td>`;
  };

  /* (٨ ث — تدقيق المطابقة) بندُ النقل غالباً بلا image_url ⇒ نأخذ صورة المنتج نفسه من القائمة المُمرَّرة (معرّفٌ نصّاً) */
  const _pOf = id => (o.products || []).find(x => String(x.id) === String(id));
  list.forEach(it => { if (!it.image_url) { const p = _pOf(it.product_id); if (p && p.image_url) it.image_url = p.image_url; } });
  const rows = list.map((item, idx) => {
    const fs = (item.product_name || '').length > 38 ? '10px' : '12px';
    const imgEl = item.image_url
      /* (2026-10-04 ن) نافذةُ الطباعة وثيقةٌ جديدة بلا gmtResolveVisibleImages — فالصورةُ بعلامة data-orig-src
         كانت تُطبع مربّعاً فارغاً. نكتب الرابط الحقيقيّ مباشرةً. */
      ? `<img src="${escHtml(item.image_url)}" decoding="async" style="width:44px;height:44px;object-fit:contain;display:block;margin:0 auto;" onerror="this.style.display='none'">`
      : `<div style="width:44px;height:44px;background:#f3f4f6;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:18px;margin:0 auto;"></div>`;
    return `<tr>
      <td style="border:2px solid #222;text-align:center;padding:3px 2px;font-size:11px;vertical-align:middle;">${idx+1}</td>
      <td style="border:2px solid #222;text-align:center;padding:2px 1px;vertical-align:middle;">${imgEl}</td>
      <td style="border:2px solid #222;padding:3px 5px;font-size:${fs};text-align:right;vertical-align:middle;">${escHtml(item.product_name||'')}</td>
      <td style="border:2px solid #222;text-align:center;padding:2px 1px;vertical-align:middle;overflow:hidden;">${
        item.barcode
          ? `<svg class="bc-svg" data-code="${escHtml(item.barcode)}" style="width:96%;max-width:96px;height:20px;display:block;margin:0 auto"></svg>`
          : '<span style="font-size:11px">—</span>'
      }</td>
      <td style="border:2px solid #222;text-align:center;padding:3px 2px;font-size:12px;vertical-align:middle;">${item.qty||0}</td>
      ${dualCell(item.unit_cost, item.qty)}
      ${dualCell(item.sale_price, item.qty)}
    </tr>`;
  }).join('');

  /* 🏷️ [T10] عنوان الفاتورة + الأصناف التي تحويها
     طلب المالك: «عنوان للفاتورة · الأصناف يلي فيها».
     العنوان: من ملاحظة الفاتورة إن وُجدت، وإلا وصف تلقائي (عدد البنود والقطع).
     الأصناف: تُستنبط من مجموعات المنتجات (group_name) الموجودة في البنود. */
  const _totQty = items.reduce((s,i)=>s+(Number(i.qty)||0),0);
  /* 🔧 (2026-08-24) [T17] كان العنوان يأخذ `t.note` عند غياب `title`، و`note` يحوي
     «تعذّر خصم N صنف: …» ⇒ تظهر **أسماء الأصناف المتعذّرة في أعلى الفاتورة** بدل
     العنوان. المالك: «في الأعلى لا يكتب المنتجات التي تعذّر خصمها — يكتبهم تحت في
     الأسفل كملاحظة». الآن: العنوان من `title` فقط، والملاحظة تُطبع أسفل الفاتورة. */
  const invTitle = (t.title || '').trim() || (items.length + ' بند · ' + _totQty + ' قطعة');
  const shortNote = (t.note || '').trim();
  const _cats = [...new Set(items.map(it=>{
      const p = _pOf(it.product_id);
      return (p && (p.group_name||p.category)) || '';
    }).filter(Boolean))];
  const catsLine = _cats.length ? _cats.slice(0,6).join(' · ') + (_cats.length>6 ? ' …' : '') : '';

  printWin.document.open();
  printWin.document.write(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>فاتورة نقل — ${escHtml(t.transfer_number)}</title>
<style>
  @page{margin:8mm 6mm;size:A4 portrait;}
  *{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important;}
  body{font-family:Arial,Tahoma,sans-serif;font-size:13px;font-weight:700;color:#111;direction:rtl;background:#fff;}
  table{border-collapse:collapse;width:100%;}
  img{max-width:100%;display:block;}
  .INV-WRAP{width:100%;margin:0;padding:4mm 0;}
  table{page-break-inside:auto;}
  tr{page-break-inside:avoid;page-break-after:auto;}
  thead{display:table-header-group;}
  @media print{.no-print{display:none!important;}}
</style>
</head>
<body>
<div class="INV-WRAP">

  <table style="width:100%;border-collapse:collapse;margin-bottom:8px;"><tr>
    <td style="width:36%;vertical-align:top;border:2px solid #d9dee7;">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="background:#dbe4f7;color:#1f348f;padding:5px 10px;font-size:13px;font-weight:700;border-bottom:2px solid #fff;">مجموعة ميديا تيك التجارية</td></tr>
        <tr><td style="background:#dbe4f7;color:#1f348f;padding:5px 10px;font-size:12px;font-weight:700;border-bottom:2px solid #fff;">نقل داخلي بين الفروع</td></tr>
        <tr><td style="padding:5px 10px;font-size:12px;font-weight:700;">&nbsp;</td></tr>
      </table>
    </td>
    <td style="width:28%;text-align:center;vertical-align:middle;padding:6px;border:2px solid #dbe4f7;">
      <img src="logo.jpg" style="max-width:160px;max-height:80px;object-fit:contain;display:block;margin:0 auto 4px;" onerror="this.onerror=null;this.src=(window.GMT_BRAND&&GMT_BRAND.logo)||this.src">
      <div style="font-size:11px;color:#1f348f;font-weight:700;">GMT SYSTEMS</div>
    </td>
    <td style="width:36%;vertical-align:top;border:2px solid #d9dee7;">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="background:#dbe4f7;color:#1f348f;padding:5px 9px;font-size:12px;font-weight:700;border:1px solid #fff;width:45%;">التاريخ</td><td style="padding:5px 9px;font-size:12px;font-weight:700;border:1px solid #eee;">${dateStr}</td></tr>
        <tr><td style="background:#dbe4f7;color:#1f348f;padding:5px 9px;font-size:12px;font-weight:700;border:1px solid #fff;">التوقيت</td><td style="padding:5px 9px;font-size:12px;font-weight:700;border:1px solid #eee;">${timeStr}</td></tr>
        <tr><td style="background:#dbe4f7;color:#1f348f;padding:5px 9px;font-size:12px;font-weight:700;border:1px solid #fff;">رقم الفاتورة</td><td style="padding:5px 9px;font-size:12px;font-weight:700;border:1px solid #eee;">${escHtml(t.transfer_number)}</td></tr>
        <tr><td style="background:#dbe4f7;color:#1f348f;padding:5px 9px;font-size:12px;font-weight:700;border:1px solid #fff;">الحالة</td><td style="padding:5px 9px;font-size:12px;font-weight:700;border:1px solid #eee;">${statusTxt}</td></tr>
      </table>
    </td>
  </tr></table>

  <div style="border-top:1.5px solid #777;margin:8px 0;"></div>
  <div style="text-align:center;color:#1f348f;font-weight:700;font-size:18px;padding:7px 0 3px;">فاتورة نقل مخزون داخلي بين الفروع</div>
  ${invTitle ? `<div style="text-align:center;color:#111;font-weight:900;font-size:15px;padding:1px 0 5px;">${escHtml(invTitle)}</div>` : ''}
  ${catsLine ? `<div style="text-align:center;color:#444;font-weight:700;font-size:12px;padding:0 0 5px;">الأصناف: ${escHtml(catsLine)}</div>` : ''}
  <div style="border-top:1.5px solid #777;margin-bottom:7px;"></div>

  <table style="width:100%;margin-bottom:7px;"><tbody>
    <tr>
      <td style="background:#dbe4f7;color:#1f348f;padding:4px 8px;font-size:13px;width:18%;">📤 الفرع المُصدِّر</td>
      <td style="padding:4px 8px;font-size:13px;width:32%;font-weight:900;color:#D5001C;">${escHtml(t.from_branch_name)}</td>
      <td style="width:4%;"></td>
      <td style="background:#dbe4f7;color:#1f348f;padding:4px 8px;font-size:13px;width:14%;">📥 الفرع المستقبِل</td>
      <td style="padding:4px 8px;font-size:13px;font-weight:900;color:#047857;">${escHtml(t.to_branch_name)}</td>
    </tr>
    <tr>
      <td style="background:#dbe4f7;color:#1f348f;padding:4px 8px;font-size:13px;">أنشأ النقل</td>
      <td style="padding:4px 8px;font-size:13px;">${escHtml(t.created_by||'—')}</td>
      <td></td>
      <td style="background:#dbe4f7;color:#1f348f;padding:4px 8px;font-size:13px;">المستلم</td>
      <td style="padding:4px 8px;font-size:13px;">${t.received_by ? escHtml(t.received_by) : '— لم يُستلم بعد —'}</td>
    </tr>
  </tbody></table>

  <div style="background:#fef3c7;border:1.5px solid #f59e0b;border-radius:6px;padding:8px 12px;font-size:12px;color:#92400e;font-weight:700;margin-bottom:10px;line-height:1.7;">
    📸 تعليمات المستلم: بعد استلام الطرد، وقّع على هذه الفاتورة الورقية واكتب اسمك الكامل، ثم صوّرها وأرسل الصورة لتأكيد الاستلام في النظام.
  </div>

  <table id="inv-items-tbl" style="width:100%;table-layout:fixed;margin-bottom:7px;">
    <thead><tr>
      <th style="border:2px solid #222;background:#dbe4f7;color:#1f348f;padding:4px 2px;font-size:12px;text-align:center;width:3%;">#</th>
      <th style="border:2px solid #222;background:#dbe4f7;color:#1f348f;padding:4px 2px;font-size:12px;text-align:center;width:9%;">الصورة</th>
      <th style="border:2px solid #222;background:#dbe4f7;color:#1f348f;padding:4px 5px;font-size:12px;text-align:center;width:22%;">اسم المنتج</th>
      <th style="border:2px solid #222;background:#dbe4f7;color:#1f348f;padding:4px 2px;font-size:11px;text-align:center;width:17%;">الباركود</th>
      <th style="border:2px solid #222;background:#dbe4f7;color:#1f348f;padding:4px 2px;font-size:12px;text-align:center;width:9%;">الكمية</th>
      <th style="border:2px solid #222;background:#dbe4f7;color:#1f348f;padding:3px 2px;font-size:11px;text-align:center;width:14%;">سعر الجملة<br><span style="color:#5b6472;font-size:9px;">(فردي/إجمالي)</span></th>
      <th style="border:2px solid #222;background:#dbe4f7;color:#1f348f;padding:3px 2px;font-size:11px;text-align:center;width:14%;">سعر المبيع<br><span style="color:#5b6472;font-size:9px;">(فردي/إجمالي)</span></th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <table id="inv-totals-tbl" style="width:100%;border-collapse:collapse;margin-bottom:7px;table-layout:fixed;"><tr>
    <td style="border:2px solid #d9dee7;background:#f1f5f9;color:#0f172a;text-align:center;padding:4px 2px;font-size:11px;width:3%;">∑</td>
    <td style="border:2px solid #d9dee7;background:#f1f5f9;color:#0f172a;text-align:center;padding:4px 2px;font-size:11px;width:9%;"></td>
    <td style="border:2px solid #d9dee7;background:#f1f5f9;color:#0f172a;padding:4px 6px;font-size:12px;text-align:right;width:26%;font-weight:900;">الإجماليات</td>
    <td style="border:2px solid #1f348f;background:#dbe4f7;color:#1f348f;text-align:center;padding:4px 2px;font-size:11px;width:14%;"></td>
    <td style="border:2px solid #1f348f;background:#dbe4f7;color:#1f348f;text-align:center;padding:4px 2px;font-size:12px;font-weight:900;width:8%;">${totalQty}</td>
    <td style="border:2px solid #1f348f;background:#dbe4f7;color:#D5001C;text-align:center;padding:4px 2px;font-size:11px;font-weight:900;width:14%;">${totalCost.toFixed(2)}</td>
    <td style="border:2px solid #1f348f;background:#dbe4f7;color:#D5001C;text-align:center;padding:4px 2px;font-size:11px;font-weight:900;width:14%;">${totalSale.toFixed(2)}</td>
  </tr></table>

  <table class="col-profit" style="width:100%;border-collapse:collapse;margin-bottom:7px;">
    <tr><td colspan="2" style="background:#f1f5f9;color:#0f172a;padding:5px 10px;font-size:13px;font-weight:900;text-align:center;">📊 ملخص الفاتورة</td></tr>
    <tr><td style="background:#dbe4f7;color:#1f348f;padding:4px 8px;font-size:12px;width:50%;">إجمالي القطع المنقولة</td><td style="background:#dbe4f7;color:#1f348f;text-align:center;padding:4px 8px;font-size:12px;font-weight:900;">${totalQty}</td></tr>
    <tr><td style="padding:4px 8px;font-size:12px;">تكلفة البضاعة (سعر الجملة)</td><td style="background:#dbe4f7;color:#1f348f;text-align:center;padding:4px 8px;font-size:12px;font-weight:900;">$ ${totalCost.toFixed(2)}</td></tr>
    <tr><td style="background:#dbe4f7;color:#1f348f;padding:4px 8px;font-size:12px;">سعر المبيع المتوقع</td><td style="background:#dbe4f7;color:#1f348f;text-align:center;padding:4px 8px;font-size:12px;font-weight:900;">$ ${totalSale.toFixed(2)}</td></tr>
    <tr><td style="padding:4px 8px;font-size:13px;font-weight:900;color:${profit>=0?'#047857':'#dc2626'};">الربح المتوقع</td><td style="background:#dbe4f7;color:${profit>=0?'#047857':'#dc2626'};text-align:center;padding:4px 8px;font-size:13px;font-weight:900;">${profit>=0?'+':''}$ ${profit.toFixed(2)}</td></tr>
  </table>

  <table style="width:100%;margin-bottom:14px;"><tr>
    <td style="width:50%;vertical-align:top;padding-left:8px;border-top:2px solid #374151;text-align:center;padding-top:10px;">
      <div style="font-size:11px;color:#5b6472;margin-bottom:40px;">توقيع المُرسِل</div>
      <div style="font-size:12px;font-weight:800;">${escHtml(t.from_branch_name)}</div>
    </td>
    <td style="width:50%;vertical-align:top;padding-right:8px;border-top:2px solid #374151;text-align:center;padding-top:10px;">
      <div style="font-size:11px;color:#5b6472;margin-bottom:40px;">توقيع المستلم — الاسم الكامل</div>
      <div style="font-size:12px;font-weight:800;">${t.received_by ? escHtml(t.received_by) : '_____________________'}</div>
    </td>
  </tr></table>

  <div style="margin-top:10px;font-size:13px;font-weight:700;">اسم المستخدم: <span style="display:inline-block;min-width:80px;">${escHtml(t.created_by||'ادمن')}</span> &nbsp;&nbsp;&nbsp; نوع الحركة [ نقل داخلي ]</div>
  ${shortNote ? `<div style="margin-top:8px;border:1.5px solid #b45309;background:#fff7ed;border-radius:6px;padding:6px 9px;font-size:11.5px;font-weight:700;color:#7c2d12;">📝 ملاحظة: ${escHtml(shortNote)}</div>` : ''}
  <div style="text-align:center;margin-top:6px;font-size:12px;font-weight:700;">تاريخ الطباعة: ${new Date().toLocaleString('ar-SY')}</div>

  <div class="no-print" style="text-align:center;margin-top:24px;">
    <button onclick="window.print()" style="background:#D5001C;color:#fff;border:none;padding:12px 32px;border-radius:10px;font-size:14px;font-weight:900;cursor:pointer;font-family:Arial,Tahoma,sans-serif;">
      🖨️ طباعة الفاتورة
    </button>
  </div>

</div>
<script src="lib/JsBarcode.all.min.js?v=20261003"><\/script>
<script>
/* 🔧 (2026-08-23) [T9] بلاغ المالك: «عم يطلع الباركود أرقام فقط — لازم يكون
   الباركود الشريطي». كان يُطبع نصّاً؛ الآن يُرسم CODE128 حقيقياً في كل خلية،
   ومن تعذّر رسمه يعود نصّاً بدل خانة فارغة. */
(function(){
  function draw(){
    var els = document.querySelectorAll('svg.bc-svg');
    els.forEach(function(el){
      var code = el.getAttribute('data-code') || '';
      if(!code) return;
      try{
        JsBarcode(el, code, { format:'CODE128', width:1.4, height:30,
          displayValue:true, fontSize:10, margin:0, textMargin:1 });
      }catch(e){
        var s=document.createElement('span');
        s.style.fontSize='11px'; s.textContent=code;
        el.replaceWith(s);
      }
    });
    setTimeout(function(){ window.print(); }, 500);
  }
  if(window.JsBarcode) draw();
  else {
    var tries=0;
    var t=setInterval(function(){
      if(window.JsBarcode || ++tries>40){ clearInterval(t); draw(); }
    },100);
  }
})();
<\/script>
<\/body><\/html>`);
  printWin.document.close();
  })();
}

  global.GMTTransferPrint = { print: print };
})(typeof window !== 'undefined' ? window : this);
