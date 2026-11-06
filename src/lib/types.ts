// Kết quả kiểm tra câu trích. Ở bản xem thử, giá trị này được gán tay trong dữ liệu mẫu.
export type CheckResult = "verified" | "page_corrected" | "needs_review";

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
  // Vì sao ô bị đánh dấu "cần kiểm tra".
  review_reason?: "too_short" | "multi_page";
};

export type ReviewStatus = "pending" | "confirmed" | "edited";

// Một ô đang được người dùng duyệt. suggested_value giữ nguyên lời AI đề xuất.
export type ReviewCell = AiCell & {
  suggested_value: string;
  review: ReviewStatus;
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
};

// Ô không có bản ghi trong cells (hoặc thiếu trong info) nghĩa là "chưa điền".
export type SavedPaper = Paper & { cells: ReviewCell[] };

export type TableColumn = {
  id: string;
  name: string;
  // "AI cần tìm gì cho cột này". Dòng này sẽ được gửi cho AI.
  description: string;
  kind: "info" | "content";
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
};

export type LabelKey = CheckResult | "not_found" | "manual";

export function getReviewReason(cell: AiCell): string {
  if (cell.review_reason === "too_short") {
    return "Câu trích quá ngắn nên chưa đủ căn cứ. Hãy đối chiếu với bài gốc.";
  }
  if (cell.review_reason === "multi_page") {
    return "Câu này có ở nhiều trang nên chưa biết đúng trang nào. Hãy đối chiếu với bài gốc.";
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
