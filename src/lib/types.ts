// Kết quả kiểm tra câu trích, do src/lib/verify-quote.ts tính bằng code thường.
// Dữ liệu mẫu của bản xem thử vẫn gán tay giá trị này.
export type CheckResult = "verified" | "page_corrected" | "needs_review";

import type { FillKey, TagColorKey, TextColorKey } from "./palette";

// Một ô AI đề xuất. Tên trường theo skill citation-check; column là mã cột, không phải tên cột,
// để đổi tên cột không làm mất dữ liệu.
export type AiCell = {
  column: string;
  value_vi: string;
  quote_original: string | null;
  quote_vi: string | null;
  page: number | null;
  // "manual": ô chưa có AI điền, sinh viên tự gõ. Không có câu trích và không qua bước kiểm tra.
  status: "proposed" | "not_found" | "manual";
  check: CheckResult | null;
  ai_page: number | null;
  // Vì sao ô bị đánh dấu "cần kiểm tra". Không có thì là "không thấy câu này trong bài".
  // "check_failed": việc kiểm tra bị lỗi giữa chừng.
  review_reason?: "too_short" | "multi_page" | "check_failed";
  // Câu trích có dấu hiệu dẫn nguồn khác. Là cảnh báo thêm, không thay thế kết quả kiểm tra.
  cites_other_source?: boolean;
  // Vị trí câu trích trong chữ gốc của trang (đã khớp hoặc đã sửa số trang), để tô vàng khi xem bằng chứng.
  // Câu vắt qua hai trang thì có hai đoạn. null: không xác định được vị trí.
  quote_ranges?: TextRange[] | null;
  // Ô "cần kiểm tra" vì câu có ở nhiều trang: các trang tìm thấy và vị trí để tô vàng ở từng trang.
  // Chỉ để hiển thị, không đổi kết quả kiểm tra. ranges null: không xác định được vị trí ở trang đó.
  page_matches?: { page: number; ranges: TextRange[] | null }[];
};

// Một đoạn chữ trong trang, tính theo vị trí ký tự trong chữ đọc từ PDF (pdf-read.ts).
export type TextRange = { page: number; start: number; end: number };

export type ReviewStatus = "pending" | "confirmed" | "edited";

// Một ô đang được người dùng duyệt. suggested_value giữ nguyên lời AI đề xuất.
export type ReviewCell = AiCell & {
  suggested_value: string;
  review: ReviewStatus;
  // Được xác nhận bằng nút "Duyệt nhanh cả dòng", để tách riêng khi đo chỉ số.
  quick?: boolean;
};

// Các cột thông tin bài. Riêng tên bài là bắt buộc để nhận biết dòng.
export type InfoKey = "title" | "authors" | "year" | "source" | "language";
export type PaperInfo = { title: string } & Partial<Record<Exclude<InfoKey, "title">, string>>;

export type Paper = {
  id: string;
  // Chỉ để trình duyệt hiển thị đúng phông, không phải một cột.
  language_code: string;
  info: PaperInfo;
  // Thông tin AI đề xuất ban đầu. Trường nào thiếu là chưa có đề xuất.
  suggested_info: PaperInfo;
  // Model AI đã điền bài này. Không có: bài mẫu của bản xem thử, chưa có AI điền.
  filled_by?: FilledBy;
  // File PDF gốc đã giữ trong trình duyệt (paper-files.ts). hash để biết file tải lại có đúng là file cũ không.
  file?: { name: string; size: number; hash: string };
};

// fallback: true khi model chính quá tải và bài được điền bằng model dự phòng.
export type FilledBy = { model: string; fallback: boolean };

// Dòng nhỏ ở màn hình duyệt. Model dự phòng dễ sai hơn ở các cột cần phân biệt tinh tế,
// nên nhắc sinh viên duyệt kỹ hơn.
export function filledByText(filledBy: FilledBy): string {
  if (!filledBy.fallback) return `Điền bởi ${filledBy.model}`;
  return `Điền bởi ${filledBy.model} (model dự phòng). Model này dễ sai hơn ở các cột cần phân biệt tinh tế, hãy duyệt kỹ từng ô.`;
}

// Định dạng do sinh viên tự làm. Không đổi nội dung nên không tính là "sửa ô" khi đo chỉ số.
export type CellFormat = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: TextColorKey;
  // null: ô này đã bỏ màu dù cả hàng có tô.
  fill?: FillKey | null;
};

// Đoạn được tô sáng, tính theo vị trí ký tự. Không đụng vào câu trích gốc.
export type Highlight = { field: "value" | "quote"; start: number; end: number };

// Ô không có bản ghi trong cells (hoặc thiếu trong info) nghĩa là "chưa điền".
export type SavedPaper = Paper & {
  cells: ReviewCell[];
  formats?: Record<string, CellFormat>;
  rowFill?: FillKey;
  highlights?: Record<string, Highlight[]>;
  // Ghi chú riêng của sinh viên, viết bằng Markdown. AI không bao giờ điền vào đây.
  note?: string;
  // Mã của các nhãn trong SheetTable.tags.
  tags?: string[];
};

export type TableTag = { id: string; name: string; color: TagColorKey };

export type TableColumn = {
  id: string;
  name: string;
  // "AI cần tìm gì cho cột này". Dòng này sẽ được gửi cho AI.
  description: string;
  // "note" và "tags" do sinh viên tự viết, AI không bao giờ điền.
  kind: "info" | "content" | "note" | "tags";
  infoKey?: InfoKey;
  visible: boolean;
  width?: number;
};

export type SheetTable = {
  id: string;
  name: string;
  // Một câu ngắn hiện trên thanh tiêu đề của bảng.
  description?: string;
  columns: TableColumn[];
  papers: SavedPaper[];
  tags?: TableTag[];
};

export type LabelKey = CheckResult | "not_found" | "manual";

// "trang 1 và trang 3", "trang 1, trang 3 và trang 5".
export function joinPages(pages: number[]): string {
  const names = pages.map((page) => `trang ${page}`);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} và ${names[names.length - 1]}` : (names[0] ?? "");
}

export function getReviewReason(cell: AiCell): string {
  if (cell.review_reason === "too_short") {
    return "Câu trích quá ngắn nên chưa đủ căn cứ. Hãy đối chiếu với bài gốc.";
  }
  if (cell.review_reason === "check_failed") {
    return "App chưa kiểm tra được câu này do có lỗi giữa chừng. Hãy đối chiếu với bài gốc.";
  }
  if (cell.review_reason === "multi_page") {
    const pages = cell.page_matches?.map((match) => match.page) ?? [];
    const where = pages.length > 1 ? `ở ${joinPages(pages)}` : "ở nhiều trang";
    return `Câu này có ${where} nên chưa biết đúng trang nào. Hãy đối chiếu với bài gốc.`;
  }
  return "App không thấy nguyên văn câu này trong bài. Hãy đối chiếu với bài gốc.";
}

export function isCellEdited(cell: ReviewCell): boolean {
  return cell.value_vi !== cell.suggested_value;
}

export function getLabelKey(cell: AiCell): LabelKey {
  if (cell.status === "not_found") return "not_found";
  if (cell.status === "manual") return "manual";
  // Thiếu kết quả kiểm tra thì không được coi là đạt.
  return cell.check ?? "needs_review";
}
