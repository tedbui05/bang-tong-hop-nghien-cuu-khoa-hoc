// Xem bằng chứng của một ô: mở trang nào, tô đoạn nào, ghi chú gì. Code thường, dùng kết quả của verify-quote.ts.
import { STATUS_LABELS } from "./sheet";
import { getLabelKey, type AiCell, type LabelKey, type TextRange } from "./types";

export const UNKNOWN_POSITION_NOTE = "Không xác định được vị trí câu trích, hãy tự tìm trong trang";
export const NOT_MARKED_NOTE = "Không tô được vị trí câu trích trong trang này, hãy tự tìm trong trang";

export type EvidenceView = {
  label: LabelKey;
  // Trang cần mở (đếm từ 1 theo file PDF). null: ô không có câu trích.
  page: number | null;
  // Các đoạn cần tô vàng. Rỗng: không tô.
  ranges: TextRange[];
  note: string | null;
};

export function evidenceView(cell: AiCell): EvidenceView {
  const label = getLabelKey(cell);
  if (label === "not_found" || label === "manual" || !cell.quote_original) return { label, page: null, ranges: [], note: null };
  // "Cần kiểm tra": mở trang AI ghi, không tô, vì không biết câu nằm ở đâu.
  if (label === "needs_review") return { label, page: cell.ai_page ?? cell.page, ranges: [], note: UNKNOWN_POSITION_NOTE };
  // "Đã sửa số trang": cell.page đã là trang code tìm thấy.
  const ranges = cell.quote_ranges ?? [];
  return { label, page: cell.page, ranges, note: ranges.length ? null : NOT_MARKED_NOTE };
}

// Nhãn bằng chứng nhỏ, ví dụ "tr. 9 · đã khớp". Ô "không tìm thấy" và ô tự điền không có nhãn này.
export function evidenceLabel(cell: AiCell): string | null {
  const view = evidenceView(cell);
  if (view.page === null) return null;
  return `tr. ${view.page} · ${STATUS_LABELS[view.label]}`;
}

// Cắt chữ của trang thành các đoạn thường và đoạn tô.
export function splitByRanges(text: string, page: number, ranges: TextRange[]): { text: string; marked: boolean }[] {
  const own = ranges
    .filter((range) => range.page === page)
    .map((range) => ({ start: Math.max(0, range.start), end: Math.min(text.length, range.end) }))
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start);
  const parts: { text: string; marked: boolean }[] = [];
  let at = 0;
  for (const range of own) {
    if (range.start < at) continue;
    if (range.start > at) parts.push({ text: text.slice(at, range.start), marked: false });
    parts.push({ text: text.slice(range.start, range.end), marked: true });
    at = range.end;
  }
  if (at < text.length) parts.push({ text: text.slice(at), marked: false });
  return parts;
}
