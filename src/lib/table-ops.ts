// Các thao tác với bảng và bài không cần giao diện: bảng khởi đầu, xoá bài có hoàn tác, xoá bảng.
// Code thường, có test ở table-ops.test.ts.
import { toRows } from "./cloud-sync";
import { sampleTable } from "./sample-data";
import type { SavedPaper, SheetTable } from "./types";

// Bảng minh hoạ có sẵn trong app. Người dùng cũ có thể đang giữ nó trong dữ liệu đã lưu.
export const SAMPLE_TABLE_ID = sampleTable.id;

const SAMPLE_PAPER_IDS = new Set(sampleTable.papers.map((paper) => paper.id));

// So bằng dạng gửi lên máy chủ (toRows), vì bản đọc từ máy chủ đổi thứ tự trường và thêm tags rỗng.
const canonical = (table: SheetTable) => JSON.stringify(toRows([table]));
const PRISTINE_SAMPLE = canonical(sampleTable);

export function isPristineSample(table: SheetTable): boolean {
  return table.id === SAMPLE_TABLE_ID && canonical(table) === PRISTINE_SAMPLE;
}

// Bảng lúc mở app. Chỉ có đúng Bảng mẫu còn y nguyên thì đó không phải dữ liệu của người dùng (bản cũ của app
// tự lưu nó cho mọi người): coi như người dùng mới, bắt đầu từ bảng trống. Người dùng chọn cách này ngày 10/11/2026.
// Đã sửa Bảng mẫu hoặc có bảng khác thì giữ nguyên tất cả.
export function startingTables(saved: SheetTable[]): SheetTable[] {
  return saved.length === 1 && isPristineSample(saved[0]) ? [] : saved;
}

// Bài có sẵn của Bảng mẫu (dữ liệu minh hoạ): thao tác trên các bài này không tính vào số liệu đo hiệu quả.
export function isSamplePaper(paperId: string): boolean {
  return SAMPLE_PAPER_IDS.has(paperId);
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
