# Xếp thời khóa biểu

Web tĩnh giúp sinh viên chọn môn và tự xếp thời khóa biểu từ TKB dự kiến của trường (HK2 năm học 2026 – 2027, hệ đại học chính quy).

**Dùng ngay:** https://lil-godb369.github.io/Web_TKB/

## Tính năng

- **Tìm môn** theo tên hoặc mã môn; lọc theo ngành / khóa (lấy từ mã lớp, vd `16DHTH01` → ngành DHTH, khóa 16).
- **Thêm môn ngành:** thêm một lần mọi môn mở cho ngành / khóa đang chọn.
- **Tự xếp** lớp học phần không trùng giờ, theo hai cách:
  - Ít ngày đến trường nhất
  - Dàn đều các ngày
  
  Có thể chọn ngày đi học, tránh buổi, giới hạn khung giờ; **ưu tiên** hoặc **tránh giáo viên** (bấm ⛔ để không xếp lớp của GV đó).
- **Lưới tuần:** xem từng tuần (mặc định tuần đầu có học) hoặc **Cả học kỳ**; ô trùng giờ tô đỏ, ô chồng giờ nhưng khác tuần ghi nhãn "khác tuần".
- **Chép mã LHP** để đăng ký, **In** thời khóa biểu.
- Lựa chọn được lưu trong trình duyệt (`localStorage`), tải lại trang không mất.

## Chạy ở máy

Không cần cài đặt hay build: mở thẳng `index.html` bằng trình duyệt.

## Cập nhật dữ liệu

Dữ liệu nằm ở `data/data.js`, tạo từ file TKB `.xls` của trường:

```bash
pip install xlrd
python tools/build_data.py "<đường dẫn file .xls>"
```

## Cấu trúc

| File | Nội dung |
|---|---|
| `index.html` | Giao diện |
| `app.js` | Tìm môn, tự xếp, vẽ lưới |
| `style.css` | Kiểu dáng |
| `data/data.js` | Dữ liệu lớp học phần (sinh tự động) |
| `tools/build_data.py` | Chuyển file `.xls` → `data/data.js` |
