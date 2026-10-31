# NIGHTLINE v2.5.0 — یادداشت انتشار

پنل رایگان و متن‌باز NIGHTLINE برای Cloudflare Workers و Pages، با نوار سهمیهٔ روزانه، راهنمای توکن و بروزرسانی مستقیم ورکر از [مخزن رسمی](https://github.com/youdidking/NightLine).

## تازه‌ها

- **سهمیهٔ درخواست روزانهٔ Cloudflare:** نوار فشردهٔ «CF Daily» در پیشخوان، نمودار مقدار مصرف و درصد نسبت به آستانهٔ تنظیم‌شده، وضعیت حساب و زمان بازنشانی UTC. داده‌ها از GraphQL کلادفلر برای **مجموع درخواست‌های ورکرهای حساب** در روز جاری خوانده می‌شوند. آستانهٔ پیش‌فرض `100,000` تنها معیار نمایشی قابل تغییر است، **نه اعلام سقف رسمی پلن کاربر**. به‌منظور کاهش API call، نتیجه تقریباً ۴۵ ثانیه cache می‌شود.
- **توکن و راهنمای دسترسی:** پنجرهٔ بررسی/ذخیره/حذف توکن و پاپ‌آپ کم‌حجم راهنمای ساخت Custom Token. `Account Analytics: Read` برای آمار؛ `Account Settings: Read` برای یافتن حساب؛ `Workers Scripts: Edit` فقط برای بروزرسانی ورکر. توکن در KV ذخیره می‌شود و مقدار کامل به رابط عمومی بازگردانده نمی‌شود. سطح دسترسی توکن را به حساب موردنیاز محدود کنید.
- **بروزرسانی رسمی در پنل:** بررسی نسخهٔ [youdidking/NightLine](https://github.com/youdidking/NightLine) از GitHub Releases / شاخهٔ `main`؛ دریافت `worker-single-file.js` رسمی و جایگزینی کد Worker با حفظ bindingهای KV، متغیرها، secretها و compatibility settings فعلی. نیازمند توکن و انتشار فایل اجرایی در مخزن است. **مختص Cloudflare Workers**؛ کاربران Pages باید `nightline-pages.zip` جدید را منتشر کنند. قبل از نصب از پنل پشتیبان بگیرید.
- **رفع اشکال مشترک جدید:** نوار و ستون مصرف `0 B` برابر `0%`؛ جلوگیری از شناسهٔ UUID تکراری؛ پاکسازی مصرفِ معلق هنگام ریست/تعویض کلید.
- **پرداخت نهایی رابط:** فاصلهٔ عمودی تب ۰۵ برابر تب ۰۱ (`14px`)، یک‌ردیفه شدن نوار وضعیت دسکتاپ در فارسی و انگلیسی، حذف توضیحات متای بلااستفاده و کلوفون فونت. نمادها برداری تک‌رنگ و بدون ایموجی هستند.

## آزمایش و تحویل

- `npm run build` → **۰ مورد از ۵۲ امضای ممنوع** در خروجی ساخته‌شده؛ Worker تک‌فایل حدود `474 KB`.
- `npm test` → **۱۵/۱۵ سناریوی E2E پاس شد**: API و KV، اشتراک و DoH، تونل VLESS زنده، پروکسی تلگرام، آیکون‌ها و رفتار دکمه، مشاور مرورگر، سهمیهٔ مشترک، توکن و GraphQL، و بروزرسانی با حفظ bindingها. مسیرهای Cloudflare API و GitHub در تست بروزرسانی با سرویس‌های mock بررسی شده‌اند؛ هیچ استقرار واقعی به حساب تولیدی انجام نشده است.
- `npm run shots` → ۷ اسکرین‌شات به‌روز در `docs/screenshots/`.
- خروجی‌های آمادهٔ انتشار: `worker-single-file.js` (نصب Workers)، `nightline-pages.zip` (نصب Pages)، `panel-preview.html` (پیش‌نمایش آفلاین)، و آرشیو سورس `nightline-v2.5.0-github.zip`.

## راه‌اندازی کوتاه

1. فایل `worker-single-file.js` را در Cloudflare Workers منتشر کنید؛ یک namespace با نام binding دقیق `KV` وصل کنید. برای Pages از `nightline-pages.zip` و همین binding استفاده کنید.
2. پنل را باز کنید، رمز مدیریت تعیین کنید و در صورت نیاز از پنجرهٔ «CF Daily» توکن کم‌دسترسی را اضافه کنید.
3. برای بروزرسانی Workers، از اطلاعات نسخهٔ پشتیبان بگیرید، دسترسی `Workers Scripts: Edit` را به توکن بدهید، نام Worker مقصد را بررسی و روی «بروزرسانی مستقیم پنل» کلیک کنید.

آموزش کامل فارسی و انگلیسی در [README.md](README.md) آمده است. **NIGHTLINE کاملاً رایگان و متن‌باز است و برای فروش نیست.**

---

**English summary:** v2.5.0 adds a scoped Cloudflare API-token guide, an account-wide UTC-day request meter against an editable display threshold, and an official GitHub-to-Workers self-updater that preserves existing bindings and compatibility settings. It fixes zero-usage quota bars, duplicate IDs, pending-usage cleanup, and dashboard spacing. All 15 E2E suites pass; Cloudflare and GitHub update flows are tested with mocks, not with a production deployment. For Pages, redeploy the new ZIP manually.
