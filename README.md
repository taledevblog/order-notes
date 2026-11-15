# Order Notes

Một web app đơn giản để quản lý món hàng và ghi note bán hàng, có thể deploy miễn phí lên GitHub Pages và lưu dữ liệu vào Google Sheets.

## Tính năng

- Màn hình 1: tạo món hàng
  - Tên món
  - Giá bán
  - Giá cost
- Màn hình 2: ghi note bán hàng
  - Chọn nhiều món trong 1 đơn hàng
  - Số lượng
  - Thời gian lấy (tuỳ chọn)
  - Tên người lấy (Zalo/Facebook)
- Màn hình 3: thống kê
  - Theo ngày / tháng / năm
  - Doanh thu
  - Lợi nhuận
  - Chi phí
  - Số đơn hàng

## Cấu trúc dự án

- `index.html`: giao diện chính
- `styles.css`: giao diện và layout
- `app.js`: logic xử lý dữ liệu và thống kê
- `config.js`: cấu hình Google Sheets / local demo
- `google-apps-script.gs`: backend mẫu để lưu dữ liệu vào Google Sheets

## Chạy local

Từ thư mục dự án, chạy:

```bash
python -m http.server 8000
```

Mở trình duyệt: http://localhost:8000

## Triển khai lên GitHub Pages

1. Push project lên GitHub.
2. Vào GitHub repository -> Settings -> Pages.
3. Chọn Source: Deploy from a branch.
4. Chọn branch `main` hoặc `master`, thư mục root.
5. Lưu cài đặt.
6. GitHub Pages sẽ cung cấp URL như: `https://your-name.github.io/repository-name/`

## Lưu dữ liệu vào Google Sheets

### Bước 1: tạo Sheet

Tạo một file Google Sheet mới, đặt tên:

- `items`
- `orders`

### Bước 2: copy mã Apps Script

Mở Google Apps Script tại: https://script.google.com

Tạo project mới, paste nội dung trong file `google-apps-script.gs` vào file `Code.gs`.

### Bước 3: deploy web app

- Trong Apps Script, chọn Deploy -> New deployment
- Chọn type: Web app
- Who has access: Anyone
- Deploy
- Copy URL web app được sinh ra

### Bước 4: cấu hình frontend

Mở `config.js`, thay:

```js
window.ORDER_NOTES_CONFIG = {
  appName: 'Order Notes',
  useGoogleSheets: true,
  scriptUrl: 'PASTE_YOUR_GOOGLE_APPS_SCRIPT_URL_HERE',
  itemSheet: 'items',
  orderSheet: 'orders'
};
```

### Bước 5: test

- Mở GitHub Pages URL
- Tạo món hàng và note bán hàng
- Kiểm tra Google Sheet để xem dữ liệu được lưu đúng

## Lưu ý

- Nếu không cấu hình `scriptUrl`, ứng dụng sẽ chạy ở chế độ demo bằng `localStorage` trong browser.
- Đối với production thực tế, nên dùng tài khoản Google có quyền quản lý sheet và deploy web app trên Google Apps Script.

## Có thể cải tiến sau

- Cho phép sửa/xóa đơn hàng
- Import/export dữ liệu Excel
- Dashboard biểu đồ doanh thu theo ngày/tháng
- Tạo tài khoản quản trị
- Tạo báo cáo PDF
