window.ORDER_NOTES_CONFIG = {
  appName: 'Order Notes',
  useGoogleSheets: true,
  scriptUrl: 'https://script.google.com/macros/s/AKfycbzcyGMesFEgwrD9kKj1FfpgOSCbt2SuJUJN4Ho_5LjDsGV9ukEWY-3JH_HTy8cGxMO5Tg/exec',
  itemSheet: 'items',
  orderSheet: 'orders'
};

// Hướng dẫn:
// 1. Đưa code trong file google-apps-script.gs vào Google Apps Script.
// 2. Deploy as web app và paste URL này vào scriptUrl.
// 3. Nếu giữ useGoogleSheets = false, ứng dụng sẽ chạy ở chế độ lưu trữ cục bộ trên browser.
// 4. Khi chạy trên localhost, Google Apps Script thường bị chặn bởi CORS / OAuth; vì vậy mặc định nên để false.
