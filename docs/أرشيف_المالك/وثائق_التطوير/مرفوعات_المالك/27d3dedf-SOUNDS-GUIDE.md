# دليل الأصوات الاحترافية لنظام GMT

## 1) كيف تركّبها (3 خطوات)
1. حمّل الملفات (جدول القسم 5) وسمِّها `gmt-<اسم-الحدث-بأحرف-صغيرة-وشرطات>.mp3`. مثال: `POS_SALE_SUCCESS` ← `gmt-pos-sale-success.mp3`.
2. ضعها في `/sounds/` على الخادم (لا تعمل من `file://`، استخدم خادماً محلياً).
3. افتح لوحة الإعدادات `gmtSound.openSettings()`: كل صوت عليه شارة **ملف** (أخضر) أو **احتياطي** (برتقالي). أي ملف ناقص يعمل بصوت احتياطي مؤقتاً دون أن ينكسر النظام. زر «الملفات الاحترافية» يقارن لك الملف بالاحتياطي فوراً.

اختياري قبل تحميل السكربت:
```js
window.GMT_SOUND_CONFIG = {
  basePath: '/sounds/', ext: 'mp3', preload: 'all',
  files: { UI_CLICK: ['click-a', 'click-b'] },  // عدة نسخ: يختار عشوائياً دون تكرار متتالٍ
  gains: { POS_SALE_SUCCESS: 0.8 }              // موازنة الشدة بين الأصوات
};
```

## 2) قواعد الاختيار (لتجنّب التشابه)
- كل **عائلة** صوتية لها جرس (Timbre) وطبقة وإيقاع مختلفة: الواجهة (نقرات جافة)، البيع (أجراس معدنية)، التأكيدات (نغمات ناعمة)، الأمنية (منخفضة خشنة).
- ميّز الأصوات داخل العائلة **بعدد النغمات والإيقاع** أكثر من الطبقة وحدها.
- نطاق الطبقة بين 125Hz و5kHz تقريباً، وفرق 2–3 أوكتاف بين العائلات المتجاورة (إرشادات Brewster للـEarcons).
- الباركود: صفارة واحدة قصيرة بين 2 و4kHz للنجاح، ونبضتان أو نغمة منخفضة للفشل.
- الصاعد = نجاح/فتح، الهابط = إغلاق/إلغاء/خطأ.
- للأصوات الكثيرة التكرار (نقر، كمية) حمّل 3–4 نسخ مختلفة قليلاً. المحرك يضيف تنويعاً بسيطاً في الطبقة تلقائياً.

## 3) المصادر والتراخيص (تحقق من نص الرخصة قبل النشر التجاري)
| المصدر | الترخيص | ملاحظة |
|---|---|---|
| Kenney Interface Sounds (kenney.nl/assets/interface-sounds) | CC0 | 100 صوت: نقرات، snap، maximize/minimize، تأكيدات |
| Freesound (freesound.org) | يختلف لكل صوت | فعّل فلتر CC0 |
| Mixkit (mixkit.co) | مجاني للاستخدام التجاري بلا إسناد | ممنوع إعادة بيع الملف منفرداً |
| Pixabay Sound Effects | مجاني تجارياً بلا إسناد | ممنوع إعادة البيع منفرداً |
| Sonniss GDC Bundle | Royalty-free | حزمة ضخمة (200GB+) احترافية |
| ZapSplat (الخطة المجانية) | يتطلب إسناداً | |

**مدفوع (جودة أعلى):**
- Modern Cash Register: 16 صوتاً من آلة Sharp حقيقية، 24bit/96kHz، حوالي 17$: https://www.asoundeffect.com/?p=1393
- 50 صوت ka-ching، تجاري بلا إسناد، من 1$: https://cashregistersound.gumroad.com/l/cash_register_sound_effect_download
- UI Sounds: Musical (300 ملف، مناسبة للدفع والتجارة الإلكترونية): https://soundexmachina.itch.io/ui-sounds-musical
- UI Sound Pack (2,100+ ملف MP3، حوالي 12$): https://introbleep.gumroad.com/l/ui-sound-pack

## 4) مواصفات الملفات
- MP3 بمعدل 44.1kHz و96–128kbps (mono يكفي). أطوال: واجهة ≤ 120ms، تأكيدات ≤ 800ms، البيع ≤ 1.5s، الطلب الجديد ≤ 2.5s.
- بلا صمت في البداية (أقل من 5ms) كي لا يتأخر الصوت عن الحركة.
- ذروة الصوت عند -3dBFS، والموازنة بين الأصوات تتم بـ`gains` لا بتعديل الملفات.
```bash
# قص الصمت من البداية والنهاية وتحويل إلى MP3
ffmpeg -i in.wav -af "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse" -ar 44100 -ac 1 -b:a 112k gmt-ui-click.mp3
# معايرة الذروة (pip install ffmpeg-normalize)
ffmpeg-normalize in.wav -nt peak -t -3 -o out.wav
```

## 5) جدول الأحداث (41)
البحث بالإنجليزية في المصادر أعلاه. الملف = `gmt-<id>.mp3` كما في القسم 1.

### الواجهة
| الحدث | الصوت المطلوب | كلمات البحث |
|---|---|---|
| UI_CLICK | نقرة جافة قصيرة < 60ms، 3–4 نسخ | ui click soft, button tap |
| UI_MODAL_OPEN | whoosh خفيف صاعد ~150ms | ui open, pop up, swoosh up |
| UI_MODAL_CLOSE | نفس العائلة لكن هابط | ui close, swoosh down |
| UI_COPY | نقرتان سريعتان صاعدتان | ui copy, snap double |
| UI_TOGGLE_ON | نقرة مع نغمة صاعدة | switch on, toggle on |
| UI_TOGGLE_OFF | نقرة مع نغمة هابطة | switch off, toggle off |
| UI_SAVE_OK | نغمتان ناعمتان (chime) | ui save success, soft confirm |
| UI_DELETE | thud قصير هابط، غير مخيف | ui delete, trash, crumple short |

### نقطة البيع
| الحدث | الصوت المطلوب | كلمات البحث |
|---|---|---|
| POS_SCAN_SUCCESS | صفارة واحدة 2–4kHz، 60–90ms | barcode scanner beep, good read beep |
| POS_SCAN_UNKNOWN | نبضتان منخفضتان قصيرتان | scanner error buzz, double low beep |
| POS_ITEM_ADD | pop لطيف مع نغمة قصيرة | ui pop, add to cart, bubble pop |
| POS_ITEM_REMOVE | pop عكسي هابط | ui remove, soft whoosh down |
| POS_QTY_CHANGE | tick شبه صامت < 30ms | ui tick, increment |
| POS_DISCOUNT | رنة لامعة مع تألق | sparkle ding, coin shimmer |
| POS_HOLD_ORDER | نغمتان هابطتان (حفظ مؤقت) | ui pause, soft down |
| POS_REFUND_OK | نغمة محايدة غير احتفالية | refund, soft chime down |
| POS_DRAWER_OPEN | ka-chunk ميكانيكي مع ding | cash drawer open |
| POS_SALE_SUCCESS | **ka-ching حقيقي** ≤ 1.5s (جرس لامع ثم الدرج) | cash register cha-ching, ka-ching bell drawer |
| POS_PAY_FAIL | ثلاث نبضات هابطة منخفضة (الأخطر) | payment declined, error buzz low |
| POS_PRINT_START | نقر طابعة حرارية ~0.5s | thermal printer receipt printing |

### الضمان
| الحدث | الصوت المطلوب | كلمات البحث |
|---|---|---|
| WAR_VERIFIED | chime ثلاثي صاعد لامع (يختلف عن البيع) | approved chime, verified ding |
| WAR_STAMP | ضربة ختم مطاطي/خشبي، تتزامن مع 300ms من الحركة | rubber stamp, stamp thud |
| WAR_EXPIRED | ثلاث نغمات هابطة هادئة | expired, descending notes soft |
| WAR_SERIAL_ERR | نبضتان منخفضتان مع thud | invalid, access denied buzz |

### الطلبات
| الحدث | الصوت المطلوب | كلمات البحث |
|---|---|---|
| ORD_NEW_REMOTE | جرس مميز 2–3s، لا يشبه أي صوت آخر | new order notification, order alert bell |
| ORD_CONFIRMED | نغمتان صاعدتان قصيرتان | confirm chime, accept |
| ORD_STATUS_SHIP | ثلاث نغمات صاعدة مع thump صغير | package delivered, success short |
| ORD_CANCELLED | نغمتان هابطتان | cancel, dismiss soft down |
| ORD_OVERDUE | ثلاث صفرات متوسطة الإلحاح | reminder beep triple |
| ORD_DUPLICATE | نبضتان منخفضتان | duplicate, warning double buzz |

### المخزون
| الحدث | الصوت المطلوب | كلمات البحث |
|---|---|---|
| INV_LOW_STOCK | نغمتان متساويتان (تنبيه لطيف) | low warning, attention two tone |
| INV_OUT_STOCK | ثلاث نبضات هابطة | out of stock, error three descending |
| INV_RESTOCKED | صندوق يُنزل مع نغمتين صاعدتين | box drop chime, stock received |

### الدخول والمزامنة
| الحدث | الصوت المطلوب | كلمات البحث |
|---|---|---|
| AUTH_LOGIN_OK | نغمتان دافئتان صاعدتان | login, unlock, welcome chime |
| AUTH_LOGOUT | عكسها (هابطتان) | logout, lock |
| AUTH_DENIED | نبضة منخفضة طويلة مع thud | access denied, locked |
| SYNC_OFFLINE | نغمة هابطة | disconnect, offline |
| SYNC_ONLINE | نغمة صاعدة | connect, online |
| SYNC_SUCCESS | نغمة واحدة هادئة | sync done, soft ding |

### الكيبورد
| الحدث | الصوت المطلوب | كلمات البحث |
|---|---|---|
| KB_SNIPPET_PASTE | tick عالٍ < 25ms | key tick, soft keyboard click |
| KB_SEARCH_EMPTY | نغمة منخفضة قصيرة | no results, soft negative |

## 6) الصوت مع الحركة (حدث واحد = صوت + حركة + اهتزاز)
```js
GMTFeedback.fire('POS_SALE_SUCCESS', { target: '#pay-btn', verifiedSuccess: true });
GMTFeedback.fire('POS_ITEM_ADD', { source: '#product-img', cart: '#cart-icon' });
GMTFeedback.fire('WAR_STAMP', { target: '.warranty-stamp-badge', verifiedSuccess: true }); // الصوت عند لحظة الاصطدام
GMTFeedback.fire('INV_LOW_STOCK', { target: '.stock-row' });
```
عند التركيب: اضغط «تشغيل الكل بالترتيب» في لوحة الإعدادات واسمع الـ41 صوتاً متتابعة، وما يشبه غيره غيّره.
