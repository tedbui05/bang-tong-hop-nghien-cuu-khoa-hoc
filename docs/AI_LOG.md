# Nhật ký làm việc với AI

## 2026-11-06 19:16 — Chốt 4 quyết định sản phẩm và chạy /doctor

- **Đã nhờ AI làm gì:** Góp ý 4 điểm còn bỏ ngỏ sau khi viết CLAUDE.md, rồi ghi các quyết định vào file. Sau đó chạy /doctor để kiểm tra Claude Code và CLAUDE.md.
- **AI đề xuất gì:**
  - Câu trích giữ nguyên ngôn ngữ gốc của bài báo.
  - Câu trích có thật nhưng khác trang AI ghi thì đánh dấu "cần kiểm tra".
  - Dùng mã ẩn danh cho mỗi trình duyệt, vì bản đầu chưa có đăng nhập.
  - Nhắc sinh viên không tải tài liệu mật hoặc chưa công bố.
  - /doctor kết luận CLAUDE.md đã gọn (64 dòng, khoảng 750 token ước tính), chưa cần rút gọn hay tách. /doctor cũng đề xuất đặt auto mode làm mặc định.
- **Chấp nhận hay sửa gì, vì sao:**
  - Câu trích: chấp nhận, và thêm bản dịch tiếng Việt chỉ để hiển thị cho sinh viên đọc; việc kiểm tra vẫn dùng bản gốc.
  - Số trang: sửa lại. Có ở đúng một trang khác thì tự sửa số trang và hiện nhãn "đã sửa số trang". Có ở nhiều trang thì "cần kiểm tra", vì không biết trang nào đúng. Không có ở đâu thì "cần kiểm tra" như cũ.
  - Mã ẩn danh: chấp nhận, và thêm dòng nhắc xuất Excel trên giao diện; giới hạn này được ghi lại để đưa vào README sau.
  - Quyền riêng tư: chấp nhận, và thêm dòng nhắc ở màn hình tải bài.
  - /doctor: giữ nguyên CLAUDE.md; không bật auto mode làm mặc định, không nêu lý do.
- **AI đã sai ở đâu:** Đề xuất về số trang gộp mọi trường hợp lệch trang vào "cần kiểm tra", chưa tách trường hợp có ở đúng một trang khác (code tự xác định được) với trường hợp có ở nhiều trang. Người dùng đã bổ sung phần này.

## 2026-11-06 19:21 — Tạo tiện ích làm việc trong thư mục .claude

- **Đã nhờ AI làm gì:** Tạo lệnh `/ailog`, lệnh `/check`, trợ lý `reviewer` chỉ đọc và góp ý, cài quyền an toàn, rồi lưu một bản vào git.
- **AI đề xuất gì:**
  - Tạo đủ các phần trên.
  - Thêm `guard.sh`, một script chặn thao tác bị cấm, vì bảng quyền chỉ khớp theo cách viết lệnh nên dễ bỏ lọt.
  - Chặn thêm `rm -r`, `find -delete` và `git clean`.
  - Vẫn cho đọc `.env.example`, vì file này không chứa key thật.
  - Không cho `reviewer` dùng công cụ sửa file và git, nên khi gọi cần đưa danh sách file vừa đổi.
- **Chấp nhận hay sửa gì, vì sao:** Chưa có phản hồi về các phần AI đề xuất thêm.
- **AI đã sai ở đâu:** Lần chạy `/ailog` đầu tiên không được phiên làm việc nhận ra, nên mục này do AI ghi tay theo đúng mẫu. AI đã dặn trước là có thể cần mở phiên mới, nhưng chưa chạy thử lệnh trước khi bàn giao, nên lệnh vẫn chưa được kiểm chứng.

## 2026-11-06 19:23 — Chạy thử /check và /ailog

- **Đã nhờ AI làm gì:** Chạy lệnh `/check`, rồi chạy `/ailog`.
- **AI đề xuất gì:** `/check` báo dự án chưa có code nên chưa có gì để kiểm tra. AI gợi ý gõ thử lại `/ailog`.
- **Chấp nhận hay sửa gì, vì sao:** Người dùng đã gõ lại `/ailog`, không nêu lý do. Vẫn chưa có phản hồi về các phần AI đề xuất thêm ở mục trước.
- **AI đã sai ở đâu:** không có.

## 2026-11-06 20:01 — Cài skill, tạo citation-check và đổi sang đăng nhập ẩn danh

- **Đã nhờ AI làm gì:**
  - Cài 5 skill ngoài và đọc lại nội dung từng skill.
  - Ghi quyết định dùng đăng nhập ẩn danh của Supabase vào `CLAUDE.md`.
  - Tạo skill `citation-check` theo mẫu của người dùng, rồi đồng bộ với `CLAUDE.md` và `reviewer.md`.
  - Lưu vào git.
- **AI đề xuất gì:**
  - Sửa các chỗ mẫu `citation-check` lệch với quyết định đã chốt: câu có ở nhiều trang, thiếu `quote_vi`, ô `not_found`, nhãn tiếng Việt.
  - Yêu cầu `reviewer` đọc skill này khi soát phần trích dẫn.
  - Đặt ngưỡng câu quá ngắn là dưới 15 ký tự.
  - Dùng NFKC cho chữ dính "fi" và tính đến câu vắt qua hai trang.
  - Chỉ chuẩn hóa để so sánh, giữ `guard.sh`, và kiểm tra quy tắc phân quyền theo chủ sở hữu từng dòng.
- **Chấp nhận hay sửa gì, vì sao:**
  - Đăng nhập ẩn danh: do người dùng đề xuất thay mã tự tạo, để mỗi trình duyệt có danh tính thật và quy tắc phân quyền chặn được việc xem bảng của nhau.
  - Các sửa cho `citation-check` và `reviewer`: chấp nhận.
  - Câu quá ngắn: người dùng thêm trường hợp này vì câu ngắn dễ xuất hiện ở nhiều chỗ. Giữ ngưỡng 15 ký tự, ghi là con số tạm, sẽ chỉnh sau buổi thử thật.
  - NFKC: chấp nhận, áp dụng cho cả câu trích và văn bản bài, thêm test.
  - Câu vắt qua hai trang: người dùng chọn tìm thêm ở chỗ nối hai trang và tính theo trang bắt đầu.
  - `guard.sh` và việc chặn thêm các lệnh xóa: giữ, vì chặn nhầm chỉ tốn thêm một lần viết lại lệnh, còn nếu lỡ để lộ API key thì phải đổi key và dọn lịch sử git, mất công hơn nhiều.
  - Đầu trang, chân trang: để thử trên bài thật rồi quyết định, có ghi nhắc trong `CLAUDE.md`.
- **AI đã sai ở đâu:**
  - Kết quả `/doctor` đã cho thấy dấu hiệu máy chưa có npm, nhưng AI không phát hiện, cũng không nói khi tạo `/check`. Máy thiếu Node.js chỉ lộ ra khi lệnh cài skill bị lỗi.
  - Lần đối chiếu đầu của `citation-check` bỏ sót quy tắc "kiểm tra bị lỗi giữa chừng" chỉ có trong `reviewer.md`, đến lần đối chiếu cuối mới thấy.
  - `guard.sh` do AI viết đã chặn nhầm hai lệnh của chính AI vì có chữ `.env`, dù lệnh không mở file `.env` nào.
