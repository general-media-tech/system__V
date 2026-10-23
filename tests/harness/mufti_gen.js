// (23 ت1 · TASK-0127/0129) إيصال «المفتي» المُصطنع بتخطيط الإيصال الحقيقي (طباعة الإيصال اجور تحصيل): QR يمين ويسار · الرقم المطبوع ·
// جدول المرسل/المصدر/الوجهة/الموبايل · جدول القيم · التذييل بهواتف المكاتب. حراريّ (رماديّ باهت) أو مطبوعٌ بالألوان. يُحقن في الصفحة.
// window.__mrcpt(o) ⇒ canvas · __rotCv(cv, rot) · __degrade(cv, { scale, blur, noise }). (لا بيانات زبائن: أسماءٌ وهواتف وهمية.)
window.__mrcpt = function (o) {
  const W = 1400, Hh = 800, cv = document.createElement('canvas'); cv.width = W; cv.height = Hh; const c = cv.getContext('2d');
  const ink = o.thermal ? '#3a3f48' : '#111', red = o.thermal ? '#3a3f48' : '#c62828', blue = o.thermal ? '#3a3f48' : '#1d3f9a';
  c.fillStyle = o.thermal ? '#f3f4f6' : '#fff'; c.fillRect(0, 0, W, Hh);
  c.direction = 'rtl'; c.textAlign = 'center'; c.fillStyle = ink;
  c.font = 'bold 34px DejaVu Sans'; c.fillText(o.title || 'طباعة الايصال اجور تحصيل', W / 2, 55);
  const qr = (txt, x, y, s) => { const m = new ZXing.QRCodeWriter().encode(txt, ZXing.BarcodeFormat.QR_CODE, s, s, new Map()); c.fillStyle = '#000';
    for (let yy = 0; yy < m.getHeight(); yy++) for (let xx = 0; xx < m.getWidth(); xx++) if (m.get(xx, yy)) c.fillRect(x + xx, y + yy, 1, 1); c.fillStyle = ink; };
  if (o.qrLeft) qr(o.qrLeft, 40, 90, 170);
  if (o.qrRight) qr(o.qrRight, 1040, 150, 170);
  c.textAlign = 'left'; c.font = 'bold 30px DejaVu Sans'; if (o.printed) c.fillText(o.printed, 1150, 140);
  c.textAlign = 'right'; c.font = '17px DejaVu Sans'; c.fillText('لتتبع الشحنة امسح الباركود', 1120, 140);
  c.textAlign = 'left'; c.font = 'bold 26px DejaVu Sans'; c.fillText(o.date || '17/10/2026', 1050, 350);
  // الشعار
  c.fillStyle = o.thermal ? '#888' : '#2a7fd4'; c.beginPath(); c.ellipse(640, 190, 110, 38, 0, 0, 7); c.fill(); c.fillStyle = o.thermal ? '#555' : '#e07b1a'; c.fillRect(560, 175, 60, 30);
  c.fillStyle = o.thermal ? ink : '#e07b1a'; c.textAlign = 'center'; c.font = 'bold 28px DejaVu Sans'; c.fillText(o.company || 'شركة المفتي للشحن', 640, 300);
  // الجدول العلوي
  const rows = [['المرسل: ', o.sender || 'مجموعة ميديا تك التجارية', 'المرسل اليه: ', o.receiver || 'محمد عبد القادر حمشو'],
                ['المصدر: ', o.src == null ? '' : o.src, 'الوجهة: ', o.dst || 'حماة-ساحة العاصي'],
                ['الموبايل : ', o.phone1 || '0939773715', 'الموبايل: ', o.phone2 || '0985167100']];
  if (o.noSrcLine) rows.splice(1, 1);
  let y0 = 380; c.strokeStyle = o.thermal ? '#666' : '#9aa'; c.lineWidth = 2;
  rows.forEach((r, i) => { const y = y0 + i * 52;
    if (!o.thermal) { c.fillStyle = '#fbeedd'; c.fillRect(15, y, W - 30, 52); }
    c.strokeRect(15, y, W - 30, 52); c.beginPath(); c.moveTo(W / 2, y); c.lineTo(W / 2, y + 52); c.stroke();
    c.textAlign = 'right'; c.font = 'bold 30px DejaVu Sans';
    c.fillStyle = blue; c.fillText(r[0], W - 25, y + 38); const k1 = c.measureText(r[0]).width; c.fillStyle = ink; c.fillText(r[1], W - 25 - k1, y + 38);
    c.fillStyle = blue; c.fillText(r[2], W / 2 - 12, y + 38); const k2 = c.measureText(r[2]).width; c.fillStyle = ink; c.fillText(r[3], W / 2 - 12 - k2, y + 38);
  });
  y0 += rows.length * 52 + 8;
  // جدول القيم
  const hd = ['ضد الدفع', 'عدد الطرود', 'ثمن البضاعة', 'اجور التحصيل', 'المدفوع من المرسل', 'الاجمالي على المرسل اليه'], vl = ['لا', '1', 'ل.س', '-', '0', o.total || '150'];
  const cw = (W - 30) / 6; c.font = 'bold 20px DejaVu Sans';
  for (let i = 0; i < 6; i++) { const x = W - 15 - (i + 1) * cw; if (!o.thermal) { c.fillStyle = '#cfe0f7'; c.fillRect(x, y0, cw, 32); } c.strokeRect(x, y0, cw, 32); c.strokeRect(x, y0 + 32, cw, 36);
    c.textAlign = 'center'; c.fillStyle = blue; c.fillText(hd[i], x + cw / 2, y0 + 23); c.fillStyle = ink; c.font = 'bold 24px DejaVu Sans'; c.fillText(vl[i], x + cw / 2, y0 + 60); c.font = 'bold 20px DejaVu Sans'; }
  y0 += 80;
  c.textAlign = 'right'; c.font = 'bold 24px DejaVu Sans'; c.fillStyle = red;
  c.fillText(o.footer || 'المقر الرئيسي: سوريا- دمشق - البرامكة - هـ: دمشق: 0965112158 -حمص: 0965112157 -حلب: 0965112156', W - 25, y0 + 30);
  c.fillStyle = ink; c.font = 'bold 24px DejaVu Sans'; c.fillText('اسم و توقيع المرسل', W - 25, y0 + 75);
  if (o.thermal) { const id = c.getImageData(0, 0, W, Hh), d = id.data; for (let i = 0; i < d.length; i += 4) { const v = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2], f = v < 200 ? v * 0.55 + 70 : v; d[i] = f * 0.97; d[i + 1] = f * 0.98; d[i + 2] = Math.min(255, f * 1.03); } c.putImageData(id, 0, 0); }
  return cv;
};
window.__rotCv = function (cv, rot) {
  if (!rot) return cv; const o = document.createElement('canvas'), sw = rot % 180 !== 0; o.width = sw ? cv.height : cv.width; o.height = sw ? cv.width : cv.height;
  const x = o.getContext('2d'); x.translate(o.width / 2, o.height / 2); x.rotate(rot * Math.PI / 180); x.drawImage(cv, -cv.width / 2, -cv.height / 2); return o;
};
window.__degrade = function (cv, o) {
  let out = cv;
  if (o.scale && o.scale !== 1) { const s = document.createElement('canvas'); s.width = Math.round(cv.width * o.scale); s.height = Math.round(cv.height * o.scale); s.getContext('2d').drawImage(cv, 0, 0, s.width, s.height); out = s; }
  if (o.blur) { const s = document.createElement('canvas'); s.width = out.width; s.height = out.height; const x = s.getContext('2d'); x.filter = 'blur(' + o.blur + 'px)'; x.drawImage(out, 0, 0); out = s; }
  if (o.noise) { const x = out.getContext('2d'), id = x.getImageData(0, 0, out.width, out.height), e = id.data; let sd = 5; for (let i = 0; i < e.length; i += 4) { sd = (sd * 16807) % 2147483647; const n = (sd / 2147483647 - 0.5) * o.noise; e[i] += n; e[i + 1] += n; e[i + 2] += n; } x.putImageData(id, 0, 0); }
  return out;
};
