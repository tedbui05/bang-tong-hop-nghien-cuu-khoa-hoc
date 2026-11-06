# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Tình trạng dự án

Đang ở bản xem thử giao diện: 4 màn hình chạy bằng dữ liệu mẫu. Chưa có AI, cơ sở dữ liệu, code kiểm tra câu trích, xuất Excel thật, và chưa có test tự động.

Lệnh (lệnh test sẽ bổ sung khi có test):

- Chạy trên máy: `npm run dev`, rồi mở http://localhost:3000
- Build: `npm run build`
- Lint: `npm run lint`

## Kiến trúc

Next.js App Router, TypeScript, CSS thường trong `src/app/globals.css`.

- `src/app/`: 4 trang: `/` (bảng tổng hợp), `/tao-bang`, `/them-bai`, `/duyet-bai`.
- `src/components/`: mỗi trang có một view (`TableView`, `CreateTableView`, `AddPaperView`, `ReviewView`) và các phần dùng chung.
- `src/lib/columns.ts`: bộ cột gợi ý và các hàm với cột (kiểm tra tên, đổi chỗ, đếm ô sẽ mất). Cột không còn là danh sách cố định: mỗi bảng tự giữ `columns` trong store. Ô và cột nhận biết nhau bằng mã cột (`AiCell.column`), không bằng tên, nên đổi tên không mất dữ liệu.
- `src/components/ColumnMenu.tsx`: menu mở khi bấm tiêu đề cột. Bấm tiêu đề không còn tự sắp xếp, sắp xếp nằm trong menu.
- `src/components/InfoCard.tsx`: thẻ "Thông tin bài" ở trang duyệt, xác nhận một lần cho cả nhóm.
- `src/lib/sample-data.ts`: dữ liệu mẫu từ 8 bài báo thật (Anh, Việt, Trung). Mọi câu trích được đối chiếu với PDF gốc, nhãn gán tay theo kết quả dò. Không được bịa câu trích: câu chưa đối chiếu được thì để trống, gắn "cần kiểm tra" và ghi rõ là dữ liệu minh hoạ.
- `src/lib/sheet.ts`: tìm kiếm không phân biệt dấu, lọc, sắp xếp và đếm nhãn cho bảng tổng hợp.
- `src/components/SheetGrid.tsx`: bảng kiểu Google Sheets, bọc thư viện Tabulator (MIT), chỉ tải ở trang bảng. Phần nhìn nằm trong `src/app/sheet.css`. Tiêu đề cột là nút thật để mở menu bằng bàn phím, và vẫn kéo được để đổi chỗ. Ba điều phải giữ khi sửa: `keybindings` tắt `navPrev`, `navNext` để phím Tab không bị kẹt trong bảng; `revealCell` giữ ô đang chọn không chui xuống cột cố định, vì Tabulator cảnh báo cột cố định dùng chung với chọn vùng có thể lỗi (cảnh báo này còn hiện trong console); không bật dán và không bật xóa vùng.
- `src/components/EvidenceBar.tsx`: thanh bằng chứng ở vị trí thanh công thức.
- Sinh viên bấm đúp để sửa ô nội dung ngay trong bảng: ô có chữ "đã sửa", giữ đề xuất ban đầu của AI, ghi thao tác `o_bi_sua` kèm `noi: "bang"`. Ô "chưa điền" tự gõ thì ghi "do bạn điền", không có câu trích. Câu trích gốc không sửa được; Tên bài chỉ sửa được ở trang duyệt.
- `src/lib/store.tsx`: bộ nhớ tạm dùng chung giữa các trang, tải lại trang là mất. `saveReview` từ chối lưu khi còn ô chưa duyệt hoặc chưa xác nhận thông tin bài.
- `src/lib/types.ts`: kiểu dữ liệu theo skill `citation-check`.
- `src/lib/events.ts`: ghi thao tác, hiện chỉ in ra console.
- `PreviewBar` và `?trang-thai=dang-tai|loi|trong`: chỉ để xem thử trạng thái, bỏ khi nối dữ liệu thật.

Quy ước phông: chữ lấy từ bài báo dùng `.source-text` (Source Serif 4), lời của AI và giao diện dùng Be Vietnam Pro.

Quy ước giao diện: nền trung tính và một màu nhấn. Màu xanh lá, xanh dương, vàng chỉ dùng cho trạng thái, đỏ chỉ dùng cho chữ báo lỗi. Câu trích gốc và tên bài có `translate="no"` để trình duyệt không tự dịch.

Phím tắt trang duyệt chỉ chạy khi đang chọn thẻ (`ReviewCard`):

- Thẻ "Thông tin bài" được chọn đầu tiên và dùng chung các phím này.
- Enter xác nhận và sang ô chưa duyệt tiếp theo. Ở ô "cần kiểm tra" phải bấm Enter hai lần. Giữ chặt phím chỉ tính một lần và không tự lưu được.
- E mở phần sửa. Trong ô sửa, Ctrl/⌘ + Enter lưu, Esc hủy.

Ảnh so sánh giao diện nằm ở `docs/screenshots/`, mở `so-sanh.html` để xem.

## Thiết kế giao diện

Mặc định là quy ước hiện tại: nền trung tính, một màu nhấn, phông Be Vietnam Pro và Source Serif 4. Khi làm giao diện, skill `ui-ux-pro-max` chỉ đưa ra các phương án về màu, phông và bố cục để người dùng so sánh, trong đó phương án đầu tiên luôn là quy ước hiện tại. Chỉ đổi khi người dùng chọn phương án khác. Nếu `frontend-design` hướng dẫn khác ở ba việc này thì theo `ui-ux-pro-max`.

Dù skill nào đề xuất gì, luôn giữ các nguyên tắc đã chốt:

- **Dễ đọc lâu:** sinh viên đọc bảng và câu trích trong thời gian dài, nên ưu tiên chữ rõ, đủ tương phản, không dùng hiệu ứng làm mỏi mắt.
- **Đủ dấu tiếng Việt:** chỉ dùng phông có bộ chữ tiếng Việt. Kiểm tra cột `Subsets` có `vietnamese`, rồi xem thử chữ có dấu trên màn hình. Phông skill gợi ý có thể thiếu bộ chữ này.
- **Phân biệt chữ bài báo với chữ AI:** chữ lấy từ bài báo và lời của AI phải nhìn khác nhau rõ ràng, người đọc biết ngay đâu là câu gốc.

Coi kết quả của skill là gợi ý, không phải quy tắc của dự án. Skill này cài từ `ui-ux-pro-max-cli` 2.15.0 và chỉ giữ skill chính. Không chạy lại `uipro init` hay `uipro update` trong dự án: bộ cài sẽ thêm 6 skill phụ, trong đó skill `design` tự đọc file biến môi trường để lấy `GEMINI_API_KEY`.

## Sản phẩm

Web app giúp sinh viên làm khóa luận khỏi phải tự chép thông tin từ bài báo vào Excel, việc vừa mất thời gian vừa dễ hiểu sai.

Luồng chính của bản đầu tiên:

1. Sinh viên tạo bảng mới: đặt tên bảng, rồi thiết lập cột. App gợi ý sẵn bộ cột mẫu, sinh viên thêm, xoá, đổi tên, đổi thứ tự tuỳ ý. Mỗi cột có tên và một dòng mô tả "AI cần tìm gì cho cột này".
2. Thiết lập xong mới tải lên một bài báo PDF, ở ngôn ngữ nào cũng được.
3. AI điền đúng các cột đã thiết lập, theo tên và mô tả cột, bằng tiếng Việt; mỗi ô nội dung kèm câu trích nguyên văn và số trang.
4. App tự kiểm tra câu trích có thật trong bài; không có thì đánh dấu "cần kiểm tra".
5. Sinh viên xác nhận thông tin bài, bấm vào từng ô để xem đoạn gốc, rồi xác nhận hoặc sửa.
6. Bấm "Lưu vào bảng", và xuất được bảng ra Excel.
7. Cột chỉnh được bất cứ lúc nào, kể cả khi bảng đã có dữ liệu, bằng menu trên tiêu đề cột.

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
- **Chuẩn hóa khi so sánh:** dùng NFKC cho cả câu trích và văn bản bài, để xử lý chữ dính như "fi" trong PDF. Chỉ chuẩn hóa để so sánh, câu hiển thị và câu lưu vào bảng luôn là bản gốc.
- **Số trang:** code tìm câu trích trong từng trang và ở chỗ nối giữa cuối trang này với đầu trang sau. Câu vắt qua hai trang tính là trang bắt đầu của câu. Sau đó xử lý như sau:
  - Chỉ có ở trang AI ghi: đạt.
  - Chỉ có ở đúng một trang khác trang AI ghi: tự sửa theo trang code tìm thấy và hiện nhãn "đã sửa số trang".
  - Có ở nhiều trang: đánh dấu "cần kiểm tra".
  - Không có ở đâu: đánh dấu "cần kiểm tra".
- **Câu trích quá ngắn:** dưới 15 ký tự sau chuẩn hóa thì luôn đánh dấu "cần kiểm tra", dù tìm thấy ở đâu. Số 15 là con số tạm, sẽ chỉnh sau buổi thử thật.
- **Ô không có thông tin:** ghi "không tìm thấy", để trống câu trích và số trang, bỏ qua bước kiểm tra, không tính là "cần kiểm tra".
- **Kiểm tra bị lỗi giữa chừng:** đánh dấu "cần kiểm tra", không được coi là đạt.
- Chi tiết kỹ thuật của việc kiểm tra nằm trong skill `citation-check`.
- **Nhiều bảng:** một người dùng có nhiều bảng, chuyển bằng ô chọn trên đầu trang bảng. Tạo bảng mới không đè bảng cũ.
- **Mô tả cột:** dòng "AI cần tìm gì" sẽ gửi cho AI. Để trống vẫn được nhưng có nhắc. Sửa mô tả không làm đổi các ô đã có nội dung.
- **Cột thông tin bài:** Tên bài, Tác giả, Năm, Tạp chí hoặc nơi xuất bản, Ngôn ngữ là các cột riêng, ẩn, hiện, xoá được như cột thường. Riêng Tên bài luôn đứng đầu, không ẩn, không xoá được, và chỉ sửa được ở trang duyệt.
- **Duyệt thông tin bài:** các cột thông tin bài không có câu trích và không có nhãn kiểm tra. Chúng gom vào một thẻ, sinh viên xác nhận một lần; chưa xác nhận thì chưa lưu được.
- **Xoá cột:** cột có dữ liệu thì hỏi lại và nói rõ số ô sẽ mất (ô "không tìm thấy" có tính, ô "chưa điền" không tính). Cột trống thì xoá luôn. Xoá là mất hẳn; thêm lại cột thông tin bài thì các ô để trống.
- **Thêm cột khi đã có bài:** các ô ghi "chưa điền", khác với "không tìm thấy". Nút điền bằng AI bị khóa đến khi nối AI. Khi nối rồi, kết quả vẫn phải qua bước kiểm tra và duyệt, không ghi thẳng vào bảng.
- **Dữ liệu người dùng:** bản đầu dùng đăng nhập ẩn danh (anonymous sign-in) của Supabase, không tự tạo mã trong trình duyệt. Sinh viên không cần tạo tài khoản, nhưng mỗi trình duyệt có một danh tính thật. Quy tắc phân quyền (RLS) phải kiểm tra chủ sở hữu từng dòng theo `auth.uid()` để sinh viên không xem được bảng của nhau; chỉ kiểm tra vai trò `authenticated` là chưa đủ, vì người dùng ẩn danh cũng có vai trò này. Giao diện hiện dòng: "Dữ liệu được lưu trên trình duyệt này. Hãy xuất Excel để giữ bản sao."
- **Bật đăng nhập ẩn danh:** khi đến bước làm cơ sở dữ liệu, hướng dẫn người dùng bật tính năng này trong trang quản lý Supabase.
- **Quyền riêng tư:** màn hình tải bài hiện dòng: "Chỉ tải lên bài báo đã công bố. Không tải tài liệu mật hoặc chưa công bố."

## Việc cần quyết định sau

- Đầu trang và chân trang xen giữa câu vắt qua hai trang: thử trên bài thật rồi quyết định có xử lý thêm không. Hiện những câu này sẽ thành "cần kiểm tra".
- Khi làm code kiểm tra thật, hai điều đã thấy trên bài thật có thể làm câu đúng thành "cần kiểm tra": PDF tiếng Trung chèn khoảng trắng vào giữa câu và tách chữ Latin (ví dụ "Ｓｔｉ ｇ ｌｅｒ"); từ ghép có gạch nối thật bị ngắt cuối dòng ("high-" rồi "poverty") bị nối thành "highpoverty" nên không khớp câu trích "high-poverty". Cần thử rồi quyết định cách xử lý.
- Số trang trong file PDF có thể lệch với số in trên trang: giao diện đang ghi "trang X của file PDF". Thử trên bài thật rồi quyết định có hiện thêm số in không.
- Xuất Excel có kèm cột đang ẩn không: quyết định khi làm xuất Excel thật.

## Ghi chú để đưa vào README sau này

- Giới hạn của đăng nhập ẩn danh: đổi máy hoặc xóa dữ liệu trình duyệt thì không thấy bảng cũ nữa, nên cần xuất Excel để giữ bản sao.

## Lộ trình sau

Bản này chưa làm, nếu thấy cần phải hỏi người dùng trước:

- Công thức tính toán trong bảng
- Biểu đồ
- Nhiều người sửa cùng lúc

## Công nghệ dự kiến

- Next.js
- Tabulator cho bảng tổng hợp (đã dùng). AG Grid Community không có chọn vùng và copy; Handsontable chỉ miễn phí khi dùng phi thương mại.
- Gemini bản miễn phí, tên model đặt trong biến môi trường để dễ đổi, không ghi cứng trong code
- Supabase để lưu dữ liệu
- Xuất file Excel

## Cách làm việc với người dùng

Người dùng không rành kỹ thuật. Mỗi khi làm xong một phần, hãy giải thích ngắn gọn bằng tiếng Việt là đã làm gì.
