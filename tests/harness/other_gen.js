// (25 ت1 · TASK-0159) إيصالا «القدموس» و«مسارات» المُصطنعان بتخطيط إيصالات المالك (الصور الحقيقية خارج المستودع — فيها زبائن):
//   القدموس — الترويسة · رقم الإشعار (أربعة · حرف B/C · ستّة أرقام) بين الترويسة والجدول · «المصدر: حلب» وتحتها في الخانة نفسها اسم المكتب
//             («فرقان») · الباركود الخطّي (Code 128) أسفل الإيصال يحمل الرقم كاملاً.
//   مسارات — «فاتورة» وتحتها سبعة أرقام أعلى الإيصال خارج الجدول · رمز QR «#…#<الرقم>_<التاريخ>_…#» · «المصدر : حلب - سليمانية» (المدينة
//             والمكتب في سطر) بجانب التاريخ · «للاستعلام: 021-9919».
// window.__qrcpt(o) · __masrcpt(o) ⇒ canvas · __c128(ctx, text, x, y, h, unit). أسماءٌ وهواتف وهمية فقط.
(function () {
  const P = ['212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222',
    '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321', '232121',
    '111323', '131123', '131321', '112313', '132113', '132311', '211313', '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
    '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224', '111422', '121124', '121421',
    '141122', '141221', '112214', '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', '111242', '121142', '121241', '114212',
    '124112', '124211', '411212', '421112', '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', '114131',
    '311141', '411131', '211412', '211214', '211232', '2331112'];
  // Code 128-B: البداية 104 · كل محرف (رمزه − 32) · المجموع الموزون mod 103 · النهاية 106
  window.__c128 = function (c, text, x, y, h, u) {
    const codes = [104]; for (const ch of text) codes.push(ch.charCodeAt(0) - 32);
    let sum = 104; for (let i = 1; i < codes.length; i++) sum += codes[i] * i;
    codes.push(sum % 103, 106);
    let cx = x + 10 * u; c.fillStyle = '#000';
    codes.forEach(k => { const p = P[k]; for (let i = 0; i < p.length; i++) { const w = +p[i] * u; if (i % 2 === 0) c.fillRect(cx, y, w, h); cx += w; } });
    return cx + 10 * u - x;
  };
  const qr = (c, txt, x, y, s) => { const m = new ZXing.QRCodeWriter().encode(txt, ZXing.BarcodeFormat.QR_CODE, s, s, new Map()); c.fillStyle = '#000';
    for (let yy = 0; yy < m.getHeight(); yy++) for (let xx = 0; xx < m.getWidth(); xx++) if (m.get(xx, yy)) c.fillRect(x + xx, y + yy, 1, 1); };
  const thermal = (cv) => { const c = cv.getContext('2d'), id = c.getImageData(0, 0, cv.width, cv.height), d = id.data;
    for (let i = 0; i < d.length; i += 4) { const v = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2], f = v < 200 ? v * 0.55 + 70 : v; d[i] = f * 0.97; d[i + 1] = f * 0.98; d[i + 2] = Math.min(255, f * 1.03); }
    c.putImageData(id, 0, 0); };
  window.__qrcpt = function (o) {
    const W = 1000, Hh = 1400, cv = document.createElement('canvas'); cv.width = W; cv.height = Hh; const c = cv.getContext('2d');
    c.fillStyle = '#fff'; c.fillRect(0, 0, W, Hh); c.direction = 'rtl'; c.fillStyle = '#111';
    c.textAlign = 'center'; c.font = 'bold 40px DejaVu Sans'; c.fillText(o.title || 'شركة القدموس للخدمات البريدية والحوالات', W / 2, 80);
    c.font = '26px DejaVu Sans'; c.fillText('اشعار شحن طرد', W / 2, 130);
    // صفّ الرقم: «ضد الدفع» يميناً والرقم يساره
    c.textAlign = 'right'; c.font = 'bold 28px DejaVu Sans'; c.fillText('ضد الدفع: لا', W - 40, 230);
    if (o.printed !== false) { c.direction = 'ltr'; c.textAlign = 'left'; c.font = 'bold 40px DejaVu Sans'; c.fillText(o.number, 260, 232); c.direction = 'rtl'; }
    c.textAlign = 'right'; c.font = '24px DejaVu Sans'; c.fillText('رقم الاشعار', 250 + 520, 280);
    // الجدول: خانة المصدر بسطرين («المصدر: حلب» وتحتها المكتب) كإيصال المالك · ثمّ صفوف المرسل
    const rows = [[['المصدر: ' + (o.city || 'حلب'), o.office == null ? 'فرقان' : o.office], ['الوجهة: ' + (o.dstCity || 'دمشق'), o.dstOffice || 'مزة']],
                  [['المرسل: ' + (o.sender || 'مؤسسة النور التجارية')], ['المرسل اليه: ' + (o.receiver || 'سامر خليل')]],
                  [['الموبايل: ' + (o.phone1 || '0911000111')], ['الموبايل: ' + (o.phone2 || '0922000222')]],
                  [['تاريخ الطباعة: 2026/10/20'], ['نوع الطرد: مغلف']]];
    const L = o.lines || { lw: 2, col: '#222' };
    let y = 330; c.strokeStyle = L.col || '#222'; c.lineWidth = L.lw || 1;
    rows.forEach((r) => {
      const hh = r[0].length > 1 ? 104 : 64;
      if (L.lw) { c.strokeRect(30, y, W - 60, hh); c.beginPath(); c.moveTo(W / 2, y); c.lineTo(W / 2, y + hh); c.stroke(); }
      c.fillStyle = '#111'; c.textAlign = 'right';
      r.forEach((cell, ci) => cell.forEach((t, li) => { c.font = (li ? '' : 'bold ') + (li ? 28 : 30) + 'px DejaVu Sans'; c.fillText(t, ci ? W / 2 - 18 : W - 48, y + 42 + li * 42); }));
      y += hh;
    });
    c.font = 'bold 26px DejaVu Sans'; c.fillText('المجموع: 15000 ل.س', W - 45, y + 60);
    c.font = '22px DejaVu Sans'; c.fillText('الاستعلام عن الطرد على الرقم 0112000000', W - 45, y + 110);
    if (o.barcode !== false) { const mods = (o.number.length + 3) * 11 + 13 + 20; window.__c128(c, o.number, Math.round((W - mods * 3) / 2), 1150, 150, 3); }
    if (o.thermal) thermal(cv);
    return cv;
  };
  window.__masrcpt = function (o) {
    const W = 1400, Hh = 900, cv = document.createElement('canvas'); cv.width = W; cv.height = Hh; const c = cv.getContext('2d');
    c.fillStyle = '#fff'; c.fillRect(0, 0, W, Hh); c.direction = 'rtl'; c.fillStyle = '#111';
    c.textAlign = 'right'; c.font = 'bold 40px DejaVu Sans'; c.fillText(o.title || 'مسارات اكسبرس لنقل الطرود', W - 40, 70);
    c.font = '24px DejaVu Sans'; c.fillText('للاستعلام: 021-9919', W - 40, 115);
    if (o.qr !== false) qr(c, '#M' + (o.qrId || '7') + '#' + o.number + '_2026/09/03_1#', 40, 30, 180);
    // «فاتورة» وتحتها الرقم — أعلى الإيصال خارج الجدول
    c.textAlign = 'center'; c.font = 'bold 40px DejaVu Sans'; c.fillText('فاتورة', W / 2, 90);
    if (o.printed !== false) { c.direction = 'ltr'; c.font = 'bold 44px DejaVu Sans'; c.fillText(o.number, W / 2, 150); c.direction = 'rtl'; }
    c.font = '24px DejaVu Sans'; c.fillText('نسخة المرسل', W / 2, 195);
    const rows = [['المصدر : ' + (o.src || 'حلب - سليمانية'), 'التاريخ 2026/09/03', 'الوجهة : ' + (o.dst || 'دمشق - المزة')],
                  ['المرسل: ' + (o.sender || 'مؤسسة النور التجارية'), 'الموبايل: 0911000111', 'المرسل اليه: ' + (o.receiver || 'سامر خليل')],
                  ['البضاعة: طرد', 'عدد القطع: 1', 'المبلغ: 15000']];
    let y = 260; const cw = (W - 60) / 3; c.strokeStyle = '#555'; c.lineWidth = 2;
    rows.forEach(r => {
      for (let i = 0; i < 3; i++) { const x = W - 30 - (i + 1) * cw; c.strokeRect(x, y, cw, 70); c.fillStyle = '#111'; c.textAlign = 'right'; c.font = 'bold 30px DejaVu Sans'; c.fillText(r[i], x + cw - 14, y + 47); }
      y += 70;
    });
    c.textAlign = 'right'; c.font = '24px DejaVu Sans'; c.fillText('توقيع المرسل', W - 40, y + 70);
    if (o.thermal) thermal(cv);
    return cv;
  };
})();
