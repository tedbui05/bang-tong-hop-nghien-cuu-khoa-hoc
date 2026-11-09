// Đồng bộ bảng và bài giữa trình duyệt và Supabase (bảng sheet_tables, sheet_papers trong supabase/sql/du-lieu-bang.sql).
// Phần so sánh là hàm thuần để test được; phần gọi Supabase nằm trong một "remote" truyền vào.
// File PDF không bao giờ được gửi lên: chỉ có chữ của ô, câu trích, số trang và định dạng.
import type { SavedPaper, SheetTable } from "./types";

export type TableRow = {
  id: string;
  position: number;
  name: string;
  description: string | null;
  columns: SheetTable["columns"];
  tags: NonNullable<SheetTable["tags"]>;
};

export type PaperRow = {
  table_id: string;
  id: string;
  position: number;
  title: string;
  data: SavedPaper;
};

// Bản chụp những gì đã có trên máy chủ: mỗi dòng kèm chuỗi JSON để biết dòng có đổi không.
export type Snapshot = {
  tables: Map<string, string>;
  papers: Map<string, string>;
};

export const paperKey = (tableId: string, paperId: string) => `${tableId}\u0000${paperId}`;

export function toRows(tables: SheetTable[]): { tables: TableRow[]; papers: PaperRow[] } {
  return {
    tables: tables.map((table, position) => ({
      id: table.id,
      position,
      name: table.name,
      description: table.description ?? null,
      columns: table.columns,
      tags: table.tags ?? [],
    })),
    papers: tables.flatMap((table) =>
      table.papers.map((paper, position) => ({ table_id: table.id, id: paper.id, position, title: paper.info.title ?? "", data: paper })),
    ),
  };
}

export function fromRows(tableRows: TableRow[], paperRows: PaperRow[]): SheetTable[] {
  return [...tableRows]
    .sort((a, b) => a.position - b.position)
    .map((row) => ({
      id: row.id,
      name: row.name,
      ...(row.description ? { description: row.description } : {}),
      columns: row.columns,
      tags: row.tags ?? [],
      papers: paperRows
        .filter((paper) => paper.table_id === row.id)
        .sort((a, b) => a.position - b.position)
        .map((paper) => paper.data),
    }));
}

export function snapshotOf(tables: SheetTable[]): Snapshot {
  const rows = toRows(tables);
  return {
    tables: new Map(rows.tables.map((row) => [row.id, JSON.stringify(row)])),
    papers: new Map(rows.papers.map((row) => [paperKey(row.table_id, row.id), JSON.stringify(row)])),
  };
}

export type SyncPlan = {
  upsertTables: TableRow[];
  upsertPapers: PaperRow[];
  deleteTables: string[];
  deletePapers: { table_id: string; id: string }[];
};

// Chỉ gửi những dòng đã đổi so với bản trên máy chủ.
export function planSync(previous: Snapshot, tables: SheetTable[]): SyncPlan {
  const rows = toRows(tables);
  const tableIds = new Set(rows.tables.map((row) => row.id));
  const paperKeys = new Set(rows.papers.map((row) => paperKey(row.table_id, row.id)));
  return {
    upsertTables: rows.tables.filter((row) => previous.tables.get(row.id) !== JSON.stringify(row)),
    upsertPapers: rows.papers.filter((row) => previous.papers.get(paperKey(row.table_id, row.id)) !== JSON.stringify(row)),
    deleteTables: [...previous.tables.keys()].filter((id) => !tableIds.has(id)),
    // Bài của bảng bị xoá tự mất theo bảng (on delete cascade), không cần xoá riêng.
    deletePapers: [...previous.papers.keys()]
      .filter((key) => !paperKeys.has(key))
      .map((key) => {
        const [table_id, id] = key.split("\u0000");
        return { table_id, id };
      })
      .filter((row) => tableIds.has(row.table_id)),
  };
}

export const isEmptyPlan = (plan: SyncPlan) =>
  !plan.upsertTables.length && !plan.upsertPapers.length && !plan.deleteTables.length && !plan.deletePapers.length;

export type Remote = {
  load: () => Promise<{ tables: TableRow[]; papers: PaperRow[] }>;
  apply: (plan: SyncPlan) => Promise<void>;
  // Xoá mọi bảng và bài của người dùng này (nút "Đặt lại dữ liệu mẫu").
  clear: () => Promise<void>;
};

// Khi mở app: chọn dữ liệu nào làm gốc.
// - Trình duyệt còn thay đổi chưa lưu lên máy chủ (ví dụ lúc mất mạng): giữ bản trình duyệt rồi gửi lên.
// - Máy chủ đã có dữ liệu: dùng bản máy chủ.
// - Máy chủ chưa có gì mà trình duyệt có dữ liệu riêng (từ trước khi có máy chủ): chuyển dữ liệu đó lên.
export type StartChoice = "use_remote" | "push_local" | "nothing";

export function chooseStart(remoteHasData: boolean, localHasData: boolean, localDirty: boolean): StartChoice {
  if (localDirty && localHasData) return "push_local";
  if (remoteHasData) return "use_remote";
  if (localHasData) return "push_local";
  return "nothing";
}
