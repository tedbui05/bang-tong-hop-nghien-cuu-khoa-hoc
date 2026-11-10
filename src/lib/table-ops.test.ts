import { describe, expect, it } from "vitest";
import { fromRows, planSync, snapshotOf, toRows } from "./cloud-sync";
import { sampleTable } from "@/test/sample-data";
import { isLegacySamplePaper, LEGACY_APP_SAMPLE_FILE, nextActiveAfterDelete, removePapers, restorePapers, startingTables } from "./table-ops";
import type { SheetTable } from "./types";

const own = (id: string, paperIds: string[] = []): SheetTable => ({
  id,
  name: `Bảng ${id}`,
  columns: sampleTable.columns,
  papers: paperIds.map((paperId) => ({ ...sampleTable.papers[0], id: paperId })),
});

// Bài minh hoạ "Xem bài mẫu" của bản cũ: bài Bloom 2013, không có file PDF, mã bài ngẫu nhiên.
const reviewSample = { ...sampleTable.papers[0], id: "bai-123", info: { ...sampleTable.papers[0].info, title: "Does Working from Home Work? Evidence from a Chinese Experiment" } };
const appSample = { ...sampleTable.papers[0], id: "bai-456", file: { name: LEGACY_APP_SAMPLE_FILE, size: 1, hash: "x" } };

describe("bảng lúc mở app: bỏ mọi bài mẫu của bản cũ", () => {
  it("người dùng mới: bảng trống", () => {
    expect(startingTables([])).toEqual([]);
  });

  it("Bảng mẫu chỉ có bài mẫu thì bỏ cả bảng, kể cả khi đã sửa", () => {
    expect(startingTables([sampleTable])).toEqual([]);
    expect(startingTables([{ ...sampleTable, name: "Bảng mẫu của tôi" }])).toEqual([]);
    // Bản đọc từ máy chủ đổi thứ tự trường và thêm tags rỗng.
    const rows = toRows([sampleTable]);
    expect(startingTables(fromRows(rows.tables, rows.papers))).toEqual([]);
  });

  it("Bảng mẫu có bài người dùng tự thêm thì giữ bảng với các bài đó, bỏ dòng mô tả minh hoạ", () => {
    const mine = { ...sampleTable.papers[0], id: "bai-cua-toi", info: { ...sampleTable.papers[0].info, title: "Bài của tôi" } };
    const [kept] = startingTables([{ ...sampleTable, papers: [...sampleTable.papers, mine] }]);
    expect(kept.papers.map((paper) => paper.id)).toEqual(["bai-cua-toi"]);
    expect(kept.description).toBe("");
  });

  it("bỏ bài minh hoạ và bài mẫu do app tạo ở bảng riêng, giữ bảng và bài khác", () => {
    const table = { ...own("a", ["p1"]), papers: [...own("a", ["p1"]).papers, reviewSample, appSample] };
    const [kept] = startingTables([table]);
    expect(kept.papers.map((paper) => paper.id)).toEqual(["p1"]);
    expect(startingTables([own("b")])).toEqual([own("b")]);
  });

  it("không có gì để bỏ thì trả về đúng mảng cũ", () => {
    const list = [own("a", ["p1"])];
    expect(startingTables(list)).toBe(list);
  });

  it("nhận ra bài mẫu của bản cũ", () => {
    expect(isLegacySamplePaper(sampleTable.papers[0], sampleTable.id)).toBe(true);
    expect(isLegacySamplePaper(sampleTable.papers[0], "bang-khac")).toBe(false);
    expect(isLegacySamplePaper(reviewSample, "bang-khac")).toBe(true);
    expect(isLegacySamplePaper(appSample, "bang-khac")).toBe(true);
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

  it("bỏ Bảng mẫu trên máy chủ: lần đồng bộ sau xoá dòng đó", () => {
    const plan = planSync(snapshotOf([sampleTable]), startingTables([sampleTable]));
    expect(plan.deleteTables).toEqual([sampleTable.id]);
  });
});
