// Chặn gọi AI tràn lan: chỉ người có phiên đăng nhập (kể cả ẩn danh) mới được gửi bài cho AI, mỗi người có giới hạn
// số bài mỗi ngày, cả app cũng có giới hạn chung để giữ lượt miễn phí của Gemini (kể cả khi có người tạo rất nhiều
// danh tính ẩn danh). Số lần gọi được đếm ở máy chủ (bảng trong Supabase), không tin số đếm từ trình duyệt.
// File này là code thường, không gắn với Supabase: bộ đếm được truyền vào, nên test dùng bộ đếm giả trong bộ nhớ.
import type { ExtractError } from "./ai-extract";

// SỐ TẠM, đổi bằng biến môi trường. 15 bài mỗi người mỗi ngày: sinh viên thường đọc vài bài đến chục bài một ngày.
// 150 bài cả app mỗi ngày: mỗi bài thường gọi Gemini một lần (nhiều nhất 4 lần khi phải gửi lại và dùng model dự phòng),
// nên giữ được dưới hạn mức miễn phí theo ngày của Gemini với số người dùng thử ít.
export const DEFAULT_USER_DAILY_LIMIT = 15;
export const DEFAULT_TOTAL_DAILY_LIMIT = 150;

export type AiLimits = { perUser: number; total: number };

function readLimit(raw: string | undefined, fallback: number): number {
  const value = Number(raw?.trim());
  if (!raw?.trim() || !Number.isInteger(value) || value < 0) return fallback;
  return value;
}

// Đọc từ AI_GIOI_HAN_MOI_NGUOI_MOI_NGAY và AI_GIOI_HAN_CA_APP_MOI_NGAY. Ghi sai hoặc bỏ trống thì dùng số mặc định.
export function readAiLimits(env: Record<string, string | undefined>): AiLimits {
  return {
    perUser: readLimit(env.AI_GIOI_HAN_MOI_NGUOI_MOI_NGAY, DEFAULT_USER_DAILY_LIMIT),
    total: readLimit(env.AI_GIOI_HAN_CA_APP_MOI_NGAY, DEFAULT_TOTAL_DAILY_LIMIT),
  };
}

// Ngày tính theo giờ Việt Nam (UTC+7), dạng 2026-11-09. Qua nửa đêm giờ Việt Nam là ngày mới, lượt được tính lại.
export function vietnamDay(now: number): string {
  return new Date(now + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

export type ClaimResult = "ok" | "user" | "total";

// Bộ đếm ở máy chủ. claim phải làm trọn trong một bước (không để hai yêu cầu cùng lúc cùng lọt qua giới hạn):
// kiểm tra cả hai giới hạn, còn lượt thì cộng một cho người dùng và cho cả app.
export type AiUsageStore = {
  claim: (userId: string, day: string, limits: AiLimits) => Promise<ClaimResult>;
  // Trả lại lượt khi chưa gọi AI lần nào (ví dụ bài quá dài, bị chặn trước khi gửi).
  release: (userId: string, day: string) => Promise<void>;
};

// Bộ đếm trong bộ nhớ, chỉ dùng cho test.
export function memoryUsageStore(): AiUsageStore & { counts: () => { users: Map<string, number>; totals: Map<string, number> } } {
  const users = new Map<string, number>();
  const totals = new Map<string, number>();
  return {
    async claim(userId, day, limits) {
      const user = users.get(`${day}:${userId}`) ?? 0;
      const total = totals.get(day) ?? 0;
      if (user >= limits.perUser) return "user";
      if (total >= limits.total) return "total";
      users.set(`${day}:${userId}`, user + 1);
      totals.set(day, total + 1);
      return "ok";
    },
    async release(userId, day) {
      const key = `${day}:${userId}`;
      users.set(key, Math.max(0, (users.get(key) ?? 0) - 1));
      totals.set(day, Math.max(0, (totals.get(day) ?? 0) - 1));
    },
    counts: () => ({ users, totals }),
  };
}

export function limitError(code: "not_signed_in" | "limit_user" | "limit_total", limits?: AiLimits): ExtractError {
  switch (code) {
    case "not_signed_in":
      return {
        code,
        title: "Chưa đăng nhập được",
        detail: "App cần một phiên đăng nhập (không cần tạo tài khoản) để gửi bài cho AI. Hãy tải lại trang rồi bấm Thử lại.",
        retry: true,
      };
    case "limit_user":
      return {
        code,
        title: "Bạn đã dùng hết lượt AI hôm nay",
        detail: `Mỗi người được gửi ${limits?.perUser ?? DEFAULT_USER_DAILY_LIMIT} bài cho AI mỗi ngày (giới hạn tạm của bản thử). Bài vẫn nằm trong hàng chờ, hãy bấm Thử lại vào ngày mai.`,
        retry: true,
      };
    case "limit_total":
      return {
        code,
        title: "App đã dùng hết lượt AI hôm nay",
        detail: "Cả app chỉ được gửi một số bài cho AI mỗi ngày để giữ lượt miễn phí. Bài vẫn nằm trong hàng chờ, hãy bấm Thử lại vào ngày mai.",
        retry: true,
      };
  }
}
