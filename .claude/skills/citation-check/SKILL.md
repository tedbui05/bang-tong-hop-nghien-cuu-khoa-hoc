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
- quote_original phải chép nguyên văn từ văn bản đã gửi, đúng ngôn ngữ gốc.
- Không có thông tin thì status = "not_found", không đoán.

## Kiểm tra bằng code (không dùng AI)
1. Ô not_found: bỏ qua kiểm tra, không tính là needs_review.
2. Chuẩn hóa cả quote_original và văn bản bài theo cùng một cách: Unicode NFKC, chữ thường, gộp khoảng trắng, nối từ bị ngắt bằng gạch nối cuối dòng.
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

## Test bắt buộc
- Câu khớp; khác chữ hoa; xuống dòng giữa câu; gạch nối ngắt từ; sai trang; câu bịa.
- Câu xuất hiện ở nhiều trang; câu quá ngắn (ví dụ "n = 412"); ô not_found.
- Câu vắt qua hai trang, tính là trang bắt đầu.
- Chữ dính "fi" (NFKC).
- Tiếng Việt có dấu tổ hợp, vẫn đúng sau NFKC.
- Tiếng Trung, vẫn đúng sau NFKC.
