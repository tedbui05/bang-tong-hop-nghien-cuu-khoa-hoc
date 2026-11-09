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

## 2026-11-09 20:59 — Chặn gọi AI tràn lan, cài Supabase, hoàn thành các mục Phiên 6

- **Đã nhờ AI làm gì:**
  - Chặn gọi AI tràn lan: phải có phiên đăng nhập hợp lệ (kể cả ẩn danh), giới hạn số bài mỗi người mỗi ngày và tổng cả app mỗi ngày, đếm ở máy chủ, viết test cho bốn trường hợp (chưa đăng nhập, hết lượt của một người, hết lượt cả app, người khác vẫn dùng được).
  - Sau khi người dùng tự cài Supabase: kiểm tra kết nối và đăng nhập ẩn danh, gọi AI thật đúng một lần, xem bộ đếm, chạy test phân quyền. Không mở file biến môi trường, không in khoá.
  - Đối chiếu 10 mục Phiên 6, báo theo bảng rồi làm các mục còn thiếu; SQL cần chạy thì đưa cho người dùng tự chạy.
- **AI đề xuất gì:**
  - Giới hạn tạm 15 bài mỗi người, 150 bài cả app mỗi ngày (đổi được bằng biến môi trường), ngày tính theo giờ Việt Nam. Bộ đếm là hai bảng và hai hàm trong Postgres, chỉ khoá bí mật của máy chủ gọi được.
  - Lưu dữ liệu: mỗi bảng tổng hợp là một dòng `sheet_tables`, mỗi bài là một dòng `sheet_papers` (cả bài dạng JSON), thao tác ở `app_events`. Phân quyền theo chủ sở hữu từng dòng. Chỉ gửi dòng đã đổi. `localStorage` vẫn giữ bản sao để mất mạng không mất thay đổi. File PDF không gửi lên.
  - Người chỉ xem bảng mẫu thì chưa đăng nhập ẩn danh; lần đầu có dữ liệu riêng mới đăng nhập, để không tạo danh tính thừa. Dữ liệu cũ trên trình duyệt tự chuyển lên máy chủ.
  - Trang `/metrics` khoá bằng mật khẩu `METRICS_MAT_KHAU` đặt ở máy chủ; chỉ trả số đếm, không có nội dung ô hay mã người dùng.
  - Dải báo mất mạng trên mọi trang; chân bảng ghi trạng thái lưu lên máy chủ; xuất Excel lưu hết lên máy chủ trước.
  - Lệnh `npm run test:phan-quyen` chạy trên Supabase thật: tạo hai người dùng ẩn danh tạm, thử đọc, sửa, xoá, giả danh chéo nhau, rồi xoá họ.
- **Chấp nhận hay sửa gì, vì sao:**
  - Người dùng tự cài Supabase, tự chạy hai file SQL và tự thêm biến môi trường, không đưa khoá cho AI; không nêu lý do.
  - Chấp nhận bảng đối chiếu và cách làm các mục còn thiếu; không nêu lý do.
  - Người dùng dặn ghi vào nhật ký lỗi vòng lặp 42P17 và chuyện test đạt vì lý do sai.
- **AI đã sai ở đâu:**
  - SQL bản đầu đặt giới hạn số dòng mỗi người (200 bảng, 5000 bài, 3000 thao tác mỗi ngày) ngay trong quy tắc phân quyền "được thêm dòng". Quy tắc đó đếm dòng của chính bảng nó bảo vệ nên Postgres báo vòng lặp (lỗi 42P17) và chặn mọi lần thêm, kể cả của chính chủ. Nếu đem dùng thì app không lưu được gì lên máy chủ. Lệnh `test:phan-quyen` bắt được lỗi này; AI chuyển giới hạn sang trigger, người dùng phải chạy lại file SQL.
  - Ở lần chạy lỗi đó, nhiều mục "người khác bị chặn" vẫn báo ĐẠT, nhưng là vì câu lệnh hỏng do vòng lặp, không phải vì phân quyền chặn. Test chỉ kiểm tra "có lỗi" chứ không kiểm tra đúng loại lỗi. Đã sửa: mục bị chặn chỉ tính đạt khi lỗi là thiếu quyền (mã 42501).
  - Bảng tổng hợp chỉ hiện 7 trên 8 bài khi dữ liệu từ máy chủ về lúc trang bảng đang mở, vì bảng chỉ vẽ lại các dòng đã có, không thêm dòng mới. Phát hiện khi chạy thử luồng "xoá bản sao trên trình duyệt rồi đọc lại từ máy chủ"; đã sửa.
  - Chạy `npm run build` trong lúc `npm run dev` đang chạy làm trang `/api/metrics` của bản dev trả lỗi 500 một lần.
  - Hai lần báo lỗi khi chạy thử là do script thử của AI (đọc sai chỗ trên trang, đếm dòng trước khi bảng vẽ xong), không phải lỗi của app.
- **Kết quả chạy thật (9/11/2026):**
  - Gọi `/api/dien-bang` khi chưa đăng nhập, với phiên giả, hoặc chỉ với khoá công khai: đều bị từ chối (401). Đã đăng nhập: gọi AI được; `ai_usage_user`, `ai_usage_total` đếm đúng. Lần chạy luồng, model chính quá tải nên app chuyển sang model dự phòng, và máy chủ ghi đúng một thao tác "dùng model dự phòng".
  - `test:phan-quyen` đạt cả 27 mục. Câu kiểm tra trong SQL Editor: 5 bảng đều bật phân quyền.
  - Luồng: lưu bài lên máy chủ; tải lại trang vẫn còn; xoá bản sao trên trình duyệt vẫn đọc lại đủ từ máy chủ; lúc mất mạng có dải báo và máy chủ chưa có thay đổi, có mạng lại thì tự lưu; Excel có số dòng bằng số bài trên máy chủ; `/metrics` sai mật khẩu bị từ chối, đúng mật khẩu thì hiện số liệu, khổ điện thoại không cuộn ngang.
  - 263 test đạt, lint và build chạy thành công. Khoá bí mật không có trong code gửi cho trình duyệt.
