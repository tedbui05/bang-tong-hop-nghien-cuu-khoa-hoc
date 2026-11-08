// Gọi Gemini. Chỉ chạy trên máy chủ: key nằm trong biến môi trường, không bao giờ gửi cho trình duyệt.
// Không ghi key, câu lệnh hay lời gốc của máy chủ Gemini vào log, chỉ ghi mã lỗi HTTP.
import "server-only";
import type { CallModel, ModelResult } from "./ai-extract";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

// Bài 30.000 ký tự có thể mất một đến hai phút với model có bước suy nghĩ.
const TIMEOUT_MS = 180_000;

// Mức suy nghĩ của model Gemini 3 trước khi trả lời. Mặc định "low": nhanh và tốn ít lượt hơn mức
// mặc định của model ("medium"); việc điền bảng chủ yếu là tìm và chép câu trong bài nên không cần suy luận sâu.
// Đặt GEMINI_THINKING_LEVEL (low, medium, high) để thử mức khác. Model Gemini 2.5 không nhận cài đặt này.
const THINKING_LEVELS = new Set(["minimal", "low", "medium", "high"]);
function thinkingLevel() {
  const level = process.env.GEMINI_THINKING_LEVEL?.trim().toLowerCase();
  return level && THINKING_LEVELS.has(level) ? level : "low";
}

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
};

export const callGemini: CallModel = async ({ systemInstruction, userText, responseSchema }) => {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;
  if (!key || !model) {
    console.error("[gemini] thiếu GEMINI_API_KEY hoặc GEMINI_MODEL");
    return { ok: false, kind: "not_configured" };
  }

  const started = Date.now();
  const seconds = () => `${((Date.now() - started) / 1000).toFixed(1)} giây`;
  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      // Key gửi trong header, không nằm trên đường dẫn, để không lọt vào log của máy chủ trung gian.
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: userText }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema,
          thinkingConfig: { thinkingLevel: thinkingLevel() },
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    console.error("[gemini] không nhận được trả lời sau", seconds(), timedOut ? "(quá thời gian chờ)" : "");
    return { ok: false, kind: timedOut ? "timeout" : "failed" };
  }

  if (!response.ok) {
    console.error("[gemini] lỗi HTTP", response.status, "sau", seconds());
    // 429: hết lượt miễn phí hoặc gửi quá nhanh. 503: máy chủ Gemini đang quá tải.
    if (response.status === 429 || response.status === 503) return { ok: false, kind: "overloaded" };
    // 401, 403: key sai hoặc không có quyền. 404: tên model sai hoặc model đã ngừng cho người dùng mới.
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      console.error("[gemini] kiểm tra lại GEMINI_API_KEY và GEMINI_MODEL");
      return { ok: false, kind: "not_configured" };
    }
    return { ok: false, kind: "failed" };
  }

  let data: GeminiResponse;
  try {
    data = (await response.json()) as GeminiResponse;
  } catch {
    console.error("[gemini] câu trả lời không đọc được, sau", seconds());
    return { ok: false, kind: "failed" };
  }
  console.info("[gemini] HTTP", response.status, "sau", seconds());
  return readCandidate(data);
};

function readCandidate(data: GeminiResponse): ModelResult {
  if (data.promptFeedback?.blockReason) {
    console.error("[gemini] bị chặn:", data.promptFeedback.blockReason);
    return { ok: false, kind: "blocked" };
  }
  const candidate = data.candidates?.[0];
  const reason = candidate?.finishReason;
  if (reason === "SAFETY" || reason === "RECITATION" || reason === "PROHIBITED_CONTENT" || reason === "BLOCKLIST") {
    console.error("[gemini] dừng vì:", reason);
    return { ok: false, kind: "blocked" };
  }
  // Bỏ phần suy nghĩ của model nếu có, chỉ lấy câu trả lời.
  const text = (candidate?.content?.parts ?? [])
    .filter((part) => !part.thought)
    .map((part) => part.text ?? "")
    .join("");
  if (reason && reason !== "STOP") console.error("[gemini] dừng vì:", reason);
  // Câu trả lời rỗng hay bị cắt ngang sẽ bị coi là sai khuôn ở bước sau và được gửi lại một lần.
  return { ok: true, text };
}
