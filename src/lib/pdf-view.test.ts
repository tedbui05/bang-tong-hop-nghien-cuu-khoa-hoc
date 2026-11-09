// Tô vàng trên lớp chữ của PDF: vị trí ký tự trong chữ của trang phải rơi đúng vào các mẩu chữ của pdf.js.
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import * as pdfjs from "pdfjs-dist";
import { describe, expect, it } from "vitest";
import { joinTextItems, readPdfFile, type PdfEngine } from "./pdf-read";
import { rangeCuts } from "./pdf-view";
import { verifyCells } from "./verify-quote";

describe("chia đoạn tô cho từng mẩu chữ", () => {
  const items = [
    { str: "The main finding", hasEOL: true },
    { str: "is that firms", hasEOL: false },
    { str: " with credit", hasEOL: true },
  ];
  // Chữ của trang: "The main finding\nis that firms with credit\n"

  it("đoạn nằm trong một mẩu: tô một phần", () => {
    expect(rangeCuts(items, [{ page: 1, start: 4, end: 8 }])).toEqual([{ index: 0, from: 4, to: 8, whole: false }]);
  });

  it("đoạn vắt qua nhiều mẩu và chỗ xuống dòng", () => {
    expect(rangeCuts(items, [{ page: 1, start: 9, end: 36 }])).toEqual([
      { index: 0, from: 9, to: 16, whole: false },
      { index: 1, from: 0, to: 13, whole: true },
      { index: 2, from: 0, to: 6, whole: false },
    ]);
  });

  it("không có đoạn nào: không tô", () => {
    expect(rangeCuts(items, [])).toEqual([]);
  });
});

// Với bài thật: chữ ghép từ các mẩu đúng bằng chữ đã lưu lúc đọc bài, và các mẩu được tô ghép lại đúng là câu trích.
const SAMPLES = path.join(process.cwd(), "samples");
const file = fs.existsSync(SAMPLES) ? fs.readdirSync(SAMPLES).find((name) => name.startsWith("lin-et-al-2023") && name.endsWith(".pdf")) : undefined;
const cMapUrl = path.join(path.dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json")), "cmaps") + path.sep;

describe.skipIf(!file)("chữ thật: tô vàng trên bài tiếng Anh", () => {
  it("các mẩu được tô ghép lại đúng là câu trích", async () => {
    const data = fs.readFileSync(path.join(SAMPLES, file!));
    const blob = Object.assign(new Blob([data]), { name: file });
    const read = await readPdfFile(blob as unknown as File, pdfjs as unknown as PdfEngine, { cMapUrl });
    if (!read.ok) throw new Error(read.error.title);
    const quote = "Firms engaged in technology research and development (R&D) must assume high risks associated with unknown return cycles and returns.";
    const [cell] = verifyCells([{ column: "x", value_vi: "x", quote_original: quote, quote_vi: "x", page: 2, status: "proposed", check: null, ai_page: 2 }], read.pages);
    expect(cell.check).toBe("verified");

    const doc = await pdfjs.getDocument({ data: new Uint8Array(data), cMapUrl, cMapPacked: true, verbosity: 0 }).promise;
    const page = await doc.getPage(2);
    const content = await page.getTextContent();
    const items = content.items.filter((item) => "str" in item);
    expect(joinTextItems(items)).toBe(read.pages[1].text);

    const marked = rangeCuts(items, cell.quote_ranges!)
      .map((cut) => items[cut.index].str.slice(cut.from, cut.to))
      .join(" ");
    const letters = (text: string) => text.replace(/[^\p{L}]/gu, "").toLowerCase();
    expect(letters(marked)).toBe(letters(quote));
    await doc.loadingTask.destroy();
  }, 30_000);
});
