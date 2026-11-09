// Xử lý một bài trong hàng chờ: đọc chữ của PDF, giữ file trong trình duyệt, gửi cho AI, kiểm tra câu trích.
// Các bước gọi ra ngoài (đọc PDF, gọi máy chủ, lưu file) được truyền vào, nên test dùng bản giả, không gọi AI thật.
import type { ExtractResult } from "./ai-extract";
import { aiColumns, buildReviewSession, NETWORK_ERROR, SERVER_ERROR, type QueueError, type ReviewSession } from "./paper-pipeline";
import type { PdfPage, PdfReadResult } from "./pdf-read";
import type { StoredPdf } from "./paper-files";
import type { TableColumn } from "./types";
import { verifyCells } from "./verify-quote";

export type ProcessStage = "reading" | "ai" | "checking";

export type ProcessDeps = {
  readPdf: (file: File) => Promise<PdfReadResult>;
  // Gửi cho /api/dien-bang. Ném lỗi khi mất mạng.
  callApi: (body: { columns: ReturnType<typeof aiColumns>; pages: PdfPage[]; fileName: string }) => Promise<unknown>;
  hash: (data: ArrayBuffer) => Promise<string>;
  savePdf: (id: string, pdf: StoredPdf) => Promise<boolean>;
  savePages: (id: string, pages: PdfPage[]) => Promise<boolean>;
};

export type FileMeta = { name: string; size: number; hash: string };

// stored: file PDF và chữ của trang đã được giữ trong trình duyệt, nên bài lỗi vẫn nằm lại trong hàng chờ sau khi
// tải lại trang và bấm Thử lại được mà không cần chọn lại file.
export type ProcessOutcome =
  | { ok: true; session: ReviewSession; pdfSaved: boolean }
  | { ok: false; error: QueueError; stored: FileMeta | null };

// Bài đã đọc và giữ trước đó (bấm Thử lại sau khi tải lại trang): truyền chữ của trang thay cho file.
type Source = { file: File; pages?: undefined; fileMeta?: undefined } | { file?: undefined; pages: PdfPage[]; fileMeta: FileMeta };

type Input = { id: string; tableId: string; columns: TableColumn[]; onStage: (stage: ProcessStage) => void } & Source;

function isExtractResult(value: unknown): value is ExtractResult {
  if (typeof value !== "object" || value === null || !("ok" in value)) return false;
  const data = value as Record<string, unknown>;
  if (data.ok === true) {
    const answer = data.answer as Record<string, unknown> | undefined;
    return typeof data.model === "string" && Array.isArray(answer?.cells) && typeof answer?.info === "object";
  }
  const error = data.error as Record<string, unknown> | undefined;
  return data.ok === false && typeof error?.title === "string" && typeof error?.detail === "string";
}

export async function processPaper(input: Input, deps: ProcessDeps): Promise<ProcessOutcome> {
  const { id, tableId, columns, onStage } = input;
  let pages: PdfPage[];
  let fileMeta: FileMeta | undefined;
  let pdfSaved = false;

  if (input.pages) {
    // Bài đã đọc và giữ từ trước: dùng lại, không đọc file nữa.
    pages = input.pages;
    fileMeta = input.fileMeta;
    pdfSaved = true;
  } else {
    const file = input.file;
    // 1. Đọc chữ từng trang ngay trên trình duyệt.
    onStage("reading");
    const read = await deps.readPdf(file);
    if (!read.ok) return { ok: false, error: { title: read.error.title, detail: read.error.detail, retry: read.error.retry ?? false }, stored: null };
    pages = read.pages;

    // 2. Giữ file gốc và chữ của trang để xem bằng chứng. Không giữ được (trình duyệt chặn) thì vẫn làm tiếp.
    try {
      const hash = await deps.hash(await file.arrayBuffer());
      fileMeta = { name: file.name, size: file.size, hash };
      const [pdfOk, pagesOk] = await Promise.all([deps.savePdf(id, { blob: file, ...fileMeta }), deps.savePages(id, pages)]);
      pdfSaved = pdfOk && pagesOk;
    } catch {
      pdfSaved = false;
    }
  }
  const stored = pdfSaved && fileMeta ? fileMeta : null;
  const fileName = fileMeta?.name ?? input.file?.name ?? "";

  // 3. Gửi cho AI (qua máy chủ, key không bao giờ nằm ở trình duyệt).
  onStage("ai");
  let raw: unknown;
  try {
    raw = await deps.callApi({ columns: aiColumns(columns), pages, fileName });
  } catch {
    return { ok: false, error: NETWORK_ERROR, stored };
  }
  if (!isExtractResult(raw)) return { ok: false, error: SERVER_ERROR, stored };
  if (!raw.ok) return { ok: false, error: { title: raw.error.title, detail: raw.error.detail, retry: raw.error.retry }, stored };

  // 4. Kiểm tra câu trích bằng code thường, trên chữ thật của bài.
  onStage("checking");
  const checkedCells = verifyCells(raw.answer.cells, pages);
  const session = buildReviewSession({
    id,
    tableId,
    columns,
    fileName,
    file: fileMeta,
    pages,
    answer: raw.answer,
    checkedCells,
    filledBy: { model: raw.model, fallback: raw.usedFallback },
  });
  return { ok: true, session, pdfSaved };
}
