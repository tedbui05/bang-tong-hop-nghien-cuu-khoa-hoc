// Máy chủ trả số liệu cho trang /metrics. Chỉ người biết mật khẩu METRICS_MAT_KHAU mới xem được.
// Các phần gọi ra ngoài được truyền vào để test không cần Supabase.
import { createHash, timingSafeEqual } from "node:crypto";
import { METRIC_RANGES, rangeBounds, summarize, type MetricRange, type MetricsRow, type MetricsSummary } from "./metrics";

export type MetricsDeps = {
  // Mật khẩu xem số liệu, đặt ở máy chủ. Trống hoặc quá ngắn thì trang /metrics bị khoá.
  password: string | undefined;
  counts: ((from: string, to: string) => Promise<MetricsRow[]>) | null;
  aiCalls: (fromDay: string) => Promise<number>;
  now?: () => number;
  // Chờ thêm khi sai mật khẩu, để đoán mò chậm lại.
  wrongDelayMs?: number;
};

export const MIN_PASSWORD_LENGTH = 12;

const json = (body: unknown, status = 200) => Response.json(body, { status });
const digest = (text: string) => createHash("sha256").update(text, "utf8").digest();

export function passwordMatches(expected: string, given: string): boolean {
  // So hai bản băm cùng độ dài để thời gian so không lộ mật khẩu.
  return timingSafeEqual(digest(expected), digest(given));
}

export async function handleMetrics(request: Request, deps: MetricsDeps): Promise<Response> {
  const expected = deps.password?.trim() ?? "";
  if (expected.length < MIN_PASSWORD_LENGTH || !deps.counts) {
    return json({ ok: false, error: "Trang số liệu chưa được cài đặt. Xem bước 5 trong docs/cai-dat-supabase.md." }, 503);
  }
  const body = (await request.json().catch(() => null)) as { matKhau?: unknown; khoang?: unknown } | null;
  const given = typeof body?.matKhau === "string" ? body.matKhau : "";
  if (!given || !passwordMatches(expected, given)) {
    await new Promise((resolve) => setTimeout(resolve, deps.wrongDelayMs ?? 1000));
    return json({ ok: false, error: "Sai mật khẩu." }, 401);
  }
  const range: MetricRange = typeof body?.khoang === "string" && body.khoang in METRIC_RANGES ? (body.khoang as MetricRange) : "7";
  const bounds = rangeBounds(range, (deps.now ?? Date.now)());
  try {
    const [rows, aiCalls] = await Promise.all([deps.counts(bounds.from, bounds.to), deps.aiCalls(bounds.fromDay)]);
    const summary: MetricsSummary = summarize(rows, aiCalls);
    return json({ ok: true, khoang: range, tuNgay: bounds.fromDay, summary });
  } catch {
    return json({ ok: false, error: "Chưa đọc được số liệu. Hãy thử lại sau ít phút." }, 503);
  }
}
