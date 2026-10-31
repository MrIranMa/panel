<div align="center">

# NIGHTLINE · V2.4.0

**پنل آزاد، رایگان و متن‌باز مدیریت اشتراک VLESS، Trojan و پروکسی رسمی تلگرام روی شبکهٔ ابری کلادفلر**  
*Free & Open-Source Serverless VLESS, Trojan, Fragment, Smart ISP Advisor, Live Monochrome Telemetry, Private DoH & Official Telegram Web Proxy Panel on Cloudflare Workers & Pages*

[![Version](https://img.shields.io/badge/Version-2.4.0-111111?style=flat-square)](#)
[![Runtime](https://img.shields.io/badge/Cloudflare-Workers%20%26%20Pages-111111?style=flat-square)](#)
[![License](https://img.shields.io/badge/Free%20%26%20Open--Source-Not%20For%20Sale-14532d?style=flat-square)](#اطلاعیه-مهم-رایگان-و-غیرقابل-فروش)

</div>

---

> ### اطلاعیهٔ مهم (رایگان و غیرقابل فروش)
> پروژهٔ **NIGHTLINE** یک نرم‌افزار **کاملاً رایگان، آزاد و متن‌باز (Open-Source)** است. هرگونه خرید و فروش سورس، پنل یا لینک‌های اشتراک ساخته‌شده با این ابزار اکیداً ممنوع است.  
> **NIGHTLINE is 100% Free & Open-Source — Strictly Not For Sale.**

---

## پیش‌نمایش محیط پنل (Screenshots — V2.4.0)

### ۱. پیشخوان مدیریت — تم روزنامهٔ روشن (فارسی) با نوار شناسایی IP/اپراتور و نوسان‌نگار تک‌رنگ سرعت
![NIGHTLINE Dashboard Light FA](docs/screenshots/01-dashboard-light-fa.png)

### ۲. پیشخوان مدیریت — تم تاریک (انگلیسی) با مخفی‌سازی IP (`BLUR`) و نمودار هاشورخوردهٔ مصرف مشترکین
![NIGHTLINE Dashboard Dark EN](docs/screenshots/02-dashboard-dark-en.png)

### ۳. مشاور هوشمند اینترنت مرورگر (`Smart ISP Advisor`) و اعمال خودکار تنظیمات اپراتور
![NIGHTLINE Smart ISP Advisor](docs/screenshots/07-smart-isp-advisor.png)

### ۴. تنظیمات شبکه، پورت‌ها، اسکنر زندهٔ IP تمیز در مرورگر و پروکسی رسمی تلگرام
![NIGHTLINE Network Scanner & Telegram Web Proxy](docs/screenshots/03-network-scanner-tgproxy.png)

### ۵. صفحهٔ اختصاصی هر مشترک (`/sub/<token>`) و راهنمای سرور DoH اختصاصی (`/dns-query/<token>`)
![NIGHTLINE Subscriber Press Pass](docs/screenshots/04-subscriber-press-pass.png)

![NIGHTLINE Private DoH Guide](docs/screenshots/05-private-doh-guide.png)

---

## امکانات جدید و کلیدی نسخهٔ `V2.4.0`

- **مشاور هوشمند اینترنت مرورگر و تنظیم خودکار (`Smart Browser ISP Advisor`):** بررسی زندهٔ وضعیت دسترسی مستقیم مرورگر شما به گوگل، سرویس‌های هوش مصنوعی (`ChatGPT`, `Claude`, `Gemini`)، گیت‌هاب، شبکه‌های اجتماعی (`YouTube`, `Telegram`, `X`)، سرورهای `DoH` و پورت‌های جایگزین کلادفلر؛ تشخیص نوع محدودیت اپراتور و اعمال خودکار بهینه‌ترین تنظیمات Fragment، پورت و مسیریابی با یک کلیک.
- **تشخیص خودکار IP، کشور و اپراتور بازدیدکننده + کلید مخفی‌سازی (`BLUR`):** نمایش فوری آدرس IP، کشور/شهر، اپراتور اینترنت (همراه اول، ایرانسل، مخابرات، شاتل، آسیاتک، رایتل و...) و دیتاسنتر کلادفلر به محض ورود به پنل همراه با دکمهٔ محوسازی آنی IP (`BLUR / SHOW`).
- **تلگراف و نمودار زندهٔ تک‌رنگ (`Monochrome Live Speed, RTT & Quota Chart`):** نوسان‌نگار ۶۰ فریم‌برثانیهٔ سرعت انتقال لبه (`Mbps`)، پینگ و جیتر (`ms`) + تست سرعت لحظه‌ای (`Burst Speed Test`) و نمودار ستونی هاشورخوردهٔ مصرف مشترکین، کاملاً وفادار به پالت تک‌رنگ روزنامه در هر دو تم روشن و تاریک.
- **سیستم آیکون‌های برداری اختصاصی و فیزیک دکمه‌های سایه‌ثابت:** حذف کامل ایموجی‌ها و جایگزینی با آیکون‌های برداری تک‌رنگ (`SVG Sprite`) و انیمیشن نرم دکمه‌ها با سایهٔ کاملاً ثابت روی کاغذ هنگام کلیک.
- **دو پروتکل همزمان بدون نیاز به سرور مجازی:** پشتیبانی همزمان از **VLESS** و **Trojan** روی WebSocket با مصرف پردازندهٔ بهینه‌شده برای پلن رایگان کلادفلر (`Free Tier`).
- **پروکسی رسمی تلگرام (`Telegram Web Proxy`):** پیاده‌سازی کامل پروتکل رسمی `tg://webproxy` (مبتنی بر MTProto سرتاسری) برای اتصال یک‌ضرب در **Telegram Desktop** و **Telegram Android** بدون نیاز به روشن کردن فیلترشکن.
- **مدیریت چندکاربره با فضای `KV`:** تعریف تا ۲۰۰ مشترک مجزا با سقف حجم مصرفی (`GB`)، تاریخ انقضا، شمارش اعتبار از **اولین اتصال واقعی (`Start on First Connect`)**، توقف موقت، ریست ترافیک و تعویض یک‌کلیکی کلیدها.
- **خروجی هوشمند چندکلاینته با یک لینک واحد:** تشخیص خودکار برنامه و تولید کانفیگ استاندارد برای **v2rayNG**، **MahsaNG**، **v2rayN**، **Hiddify**، **Sing-box**، **Clash Meta / Mihomo**، **Streisand** و **Shadowrocket**.
- **رفع کامل محدودیت سایت‌های پشت کلادفلر (مانند `speedtest.net`) و سرور `Private DoH`:** مجهز به بافر بازپخش چندفریمی (`Multi-Frame Replay`)، لیست `ProxyIP` و `NAT64` و سرور اختصاصی `/dns-query/<token>` سازگار با `RFC 8484` و `JSON DNS`.

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
git clone https://github.com/YOUR_USERNAME/nightline.git
cd nightline
npm install
npm run build
npm run dev
```

---

## راهنمای اتصال در کلاینت‌ها

| برنامه / پلتفرم | لینک پیشنهادی برای کپی از پنل | توضیح |
| :--- | :--- | :--- |
| **v2rayNG / MahsaNG / v2rayN** (با ضد فیلتر Fragment) | دکمهٔ **اشتراک Fragment (Xray)** | لینک را در بخش *Subscription Group* برنامه اضافه و آپدیت کنید. |
| **Hiddify / Sing-box** (اندروید، ویندوز، iOS، مک) | دکمهٔ **اشتراک Sing-box / Hiddify** | شامل پروفایل کامل مسیریابی ایران و انتخاب خودکار سریع‌ترین نود. |
| **Clash Meta / Mihomo / FlClash** | دکمهٔ **اشتراک Clash / Mihomo** | فایل YAML کامل با گروه `Auto Best` و قوانین مسیریابی. |
| **Streisand / V2Box / Shadowrocket / کلاینت‌های عمومی** | دکمهٔ **اشتراک عمومی (Base64)** | سازگار با تمامی برنامه‌های استاندارد VLESS و Trojan. |
| **Telegram Desktop & Telegram Android** | دکمهٔ **اتصال یک‌ضرب در تلگرام** | پروکسی رسمی تلگرام (`tg://webproxy`) بدون نیاز به اجرای VPN. |
| **مرورگرهای Chrome / Brave / Edge / Firefox** | دکمهٔ **سرور DoH اختصاصی** | قرار دادن در بخش *Secure DNS / DNS over HTTPS* مرورگر برای رفع تحریم و مسمومیت DNS. |

---

## Quick Start (English)

**NIGHTLINE v2.4.0** is a 100% free, non-commercial, open-source serverless panel for **Cloudflare Workers & Pages**, combining **VLESS + Trojan over WebSocket**, **Xray & Sing-box TLS Fragmentation**, **Official Telegram Web Proxy (`tg://webproxy`)**, **Smart Browser ISP Advisor & 1-Click Auto-Tuner**, **Visitor IP/Country/ISP Detection with Privacy Blur**, **Dynamic Monochrome Telemetry & Quota Charts**, and **RFC 8484 Private DoH**.

1. **Create a KV Namespace** in your Cloudflare Dashboard (`Storage & Databases → KV`) named `nightline-kv`.
2. **Create a Worker** (`Workers & Pages → Create → Start with Hello World! → Deploy → Edit code`), replace the editor contents with **`worker-single-file.js`**, and click **Deploy**.
3. **Bind KV:** Open Worker `Settings → Bindings → Add → KV Namespace`, set Variable name to **`KV`**, select `nightline-kv`, and save.
4. **Initialize:** Visit your Worker URL (or attached Custom Domain) in your browser to set your admin password and generate multi-client subscriptions & Telegram Web Proxy links immediately.

---

## مجوز انتشار (License)

این پروژه به‌صورت **متن‌باز و کاملاً رایگان** برای استفادهٔ شخصی و آموزشی منتشر شده است. استفادهٔ تجاری و خرید و فروش اشتراک یا سورس این پروژه مجاز نیست. به فایل [LICENSE](LICENSE) مراجعه کنید.
