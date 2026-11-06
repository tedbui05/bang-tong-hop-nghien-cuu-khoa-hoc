# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Tình trạng dự án

Dự án chưa có code. Khi đã tạo dự án, hãy bổ sung vào đây các lệnh thật (chạy, build, lint, test, chạy một test) và kiến trúc thật.

## Sản phẩm

Web app giúp sinh viên làm khóa luận khỏi phải tự chép thông tin từ bài báo vào Excel, việc vừa mất thời gian vừa dễ hiểu sai.

Luồng chính của bản đầu tiên:

1. Sinh viên tạo bảng với các cột tùy ý, hoặc dùng mẫu có sẵn: câu hỏi nghiên cứu, phương pháp, mẫu, kết quả, hạn chế.
2. Tải lên một bài báo PDF, ở ngôn ngữ nào cũng được.
3. AI điền nội dung từng cột bằng tiếng Việt, mỗi ô kèm câu trích nguyên văn và số trang.
4. App tự kiểm tra câu trích có thật trong bài; không có thì đánh dấu "cần kiểm tra".
5. Sinh viên bấm vào từng ô để xem đoạn gốc, rồi xác nhận hoặc sửa.
6. Bấm "Lưu vào bảng", và xuất được bảng ra Excel.

## Phạm vi

Bản này CHƯA làm những việc sau. Nếu thấy cần làm việc nào, phải hỏi người dùng trước:

- Đọc file scan
- Tải nhiều file một lúc
- Đồng bộ Google Sheets
- Gợi ý khoảng trống nghiên cứu
- Đăng nhập bằng tài khoản (đăng nhập ẩn danh thì có dùng, xem "Quyết định đã chốt")

## Quy tắc luôn phải đúng

- **AI chỉ đề xuất.** AI không được tự lưu vào bảng. Người dùng duyệt từng ô rồi mới lưu.
- **Kiểm tra câu trích bằng code thường.** Việc kiểm tra câu trích có thật trong bài không được nhờ AI.
- **Không đoán.** Bài không có thông tin thì ghi "không tìm thấy".
- **Giữ kín API key.** Không bao giờ để lộ key, kể cả trong code chạy trên trình duyệt, log hay thông báo lỗi. Không mở file `.env`.
- **Đủ trạng thái.** Màn hình nào cũng phải có trạng thái đang tải, báo lỗi và trống, viết bằng tiếng Việt dễ hiểu.
- **Ghi lại thao tác để đo hiệu quả:** lúc tải bài, ô được giữ nguyên, ô bị sửa, ô cần kiểm tra, lúc bấm "Lưu vào bảng".

## Quyết định đã chốt

- **Câu trích:** giữ nguyên ngôn ngữ gốc để code kiểm tra. Thêm bản dịch tiếng Việt chỉ để hiển thị; việc kiểm tra luôn dùng bản gốc.
- **Chuẩn hóa khi so sánh:** dùng NFKC cho cả câu trích và văn bản bài, để xử lý chữ dính như "fi" trong PDF.
- **Số trang:** code tìm câu trích trong từng trang và ở chỗ nối giữa cuối trang này với đầu trang sau. Câu vắt qua hai trang tính là trang bắt đầu của câu. Sau đó xử lý như sau:
  - Chỉ có ở trang AI ghi: đạt.
  - Chỉ có ở đúng một trang khác trang AI ghi: tự sửa theo trang code tìm thấy và hiện nhãn "đã sửa số trang".
  - Có ở nhiều trang: đánh dấu "cần kiểm tra".
  - Không có ở đâu: đánh dấu "cần kiểm tra".
- **Câu trích quá ngắn:** dưới 15 ký tự sau chuẩn hóa thì luôn đánh dấu "cần kiểm tra", dù tìm thấy ở đâu. Số 15 là con số tạm, sẽ chỉnh sau buổi thử thật.
- **Ô không có thông tin:** ghi "không tìm thấy", để trống câu trích và số trang, bỏ qua bước kiểm tra, không tính là "cần kiểm tra".
- **Kiểm tra bị lỗi giữa chừng:** đánh dấu "cần kiểm tra", không được coi là đạt.
- Chi tiết kỹ thuật của việc kiểm tra nằm trong skill `citation-check`.
- **Dữ liệu người dùng:** bản đầu dùng đăng nhập ẩn danh (anonymous sign-in) của Supabase, không tự tạo mã trong trình duyệt. Sinh viên không cần tạo tài khoản, nhưng mỗi trình duyệt có một danh tính thật. Quy tắc phân quyền (RLS) phải kiểm tra chủ sở hữu từng dòng theo `auth.uid()` để sinh viên không xem được bảng của nhau; chỉ kiểm tra vai trò `authenticated` là chưa đủ, vì người dùng ẩn danh cũng có vai trò này. Giao diện hiện dòng: "Dữ liệu được lưu trên trình duyệt này. Hãy xuất Excel để giữ bản sao."
- **Bật đăng nhập ẩn danh:** khi đến bước làm cơ sở dữ liệu, hướng dẫn người dùng bật tính năng này trong trang quản lý Supabase.
- **Quyền riêng tư:** màn hình tải bài hiện dòng: "Chỉ tải lên bài báo đã công bố. Không tải tài liệu mật hoặc chưa công bố."

## Ghi chú để đưa vào README sau này

- Giới hạn của đăng nhập ẩn danh: đổi máy hoặc xóa dữ liệu trình duyệt thì không thấy bảng cũ nữa, nên cần xuất Excel để giữ bản sao.

## Công nghệ dự kiến

- Next.js
- Gemini bản miễn phí, tên model đặt trong biến môi trường để dễ đổi, không ghi cứng trong code
- Supabase để lưu dữ liệu
- Xuất file Excel

## Cách làm việc với người dùng

Người dùng không rành kỹ thuật. Mỗi khi làm xong một phần, hãy giải thích ngắn gọn bằng tiếng Việt là đã làm gì.
