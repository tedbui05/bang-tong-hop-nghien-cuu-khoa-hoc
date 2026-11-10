import { describe, expect, it } from "vitest";
import { pdfTabUrl, quoteList } from "./paper-viewer";
import type { AiCell } from "./types";

const cell = (column: string, extra: Partial<AiCell> = {}): AiCell => ({
  column,
  value_vi: "x",
  quote_original: "a quote that is long enough",
  quote_vi: "x",
  page: 2,
  status: "proposed",
  check: "verified",
  ai_page: 2,
  quote_ranges: [{ page: 2, start: 0, end: 5 }],
  ...extra,
});

describe("danh sách câu trích khi xem cả bài", () => {
  const columns = [
    { id: "cau-hoi", name: "Câu hỏi" },
    { id: "han-che", name: "Hạn chế" },
    { id: "ket-qua", name: "Kết quả" },
  ];

  it("theo thứ tự cột, bỏ ô không tìm thấy và ô tự điền", () => {
    const cells = [
      cell("ket-qua", { page: 3 }),
      cell("han-che", { status: "not_found", quote_original: null, page: null, ai_page: null, check: null }),
      cell("cau-hoi"),
      cell("mau", { status: "manual", quote_original: null, page: null, check: null }),
    ];
    expect(quoteList(cells, columns).map((item) => [item.columnName, item.cell.page])).toEqual([
      ["Câu hỏi", 2],
      ["Kết quả", 3],
    ]);
  });

  it("ô cần kiểm tra vẫn có trong danh sách (mở trang AI ghi)", () => {
    const list = quoteList([cell("ket-qua", { check: "needs_review", quote_ranges: null, page: 4, ai_page: 4 })], columns);
    expect(list).toHaveLength(1);
  });
});

describe("mở trong tab mới", () => {
  it("thêm #page=N để trình xem PDF mở đúng trang", () => {
    expect(pdfTabUrl("blob:http://localhost/abc", 7)).toBe("blob:http://localhost/abc#page=7");
    expect(pdfTabUrl("blob:http://localhost/abc", 1)).toBe("blob:http://localhost/abc");
    expect(pdfTabUrl("blob:http://localhost/abc", null)).toBe("blob:http://localhost/abc");
  });
});
