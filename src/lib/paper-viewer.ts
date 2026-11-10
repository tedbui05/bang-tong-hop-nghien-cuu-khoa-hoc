// Xem cả bài (nút "Mở bài gốc"): danh sách câu trích để bấm nhảy tới, và đường dẫn mở file trong tab mới.
// File PDF chỉ nằm trong trình duyệt (IndexedDB), không gửi lên máy chủ.
import { evidenceView } from "./evidence";
import type { AiCell, TableColumn } from "./types";

export type QuoteRef = { cell: AiCell; columnName: string };

// Các ô có câu trích và có trang để mở, theo thứ tự cột của bảng. Ô "không tìm thấy", ô tự điền thì không có.
export function quoteList(cells: AiCell[], columns: Pick<TableColumn, "id" | "name">[]): QuoteRef[] {
  return columns.flatMap((column) => {
    const cell = cells.find((item) => item.column === column.id);
    if (!cell || evidenceView(cell).page === null) return [];
    return [{ cell, columnName: column.name }];
  });
}

// Trình xem PDF của trình duyệt hiểu "#page=N" để mở sẵn ở trang đó.
export function pdfTabUrl(objectUrl: string, page: number | null): string {
  return page && page > 1 ? `${objectUrl}#page=${page}` : objectUrl;
}
