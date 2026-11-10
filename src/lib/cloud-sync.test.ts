// Test đồng bộ bảng với máy chủ: chỉ gửi phần đã đổi, xoá đúng dòng, chọn đúng bản làm gốc khi mở app.
import { describe, expect, it } from "vitest";
import { chooseStart, fromRows, isEmptyPlan, planSync, snapshotOf, toRows } from "./cloud-sync";
import { sampleTable } from "@/test/sample-data";
import type { SheetTable } from "./types";

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const tables = (): SheetTable[] => [clone(sampleTable), { id: "bang-2", name: "Bảng hai", columns: clone(sampleTable.columns), papers: [], tags: [] }];

describe("chuyển bảng thành dòng và ngược lại", () => {
  it("giữ nguyên bảng, thứ tự bảng và thứ tự bài", () => {
    const list = tables();
    const rows = toRows(list);
    expect(rows.tables.map((row) => row.id)).toEqual([sampleTable.id, "bang-2"]);
    expect(rows.papers).toHaveLength(sampleTable.papers.length);
    // Máy chủ trả dòng theo thứ tự bất kỳ.
    const back = fromRows([...rows.tables].reverse(), [...rows.papers].reverse());
    expect(back).toEqual(list);
  });

  it("không có trường nào là file PDF hay chữ của trang", () => {
    const text = JSON.stringify(toRows(tables()));
    expect(text).not.toMatch(/"pages"|application\/pdf|%PDF/);
  });
});

describe("planSync", () => {
  it("không đổi gì thì không gửi gì", () => {
    const list = tables();
    expect(isEmptyPlan(planSync(snapshotOf(list), clone(list)))).toBe(true);
  });

  it("máy chủ chưa có gì: gửi mọi bảng và bài (chuyển dữ liệu từ trình duyệt lên)", () => {
    const list = tables();
    const plan = planSync(snapshotOf([]), list);
    expect(plan.upsertTables).toHaveLength(2);
    expect(plan.upsertPapers).toHaveLength(sampleTable.papers.length);
    expect(plan.deleteTables).toEqual([]);
  });

  it("sửa một ô chỉ gửi đúng bài đó", () => {
    const list = tables();
    const before = snapshotOf(list);
    const next = clone(list);
    next[0].papers[1] = { ...next[0].papers[1], note: "ghi chú mới" };
    const plan = planSync(before, next);
    expect(plan.upsertTables).toEqual([]);
    expect(plan.upsertPapers.map((row) => row.id)).toEqual([next[0].papers[1].id]);
  });

  it("đổi tên cột chỉ gửi bảng, không gửi lại các bài", () => {
    const list = tables();
    const before = snapshotOf(list);
    const next = clone(list);
    next[0].columns[1] = { ...next[0].columns[1], name: "Tên mới" };
    const plan = planSync(before, next);
    expect(plan.upsertTables.map((row) => row.id)).toEqual([sampleTable.id]);
    expect(plan.upsertPapers).toEqual([]);
  });

  it("xoá bài thì xoá đúng bài; xoá bảng thì chỉ xoá bảng (bài tự mất theo)", () => {
    const list = tables();
    const before = snapshotOf(list);
    const removedPaper = clone(list);
    const gone = removedPaper[0].papers.pop()!;
    expect(planSync(before, removedPaper).deletePapers).toEqual([{ table_id: sampleTable.id, id: gone.id }]);

    const removedTable = clone(list).slice(1);
    const plan = planSync(before, removedTable);
    expect(plan.deleteTables).toEqual([sampleTable.id]);
    expect(plan.deletePapers).toEqual([]);
  });

  it("cùng mã bài ở hai bảng khác nhau là hai dòng khác nhau", () => {
    const list = tables();
    list[1].papers = [clone(list[0].papers[0])];
    const plan = planSync(snapshotOf([]), list);
    expect(plan.upsertPapers.filter((row) => row.id === list[0].papers[0].id).map((row) => row.table_id)).toEqual([sampleTable.id, "bang-2"]);
  });
});

describe("chooseStart", () => {
  it("còn thay đổi chưa lưu lên máy chủ (mất mạng lần trước): gửi bản trình duyệt lên", () => {
    expect(chooseStart(true, true, true)).toBe("push_local");
  });
  it("máy chủ có dữ liệu, trình duyệt không có thay đổi mới: dùng bản máy chủ", () => {
    expect(chooseStart(true, true, false)).toBe("use_remote");
    expect(chooseStart(true, false, false)).toBe("use_remote");
  });
  it("máy chủ trống, trình duyệt có dữ liệu cũ: chuyển lên máy chủ", () => {
    expect(chooseStart(false, true, false)).toBe("push_local");
  });
  it("cả hai đều trống: không làm gì", () => {
    expect(chooseStart(false, false, false)).toBe("nothing");
    expect(chooseStart(false, false, true)).toBe("nothing");
  });
});
