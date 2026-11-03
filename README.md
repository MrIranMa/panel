<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  /* استایل نوار بالای صفحه */
  .top-navbar {
    display: flex;
    justify-content: space-between; /* فاصله دادن بین دو دکمه */
    align-items: center;
    background-color: #1e1e1e; /* رنگ پس‌زمینه تیره */
    padding: 10px 15px;
    font-family: Tahoma, Arial, sans-serif;
    direction: rtl; /* راست‌چین کردن کل نوار */
  }

  /* استایل عمومی دکمه‌ها */
  .nav-btn {
    display: flex;
    align-items: center;
    gap: 8px; /* فاصله بین آیکون و متن */
    background-color: #555555;
    color: #ffffff;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.2s;
  }

  .nav-btn:hover {
    background-color: #666666;
  }

  /* استایل اختصاصی دکمه بازگشت */
  .btn-back .icon {
    font-weight: bold;
    font-size: 16px;
    /* در حالت RTL فلش باید به سمت راست باشد */
  }

  /* استایل دکمه زبان و تیک آبی */
  .btn-lang {
    background-color: #444444;
    padding: 4px 8px;
  }

  .check-box {
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #0078D7; /* رنگ آبی */
    color: white;
    width: 20px;
    height: 20px;
    border-radius: 2px;
    font-size: 12px;
    font-weight: bold;
    margin-right: 4px;
  }
</style>
</head>
<body>

  <!-- نوار ابزار راست‌چین شده -->
  <div class="top-navbar">
    
    <!-- دکمه بازگشت (قرارگیری در سمت راست) -->
    <button class="nav-btn btn-back">
      <span class="icon">➡️</span> <!-- فلش به سمت راست اصلاح شد -->
      بازگشت
    </button>

    <!-- دکمه زبان (قرارگیری در سمت چپ) -->
    <button class="nav-btn btn-lang">
      زبان
      <span class="check-box">✓</span> <!-- تیک آبی مرتب شد -->
    </button>

  </div>

</body>
</html>
