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

## 2026-11-09 15:40 — Nối luồng hoàn chỉnh, xem PDF có tô vàng, dọn bản quyền ảnh

- **Đã nhờ AI làm gì:**
  - Lên kế hoạch rồi nối luồng tải bài → gọi AI → kiểm tra câu trích → duyệt → lưu vào bảng (Phần A); thêm nhãn bằng chứng "tr. 9 · đã khớp" và xem trang PDF gốc có tô vàng câu trích (Phần B). Mỗi phần chạy thử thật, chụp ảnh máy tính và điện thoại, lưu git riêng.
  - Sau đó: thêm nhãn đọc đủ chữ cho trình đọc màn hình, gộp tên ngôn ngữ khi đếm, dọn ảnh có trang bài mẫu khỏi git và khỏi toàn bộ lịch sử, xoá nhánh đã gộp, chạy /check, nhờ reviewer đọc lại.
- **AI đề xuất gì:**
  - 4 câu hỏi trong kế hoạch: giữ kết quả AI chưa duyệt trong IndexedDB; ô "không tìm thấy" cũng làm ẩn nút "Duyệt nhanh cả dòng" (theo FLOW.md); câu hỏi gợi ý cho cột Câu hỏi, Phương pháp, Mẫu; báo riêng lỗi hết lượt AI trong ngày.
  - Dùng pdf.js có sẵn thay cho react-pdf; tô vàng theo vị trí ký tự mà code kiểm tra tìm ra.
  - Trong ô của bảng chỉ để nhãn gọn "✓ tr. 9" để không chiếm chỗ chữ.
  - Ảnh tài liệu dùng bài mẫu của app hoặc làm mờ trang PDF.
- **Chấp nhận hay sửa gì, vì sao:**
  - Người dùng duyệt lại 4 đề xuất sau khi làm xong và đồng ý cả 4:
    - Giữ kết quả AI chưa duyệt trong IndexedDB: tải lại trang không mất kết quả, không phải gọi lại AI, đỡ tốn lượt miễn phí.
    - Ô "không tìm thấy" làm ẩn nút "Duyệt nhanh cả dòng": "không tìm thấy" có thể do AI bỏ sót, sinh viên cần tự xác nhận bài thật sự không có thông tin.
    - Câu hỏi gợi ý cho cột Câu hỏi, Phương pháp, Mẫu: mở rộng cách đã hiệu quả với cột Hạn chế và Kết quả.
    - Báo riêng lỗi hết lượt trong ngày: lúc đó bấm Thử lại vô ích, cần báo quay lại hôm sau.
  - Bài học: lần sau trả lời câu hỏi trong kế hoạch trước khi cho AI làm.
  - Đồng ý nhãn gọn trong bảng, yêu cầu thêm nhãn đọc đủ chữ cho trình đọc màn hình.
  - Chấp nhận nút quay lại của trình duyệt không hỏi lại, vì dữ liệu vẫn được giữ.
  - Yêu cầu sửa cột Ngôn ngữ đếm "tiếng Việt" và "Tiếng Việt" thành hai loại.
  - Yêu cầu dọn bản quyền: đưa ảnh có trang bài mẫu ra ngoài git, xoá khỏi toàn bộ lịch sử, sao lưu .git trước. Hook an toàn chặn lệnh dọn; người dùng chọn cho AI dùng lệnh `git update-index --remove` thay thế, đúng một lần.
  - Xoá nhánh `them-skill-ui-ux-pro-max` đã gộp; ghi việc xoá bản sao lưu .git sau lần đẩy GitHub đầu tiên vào CLAUDE.md.
- **AI đã sai ở đâu:**
  - Người dùng dặn xong Phần A thì báo rồi mới sang Phần B; AI làm liền cả hai vì mục tiêu đã đặt, chỉ báo một lần ở cuối.
  - Khung chữ của trang trên điện thoại không cuộn tới câu trích vì cuộn lúc khung còn ẩn; phải sửa và chụp lại.
  - Toàn màn hình bấm "Trang sau" nhảy từ trang 1 sang trang 3 do tính sai trang đang xem; phải sửa và chạy lại.
  - Kịch bản thử "đã sửa số trang" lần đầu chọn nhầm cột không có câu trích, phải chạy lại.
  - Ảnh chụp Phần A và B có hình trang và chữ của bài mẫu đã được đưa vào git; AI chỉ nhận ra và báo sau khi đã lưu git, nên phải dọn lịch sử.
  - Khung xem trước của bài mẫu không có file vẫn ghi "hãy tự tìm trong trang" dù không có trang nào để xem; phát hiện khi chụp lại ảnh.
  - Lệnh chuyển ảnh ra ngoài git bị hook chặn vì có lệnh xoá dạng hàng loạt; lúc ghi nhật ký này, lệnh ghi cũng bị chặn nhầm vì nội dung có chữ giống lệnh xoá.
  - Lỗi hết lượt trong ngày vẫn có nút Thử lại, trái với lý do đã chọn (thử lại trong ngày vô ích); phát hiện khi người dùng ghi lý do vào nhật ký.
- **Kết quả reviewer đọc lại code (sau khi làm xong):**
  - Phần quan trọng nhất ổn: không có đường nào làm ô thành "đã khớp" sai, bước tìm vị trí để tô vàng không đổi được nhãn, ô "cần kiểm tra" không bao giờ bị tô; key không lọt ra trình duyệt hay log; chế độ dùng câu trả lời đã lưu không bật được trên bản build; không lưu được vào bảng khi chưa duyệt hết ô và chưa xác nhận thông tin bài; hàng chờ không gọi AI hai lần cho một bài.
  - Lỗi reviewer tìm ra, AI đã sửa hết trước khi lưu git:
    - Bàn phím bị kẹt ở khung xem trước: bấm Esc thì khung đóng rồi mở lại ngay, người dùng bàn phím không đi tiếp được.
    - Xoá cột trong lúc AI đang đọc bài: dữ liệu của cột đã xoá vẫn được lưu, thêm lại cột thì dữ liệu cũ hiện lại.
    - Tổng thời gian chờ AI (model chính rồi model dự phòng) có thể vượt giới hạn 300 giây của máy chủ.
    - Tô vàng có thể lệch chỗ mà không báo nếu chữ của trang lấy lại khác chữ đã lưu; nay so trước, khác thì không tô và báo.
    - Chế độ toàn màn hình giữ quá nhiều ảnh trang, có thể tốn vài trăm MB và lỗi trên iPhone khi phóng to.
    - Bấm nhãn trong bảng có thể mở khung bằng chứng của một ô khác.
    - Lần dò vị trí thứ hai bỏ hết chữ số nên có thể tô nhầm câu chỉ khác con số; nay chỉ bỏ số chỉ dẫn dính vào chữ.
    - Ghi thừa "ô bị sửa" khi sinh viên tự gõ ô "chưa điền"; lưu bài mẫu cũng bị tính vào chỉ số.
    - Thiếu thông báo lỗi khi không mở được trang PDF; khung chữ của trang tự cuộn về đầu khi trang vẽ lại; nhãn trong bảng bị vẽ lại làm khung xem trước nằm lại; bài chờ duyệt không có nút bỏ.
  - Khi chạy lại trên trình duyệt để kiểm tra các chỗ đã sửa, AI phát hiện thêm một lỗi do chính mình gây ra: bài không có file PDF thì Tab không vào được khung xem trước vì nhảy vào nút đang bị khoá. Đã sửa.
  - Việc để sau: giới hạn số lần gọi AI theo người dùng khi có đăng nhập ẩn danh (hiện ai biết đường dẫn cũng gọi được, nhưng key không bị lộ).
