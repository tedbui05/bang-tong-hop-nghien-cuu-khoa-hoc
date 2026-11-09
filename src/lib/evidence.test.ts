import { describe, expect, it } from "vitest";
import { evidenceLabel, evidenceView, multiPageNote, NOT_MARKED_NOTE, splitByRanges, UNKNOWN_POSITION_NOTE } from "./evidence";
import { getReviewReason, type AiCell } from "./types";

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

  describe("cần kiểm tra vì câu có ở nhiều trang", () => {
    const multi: AiCell = {
      ...base,
      page: 3,
      ai_page: 3,
      check: "needs_review",
      review_reason: "multi_page",
      quote_ranges: null,
      page_matches: [
        { page: 1, ranges: [{ page: 1, start: 5, end: 30 }] },
        { page: 3, ranges: [{ page: 3, start: 40, end: 65 }] },
      ],
    };

    it("mặc định mở trang AI ghi, có tô vàng, ghi chú nói rõ các trang", () => {
      expect(evidenceView(multi)).toEqual({ label: "needs_review", page: 3, ranges: [{ page: 3, start: 40, end: 65 }], note: multiPageNote([1, 3]) });
      expect(multiPageNote([1, 3])).toBe("Câu này có ở trang 1 và trang 3, chưa biết trang nào đúng. Hãy xem từng trang");
    });

    it("mở được từng trang, mỗi trang tô đúng chỗ của trang đó", () => {
      expect(evidenceView(multi, 1)).toMatchObject({ page: 1, ranges: [{ page: 1, start: 5, end: 30 }] });
      expect(evidenceLabel(multi, 1)).toBe("tr. 1 · cần kiểm tra");
      // Trang không có câu thì về trang mặc định.
      expect(evidenceView(multi, 7).page).toBe(3);
    });

    it("lý do ghi rõ các trang", () => {
      expect(getReviewReason(multi)).toBe("Câu này có ở trang 1 và trang 3 nên chưa biết đúng trang nào. Hãy đối chiếu với bài gốc.");
      expect(getReviewReason({ ...multi, page_matches: undefined })).toBe("Câu này có ở nhiều trang nên chưa biết đúng trang nào. Hãy đối chiếu với bài gốc.");
    });

    it("trang AI ghi không có câu thì mở trang đầu tiên tìm thấy", () => {
      expect(evidenceView({ ...multi, ai_page: 5, page: 5 }).page).toBe(1);
    });
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
