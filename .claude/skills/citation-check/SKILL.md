---
name: citation-check
description: Quy tắc trích xuất và kiểm tra trích dẫn. Dùng khi viết hoặc sửa prompt gửi Gemini, schema JSON của ô, hoặc hàm kiểm tra trích dẫn.
---

# Citation check

## Schema mỗi ô AI trả về
{ column, value_vi, quote_original, quote_vi, page, status: "proposed" | "not_found" }

- quote_vi là bản dịch tiếng Việt của câu trích, chỉ để hiển thị, không dùng để kiểm tra.
- Ô not_found: value_vi = "không tìm thấy"; quote_original, quote_vi, page để trống (null).

## Quy tắc cho AI
- Gửi cho AI cả tên và mô tả ("AI cần tìm gì") của từng cột. Trường column AI trả về là mã cột, không phải tên cột, để đổi tên cột không làm mất dữ liệu.
- quote_original phải chép nguyên văn từ văn bản đã gửi, đúng ngôn ngữ gốc.
- Không có thông tin thì status = "not_found", không đoán.

## Kiểm tra bằng code (không dùng AI)
1. Ô not_found: bỏ qua kiểm tra, không tính là needs_review.
2. Chuẩn hóa cả quote_original và văn bản bài theo cùng một cách: Unicode NFKC, chữ thường, gộp khoảng trắng, nối từ bị ngắt bằng gạch nối cuối dòng. Chỉ chuẩn hóa để so sánh, câu hiển thị và câu lưu vào bảng luôn là bản gốc.
   - Thêm (người dùng đồng ý ngày 9/11/2026): coi các kiểu ngoặc kép và gạch là một; bỏ khoảng trắng cạnh chữ Hán và giữa hai ký tự không phải chữ cái.
   - Văn bản bài có 4 bản để tìm: giữ hoặc bỏ gạch nối cuối dòng, giữ hoặc bỏ số chỉ dẫn dính vào chữ ("GI.10", "Pearson29"). Khớp một bản là khớp. Không bao giờ bỏ con số thật ("13%", "442 firms", "14.6").
   - Code: `src/lib/verify-quote.ts`, giải thích ở `docs/kiem-tra-cau-trich.md`.
3. Quote sau chuẩn hóa dưới 15 ký tự: needs_review, dù tìm thấy ở đâu. Số 15 là con số tạm, sẽ chỉnh sau buổi thử thật.
4. Tìm quote trong từng trang và ở chỗ nối giữa cuối trang này với đầu trang sau.
   - Ghép hai trang trước rồi mới chuẩn hóa, để từ bị ngắt ở cuối trang vẫn được nối.
   - Chỉ tính chỗ nối khi câu thật sự vắt qua ranh giới hai trang, để không đếm trùng.
   - Câu vắt qua hai trang tính là trang bắt đầu của câu.
5. Đếm số trang có câu đó rồi cho kết quả:
   - Chỉ có ở trang AI ghi: verified.
   - Chỉ có ở đúng một trang khác: page_corrected; cập nhật page theo trang tìm thấy, hiện nhãn "đã sửa số trang".
   - Có ở nhiều trang hoặc không có ở đâu: needs_review; hiện nhãn "cần kiểm tra".
6. Kiểm tra bị lỗi giữa chừng: needs_review, không được coi là đạt.

## Cảnh báo "dẫn nguồn khác" (code thường, không dùng AI)
- Hàm `citesOtherSource` trong `src/lib/cited-source.ts`. Câu trích có dấu hiệu dẫn nguồn khác ("Theo X (2022)", "Nguyễn (2020) cho thấy", "et al.", "(Smith, 2019)", "[12]", "据…研究") thì gắn thêm cảnh báo: "Câu trích có dẫn nguồn khác, kiểm tra xem đây có phải kết quả của chính bài này không".
- Cảnh báo này là thêm vào, không thay thế 4 kết quả kiểm tra (verified, page_corrected, needs_review, not_found).
- Chỉ bắt mẫu dẫn nguồn rõ ràng; câu chỉ có năm ("năm 2022, doanh thu tăng") không bị báo.

## Test bắt buộc
- Câu khớp; khác chữ hoa; xuống dòng giữa câu; gạch nối ngắt từ; sai trang; câu bịa.
- Câu xuất hiện ở nhiều trang; câu quá ngắn (ví dụ "n = 412"); ô not_found.
- Câu vắt qua hai trang, tính là trang bắt đầu.
- Chữ dính "fi" (NFKC).
- Tiếng Việt có dấu tổ hợp, vẫn đúng sau NFKC.
- Tiếng Trung, vẫn đúng sau NFKC.
- Số chỉ dẫn dính vào chữ: câu trích không có số vẫn khớp; câu trích bỏ mất con số thật thì không khớp.
- Chữ thật từ 3 bài trong samples/: câu có thật, câu sửa một chữ, câu trong phần tài liệu tham khảo đã bị cắt.
