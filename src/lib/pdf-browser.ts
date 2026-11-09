// Đọc PDF ngay trên trình duyệt của sinh viên: file không gửi lên máy chủ.
// pdf.js khá nặng nên chỉ tải khi bấm "Đọc bài báo".
// File worker và cMap được scripts/copy-pdfjs-assets.mjs chép vào public/pdfjs.
import { readPdfFile, type PdfEngine, type PdfReadResult } from "./pdf-read";

let engine: Promise<PdfEngine> | null = null;

function loadEngine() {
  engine ??= import("pdfjs-dist").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
    return pdfjs as unknown as PdfEngine;
  });
  return engine;
}

export async function readPdfInBrowser(file: File): Promise<PdfReadResult> {
  let pdfjs: PdfEngine;
  try {
    pdfjs = await loadEngine();
  } catch {
    // Mất mạng giữa chừng: lần sau thử tải lại thư viện.
    engine = null;
    return {
      ok: false,
      error: {
        code: "damaged",
        title: "Chưa tải được công cụ đọc PDF",
        detail: "Hãy kiểm tra kết nối mạng rồi bấm Thử lại.",
        retry: true,
      },
    };
  }
  return readPdfFile(file, pdfjs, { cMapUrl: "/pdfjs/cmaps/" });
}
