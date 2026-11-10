// Bài hư cấu dựng trong bộ nhớ (src/test/bai-mau.ts): đi qua đúng các bước đọc PDF, cắt tài liệu tham khảo,
// kiểm tra câu trích như bài thật. Bài này chỉ dùng cho test, không còn nằm trong app (bỏ ngày 10/11/2026).
import * as pdfjs from "pdfjs-dist";
import { describe, expect, it } from "vitest";
import { SAMPLE_PAPER_PAGES } from "@/test/bai-mau";
import { makePdf, pdfFile } from "@/test/make-pdf";
import { readPdfFile, type PdfEngine, type PdfPage } from "./pdf-read";
import { stripReferences } from "./strip-references";
import { verifyQuote } from "./verify-quote";
import { citesOtherSource } from "./cited-source";

async function readSample(): Promise<PdfPage[]> {
  const result = await readPdfFile(pdfFile(makePdf(SAMPLE_PAPER_PAGES), "bai-hu-cau.pdf"), pdfjs as unknown as PdfEngine);
  if (!result.ok) throw new Error(result.error.title);
  return result.pages;
}

describe("bài hư cấu dựng cho test", () => {
  it("đọc được 5 trang, mỗi trang ghi rõ không phải bài báo thật", async () => {
    const pages = await readSample();
    expect(pages).toHaveLength(5);
    for (const page of pages) expect(page.text).toContain("Not a real published article");
  });

  it("cắt được danh mục tài liệu tham khảo ở trang cuối", async () => {
    const stripped = stripReferences(await readSample()).pages;
    expect(stripped[4].text).not.toContain("Library visits and tutoring");
    expect(stripped[2].text).toContain("Tran et al. (2021)");
  });

  it("câu kết quả có ở hai trang nên là cần kiểm tra, câu phương pháp thì đã khớp", async () => {
    const pages = stripReferences(await readSample()).pages;
    expect(verifyQuote("Peer tutoring raised weekly reading time by about 2.1 hours.", 3, pages)).toMatchObject({
      check: "needs_review",
      review_reason: "multi_page",
    });
    expect(verifyQuote("We used a quasi-experimental design with propensity score matching", 2, pages)).toMatchObject({
      check: "verified",
      page: 2,
    });
    expect(verifyQuote("We used a quasi-experimental design with propensity score matching", 3, pages)).toMatchObject({
      check: "page_corrected",
      page: 2,
    });
  });

  it("câu của nghiên cứu khác bị gắn cảnh báo dẫn nguồn", () => {
    expect(citesOtherSource("Tran et al. (2021) reported that a similar program raised library visits by 18 percent")).toBe(true);
  });
});
