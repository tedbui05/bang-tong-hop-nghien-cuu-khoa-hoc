# Kịch bản demo (3 đến 5 phút)

Mục tiêu: cho người xem thấy app giúp sinh viên lập bảng tổng quan tài liệu nhanh mà vẫn tin được, vì mỗi ô đều có câu trích nguyên văn, số trang, và code tự kiểm tra câu trích có thật trong bài.

Hai khoảnh khắc phải làm chậm lại cho người xem kịp thấy:

1. **Rê chuột vào nhãn "tr. 2 · đã khớp"**: trang PDF hiện ra, câu trích tô vàng đúng chỗ.
2. **Ô "cần kiểm tra"**: AI tóm tắt nhiều hơn câu nó trích, app không cho qua mà bắt sinh viên đối chiếu.

## Bài dùng để demo

Dùng **bài mẫu do app tạo** (`public/bai-mau/bai-mau-do-app-tao.pdf`), mở bằng nút **"Tải bài mẫu để thử"** ở trang Thêm bài. Bài này không phải bài báo thật: tên người, trường, tạp chí và số liệu đều là hư cấu, và đầu mỗi trang có ghi điều đó. Dùng bài này thì không lo bản quyền khi chiếu màn hình, và giám khảo tự bấm thử được ngay mà không cần bài báo riêng.

Đã chạy thật với Gemini ngày 9/11/2026: AI điền xong trong khoảng 20 giây, 4 ô "đã khớp", cột Hạn chế ghi "không tìm thấy" vì bài chỉ nêu khó khăn của các trường, không nêu hạn chế của chính nghiên cứu.

## Chuẩn bị trước buổi demo (10 phút)

- Mở app trên trình duyệt sẽ dùng để chiếu, phóng to 110% đến 125% cho người ngồi xa đọc được.
- Tạo sẵn bảng "Tổng quan chương 2" với bộ cột gợi ý (bước 1 bên dưới chỉ đi lướt).
- **Chạy trước bài mẫu một lần** rồi để ở trạng thái "chờ duyệt", không bấm lưu. Bài chờ duyệt được giữ trong trình duyệt kể cả khi tải lại trang. Nếu lúc demo Gemini quá tải, mở bài này thay vì chờ. Lần chạy trước tốn 1 lượt AI.
- Kiểm tra mạng. AI và đăng nhập ẩn danh cần mạng; bảng đã lưu thì xem được khi mất mạng.
- Đóng các tab khác, tắt thông báo của máy.

## Kịch bản

| Thời gian | Bấm gì | Nói gì |
|---|---|---|
| 0:00–0:30 | Mở trang Bảng tổng hợp (Bảng mẫu) | "Sinh viên làm khoá luận phải đọc vài chục bài báo rồi tự chép vào Excel: tên bài, phương pháp, kết quả. Vừa lâu vừa dễ chép sai. App này để AI đề xuất, nhưng mỗi ô đều có câu trích và số trang để kiểm tra lại." |
| 0:30–0:50 | Bấm **Tạo bảng**, cho xem các cột và dòng "AI cần tìm gì cho cột này" | "Sinh viên tự quyết bảng có những cột nào. AI đọc đúng mô tả này để biết cần tìm gì." (Không cần tạo mới, bảng đã chuẩn bị sẵn.) |
| 0:50–1:20 | Vào **Thêm bài**, bấm **Tải bài mẫu để thử** | "Đây là bài mẫu do app tạo, không phải bài báo thật, để ai cũng thử được ngay. File PDF được đọc ngay trên trình duyệt, máy chủ chỉ nhận chữ để gửi cho AI." Trong lúc chờ: "AI chỉ đề xuất. Sau đó code thường, không dùng AI, tìm từng câu trích trong bài để xem có thật không và đúng trang không." |
| 1:20–1:40 | Khi dòng báo "AI đã điền xong", bấm **Duyệt bài** | "Mỗi ô có nhãn: đã khớp, đã sửa số trang, cần kiểm tra hoặc không tìm thấy." |
| 1:40–2:20 | **Khoảnh khắc 1.** Rê chuột vào nhãn **tr. 2 · đã khớp** của ô Câu hỏi nghiên cứu, chờ khung hiện ra. Bấm **Mở toàn màn hình**, rồi Esc | "Đây là trang 2 của file PDF, câu AI trích được tô vàng đúng chỗ. Sinh viên không phải lật bài đi tìm, chỉ cần liếc là biết AI nói có căn cứ hay không." |
| 2:20–2:40 | Kéo xuống ô **Hạn chế**: "không tìm thấy" | "Bài chỉ nói khó khăn của các trường, không nói hạn chế của chính nghiên cứu. AI ghi 'không tìm thấy' chứ không đoán. Quy tắc của app là không đoán." |
| 2:40–3:00 | Xác nhận thẻ Thông tin bài và các ô (Enter để sang ô tiếp theo), bấm **Lưu vào bảng** | "Nút lưu chỉ mở khi sinh viên đã xem hết từng ô. AI không bao giờ tự ghi vào bảng." |
| 3:00–3:50 | **Khoảnh khắc 2.** Vào **Duyệt bài**, bấm **Xem bài mẫu**. Bấm vào thẻ **Kết quả** có nhãn "cần kiểm tra" | "Đây là một bài minh hoạ khác. AI viết: năng suất tăng 13%, trong đó 9% do làm nhiều phút hơn, 4% do nhận nhiều cuộc gọi hơn. Nhưng câu nó trích chỉ có hai chữ 'by 13%'. Quá ngắn, nên code không xác nhận được, và phần 9% với 4% không có căn cứ trong câu trích. Đây là lý do app bắt sinh viên duyệt: AI có thể viết hay hơn những gì nó chứng minh được." Bấm Enter một lần để thấy dòng nhắc "Bạn đã đối chiếu với bài gốc chưa?" |
| 3:50–4:30 | Quay về **Bảng tổng hợp**. Bấm đúp một ô để sửa, chọn ô rồi bấm Cmd/Ctrl + B và **Tô nền**, viết một dòng ở cột **Ghi chú** | "Bảng làm việc như Google Sheets: sửa trực tiếp, tô màu, ghi chú, gắn nhãn. Ô sinh viên sửa có chữ 'đã sửa' và vẫn giữ đề xuất ban đầu của AI." |
| 4:30–4:50 | Bấm **Xuất Excel**, mở file | "Xuất ra Excel giữ nguyên định dạng và màu, để nộp hoặc dán vào khoá luận." |
| 4:50–5:00 | Kết | "Tóm lại: AI làm phần chép, code kiểm tra câu trích, sinh viên giữ quyền quyết định." |

Muốn gọn còn 3 phút: bỏ bước tạo bảng (0:30–0:50) và bước định dạng (3:50–4:30).

## Khi có sự cố

| Sự cố | Làm gì |
|---|---|
| Gemini báo "Hệ thống đang quá tải" | Nói: "Gói miễn phí đang quá tải, app báo rõ và giữ bài để thử lại." Rồi mở bài đã chạy trước ở trang Thêm bài, bấm **Duyệt bài**. |
| AI điền chậm hơn 1 phút | Nói trước phần khoảnh khắc 2 trong lúc chờ, hoặc mở bài đã chạy trước. |
| Hết lượt AI trong ngày | App báo "Đã hết lượt AI miễn phí hôm nay". Dùng bài đã chạy trước. |
| Mất mạng | App hiện dải báo mất mạng. Bảng đã lưu vẫn xem, sửa, xuất Excel được; phần tải bài mới phải chờ có mạng. |
| Lỡ bấm "Xoá toàn bộ dữ liệu của tôi" (chân trang, chân bảng) | App hỏi lại và bắt gõ chữ XOÁ; bấm "Giữ dữ liệu" hoặc Esc để thoát. Đừng xoá trong buổi demo: mọi bảng và bài chờ duyệt sẽ mất. |

## Câu hỏi giám khảo hay hỏi

- **"Làm sao biết câu trích là thật?"** Code tìm câu trích trong chữ của từng trang và chỗ nối hai trang, sau khi chuẩn hoá chữ (NFKC, dấu ngoặc, gạch nối cuối dòng, số chỉ dẫn). Chỉ có ở trang AI ghi thì đạt; ở đúng một trang khác thì tự sửa số trang; ở nhiều trang, không có ở đâu, hoặc ngắn dưới 15 ký tự thì "cần kiểm tra". Chi tiết ở `docs/kiem-tra-cau-trich.md`.
- **"Bài tiếng Việt, tiếng Trung thì sao?"** AI luôn trả lời bằng tiếng Việt, câu trích giữ nguyên ngôn ngữ gốc kèm bản dịch. Đã chạy thật trên bài tiếng Việt, tiếng Anh, tiếng Trung.
- **"Dữ liệu có bị lộ không?"** File PDF không rời trình duyệt. Mỗi trình duyệt có một danh tính ẩn danh riêng, quy tắc phân quyền trên cơ sở dữ liệu chặn sinh viên xem bảng của nhau.
- **"Nếu AI bịa?"** Câu bịa không có trong bài nên thành "cần kiểm tra", và sinh viên phải bấm xác nhận hai lần ở ô đó.
