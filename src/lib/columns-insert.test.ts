import { describe, expect, it } from "vitest";
import { insertBeforeOwnColumns, newContentColumn, suggestedColumns } from "./columns";

describe("thêm cột ở trang Tạo bảng", () => {
  it("chèn trước cột Nhãn và Ghi chú, không để cuối", () => {
    const columns = suggestedColumns();
    const added = newContentColumn("Bối cảnh", "");
    const result = insertBeforeOwnColumns(columns, added);
    const after = result.slice(result.indexOf(added) + 1).map((column) => column.kind);
    expect(after.length).toBeGreaterThan(0);
    expect(after.every((kind) => kind === "note" || kind === "tags")).toBe(true);
    expect(result).toHaveLength(columns.length + 1);
  });

  it("bảng không có cột Nhãn, Ghi chú thì để cuối", () => {
    const columns = suggestedColumns().filter((column) => column.kind !== "note" && column.kind !== "tags");
    const added = newContentColumn("Bối cảnh", "");
    expect(insertBeforeOwnColumns(columns, added).at(-1)).toBe(added);
  });
});
