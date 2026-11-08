// Bỏ phần tài liệu tham khảo trước khi gửi bài cho AI. Luôn cắt, không chỉ khi bài dài:
// nếu AI trích một câu trong danh mục tài liệu, code kiểm tra vẫn thấy câu đó có trong bài
// và báo "đã khớp" dù AI lấy sai chỗ. Cắt từ đầu thì câu đó không còn trong bài để khớp.
// Số trang của phần còn lại giữ nguyên; bước kiểm tra câu trích cũng phải dùng bản đã cắt.
import type { PdfPage } from "./pdf-read";

// Chỉ tìm tiêu đề trong 40% cuối bài, để không nhầm với mục lục hay phần mở đầu.
export const REFERENCES_SEARCH_SHARE = 0.4;

// Sau khi cắt, bài dài hơn số ký tự này thì không gửi. Số tạm (khoảng 25.000 đến 30.000 token),
// sẽ chỉnh sau buổi thử thật.
export const MAX_PAPER_CHARS = 100_000;

// Tiêu đề phải đứng riêng một dòng, có thể có số mục ở trước ("7. References") hoặc dấu hai chấm ở sau.
// Chữ "References" nằm giữa câu thì không tính.
const SECTION_NUMBER = String.raw`(?:(?:\d+|[IVXLC]+)[.)]?\s+)?`;
const REFERENCES_HEADING = new RegExp(
  String.raw`^${SECTION_NUMBER}(?:references?|bibliography|tài liệu tham khảo|参\s*考\s*文\s*献)\s*[:：]?$`,
  "iu",
);
// Phụ lục thường có ký hiệu và tên đi kèm: "Appendix A. Variable definitions", "Phụ lục 1: Bảng hỏi".
const APPENDIX_HEADING = new RegExp(
  String.raw`^${SECTION_NUMBER}(?:appendix|appendices|phụ lục|附\s*录)(?:$|[\s.:：\-–—(])`,
  "iu",
);
// Dòng dài hơn thế này là một câu văn, không phải tiêu đề phụ lục.
const MAX_HEADING_LENGTH = 100;

export type StripResult = {
  pages: PdfPage[];
  // Trang có tiêu đề tài liệu tham khảo và trang cuối cùng bị cắt; null nếu không cắt gì.
  removed: { fromPage: number; toPage: number } | null;
};

// offset: vị trí đầu dòng tính trên cả bài (các trang nối liền nhau).
type Line = { offset: number; text: string };

function splitLines(pages: PdfPage[]): { lines: Line[]; total: number } {
  const lines: Line[] = [];
  let offset = 0;
  for (const page of pages) {
    let start = 0;
    for (const text of page.text.split("\n")) {
      lines.push({ offset: offset + start, text });
      start += text.length + 1;
    }
    offset += page.text.length;
  }
  return { lines, total: offset };
}

// Chuẩn hoá chỉ để so tiêu đề: chữ tiếng Việt có thể ở dạng dấu tổ hợp.
function headingText(line: string) {
  return line.normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function stripReferences(pages: PdfPage[]): StripResult {
  const { lines, total } = splitLines(pages);
  const searchFrom = total * (1 - REFERENCES_SEARCH_SHARE);

  const refIndex = lines.findIndex((line) => line.offset >= searchFrom && REFERENCES_HEADING.test(headingText(line.text)));
  if (refIndex === -1) return { pages, removed: null };

  const appendixIndex = lines.findIndex((line, i) => {
    if (i <= refIndex) return false;
    const text = headingText(line.text);
    return text.length <= MAX_HEADING_LENGTH && APPENDIX_HEADING.test(text);
  });

  // Cắt từ đầu dòng tiêu đề tài liệu tham khảo đến ngay trước tiêu đề phụ lục, hoặc đến hết bài.
  // Tính theo vị trí ký tự trên cả bài rồi chia lại cho từng trang, nên số trang không đổi.
  const cutStart = lines[refIndex].offset;
  const cutEnd = appendixIndex === -1 ? total : lines[appendixIndex].offset;

  let pageStart = 0;
  let fromPage = 0;
  let toPage = 0;
  const result = pages.map((page): PdfPage => {
    const base = pageStart;
    pageStart += page.text.length;
    const a = Math.max(cutStart, base);
    const b = Math.min(cutEnd, pageStart);
    if (a >= b) return page;
    if (!fromPage) fromPage = page.page;
    toPage = page.page;
    return { page: page.page, text: page.text.slice(0, a - base) + page.text.slice(b - base) };
  });

  return { pages: result, removed: { fromPage, toPage } };
}

export function countPaperChars(pages: PdfPage[]) {
  return pages.reduce((sum, page) => sum + page.text.length, 0);
}

export function isPaperTooLong(pages: PdfPage[]) {
  return countPaperChars(pages) > MAX_PAPER_CHARS;
}
