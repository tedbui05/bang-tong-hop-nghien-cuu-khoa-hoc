import { describe, expect, it } from "vitest";
import { listLanguages, normalizeLanguage } from "./sheet";
import type { SavedPaper } from "./types";

const paper = (language?: string): SavedPaper => ({ id: language ?? "x", language_code: "vi", info: { title: "t", language }, suggested_info: { title: "t" }, cells: [] });

describe("chuẩn hoá tên ngôn ngữ trước khi đếm", () => {
  it("viết hoa chữ đầu, bỏ khoảng trắng thừa", () => {
    expect(normalizeLanguage("tiếng Việt")).toBe("Tiếng Việt");
    expect(normalizeLanguage("  Tiếng   Việt ")).toBe("Tiếng Việt");
    expect(normalizeLanguage("tiếng Việt".normalize("NFD"))).toBe("Tiếng Việt");
    expect(normalizeLanguage("   ")).toBe("");
  });

  it('"tiếng Việt" và "Tiếng Việt" là một', () => {
    expect(listLanguages([paper("tiếng Anh"), paper("tiếng Việt"), paper("Tiếng Việt"), paper(" Tiếng Anh"), paper(), paper("tiếng Trung")])).toEqual([
      "Tiếng Anh",
      "Tiếng Việt",
      "Tiếng Trung",
    ]);
  });
});

describe("nhãn đọc cho trình đọc màn hình", () => {
  it("đọc đủ chữ", async () => {
    const { evidenceSpokenLabel } = await import("./evidence");
    const cell = { column: "x", value_vi: "x", quote_original: "q", quote_vi: "q", page: 9, status: "proposed" as const, check: "verified" as const, ai_page: 9 };
    expect(evidenceSpokenLabel(cell)).toBe("Trang 9, đã khớp");
    expect(evidenceSpokenLabel({ ...cell, status: "not_found", quote_original: null, page: null })).toBeNull();
  });
});
