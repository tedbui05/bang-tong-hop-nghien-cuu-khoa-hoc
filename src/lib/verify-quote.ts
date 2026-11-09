// Kiểm tra câu trích AI đưa ra có thật trong bài không, bằng code thường, không dùng AI.
// Làm đúng theo skill citation-check. Giải thích từng bước: docs/kiem-tra-cau-trich.md.
import { citesOtherSource } from "./cited-source";
import type { PdfPage } from "./pdf-read";
import { stripReferences } from "./strip-references";
import type { AiCell, CheckResult } from "./types";

// ---------------------------------------------------------------------------
// Phần 1. Các con số tạm
// ---------------------------------------------------------------------------

// Câu trích ngắn hơn số ký tự này (sau khi chuẩn hoá) thì luôn "cần kiểm tra":
// câu quá ngắn như "n = 412" dễ trùng ngẫu nhiên nên không đủ làm căn cứ. Số tạm, chỉnh sau buổi thử thật.
export const MIN_QUOTE_CHARS = 15;

export type QuoteCheck = { check: CheckResult; page: number | null; review_reason?: AiCell["review_reason"] };

// ---------------------------------------------------------------------------
// Phần 2. Chuẩn hoá chữ để so sánh
// Chỉ dùng để so sánh. Câu hiển thị và câu lưu vào bảng luôn là bản gốc.
// ---------------------------------------------------------------------------

// Các kiểu dấu ngoặc kép và gạch khác nhau được coi là một, vì AI hay chép “ ” thành " ", – thành -.
const DOUBLE_QUOTES = /[“”„‟«»″"]/g;
const SINGLE_QUOTES = /[‘’‚‛′`']/g;
const DASHES = /[‐‑‒–—―−]/g;

// Gạch nối ở cuối dòng: "advan-\ntage". Xử lý trước khi gộp khoảng trắng, vì cần biết chỗ xuống dòng.
const LINE_END_HYPHEN = /-[ \t]*\n\s*/g;

// Khoảng trắng nằm cạnh chữ Hán hoặc dấu câu kiểu Trung ("、", "。"): PDF tiếng Trung hay chèn khoảng trắng
// và xuống dòng giữa các chữ, còn AI thì chép liền. Bỏ đi ở cả câu trích lẫn chữ của bài.
const CJK = String.raw`\p{Script=Han}\u3000-\u303F`;
const SPACE_NEAR_CJK = new RegExp(String.raw`\s+(?=[${CJK}])|(?<=[${CJK}])\s+`, "gu");

// Khoảng trắng nằm giữa hai ký tự đều không phải chữ cái (chữ số, dấu câu, ký hiệu).
// PDF tiếng Trung hay chen khoảng trắng kiểu "26. 7% － 39. 4%", còn AI chép liền "26.7%-39.4%".
// Bỏ ở cả hai phía nên không làm câu đúng thành sai; khoảng trắng cạnh chữ cái ("by 13%") vẫn giữ.
const GAP_BETWEEN_SYMBOLS = /(?<=[^\p{L}\s])\s+(?=[^\p{L}\s])/gu;

// ---------------------------------------------------------------------------
// Phần 2b. Số chỉ dẫn nhỏ dính vào chữ
// Bài tiếng Anh hay đánh số tài liệu bằng chữ số nhỏ ở trên dòng. Khi đọc từ PDF, số này dính vào chữ:
// "returns.11 However", "change,1–3 which", "Pearson29 explained". AI thường chép câu không có số này.
// ---------------------------------------------------------------------------

// Chỉ coi là số chỉ dẫn khi dãy số (có thể dạng "14,15" hay "1-3"):
//   - dính ngay sau một từ Latin từ 2 chữ cái trở lên ("pearson29", "li46"), hoặc ngay sau dấu câu mà trước
//     dấu câu là chữ Latin hay dấu đóng ngoặc ("returns.11", "change,1-3"). Vì vậy "14.6" hay "0.5" không bị
//     đụng tới (trước dấu chấm là chữ số), và số đứng sau chữ Hán ("提高了26.7%") cũng không;
//   - và ngay sau dãy số là khoảng trắng, dấu câu hoặc hết dòng, nhưng không phải phần thập phân (".7"):
//     nên "13%", "2sls", "26.7" không bị đụng tới.
// Số đứng sau khoảng trắng ("by 13%", "442 firms") không bao giờ bị coi là số chỉ dẫn.
const CITATION_MARK =
  /(?<=\p{Script=Latin}{2}|[\p{Script=Latin})\]"'][.,;:])\d{1,3}(?:[,-]\d{1,3})*(?=[\s.,;:)]|$)(?![.,]\s?\d)/gu;

// Việc bỏ số chỉ dẫn chạy TRƯỚC khi bỏ khoảng trắng (xem normalizeForMatch). Nếu làm sau, câu thật
// "in GI. 10 firms" sẽ bị ghép thành "gi.10" và con số thật 10 bị coi nhầm là số chỉ dẫn.

export type NormalizeOptions = {
  // true: "high-\npoverty" thành "high-poverty" (giữ gạch nối). false (mặc định): thành "highpoverty".
  keepHyphen?: boolean;
  // true: bỏ số chỉ dẫn dính vào chữ. Chỉ dùng cho chữ của bài, để tạo thêm một bản để tìm.
  dropCitationMarks?: boolean;
};

export function normalizeForMatch(text: string, options: NormalizeOptions = {}): string {
  // Bước 1. NFKC và chữ thường: "ﬁ" thành "fi", "，" thành ",", dấu tiếng Việt về cùng một dạng, "A" thành "a".
  let t = text.normalize("NFKC").toLowerCase();
  // Bước 2. Các kiểu ngoặc kép, ngoặc đơn, gạch ngang về một kiểu.
  t = t.replace(DOUBLE_QUOTES, '"').replace(SINGLE_QUOTES, "'").replace(DASHES, "-");
  // Bước 3. Nối từ bị ngắt bằng gạch nối cuối dòng.
  t = t.replace(LINE_END_HYPHEN, options.keepHyphen ? "-" : "");
  // Bước 4. (Chỉ khi được yêu cầu) bỏ số chỉ dẫn. Phải làm trước bước 5, khi khoảng trắng còn nguyên.
  if (options.dropCitationMarks) t = t.replace(CITATION_MARK, "");
  // Bước 5. Bỏ khoảng trắng mà PDF tiếng Trung chen vào giữa chữ Hán, giữa các con số và dấu câu.
  t = t.replace(SPACE_NEAR_CJK, "").replace(GAP_BETWEEN_SYMBOLS, "");
  // Bước 6. Gộp mọi khoảng trắng, xuống dòng thành một dấu cách.
  return t.replace(/\s+/g, " ").trim();
}

// Mỗi trang có đúng 4 bản để tìm, luôn theo cùng thứ tự: bỏ gạch nối, bỏ gạch nối và số chỉ dẫn,
// giữ gạch nối, giữ gạch nối và bỏ số chỉ dẫn. Câu trích khớp một trong các bản là khớp.
// Không bản nào thêm chữ vào bài, nên câu bịa vẫn không khớp.
// Giữ đủ 4 bản kể cả khi trùng nhau, vì ở chỗ nối hai trang phải so bản thứ n của trang này với bản thứ n của trang kia.
function variants(text: string): string[] {
  return [false, true].flatMap((keepHyphen) => [
    normalizeForMatch(text, { keepHyphen }),
    normalizeForMatch(text, { keepHyphen, dropCitationMarks: true }),
  ]);
}

// ---------------------------------------------------------------------------
// Phần 2c. Dòng đầu trang và chân trang
// Tên tạp chí, tên tác giả, số trang in lặp lại ở đầu hoặc cuối mỗi trang. Khi một câu vắt qua hai trang,
// dòng này chen vào giữa câu ("…trong các doanh" | "P.Q. Hai et al. / VNU Journal… 28-3730" | "nghiệp logistics…")
// nên câu đúng không khớp. Code nhận ra các dòng này và bỏ đi, CHỈ khi so ở chỗ nối hai trang.
// Chữ của bài và chữ hiển thị không đổi.
// ---------------------------------------------------------------------------

// Xem mấy dòng ở đầu và ở cuối mỗi trang.
const EDGE_LINES = 3;
// Một dòng phải lặp lại ở đầu hoặc cuối của ít nhất chừng này trang mới coi là đầu trang, chân trang.
// Bài ít trang hơn số này thì không áp dụng.
const MIN_EDGE_REPEATS = 3;

// Khoá để so hai dòng: chuẩn hoá như câu trích, rồi coi mỗi dãy số liền nhau (kể cả số trang dính vào như
// "28-37 29", "28-3730") là một ký hiệu "#". Nhờ vậy dòng đầu trang ở các trang khác nhau có cùng khoá.
function edgeKey(line: string): string {
  return normalizeForMatch(line).replace(/\d+(?:[\s\-–]*\d+)*/g, "#");
}

function nonEmptyLines(text: string): string[] {
  return text.split("\n").filter((line) => line.trim());
}

// Trả về khoá của các dòng đầu trang, chân trang của bài.
export function findRepeatedEdgeLines(pages: PdfPage[]): Set<string> {
  const repeated = new Set<string>();
  if (pages.length < MIN_EDGE_REPEATS) return repeated;

  // Đếm mỗi khoá có ở đầu hoặc cuối của bao nhiêu trang (mỗi trang tính một lần).
  const pageCount = new Map<string, number>();
  for (const page of pages) {
    const lines = nonEmptyLines(page.text);
    const edges = [...lines.slice(0, EDGE_LINES), ...lines.slice(-EDGE_LINES)];
    for (const key of new Set(edges.map(edgeKey))) pageCount.set(key, (pageCount.get(key) ?? 0) + 1);
  }
  for (const [key, count] of pageCount) if (key && count >= MIN_EDGE_REPEATS) repeated.add(key);
  return repeated;
}

// Bỏ các dòng đầu trang, chân trang nằm sát mép trang: ở cuối trang (side "end") hoặc đầu trang (side "start").
// Chỉ bỏ những dòng liền nhau tính từ mép; gặp dòng nội dung đầu tiên thì dừng.
function trimEdge(text: string, edgeKeys: Set<string>, side: "start" | "end"): string {
  const lines = text.split("\n");
  const isEdge = (line: string) => !line.trim() || edgeKeys.has(edgeKey(line));
  if (side === "start") {
    let from = 0;
    while (from < lines.length && from < EDGE_LINES * 2 && isEdge(lines[from])) from++;
    return lines.slice(from).join("\n");
  }
  let to = lines.length;
  while (to > 0 && lines.length - to < EDGE_LINES * 2 && isEdge(lines[to - 1])) to--;
  return lines.slice(0, to).join("\n");
}

// ---------------------------------------------------------------------------
// Phần 3. Tìm câu trích trong từng trang và ở chỗ nối hai trang
// ---------------------------------------------------------------------------

// Đếm số lần câu xuất hiện trong một đoạn chữ.
function countIn(haystack: string, needle: string): number {
  let count = 0;
  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + 1)) count++;
  return count;
}

// Trả về danh sách số trang có câu trích. Câu vắt qua hai trang tính là trang bắt đầu.
function findPages(quote: string, pages: PdfPage[]): number[] {
  const found = new Set<number>();
  const texts = pages.map((page) => page.text);
  const edgeKeys = findRepeatedEdgeLines(pages);

  for (let i = 0; i < pages.length; i++) {
    const own = variants(texts[i]);
    // 3a. Câu nằm gọn trong trang này.
    if (own.some((text) => text.includes(quote))) found.add(pages[i].page);

    // 3b. Câu vắt qua chỗ nối với trang sau. Ghép hai trang trước rồi mới chuẩn hoá, để từ bị ngắt
    // ở cuối trang vẫn được nối. Chỉ tính khi ghép lại thấy NHIỀU lần hơn tổng hai trang riêng lẻ,
    // tức là có ít nhất một lần câu thật sự nằm vắt qua ranh giới, để không đếm trùng.
    // Ghép hai cách: nguyên văn, và bỏ chân trang của trang này cùng đầu trang của trang sau (Phần 2c).
    if (i + 1 < pages.length) {
      const next = variants(texts[i + 1]);
      const joins = [
        `${texts[i]}\n${texts[i + 1]}`,
        `${trimEdge(texts[i], edgeKeys, "end")}\n${trimEdge(texts[i + 1], edgeKeys, "start")}`,
      ];
      const crosses = joins.some((join) =>
        variants(join).some((text, v) => countIn(text, quote) > countIn(own[v], quote) + countIn(next[v], quote)),
      );
      if (crosses) found.add(pages[i].page);
    }
  }
  return [...found];
}

// ---------------------------------------------------------------------------
// Phần 4. Ra kết quả cho một câu trích
// ---------------------------------------------------------------------------

export function verifyQuote(quote: string, aiPage: number | null, pages: PdfPage[]): QuoteCheck {
  const normalized = normalizeForMatch(quote);

  // 4a. Câu quá ngắn: cần kiểm tra, dù tìm thấy ở đâu.
  if (normalized.length < MIN_QUOTE_CHARS) return { check: "needs_review", page: aiPage, review_reason: "too_short" };

  // Câu trích cũng có thể có gạch nối cuối dòng nếu AI chép cả chỗ xuống dòng: thử cả hai cách.
  const quoteForms = new Set([normalized, normalizeForMatch(quote, { keepHyphen: true })]);
  const found = new Set<number>();
  for (const form of quoteForms) for (const page of findPages(form, pages)) found.add(page);

  // 4b. Đếm số trang có câu đó.
  if (found.size === 0) return { check: "needs_review", page: aiPage }; // không có ở đâu
  if (found.size > 1) return { check: "needs_review", page: aiPage, review_reason: "multi_page" }; // nhiều trang
  const [page] = found;
  if (page === aiPage) return { check: "verified", page }; // đúng trang AI ghi
  return { check: "page_corrected", page }; // đúng một trang khác: sửa theo trang tìm thấy
}

// ---------------------------------------------------------------------------
// Phần 5. Kiểm tra các ô của một bài
// ---------------------------------------------------------------------------

// pages là chữ của bài như đọc từ PDF. Hàm tự cắt tài liệu tham khảo bằng đúng cách đã dùng trước khi gửi AI,
// nên câu AI trích từ danh mục tài liệu sẽ không tìm thấy và thành "cần kiểm tra".
export function verifyCells(cells: AiCell[], pages: PdfPage[]): AiCell[] {
  let bodyPages: PdfPage[] | null = null;
  try {
    bodyPages = stripReferences(pages).pages;
  } catch {
    bodyPages = null; // lỗi khi đọc chữ của bài: mọi ô cần kiểm tra, xem bên dưới
  }

  return cells.map((cell): AiCell => {
    const cites_other_source = citesOtherSource(cell.quote_original);

    // 5a. Ô "không tìm thấy" và ô sinh viên tự điền: bỏ qua kiểm tra, không tính là cần kiểm tra.
    if (cell.status !== "proposed") return { ...cell, cites_other_source };

    // AI ghi trang nào thì giữ lại ở ai_page, kể cả khi code sửa số trang.
    const ai_page = cell.ai_page ?? cell.page;
    try {
      if (!bodyPages) throw new Error("không đọc được chữ của bài");
      const result = verifyQuote(cell.quote_original ?? "", ai_page, bodyPages);
      return { ...cell, ai_page, page: result.page, check: result.check, review_reason: result.review_reason, cites_other_source };
    } catch {
      // 5b. Kiểm tra bị lỗi giữa chừng: cần kiểm tra, không bao giờ coi là đạt.
      return { ...cell, ai_page, check: "needs_review", review_reason: "check_failed", cites_other_source };
    }
  });
}
