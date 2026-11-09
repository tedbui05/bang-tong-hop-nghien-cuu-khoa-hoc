# Kiểm tra câu trích: code làm gì, từng bước

Code nằm ở `src/lib/verify-quote.ts`. Test nằm ở `src/lib/verify-quote.test.ts` (chữ viết sẵn) và `src/lib/verify-quote.samples.test.ts` (chữ thật đọc từ 3 bài trong `samples/`).

## Vì sao cần bước này

AI có thể "bịa" câu trích: viết một câu nghe rất giống trong bài nhưng thật ra không có, hoặc ghi sai số trang. Vì vậy với mỗi ô, app tự đi tìm câu trích trong chữ của bài. Việc này làm bằng **code thường**, không nhờ AI: code chỉ so chữ với chữ nên không thể "bịa" theo.

Mỗi ô nhận một trong 4 kết quả:

| Kết quả | Khi nào |
|---|---|
| Đã khớp (`verified`) | Tìm thấy câu ở đúng trang AI ghi |
| Đã sửa số trang (`page_corrected`) | Tìm thấy câu ở đúng một trang, nhưng khác trang AI ghi. App sửa theo trang tìm thấy |
| Cần kiểm tra (`needs_review`) | Không tìm thấy, có ở nhiều trang, câu quá ngắn, hoặc kiểm tra bị lỗi |
| Không tìm thấy (`not_found`) | AI nói bài không có thông tin. Không có câu trích nên không kiểm tra |

Ngoài ra còn một **cảnh báo thêm**: câu trích có dẫn nguồn khác (ví dụ "Theo Vietnam Report (2022)…"). Cảnh báo này không thay thế kết quả ở trên.

## Đi qua file theo từng phần

File chia thành các phần 1, 2, 2b, 2c, 3, 4, 5, có tiêu đề trong code.

### Phần 1. Con số tạm

`MIN_QUOTE_CHARS = 15`: câu trích ngắn hơn 15 ký tự thì luôn "cần kiểm tra". Câu như "n = 412" quá ngắn, có thể tình cờ trùng ở chỗ khác, nên không đủ làm bằng chứng. Số 15 là số tạm, sẽ chỉnh sau buổi thử thật.

### Phần 2. Chuẩn hoá chữ để so sánh (`normalizeForMatch`)

Chữ đọc từ PDF thường "lộn xộn" hơn chữ AI chép: xuống dòng giữa câu, từ bị ngắt bằng gạch nối, chữ "fi" dính liền… Nếu so thẳng thì câu đúng cũng thành sai. Vì vậy trước khi so, cả câu trích lẫn chữ của bài đều đi qua **cùng 6 bước**:

1. **NFKC và chữ thường.** NFKC là chuẩn Unicode đưa các ký tự "trông giống nhau" về một dạng: chữ dính "ﬁ" thành "fi", dấu phẩy tiếng Trung "，" thành ",", chữ tiếng Việt có dấu viết theo hai cách khác nhau thành một cách. Chữ hoa thành chữ thường.
2. **Dấu ngoặc và gạch về một kiểu.** “ ” và " là một; – và - là một. AI hay chép đổi qua lại các dấu này.
3. **Nối từ bị ngắt cuối dòng.** "advan-" xuống dòng "tage" thành "advantage".
4. **(Chỉ cho chữ của bài) bỏ số chỉ dẫn.** Xem Phần 2b.
5. **Bỏ khoảng trắng thừa của PDF tiếng Trung.** PDF tiếng Trung hay chen khoảng trắng: "政 策 研 究", "26. 7% － 39. 4%". AI thì chép liền. Bước này bỏ khoảng trắng nằm cạnh chữ Hán, và khoảng trắng nằm giữa hai ký tự không phải chữ cái (số, dấu câu). Khoảng trắng cạnh chữ cái như trong "by 13%" vẫn giữ.
6. **Gộp khoảng trắng.** Mọi chỗ xuống dòng, nhiều dấu cách liền nhau thành một dấu cách.

Điều quan trọng: **chuẩn hoá chỉ để so sánh**. Câu hiển thị cho sinh viên và câu lưu vào bảng vẫn là câu gốc, không đổi một chữ.

Vì cả hai phía đi qua cùng các bước, chuẩn hoá chỉ làm cho hai câu *vốn giống nhau* nhìn giống nhau hơn. Nó không thêm chữ nào vào bài, nên câu bịa vẫn không khớp.

### Phần 2b. Số chỉ dẫn nhỏ dính vào chữ

Bài tiếng Anh hay đánh số tài liệu bằng chữ số nhỏ ở trên dòng. Khi đọc từ PDF, số đó dính vào chữ. Ví dụ thật trong bài Lin và cộng sự (2023):

- "…driver of GI.10 Firms engaged…" (số 10 dính sau dấu chấm)
- "…extreme climate change,1–3 which…" (số 1–3 dính sau dấu phẩy)
- "Kemp and Pearson29 explained…" (số 29 dính vào tên tác giả)

AI thường chép câu **không có** số này: "driver of GI. Firms engaged". Nếu không xử lý, câu đúng sẽ thành "cần kiểm tra".

Cách làm: **không xoá số nào khỏi bài**. Code tạo thêm một *bản để tìm* đã bỏ số chỉ dẫn. Câu khớp với bản thường hoặc bản bỏ số chỉ dẫn đều tính là khớp.

Một dãy số chỉ bị coi là số chỉ dẫn khi đủ cả hai điều kiện:

- dính **ngay** sau một từ Latin có từ 2 chữ cái ("pearson29", "li46"), hoặc ngay sau dấu câu mà trước dấu câu là chữ Latin ("returns.11", "change,1-3");
- ngay sau dãy số là khoảng trắng, dấu câu hoặc hết dòng, và không phải phần thập phân.

Vì sao cách này không làm sai những con số thật:

| Con số thật | Vì sao không bị coi là số chỉ dẫn |
|---|---|
| "by 13%", "442 firms" | Trước con số là khoảng trắng |
| "13%" | Sau con số là dấu %, không phải khoảng trắng hay dấu câu |
| "14.6", "0.5" | Trước dấu chấm là chữ số, không phải chữ cái |
| "提高了26.7%" | Trước con số là chữ Hán, không phải chữ Latin |
| "in GI. 10 firms" | Bỏ số chỉ dẫn chạy khi khoảng trắng còn nguyên, nên "10" vẫn có khoảng trắng đứng trước |

Ngoài ra, câu trích **giữ** con số thật vẫn khớp với bản thường. Câu trích **bỏ mất** con số thật ("more than % of") không khớp với bản nào, nên thành "cần kiểm tra". Các trường hợp này đều có test.

**Hàm `variants`**: mỗi trang có đúng 4 bản để tìm (bỏ hoặc giữ gạch nối, nhân với bỏ hoặc giữ số chỉ dẫn). Bản giữ gạch nối dành cho từ ghép thật bị ngắt cuối dòng: "high-" xuống dòng "poverty". Bản bỏ gạch nối cho ra "highpoverty", bản giữ cho ra "high-poverty", và câu trích viết kiểu nào cũng khớp.

### Phần 2c. Dòng đầu trang và chân trang (`findRepeatedEdgeLines`)

Tạp chí thường in lặp lại một dòng ở đầu hoặc cuối mỗi trang: tên tạp chí, tên tác giả, số trang. Khi một câu vắt qua hai trang, dòng này chen vào giữa câu. Ví dụ thật ở bài tiếng Việt, trang 2 sang trang 3:

```
…từ đó đề xuất các giải pháp có tính khả thi nhằm thúc đẩy chuyển đổi số trong các doanh     ← cuối trang 2
P.Q. Hai et al. / VNU Journal of Economics and Business, Vol. 3, No. 1 (2023) 28-3730        ← đầu trang 3
nghiệp logistics phát triển theo đúng tiềm năng, thế mạnh.
```

AI chép đúng câu, nhưng vì dòng giữa chen vào nên trước đây câu bị "cần kiểm tra".

Cách code nhận ra dòng đầu trang, chân trang:

1. Xem 3 dòng đầu và 3 dòng cuối của mỗi trang.
2. So các dòng sau khi chuẩn hoá, và coi mỗi dãy số liền nhau là một ký hiệu. Nhờ vậy "…(2023) 28-37 29" ở trang 2 và "…(2023) 28-3730" ở trang 3 được tính là cùng một dòng, dù số trang khác nhau và dính vào theo hai kiểu.
3. Dòng nào lặp lại ở đầu hoặc cuối của **ít nhất 3 trang** thì mới coi là đầu trang, chân trang. Bài dưới 3 trang thì không áp dụng.

Một câu nội dung tình cờ xuất hiện ở đầu 2 trang không đủ 3 lần, nên không bị coi nhầm.

Code **chỉ bỏ dòng này khi so ở chỗ nối hai trang**: bỏ những dòng đầu trang, chân trang nằm sát mép (cuối trang này, đầu trang sau), rồi mới ghép hai trang lại. Chữ của bài và chữ hiển thị không đổi. Câu nằm gọn trong một trang vẫn được so với chữ nguyên vẹn. Ở chỗ nối, code thử cả cách ghép nguyên văn lẫn cách ghép đã bỏ dòng đầu trang, khớp một cách là được, nên không làm mất trường hợp nào trước đây vẫn khớp.

Ở bài tiếng Anh mẫu, code còn nhận ra hai dòng ghi chú dưới bảng ("Note: *p < 0.1…", "Adj R2 …"), vì bảng hay nằm ở cuối trang. Hai dòng này cũng chỉ bị bỏ ở chỗ nối hai trang, nên vô hại.

### Phần 3. Tìm câu trích trong từng trang và ở chỗ nối (`findPages`)

Với mỗi trang:

- **3a.** Câu có nằm gọn trong trang này không?
- **3b.** Câu có nằm vắt qua chỗ nối với trang sau không? Code ghép hai trang lại rồi mới chuẩn hoá, để từ bị ngắt ở cuối trang ("develop-" | "ment") vẫn được nối. Code ghép theo hai cách: nguyên văn, và bỏ dòng đầu trang, chân trang ở chỗ nối (Phần 2c).

Ở 3b, câu đã nằm gọn trong một trang thì cũng sẽ tìm thấy trong bản ghép, nên dễ bị đếm hai lần. Để tránh, code **đếm số lần**: chỉ khi bản ghép có **nhiều lần hơn** tổng số lần ở hai trang riêng, mới chắc chắn có một lần câu thật sự vắt qua ranh giới. Câu vắt qua hai trang tính là trang bắt đầu.

Kết quả là danh sách các số trang có câu đó.

### Phần 4. Ra kết quả cho một câu (`verifyQuote`)

- **4a.** Chuẩn hoá xong mà dưới 15 ký tự: "cần kiểm tra", lý do "quá ngắn".
- **4b.** Đếm số trang tìm thấy:
  - 0 trang: "cần kiểm tra" (không thấy câu này trong bài);
  - từ 2 trang trở lên: "cần kiểm tra", lý do "có ở nhiều trang";
  - 1 trang, trùng trang AI ghi: "đã khớp";
  - 1 trang, khác trang AI ghi: "đã sửa số trang", và số trang đổi theo trang tìm thấy.

Một câu xuất hiện hai lần **trong cùng một trang** vẫn tính là 1 trang, vì skill đếm số trang chứ không đếm số lần.

### Phần 5. Kiểm tra các ô của một bài (`verifyCells`)

Đây là hàm mà các phần khác của app sẽ gọi.

1. **Cắt tài liệu tham khảo** bằng đúng hàm đã dùng trước khi gửi bài cho AI. Nhờ vậy, câu AI trích từ danh mục tài liệu sẽ không tìm thấy trong bài, và thành "cần kiểm tra". Đây là cách chặn trường hợp "câu có thật trong file nhưng lấy sai chỗ".
2. Với mỗi ô:
   - gắn cảnh báo dẫn nguồn khác (`cites_other_source`), dùng hàm ở `src/lib/cited-source.ts`;
   - **5a.** ô "không tìm thấy" hoặc ô sinh viên tự điền thì bỏ qua kiểm tra;
   - ô AI đề xuất thì chạy `verifyQuote`. Trang AI ghi ban đầu được giữ ở `ai_page`, kể cả khi code sửa số trang;
   - **5b.** nếu có lỗi bất kỳ giữa chừng: "cần kiểm tra", lý do `check_failed`. Lỗi không bao giờ được coi là đạt.

## Ví dụ chạy trên câu trả lời thật

Câu trả lời của Gemini (bản `gemini-3.5-flash-lite`) cho bài tiếng Việt, ngày 8/11/2026:

| Cột | AI ghi trang | Kết quả | Cảnh báo |
|---|---|---|---|
| Câu hỏi nghiên cứu | 1 | Đã khớp | |
| Phương pháp | 2 | Đã khớp | |
| Mẫu | 2 | Đã khớp | |
| Kết quả | 6 | Đã khớp | Dẫn nguồn khác ("Theo Vietnam Report (2022)…") |
| Hạn chế | 8 | Đã khớp | |

Bảng này cho thấy giới hạn của việc kiểm tra: code chỉ biết **câu có thật trong bài hay không**, không biết **câu có đúng ý cột không**. Ô Hạn chế "đã khớp", nhưng câu đó nói về hạn chế của doanh nghiệp, không phải hạn chế của nghiên cứu. Vì vậy sinh viên vẫn phải duyệt từng ô, và cảnh báo "dẫn nguồn khác" giúp nhắc ở những ô dễ sai.

## Những gì chưa xử lý

- **Chữ Latin bị tách trong PDF tiếng Trung**, ví dụ "Ｓｔｉ ｇ ｌｅｒ": khoảng trắng nằm giữa hai chữ cái nên vẫn được giữ, và câu sẽ thành "cần kiểm tra".
- **Chú thích cuối trang chen giữa câu vắt qua hai trang** (ví dụ chú thích "①…" của bài tiếng Trung nằm giữa cuối trang và đầu trang sau): chú thích không lặp lại ở nhiều trang nên không bị bỏ, và câu sẽ thành "cần kiểm tra".
- **Dòng đầu trang, chân trang ở bài dưới 3 trang**: không nhận ra được.
- **Số chỉ dẫn dính vào một chữ cái đơn** (ví dụ "R2"): không bị coi là số chỉ dẫn, để không đụng tới các ký hiệu như R² trong bảng.

## Chạy test

```
npm test
```

Nhóm test dùng chữ thật cần 3 file PDF trong `samples/`. Máy không có các file này thì nhóm test đó tự bỏ qua và ghi là "skipped".
