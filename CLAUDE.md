# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Tình trạng dự án

Đang ở bản xem thử giao diện: 4 màn hình chạy bằng dữ liệu mẫu. Đã đọc được chữ từng trang của file PDF và xuất được Excel. Đã gọi được Gemini trên máy chủ (`/api/dien-bang`) và đã có code kiểm tra câu trích (`src/lib/verify-quote.ts`), nhưng cả hai chưa nối vào giao diện. Chưa có cơ sở dữ liệu.

Lệnh:

- Chạy trên máy: `npm run dev`, rồi mở http://localhost:3000
- Build: `npm run build`
- Lint: `npm run lint`
- Test: `npm test` (vitest, file `*.test.ts` nằm cạnh code trong `src/`)

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
- `src/components/EvidencePanel.tsx`: khung bằng chứng, chỉ hiện khi chọn ô. Máy tính mở bên phải, điện thoại trượt lên từ dưới và không che ô đang chọn.
- Trang bảng chiếm trọn màn hình, chỉ bảng tự cuộn bên trong: thanh tiêu đề, hàng ô số liệu bấm để lọc, thanh công cụ một dòng, rồi đến bảng.
- Sinh viên bấm đúp để sửa ô nội dung ngay trong bảng: ô có chữ "đã sửa", giữ đề xuất ban đầu của AI, ghi thao tác `o_bi_sua` kèm `noi: "bang"`. Ô "chưa điền" tự gõ thì ghi "do bạn điền", không có câu trích. Câu trích gốc không sửa được; Tên bài chỉ sửa được ở trang duyệt.
- `src/lib/store.tsx`: dữ liệu dùng chung giữa các trang. Bản xem thử giữ bảng, định dạng, ghi chú và nhãn trong `localStorage` (khoá `tcb-bang-v1`) để tải lại trang không mất; bài đang duyệt dở thì không giữ. Khi có cơ sở dữ liệu chỉ cần thay phần đọc, ghi này. Nút "Đặt lại dữ liệu mẫu" ở dòng bản xem thử xoá dữ liệu đã lưu. `saveReview` từ chối lưu khi còn ô chưa duyệt hoặc chưa xác nhận thông tin bài.
- Tuỳ biến của sinh viên (`src/lib/cell-format.ts`, `src/components/FormatBar.tsx`): in đậm, in nghiêng, gạch chân, màu chữ, tô nền ô hoặc cả hàng, phím tắt Cmd/Ctrl + B, I, U, định dạng nhiều ô cùng lúc. Thanh định dạng nằm ở đầu khung bằng chứng. Ô đã tô màu thì bỏ nền trạng thái, trạng thái chỉ còn biểu tượng ở góc; ô cần kiểm tra thêm viền cam. Màu chữ tự chọn (kể cả đỏ) là lựa chọn của sinh viên, không phạm quy ước "đỏ chỉ cho chữ báo lỗi" của giao diện.
- Tô sáng (`src/components/HighlightText.tsx`): bôi đen đoạn chữ trong nội dung hoặc câu trích ở khung bằng chứng. Chỉ lưu vị trí ký tự, câu trích gốc không đổi. Sửa nội dung ô thì bỏ các đoạn tô sáng của nội dung đó.
- Cột Ghi chú (`kind: "note"`, Markdown, `src/lib/markdown.ts`) và cột Nhãn (`kind: "tags"`, nhãn nằm ở `SheetTable.tags`): sinh viên tự viết, AI không bao giờ điền. Bộ đọc Markdown tự viết, không dựng HTML từ chữ người dùng, chỉ nhận link `http`, `https`, `mailto`.
- Định dạng, tô màu, tô sáng, ghi chú, nhãn không ghi thao tác `o_bi_sua`. Chỉ đổi nội dung một ô do AI đề xuất mới tính là sửa.
- Xuất Excel (`src/lib/export-xlsx.ts`, thư viện exceljs, chỉ tải khi bấm nút): xuất mọi bài, các cột đang hiện, theo thứ tự trên bảng; giữ in đậm, in nghiêng, gạch chân, màu chữ, màu nền ô và nền trạng thái; ghi chú thành chữ thường; ô cần kiểm tra có lời nhắc kèm theo trong ô. Ô có chữ bắt đầu bằng dấu "=" vẫn được ghi là chữ, không thành công thức.
- Đọc PDF (`src/lib/pdf-read.ts`, thư viện pdf.js `pdfjs-dist`, Apache-2.0): đọc ngay trên trình duyệt, file không gửi lên máy chủ. Trả về chữ từng trang (`{ page, text }`, trang đếm từ 1 theo file, giữ xuống dòng). Báo lỗi tiếng Việt cho: không phải PDF (xem 1024 byte đầu, không tin đuôi file), file trống, quá 20 MB (chặn trước khi đọc), có mật khẩu mở file, bản scan, file hỏng. PDF chỉ khoá quyền sửa vẫn đọc được. Bản scan: dưới một nửa số trang có từ 20 chữ cái hoặc chữ số trở lên; hai số này là số tạm. Chữ đọc được nằm ở `ReviewSession.pages`, không lưu vào `localStorage`. File này không gắn với trình duyệt: `pdf-browser.ts` truyền pdf.js vào cho trang web, bài test truyền pdf.js chạy bằng Node.
- Cắt tài liệu tham khảo (`src/lib/strip-references.ts`): luôn cắt trước khi gửi AI, để AI không trích câu trong danh mục tài liệu (code kiểm tra sẽ báo khớp dù lấy sai chỗ). Tìm tiêu đề References, Bibliography, Tài liệu tham khảo, 参考文献 đứng riêng một dòng trong 40% cuối bài; cắt đến tiêu đề phụ lục kế tiếp (Appendix, Phụ lục, 附录) hoặc đến hết bài; không thấy tiêu đề thì không cắt. Số trang giữ nguyên, trang bị cắt hết thành trang trống. Bước kiểm tra câu trích cũng dùng bản đã cắt. Sau khi cắt mà trên 100.000 ký tự thì báo "Bài quá dài" (số tạm).
- Gọi AI điền bảng: `src/lib/ai-prompt.ts` (câu lệnh đã được người dùng duyệt, sửa lời dặn thì cho người dùng xem lại trước), `src/lib/ai-answer.ts` (kiểm tra câu trả lời đúng khuôn), `src/lib/ai-extract.ts` (cắt tài liệu tham khảo, gọi AI, sai khuôn thì gửi lại đúng một lần kèm lý do, đổi lỗi thành câu tiếng Việt), `src/lib/gemini.server.ts` (gọi Gemini, chỉ chạy trên máy chủ, log chỉ ghi mã lỗi và số giây), `src/app/api/dien-bang/route.ts`. Model dự phòng (`GEMINI_FALLBACK_MODEL`, có thể bỏ trống): model chính quá tải (429, 503) hoặc quá giờ thì tự gọi model dự phòng đúng một lần; lỗi khác (key sai, bị chặn, sai khuôn) không chuyển. Sai khuôn thì gửi lại một lần cho chính model vừa trả lời. Model dự phòng cũng lỗi thì báo "Hệ thống đang quá tải, vui lòng thử lại sau ít phút" kèm nút thử lại (riêng sai khuôn hai lần thì báo sai định dạng). Không có model dự phòng thì quá tải báo ngay, không tự gửi lại. Bài lưu model đã điền ở `Paper.filled_by`; màn hình duyệt hiện dòng "Điền bởi … (model dự phòng)" và nhắc duyệt kỹ; nhật ký ghi `tai_bai` kèm `model`, `du_phong`, và thao tác `dung_model_du_phong` mỗi lần dùng model dự phòng. Test dùng câu trả lời giả, không gọi Gemini thật. Chạy thử thật thì mỗi bài chỉ gọi một lần để không tốn lượt miễn phí.
- Cảnh báo dẫn nguồn khác (`src/lib/cited-source.ts`, code thường): câu trích có dấu hiệu dẫn nguồn khác ("Theo X (2022)", "Nguyễn (2020) cho thấy", "et al.", "(Smith, 2019)", "[12]", "据…研究") thì gắn cảnh báo "Câu trích có dẫn nguồn khác, kiểm tra xem đây có phải kết quả của chính bài này không". Cảnh báo thêm vào, không thay thế 4 kết quả kiểm tra; `verifyCells` gắn vào ô ở trường `cites_other_source`. Không bắt được số dẫn nguồn dạng chỉ số trên (ví dụ "innovation.12"), vì khi đọc từ PDF số này dính vào chữ.
- Kiểm tra câu trích (`src/lib/verify-quote.ts`, code thường, giải thích từng bước ở `docs/kiem-tra-cau-trich.md`): `verifyCells(ô, trang)` tự cắt tài liệu tham khảo bằng đúng hàm đã dùng trước khi gửi AI, rồi kiểm tra từng ô theo skill `citation-check`. Chuẩn hoá thêm ngoài skill (người dùng đồng ý ngày 9/11/2026): coi các kiểu ngoặc kép và gạch là một; bỏ khoảng trắng cạnh chữ Hán và giữa hai ký tự không phải chữ cái (PDF tiếng Trung chen khoảng trắng "26. 7%"). Mỗi trang có 4 bản để tìm: giữ hoặc bỏ gạch nối cuối dòng (để "high-" xuống dòng "poverty" khớp cả "high-poverty" lẫn "highpoverty"), giữ hoặc bỏ số chỉ dẫn dính vào chữ ("GI.10", "Pearson29"). Số chỉ dẫn chỉ tính khi dính sau từ Latin từ 2 chữ cái hoặc sau dấu câu đứng sau chữ Latin, không theo sau là %, chữ số hay phần thập phân, và phải nhận ra trước khi bỏ khoảng trắng, để không đụng con số thật như "13%", "442 firms", "14.6", "in GI. 10 firms". Test chữ thật đọc từ `samples/` (tự bỏ qua khi máy không có file).
- Bài mẫu để chạy thử nằm ở `samples/` (không đưa vào git).
- `scripts/copy-pdfjs-assets.mjs` chạy trước `dev` và `build`, chép worker và bộ mã chữ (cMap, cần cho bài tiếng Trung, Nhật, Hàn) của pdf.js vào `public/pdfjs/` (không đưa vào git).
- `src/test/make-pdf.ts`: tự dựng PDF mẫu cho test (có chữ, chỉ có ảnh, có mật khẩu theo chuẩn mã hoá RC4 40-bit), không lưu file nhị phân vào git. Chỉ có chữ Latin vì dùng phông Helvetica có sẵn.
- `src/lib/types.ts`: kiểu dữ liệu theo skill `citation-check`.
- `src/lib/events.ts`: ghi thao tác, hiện chỉ in ra console. Thao tác `dung_model_du_phong` đếm số lần bài được điền bằng model dự phòng.
- `PreviewBar` và `?trang-thai=dang-tai|loi|trong`: chỉ để xem thử trạng thái, bỏ khi nối dữ liệu thật.

Quy ước phông: chữ lấy từ bài báo dùng `.source-text` (IBM Plex Serif), lời của AI và giao diện dùng IBM Plex Sans.

Quy ước giao diện: nền trung tính và một màu nhấn. Màu xanh lá, xanh dương, vàng chỉ dùng cho trạng thái, đỏ chỉ dùng cho chữ báo lỗi. Ô "đã khớp" chỉ có biểu tượng, không tô nền; ba trạng thái còn lại tô nền nhạt kèm biểu tượng. Câu trích gốc và tên bài có `translate="no"` để trình duyệt không tự dịch.

Phím tắt trang duyệt chỉ chạy khi đang chọn thẻ (`ReviewCard`):

- Thẻ "Thông tin bài" được chọn đầu tiên và dùng chung các phím này.
- Enter xác nhận và sang ô chưa duyệt tiếp theo. Ở ô "cần kiểm tra" phải bấm Enter hai lần. Giữ chặt phím chỉ tính một lần và không tự lưu được.
- E mở phần sửa. Trong ô sửa, Ctrl/⌘ + Enter lưu, Esc hủy.

Ảnh so sánh giao diện nằm ở `docs/screenshots/`, mở `so-sanh.html` để xem.

## Thiết kế giao diện

Phương án đang dùng là **phương án 2 (Data-Dense Dashboard)** do người dùng chọn ngày 2026-11-06, có nới kích thước: nền và chữ theo bảng màu học thuật của skill, màu nhấn `#1e3a5f`, phông IBM Plex Sans và IBM Plex Serif, chữ trong bảng 14px, hàng cao 40px, đệm 8px trên dưới và 12px hai bên.

Lý do: màn hình chính là bảng dày thông tin; IBM Plex có chữ số đều nên số thẳng hàng, điều Be Vietnam Pro không làm được; hai phông cùng họ nhưng một có chân, một không, nên phân biệt rõ chữ bài báo với chữ AI; cỡ chữ và hàng được nới so với bản gốc của phương án để đọc lâu đỡ mỏi.

Mọi màu, phông và kích thước nằm trong biến CSS ở `:root` của `src/app/globals.css`. Không viết mã màu ở nơi khác; ngoại lệ duy nhất là `themeColor` trong `layout.tsx`, vì trình duyệt không đọc được biến CSS ở đó.

Khi làm giao diện, skill `ui-ux-pro-max` chỉ đưa ra các phương án về màu, phông và bố cục để người dùng so sánh, trong đó phương án đầu tiên luôn là quy ước đang dùng. Chỉ đổi khi người dùng chọn phương án khác. Nếu `frontend-design` hướng dẫn khác ở ba việc này thì theo `ui-ux-pro-max`.

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
- **Ghi lại thao tác để đo hiệu quả:** lúc tải bài, ô được giữ nguyên, ô bị sửa, ô cần kiểm tra, lúc bấm "Lưu vào bảng", lúc dùng model dự phòng.

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

## Việc cần làm sau

- Đã chạy 3 bài trong `samples/` bằng `gemini-3.6-flash` ngày 9/11/2026, toàn bộ câu trả lời nằm trong `samples/ket-qua-gemini.json`. Còn lại: thử thêm trên bài thật khác, nhất là xem cột Câu hỏi và Kết quả còn hay trích từ phần tóm tắt không.

### So sánh model trên bài tiếng Việt (Phạm Quang Hải và cộng sự, 2023)

| Tiêu chí | `gemini-3.5-flash-lite` (8 và 9/11) | `gemini-3.6-flash`, mức `low` | `gemini-3.6-flash`, mức `medium` |
|---|---|---|---|
| Bẫy cột Hạn chế (câu đúng là "không tìm thấy") | Rơi vào bẫy: lấy hạn chế của doanh nghiệp ở trang 8 | Đúng: "không tìm thấy" | Đúng: "không tìm thấy" |
| Lấy kết quả của nguồn khác | Có: cột Kết quả lấy số liệu "Theo Vietnam Report (2022)" | Không | Không |
| Tên bài | Tiếng Anh, theo trang tóm tắt tiếng Anh | Tiếng Việt | Tiếng Việt |
| Tác giả | Không dấu ("Pham Quang Hai") | Có dấu ("Phạm Quang Hải") | Có dấu |
| Ngôn ngữ | "Tiếng Anh" (sai) | "Tiếng Việt" | "Tiếng Việt" |
| Trích từ phần tóm tắt | Cột Câu hỏi (tóm tắt tiếng Anh) | Cột Câu hỏi, Kết quả | Không |
| Thời gian | 4 đến 11 giây | 22 giây | 48 giây |

Lần chạy bản rút gọn ngày 9/11 là sau khi đã sửa quy tắc 11 (ngôn ngữ, tên bài lấy theo thân bài), nhưng vẫn lấy tên bài và ngôn ngữ theo trang tiếng Anh.

### Kết quả `gemini-3.6-flash` mức `low` trên 2 bài còn lại (9/11/2026)

- Bài tiếng Anh (Lin và cộng sự, 2023): 131 giây, 5 ô có câu trích, cả 5 đã khớp. Cột Phương pháp và Kết quả trích từ Abstract (trang 1). Không ô nào lấy kết quả của nghiên cứu khác, không ô nào trích từ bảng.
- Bài tiếng Trung (汪阳洁 và cộng sự, 2022): 22 giây, 5 ô có câu trích, cả 5 đã khớp. Cột Câu hỏi trích từ 内容提要 (tóm tắt, trang 1). Không ô nào lấy kết quả của nghiên cứu khác, không ô nào trích từ bảng. Không có nơi xuất bản.
- Mức `medium` trên bài tiếng Việt: ô Câu hỏi thành "cần kiểm tra" dù AI chép đúng, vì câu vắt từ trang 2 sang trang 3 và dòng đầu trang "P.Q. Hai et al. / VNU Journal…" chen giữa câu (xem "Việc cần quyết định sau").

- Phiên làm màn hình duyệt: mỗi cột có một câu hỏi gợi ý kiểm tra, hiện khi duyệt ô. Ví dụ cột Hạn chế: "Đây là hạn chế của chính nghiên cứu, hay của đối tượng được nghiên cứu?"; cột Kết quả: "Đây là kết quả của bài này, hay của nghiên cứu khác mà bài dẫn lại?".

## Việc cần quyết định sau

- Đầu trang và chân trang xen giữa câu vắt qua hai trang: hiện những câu này thành "cần kiểm tra". Đã gặp trên bài thật ngày 9/11/2026: ô Câu hỏi của bài tiếng Việt (mức `medium`) chép đúng nhưng bị dòng đầu trang 3 "P.Q. Hai et al. / VNU Journal of Economics and Business, Vol. 3, No. 1 (2023) 28-37" chen giữa câu. Cần quyết định có xử lý không.
- PDF tiếng Trung tách chữ Latin bằng khoảng trắng (ví dụ "Ｓｔｉ ｇ ｌｅｒ"): code kiểm tra chưa xử lý, câu như vậy thành "cần kiểm tra". Khoảng trắng chen giữa chữ Hán, giữa số và dấu câu, và từ ghép có gạch nối bị ngắt cuối dòng thì đã xử lý (ngày 9/11/2026).
- Số trang trong file PDF có thể lệch với số in trên trang: giao diện đang ghi "trang X của file PDF". Thử trên bài thật rồi quyết định có hiện thêm số in không.
- Xuất Excel đang bỏ cột ẩn và giữ mọi bài dù đang lọc: hỏi lại người dùng sau buổi thử thật.
- Ngưỡng nhận biết bản scan (20 chữ mỗi trang, một nửa số trang) và giới hạn 20 MB: thử trên bài thật rồi chỉnh. Chưa thử trên PDF tiếng Trung, tiếng Việt thật vì máy chưa có file bài gốc.
- exceljs kéo theo hai thư viện có cảnh báo mức trung bình (`uuid`, `minimatch`): chỉ chạy trên trình duyệt khi xuất file, không nhận dữ liệu từ bên ngoài. Xem lại khi exceljs có bản mới.

## Ghi chú để đưa vào README sau này

- Giới hạn của đăng nhập ẩn danh: đổi máy hoặc xóa dữ liệu trình duyệt thì không thấy bảng cũ nữa, nên cần xuất Excel để giữ bản sao.

## Lộ trình sau

Bản này chưa làm, nếu thấy cần phải hỏi người dùng trước:

- Công thức tính toán trong bảng
- Chèn ảnh vào ô
- Biểu đồ
- Nhiều người sửa cùng lúc

## Công nghệ dự kiến

- Next.js
- Tabulator cho bảng tổng hợp (đã dùng). AG Grid Community không có chọn vùng và copy; Handsontable chỉ miễn phí khi dùng phi thương mại.
- Gemini bản miễn phí, tên model đặt trong biến môi trường để dễ đổi, không ghi cứng trong code
  - Model đang dùng: `gemini-3.6-flash`, mức suy nghĩ `low` (đổi bằng `GEMINI_THINKING_LEVEL` nếu cần).
  - `gemini-2.5-flash` đã ngừng cho người dùng mới (Google trả lỗi 404). `gemini-3.7-flash` và `gemini-3.8-flash` trả lời quá chậm với gói miễn phí, quá 30 giây cho một câu một chữ (thử ngày 8/11/2026). Có thể thử lại sau.
  - Model dự phòng: `gemini-3.5-flash-lite`, đặt ở `GEMINI_FALLBACK_MODEL`, app tự chuyển khi model chính quá tải. Nhanh hơn nhưng là bản rút gọn, dễ sai ở cột cần phân biệt tinh tế. `gemini-3.6-flash` gói miễn phí quá tải liên tục từ tối 8/11/2026.
  - Giới hạn chờ model chính: `GEMINI_TIMEOUT_SECONDS`, mặc định 60 giây (số tạm, khoảng gấp đôi thời gian thường của bài tiếng Việt và tiếng Trung: 22 giây). Quá giờ thì chuyển sang model dự phòng; model dự phòng được chờ 180 giây. Bài tiếng Anh mẫu mất 131 giây ngày 9/11/2026, nên với mặc định 60 giây bài này sẽ chuyển sang model dự phòng. Thử thêm rồi chỉnh.
- Supabase để lưu dữ liệu
- Xuất file Excel bằng exceljs (MIT)

## Cách làm việc với người dùng

Người dùng không rành kỹ thuật. Mỗi khi làm xong một phần, hãy giải thích ngắn gọn bằng tiếng Việt là đã làm gì.
