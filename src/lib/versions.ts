// Lịch sử phiên bản của bảng (lưu trên Supabase, bảng sheet_versions, xem supabase/sql/phien-ban.sql).
// Phiên bản là bản chụp cả bảng (cột, nhãn, mọi bài) dạng JSON, không có file PDF (file chỉ nằm trong trình duyệt).
// Code thường, có test ở versions.test.ts.
import type { SheetTable } from "./types";

export type VersionKind = "tu_dat" | "tu_dong";

// Phần hiện trong danh sách (không kèm dữ liệu bảng, để tải danh sách nhanh).
export type VersionMeta = {
  id: string;
  table_id: string;
  table_name: string;
  name: string | null;
  reason: string | null;
  kind: VersionKind;
  paper_count: number;
  created_at: string;
};

export type VersionRow = VersionMeta & { data: SheetTable };

export type VersionInsert = Omit<VersionMeta, "id" | "created_at"> & { data: SheetTable };

// Giữ tối đa chừng này phiên bản tự lưu mỗi bảng (trigger trên máy chủ cắt bớt). SỐ TẠM, khớp với phien-ban.sql.
export const AUTO_VERSIONS_KEPT = 30;

// Bản chụp chỉ có dữ liệu dạng chữ (JSON). Bài có thể mang thông tin file (tên, cỡ, dấu vân tay) nhưng không có file.
export function versionSnapshot(table: SheetTable): SheetTable {
  return JSON.parse(JSON.stringify(table)) as SheetTable;
}

// name: tên người dùng đặt ("Trước khi gửi thầy"). reason: vì sao app tự lưu ("Trước khi xoá cột Hạn chế").
export function versionInsert(table: SheetTable, options: { name?: string; reason?: string }): VersionInsert {
  const name = options.name?.trim() || null;
  return {
    table_id: table.id,
    table_name: table.name,
    name,
    reason: name ? null : (options.reason?.trim() || null),
    kind: name ? "tu_dat" : "tu_dong",
    paper_count: table.papers.length,
    data: versionSnapshot(table),
  };
}

export function versionTitle(version: Pick<VersionMeta, "name" | "reason">): string {
  return version.name ?? version.reason ?? "Phiên bản tự lưu";
}

export function formatVersionTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}

// Mới nhất trước. Chia hai nhóm: phiên bản của bảng đang mở, và bảng đã xoá (mỗi bảng các phiên bản của nó).
export function groupVersions(list: VersionMeta[], tableIds: string[], currentId: string | null) {
  const sorted = [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const existing = new Set(tableIds);
  const deleted = new Map<string, VersionMeta[]>();
  for (const version of sorted) {
    if (existing.has(version.table_id)) continue;
    deleted.set(version.table_id, [...(deleted.get(version.table_id) ?? []), version]);
  }
  return { current: sorted.filter((version) => version.table_id === currentId), deleted: [...deleted.values()] };
}

// Khôi phục: bảng còn thì thay bằng bản chụp (giữ vị trí), bảng đã xoá thì thêm lại ở cuối.
export function restoreTables(tables: SheetTable[], snapshot: SheetTable): SheetTable[] {
  const restored = versionSnapshot(snapshot);
  return tables.some((table) => table.id === restored.id)
    ? tables.map((table) => (table.id === restored.id ? restored : table))
    : [...tables, restored];
}
