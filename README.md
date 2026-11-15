# Order Notes

Một web app đơn giản để quản lý món hàng và ghi note bán hàng, có thể deploy miễn phí lên GitHub Pages và lưu dữ liệu vào Google Sheets.

## Tính năng

- Màn hình 1: tạo món hàng
  - Tên món
  - Giá bán
  - Giá cost
  - Chỉnh sửa món hàng
- Màn hình 2: ghi note bán hàng
  - Chọn nhiều món trong 1 đơn hàng
  - Số lượng
  - Thời gian lấy (tuỳ chọn)
  - Phí ship mặc định 0, được cộng vào số tiền khách thanh toán nhưng không tính vào doanh thu/lợi nhuận
  - Tên người lấy (Zalo/Facebook)
  - Gợi ý khách cũ khi nhập tên; có thể nhập tên mới nếu chưa có
  - Ghi chú đơn hàng
  - Tìm theo tên khách hàng
  - Hiển thị thời gian lấy hàng trên note và lọc theo cùng ngày lấy (`pickupTime`); ngày tạo note chỉ dùng để xếp note mới tạo lên trước
  - Đánh dấu đã/chưa chuyển khoản, lọc, chỉnh sửa, xóa note (có xác nhận), phân trang phía máy chủ (chỉ tải 10 note mỗi lần) và xem/tải bill kèm mã QR
- Màn hình 3: thống kê
  - Theo ngày / tháng / năm
  - Doanh thu
  - Lợi nhuận
  - Chi phí
  - Số đơn hàng
  - Biểu đồ doanh thu theo món và khách hàng
- Hiển thị vòng xoay khi tải hoặc lưu dữ liệu

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

### Khắc phục lỗi kết nối

- Đảm bảo web app được deploy với quyền truy cập **Anyone** và `scriptUrl` là URL `/exec`.
- Frontend gửi JSON với `Content-Type: text/plain` để tránh yêu cầu CORS preflight; Apps Script vẫn đọc nội dung JSON như bình thường.
- Nếu vừa cập nhật Apps Script, hãy tạo deployment version mới rồi kiểm tra lại.
- Phân trang note và thống kê phía Google Sheets cần triển khai phiên bản Apps Script mới nhất trong `google-apps-script.gs`.
- Các cột `notes` và `shippingFee` sẽ được Apps Script tự thêm vào sheet `orders` khi tải danh sách hoặc lưu note.
- Nếu kết nối thất bại, ứng dụng sẽ chuyển sang `localStorage` trên thiết bị hiện tại; dữ liệu đó không tự đồng bộ lên Google Sheets.

## Lưu ý

- Nếu không cấu hình `scriptUrl`, ứng dụng sẽ chạy ở chế độ demo bằng `localStorage` trong browser.
- Đối với production thực tế, nên dùng tài khoản Google có quyền quản lý sheet và deploy web app trên Google Apps Script.

## Có thể cải tiến sau

- Import/export dữ liệu Excel
- Tạo tài khoản quản trị
- Tạo báo cáo PDF 
