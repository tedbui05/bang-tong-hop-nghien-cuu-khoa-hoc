// Điều phối một lần AI điền bảng: cắt tài liệu tham khảo, dựng câu lệnh, gọi AI, kiểm tra khuôn,
// gửi lại một lần nếu sai khuôn, và đổi mọi lỗi thành câu tiếng Việt dễ hiểu.
// Hàm gọi AI được truyền vào từ ngoài, nên bài test dùng câu trả lời giả, không gọi Gemini thật.
import { parseAiAnswer, type AiAnswer } from "./ai-answer";
import { SYSTEM_INSTRUCTION, buildResponseSchema, buildUserText, makeAiRequest, type AiColumn } from "./ai-prompt";
import type { PdfPage } from "./pdf-read";
import { MAX_PAPER_CHARS, countPaperChars, stripReferences } from "./strip-references";

export type ModelCall = {
  systemInstruction: string;
  userText: string;
  responseSchema: unknown;
};

// Kết quả của một lần gọi AI, đã bỏ mọi chi tiết kỹ thuật (không có key, không có lời gốc của máy chủ AI).
export type ModelResult =
  | { ok: true; text: string }
  | { ok: false; kind: "overloaded" | "blocked" | "timeout" | "not_configured" | "failed" };

export type CallModel = (call: ModelCall) => Promise<ModelResult>;

export type ExtractErrorCode =
  | "overloaded"
  | "bad_format"
  | "too_long"
  | "no_text"
  | "blocked"
  | "timeout"
  | "not_configured"
  | "failed";

// retry: có hiện nút "Thử lại" hay không.
export type ExtractError = { code: ExtractErrorCode; title: string; detail: string; retry: boolean };

export type ExtractResult =
  | { ok: true; answer: AiAnswer; attempts: number; removedReferences: { fromPage: number; toPage: number } | null }
  | { ok: false; error: ExtractError; attempts: number };

export const OVERLOADED_MESSAGE = "Hệ thống đang quá tải, vui lòng thử lại sau ít phút";

export function extractError(code: ExtractErrorCode, chars = 0): ExtractError {
  switch (code) {
    case "overloaded":
      return { code, title: OVERLOADED_MESSAGE, detail: "AI đang nhận quá nhiều yêu cầu hoặc đã hết lượt dùng miễn phí. Bài của bạn chưa bị mất.", retry: true };
    case "bad_format":
      return {
        code,
        title: "AI trả lời sai định dạng",
        detail: "App đã hỏi lại một lần nhưng AI vẫn trả lời sai khuôn, nên chưa điền được bảng. Hãy thử lại sau.",
        retry: true,
      };
    case "too_long":
      return {
        code,
        title: "Bài quá dài",
        detail: `Sau khi bỏ phần tài liệu tham khảo, bài vẫn còn ${chars.toLocaleString("vi-VN")} ký tự, quá giới hạn ${MAX_PAPER_CHARS.toLocaleString("vi-VN")} ký tự (giới hạn tạm của bản thử). Hãy tải riêng bài báo bạn cần, không tải cả sách hay luận án.`,
        retry: false,
      };
    case "no_text":
      return { code, title: "Bài không còn chữ để đọc", detail: "Sau khi bỏ phần tài liệu tham khảo, bài không còn chữ nào. Hãy kiểm tra lại file PDF.", retry: false };
    case "blocked":
      return { code, title: "AI không đọc bài này", detail: "AI từ chối xử lý nội dung của bài. Hãy thử với bài khác, hoặc tự điền bảng.", retry: false };
    case "timeout":
      return { code, title: "AI trả lời quá lâu", detail: "Đã chờ quá lâu mà chưa có kết quả. Hãy kiểm tra kết nối mạng rồi thử lại.", retry: true };
    case "not_configured":
      return { code, title: "AI chưa được cài đặt đúng", detail: "Máy chủ của app thiếu hoặc sai thông tin để gọi AI. Hãy báo người quản lý app.", retry: false };
    case "failed":
      return { code, title: "Chưa gọi được AI", detail: "Có lỗi khi gửi bài cho AI. Hãy thử lại sau ít phút.", retry: true };
  }
}

// Sai khuôn thì gửi lại đúng một lần.
const MAX_ATTEMPTS = 2;

export async function extractPaper(columns: AiColumn[], pages: PdfPage[], callModel: CallModel): Promise<ExtractResult> {
  const stripped = stripReferences(pages);
  const chars = countPaperChars(stripped.pages);
  if (chars > MAX_PAPER_CHARS) return { ok: false, error: extractError("too_long", chars), attempts: 0 };
  if (!stripped.pages.some((page) => page.text.trim())) return { ok: false, error: extractError("no_text"), attempts: 0 };

  const request = makeAiRequest(columns, stripped.pages);
  const responseSchema = buildResponseSchema(request);
  let problem: string | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await callModel({ systemInstruction: SYSTEM_INSTRUCTION, userText: buildUserText(request, problem), responseSchema });
    // Hết lượt, quá tải hay lỗi mạng thì không tự gửi lại: báo ngay để sinh viên bấm "Thử lại".
    if (!result.ok) return { ok: false, error: extractError(result.kind), attempts: attempt };
    const parsed = parseAiAnswer(result.text, request);
    if (parsed.ok) return { ok: true, answer: parsed.answer, attempts: attempt, removedReferences: stripped.removed };
    problem = parsed.problem;
  }
  return { ok: false, error: extractError("bad_format"), attempts: MAX_ATTEMPTS };
}

// Kiểm tra dữ liệu trang web gửi lên trước khi gọi AI. Giới hạn rộng hơn nhiều so với bài thật,
// chỉ để chặn yêu cầu bất thường làm tốn lượt AI.
const MAX_COLUMNS = 60;
const MAX_FIELD_CHARS = 1_000;
const MAX_PAGES = 2_000;
const MAX_RAW_CHARS = 2_000_000;
const COLUMN_KINDS = new Set(["info", "content", "note", "tags"]);
const INFO_KEYS = new Set(["title", "authors", "year", "source", "language"]);

export type ExtractBody = { columns: AiColumn[]; pages: PdfPage[] };

export function readExtractBody(data: unknown): ExtractBody | null {
  if (typeof data !== "object" || data === null) return null;
  const { columns, pages } = data as Record<string, unknown>;
  if (!Array.isArray(columns) || columns.length > MAX_COLUMNS) return null;
  if (!Array.isArray(pages) || pages.length === 0 || pages.length > MAX_PAGES) return null;

  const cleanColumns: AiColumn[] = [];
  for (const column of columns) {
    if (typeof column !== "object" || column === null) return null;
    const { id, name, description, kind, infoKey } = column as Record<string, unknown>;
    if (typeof id !== "string" || !id || id.length > 200) return null;
    if (typeof name !== "string" || name.length > MAX_FIELD_CHARS) return null;
    if (typeof description !== "string" || description.length > MAX_FIELD_CHARS) return null;
    if (typeof kind !== "string" || !COLUMN_KINDS.has(kind)) return null;
    if (infoKey !== undefined && (typeof infoKey !== "string" || !INFO_KEYS.has(infoKey))) return null;
    cleanColumns.push({ id, name, description, kind: kind as AiColumn["kind"], infoKey: infoKey as AiColumn["infoKey"] });
  }

  const cleanPages: PdfPage[] = [];
  let total = 0;
  for (const page of pages) {
    if (typeof page !== "object" || page === null) return null;
    const { page: number, text } = page as Record<string, unknown>;
    if (typeof number !== "number" || !Number.isInteger(number) || number < 1) return null;
    if (typeof text !== "string") return null;
    total += text.length;
    if (total > MAX_RAW_CHARS) return null;
    cleanPages.push({ page: number, text });
  }
  return { columns: cleanColumns, pages: cleanPages };
}
