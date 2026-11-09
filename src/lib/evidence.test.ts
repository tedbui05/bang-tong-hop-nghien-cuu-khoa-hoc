import { describe, expect, it } from "vitest";
import { evidenceLabel, evidenceView, NOT_MARKED_NOTE, splitByRanges, UNKNOWN_POSITION_NOTE } from "./evidence";
import type { AiCell } from "./types";

const base: AiCell = {
  column: "ket-qua",
  value_vi: "x",
  quote_original: "the quote",
  quote_vi: "x",
  page: 9,
  status: "proposed",
  check: "verified",
  ai_page: 9,
  quote_ranges: [{ page: 9, start: 4, end: 13 }],
};

describe("xem bằng chứng của một ô", () => {
  it("đã khớp: mở trang đó, tô đoạn đã tìm", () => {
    expect(evidenceView(base)).toEqual({ label: "verified", page: 9, ranges: base.quote_ranges, note: null });
    expect(evidenceLabel(base)).toBe("tr. 9 · đã khớp");
  });

  it("đã sửa số trang: mở trang code tìm thấy, không phải trang AI ghi", () => {
    const cell = { ...base, check: "page_corrected" as const, page: 4, ai_page: 9, quote_ranges: [{ page: 4, start: 0, end: 5 }] };
    expect(evidenceView(cell).page).toBe(4);
    expect(evidenceLabel(cell)).toBe("tr. 4 · đã sửa số trang");
  });

  it("cần kiểm tra: mở trang AI ghi, không tô, có lời nhắc", () => {
    const cell = { ...base, check: "needs_review" as const, page: 9, ai_page: 9, quote_ranges: null };
    expect(evidenceView(cell)).toEqual({ label: "needs_review", page: 9, ranges: [], note: UNKNOWN_POSITION_NOTE });
    expect(evidenceLabel(cell)).toBe("tr. 9 · cần kiểm tra");
  });

  it("đã khớp nhưng không tô được: vẫn mở trang, có lời nhắc", () => {
    expect(evidenceView({ ...base, quote_ranges: null }).note).toBe(NOT_MARKED_NOTE);
  });

  it("không tìm thấy: không có nhãn bằng chứng", () => {
    const cell: AiCell = { ...base, status: "not_found", quote_original: null, page: null, ai_page: null, check: null, quote_ranges: null };
    expect(evidenceView(cell).page).toBeNull();
    expect(evidenceLabel(cell)).toBeNull();
  });

  it("cắt chữ của trang thành đoạn thường và đoạn tô", () => {
    expect(splitByRanges("abc the quote def", 9, [{ page: 9, start: 4, end: 13 }, { page: 10, start: 0, end: 2 }])).toEqual([
      { text: "abc ", marked: false },
      { text: "the quote", marked: true },
      { text: " def", marked: false },
    ]);
  });
});
