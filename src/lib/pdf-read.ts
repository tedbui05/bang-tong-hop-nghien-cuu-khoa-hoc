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

export type PdfErrorCode = "not_pdf" | "empty" | "too_large" | "password" | "scanned" | "damaged";

export type PdfError = { code: PdfErrorCode; title: string; detail: string };

export type PdfReadResult = { ok: true; pages: PdfPage[] } | { ok: false; error: PdfError };

// Chỉ những phần của pdf.js mà file này dùng, để bài test và trang web truyền vào cùng một kiểu.
type TextItem = { str?: string; hasEOL?: boolean };
type PdfPageProxy = { getTextContent: () => Promise<{ items: TextItem[] }>; cleanup?: () => unknown };
type PdfDocument = { numPages: number; getPage: (n: number) => Promise<PdfPageProxy> };
export type PdfEngine = {
  getDocument: (options: Record<string, unknown>) => { promise: Promise<PdfDocument>; destroy: () => Promise<void> };
};
// Đường dẫn bộ mã chữ (cMap). Thiếu thì nhiều bài tiếng Trung, Nhật, Hàn không lấy được chữ.
export type PdfEngineOptions = { cMapUrl?: string };

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
        title: "Bản đầu tiên chưa đọc được file scan",
        detail:
          "File này là ảnh chụp các trang nên không có chữ để lấy ra. Hãy tìm bản PDF gốc trên trang của tạp chí, loại bôi đen được chữ.",
      };
    case "damaged":
      return {
        code,
        title: "Chưa đọc được file này",
        detail: `“${fileName}” có thể bị hỏng hoặc tải về chưa trọn. Hãy tải lại bài báo rồi thử lại.`,
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
    return { ok: false, error: pdfError(errorName(error) === "PasswordException" ? "password" : "damaged", file.name) };
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
  } catch {
    // Một trang đọc lỗi thì báo lỗi cả file, không lặng lẽ bỏ trang: câu trích ở trang đó sẽ bị coi là bịa.
    return { ok: false, error: pdfError("damaged", file.name) };
  } finally {
    // Giải phóng bộ nhớ của pdf.js, kể cả khi đọc lỗi giữa chừng.
    await task.destroy().catch(() => undefined);
  }
}
