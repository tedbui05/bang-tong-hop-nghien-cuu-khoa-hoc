import { describe, expect, it } from "vitest";
import { fromRows, planSync, snapshotOf, toRows } from "./cloud-sync";
import { sampleTable } from "./sample-data";
import { isPristineSample, isSamplePaper, nextActiveAfterDelete, removePapers, restorePapers, startingTables } from "./table-ops";
import type { SheetTable } from "./types";

const own = (id: string, paperIds: string[] = []): SheetTable => ({
  id,
  name: `Bảng ${id}`,
  columns: sampleTable.columns,
  papers: paperIds.map((paperId) => ({ ...sampleTable.papers[0], id: paperId })),
});

describe("bảng lúc mở app", () => {
  it("người dùng mới: bảng trống", () => {
    expect(startingTables([])).toEqual([]);
  });

  it("chỉ có Bảng mẫu y nguyên (bản cũ tự lưu): coi như người dùng mới", () => {
    expect(startingTables([sampleTable])).toEqual([]);
    // Bản đọc từ máy chủ đổi thứ tự trường và thêm tags rỗng, vẫn nhận ra là y nguyên.
    const rows = toRows([sampleTable]);
    const fromServer = fromRows(rows.tables, rows.papers);
    expect(isPristineSample(fromServer[0])).toBe(true);
    expect(startingTables(fromServer)).toEqual([]);
  });

  it("Bảng mẫu đã sửa thì giữ", () => {
    const edited = { ...sampleTable, name: "Bảng mẫu của tôi" };
    expect(startingTables([edited])).toEqual([edited]);
    const withNote = { ...sampleTable, papers: sampleTable.papers.map((paper, i) => (i === 0 ? { ...paper, note: "đọc lại" } : paper)) };
    expect(startingTables([withNote])).toHaveLength(1);
  });

  it("có bảng khác thì giữ cả Bảng mẫu", () => {
    expect(startingTables([sampleTable, own("a")])).toHaveLength(2);
  });

  it("nhận ra bài có sẵn của Bảng mẫu", () => {
    expect(isSamplePaper(sampleTable.papers[0].id)).toBe(true);
    expect(isSamplePaper("bai-cua-toi")).toBe(false);
  });
});

describe("xoá bài và hoàn tác", () => {
  const table = own("a", ["p1", "p2", "p3", "p4"]);

  it("xoá nhiều bài, nhớ vị trí cũ", () => {
    const { table: after, removed } = removePapers(table, ["p2", "p4"]);
    expect(after.papers.map((paper) => paper.id)).toEqual(["p1", "p3"]);
    expect(removed.items.map((item) => [item.index, item.paper.id])).toEqual([
      [1, "p2"],
      [3, "p4"],
    ]);
  });

  it("hoàn tác đưa bài về đúng chỗ", () => {
    const { table: after, removed } = removePapers(table, ["p1", "p3"]);
    expect(restorePapers(after, removed).papers.map((paper) => paper.id)).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("hoàn tác hai lần không nhân đôi bài, hoàn tác vào bảng khác thì bỏ qua", () => {
    const { table: after, removed } = removePapers(table, ["p2"]);
    const once = restorePapers(after, removed);
    expect(restorePapers(once, removed).papers).toHaveLength(4);
    expect(restorePapers(own("b"), removed).papers).toHaveLength(0);
  });

  it("hoàn tác sau khi bảng đã có bài mới vẫn giữ bài mới", () => {
    const { table: after, removed } = removePapers(table, ["p4"]);
    const added = { ...after, papers: [...after.papers, { ...table.papers[0], id: "p5" }] };
    expect(restorePapers(added, removed).papers.map((paper) => paper.id)).toEqual(["p1", "p2", "p3", "p4", "p5"]);
  });

  it("đồng bộ máy chủ: xoá bài thì xoá dòng đó, hoàn tác thì gửi lại", () => {
    const server = snapshotOf([table]);
    const { table: after, removed } = removePapers(table, ["p2", "p3"]);
    const plan = planSync(server, [after]);
    expect(plan.deletePapers).toEqual([
      { table_id: "a", id: "p2" },
      { table_id: "a", id: "p3" },
    ]);
    const restored = planSync(snapshotOf([after]), [restorePapers(after, removed)]);
    expect(restored.upsertPapers.map((row) => row.id).sort()).toEqual(["p2", "p3", "p4"]);
  });
});

describe("xoá bảng", () => {
  const tables = [own("a"), own("b"), own("c")];

  it("mở bảng kế bên, hết bảng thì về trống", () => {
    expect(nextActiveAfterDelete(tables, "b")).toBe("c");
    expect(nextActiveAfterDelete(tables, "c")).toBe("b");
    expect(nextActiveAfterDelete([own("a")], "a")).toBeNull();
  });

  it("đồng bộ máy chủ: xoá bảng thì xoá dòng bảng, bài đi theo bảng", () => {
    const withPapers = [own("a", ["p1"]), own("b", ["p2"])];
    const plan = planSync(snapshotOf(withPapers), [withPapers[0]]);
    expect(plan.deleteTables).toEqual(["b"]);
    expect(plan.deletePapers).toEqual([]);
  });

  it("bỏ Bảng mẫu y nguyên trên máy chủ: lần đồng bộ sau xoá dòng đó", () => {
    const plan = planSync(snapshotOf([sampleTable]), startingTables([sampleTable]));
    expect(plan.deleteTables).toEqual([sampleTable.id]);
  });
});
