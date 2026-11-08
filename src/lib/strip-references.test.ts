import { describe, expect, it } from "vitest";
import type { PdfPage } from "./pdf-read";
import { MAX_PAPER_CHARS, countPaperChars, isPaperTooLong, stripReferences } from "./strip-references";

// Một trang thân bài đủ dài để tiêu đề ở trang sau rơi vào 40% cuối bài.
const body = (topic: string) =>
  Array.from({ length: 20 }, (_, i) => `Paragraph ${i + 1} discusses ${topic} in rural schools across the provinces.`).join("\n");

const pages = (...texts: string[]): PdfPage[] => texts.map((text, i) => ({ page: i + 1, text }));

describe("cắt phần tài liệu tham khảo", () => {
  it("cắt từ tiêu đề References đến hết bài, giữ nguyên số trang", () => {
    const input = pages(
      body("reading"),
      body("writing"),
      `${body("math")}\nReferences\nSmith J. (2020). A study of reading. Journal of Tests.`,
      "Nguyen A. (2019). Another study. Review of Education.",
    );
    const { pages: out, removed } = stripReferences(input);
    expect(removed).toEqual({ fromPage: 3, toPage: 4 });
    expect(out.map((page) => page.page)).toEqual([1, 2, 3, 4]);
    expect(out[0]).toEqual(input[0]);
    expect(out[2].text).toContain("discusses math");
    expect(out[2].text).not.toContain("References");
    expect(out[2].text).not.toContain("Smith J.");
    expect(out[3].text).toBe("");
  });

  it("nhận tiêu đề có số mục, chữ hoa và tiêu đề tiếng Việt, tiếng Trung", () => {
    for (const heading of ["7. REFERENCES", "Tài liệu tham khảo", "Tài liệu tham khảo".normalize("NFD"), "参考文献", "参 考 文 献：", "Bibliography"]) {
      const { removed } = stripReferences(pages(body("a"), body("b"), `${heading}\nSmith J. (2020). A study.`));
      expect(removed, heading).toEqual({ fromPage: 3, toPage: 3 });
    }
  });

  it("giữ phần phụ lục nằm sau References", () => {
    const input = pages(
      body("reading"),
      body("writing"),
      "References\nSmith J. (2020). A study of reading.\nLe B. (2018). Rural schools.",
      "Le C. (2017). Last reference.\nAppendix A. Sample description\nThe sample included 412 students from 12 provinces.",
    );
    const { pages: out, removed } = stripReferences(input);
    expect(removed).toEqual({ fromPage: 3, toPage: 4 });
    expect(out[2].text).toBe("");
    expect(out[3].text).toBe("Appendix A. Sample description\nThe sample included 412 students from 12 provinces.");
  });

  it("giữ phụ lục tiếng Việt và tiếng Trung", () => {
    for (const heading of ["Phụ lục 1: Bảng hỏi", "附录"]) {
      const { pages: out } = stripReferences(pages(body("a"), body("b"), `References\nSmith J. (2020).\n${heading}\nMẫu gồm 412 hộ.`));
      expect(out[2].text, heading).toBe(`${heading}\nMẫu gồm 412 hộ.`);
    }
  });

  it("phụ lục mở đầu trang mới thì trang đó giữ nguyên", () => {
    const input = pages(body("reading"), body("writing"), "References\nSmith J. (2020).", "Appendix\nTable A1. Variables.");
    const { pages: out, removed } = stripReferences(input);
    expect(removed).toEqual({ fromPage: 3, toPage: 3 });
    expect(out[3]).toEqual(input[3]);
  });

  it("không có tiêu đề References thì không cắt gì", () => {
    const input = pages(body("reading"), body("writing"), body("math"));
    const result = stripReferences(input);
    expect(result.removed).toBeNull();
    expect(result.pages).toEqual(input);
  });

  it("chữ References nằm giữa câu, không phải tiêu đề, thì không cắt", () => {
    const input = pages(
      body("reading"),
      body("writing"),
      `${body("math")}\nReferences to earlier work are listed in the online supplement.\nSee the references in Table 2.`,
    );
    expect(stripReferences(input).removed).toBeNull();
  });

  it("tiêu đề References ở phần đầu bài (như mục lục) thì không cắt", () => {
    const input = pages(`Contents\nReferences\n${body("intro")}`, body("reading"), body("writing"));
    expect(stripReferences(input).removed).toBeNull();
  });

  it("chữ Appendix nằm trong một câu dài thì không tính là tiêu đề phụ lục", () => {
    const input = pages(
      body("a"),
      body("b"),
      "References\nSmith J. (2020).\nAppendix: " + "x".repeat(120),
    );
    expect(stripReferences(input).pages[2].text).toBe("");
  });
});

describe("độ dài bài", () => {
  it("báo quá dài khi vượt giới hạn ký tự", () => {
    expect(isPaperTooLong(pages("a".repeat(MAX_PAPER_CHARS)))).toBe(false);
    expect(isPaperTooLong(pages("a".repeat(MAX_PAPER_CHARS), "b"))).toBe(true);
    expect(countPaperChars(pages("abc", "de"))).toBe(5);
  });
});
