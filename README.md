# Bảng tổng hợp bài báo

Web app giúp sinh viên làm khoá luận lập bảng tổng quan tài liệu. Sinh viên tải bài báo PDF lên. AI đề xuất nội dung cho từng cột, mỗi ô kèm câu trích nguyên văn và số trang. Code thường (không dùng AI) kiểm tra câu trích có thật trong bài. Sinh viên duyệt từng ô rồi mới lưu vào bảng, và xuất được ra Excel.

## Cách chạy

### Cần có

- **Node.js 22.18 trở lên**, hoặc 23.6 trở lên (bỏ qua 23.0 đến 23.5). Yêu cầu này ghi ở mục `engines` của `package.json`. Xem phiên bản đang dùng bằng `node --version`.
- Khoá Gemini (gói miễn phí dùng được) và một dự án Supabase. Hướng dẫn cài Supabase ở `docs/cai-dat-supabase.md`.

### Các bước

1. Cài thư viện: `npm install`
2. Chép `.env.example` thành `.env.local` rồi điền giá trị thật. `.env.example` giải thích từng biến. Không đưa file có giá trị thật vào git.
3. Chạy trên máy: `npm run dev`, rồi mở http://localhost:3000

Muốn thử giao diện mà không gọi Gemini: đặt `AI_DUNG_KET_QUA_MAU=1` trong `.env.local`. Máy chủ sẽ trả câu trả lời đã lưu trong `samples/ket-qua-gemini.json`. Chế độ này chỉ chạy khi dùng `npm run dev`.

### Các lệnh khác

| Lệnh | Việc |
|---|---|
| `npm test` | Chạy test (vitest) |
| `npm run lint` | Kiểm tra code |
| `npm run build` | Dựng bản chạy thật |
| `npm run test:phan-quyen` | Thử quy tắc phân quyền trên Supabase thật |

## Bắt đầu

Người dùng mới bắt đầu từ bảng trống: tạo bảng (đặt tên, chọn cột), rồi tải bài báo PDF của mình lên. App không có bài mẫu hay bảng minh hoạ có sẵn; mỗi bài gửi cho AI tính 1 lượt trong ngày.

Kịch bản demo nằm ở `docs/kich-ban-demo.md`.

## Giới hạn cần biết

- App dùng đăng nhập ẩn danh: sinh viên không cần tạo tài khoản, nhưng dữ liệu gắn với trình duyệt đang dùng. Đổi máy hoặc xoá dữ liệu trình duyệt thì không thấy bảng cũ nữa, nên hãy xuất Excel để giữ bản sao.
- File PDF chỉ được giữ trong trình duyệt (IndexedDB), không bao giờ gửi lên máy chủ; máy chủ chỉ lưu bảng và chữ đã điền. Đổi máy, đổi trình duyệt hoặc xoá dữ liệu trình duyệt thì nút "Mở bài gốc" sẽ hiện "Tải lại file PDF để xem": chọn lại đúng file của bài (app kiểm tra dấu vân tay SHA-256, sai file thì báo) là xem lại được.
- Chưa đọc được file scan (PDF chỉ có ảnh).
- Mỗi người được gửi tối đa 15 bài cho AI mỗi ngày, cả app tối đa 150 bài mỗi ngày (số tạm).
