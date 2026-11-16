# تغییرات نسخه 5.0

- رفع خطای تایمر بروزرسانی تابلو و تضمین زمان‌بندی دوباره پس از خطا.
- اجرای موازی دریافت تنظیمات و داده بازار؛ قطع خبرخوان دیگر دریافت قیمت را متوقف نمی‌کند.
- مهلت زمانی کوتاه‌تر برای منابع بازار و نمایش وضعیت‌های روشن اتصال.
- حفظ آخرین نرخ معتبر هنگام خطای منبع و جلوگیری از تفسیر null/خالی به‌عنوان صفر.
- جلوگیری از درخواست‌های تکراری هم‌زمان سمت سرور.
- مقاوم‌سازی رندر تاریخچه نمودار و نمایش بهتر timestampهای ثانیه‌ای/میلی‌ثانیه‌ای.
- افزودن صفحه اختصاصی ویجت رسمی TGJU با iframe مستقل و فهرست انواع widget رسمی.
- اعتبارسنجی شناسه‌های عددی، تعداد ردیف‌ها و ویژگی‌های کد TGJU؛ حذف event attributeهای دلخواه و ثابت نگه‌داشتن URL اسکریپت رسمی.
- به‌روزرسانی تنظیمات برند صفحه TGJU بدون نیاز به رفرش دستی کل صفحه.
- افزودن `npm run check` برای تست آفلاین کدها، مسیرهای سرور، پارسر TGJU و فایل لوگو.


## v6.0
- Replaced all price providers with TGJU live feed (`call1.tgju.org/ajax.json`) plus fallback host.
- Removed Talasanj, Arzhaam and Yahoo Finance API requirements for market prices.
- Moved upstream polling to background; `/api/dashboard-data` now returns local cached snapshot immediately.
- Fixed LAN accessibility by defaulting the server bind address to `0.0.0.0`.
- Added local cached 18K chart samples and clearer connecting/partial/stale/offline states.
- Added live status / manual refresh in the board configuration panel.


## v6.1 — اصلاح اتصال تابلو و دقت نمادهای TGJU

- اصلاح نمونه `.env` تا سرور روی `0.0.0.0` در دسترس تلویزیون‌های شبکه محلی باشد.
- کوتاه‌شدن زمان انتظار هر میزبان TGJU و امتحان هم‌زمان دو میزبان اول با fallback به دو میزبان دیگر.
- تلاش مجدد پس از خطای TGJU هر ۸ ثانیه، بدون گیرکردن روی وضعیت اتصال محلی.
- تأیید و اصلاح شناسه نقره ۹۹۹ و نفت برنت و افزودن aliasهای نماد سکه.
- اصلاح متن وضعیت تابلو و متن پیش‌فرض نمودار.
- اضافه‌شدن آزمون یکپارچه با فید شبیه‌سازی‌شده برای سنجش تبدیل ریال به تومان و نرخ‌های همه دارایی‌ها.


## v6.2.0 — Board startup compatibility hotfix
- Fixed a likely early JavaScript startup failure on older smart-TV browsers that do not support `structuredClone`.
- Added a safe JSON clone fallback for the board runtime.
- Added a startup watchdog and explicit script-load/runtime error messages instead of leaving the HTML placeholder visible forever.
- Guarded canvas rendering so a drawing/locale issue cannot stop the polling loop from initializing.
- Removed newer browser dependencies from the board refresh path where practical (`Promise.allSettled`, `AbortSignal.timeout`, `Array.prototype.at`).
- Added safe date formatting fallback for browsers with incomplete Persian-calendar Intl support.


## v6.3.0 — Canvas rounded-corner fix
- Fixed the board rounded-rectangle path where one `arcTo` call omitted its fifth radius argument.
- Replaced `arcTo` in both the TV board and story renderer with `quadraticCurveTo` paths.
- Added regression checks that fail if `arcTo` is reintroduced and verify that the board draws rounded corners.


## 6.4.0 – Board-only refinement

- Preserved original board layout and styling; did not alter Story output.
- Responsive/HiDPI canvas rendering with centered 16:9 stage.
- Tehran clock moved into its own bordered card, separate from market status.
- Board footer now uses `boardConfig.footerLines`, isolated from Story footer settings.
- Default ticker reads BBC Persian and DW Persian RSS feeds; English-only headlines are filtered.
- News ticker now animates smoothly via requestAnimationFrame.

## v7.0.0
- Added a categorized TGJU asset catalogue spanning gold, coins, silver grades, precious/base metals, currencies, crypto, energy, commodities, forex, indices, equities, funds and bonds.
- Added arbitrary TGJU feed-symbol support through `row.symbol`, including a custom symbol input and configurable unit/divisor.
- The server now exposes every valid symbol from the latest TGJU JSON feed through `snapshot.assets` and `/api/assets`.
- Added per-asset pictogram icons for both the Board and Story; crypto and currency icons include distinct glyphs where known.
- Added deployment templates for Docker, Render and Railway, persistent data directory support, and optional HTTP Basic authentication for the admin UI and write APIs.
- Added `/api/public-config` for the public Board so the Board can run without exposing the admin settings endpoint.
- Extended smoke tests for custom assets, icon mapping, deployment files and admin authentication.
