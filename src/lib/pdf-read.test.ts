import { createRequire } from "node:module";
import path from "node:path";
import * as pdfjs from "pdfjs-dist";
import { describe, expect, it } from "vitest";
import { makePdf, pdfFile } from "@/test/make-pdf";
import { MAX_PDF_BYTES, checkPdfFile, joinTextItems, looksScanned, readPdfFile, type PdfEngine, type PdfReadResult } from "./pdf-read";

const cMapUrl = path.join(path.dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json")), "cmaps") + path.sep;
const engine = pdfjs as unknown as PdfEngine;
const read = (file: File) => readPdfFile(file, engine, { cMapUrl });

function expectError(result: PdfReadResult) {
  if (result.ok) throw new Error("Mong đợi báo lỗi nhưng file lại đọc được");
  return result.error;
}

function expectPages(result: PdfReadResult) {
  if (!result.ok) throw new Error(`Mong đợi đọc được nhưng bị lỗi: ${result.error.title}`);
  return result.pages;
}

const body = (topic: string) => [
  `This page discusses ${topic} in rural schools.`,
  "Teachers reported higher engagement after the intervention.",
  "The sample included 412 students from 12 provinces.",
];

describe("đọc chữ của từng trang", () => {
  it("lấy đúng chữ của từng trang, theo thứ tự, số trang đếm từ 1", async () => {
    const file = pdfFile(makePdf([{ lines: body("reading") }, { lines: body("writing") }, { lines: body("math") }]));
    const pages = expectPages(await read(file));
    expect(pages.map((page) => page.page)).toEqual([1, 2, 3]);
    expect(pages[0].text).toContain("This page discusses reading in rural schools.");
    expect(pages[1].text).toContain("discusses writing");
    expect(pages[2].text).toContain("discusses math");
    expect(pages[0].text).not.toContain("writing");
  });

  it("giữ chỗ xuống dòng, để sau này nối được từ bị ngắt bằng gạch nối", async () => {
    const file = pdfFile(makePdf([{ lines: ["Students in high-", "poverty districts were included in the study."] }]));
    const [page] = expectPages(await read(file));
    expect(page.text).toMatch(/high-\s*\n\s*poverty/);
  });

  it("giữ nguyên ký tự đặc biệt như ngoặc, dấu gạch chéo ngược", async () => {
    const file = pdfFile(makePdf([{ lines: ["The effect (p < 0.05) was strong \\ consistent across all groups."] }]));
    const [page] = expectPages(await read(file));
    expect(page.text).toContain("(p < 0.05) was strong \\ consistent");
  });

  it("đọc được file PDF có đuôi viết hoa hoặc lỡ mất đuôi", async () => {
    const bytes = makePdf([{ lines: body("science") }]);
    expectPages(await read(pdfFile(bytes, "BAI-BAO.PDF")));
    expectPages(await read(pdfFile(bytes, "bai-bao")));
  });

  it("ghép mẩu chữ của pdf.js theo đánh dấu xuống dòng", () => {
    expect(joinTextItems([{ str: "Hello", hasEOL: false }, { str: " world", hasEOL: true }, { str: "Next" }])).toBe("Hello world\nNext");
  });
});

describe("lỗi 1: file không phải PDF", () => {
  it("chặn file Word, có nói tên file", async () => {
    const docx = pdfFile("PK\x03\x04\x14\x00\x06\x00 word/document.xml", "luan-van.docx");
    const error = expectError(await read(docx));
    expect(error.code).toBe("not_pdf");
    expect(error.title).toBe("File này không phải PDF");
    expect(error.detail).toContain("“luan-van.docx”");
  });

  it("chặn file ảnh bị đổi đuôi thành .pdf", async () => {
    const png = pdfFile("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR", "anh-chup.pdf");
    const error = expectError(await read(png));
    expect(error.code).toBe("not_pdf");
    expect(error.detail).toContain("có đuôi .pdf nhưng nội dung bên trong không phải PDF");
  });

  it("chặn file chữ thường", async () => {
    const error = expectError(await read(pdfFile("Ghi chu cua toi ve bai bao", "ghi-chu.txt")));
    expect(error.code).toBe("not_pdf");
  });

  it("chặn file trống", async () => {
    const error = expectError(await read(pdfFile("", "bai-bao.pdf")));
    expect(error.code).toBe("empty");
    expect(error.title).toBe("File này trống");
  });

  it("báo lỗi dễ hiểu khi file có đầu PDF nhưng bên trong hỏng", async () => {
    const error = expectError(await read(pdfFile("%PDF-1.7\nđây không phải nội dung PDF", "bai-hong.pdf")));
    expect(error.code).toBe("damaged");
    expect(error.title).toBe("Chưa đọc được file này");
  });
});

describe("lỗi 2: file quá lớn", () => {
  it("giới hạn là 20 MB", () => {
    expect(MAX_PDF_BYTES).toBe(20 * 1024 * 1024);
  });

  it("chặn file trên 20 MB, nói rõ file nặng bao nhiêu", async () => {
    const big = new File([new Uint8Array(MAX_PDF_BYTES + 3 * 1024 * 1024)], "sach-day.pdf");
    const error = expectError(await read(big));
    expect(error.code).toBe("too_large");
    expect(error.title).toBe("File quá lớn");
    expect(error.detail).toContain("nặng 23 MB, quá giới hạn 20 MB");
  });

  it("chặn trước khi đọc nội dung file", async () => {
    let touched = false;
    const huge = {
      name: "rat-lon.pdf",
      size: 500 * 1024 * 1024,
      slice: () => {
        touched = true;
        return new Blob();
      },
      arrayBuffer: async () => {
        touched = true;
        return new ArrayBuffer(0);
      },
    };
    expect((await checkPdfFile(huge))?.code).toBe("too_large");
    expect(touched).toBe(false);
  });

  it("file đúng 20 MB vẫn được nhận", async () => {
    const bytes = new Uint8Array(MAX_PDF_BYTES);
    bytes.set(new TextEncoder().encode("%PDF-1.4\n"));
    expect(await checkPdfFile(new File([bytes], "vua-du.pdf"))).toBeNull();
  });
});

describe("lỗi 3: PDF có mật khẩu", () => {
  it("báo file có mật khẩu và hướng dẫn bỏ mật khẩu", async () => {
    const file = pdfFile(makePdf([{ lines: body("secrets") }], { encrypt: { userPassword: "matkhau", ownerPassword: "chu" } }));
    const error = expectError(await read(file));
    expect(error.code).toBe("password");
    expect(error.title).toBe("File PDF này có mật khẩu");
    expect(error.detail).toContain("không có mật khẩu");
  });

  it("vẫn đọc được PDF chỉ khoá quyền sửa, mở không cần mật khẩu", async () => {
    // Nhiều tạp chí khoá quyền sửa file nhưng ai cũng mở được. Loại này không được báo lỗi.
    const file = pdfFile(makePdf([{ lines: body("journals") }], { encrypt: { userPassword: "", ownerPassword: "tapchi" } }));
    const [page] = expectPages(await read(file));
    expect(page.text).toContain("This page discusses journals in rural schools.");
  });
});

describe("lỗi 4: PDF là ảnh scan, không có chữ", () => {
  it("báo đúng câu “App chưa đọc được file scan”", async () => {
    const file = pdfFile(makePdf([{ image: true }, { image: true }, { image: true }]));
    const error = expectError(await read(file));
    expect(error.code).toBe("scanned");
    expect(error.title).toBe("App chưa đọc được file scan");
  });

  it("bản scan có một trang bìa chữ vẫn tính là scan", async () => {
    const cover = { lines: ["Downloaded from the digital library archive. For personal use only."] };
    const file = pdfFile(makePdf([cover, { image: true }, { image: true }, { image: true }, { image: true }]));
    expect(expectError(await read(file)).code).toBe("scanned");
  });

  it("trang chỉ có vài chữ lẻ (như số trang) không tính là trang có chữ", async () => {
    const file = pdfFile(makePdf([{ lines: ["12"] }, { lines: ["13"] }]));
    expect(expectError(await read(file)).code).toBe("scanned");
  });

  it("bài thật có vài trang toàn hình vẫn đọc được", async () => {
    const file = pdfFile(makePdf([{ lines: body("a") }, { image: true }, { lines: body("b") }, { lines: body("c") }]));
    const pages = expectPages(await read(file));
    expect(pages).toHaveLength(4);
    expect(pages[1].text.trim()).toBe("");
  });

  it("đếm cả chữ có dấu và chữ Trung khi xét trang có chữ", () => {
    expect(looksScanned([{ page: 1, text: "Nghiên cứu này khảo sát học sinh" }])).toBe(false);
    expect(looksScanned([{ page: 1, text: "本研究以农村地区的小学生为对象进行调查分析了阅读能力" }])).toBe(false);
    expect(looksScanned([{ page: 1, text: " \n \n " }])).toBe(true);
  });
});
