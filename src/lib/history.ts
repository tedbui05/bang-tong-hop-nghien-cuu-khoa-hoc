// Hoàn tác và làm lại, giống Google Sheets. Mỗi thao tác lưu bản chụp bảng trước và sau khi làm.
// Bảng là dữ liệu bất biến (mỗi lần đổi tạo object mới), nên giữ bản chụp không tốn chép lại phần không đổi.
// Chỉ giữ trong phiên làm việc (bộ nhớ), không lưu lên máy chủ. Code thường, có test ở history.test.ts.
import type { SheetTable } from "./types";

// Giữ tối đa chừng này thao tác cho mỗi bảng. SỐ TẠM, chỉnh sau khi thử thật.
export const HISTORY_LIMIT = 50;

export type HistoryEntry = {
  id: number;
  // Tên thao tác, hiện ở nút: "Hoàn tác: xoá cột Hạn chế".
  label: string;
  tableId: string;
  // null: bảng chưa có (trước) hoặc đã bị xoá (sau).
  before: SheetTable | null;
  after: SheetTable | null;
  // Vị trí của bảng trong danh sách, để hoàn tác xoá bảng thì đưa bảng về đúng chỗ.
  index: number;
  // "Lưu vào bảng": hoàn tác thì bài quay về chờ duyệt (store giữ phần chờ duyệt này).
  reviewId?: string;
};

export type History = { undo: HistoryEntry[]; redo: HistoryEntry[] };

export const emptyHistory = (): History => ({ undo: [], redo: [] });

// Thao tác mới: thêm vào ngăn hoàn tác, bỏ ngăn làm lại, cắt bớt thao tác cũ nhất nếu quá giới hạn.
export function pushEntry(history: History, entry: HistoryEntry, limit = HISTORY_LIMIT): History {
  const undo = [...history.undo, entry];
  return { undo: undo.length > limit ? undo.slice(undo.length - limit) : undo, redo: [] };
}

export function takeUndo(history: History): { history: History; entry: HistoryEntry } | null {
  const entry = history.undo.at(-1);
  if (!entry) return null;
  return { entry, history: { undo: history.undo.slice(0, -1), redo: [...history.redo, entry] } };
}

export function takeRedo(history: History): { history: History; entry: HistoryEntry } | null {
  const entry = history.redo.at(-1);
  if (!entry) return null;
  return { entry, history: { undo: [...history.undo, entry], redo: history.redo.slice(0, -1) } };
}

// Độ rộng cột không phải thao tác hoàn tác được: giữ độ rộng đang dùng khi đưa bảng về bản chụp cũ.
function keepWidths(target: SheetTable, current: SheetTable | undefined): SheetTable {
  if (!current) return target;
  const widths = new Map(current.columns.map((column) => [column.id, column.width]));
  return {
    ...target,
    columns: target.columns.map((column) => (widths.has(column.id) ? { ...column, width: widths.get(column.id) } : column)),
  };
}

// Đưa danh sách bảng về trạng thái trước (hoàn tác) hoặc sau (làm lại) của một thao tác.
export function applyEntry(tables: SheetTable[], entry: HistoryEntry, direction: "undo" | "redo"): SheetTable[] {
  const target = direction === "undo" ? entry.before : entry.after;
  const current = tables.find((table) => table.id === entry.tableId);
  if (!target) return tables.filter((table) => table.id !== entry.tableId);
  if (current) return tables.map((table) => (table.id === entry.tableId ? keepWidths(target, current) : table));
  const next = [...tables];
  next.splice(Math.min(Math.max(entry.index, 0), next.length), 0, target);
  return next;
}

// Chữ trên nút và trong gợi ý khi rê chuột.
export function undoTitle(history: History | undefined): string {
  const entry = history?.undo.at(-1);
  return entry ? `Hoàn tác: ${entry.label}` : "Không còn gì để hoàn tác";
}

export function redoTitle(history: History | undefined): string {
  const entry = history?.redo.at(-1);
  return entry ? `Làm lại: ${entry.label}` : "Không còn gì để làm lại";
}

// Cmd/Ctrl+Z là hoàn tác, Cmd/Ctrl+Shift+Z (hoặc Ctrl+Y) là làm lại. Đang gõ trong ô chữ thì để trình duyệt tự
// hoàn tác chữ trong ô đó.
export function historyShortcut(event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">, typing: boolean): "undo" | "redo" | null {
  if (typing || event.altKey || !(event.metaKey || event.ctrlKey)) return null;
  const key = event.key.toLowerCase();
  if (key === "z") return event.shiftKey ? "redo" : "undo";
  if (key === "y" && event.ctrlKey && !event.metaKey) return "redo";
  return null;
}

// Phần tử đang nhận phím là ô gõ chữ (ô nhập, ô sửa trong bảng, ghi chú...): Cmd+Z thuộc về ô đó.
const NOT_TYPING = new Set(["checkbox", "radio", "button", "submit", "reset", "file", "range", "color"]);

export function isTypingTarget(element: { tagName: string; type?: string; isContentEditable?: boolean } | null): boolean {
  if (!element) return false;
  if (element.isContentEditable) return true;
  if (element.tagName === "TEXTAREA") return true;
  return element.tagName === "INPUT" && !NOT_TYPING.has(element.type ?? "text");
}
