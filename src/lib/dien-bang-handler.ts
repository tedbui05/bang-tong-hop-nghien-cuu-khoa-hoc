// Xử lý một yêu cầu điền bảng ở máy chủ: kiểm tra đăng nhập, kiểm tra và đếm lượt, rồi mới gọi AI.
// Các phần gọi ra ngoài (kiểm tra phiên, bộ đếm, gọi AI) được truyền vào, nên test không cần Supabase hay Gemini.
import type { ExtractBody, ExtractResult } from "./ai-extract";
import { readExtractBody } from "./ai-extract";
import { limitError, vietnamDay, type AiLimits, type AiUsageStore } from "./ai-limit";

export type HandlerDeps = {
  // Kiểm tra phiên đăng nhập từ header Authorization. Trả về mã người dùng, hoặc null nếu không hợp lệ.
  verifyUser: (accessToken: string) => Promise<string | null>;
  // null: máy chủ chưa được cài đặt Supabase.
  store: AiUsageStore | null;
  limits: AiLimits;
  extract: (input: ExtractBody) => Promise<ExtractResult>;
  now?: () => number;
  // Ghi thao tác vào bảng app_events (dùng model dự phòng). Lỗi khi ghi không làm hỏng kết quả trả về.
  recordEvent?: (userId: string, event: "dung_model_du_phong", detail: Record<string, string | number>) => Promise<void>;
};

const json = (body: unknown, status = 200) => Response.json(body, { status });

export async function handleDienBang(request: Request, deps: HandlerDeps): Promise<Response> {
  // 1. Phải có phiên đăng nhập hợp lệ (kể cả đăng nhập ẩn danh).
  const header = request.headers.get("authorization") ?? "";
  const token = /^Bearer\s+(.+)$/i.exec(header)?.[1]?.trim() ?? "";
  const userId = token ? await deps.verifyUser(token).catch(() => null) : null;
  if (!userId) return json({ ok: false, error: limitError("not_signed_in"), attempts: 0, usedFallback: false }, 401);

  // 2. Dữ liệu gửi lên phải hợp lệ trước khi tính lượt.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const input = readExtractBody(body);
  if (!input) {
    return json(
      { ok: false, error: { code: "bad_request", title: "Dữ liệu gửi lên không hợp lệ", detail: "Hãy tải lại trang rồi thử lại.", retry: false } },
      400,
    );
  }

  // 3. Đếm lượt ở máy chủ. Không cài được bộ đếm thì không gọi AI, để không ai dùng tràn lượt.
  if (!deps.store) {
    console.error("[gioi-han] thiếu cài đặt Supabase ở máy chủ, không gọi AI");
    return json({ ok: false, error: { code: "not_configured", title: "AI chưa được cài đặt đúng", detail: "Máy chủ của app thiếu thông tin để đếm lượt dùng AI. Hãy báo người quản lý app.", retry: false }, attempts: 0, usedFallback: false }, 503);
  }
  const day = vietnamDay((deps.now ?? Date.now)());
  let claim: Awaited<ReturnType<AiUsageStore["claim"]>>;
  try {
    claim = await deps.store.claim(userId, day, deps.limits);
  } catch {
    console.error("[gioi-han] không đếm được lượt dùng AI");
    return json({ ok: false, error: { code: "failed", title: "Chưa gọi được AI", detail: "App chưa kiểm tra được lượt dùng AI hôm nay. Hãy thử lại sau ít phút.", retry: true }, attempts: 0, usedFallback: false }, 503);
  }
  if (claim !== "ok") {
    // Không ghi mã người dùng vào log.
    console.info("[gioi-han] chặn vì hết lượt", claim === "user" ? "của một người" : "của cả app", day);
    return json(
      { ok: false, error: limitError(claim === "user" ? "limit_user" : "limit_total", deps.limits), attempts: 0, usedFallback: false },
      429,
    );
  }

  // 4. Gọi AI. Chưa gọi lần nào (ví dụ bài quá dài) thì trả lại lượt.
  let result: ExtractResult;
  try {
    result = await deps.extract(input);
  } catch {
    await deps.store.release(userId, day).catch(() => undefined);
    return json({ ok: false, error: { code: "failed", title: "Chưa gọi được AI", detail: "Có lỗi khi gửi bài cho AI. Hãy thử lại sau ít phút.", retry: true }, attempts: 0, usedFallback: false }, 500);
  }
  if (result.attempts === 0) await deps.store.release(userId, day).catch(() => undefined);
  if (result.usedFallback && deps.recordEvent) {
    await deps.recordEvent(userId, "dung_model_du_phong", { model: result.ok ? result.model : "", ket_qua: result.ok ? "duoc" : "loi" }).catch(() => undefined);
  }
  return json(result);
}
