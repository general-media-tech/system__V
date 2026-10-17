/* ═════════════════════════════════════════════════════════════════
   gmt-invoice-tpl.js — قالب فاتورة المبيع (A4) — **مصدرٌ واحد** لنقطة البيع وفاتورة المتجر
   أُنشئ: 2026-10-16  ·  ملاحظات ١٣ ت١ ١٢:٤٣م

   طلبُك: «فاتورة المتجر حطّلها قالب نفس فاتورة المبيع».
   كان القالب (TEMPLATE_B) حرفاً في pos.html وحدها، وفاتورة المتجر (store.html + زرّ «🧾 فاتورته» في الأوردرات) تُبنى بتصميمٍ
   آخر. الآن القالب هنا مرّةً واحدة: pos.html تقرأه من GMTInvoiceTpl.B، والمتجر والأوردرات يبنيان بياناتهما ويملآنه بنفس الدالّة.
   ⇒ لا نسختان تتباعدان بعد اليوم. (القاعدة OWN-SINGLE-SOURCE)

   الواجهة:
     GMTInvoiceTpl.B                     نصّ القالب (فيه {{مفاتيح}} كما في pos.html)
     GMTInvoiceTpl.fill(tpl, data)       يملأ القالب (+ شعار الشركة المضمَّن)
     GMTInvoiceTpl.rows(items)           صفوف الجدول: items = [{name, qty, price}] ⇒ HTML (مع صفوفٍ فارغة حتى ستّة كالمرجع)
     GMTInvoiceTpl.storeHTML(order, o)   فاتورة طلب متجر كاملة جاهزة للطباعة (A4)
   ═════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.GMTInvoiceTpl) return;

  var B = "<!DOCTYPE html>\n<html lang=\"ar\" dir=\"rtl\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n<title>\u0641\u0627\u062a\u0648\u0631\u0629 \u0645\u0628\u064a\u0639 - \u062e\u064a\u0627\u0631 B</title>\n<link href=\"https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap\" rel=\"stylesheet\" media=\"print\" onload=\"this.media='all'\">\n<style>\n/* (2026-10-04 \u0645) \u0646\u0633\u062e\u0629\u064c \u062d\u0631\u0641\u064a\u0651\u0629 \u0645\u0646 \u062a\u0635\u0645\u064a\u0645 \u0627\u0644\u0645\u0631\u062c\u0639 (\u0627\u0644\u0635\u0648\u0631\u0629 \u0662\u0662 \u0627\u0644\u064a\u0633\u0631\u0649) \u2014 \u0627\u0644\u0623\u0634\u0643\u0627\u0644 \u0648\u0627\u0644\u0627\u0646\u062d\u0646\u0627\u0621\u0627\u062a \u0648\u0627\u0644\u0623\u0644\u0648\u0627\u0646 \u0648\u0627\u0644\u062c\u062f\u0627\u0648\u0644\n   \u0648\u0627\u0644\u0639\u0644\u0627\u0645\u0629 \u0627\u0644\u0645\u0627\u0626\u064a\u0651\u0629 \u0643\u0645\u0627 \u0647\u064a. \u0627\u0644\u0645\u062d\u062a\u0648\u0649 \u0645\u062d\u062a\u0648\u0627\u0646\u0627: \u0623\u064f\u0636\u064a\u0641 \u0645\u0627 \u0644\u064a\u0633 \u0641\u064a \u0627\u0644\u0645\u0631\u062c\u0639 (\u0627\u0644\u0641\u0631\u0639 \u00b7 \u0627\u0644\u0645\u0631\u0643\u0632 \u00b7 \u0627\u0644\u0623\u0631\u0635\u062f\u0629 \u00b7 \u0627\u0644\u0645\u0644\u0627\u062d\u0638\u0627\u062a\n   \u00b7 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645 \u00b7 \u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0637\u0628\u0627\u0639\u0629) \u0648\u062d\u064f\u0630\u0641 \u0645\u0627 \u0644\u064a\u0633 \u0639\u0646\u062f\u0646\u0627 (\u0633\u0637\u0631 \u0627\u0644\u062e\u062f\u0645\u0627\u062a \u00b7 \u0627\u0644\u0628\u0631\u064a\u062f \u00b7 \u0627\u0644\u0639\u0646\u0648\u0627\u0646 \u00b7 \u0631\u0642\u0645 \u0627\u0644\u0635\u0641\u062d\u0629). */\n@page{ size:A4; margin:0; }\n@media print { * { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; color-adjust:exact !important; } }\nhtml,body{ margin:0; padding:0; width:210mm; background:#fff; font-family:'Cairo',Tahoma,Arial,sans-serif; color:#1e293b; }\n.page{ position:relative; width:210mm; min-height:297mm; margin:0 auto; padding-top:8mm; box-sizing:border-box; }\n.invoice{ width:188mm; margin:0 auto; position:relative; }\ntable{ border-collapse:separate; border-spacing:0; }\n/* \u2500\u2500 \u0627\u0644\u062a\u0631\u0648\u064a\u0633\u0629: \u0635\u0646\u062f\u0648\u0642\u0627\u0646 \u0623\u0632\u0631\u0642\u0627\u0646 \u0628\u0627\u0647\u062a\u0627\u0646 \u0648\u0627\u0644\u0634\u0639\u0627\u0631 \u0628\u064a\u0646\u0647\u0645\u0627 \u0639\u0644\u0649 \u0627\u0644\u0623\u0628\u064a\u0636 \u2500\u2500 */\n.head{ width:100%; table-layout:fixed; }\n.head>tbody>tr>td{ vertical-align:stretch; }\n.hbox{ background:#eef3fa; border-radius:1.6mm; padding:3.6mm 4.2mm; height:100%; box-sizing:border-box; }\n.co{ width:39%; }\n.co .n{ font-size:20.5px; font-weight:800; color:#1f348f; line-height:1.4; }\n.co .a{ white-space:normal; font-size:13px; color:#475569; font-weight:600; margin-top:.6mm; white-space:nowrap; }\n.co .rule{ height:1px; background:#cfd9ea; margin:3mm 0 2.2mm; }\n.co .b{ font-size:13px; color:#475569; font-weight:600; }\n.co .b b{ color:#1f348f; font-weight:700; }\n.co .c{ font-size:13px; color:#1e293b; font-weight:700; margin-top:.8mm; }\n.lg{ width:22%; text-align:center; vertical-align:middle !important; }\n.lg img{ max-width:46mm; max-height:34mm; }\n.mt{ width:39%; }\n.mt table{ width:100%; }\n.mt td{ font-size:14.5px; padding:1.05mm 0; color:#334155; font-weight:600; }\n.mt .k{ width:38%; color:#475569; white-space:nowrap; }\n.mt .s{ width:6%; text-align:center; color:#526077; }\n.mt .v{ color:#1e293b; font-weight:700; direction:ltr; text-align:right; unicode-bidi:plaintext; }\n.hr{ height:1.2px; background:#b9c6da; margin:2.8mm 0 0; }\n/* \u2500\u2500 \u0627\u0644\u0639\u0646\u0648\u0627\u0646 \u2500\u2500 */\n.ttl{ text-align:center; margin:2.6mm 0 2.2mm; }\n.ttl .t{ display:inline-block; min-width:60mm; font-size:23px; font-weight:800; color:#1f348f; background:#e6edf8; padding:.6mm 10mm; }\n.ttl .s{ font-size:15px; color:#475569; font-weight:600; margin-top:1.4mm; }\n.ttl .s b{ color:#1f348f; font-weight:800; }\n/* \u2500\u2500 \u0627\u0644\u0632\u0628\u0648\u0646 \u2500\u2500 */\n.cust{ width:100%; table-layout:fixed; border:1px solid #d6dfee; border-radius:1.6mm; background:#f7f9fd; }\n.cust td{ padding:2.6mm 3.4mm; font-size:15px; }\n.cust .k{ width:15%; color:#1f348f; font-weight:800; white-space:nowrap; }\n.cust .v{ width:35%; font-weight:600; color:#1e293b; }\n.cust .k2{ width:15%; color:#475569; font-weight:600; white-space:nowrap; border-inline-start:1px solid #d6dfee; }\n/* \u2500\u2500 \u0627\u0644\u0628\u0646\u0648\u062f: \u0631\u0623\u0633\u064c \u0623\u0632\u0631\u0642 \u0628\u0627\u0647\u062a\u060c \u062e\u0637\u0648\u0637\u064c \u0641\u0627\u062a\u062d\u0629\u060c \u0635\u0641\u0648\u0641\u064c \u0641\u0627\u0631\u063a\u0629\u060c \u0648\u0634\u0639\u0627\u0631\u064f \u0627\u0644\u0639\u062f\u0633\u0629 \u0639\u0644\u0627\u0645\u0629\u064b \u0645\u0627\u0626\u064a\u0651\u0629 \u2500\u2500 */\n.itw{ position:relative; margin-top:3mm; }\n.wm{ position:absolute; left:52%; top:9mm; width:86mm; height:86mm; transform:translateX(-50%); pointer-events:none; z-index:0; }\n.items{ position:relative; z-index:1; width:100%; table-layout:fixed; border:1px solid #d6dfee; border-radius:1.6mm; overflow:hidden; background:transparent; }\n.items th{ background:#dfe8f6; color:#1f348f; font-weight:700; font-size:14px; padding:2.3mm 1.2mm; border-inline-start:1px solid #cfd9ea; }\n.items th:first-child{ border-inline-start:0; }\n.items td{ text-align:center; font-size:14.5px; color:#1e293b; padding:1.6mm 1.2mm; line-height:1.4; border-top:1px solid #e3e9f3; border-inline-start:1px solid #e3e9f3; background:transparent; }\n.items td:first-child{ border-inline-start:0; }\n.items td:nth-child(2){ text-align:right; padding-inline-start:3mm; }\n/* \u2500\u2500 \u0627\u0644\u062e\u0644\u0627\u0635\u0629: \u0635\u0646\u062f\u0648\u0642\u0627\u0646 \u0628\u0631\u0623\u0633\u064d \u0623\u0632\u0631\u0642 \u0628\u0627\u0647\u062a \u0648\u0632\u0648\u0627\u064a\u0627 \u0645\u0633\u062a\u062f\u064a\u0631\u0629 \u2500\u2500 */\n.sum{ width:100%; table-layout:fixed; margin-top:3mm; }\n.sum>tbody>tr>td{ vertical-align:top; }\n.box{ border:1px solid #d6dfee; border-radius:1.6mm; overflow:hidden; background:#fff; }\n.sum,.wr,.nt,.qr,.rule2,.ct,.ft{ position:relative; z-index:1; }\n.box .h{ background:#e6edf8; color:#1f348f; font-weight:800; font-size:14.5px; padding:2mm 3.4mm; }\n.box table{ width:100%; }\n.box td{ font-size:14.5px; color:#334155; font-weight:600; padding:1.75mm 3.4mm; border-top:1px solid #e8edf5; }\n.box .v{ text-align:left; direction:ltr; color:#1e293b; font-weight:700; width:42%; }\n.box .net td{ background:#e6edf8; color:#1f348f; font-weight:800; font-size:17.5px; padding:2.4mm 3.4mm; }\n.box .note td{ font-size:12px; color:#1f348f; font-weight:700; background:#f3f6fb; }\n/* \u2500\u2500 \u0627\u0644\u0636\u0645\u0627\u0646 \u2500\u2500 */\n.wr{ display:flex; align-items:center; gap:2.6mm; margin-top:3mm; background:#eef3fa; border-radius:1.6mm; padding:2.6mm 3.6mm; font-size:14px; font-weight:600; color:#334155; }\n.wr svg{ flex:0 0 auto; }\n/* \u2500\u2500 \u0627\u0644\u0645\u0644\u0627\u062d\u0638\u0627\u062a \u0648\u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645 \u2500\u2500 */\n.nt{ width:100%; table-layout:fixed; margin-top:2.6mm; border:1px solid #d6dfee; border-radius:1.6mm; background:#f7f9fd; }\n.nt td{ padding:2mm 3.4mm; font-size:14px; }\n.nt .k{ width:15%; color:#1f348f; font-weight:800; }\n.nt .u{ width:32%; color:#475569; font-weight:600; text-align:left; border-inline-start:1px solid #d6dfee; }\n/* \u2500\u2500 \u0631\u0645\u0648\u0632 QR \u2500\u2500 */\n.qr{ width:100%; table-layout:fixed; margin-top:2.6mm; }\n.qr>tbody>tr>td{ padding:2.4mm 2mm; vertical-align:middle; }\n.qr .sp{ border-inline-start:1px solid #cfd9ea; }\n.qr .r{ display:flex; align-items:center; gap:3.4mm; }\n.qr .tx{ flex:1; }\n.qr .t{ font-weight:800; color:#1f348f; font-size:16px; display:flex; align-items:center; gap:2mm; margin-bottom:1mm; }\n.qr .x{ font-size:12px; line-height:1.7; color:#334155; font-weight:600; }\n.qr img{ width:20mm; height:20mm; flex:0 0 auto; }\n.rule2{ height:1.2px; background:#b9c6da; margin:2.4mm 0 0; }\n/* \u2500\u2500 \u0627\u0644\u062a\u0648\u0627\u0635\u0644 \u0648\u0627\u0644\u062a\u0630\u064a\u064a\u0644 \u2500\u2500 */\n.ct{ display:flex; justify-content:center; align-items:center; gap:3mm; padding:3mm 0 2.6mm; font-size:14px; font-weight:600; color:#334155; }\n.ct b{ display:block; color:#1e293b; font-weight:700; direction:ltr; unicode-bidi:plaintext; text-align:right; }\n.ft{ width:100%; table-layout:fixed; border-top:1.2px solid #b9c6da; }\n.ft td{ padding:2.4mm 0 0; font-size:12px; color:#526077; font-weight:600; vertical-align:top; }\n.ft .c{ text-align:center; font-size:14px; color:#1f348f; font-weight:700; }\n</style>\n</head>\n<body>\n<div class=\"page\">\n<div class=\"invoice\">\n  <table class=\"head\"><tbody><tr>\n    <td class=\"co\"><div class=\"hbox\">\n      <div class=\"n\">\u0645\u062c\u0645\u0648\u0639\u0629 \u0645\u064a\u062f\u064a\u0627 \u062a\u064a\u0643 \u0627\u0644\u062a\u062c\u0627\u0631\u064a\u0629</div>\n      <div class=\"a\">\u062a\u062c\u0627\u0631\u0629 \u0645\u0639\u062f\u0627\u062a \u0648\u0627\u0643\u0633\u0633\u0648\u0627\u0631\u0627\u062a \u0627\u0644\u062a\u0635\u0648\u064a\u0631 \u0648\u0627\u0644\u0644\u0627\u0628\u062a\u0648\u0628</div>\n      <div class=\"rule\"></div>\n      <div class=\"b\"><b>\u0641\u0631\u0639 / \u0645\u0633\u062a\u0648\u062f\u0639 / \u0646\u0642\u0637\u0629 \u0628\u064a\u0639</b> &nbsp;{{branch_name}}</div>\n      <div class=\"c\">{{center_name}}</div>\n    </div></td>\n    <td class=\"lg\"><img src=\"{{logo}}\" alt=\"Logo\"></td>\n    <td class=\"mt\"><div class=\"hbox\">\n      <table><tbody>\n        <tr><td class=\"k\">\u0627\u0644\u062a\u0627\u0631\u064a\u062e</td><td class=\"s\">:</td><td class=\"v\">{{invoice_date}}</td></tr>\n        <tr><td class=\"k\">\u0627\u0644\u062a\u0648\u0642\u064a\u062a</td><td class=\"s\">:</td><td class=\"v\">{{invoice_time}}</td></tr>\n        <tr><td class=\"k\">\u0631\u0642\u0645 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629</td><td class=\"s\">:</td><td class=\"v\">{{invoice_number}}</td></tr>\n        <tr><td class=\"k\">\u0627\u0644\u0639\u0645\u0644\u0629</td><td class=\"s\">:</td><td class=\"v\">{{currency}}</td></tr>\n      </tbody></table>\n    </div></td>\n  </tr></tbody></table>\n  <div class=\"hr\"></div>\n\n  <div class=\"ttl\"><div class=\"t\">\u0641\u0627\u062a\u0648\u0631\u0629 \u0645\u0628\u064a\u0639</div><div class=\"s\">\u0645\u0628\u064a\u0639 : <b>{{invoice_type}}</b></div></div>\n\n  <table class=\"cust\"><tbody><tr>\n    <td class=\"k\">\u0627\u0633\u0645 \u0627\u0644\u0639\u0645\u064a\u0644</td><td class=\"v\">{{customer_name}}</td>\n    <td class=\"k2\">\u0631\u0642\u0645 \u0627\u0644\u0645\u0648\u0628\u0627\u064a\u0644</td><td class=\"v\" style=\"direction:ltr;text-align:right\">{{customer_phone}}</td>\n  </tr></tbody></table>\n\n  <div class=\"itw\">\n    <svg class=\"wm\" viewBox=\"0 0 200 200\" aria-hidden=\"true\">\n      <circle cx=\"100\" cy=\"100\" r=\"88\" fill=\"none\" stroke=\"#f2f4f7\" stroke-width=\"22\"/>\n      <path d=\"M100 12 A88 88 0 0 1 186.6 84.7\" fill=\"none\" stroke=\"#fdeef0\" stroke-width=\"22\"/>\n      <circle cx=\"100\" cy=\"100\" r=\"60\" fill=\"none\" stroke=\"#f2f4f7\" stroke-width=\"12\"/>\n      <circle cx=\"100\" cy=\"100\" r=\"40\" fill=\"none\" stroke=\"#f1f3f7\" stroke-width=\"10\"/>\n      <circle cx=\"100\" cy=\"100\" r=\"20\" fill=\"#f3f5f8\"/>\n    </svg>\n    <table class=\"items\">\n      <thead><tr>\n        <th style=\"width:5%\"></th>\n        <th style=\"width:32%\">\u0627\u0633\u0645 \u0627\u0644\u0645\u0627\u062f\u0629</th><th style=\"width:8%\">\u0627\u0644\u0639\u062f\u062f</th>\n        <th style=\"width:9%\">\u0627\u0644\u0648\u062d\u062f\u0629</th><th style=\"width:13%\">\u0627\u0644\u0625\u0641\u0631\u0627\u062f\u064a</th>\n        <th style=\"width:13%\">\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a</th><th style=\"width:13%\">\u0645\u0644\u0627\u062d\u0638\u0627\u062a</th>\n      </tr></thead>\n      <tbody>\n        {{ITEMS_ROWS}}\n      </tbody>\n    </table>\n  </div>\n\n  <table class=\"sum\"><tbody><tr>\n    <td style=\"width:48.5%\"><div class=\"box\"><div class=\"h\">\u062a\u0641\u0627\u0635\u064a\u0644 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629</div><table><tbody>\n      <tr><td>\u0645\u062c\u0645\u0648\u0639 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629</td><td class=\"v\">{{invoice_total}}</td></tr>\n      <tr><td>\u062f\u0641\u0639\u0629 \u0646\u0642\u062f\u064a\u0629</td><td class=\"v\">{{cash_payment}}</td></tr>\n      <tr><td>\u0627\u0644\u062e\u0635\u0645</td><td class=\"v\">{{discount}}</td></tr>\n      <tr class=\"net\"><td>\u0635\u0627\u0641\u064a \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629</td><td class=\"v\">{{net_total}}</td></tr>\n    </tbody></table></div></td>\n    <td style=\"width:3%\"></td>\n    <td style=\"width:48.5%\"><div class=\"box\"><div class=\"h\">\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0627\u0644\u062d\u0633\u0627\u0628</div><table><tbody>\n      <tr><td>\u0645\u062c\u0645\u0648\u0639 \u0627\u0644\u0643\u0645\u064a\u0627\u062a</td><td class=\"v\">{{total_qty}}</td></tr>\n      <tr><td>\u0631\u0635\u064a\u062f\u0647 \u0642\u0628\u0644 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629</td><td class=\"v\">{{balance_before}}</td></tr>\n      <tr><td>\u0631\u0635\u064a\u062f\u0647 \u0628\u0639\u062f \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629</td><td class=\"v\">{{balance_after}}</td></tr>\n      <tr><td>\u0631\u0635\u064a\u062f \u0627\u0644\u062d\u0633\u0627\u0628 \u0627\u0644\u062d\u0627\u0644\u064a</td><td class=\"v\">{{current_balance}}</td></tr>\n      <tr class=\"note\"><td colspan=\"2\">\u0645\u0644\u0627\u062d\u0638\u0629: \u0623\u0631\u0635\u062f\u0629 \u0627\u0644\u062d\u0633\u0627\u0628 \u0627\u062d\u062a\u0633\u0628\u062a \u0642\u064a\u0645\u062a\u0647\u0627 \u0639\u0646\u062f \u0627\u0644\u0637\u0628\u0627\u0639\u0629</td></tr>\n    </tbody></table></div></td>\n  </tr></tbody></table>\n\n  <div class=\"wr\"><svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#1f348f\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z\"/><path d=\"M9 12l2 2 4-4\"/></svg>\n    <span>\u0625\u0630\u0627 \u0643\u0627\u0646\u062a \u0627\u0644\u0642\u0637\u0639\u0629 \u0645\u0634\u0645\u0648\u0644\u0629 \u0628\u0627\u0644\u0636\u0645\u0627\u0646\u060c \u0641\u0633\u062a\u062c\u062f \u0628\u0637\u0627\u0642\u0629 \u0636\u0645\u0627\u0646 \u062a\u062d\u062a\u0648\u064a \u0639\u0644\u0649 \u0631\u0645\u0632 \u0627\u0633\u062a\u062c\u0627\u0628\u0629 \u0633\u0631\u064a\u0639 (QR) \u0645\u0631\u0641\u0642\u0629 \u0645\u0639\u0647\u0627.</span></div>\n\n  <table class=\"nt\"><tbody><tr>\n    <td class=\"k\">\u0645\u0644\u0627\u062d\u0638\u0627\u062a</td><td>{{notes}}</td><td class=\"u\">\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645 [ {{username}} ]</td>\n  </tr></tbody></table>\n\n  <table class=\"qr\"><tbody><tr>\n    <td><div class=\"r\"><div class=\"tx\">\n        <div class=\"t\">\u0627\u0644\u0645\u0648\u0642\u0639 \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#1f348f\" stroke-width=\"1.8\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z\"/></svg></div>\n        <div class=\"x\">\u0644\u0644\u0627\u0637\u0644\u0627\u0639 \u0639\u0644\u0649 \u0627\u0644\u0645\u0632\u064a\u062f \u0645\u0646 \u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a \u0648\u0627\u0644\u0639\u0631\u0648\u0636\u060c \u062a\u0641\u0636\u0644 \u0628\u0632\u064a\u0627\u0631\u0629 \u0645\u0648\u0642\u0639\u0646\u0627 \u0623\u0648 \u0645\u062a\u062c\u0631\u0646\u0627 \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a. \u0643\u0645\u0627 \u064a\u0645\u0643\u0646\u0643 \u0627\u0644\u062a\u062d\u0642\u0642 \u0645\u0646 \u062d\u0627\u0644\u0629 \u0627\u0644\u0636\u0645\u0627\u0646 \u0628\u0625\u062f\u062e\u0627\u0644 \u0631\u0642\u0645 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629.</div></div>\n      <img src=\"{{website_qr}}\" alt=\"QR \u0627\u0644\u0645\u0648\u0642\u0639\"></div></td>\n    <td class=\"sp\"><div class=\"r\"><div class=\"tx\">\n        <div class=\"t\">\u0643\u0648\u0628\u0648\u0646 \u062e\u0635\u0645 <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"#d5001c\"><path d=\"M2.5 11.3V4.2c0-.9.8-1.7 1.7-1.7h7.1c.5 0 .9.2 1.2.5l8.6 8.6c.7.7.7 1.7 0 2.4l-7.1 7.1c-.7.7-1.7.7-2.4 0L3 12.5c-.3-.3-.5-.7-.5-1.2z\"/><circle cx=\"7.4\" cy=\"7.4\" r=\"1.6\" fill=\"#fff\"/></svg></div>\n        <div class=\"x\">\u0627\u0645\u0633\u062d \u0627\u0644\u0628\u0627\u0631\u0643\u0648\u062f \u0627\u0644\u0622\u0646 \u0648\u0627\u062d\u0635\u0644 \u0639\u0644\u0649 \u062e\u0635\u0645 \u064a\u0635\u0644 \u0625\u0644\u0649 30 \u062f\u0648\u0644\u0627\u0631\u0627\u064b\u060c \u064a\u064f\u062e\u0635\u0645 \u0645\u0646 \u0641\u0627\u062a\u0648\u0631\u062a\u0643 \u0627\u0644\u062d\u0627\u0644\u064a\u0629 \u0623\u0648 \u064a\u064f\u0636\u0627\u0641 \u0643\u0631\u0635\u064a\u062f \u0644\u0645\u0634\u062a\u0631\u064a\u0627\u062a\u0643 \u0627\u0644\u0642\u0627\u062f\u0645\u0629\u060c \u0648\u0641\u0642 \u0627\u0644\u0634\u0631\u0648\u0637 \u0648\u0627\u0644\u0623\u062d\u0643\u0627\u0645.</div></div>\n      <img src=\"{{coupon_qr}}\" alt=\"QR \u0643\u0648\u0628\u0648\u0646\"></div></td>\n  </tr></tbody></table>\n  <div class=\"rule2\"></div>\n\n  <div class=\"ct\"><svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"#1f348f\"><path d=\"M6.6 10.8a15.2 15.2 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z\"/></svg>\n    <div><b>\u0627\u0644\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0639\u0627\u0645\u0629: {{management_phone}}</b>\u0644\u0644\u062a\u0648\u0627\u0635\u0644 \u0648\u0627\u0644\u0634\u0643\u0627\u0648\u0649 \u0648\u062e\u062f\u0645\u0629 \u0627\u0644\u0639\u0645\u0644\u0627\u0621</div></div>\n\n  <table class=\"ft\"><tbody><tr>\n    <td style=\"width:30%\">\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0637\u0628\u0627\u0639\u0629 {{print_date}}</td>\n    <td class=\"c\">\u0634\u0643\u0631\u0627\u064b \u0644\u0627\u062e\u062a\u064a\u0627\u0631\u0643\u0645 \u0634\u0631\u0643\u0629 \u062c\u0646\u0631\u0627\u0644 \u0645\u064a\u062f\u064a\u0627 \u062a\u0643\u060c \u0627\u0644\u0648\u0643\u064a\u0644 \u0627\u0644\u0631\u0633\u0645\u064a \u0644\u0645\u0646\u062a\u062c\u0627\u062a Canon \u0641\u064a \u0633\u0648\u0631\u064a\u0627.</td>\n    <td style=\"width:30%\"></td>\n  </tr></tbody></table>\n</div>\n</div>\n</body>\n</html>\n";

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* يملأ القالب — نفس منطق fillTpl في pos.html (شعار الشركة مضمَّن دائماً لأنّ الفاتورة تُطبع في نافذةٍ جديدة) */
  function fill(tpl, data) {
    data = data || {};
    try {
      var lg = (global.GMT_BRAND && global.GMT_BRAND.logo) || 'logo.jpg';
      if (!data.brand_logo) data.brand_logo = lg;
      if (!data.logo) data.logo = lg;
    } catch (_) {}
    var parts = String(tpl).split('{{'), out = parts[0];
    for (var i = 1; i < parts.length; i++) {
      var close = parts[i].indexOf('}}');
      if (close === -1) { out += '{{' + parts[i]; continue; }
      var key = parts[i].substring(0, close).trim();
      out += (data[key] !== undefined && data[key] !== null ? String(data[key]) : '') + parts[i].substring(close + 2);
    }
    return out;
  }

  /* صفوف الجدول بالدولار — نفس شكل buildRowsB (ستّة صفوف على الأقل) */
  function rows(items) {
    var html = (items || []).map(function (it, i) {
      var q = Number(it.qty) || 1, p = Number(it.price) || 0;
      return '<tr><td style="font-size:11px;text-align:center;color:#555;">' + (i + 1) + '</td><td>' + esc(it.name || '—') + '</td><td>' + q +
             '</td><td>قطعة</td><td>' + p.toFixed(2) + '</td><td>' + (p * q).toFixed(2) + '</td><td></td></tr>';
    }).join('');
    for (var k = (items || []).length; k < 6; k++) html += '<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>';
    return html;
  }

  /* رمز QR **محلّياً** (17 ت1 · قاعدة «لا خدمات خارجية لتوليد الصور»): كان يُطلب من api.qrserver.com فتخرج الفاتورة المطبوعة
     بلا رمز حين ينقطع الإنترنت. الآن يُبنى بمكتبة ZXing الموجودة في lib/ كصورة SVG مضمَّنة (data:) — بلا شبكة.
     إن لم تكن ZXing محمَّلة في الصفحة (المتجر مثلاً، تجنّباً لـ٣٠٠ كيلوبايت على الزبون) نرجع للخدمة كما كان. */
  var _qrMemo = {};
  function qrLocal(text, color) {
    var ZX = global.ZXing;
    if (!ZX || !ZX.QRCodeWriter || !ZX.EncodeHintType) return null;
    var key = color + '|' + text;
    if (_qrMemo[key]) return _qrMemo[key];
    var hints = new Map(); hints.set(ZX.EncodeHintType.MARGIN, 1);
    var m = new ZX.QRCodeWriter().encode(String(text), ZX.BarcodeFormat.QR_CODE, 0, 0, hints);
    var W = m.getWidth(), H = m.getHeight(), d = '';
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        if (!m.get(x, y)) continue;
        var run = 1; while (x + run < W && m.get(x + run, y)) run++;     // دمج المربّعات المتجاورة ⇒ صورة أصغر
        d += 'M' + x + ' ' + y + 'h' + run + 'v1h-' + run + 'z';
        x += run - 1;
      }
    }
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" shape-rendering="crispEdges">' +
              '<rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="#' + String(color || '000000').replace('#', '') + '"/></svg>';
    return (_qrMemo[key] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
  }
  function qr(text, size, color) {
    try { var local = qrLocal(text, color); if (local) return local; } catch (_) {}
    return 'https://api.qrserver.com/v1/create-qr-code/?size=' + size + 'x' + size + '&data=' + encodeURIComponent(text) +
           '&color=' + String(color || '000000').replace('#', '') + '&bgcolor=ffffff&margin=4&format=png';
  }
  function publicBase() {
    try {
      var b = (global.GMT_LINKS && global.GMT_LINKS.base) || '';
      if (/^https?:\/\//.test(b)) return b.replace(/\/?$/, '/');
      var u = location.origin + location.pathname.replace(/[^/]*$/, '');
      if (/^https?:/.test(u) && !/localhost|127\.0\.0\.1/.test(u)) { try { localStorage.setItem('gmt_public_base', u); } catch (_) {} return u; }
      var sv = localStorage.getItem('gmt_public_base'); if (sv) return sv;
    } catch (_) {}
    return '';
  }

  var MGMT_PHONE = '+963 939773715';                       // نفس رقم الإدارة المعتمد في pos.html
  var INSTAGRAM = 'https://www.instagram.com/canon_general_media_tech963?igsh=dTdzdDlpbzlic3d5';
  var PAY = { cod: 'عند الاستلام', whatsapp: 'واتساب', shamcash: 'شام كاش' };

  /* order = { ref, name, phone, address, notes, payment, items:[{name,qty,price}], subtotal?, delivery?, discount?, total?, created_at? }
     المال هنا **عرضٌ فقط** — لا يُكتب شيءٌ في أي قاعدة. */
  function storeHTML(order, o) {
    order = order || {}; o = o || {};
    var items = (order.items || []).map(function (x) { return { name: x.name || x.product_name || x.product || '—', qty: Number(x.qty) || 1, price: Number(x.price) || 0 }; });
    var sub = order.subtotal != null ? Number(order.subtotal) : items.reduce(function (s, x) { return s + x.price * x.qty; }, 0);
    var delivery = Number(order.delivery) || 0, disc = Number(order.discount) || 0;
    var total = order.total != null ? Number(order.total) : Math.max(0, sub + delivery - disc);
    var d = order.created_at ? new Date(order.created_at) : new Date(), pad = function (n) { return n < 10 ? '0' + n : String(n); };
    var dateStr = pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(), timeStr = pad(d.getHours()) + ':' + pad(d.getMinutes());
    var usd = function (v) { return Math.abs(v).toFixed(2) + ' $'; };
    var base = publicBase();
    var qty = items.reduce(function (s, x) { return s + x.qty; }, 0);
    var notes = [];
    if (order.address) notes.push('العنوان: ' + order.address);
    if (delivery) notes.push('أجور التوصيل: ' + usd(delivery));
    if (order.notes) notes.push(order.notes);
    var data = {
      invoice_date: dateStr, invoice_time: timeStr,
      invoice_number: String(order.ref || '—'),
      currency: 'دولار أمريكي',
      branch_name: 'المتجر الإلكتروني', center_name: ' ',
      invoice_type: 'طلب من المتجر الإلكتروني',
      customer_name: order.name || '—', customer_phone: order.phone || '—', customer_address: order.address || '',
      invoice_total: usd(sub), cash_payment: usd(0), discount: usd(disc),
      net_total: usd(total), total_qty: String(qty),
      balance_before: '—', balance_after: usd(total), current_balance: usd(total),
      notes: notes.join(' · '),
      username: 'المتجر الإلكتروني', username_cashier: PAY[order.payment] || (order.payment || '—'),
      website_qr: qr(INSTAGRAM, 58, '1f348f'), coupon_qr: qr(base + 'store.html#coupon', 58, 'b91c1c'),
      management_phone: MGMT_PHONE, print_date: dateStr + ' ' + timeStr,
      subtotal: usd(sub), tax_rate: '0', tax: usd(0), grand_total: usd(total), salesman_name: 'المتجر الإلكتروني',
      ITEMS_ROWS: ''
    };
    var tpl = B.replace('{{ITEMS_ROWS}}', rows(items))
               .replace('<title>فاتورة مبيع - خيار B</title>', '<title>فاتورة طلب متجر ' + esc(order.ref || '') + '</title>')
               .replace('<div class="t">فاتورة مبيع</div><div class="s">مبيع : ', '<div class="t">فاتورة طلب</div><div class="s">المصدر : ');
    var html = fill(tpl, data);
    if (o.autoPrint) html = html.replace('</body>', '<script>setTimeout(function(){window.print()},500)<\/script></body>');
    return html;
  }

  global.GMTInvoiceTpl = { B: B, fill: fill, rows: rows, qr: qr, publicBase: publicBase, storeHTML: storeHTML };
})(window);
