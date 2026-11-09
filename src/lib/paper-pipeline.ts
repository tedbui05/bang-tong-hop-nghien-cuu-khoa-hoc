// Ghép kết quả AI và kết quả kiểm tra câu trích thành một bài chờ duyệt. Code thường, không gọi AI.
import type { AiAnswer } from "./ai-answer";
import type { AiColumn } from "./ai-prompt";
import type { PdfPage } from "./pdf-read";
import { getLabelKey, type AiCell, type FilledBy, type Paper, type PaperInfo, type ReviewCell, type TableColumn } from "./types";

export type ReviewSession = {
  // Mã của bài trong hàng chờ, cũng là mã bài khi lưu vào bảng.
  id: string;
  tableId: string;
  paper: Paper;
  fileName: string | null;
  // Chữ của từng trang trong file vừa tải: để hiện chữ của trang và tô câu trích.
  pages: PdfPage[] | null;
  cells: ReviewCell[];
  infoConfirmed: boolean;
};

// Lỗi hiện trên dòng của bài trong hàng chờ. retry: có nút Thử lại.
export type QueueError = { title: string; detail: string; retry: boolean };

// Chỉ gửi cho máy chủ những gì câu lệnh cần.
export function aiColumns(columns: TableColumn[]): AiColumn[] {
  return columns.map(({ id, name, description, kind, infoKey }) => ({ id, name, description, kind, ...(infoKey ? { infoKey } : {}) }));
}

const LANGUAGE_CODES: [RegExp, string][] = [
  [/việt/i, "vi"],
  [/anh/i, "en"],
  [/trung|hoa/i, "zh"],
  [/nhật/i, "ja"],
  [/hàn/i, "ko"],
  [/pháp/i, "fr"],
  [/đức/i, "de"],
  [/nga/i, "ru"],
  [/tây ban nha/i, "es"],
];

// Mã ngôn ngữ chỉ để trình duyệt chọn đúng phông cho chữ của bài. Không có thì đoán theo chữ của bài.
export function languageCode(language: string | undefined, pages: PdfPage[] | null): string {
  const name = language?.normalize("NFC").trim();
  if (name) for (const [pattern, code] of LANGUAGE_CODES) if (pattern.test(name)) return code;
  const sample = (pages ?? []).map((page) => page.text).join(" ").slice(0, 5000);
  if ((sample.match(/\p{Script=Han}/gu)?.length ?? 0) > 50) return "zh";
  if (/[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i.test(sample.normalize("NFC"))) return "vi";
  return "en";
}

function titleFromFile(fileName: string): string {
  return fileName.replace(/\.pdf$/i, "").trim() || "Bài chưa có tên";
}

export type SessionInput = {
  id: string;
  tableId: string;
  columns: TableColumn[];
  fileName: string;
  file: Paper["file"];
  pages: PdfPage[];
  answer: AiAnswer;
  // Các ô đã qua verifyCells.
  checkedCells: AiCell[];
  filledBy: FilledBy;
};

export function buildReviewSession(input: SessionInput): ReviewSession {
  const { columns } = input;
  const contentIds = columns.filter((column) => column.kind === "content").map((column) => column.id);
  const byColumn = new Map(input.checkedCells.map((cell) => [cell.column, cell]));
  const cells: ReviewCell[] = contentIds
    .filter((id) => byColumn.has(id))
    .map((id) => {
      const cell = byColumn.get(id)!;
      return { ...cell, suggested_value: cell.value_vi, review: "pending" };
    });

  // AI không tìm được tên bài thì tạm lấy tên file; sinh viên sửa ở thẻ thông tin bài.
  const info: PaperInfo = { title: input.answer.info.title?.trim() || titleFromFile(input.fileName) };
  for (const column of columns) {
    if (!column.infoKey || column.infoKey === "title") continue;
    const value = input.answer.info[column.infoKey];
    if (value) info[column.infoKey] = value;
  }

  return {
    id: input.id,
    tableId: input.tableId,
    paper: {
      id: input.id,
      language_code: languageCode(input.answer.info.language, input.pages),
      info,
      suggested_info: { ...info },
      filled_by: input.filledBy,
      ...(input.file ? { file: input.file } : {}),
    },
    fileName: input.fileName,
    pages: input.pages,
    cells,
    infoConfirmed: false,
  };
}

// Bỏ các ô và thông tin bài của cột không còn trong bảng (ví dụ sinh viên xoá cột trong lúc AI đang đọc bài).
// Xoá cột là mất hẳn: thêm lại cột thì ô để trống, không được hiện lại dữ liệu cũ.
export function pruneToColumns(session: ReviewSession, columns: TableColumn[]): ReviewSession {
  const contentIds = new Set(columns.filter((column) => column.kind === "content").map((column) => column.id));
  const infoKeys = new Set(columns.map((column) => column.infoKey).filter(Boolean));
  const keep = (info: PaperInfo): PaperInfo => {
    const next: PaperInfo = { title: info.title };
    for (const key of ["authors", "year", "source", "language"] as const) if (infoKeys.has(key) && info[key] !== undefined) next[key] = info[key];
    return next;
  };
  return {
    ...session,
    cells: session.cells.filter((cell) => contentIds.has(cell.column)),
    paper: { ...session.paper, info: keep(session.paper.info), suggested_info: keep(session.paper.suggested_info) },
  };
}

// "Duyệt nhanh cả dòng" chỉ có khi mọi ô đều "đã khớp" và không có cảnh báo dẫn nguồn khác (docs/FLOW.md):
// một ô có nhãn khác, kể cả "không tìm thấy", là phải duyệt từng ô. Vẫn phải bấm nút, không tự duyệt.
export function canQuickApprove(cells: ReviewCell[]): boolean {
  return (
    cells.length > 0 &&
    cells.some((cell) => cell.review === "pending") &&
    cells.every((cell) => getLabelKey(cell) === "verified" && !cell.cites_other_source && cell.value_vi === cell.suggested_value)
  );
}

// Đổi kết quả sai của máy chủ (không đọc được, mất mạng) thành câu tiếng Việt.
export const NETWORK_ERROR: QueueError = {
  title: "Không kết nối được máy chủ",
  detail: "Hãy kiểm tra kết nối mạng rồi bấm Thử lại. Bài của bạn chưa bị mất.",
  retry: true,
};

export const SERVER_ERROR: QueueError = {
  title: "Máy chủ trả lời không đúng",
  detail: "Có lỗi khi nhận kết quả từ máy chủ. Hãy bấm Thử lại sau ít phút.",
  retry: true,
};
