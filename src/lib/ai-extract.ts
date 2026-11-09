// Điều phối một lần AI điền bảng: cắt tài liệu tham khảo, dựng câu lệnh, gọi AI, kiểm tra khuôn,
// gửi lại một lần nếu sai khuôn, chuyển sang model dự phòng nếu model chính quá tải,
// và đổi mọi lỗi thành câu tiếng Việt dễ hiểu.
// Hàm gọi AI được truyền vào từ ngoài, nên bài test dùng câu trả lời giả, không gọi Gemini thật.
import { parseAiAnswer, type AiAnswer } from "./ai-answer";
import { SYSTEM_INSTRUCTION, buildResponseSchema, buildUserText, makeAiRequest, type AiColumn } from "./ai-prompt";
import { logEvent } from "./events";
import type { PdfPage } from "./pdf-read";
import { MAX_PAPER_CHARS, countPaperChars, stripReferences } from "./strip-references";

export type ModelCall = {
  // Tên model cần gọi, ví dụ "gemini-3.6-flash".
  model: string;
  // Chờ tối đa bao lâu (mili giây). Quá thời gian thì kết quả là "timeout".
  timeoutMs: number;
  systemInstruction: string;
  userText: string;
  responseSchema: unknown;
};

// Kết quả của một lần gọi AI, đã bỏ mọi chi tiết kỹ thuật (không có key, không có lời gốc của máy chủ AI).
// "quota": Google báo rõ đã hết lượt miễn phí trong ngày của model đó.
export type ModelErrorKind = "overloaded" | "quota" | "blocked" | "timeout" | "not_configured" | "failed";

export type ModelResult = { ok: true; text: string } | { ok: false; kind: ModelErrorKind };

export type CallModel = (call: ModelCall) => Promise<ModelResult>;

export type ExtractErrorCode =
  | "overloaded"
  | "quota"
  | "bad_format"
  | "too_long"
  | "no_text"
  | "blocked"
  | "timeout"
  | "not_configured"
  | "failed";

// retry: có hiện nút "Thử lại" hay không.
export type ExtractError = { code: ExtractErrorCode; title: string; detail: string; retry: boolean };

// Model chính và model dự phòng, lấy từ biến môi trường GEMINI_MODEL và GEMINI_FALLBACK_MODEL.
// primaryTimeoutMs lấy từ GEMINI_TIMEOUT_SECONDS: model chính quá thời gian này thì chuyển sang dự phòng.
export type AiModels = { primary: string; fallback?: string | null; primaryTimeoutMs?: number; fallbackTimeoutMs?: number };

// Giới hạn thời gian chờ model chính, tính bằng giây. SỐ TẠM, đổi bằng biến môi trường GEMINI_TIMEOUT_SECONDS.
// 150 giây vì phần lớn bài sinh viên đọc là tiếng Anh và dài: bài tiếng Anh mẫu mất 131 giây với gemini-3.6-flash
// (9/11/2026), để thấp hơn thì đa số bài bị đẩy sang model dự phòng dễ sai hơn. Khi quá tải, Google thường
// báo 503 ngay nên app vẫn chuyển sang dự phòng nhanh.
export const DEFAULT_PRIMARY_TIMEOUT_SECONDS = 150;

// Màn hình chờ: sau chừng này giây thì đổi dòng chữ, để sinh viên không tưởng app bị treo.
export const LONG_WAIT_SECONDS = 60;

export function waitingMessage(elapsedSeconds: number): string {
  return elapsedSeconds < LONG_WAIT_SECONDS ? "AI đang đọc bài, có thể mất 1 đến 2 phút" : "AI đang đọc bài dài, có thể mất thêm 1 đến 2 phút";
}

// Model dự phòng là đường cuối cùng nên được chờ lâu hơn.
export const FALLBACK_TIMEOUT_SECONDS = 180;
// Chặn giá trị vô lý: tối thiểu 1 giây, tối đa 10 phút.
const MAX_TIMEOUT_SECONDS = 600;

// Đọc số giây từ biến môi trường. Bỏ trống hoặc ghi sai thì dùng mặc định.
export function readTimeoutSeconds(raw: string | undefined, fallbackSeconds: number): number {
  const value = Number(raw?.trim());
  if (!raw?.trim() || !Number.isFinite(value) || value <= 0) return fallbackSeconds;
  return Math.min(Math.max(value, 1), MAX_TIMEOUT_SECONDS);
}

export type ExtractResult =
  | {
      ok: true;
      answer: AiAnswer;
      // Tổng số lần gọi AI, tính cả model chính và model dự phòng.
      attempts: number;
      // Model đã điền bài này, và có phải model dự phòng không.
      model: string;
      usedFallback: boolean;
      removedReferences: { fromPage: number; toPage: number } | null;
    }
  | { ok: false; error: ExtractError; attempts: number; usedFallback: boolean };

export const OVERLOADED_MESSAGE = "Hệ thống đang quá tải, vui lòng thử lại sau ít phút";

export function extractError(code: ExtractErrorCode, chars = 0): ExtractError {
  switch (code) {
    case "overloaded":
      return { code, title: OVERLOADED_MESSAGE, detail: "AI đang nhận quá nhiều yêu cầu hoặc đã hết lượt dùng miễn phí. Bài của bạn chưa bị mất.", retry: true };
    case "quota":
      return {
        code,
        title: "Đã hết lượt AI miễn phí hôm nay",
        detail: "Google cấp lại lượt miễn phí mỗi ngày. Bài của bạn chưa bị mất, hãy bấm Thử lại vào ngày mai.",
        retry: true,
      };
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

// Sai khuôn thì gửi lại đúng một lần, cho chính model vừa trả lời.
const MAX_ATTEMPTS = 2;

// Model chính gặp các lỗi này thì chuyển sang model dự phòng: máy chủ quá tải, hết lượt, hoặc chờ quá lâu.
// Lượt miễn phí của Google tính riêng cho từng model, nên model chính hết lượt thì model dự phòng vẫn có thể còn.
// Lỗi khác (key sai, bị chặn, sai khuôn) thì model dự phòng cũng không giúp được, nên báo luôn.
const SWITCH_TO_FALLBACK = new Set<ModelErrorKind>(["overloaded", "quota", "timeout"]);

type ModelRun =
  | { ok: true; answer: AiAnswer; attempts: number }
  | { ok: false; code: ExtractErrorCode; attempts: number; switchable: boolean };

export async function extractPaper(columns: AiColumn[], pages: PdfPage[], callModel: CallModel, models: AiModels): Promise<ExtractResult> {
  const stripped = stripReferences(pages);
  const chars = countPaperChars(stripped.pages);
  if (chars > MAX_PAPER_CHARS) return { ok: false, error: extractError("too_long", chars), attempts: 0, usedFallback: false };
  if (!stripped.pages.some((page) => page.text.trim())) {
    return { ok: false, error: extractError("no_text"), attempts: 0, usedFallback: false };
  }

  const request = makeAiRequest(columns, stripped.pages);
  const responseSchema = buildResponseSchema(request);

  // Gọi một model: sai khuôn thì gửi lại một lần cho chính model đó, kèm lý do sai.
  async function runModel(model: string, timeoutMs: number): Promise<ModelRun> {
    let problem: string | undefined;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const result = await callModel({
        model,
        timeoutMs,
        systemInstruction: SYSTEM_INSTRUCTION,
        userText: buildUserText(request, problem),
        responseSchema,
      });
      if (!result.ok) return { ok: false, code: result.kind, attempts: attempt, switchable: SWITCH_TO_FALLBACK.has(result.kind) };
      const parsed = parseAiAnswer(result.text, request);
      if (parsed.ok) return { ok: true, answer: parsed.answer, attempts: attempt };
      problem = parsed.problem;
    }
    return { ok: false, code: "bad_format", attempts: MAX_ATTEMPTS, switchable: false };
  }

  const done = (run: ModelRun & { ok: true }, model: string, usedFallback: boolean, attempts: number): ExtractResult => ({
    ok: true,
    answer: run.answer,
    attempts,
    model,
    usedFallback,
    removedReferences: stripped.removed,
  });

  // 1. Gọi model chính.
  const primary = await runModel(models.primary, models.primaryTimeoutMs ?? DEFAULT_PRIMARY_TIMEOUT_SECONDS * 1000);
  if (primary.ok) return done(primary, models.primary, false, primary.attempts);

  // 2. Model chính quá tải hoặc quá giờ, và có model dự phòng: gọi model dự phòng đúng một lần.
  const fallback = models.fallback?.trim();
  if (primary.switchable && fallback && fallback !== models.primary) {
    console.info("[ai] model chính quá tải hoặc quá giờ, chuyển sang model dự phòng");
    const second = await runModel(fallback, models.fallbackTimeoutMs ?? FALLBACK_TIMEOUT_SECONDS * 1000);
    const attempts = primary.attempts + second.attempts;
    // Nhật ký đo chỉ số: mỗi lần dùng model dự phòng, kèm lý do và kết quả.
    logEvent("dung_model_du_phong", { model: fallback, ly_do: primary.code, ket_qua: second.ok ? "duoc" : "loi" });
    if (second.ok) return done(second, fallback, true, attempts);
    // Model dự phòng sai khuôn thì báo sai khuôn; lỗi khác thì báo quá tải như cũ, kèm nút Thử lại.
    // Cả hai model đều hết lượt trong ngày thì báo hết lượt, để sinh viên biết thử lại ngay cũng không được.
    const code = second.code === "bad_format" ? "bad_format" : primary.code === "quota" && second.code === "quota" ? "quota" : "overloaded";
    return { ok: false, error: extractError(code), attempts, usedFallback: true };
  }

  // 3. Không có model dự phòng, hoặc lỗi mà model dự phòng không giúp được: báo luôn.
  // Hết lượt, quá tải hay lỗi mạng thì không tự gửi lại: sinh viên bấm "Thử lại".
  return { ok: false, error: extractError(primary.code), attempts: primary.attempts, usedFallback: false };
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
