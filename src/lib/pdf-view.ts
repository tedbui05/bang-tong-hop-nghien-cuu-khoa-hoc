// Xem trang PDF gốc để đối chiếu bằng chứng, ngay trên trình duyệt (pdf.js). Chỉ tải khi có người mở xem,
// và giữ lại những gì đã tải (file đã mở, trang đã vẽ, chữ của trang) để lần sau mở nhanh.
// Tô vàng dựa trên lớp chữ của PDF và vị trí câu trích mà code kiểm tra đã tìm ra (AiCell.quote_ranges), không nhờ AI.
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { TextContent, TextItem } from "pdfjs-dist/types/src/display/api";
import { loadPdf } from "./paper-files";
import { joinTextItems } from "./pdf-read";
import type { TextRange } from "./types";

// Bản legacy, giống pdf-browser.ts: chạy được trên trình duyệt cũ hơn.
type PdfLib = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let lib: Promise<PdfLib> | null = null;

function loadLib(): Promise<PdfLib> {
  lib ??= import("pdfjs-dist/legacy/build/pdf.mjs")
    .then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
      return pdfjs;
    })
    .catch((error) => {
      lib = null; // mất mạng: lần sau thử lại
      throw error;
    });
  return lib;
}

// Giữ tối đa chừng này file đang mở. Trang đã vẽ được giữ theo tổng số điểm ảnh (khoảng 160 MB bộ nhớ);
// quá thì bỏ trang dùng lâu nhất.
const MAX_DOCS = 3;
const MAX_CACHED_PIXELS = 40_000_000;
// Một ảnh trang không vượt chừng này điểm ảnh: Safari trên iPhone không vẽ được ảnh lớn hơn khoảng 16,7 triệu điểm.
const MAX_CANVAS_PIXELS = 16_000_000;

const docs = new Map<string, Promise<PDFDocumentProxy | null>>();
const canvases = new Map<string, HTMLCanvasElement>();
const texts = new Map<string, Promise<TextContent>>();

function touch<K, V>(map: Map<K, V>, key: K, value: V) {
  map.delete(key);
  map.set(key, value);
}

// Mở file PDF đã giữ trong trình duyệt. null: không còn file (đã xoá dữ liệu, bài mẫu, trình duyệt chặn bộ nhớ).
export function openPaperPdf(paperId: string): Promise<PDFDocumentProxy | null> {
  const cached = docs.get(paperId);
  if (cached) {
    touch(docs, paperId, cached);
    return cached;
  }
  const opening = (async () => {
    const stored = await loadPdf(paperId);
    if (!stored) return null;
    const pdfjs = await loadLib();
    const data = new Uint8Array(await stored.blob.arrayBuffer());
    return pdfjs.getDocument({
      data,
      cMapUrl: "/pdfjs/cmaps/",
      cMapPacked: true,
      standardFontDataUrl: "/pdfjs/standard_fonts/",
      wasmUrl: "/pdfjs/wasm/",
      enableXfa: false,
      verbosity: 0,
    }).promise;
  })().catch(() => null);
  touch(docs, paperId, opening);
  // Không giữ kết quả "không có file", để tải lại file xong là mở được ngay.
  void opening.then((doc) => {
    if (!doc) docs.delete(paperId);
  });
  while (docs.size > MAX_DOCS) {
    const [oldest, promise] = docs.entries().next().value!;
    docs.delete(oldest);
    void promise.then((doc) => doc?.loadingTask.destroy());
    forgetPages(oldest);
  }
  return opening;
}

function forgetPages(paperId: string) {
  for (const key of [...canvases.keys()]) if (key.startsWith(`${paperId}:`)) canvases.delete(key);
  for (const key of [...texts.keys()]) if (key.startsWith(`${paperId}:`)) texts.delete(key);
}

// Sau khi sinh viên tải lại file PDF: bỏ bản cũ khỏi bộ nhớ.
export function forgetPaperPdf(paperId: string) {
  const cached = docs.get(paperId);
  docs.delete(paperId);
  void cached?.then((doc) => doc?.loadingTask.destroy());
  forgetPages(paperId);
}

export async function pageSize(doc: PDFDocumentProxy, pageNumber: number): Promise<{ width: number; height: number }> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  return { width: viewport.width, height: viewport.height };
}

function pageText(paperId: string, page: PDFPageProxy): Promise<TextContent> {
  const key = `${paperId}:${page.pageNumber}`;
  let text = texts.get(key);
  // Lấy chữ đúng như lúc đọc bài (pdf-read.ts), để vị trí ký tự khớp với quote_ranges.
  if (!text) {
    text = page.getTextContent();
    texts.set(key, text);
  }
  return text;
}

function cachedPixels() {
  let total = 0;
  for (const canvas of canvases.values()) total += canvas.width * canvas.height;
  return total;
}

async function drawCanvas(paperId: string, page: PDFPageProxy, scale: number): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale });
  // Màn hình mật độ cao vẽ nét hơn, nhưng giảm lại khi phóng to để ảnh không quá lớn.
  const ratio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(MAX_CANVAS_PIXELS / (viewport.width * viewport.height)));
  const key = `${paperId}:${page.pageNumber}:${scale.toFixed(3)}:${ratio.toFixed(3)}`;
  const cached = canvases.get(key);
  if (cached) {
    touch(canvases, key, cached);
    return cached;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width * ratio);
  canvas.height = Math.floor(viewport.height * ratio);
  await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport, transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined })
    .promise;
  touch(canvases, key, canvas);
  while (canvases.size > 1 && cachedPixels() > MAX_CACHED_PIXELS) {
    const oldest = canvases.keys().next().value!;
    const dropped = canvases.get(oldest)!;
    canvases.delete(oldest);
    // Trả bộ nhớ ngay, không chờ trình duyệt tự dọn.
    dropped.width = dropped.height = 0;
  }
  return canvas;
}

export type RenderedPage = {
  marks: HTMLElement[];
  // false: trang có câu trích nhưng không tô được (chữ của trang khác chữ đã lưu lúc đọc bài).
  marked: boolean;
};

// Vẽ một trang vào khung: ảnh trang, lớp chữ trong suốt (bôi đen, chép được) và các đoạn tô vàng.
export async function renderPdfPage(
  container: HTMLElement,
  paperId: string,
  doc: PDFDocumentProxy,
  pageNumber: number,
  scale: number,
  ranges: TextRange[],
  isCurrent: () => boolean,
  // Chữ của trang đã lưu lúc đọc bài. Vị trí tô tính trên chữ này: khác chữ lấy lại thì không tô, tránh tô lệch chỗ.
  expectedText?: string,
): Promise<RenderedPage | null> {
  const pdfjs = await loadLib();
  const page = await doc.getPage(pageNumber);
  const [source, content] = await Promise.all([drawCanvas(paperId, page, scale), pageText(paperId, page)]);
  if (!isCurrent()) return null;
  const viewport = page.getViewport({ scale });

  // Vẽ lại trên một canvas mới (chép từ bản đã giữ), để một trang hiện được ở hai nơi cùng lúc.
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  canvas.getContext("2d")!.drawImage(source, 0, 0);
  canvas.className = "pdf-page__canvas";
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  canvas.setAttribute("aria-hidden", "true");

  const layer = document.createElement("div");
  layer.className = "textLayer";
  // Chữ gốc của bài: không cho trình duyệt tự dịch.
  layer.setAttribute("translate", "no");
  container.replaceChildren(canvas, layer);
  container.style.width = `${viewport.width}px`;
  container.style.height = `${viewport.height}px`;
  container.style.setProperty("--total-scale-factor", String(scale));
  container.style.setProperty("--scale-factor", String(scale));
  container.style.setProperty("--scale-round-x", "1px");
  container.style.setProperty("--scale-round-y", "1px");

  const textLayer = new pdfjs.TextLayer({ textContentSource: content, container: layer, viewport });
  await textLayer.render();
  if (!isCurrent()) return null;

  const items = content.items.filter((item): item is TextItem => "str" in item);
  const own = ranges.filter((range) => range.page === pageNumber);
  if (!own.length) return { marks: [], marked: true };
  if (expectedText !== undefined && joinTextItems(items) !== expectedText) return { marks: [], marked: false };
  const marks = markRanges(textLayer.textDivs, items, own);
  return { marks, marked: marks.length > 0 };
}


// Đoạn cần tô trong từng mẩu chữ của pdf.js. Vị trí tính theo chữ của trang = joinTextItems(items)
// (pdf-read.ts): nối các mẩu, thêm một dấu xuống dòng sau mẩu có hasEOL.
export type ItemCut = { index: number; from: number; to: number; whole: boolean };

export function rangeCuts(items: Pick<TextItem, "str" | "hasEOL">[], ranges: TextRange[]): ItemCut[] {
  const cuts: ItemCut[] = [];
  let offset = 0;
  items.forEach((item, index) => {
    const start = offset;
    const text = item.str ?? "";
    offset += text.length + (item.hasEOL ? 1 : 0);
    if (!text) return;
    const own = ranges
      .map((range) => ({ from: Math.max(range.start, start) - start, to: Math.min(range.end, start + text.length) - start }))
      .filter((cut) => cut.to > cut.from)
      .sort((x, y) => x.from - y.from);
    for (const cut of own) cuts.push({ index, ...cut, whole: cut.from === 0 && cut.to === text.length });
  });
  return cuts;
}

// Mẩu nằm trọn trong đoạn thì tô cả thẻ, mẩu nằm một phần thì tách thành chữ thường và thẻ mark.
export function markRanges(divs: HTMLElement[], items: TextItem[], ranges: TextRange[]): HTMLElement[] {
  if (!ranges.length || divs.length !== items.length) return [];
  const marks: HTMLElement[] = [];
  const byItem = new Map<number, ItemCut[]>();
  for (const cut of rangeCuts(items, ranges)) byItem.set(cut.index, [...(byItem.get(cut.index) ?? []), cut]);
  for (const [index, cuts] of byItem) {
    const div = divs[index];
    const text = items[index].str;
    if (!div) continue;
    if (cuts.length === 1 && cuts[0].whole) {
      div.classList.add("pdf-mark");
      marks.push(div);
      continue;
    }
    const parts: Node[] = [];
    let at = 0;
    for (const cut of cuts) {
      if (cut.from < at) continue;
      if (cut.from > at) parts.push(document.createTextNode(text.slice(at, cut.from)));
      const mark = document.createElement("mark");
      mark.className = "pdf-mark";
      mark.textContent = text.slice(cut.from, cut.to);
      parts.push(mark);
      marks.push(mark);
      at = cut.to;
    }
    if (at < text.length) parts.push(document.createTextNode(text.slice(at)));
    div.replaceChildren(...parts);
  }
  return marks;
}
