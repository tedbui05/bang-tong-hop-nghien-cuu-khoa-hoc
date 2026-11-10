// Đọc chữ của từng trang trong file PDF, để sau này biết câu trích nằm ở trang nào.
// File này không gắn với trình duyệt hay Node: thư viện pdf.js được truyền vào từ ngoài,
// nên bài test chạy được bằng Node còn trang web chạy trên trình duyệt (xem pdf-browser.ts).

// 20 MB: bài báo thường nặng dưới 5 MB, bài nhiều hình hiếm khi quá 15 MB.
// File nặng hơn thường là sách, luận án hoặc bản scan. Đọc ngay trên máy sinh viên nên không cần thấp hơn.
export const MAX_PDF_BYTES = 20 * 1024 * 1024;

// Trang có ít hơn số chữ cái và chữ số này coi là trang không có chữ (trang ảnh, trang hình).
// Số tạm, sẽ chỉnh sau buổi thử thật.
export const MIN_CHARS_PER_PAGE = 20;

// Dưới một nửa số trang có chữ thì coi là bản scan. Bản scan tải từ thư viện số thường có
// một trang bìa có chữ rồi đến các trang ảnh; bài thật có vài trang toàn hình vẫn đọc được.
export const MIN_TEXT_PAGE_SHARE = 0.5;

// Theo đặc tả PDF, dòng "%PDF-" nằm trong 1024 byte đầu của file.
const HEADER_BYTES = 1024;

// "trang X của file PDF": đếm từ 1 theo thứ tự trong file, có thể lệch với số in trên trang.
export type PdfPage = { page: number; text: string };

// "damaged": file hỏng thật (pdf.js báo cấu trúc PDF sai). "browser": trình duyệt chưa chạy được công cụ đọc PDF
// (thiếu tính năng JavaScript, worker không chạy), file không có lỗi. "read_failed": lỗi khác chưa rõ nguyên nhân.
export type PdfErrorCode = "not_pdf" | "empty" | "too_large" | "password" | "scanned" | "damaged" | "browser" | "read_failed";

// retry: thử lại có ích không (ví dụ mất mạng khi tải công cụ đọc PDF). Lỗi của chính file thì không.
export type PdfError = { code: PdfErrorCode; title: string; detail: string; retry?: boolean };

export type PdfReadResult = { ok: true; pages: PdfPage[] } | { ok: false; error: PdfError };

// Chỉ những phần của pdf.js mà file này dùng, để bài test và trang web truyền vào cùng một kiểu.
type TextItem = { str?: string; hasEOL?: boolean };
type PdfPageProxy = { getTextContent: () => Promise<{ items: TextItem[] }>; cleanup?: () => unknown };
type PdfDocument = { numPages: number; getPage: (n: number) => Promise<PdfPageProxy> };
export type PdfEngine = {
  getDocument: (options: Record<string, unknown>) => { promise: Promise<PdfDocument>; destroy: () => Promise<void> };
};
// cMapUrl: đường dẫn bộ mã chữ (cMap). Thiếu thì nhiều bài tiếng Trung, Nhật, Hàn không lấy được chữ.
// logError: nơi ghi lỗi gốc của pdf.js (trên trình duyệt là console.error), để lần sau tìm được nguyên nhân thật.
export type PdfEngineOptions = { cMapUrl?: string; logError?: (message: string, error: unknown) => void };

type FileLike = Pick<Blob, "size" | "slice" | "arrayBuffer"> & { name: string };

export function formatMegabytes(bytes: number) {
  const mb = bytes / (1024 * 1024);
  return `${mb.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} MB`;
}

export function pdfError(code: PdfErrorCode, fileName: string, size = 0): PdfError {
  switch (code) {
    case "not_pdf":
      return {
        code,
        title: "File này không phải PDF",
        detail: fileName.toLowerCase().endsWith(".pdf")
          ? `“${fileName}” có đuôi .pdf nhưng nội dung bên trong không phải PDF. Có thể file đã bị đổi tên từ loại khác. Hãy tải bản PDF gốc của bài báo.`
          : `“${fileName}” không phải file PDF. Hãy chọn file PDF của bài báo. Nếu bạn có file Word, hãy lưu lại thành PDF trước.`,
      };
    case "empty":
      return {
        code,
        title: "File này trống",
        detail: `“${fileName}” không có nội dung (0 byte). Có thể file tải về chưa xong. Hãy tải lại bài báo rồi chọn lại.`,
      };
    case "too_large":
      return {
        code,
        title: "File quá lớn",
        detail: `“${fileName}” nặng ${formatMegabytes(size)}, quá giới hạn ${formatMegabytes(MAX_PDF_BYTES)}. Bài báo thường nhẹ hơn nhiều; file nặng như vậy thường là sách, luận án hoặc bản scan. Hãy tải riêng bài báo bạn cần.`,
      };
    case "password":
      return {
        code,
        title: "File PDF này có mật khẩu",
        detail:
          "App không mở được file có mật khẩu. Hãy mở file bằng mật khẩu của bạn, lưu lại thành bản không có mật khẩu (ví dụ chọn In rồi Lưu thành PDF), sau đó tải bản mới lên.",
      };
    case "scanned":
      return {
        code,
        title: "App chưa đọc được file scan",
        detail:
          "File này là ảnh chụp các trang nên không có chữ để lấy ra. Hãy tìm bản PDF gốc trên trang của tạp chí, loại bôi đen được chữ.",
      };
    case "damaged":
      return {
        code,
        title: "Chưa đọc được file này",
        detail: `“${fileName}” có thể bị hỏng hoặc tải về chưa trọn. Hãy tải lại bài báo rồi thử lại.`,
      };
    case "browser":
      return {
        code,
        title: "Trình duyệt này chưa đọc được file PDF",
        detail: `Lỗi nằm ở trình duyệt, không phải ở “${fileName}”. Hãy cập nhật Chrome, Edge, Safari hoặc Firefox lên bản mới nhất rồi bấm Thử lại.`,
        retry: true,
      };
    case "read_failed":
      return {
        code,
        title: "Chưa đọc được file này",
        detail: `App gặp lỗi khi đọc “${fileName}”. Hãy bấm Thử lại; nếu vẫn lỗi, hãy thử bằng trình duyệt khác.`,
        retry: true,
      };
  }
}

// Kiểm tra nhanh trước khi đọc: dùng ngay khi sinh viên chọn file để báo lỗi sớm.
// Không đọc cả file, chỉ đọc 1024 byte đầu.
export async function checkPdfFile(file: FileLike): Promise<PdfError | null> {
  if (file.size === 0) return pdfError("empty", file.name);
  if (file.size > MAX_PDF_BYTES) return pdfError("too_large", file.name, file.size);
  // Xem nội dung chứ không tin đuôi file: file Word đổi đuôi thành .pdf vẫn bị chặn,
  // còn file PDF lỡ mất đuôi vẫn đọc được.
  const head = new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer());
  if (!hasPdfHeader(head)) return pdfError("not_pdf", file.name);
  return null;
}

function hasPdfHeader(bytes: Uint8Array) {
  const marker = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
  for (let i = 0; i + marker.length <= bytes.length; i++) {
    if (marker.every((byte, j) => bytes[i + j] === byte)) return true;
  }
  return false;
}

// Ghép các mẩu chữ của một trang. pdf.js đánh dấu chỗ xuống dòng bằng hasEOL; giữ nguyên
// xuống dòng để bước kiểm tra câu trích còn biết chỗ từ bị ngắt bằng gạch nối cuối dòng.
export function joinTextItems(items: TextItem[]) {
  return items.map((item) => (item.str ?? "") + (item.hasEOL ? "\n" : "")).join("");
}

function countChars(text: string) {
  return text.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
}

export function looksScanned(pages: PdfPage[]) {
  if (pages.length === 0) return true;
  const withText = pages.filter((page) => countChars(page.text) >= MIN_CHARS_PER_PAGE).length;
  return withText / pages.length < MIN_TEXT_PAGE_SHARE;
}

// "Tên lỗi: nội dung", kèm phần chi tiết pdf.js gửi về từ worker (details), để ghi vào nhật ký trình duyệt.
export function describeError(error: unknown): string {
  if (!error || typeof error !== "object") return String(error);
  const { name, message, details } = error as { name?: unknown; message?: unknown; details?: unknown };
  return [name, message, details].filter((part) => part !== undefined && part !== "").map(String).join(": ");
}

// pdf.js báo file hỏng bằng các lỗi này. Lỗi khác (ví dụ TypeError khi trình duyệt thiếu tính năng) không phải lỗi của file.
const DAMAGED_FILE_ERRORS = new Set(["InvalidPDFException", "FormatError"]);
const BROWSER_ERROR = /\b(TypeError|ReferenceError|SyntaxError)\b|is not a function|is not defined|fake worker|Worker/;

export function classifyReadError(error: unknown): "damaged" | "browser" | "read_failed" {
  if (DAMAGED_FILE_ERRORS.has(errorName(error))) return "damaged";
  return BROWSER_ERROR.test(describeError(error)) ? "browser" : "read_failed";
}

function errorName(error: unknown) {
  return error && typeof error === "object" && "name" in error ? String(error.name) : "";
}

export async function readPdfFile(file: FileLike, engine: PdfEngine, options: PdfEngineOptions = {}): Promise<PdfReadResult> {
  const basic = await checkPdfFile(file);
  if (basic) return { ok: false, error: basic };

  const data = new Uint8Array(await file.arrayBuffer());
  const task = engine.getDocument({
    data,
    cMapUrl: options.cMapUrl,
    cMapPacked: true,
    // Không chạy mã lấy từ file, không tải phông: chỉ cần lấy chữ.
    isEvalSupported: false,
    disableFontFace: true,
    enableXfa: false,
    verbosity: 0,
  });

  let doc: PdfDocument;
  try {
    doc = await task.promise;
  } catch (error) {
    await task.destroy().catch(() => undefined);
    if (errorName(error) === "PasswordException") return { ok: false, error: pdfError("password", file.name) };
    options.logError?.(`[đọc PDF] Lỗi khi mở "${file.name}"`, error);
    return { ok: false, error: pdfError(classifyReadError(error), file.name) };
  }

  try {
    const pages: PdfPage[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      pages.push({ page: n, text: joinTextItems(content.items) });
      page.cleanup?.();
    }
    if (looksScanned(pages)) return { ok: false, error: pdfError("scanned", file.name) };
    return { ok: true, pages };
  } catch (error) {
    // Một trang đọc lỗi thì báo lỗi cả file, không lặng lẽ bỏ trang: câu trích ở trang đó sẽ bị coi là bịa.
    options.logError?.(`[đọc PDF] Lỗi khi lấy chữ của "${file.name}"`, error);
    return { ok: false, error: pdfError(classifyReadError(error), file.name) };
  } finally {
    // Giải phóng bộ nhớ của pdf.js, kể cả khi đọc lỗi giữa chừng.
    await task.destroy().catch(() => undefined);
  }
}
