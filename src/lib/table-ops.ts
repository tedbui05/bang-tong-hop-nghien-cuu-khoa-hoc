// Các thao tác với bảng và bài không cần giao diện: bảng khởi đầu, xoá bài có hoàn tác, xoá bảng.
// Code thường, có test ở table-ops.test.ts.
import type { SavedPaper, SheetTable } from "./types";

// Bài mẫu của các bản cũ, không còn trong app (người dùng chọn bỏ hết bài mẫu ngày 10/11/2026):
// - Bảng mẫu tự tạo cho mọi người, với 7 bài báo thật có sẵn.
// - Bài minh hoạ "Xem bài mẫu" ở trang duyệt (bài Bloom 2013, không có file PDF), lưu được vào bảng bất kỳ.
// - Bài mẫu do app tạo (nút "Tải bài mẫu để thử"), nhận ra bằng tên file.
export const LEGACY_SAMPLE_TABLE_ID = "bang-mau";
const LEGACY_SAMPLE_PAPER_IDS = new Set(["banerjee-2013", "autor-2012", "chetty-2015", "nguyen-2025", "ho-2016", "wang-2018", "zhou-2021"]);
const LEGACY_REVIEW_TITLE = "Does Working from Home Work? Evidence from a Chinese Experiment";
export const LEGACY_APP_SAMPLE_FILE = "bai-mau-do-app-tao.pdf";

export function isLegacySamplePaper(paper: SavedPaper, tableId: string): boolean {
  if (tableId === LEGACY_SAMPLE_TABLE_ID && LEGACY_SAMPLE_PAPER_IDS.has(paper.id)) return true;
  if (paper.file?.name === LEGACY_APP_SAMPLE_FILE) return true;
  return !paper.file && paper.info.title === LEGACY_REVIEW_TITLE;
}

// Bảng lúc mở app (cả bản trình duyệt lẫn bản máy chủ): bỏ mọi bài mẫu của bản cũ. Bảng mẫu còn bài người dùng
// tự thêm thì giữ bảng với các bài đó; không còn bài nào thì bỏ cả bảng. Bảng khác không bị bỏ dù trống.
// Trả về đúng mảng cũ khi không có gì để bỏ.
export function startingTables(saved: SheetTable[]): SheetTable[] {
  let changed = false;
  const next = saved.flatMap((table) => {
    const papers = table.papers.filter((paper) => !isLegacySamplePaper(paper, table.id));
    const sampleDescription = table.id === LEGACY_SAMPLE_TABLE_ID && Boolean(table.description?.startsWith("Dữ liệu minh hoạ"));
    if (papers.length === table.papers.length && !(table.id === LEGACY_SAMPLE_TABLE_ID && (!papers.length || sampleDescription))) return [table];
    changed = true;
    if (table.id !== LEGACY_SAMPLE_TABLE_ID) return [{ ...table, papers }];
    if (!papers.length) return [];
    // Bỏ dòng mô tả "Dữ liệu minh hoạ từ 7 bài báo thật…" vì bảng không còn bài minh hoạ nào.
    return [{ ...table, papers, description: table.description?.startsWith("Dữ liệu minh hoạ") ? "" : table.description }];
  });
  return changed ? next : saved;
}

// Phần đã xoá, đủ để hoàn tác: bài kèm vị trí cũ trong bảng.
export type RemovedPapers = { tableId: string; items: { index: number; paper: SavedPaper }[] };

export function removePapers(table: SheetTable, ids: string[]): { table: SheetTable; removed: RemovedPapers } {
  const wanted = new Set(ids);
  const items = table.papers.flatMap((paper, index) => (wanted.has(paper.id) ? [{ index, paper }] : []));
  return {
    table: { ...table, papers: table.papers.filter((paper) => !wanted.has(paper.id)) },
    removed: { tableId: table.id, items },
  };
}

// Chèn lại các bài đã xoá vào đúng vị trí cũ (theo thứ tự tăng dần, nên vị trí trước không làm lệch vị trí sau).
// Bài nào đã có lại trong bảng thì bỏ qua, để hoàn tác hai lần không nhân đôi bài.
export function restorePapers(table: SheetTable, removed: RemovedPapers): SheetTable {
  if (table.id !== removed.tableId) return table;
  const papers = [...table.papers];
  const present = new Set(papers.map((paper) => paper.id));
  for (const { index, paper } of [...removed.items].sort((a, b) => a.index - b.index)) {
    if (present.has(paper.id)) continue;
    papers.splice(Math.min(index, papers.length), 0, paper);
    present.add(paper.id);
  }
  return { ...table, papers };
}

// Bảng mở tiếp sau khi xoá một bảng: bảng đứng ngay sau nó, không có thì bảng trước, hết bảng thì null.
export function nextActiveAfterDelete(tables: SheetTable[], deletedId: string): string | null {
  const index = tables.findIndex((table) => table.id === deletedId);
  const rest = tables.filter((table) => table.id !== deletedId);
  if (!rest.length) return null;
  return rest[Math.min(Math.max(index, 0), rest.length - 1)].id;
}
