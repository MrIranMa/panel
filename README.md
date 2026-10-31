<div align="center">

# NIGHTLINE · V2.5.2

**پنل آزاد، رایگان و متن‌باز مدیریت اشتراک VLESS، Trojan و پروکسی رسمی تلگرام روی شبکهٔ ابری کلادفلر**  
*Free & Open-Source Serverless VLESS, Trojan, Fragment, Smart ISP Advisor, Live Monochrome Telemetry, Private DoH & Official Telegram Web Proxy Panel on Cloudflare Workers & Pages*

[![Version](https://img.shields.io/badge/Version-2.5.2-111111?style=flat-square)](#)
[![Runtime](https://img.shields.io/badge/Cloudflare-Workers%20%26%20Pages-111111?style=flat-square)](#)
[![License](https://img.shields.io/badge/Free%20%26%20Open--Source-Not%20For%20Sale-14532d?style=flat-square)](#اطلاعیه-مهم-رایگان-و-غیرقابل-فروش)

</div>

[یادداشت انتشار V2.5.2 / Release Notes](RELEASE_NOTES_v2.5.2.md) · [یادداشت V2.5.1](RELEASE_NOTES_v2.5.1.md) · [مخزن رسمی / Official Repository](https://github.com/youdidking/NightLine)

---

> ### اطلاعیهٔ مهم (رایگان و غیرقابل فروش)
> پروژهٔ **NIGHTLINE** یک نرم‌افزار **کاملاً رایگان، آزاد و متن‌باز (Open-Source)** است. هرگونه خرید و فروش سورس، پنل یا لینک‌های اشتراک ساخته‌شده با این ابزار اکیداً ممنوع است.  
> **NIGHTLINE is 100% Free & Open-Source — Strictly Not For Sale.**

---

## پیش‌نمایش محیط پنل (Screenshots — V2.5.2)

### ۱. پیشخوان مدیریت — تم روزنامهٔ روشن (فارسی) با نوار شناسایی IP/اپراتور و نوسان‌نگار تک‌رنگ سرعت
![NIGHTLINE Dashboard Light FA](docs/screenshots/01-dashboard-light-fa.png)

### ۲. پیشخوان مدیریت — تم تاریک (انگلیسی) با مخفی‌سازی IP (`BLUR`) و نمودار هاشورخوردهٔ مصرف مشترکین
![NIGHTLINE Dashboard Dark EN](docs/screenshots/02-dashboard-dark-en.png)

### ۳. مشاور محتاط اینترنت مرورگر و سنجش محدود آپلود/دانلود تا Worker
![NIGHTLINE Smart ISP Advisor](docs/screenshots/07-smart-isp-advisor.png)

### ۴. رنج‌های رسمی Cloudflare، نمونه‌گیری IPهای نامزد و پروکسی رسمی تلگرام
![NIGHTLINE Network Scanner & Telegram Web Proxy](docs/screenshots/03-network-scanner-tgproxy.png)

### ۵. صفحهٔ اختصاصی هر مشترک (`/sub/<token>`) و راهنمای سرور DoH اختصاصی (`/dns-query/<token>`)
![NIGHTLINE Subscriber Press Pass](docs/screenshots/04-subscriber-press-pass.png)

![NIGHTLINE Private DoH Guide](docs/screenshots/05-private-doh-guide.png)

### ۶. صفحهٔ ورود — نمایش در تم روشن فارسی و تم تاریک انگلیسی
![NIGHTLINE Login Light FA](docs/screenshots/08-login-light-fa.png)

![NIGHTLINE Login Dark EN](docs/screenshots/09-login-dark-en.png)

---

## نسخهٔ `V2.5.2`

بهبود عملکرد کلی.

## نسخهٔ `V2.5.1`

بهبودهای کلی رابط کاربری و رفع باگ‌ها.

---

## تازه‌های نسخهٔ `V2.5.0`

- **نوار فشردهٔ سقف درخواست روزانهٔ Cloudflare** در پیشخوان: نمایش درخواست‌های ثبت‌شدهٔ امروزِ **کل حساب**، آستانهٔ قابل تنظیم، درصد مصرف و زمان بازنشانی در نیمه‌شب UTC. گزارش از GraphQL کلادفلر خوانده می‌شود؛ بدون توکن، نوار به‌جای عدد ساختگی درخواست اتصال توکن را نشان می‌دهد.
- **راهنمای توکن و سطح دسترسی در همان پنل:** کادر کوچک «دسترسی‌های موردنیاز»، بررسی واقعی توکن پیش از ذخیره و امکان حذف توکن. مقدار توکن در فضای `KV` پنل ذخیره می‌شود؛ تنها برچسبِ پوشیده‌شدهٔ آن به رابط کاربری بازمی‌گردد. برای امنیت، توکن را فقط به حساب خودتان محدود کنید.
- **بررسی نسخه و بروزرسانی مستقیم ورکر:** دکمهٔ بروزرسانی در نوار وضعیت، نسخهٔ منتشرشده یا شاخهٔ اصلی [مخزن رسمی `youdidking/NightLine`](https://github.com/youdidking/NightLine) را بررسی می‌کند. با توکن دارای `Workers Scripts: Edit`، فایل اجرایی رسمی روی ورکر فعلی بارگذاری می‌شود و اتصال‌های `KV`، متغیرها، اسرار و تنظیمات سازگاری موجود نگه داشته می‌شوند. این بروزرسانی مستقیم برای **Cloudflare Workers** است؛ برای **Pages** فایل فشردهٔ جدید را مجدداً Deploy کنید.
- **رفع باگ مشترک تازه:** نوار حجم و نمودار برای کاربر با مصرف `0 B` واقعاً `0%` هستند؛ ایجاد شناسهٔ تکراری رد می‌شود و مصرف معلق هنگام ریست/تعویض کلید پاک می‌شود.
- **پرداخت بصری:** فاصلهٔ تب «مشاور هوشمند» با سایر تب‌ها برابر شده، توضیحات متای زائد و کلوفون فونت حذف شده و نوار وضعیت فارسی و انگلیسی در عرض دسکتاپ به‌صورت یک‌ردیفه نمایش داده می‌شود.
- **راستی‌آزمایی:** `15/15` سناریوی تست سرتاسری شامل API، تونل زنده، اتصال و سهمیهٔ Cloudflare با سرور ساختگی، بروزرسانی از GitHub با سرور ساختگی، مصرف مشترک تازه و ظاهر رابط با Playwright پاس شده است. این تست‌ها **استقرار واقعی روی حساب شما یا انتشار واقعی مخزن گیت‌هاب را انجام نمی‌دهند**.

### امکانات پایه از نسخه‌های پیشین

- **مشاور اینترنت مرورگر (`Smart Browser ISP Advisor`):** مشاهدهٔ پاسخ شبکهٔ میزبان‌ها و سنجش نمونهٔ ۱۲۸ کیلوبایتی آپلود/دانلود تا خود Worker. پاسخ مبهم به معنی فیلتر قطعی یا تحریم نیست؛ پورت‌های آزمایش‌نشده باز فرض نمی‌شوند. تنها پیشنهادهای دارای پشتوانه با تأیید مدیر ذخیره می‌شوند؛ تغییرات سازگار با URI مانند Early Data و ALPN در لینک موجود Normal منعکس می‌شوند، نه Fragment واقعی.
- **تشخیص خودکار IP، کشور و اپراتور بازدیدکننده + کلید مخفی‌سازی (`BLUR`):** نمایش فوری آدرس IP، کشور/شهر، اپراتور اینترنت (همراه اول، ایرانسل، مخابرات، شاتل، آسیاتک، رایتل و...) و دیتاسنتر کلادفلر به محض ورود به پنل همراه با دکمهٔ محوسازی آنی IP (`BLUR / SHOW`).
- **تلگراف و نمودار زندهٔ تک‌رنگ (`Monochrome Live Speed, RTT & Quota Chart`):** نوسان‌نگار ۶۰ فریم‌برثانیهٔ سرعت انتقال لبه (`Mbps`)، پینگ و جیتر (`ms`) + تست سرعت لحظه‌ای (`Burst Speed Test`) و نمودار ستونی هاشورخوردهٔ مصرف مشترکین، کاملاً وفادار به پالت تک‌رنگ روزنامه در هر دو تم روشن و تاریک.
- **سیستم آیکون‌های برداری اختصاصی و فیزیک دکمه‌های سایه‌ثابت:** حذف ایموجی‌ها از رابط کاربری (به‌جز پرچم در نام نودهای اشتراک) و جایگزینی با آیکون‌های برداری تک‌رنگ (`SVG Sprite`) و انیمیشن نرم دکمه‌ها با سایهٔ کاملاً ثابت روی کاغذ هنگام کلیک.
- **دو پروتکل همزمان بدون نیاز به سرور مجازی:** پشتیبانی همزمان از **VLESS** و **Trojan** روی WebSocket با مصرف پردازندهٔ بهینه‌شده برای پلن رایگان کلادفلر (`Free Tier`).
- **پروکسی رسمی تلگرام (`Telegram Web Proxy`):** پیاده‌سازی کامل پروتکل رسمی `tg://webproxy` (مبتنی بر MTProto سرتاسری) برای اتصال یک‌ضرب در **Telegram Desktop** و **Telegram Android** بدون نیاز به روشن کردن فیلترشکن.
- **مدیریت چندکاربره با فضای `KV`:** تعریف تا ۲۰۰ مشترک مجزا با سقف حجم مصرفی (`GB`)، تاریخ انقضا، شمارش اعتبار از **اولین اتصال واقعی (`Start on First Connect`)**، توقف موقت، ریست ترافیک و تعویض یک‌کلیکی کلیدها.
- **خروجی هوشمند چندکلاینته با یک لینک واحد:** تشخیص خودکار برنامه و تولید کانفیگ استاندارد برای **v2rayNG**، **MahsaNG**، **v2rayN**، **Hiddify**، **Sing-box**، **Clash Meta / Mihomo**، **Streisand** و **Shadowrocket**.
- **بهبود سازگاری با برخی سایت‌های پشت کلادفلر (مانند `speedtest.net`) و سرور `Private DoH`:** مجهز به بافر بازپخش چندفریمی (`Multi-Frame Replay`)، لیست `ProxyIP` و `NAT64` و سرور اختصاصی `/dns-query/<token>` سازگار با `RFC 8484` و `JSON DNS`.

---

## راهنمای سقف روزانهٔ Cloudflare و توکن API

1. از نشان **سقف روزانه CF** در پنل وارد راهنمای توکن شوید. تمپلیت رسمی و ازپیش‌پرشدهٔ [فقط خواندن آمار و تنظیمات](https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=%5B%7B%22key%22%3A%22account_analytics%22%2C%22type%22%3A%22read%22%7D%2C%7B%22key%22%3A%22account_settings%22%2C%22type%22%3A%22read%22%7D%5D&accountId=*&zoneId=all&name=NIGHTLINE%20Analytics) فقط `Account Analytics: Read` و `Account Settings: Read` دارد. اگر **بروزرسانی مستقیم Worker** می‌خواهید، تمپلیت [به‌علاوهٔ Workers Scripts: Edit](https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=%5B%7B%22key%22%3A%22account_analytics%22%2C%22type%22%3A%22read%22%7D%2C%7B%22key%22%3A%22account_settings%22%2C%22type%22%3A%22read%22%7D%2C%7B%22key%22%3A%22workers_scripts%22%2C%22type%22%3A%22edit%22%7D%5D&accountId=*&zoneId=all&name=NIGHTLINE%20Analytics%20and%20Self-Update) را به‌صورت اختیاری انتخاب کنید.
2. در **داشبورد خود Cloudflare** حساب مورد نظر و دامنهٔ دسترسی را بازبینی و تأیید کنید؛ توکن در همان داشبورد به خودتان نمایش داده می‌شود و به‌طور خودکار به پنل ارسال نمی‌شود. [مستندات رسمی تمپلیت توکن](https://developers.cloudflare.com/fundamentals/api/how-to/account-owned-token-template/) و [راهنمای ساخت توکن](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/) را ببینید.
3. توکن را شخصاً در کادر پنل وارد کنید، نام دقیق Worker را (اگر تشخیص داده نشد) بنویسید و **بررسی اتصال توکن**، سپس **ذخیره و فعال‌سازی** را بزنید. توکن در `KV` همین پنل ذخیره و فقط مقدار پوشیده‌شده به UI برمی‌گردد؛ برای قطع دسترسی، آن را از پنل حذف یا در Cloudflare باطل کنید.
4. عدد پیش‌فرض **۱۰۰٬۰۰۰ درخواست/روز** یک آستانهٔ قابل‌تغییر برای نمایش است؛ طرح Free در مستندات Cloudflare سقف روزانهٔ متعلق به **اکانت** دارد، نه هر توکن. آمار گراف‌کیوال حساب ممکن است با تأخیر برسد و مقدار نمایش‌داده‌شده لزوماً باقی‌ماندهٔ قابل‌مصرف را تضمین نمی‌کند.

### چند حساب Cloudflare

چند توکن یا چند Worker زیر یک حساب، سقف همان حساب را جمع نمی‌کنند. چند حساب مستقل ممکن است سهمیهٔ مستقل داشته باشند، اما سهمیه‌ها به یک Worker یا `KV` مشترک منتقل نمی‌شوند؛ استقرارهای مستقل به مدیریت کلید/داده/دامنه و هماهنگی جداگانه نیاز دارند. بهینه‌سازی تعداد درخواست یا طرح پولی ساده‌تر است؛ قوانین Cloudflare را رعایت کنید.

### اسکن رنج رسمی و معنای کد کشور

رنج‌های IPv4/IPv6 از [API عمومی رسمی Cloudflare](https://api.cloudflare.com/client/v4/ips) از طریق خود Worker دریافت می‌شوند. تعداد آدرس هر CIDR و امکان انتخاب **۰ تا ۱۲ نمونه برای هر رنج** (مجموع حداکثر **۴۸**) در تب شبکه نمایش دارد. GeoIP با استعلام IP از سرویس شخص ثالث `ipwho.is` کد کشورِ **تقریبی** می‌دهد؛ این کد مکان قطعی Edge در شبکهٔ Anycast نیست. برچسب `#US|Scan` هنگام ذخیره فقط نام نود اشتراک را به‌شکل `🇺🇸 US · IP` نمایش می‌دهد. IP خام در مرورگر به‌دلیل TLS/SNI قابل تأیید قطعی برای دامنهٔ Worker نیست؛ فقط نامزد را در کلاینت واقعی آزمایش و بعد منتشر کنید. نتیجهٔ مشاور شبکهٔ مدیر را نباید به همهٔ مشترکان تعمیم داد.

### محدودیت روش‌های SNI و MITM

[SNI-Spoofing](https://github.com/patterniha/SNI-Spoofing) و [MITM-DomainFronting](https://github.com/patterniha/MITM-DomainFronting) به دست‌کاری محلی اتصال یا نصب CA مورد اعتماد کاربر متکی‌اند؛ تنظیم قابل‌اعمال روی یک Worker نیستند. ناهماهنگی Host/SNI در لبهٔ Cloudflare ممکن است با HTTP 421 رد شود؛ بنابراین این روش‌ها در پنل به‌عنوان قابلیت ادعایی اضافه نشده‌اند. خروجی `?format=xray` همچنان **JSON** است و Normal فقط تنظیمات قابل‌انتقال در URI استاندارد را حمل می‌کند.

### بروزرسانی با یک کلیک از مخزن رسمی (فقط Workers)

1. پیش از بروزرسانی، برای اطمینان از داده‌های مشترکین از تنظیمات پنل **نسخهٔ پشتیبان** بگیرید. ابتدا توکن دارای `Workers Scripts: Edit` را مطابق راهنمای بالا ثبت کنید.
2. در پیشخوان روی **بروزرسانی** بزنید. **بررسی نسخهٔ جدید** انتشارهای مخزن `https://github.com/youdidking/NightLine` و سپس در صورت لزوم `main/package.json` را می‌خواند. در صورت عدم انتشار نسخه یا فایل اجرایی در مخزن، بروزرسانی درون پنل انجام نمی‌شود.
3. نام **ورکر مقصد** را تأیید و **بروزرسانی مستقیم پنل** را بزنید. پنل `worker-single-file.js` رسمی را دریافت می‌کند و قبل از جایگزینی کد، اتصال‌های موجود `KV`، متغیرها، اسرار و تنظیمات سازگاری ورکر را از Cloudflare می‌خواند و در درخواست بارگذاری مجدد به‌همراه کد جدید حفظ می‌کند. پس از پایان، صفحه را تازه‌سازی کنید. امکان بروزرسانی مستقیم Pages از این مسیر وجود ندارد؛ از `nightline-pages.zip` جدید استفاده کنید.

---

## آموزش نصب گام‌به‌گام (بدون نیاز به سرور یا دانش برنامه‌نویسی)

شما می‌توانید **NIGHTLINE** را به یکی از ۳ روش زیر در کمتر از ۳ دقیقه راه‌اندازی کنید. ساده‌ترین و پیشنهادی‌ترین روش، **روش اول (از طریق داشبورد کلادفلر)** است.

---

### روش اول (پیشنهادی): نصب روی Cloudflare Workers از طریق مرورگر

#### گام ۱ — ساخت فضای ذخیره‌سازی `KV`
1. وارد حساب کاربری خود در [داشبورد کلادفلر](https://dash.cloudflare.com) شوید.
2. از منوی سمت چپ وارد بخش **Storage & Databases** و سپس **KV** شوید.
3. روی دکمهٔ **Create a namespace** کلیک کنید، یک نام دلخواه (مثلاً `nightline-kv`) وارد کنید و روی **Add** بزنید.

#### گام ۲ — ساخت ورکر و قرار دادن کد
1. از منوی سمت چپ وارد **Compute (Workers) → Workers & Pages** شوید و روی **Create** کلیک کنید.
2. حتماً گزینهٔ **Start with Hello World!** را انتخاب کنید (از گزینهٔ Import a repository استفاده نکنید).
3. یک نام دلخواه برای ورکر انتخاب کرده و روی **Deploy** کلیک کنید.
4. پس از ساخته شدن ورکر، روی دکمهٔ **Edit code** در بالای صفحه کلیک کنید.
5. تمام محتویات پیش‌فرض فایل `worker.js` موجود در ادیتور کلادفلر را پاک کنید، محتویات فایل آمادهٔ **`worker-single-file.js`** موجود در همین مخزن را کامل کپی کرده و در ادیتور جای‌گذاری (`Paste`) کنید.
6. روی دکمهٔ **Deploy** در گوشهٔ بالا سمت راست کلیک کنید.

#### گام ۳ — اتصال `KV` و بررسی تاریخ سازگاری (`Compatibility Date`)
1. به صفحهٔ اصلی ورکر برگردید و وارد تب **Settings** شوید.
2. در بخش **Bindings** روی **Add** کلیک کنید و گزینهٔ **KV Namespace** را انتخاب نمایید:
   - در کادر **Variable name** دقیقاً عبارت زیر را با حروف بزرگ بنویسید:
     ```text
     KV
     ```
   - در کادر **KV namespace** فضایی که در گام ۱ ساختید (`nightline-kv`) را انتخاب کرده و **Deploy / Save** را بزنید.
3. در همان تب **Settings**، بخش **Compatibility Date** را بررسی کنید که روی تاریخ جدید (`2024-09-23` یا جدیدتر، مثلاً `2026-04-01`) قرار داشته باشد.

#### گام ۴ — ورود اولیه و تنظیم رمز مدیریت
1. آدرس ورکر خود (یا دامنهٔ شخصی متصل‌شده) را در مرورگر باز کنید.
2. صفحهٔ **راه‌اندازی نخستین شماره** نمایش داده می‌شود؛ یک رمز عبور مدیریتی (حداقل ۶ کاراکتر) انتخاب کنید و روی **افتتاح تحریریه و ورود به پنل** بزنید.
3. پنل شما آمادهٔ استفاده است! لینک‌های اشتراک، QR کدها، مشاور هوشمند شبکه، سرور DoH و پروکسی رسمی تلگرام بلافاصله در دسترس هستند.

---

### روش دوم: نصب روی Cloudflare Pages (آپلود فایل فشرده)

1. در داشبورد کلادفلر یک فضای `KV` بسازید (مانند گام ۱ بالا).
2. وارد **Workers & Pages → Create → تب Pages → Upload assets** شوید.
3. یک نام برای پروژه انتخاب کنید و فایل آمادهٔ **`nightline-pages.zip`** موجود در مخزن را مستقیماً آپلود و **Deploy** کنید.
4. وارد **Settings → Functions** پروژهٔ Pages شوید:
   - در بخش **Compatibility date** تاریخ `2026-04-01` (یا جدیدتر از `2024-09-23`) را ثبت کنید.
   - در بخش **KV namespace bindings** یک اتصال با نام متغیر `KV` به فضای KV ساخته‌شده اضافه کنید.
5. یک بار دیگر فایل `nightline-pages.zip` را از تب **Deployments → Create new deployment** بارگذاری کنید تا تنظیمات KV اعمال شود.

---

### اتصال دامنهٔ شخصی (Custom Domain — بسیار پیشنهادی)

از آنجا که دامنهٔ پیش‌فرض `*.workers.dev` روی برخی اپراتورها فیلتر است و کلادفلر روی آن فقط پورت‌های `443` و `80` را باز می‌گذارد، اتصال یک دامنه یا ساب‌دامنهٔ شخصی مزایای زیر را فعال می‌کند:
- باز شدن کامل پنل، اشتراک‌ها و **پروکسی رسمی تلگرام (`tg://webproxy`)** بدون نیاز به هیچ فیلترشکنی.
- فعال شدن تمامی **۶ پورت TLS** (`443, 8443, 2053, 2083, 2087, 2096`) و **۷ پورت HTTP** کلادفلر.

---

### روش سوم: بیلد از سورس و استقرار با Wrangler CLI (مخصوص توسعه‌دهندگان)

پیش‌نیاز: نصب بودن **Node.js 20+**.

```bash
git clone https://github.com/youdidking/NightLine.git
cd nightline
npm install
npm run build
npm run dev
```

---

## راهنمای اتصال در کلاینت‌ها

| برنامه / پلتفرم | لینک پیشنهادی برای کپی از پنل | توضیح |
| :--- | :--- | :--- |
| **برنامه‌های سازگار با Xray JSON** (Fragment) | دکمهٔ **اشتراک Fragment (Xray)** | خروجی، فایل کانفیگ JSON است؛ در کلاینتی که واردکردن کانفیگ کامل را می‌پذیرد استفاده کنید. URI معمول Fragment واقعی را منتقل نمی‌کند. |
| **v2rayNG / MahsaNG / v2rayN** (لینک‌های استاندارد) | دکمهٔ **اشتراک عمومی (Base64 / Normal)** | لینک را به گروه اشتراک استاندارد برنامه بدهید؛ تنظیمات سازگار با URI پس از ذخیره اعمال می‌شوند. |
| **Hiddify / Sing-box** (اندروید، ویندوز، iOS، مک) | دکمهٔ **اشتراک Sing-box / Hiddify** | شامل پروفایل کامل مسیریابی ایران و انتخاب خودکار سریع‌ترین نود. |
| **Clash Meta / Mihomo / FlClash** | دکمهٔ **اشتراک Clash / Mihomo** | فایل YAML کامل با گروه `Auto Best` و قوانین مسیریابی. |
| **Streisand / V2Box / Shadowrocket / کلاینت‌های عمومی** | دکمهٔ **اشتراک عمومی (Base64)** | سازگار با تمامی برنامه‌های استاندارد VLESS و Trojan. |
| **Telegram Desktop & Telegram Android** | دکمهٔ **اتصال یک‌ضرب در تلگرام** | پروکسی رسمی تلگرام (`tg://webproxy`) بدون نیاز به اجرای VPN. |
| **مرورگرهای Chrome / Brave / Edge / Firefox** | دکمهٔ **سرور DoH اختصاصی** | قرار دادن در بخش *Secure DNS / DNS over HTTPS* مرورگر برای رفع تحریم و مسمومیت DNS. |

---

## Quick Start (English)

**NIGHTLINE v2.5.2** is a 100% free, non-commercial, open-source serverless panel for **Cloudflare Workers & Pages**, combining **VLESS + Trojan over WebSocket**, **Xray & Sing-box TLS Fragmentation**, **Official Telegram Web Proxy (`tg://webproxy`)**, **Conservative Browser ISP Advisor with bounded Worker upload/download probes**, **Visitor IP/Country/ISP Detection with Privacy Blur**, **Dynamic Monochrome Telemetry & Quota Charts**, and **RFC 8484 Private DoH**.

1. **Create a KV Namespace** in your Cloudflare Dashboard (`Storage & Databases → KV`) named `nightline-kv`.
2. **Create a Worker** (`Workers & Pages → Create → Start with Hello World! → Deploy → Edit code`), replace the editor contents with **`worker-single-file.js`**, and click **Deploy**.
3. **Bind KV:** Open Worker `Settings → Bindings → Add → KV Namespace`, set Variable name to **`KV`**, select `nightline-kv`, and save.
4. **Initialize:** Visit your Worker URL (or attached Custom Domain) in your browser to set your admin password and generate multi-client subscriptions & Telegram Web Proxy links immediately.
5. **Optional daily request counter:** Open **CF Daily** in the dashboard and create a scoped Cloudflare API Token with `Account Analytics: Read` and `Account Settings: Read`. Add `Workers Scripts: Edit` **only** if you want in-panel Worker updates. Verify and save the token in the panel. The default `100,000` is an editable **display threshold, not an assertion of your account's official Cloudflare plan limit**; the counter measures the account's UTC-day Worker requests.
6. **Optional Worker updater:** Open **Update**, check [`youdidking/NightLine`](https://github.com/youdidking/NightLine), confirm your target Worker name, and apply. The deployment preserves existing bindings and compatibility settings; make a backup first. **Pages users** should redeploy the new `nightline-pages.zip` instead. A published Worker bundle is required for this action.

Developers: run `npm ci && npm run build && npm test` (install Playwright Chromium and OS dependencies first when needed). The `15/15` E2E suites use local mock Cloudflare/GitHub APIs and a captured official CIDR fixture for token, quota, and updater flows; they do not make changes to a production Cloudflare account.

---

## مجوز انتشار (License)

این پروژه به‌صورت **متن‌باز و کاملاً رایگان** برای استفادهٔ شخصی و آموزشی منتشر شده است. استفادهٔ تجاری و خرید و فروش اشتراک یا سورس این پروژه مجاز نیست. به فایل [LICENSE](LICENSE) مراجعه کنید.
