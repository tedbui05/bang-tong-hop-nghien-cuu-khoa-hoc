# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Tình trạng dự án

Luồng chính đã nối (9/11/2026): tải bài (nhiều file, hàng chờ) → gọi `/api/dien-bang` → kiểm tra câu trích bằng `verifyCells` → màn hình duyệt → lưu vào bảng. Bảng mẫu vẫn còn dữ liệu minh hoạ. Supabase dùng cho đăng nhập ẩn danh, đếm lượt gọi AI, lưu bảng và bài (`sheet_tables`, `sheet_papers`) và thao tác (`app_events`); cài theo `docs/cai-dat-supabase.md`. `localStorage` vẫn giữ bản sao của bảng để mất mạng không mất thay đổi. File PDF và bài chờ duyệt chỉ nằm trong IndexedDB của trình duyệt, không gửi lên máy chủ.

Lệnh:

- Chạy trên máy: `npm run dev`, rồi mở http://localhost:3000
- Build: `npm run build`
- Lint: `npm run lint`
- Test: `npm test` (vitest, file `*.test.ts` nằm cạnh code trong `src/`)
- Test phân quyền trên Supabase thật: `npm run test:phan-quyen` (tạo hai người dùng ẩn danh tạm, thử đọc, sửa, xoá chéo, rồi xoá họ)

## Kiến trúc

Next.js App Router, TypeScript, CSS thường trong `src/app/globals.css`.

- `src/app/`: 5 trang: `/` (bảng tổng hợp), `/tao-bang`, `/them-bai`, `/duyet-bai`, `/metrics` (số liệu đo hiệu quả, cần mật khẩu).
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
- `src/lib/store.tsx`: dữ liệu dùng chung giữa các trang. Bản xem thử giữ bảng, định dạng, ghi chú và nhãn trong `localStorage` (khoá `tcb-bang-v1`) để tải lại trang không mất. Khi có cơ sở dữ liệu chỉ cần thay phần đọc, ghi này. Nút "Đặt lại dữ liệu mẫu" ở dòng bản xem thử xoá dữ liệu đã lưu, kể cả IndexedDB. `saveReview` từ chối lưu khi còn ô chưa duyệt hoặc chưa xác nhận thông tin bài; lưu xong thì mở bài chờ duyệt kế tiếp của cùng bảng, hết bài thì về bảng.
- Hàng chờ tải bài (`queue` trong `store.tsx`, giao diện ở `AddPaperView`): nhận nhiều file hoặc cả thư mục (người dùng đồng ý mở phạm vi ngày 9/11/2026), chỉ giữ PDF, báo tên file bị bỏ qua. Xử lý lần lượt từng bài, mỗi bài gọi AI một lần: đọc chữ → giữ file → gọi AI → kiểm tra câu trích (`src/lib/process-paper.ts`, ghép kết quả ở `src/lib/paper-pipeline.ts`). Lỗi hiện trên dòng của bài kèm cách xử lý, nút Thử lại khi có ích; một bài lỗi không làm dừng bài khác. Dòng chờ AI dùng `waitingMessage`. Còn bài chưa xử lý xong mà tải lại trang thì trình duyệt hỏi lại (file chưa đọc sẽ mất).
- `src/lib/paper-files.ts`: IndexedDB `tcb-tai-lieu`, giữ file PDF gốc (kèm dấu vân tay SHA-256 ở `Paper.file`), chữ từng trang, và bài AI đã điền nhưng chưa lưu vào bảng, kể cả phần đã duyệt dở (người dùng chọn ngày 9/11/2026: mất là tốn thêm một lượt AI). Trình duyệt chặn bộ nhớ thì app vẫn chạy, chỉ không xem lại được PDF.
- Trang duyệt: thẻ bên trái, khung "Đoạn gốc trong bài" bên phải hiện chữ của trang có câu trích, tô vàng câu trích, tự cuộn đến chỗ tô; điện thoại thì bấm "Xem đoạn gốc" để khung trượt lên. Ô "cần kiểm tra" mở trang AI ghi, không tô, ghi "Không xác định được vị trí câu trích, hãy tự tìm trong trang" (`src/lib/evidence.ts`). Ô có cảnh báo dẫn nguồn khác hiện khung cảnh báo. Mỗi cột có câu hỏi gợi ý kiểm tra (`reviewQuestion` trong `columns.ts`, cột tự thêm dùng câu chung). Nút "Duyệt nhanh cả dòng" chỉ hiện khi mọi ô đều "đã khớp", không có cảnh báo (một ô "không tìm thấy" cũng làm ẩn nút, theo `docs/FLOW.md`; người dùng chọn ngày 9/11/2026); vẫn phải bấm, và chỉ xác nhận ô nội dung, thẻ thông tin bài xác nhận riêng. Ô duyệt nhanh ghi `cach: "duyet_nhanh"` khi lưu. Rời trang khi chưa lưu thì hỏi lại (`LeaveGuard`: đóng tab, tải lại, bấm link trong app; nút quay lại của trình duyệt không chặn được, nhưng phần đã duyệt vẫn giữ trong IndexedDB).
- Nhãn bằng chứng và xem PDF (`src/components/EvidencePreview.tsx`, `PdfPageView.tsx`, `src/lib/pdf-view.ts`): mỗi ô có câu trích có nhãn nhỏ "tr. 9 · đã khớp" ở thẻ duyệt và ở khung bằng chứng; trong ô của bảng, nhãn gọn hơn (biểu tượng trạng thái và "tr. 9", đọc đủ bằng trình đọc màn hình) để không chiếm chỗ chữ. Ô "không tìm thấy" không có nhãn. Rê chuột vào nhãn nửa giây thì hiện khung xem trước đúng trang PDF, câu trích tô vàng, tự cuộn tới; di chuột vào khung không bị đóng. Có phóng to, thu nhỏ, "Mở toàn màn hình" (cả bài, mở sẵn trang có câu trích, chuyển trang, Esc để thoát), nút đóng. Điện thoại chạm vào nhãn, khung trượt lên từ dưới. Bàn phím: Tab tới nhãn là khung hiện, Tab tiếp vào trong khung, Esc đóng và trả về nhãn; trong bảng chỉ nhãn của ô đang chọn nhận Tab. Ô "đã sửa số trang" mở trang code tìm thấy; ô "cần kiểm tra" mở trang AI ghi, không tô. Tô vàng dựa trên lớp chữ của pdf.js và `quote_ranges`: chữ ghép từ các mẩu của pdf.js đúng bằng chữ lúc đọc bài (có test trên bài thật). Không còn file PDF thì hiện chữ của trang có tô vàng (hoặc chỉ câu trích nếu cũng không còn chữ) kèm nút "Tải lại file PDF để xem bản gốc"; file tải lại phải có cùng dấu vân tay, sai file thì báo. pdf.js chỉ tải khi mở xem; giữ tối đa 3 file đang mở và 24 trang đã vẽ. Bấm vào nhãn trong bảng không chọn ô và không mở ô sửa.
- Bấm đúp ở ô nửa phải màn hình: lần nhấn đầu mở khung bằng chứng, bảng hẹp lại và tự cuộn nên ô dời chỗ. `SheetGrid` nhận ra cú nhấn thứ hai (trong 500 ms, cách chỗ cũ dưới 8 px, không trúng ô cũ) là bấm đúp vào ô vừa chọn, chặn cú nhấn đó và mở ô sửa. Ô nhận biết bằng mã cột và mã bài (`data-paper` trên dòng), vì bảng vẽ lại thì phần tử của ô bị thay. Click và bấm đúp đi kèm cú nhấn đó bị chặn đến khi nhả chuột (tối đa 2 giây). Đóng khung bằng chứng khi focus đang ở trong khung thì trả focus về bảng.
- Chặn gọi AI tràn lan (làm ngày 9/11/2026, phải có trước khi đưa lên mạng): `/api/dien-bang` chỉ nhận yêu cầu có phiên đăng nhập hợp lệ của Supabase (kể cả ẩn danh), kiểm tra bằng `getClaims` ở `src/lib/supabase.server.ts`; không có thì trả 401. Mỗi người tối đa 15 bài mỗi ngày, cả app tối đa 150 bài mỗi ngày (số tạm, đổi bằng `AI_GIOI_HAN_MOI_NGUOI_MOI_NGAY`, `AI_GIOI_HAN_CA_APP_MOI_NGAY`), ngày tính theo giờ Việt Nam. Số đếm nằm ở máy chủ: bảng `ai_usage_user`, `ai_usage_total` và hàm `claim_ai_call`, `release_ai_call` (`supabase/sql/gioi-han-goi-ai.sql`), chỉ khoá bí mật `SUPABASE_SECRET_KEY` gọi được; người dùng không đọc, không sửa được. Kiểm tra và cộng lượt trong một bước, có khoá dòng. Chưa gọi AI lần nào (ví dụ bài quá dài) thì trả lại lượt. Hết lượt thì báo tiếng Việt kèm Thử lại; bài lỗi mà file đã được giữ vẫn nằm trong hàng chờ kể cả sau khi tải lại trang, thử lại dùng chữ đã giữ, không cần chọn lại file. Logic nằm ở `src/lib/ai-limit.ts` và `src/lib/dien-bang-handler.ts` (test bằng bộ đếm giả). Trình duyệt đăng nhập ẩn danh ở `src/lib/supabase-browser.ts`, chỉ dùng khoá công khai. Chế độ `AI_DUNG_KET_QUA_MAU` không cần đăng nhập vì không gọi Gemini.
- Chạy thử giao diện khi Gemini quá tải: đặt `AI_DUNG_KET_QUA_MAU=1` rồi `npm run dev`, máy chủ trả câu trả lời đã lưu trong `samples/ket-qua-gemini.json` thay vì gọi Gemini (`src/lib/sample-answer.server.ts`; bản build không bao giờ dùng). Câu trích vẫn được kiểm tra trên chữ thật của PDF.
- Tuỳ biến của sinh viên (`src/lib/cell-format.ts`, `src/components/FormatBar.tsx`): in đậm, in nghiêng, gạch chân, màu chữ, tô nền ô hoặc cả hàng, phím tắt Cmd/Ctrl + B, I, U, định dạng nhiều ô cùng lúc. Thanh định dạng nằm ở đầu khung bằng chứng. Ô đã tô màu thì bỏ nền trạng thái, trạng thái chỉ còn biểu tượng ở góc; ô cần kiểm tra thêm viền cam. Màu chữ tự chọn (kể cả đỏ) là lựa chọn của sinh viên, không phạm quy ước "đỏ chỉ cho chữ báo lỗi" của giao diện.
- Tô sáng (`src/components/HighlightText.tsx`): bôi đen đoạn chữ trong nội dung hoặc câu trích ở khung bằng chứng. Chỉ lưu vị trí ký tự, câu trích gốc không đổi. Sửa nội dung ô thì bỏ các đoạn tô sáng của nội dung đó.
- Cột Ghi chú (`kind: "note"`, Markdown, `src/lib/markdown.ts`) và cột Nhãn (`kind: "tags"`, nhãn nằm ở `SheetTable.tags`): sinh viên tự viết, AI không bao giờ điền. Bộ đọc Markdown tự viết, không dựng HTML từ chữ người dùng, chỉ nhận link `http`, `https`, `mailto`.
- Định dạng, tô màu, tô sáng, ghi chú, nhãn không ghi thao tác `o_bi_sua`. Chỉ đổi nội dung một ô do AI đề xuất mới tính là sửa: ô "chưa điền" sinh viên tự gõ và ô "do bạn điền" không tính. Bài mẫu của bản xem thử không ghi thao tác nào.
- Xuất Excel (`src/lib/export-xlsx.ts`, thư viện exceljs, chỉ tải khi bấm nút): xuất mọi bài, các cột đang hiện, theo thứ tự trên bảng; giữ in đậm, in nghiêng, gạch chân, màu chữ, màu nền ô và nền trạng thái; ghi chú thành chữ thường; ô cần kiểm tra có lời nhắc kèm theo trong ô. Ô có chữ bắt đầu bằng dấu "=" vẫn được ghi là chữ, không thành công thức.
- Đọc PDF (`src/lib/pdf-read.ts`, thư viện pdf.js `pdfjs-dist`, Apache-2.0): đọc ngay trên trình duyệt, file không gửi lên máy chủ. Trả về chữ từng trang (`{ page, text }`, trang đếm từ 1 theo file, giữ xuống dòng). Báo lỗi tiếng Việt cho: không phải PDF (xem 1024 byte đầu, không tin đuôi file), file trống, quá 20 MB (chặn trước khi đọc), có mật khẩu mở file, bản scan, file hỏng. PDF chỉ khoá quyền sửa vẫn đọc được. Bản scan: dưới một nửa số trang có từ 20 chữ cái hoặc chữ số trở lên; hai số này là số tạm. Chữ đọc được nằm ở `ReviewSession.pages`, không lưu vào `localStorage`. File này không gắn với trình duyệt: `pdf-browser.ts` truyền pdf.js vào cho trang web, bài test truyền pdf.js chạy bằng Node.
- Cắt tài liệu tham khảo (`src/lib/strip-references.ts`): luôn cắt trước khi gửi AI, để AI không trích câu trong danh mục tài liệu (code kiểm tra sẽ báo khớp dù lấy sai chỗ). Tìm tiêu đề References, Bibliography, Tài liệu tham khảo, 参考文献 đứng riêng một dòng trong 40% cuối bài; cắt đến tiêu đề phụ lục kế tiếp (Appendix, Phụ lục, 附录) hoặc đến hết bài; không thấy tiêu đề thì không cắt. Số trang giữ nguyên, trang bị cắt hết thành trang trống. Bước kiểm tra câu trích cũng dùng bản đã cắt. Sau khi cắt mà trên 100.000 ký tự thì báo "Bài quá dài" (số tạm).
- Gọi AI điền bảng: `src/lib/ai-prompt.ts` (câu lệnh đã được người dùng duyệt, sửa lời dặn thì cho người dùng xem lại trước), `src/lib/ai-answer.ts` (kiểm tra câu trả lời đúng khuôn), `src/lib/ai-extract.ts` (cắt tài liệu tham khảo, gọi AI, sai khuôn thì gửi lại đúng một lần kèm lý do, đổi lỗi thành câu tiếng Việt), `src/lib/gemini.server.ts` (gọi Gemini, chỉ chạy trên máy chủ, log chỉ ghi mã lỗi và số giây), `src/app/api/dien-bang/route.ts`. Model dự phòng (`GEMINI_FALLBACK_MODEL`, có thể bỏ trống): model chính quá tải (429, 503), hết lượt trong ngày hoặc quá giờ thì tự gọi model dự phòng đúng một lần; lỗi khác (key sai, bị chặn, sai khuôn) không chuyển. Sai khuôn thì gửi lại một lần cho chính model vừa trả lời. Model dự phòng cũng lỗi thì báo "Hệ thống đang quá tải, vui lòng thử lại sau ít phút" kèm nút thử lại (riêng sai khuôn hai lần thì báo sai định dạng). Không có model dự phòng thì quá tải báo ngay, không tự gửi lại. Hết lượt trong ngày (Google trả 429 có chữ "PerDay") báo riêng "Đã hết lượt AI miễn phí hôm nay", không có nút Thử lại vì thử lại trong ngày vô ích (người dùng chọn ngày 9/11/2026); lượt miễn phí tính riêng từng model nên vẫn chuyển sang model dự phòng. Tổng thời gian mọi lần gọi AI cho một bài không vượt 285 giây (`TOTAL_BUDGET_SECONDS`), vì route chỉ được chạy 300 giây: model dự phòng và lần gửi lại chỉ được chờ phần thời gian còn lại, còn dưới 10 giây thì không gọi nữa. Bài lưu model đã điền ở `Paper.filled_by`; màn hình duyệt hiện dòng "Điền bởi … (model dự phòng)" và nhắc duyệt kỹ; nhật ký ghi `tai_bai` kèm `model`, `du_phong`, và thao tác `dung_model_du_phong` mỗi lần dùng model dự phòng. Test dùng câu trả lời giả, không gọi Gemini thật. Chạy thử thật thì mỗi bài chỉ gọi một lần để không tốn lượt miễn phí.
- Cảnh báo dẫn nguồn khác (`src/lib/cited-source.ts`, code thường): câu trích có dấu hiệu dẫn nguồn khác ("Theo X (2022)", "Nguyễn (2020) cho thấy", "et al.", "(Smith, 2019)", "[12]", "据…研究") thì gắn cảnh báo "Câu trích có dẫn nguồn khác, kiểm tra xem đây có phải kết quả của chính bài này không". Cảnh báo thêm vào, không thay thế 4 kết quả kiểm tra; `verifyCells` gắn vào ô ở trường `cites_other_source`. Không bắt được số dẫn nguồn dạng chỉ số trên (ví dụ "innovation.12"), vì khi đọc từ PDF số này dính vào chữ.
- Kiểm tra câu trích (`src/lib/verify-quote.ts`, code thường, giải thích từng bước ở `docs/kiem-tra-cau-trich.md`): `verifyCells(ô, trang)` tự cắt tài liệu tham khảo bằng đúng hàm đã dùng trước khi gửi AI, rồi kiểm tra từng ô theo skill `citation-check`. Chuẩn hoá thêm ngoài skill (người dùng đồng ý ngày 9/11/2026): coi các kiểu ngoặc kép và gạch là một; bỏ khoảng trắng cạnh chữ Hán và giữa hai ký tự không phải chữ cái (PDF tiếng Trung chen khoảng trắng "26. 7%"). Mỗi trang có 4 bản để tìm: giữ hoặc bỏ gạch nối cuối dòng (để "high-" xuống dòng "poverty" khớp cả "high-poverty" lẫn "highpoverty"), giữ hoặc bỏ số chỉ dẫn dính vào chữ ("GI.10", "Pearson29"). Số chỉ dẫn chỉ tính khi dính sau từ Latin từ 2 chữ cái hoặc sau dấu câu đứng sau chữ Latin, không theo sau là %, chữ số hay phần thập phân, và phải nhận ra trước khi bỏ khoảng trắng, để không đụng con số thật như "13%", "442 firms", "14.6", "in GI. 10 firms". Dòng đầu trang, chân trang (`findRepeatedEdgeLines`): dòng lặp lại ở 3 dòng đầu hoặc 3 dòng cuối của ít nhất 3 trang (coi mỗi dãy số liền nhau là một, để bỏ qua số trang) thì chỉ bị bỏ khi so ở chỗ nối hai trang; chữ của bài không đổi; bài dưới 3 trang không áp dụng (người dùng chọn ngày 9/11/2026). Test chữ thật đọc từ `samples/` (tự bỏ qua khi máy không có file). Sau khi kiểm tra, `locateQuote` tìm vị trí câu trích trong chữ gốc của trang (chỉ so chữ cái và chữ số, nhớ vị trí từng ký tự) để tô vàng, lưu ở `AiCell.quote_ranges`; câu vắt hai trang có hai đoạn; ô "cần kiểm tra" không có vị trí. Bước này chỉ để hiển thị, không bao giờ đổi nhãn.
- Bài mẫu để chạy thử nằm ở `samples/` (không đưa vào git).
- Bài mẫu do app tạo (`public/bai-mau/bai-mau-do-app-tao.pdf`, có trong git): bài hư cấu tiếng Anh dựng bằng `scripts/tao-bai-mau.mjs` (chạy `node scripts/tao-bai-mau.mjs` để dựng lại), mỗi trang ghi rõ không phải bài báo thật. Trang Thêm bài có nút "Tải bài mẫu để thử" đưa bài này vào hàng chờ, kèm liên kết tải file về máy; giám khảo thử app không cần bài riêng, vẫn tốn 1 lượt AI (giao diện có ghi). Bài mẫu đang ở hàng chờ của bảng thì nút bị khoá. Mọi thao tác trên bài này (nhận ra bằng tên file, `src/lib/app-sample.ts`) không ghi vào số liệu đo hiệu quả, giống bài mẫu của bản xem thử; riêng `dung_model_du_phong` do máy chủ ghi thì vẫn tính. `src/lib/sample-paper.test.ts` giữ các trường hợp mà kịch bản demo (`docs/kich-ban-demo.md`) dựa vào.
- `scripts/copy-pdfjs-assets.mjs` chạy trước `dev` và `build`, chép worker và bộ mã chữ (cMap, cần cho bài tiếng Trung, Nhật, Hàn) của pdf.js vào `public/pdfjs/` (không đưa vào git).
- `src/test/make-pdf.ts`: tự dựng PDF mẫu cho test (có chữ, chỉ có ảnh, có mật khẩu theo chuẩn mã hoá RC4 40-bit), không lưu file nhị phân vào git. Chỉ có chữ Latin vì dùng phông Helvetica có sẵn.
- `src/lib/types.ts`: kiểu dữ liệu theo skill `citation-check`.
- `src/lib/events.ts`: ghi thao tác vào hàng chờ trong `localStorage` rồi gửi lên bảng `app_events`; gửi lỗi (mất mạng, chưa có phiên) thì giữ lại gửi sau. Thao tác `dung_model_du_phong` do máy chủ ghi (`recordServerEvent` trong `dien-bang-handler.ts`), đếm số lần bài được điền bằng model dự phòng. Người dùng có thể tự ghi thao tác giả của chính mình (giới hạn 3000 mỗi 24 giờ), nên số liệu chỉ để tham khảo.
- Lưu lên máy chủ (`src/lib/cloud-sync.ts`, nối ở `store.tsx`, gọi Supabase ở `supabase-browser.ts`): bảng là một dòng `sheet_tables` (cột, nhãn dạng JSON), mỗi bài là một dòng `sheet_papers` (cả bài dạng JSON); chỉ gửi dòng đã đổi. Người chỉ xem bảng mẫu thì chưa đăng nhập, chưa lưu gì; lần đầu có dữ liệu riêng mới đăng nhập ẩn danh. Mở app: còn thay đổi chưa lưu lên máy chủ thì gửi bản trình duyệt lên, không thì dùng bản máy chủ; máy chủ trống mà trình duyệt có dữ liệu cũ thì chuyển lên (`chooseStart`). Lỗi thì giữ trên trình duyệt, thử lại sau 20 giây và khi có mạng lại; chân bảng ghi trạng thái lưu. "Đặt lại dữ liệu mẫu" xoá cả dữ liệu trên máy chủ. Xuất Excel lưu hết lên máy chủ trước; chưa lưu được thì vẫn xuất và nhắc. Quy tắc phân quyền và giới hạn số dòng ở `supabase/sql/du-lieu-bang.sql`; giới hạn số dòng đặt ở trigger `gioi_han_so_dong`, vì chính sách đếm dòng của chính bảng đó bị Postgres báo vòng lặp (42P17).
- Báo mất mạng (`src/components/NetworkBanner.tsx`): dải báo trên mọi trang khi trình duyệt mất mạng.
- Trang `/metrics` (`src/components/MetricsView.tsx`, `src/lib/metrics.ts`, `src/lib/metrics-handler.ts`, `src/app/api/metrics/route.ts`): chỉ số tính từ hàm `metrics_counts` (chỉ khoá bí mật gọi được, chỉ trả số đếm). Cần mật khẩu `METRICS_MAT_KHAU` ở máy chủ, ít nhất 12 ký tự; chưa đặt thì trang bị khoá; sai mật khẩu thì chờ 1 giây.
- `PreviewBar`: câu "Đang mở Bảng mẫu: dữ liệu minh hoạ…" chỉ hiện khi bảng đang mở là Bảng mẫu (`SampleNote`), vì bảng của sinh viên dùng nhãn do code kiểm tra thật; nút "Đặt lại dữ liệu mẫu" luôn có. Phần "Xem thử trạng thái" (`?trang-thai=dang-tai|loi|trong`) chỉ hiện khi chạy `npm run dev`. Trang duyệt vẫn có "Xem bài mẫu" (bài minh hoạ, không qua AI, không giữ lại).

Quy ước phông: chữ lấy từ bài báo dùng `.source-text` (IBM Plex Serif), lời của AI và giao diện dùng IBM Plex Sans.

Quy ước giao diện: nền trung tính và một màu nhấn. Màu xanh lá, xanh dương, vàng chỉ dùng cho trạng thái, đỏ chỉ dùng cho chữ báo lỗi. Ô "đã khớp" chỉ có biểu tượng, không tô nền; ba trạng thái còn lại tô nền nhạt kèm biểu tượng. Câu trích gốc và tên bài có `translate="no"` để trình duyệt không tự dịch.

Phím tắt trang duyệt chỉ chạy khi đang chọn thẻ (`ReviewCard`):

- Thẻ "Thông tin bài" được chọn đầu tiên và dùng chung các phím này.
- Enter xác nhận và sang ô chưa duyệt tiếp theo. Ở ô "cần kiểm tra" phải bấm Enter hai lần. Giữ chặt phím chỉ tính một lần và không tự lưu được.
- E mở phần sửa. Trong ô sửa, Ctrl/⌘ + Enter lưu, Esc hủy.

Ảnh so sánh giao diện nằm ở `docs/screenshots/`, mở `so-sanh.html` để xem.

Bản quyền bài mẫu: ảnh chụp đưa vào git chỉ dùng dữ liệu mẫu có sẵn trong app (câu trích ngắn), hoặc làm mờ phần trang PDF và chữ của trang (ví dụ `docs/screenshots/noi-luong/`). Ảnh có hình trang hay chữ của bài trong `samples/` để ở `docs/screenshots-private/` (không đưa vào git). Test được giữ câu trích ngắn từ bài mẫu, không chép cả đoạn hay cả trang.

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
- **Bật đăng nhập ẩn danh:** hướng dẫn ở `docs/cai-dat-supabase.md`.
- **Quyền riêng tư:** màn hình tải bài hiện dòng: "Chỉ tải lên bài báo đã công bố. Không tải tài liệu mật hoặc chưa công bố."

## Việc cần làm sau

- Chạy `supabase/sql/du-lieu-bang.sql` trên Supabase (bước 3b của `docs/cai-dat-supabase.md`), đặt `METRICS_MAT_KHAU`, rồi chạy `npm run test:phan-quyen`. Phần đăng nhập ẩn danh và đếm lượt AI đã cài xong và chạy thật ngày 9/11/2026. Nên bật CAPTCHA cho đăng nhập ẩn danh trước khi mời nhiều người dùng thử.
- Xoá thư mục `.git-sao-luu-2026-11-09` (bản sao lưu `.git` trước khi dọn lịch sử ngày 9/11/2026, vẫn còn ảnh có trang bài mẫu) sau khi đẩy git lên GitHub lần đầu thành công. Người dùng tự xoá, vì hook an toàn chặn Claude xoá thư mục.
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

- Bài tiếng Anh (Lin và cộng sự, 2023): 131 giây, 5 ô có câu trích, cả 5 đã khớp. Cột Phương pháp và Kết quả trích từ Abstract (trang 1). Không ô nào lấy kết quả của nghiên cứu khác, không ô nào trích từ bảng. Chạy lại qua app tối 9/11 (bảng mẫu, 6 cột nội dung): 20 giây, 5 ô đã khớp, cột Câu hỏi và Kết quả vẫn trích từ Abstract.
- Bài mẫu do app tạo (9/11): 21 giây, 4 ô đã khớp, cột Hạn chế đúng là "không tìm thấy".
- Bài tiếng Trung (汪阳洁 và cộng sự, 2022): 22 giây, 5 ô có câu trích, cả 5 đã khớp. Cột Câu hỏi trích từ 内容提要 (tóm tắt, trang 1). Không ô nào lấy kết quả của nghiên cứu khác, không ô nào trích từ bảng. Không có nơi xuất bản.
- Mức `medium` trên bài tiếng Việt: ô Câu hỏi từng thành "cần kiểm tra" dù AI chép đúng, vì câu vắt từ trang 2 sang trang 3 và dòng đầu trang "P.Q. Hai et al. / VNU Journal…" chen giữa câu. Đã sửa: code nhận ra dòng đầu trang, chân trang lặp lại, ô này giờ đã khớp.
- Người dùng chọn giữ mức `low` (9/11/2026): cả hai mức đều tránh được bẫy cột Hạn chế; `medium` trích ít từ tóm tắt hơn nhưng chậm gấp đôi.


## Việc cần quyết định sau

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
  - Giới hạn chờ model chính: `GEMINI_TIMEOUT_SECONDS`, mặc định 150 giây (số tạm). Lý do (người dùng chọn 9/11/2026): phần lớn bài sinh viên đọc là tiếng Anh và dài; bài tiếng Anh mẫu mất 131 giây, bài tiếng Việt và tiếng Trung 22 giây; để thấp hơn thì đa số bài bị đẩy sang model dự phòng dễ sai hơn. Khi quá tải Google thường báo 503 ngay nên vẫn chuyển nhanh. Quá giờ thì chuyển sang model dự phòng; model dự phòng được chờ 180 giây.
  - Màn hình chờ: `waitingMessage(số giây đã chờ)` trong `src/lib/ai-extract.ts`: "AI đang đọc bài, có thể mất 1 đến 2 phút", sau 60 giây đổi thành "AI đang đọc bài dài, có thể mất thêm 1 đến 2 phút", để sinh viên không tưởng app bị treo.
- Supabase để lưu dữ liệu. Đã dùng cho đăng nhập ẩn danh và đếm lượt gọi AI: `@supabase/supabase-js` 2.118.0 (ghim đúng phiên bản), khoá kiểu mới (publishable, secret).
- Xuất file Excel bằng exceljs (MIT)

## Cách làm việc với người dùng

Người dùng không rành kỹ thuật. Mỗi khi làm xong một phần, hãy giải thích ngắn gọn bằng tiếng Việt là đã làm gì.
