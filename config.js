window.ORDER_NOTES_CONFIG = {
  appName: 'Order Notes',
  useGoogleSheets: true,
  scriptUrl: 'https://script.google.com/macros/s/AKfycby_-yZUnB2E-tRh5wol7rn5rzHYcJ5NB-l1twqFhhWMZIvXNi7P7T93RtqEH37guQ_U/exec',
  itemSheet: 'items',
  orderSheet: 'orders'
};

// Hướng dẫn:
// 1. Đưa code trong file google-apps-script.gs vào Google Apps Script.
// 2. Deploy as web app và paste URL này vào scriptUrl.
// 3. Nếu giữ useGoogleSheets = false, ứng dụng sẽ chạy ở chế độ lưu trữ cục bộ trên browser.
// 4. Khi chạy trên localhost, Google Apps Script thường bị chặn bởi CORS / OAuth; vì vậy mặc định nên để false.
