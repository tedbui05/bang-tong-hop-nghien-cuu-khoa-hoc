import { describe, expect, it } from "vitest";
import { sampleTable } from "./sample-data";
import { groupVersions, restoreTables, versionInsert, versionSnapshot, versionTitle, type VersionMeta } from "./versions";
import type { SheetTable } from "./types";

const table = (id: string, papers = 0): SheetTable => ({
  id,
  name: `Bảng ${id}`,
  columns: sampleTable.columns,
  papers: sampleTable.papers.slice(0, papers).map((paper, i) => ({ ...paper, id: `${id}-p${i}` })),
});
const meta = (id: string, tableId: string, at: string, extra: Partial<VersionMeta> = {}): VersionMeta => ({
  id,
  table_id: tableId,
  table_name: `Bảng ${tableId}`,
  name: null,
  reason: "tự lưu",
  kind: "tu_dong",
  paper_count: 0,
  created_at: at,
  ...extra,
});

describe("tạo phiên bản", () => {
  it("người dùng đặt tên: loại tự đặt, không có lý do", () => {
    const row = versionInsert(table("a", 2), { name: "  Trước khi gửi thầy ", reason: "bỏ qua" });
    expect(row).toMatchObject({ table_id: "a", table_name: "Bảng a", name: "Trước khi gửi thầy", reason: null, kind: "tu_dat", paper_count: 2 });
  });

  it("app tự lưu: có lý do, không có tên", () => {
    expect(versionInsert(table("a"), { reason: "Trước khi xoá cột Hạn chế" })).toMatchObject({ name: null, reason: "Trước khi xoá cột Hạn chế", kind: "tu_dong" });
    expect(versionTitle({ name: null, reason: "Trước khi xoá cột Hạn chế" })).toBe("Trước khi xoá cột Hạn chế");
  });

  it("bản chụp là dữ liệu JSON tách rời, không chứa file", () => {
    const source = table("a", 1);
    const snap = versionSnapshot(source);
    expect(snap).toEqual(JSON.parse(JSON.stringify(source)));
    expect(snap).not.toBe(source);
    expect(JSON.stringify(snap)).not.toMatch(/"blob"|data:application\/pdf/);
  });
});

describe("danh sách phiên bản", () => {
  it("mới nhất trước, tách bảng đang mở và bảng đã xoá", () => {
    const list = [
      meta("1", "a", "2026-11-10T01:00:00Z"),
      meta("2", "a", "2026-11-10T03:00:00Z"),
      meta("3", "x", "2026-11-10T02:00:00Z"),
      meta("4", "b", "2026-11-10T04:00:00Z"),
    ];
    const groups = groupVersions(list, ["a", "b"], "a");
    expect(groups.current.map((v) => v.id)).toEqual(["2", "1"]);
    expect(groups.deleted.map((group) => group.map((v) => v.id))).toEqual([["3"]]);
  });
});

describe("khôi phục", () => {
  it("bảng còn thì thay tại chỗ, giữ vị trí", () => {
    const old = table("b", 2);
    const result = restoreTables([table("a"), table("b", 0), table("c")], old);
    expect(result.map((t) => t.id)).toEqual(["a", "b", "c"]);
    expect(result[1].papers).toHaveLength(2);
  });

  it("bảng đã xoá thì thêm lại", () => {
    expect(restoreTables([table("a")], table("z", 1)).map((t) => t.id)).toEqual(["a", "z"]);
  });
});
