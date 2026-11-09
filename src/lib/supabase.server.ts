// Supabase ở máy chủ: kiểm tra phiên đăng nhập và đếm lượt gọi AI. Chỉ chạy trên máy chủ.
// SUPABASE_SECRET_KEY (khoá bí mật, quyền service_role) không bao giờ được gửi cho trình duyệt hay ghi vào log.
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AiUsageStore } from "./ai-limit";
import type { MetricsRow } from "./metrics";

function url() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
}

let publicClient: SupabaseClient | null = null;
let adminClient: SupabaseClient | null = null;

// Client dùng khoá công khai, chỉ để kiểm tra phiên đăng nhập.
function authClient(): SupabaseClient | null {
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url() || !key) return null;
  publicClient ??= createClient(url(), key, { auth: { persistSession: false, autoRefreshToken: false } });
  return publicClient;
}

// Client dùng khoá bí mật, chỉ để gọi hàm đếm lượt (người dùng không gọi được hàm này).
function secretClient(): SupabaseClient | null {
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url() || !key) return null;
  adminClient ??= createClient(url(), key, { auth: { persistSession: false, autoRefreshToken: false } });
  return adminClient;
}

// Trả về mã người dùng nếu phiên hợp lệ (kể cả người dùng ẩn danh), không thì null.
// getClaims kiểm tra chữ ký của phiên bằng khoá công khai của dự án (hoặc hỏi máy chủ Supabase với khoá kiểu cũ).
export async function verifySupabaseUser(accessToken: string): Promise<string | null> {
  const client = authClient();
  if (!client) {
    console.error("[supabase] thiếu NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    return null;
  }
  const { data, error } = await client.auth.getClaims(accessToken);
  if (error || !data?.claims?.sub) return null;
  // Chỉ nhận phiên của người dùng đã đăng nhập (role authenticated), không nhận khoá công khai trần.
  if (data.claims.role !== "authenticated") return null;
  return data.claims.sub;
}

// Bộ đếm lượt gọi AI trong Postgres (xem supabase/sql/gioi-han-goi-ai.sql). null: chưa cài đặt.
export function supabaseUsageStore(): AiUsageStore | null {
  const client = secretClient();
  if (!client) return null;
  return {
    async claim(userId, day, limits) {
      const { data, error } = await client.rpc("claim_ai_call", {
        p_user: userId,
        p_day: day,
        p_user_limit: limits.perUser,
        p_total_limit: limits.total,
      });
      if (error) {
        // Chỉ ghi mã lỗi, không ghi khoá hay mã người dùng.
        console.error("[supabase] lỗi khi đếm lượt:", error.code);
        throw new Error("không đếm được lượt");
      }
      if (data === "ok" || data === "user" || data === "total") return data;
      throw new Error("kết quả đếm lượt không hợp lệ");
    },
    async release(userId, day) {
      const { error } = await client.rpc("release_ai_call", { p_user: userId, p_day: day });
      if (error) console.error("[supabase] lỗi khi trả lượt:", error.code);
    },
  };
}

// Ghi một thao tác do máy chủ biết (ví dụ dùng model dự phòng) vào bảng app_events, đứng tên người dùng đã gọi.
export async function recordServerEvent(userId: string, event: string, detail: Record<string, string | number>): Promise<void> {
  const client = secretClient();
  if (!client) return;
  const { error } = await client.from("app_events").insert({ owner_id: userId, event, detail: { ...detail, luc: new Date().toISOString() } });
  if (error) console.error("[supabase] lỗi khi ghi thao tác:", error.code);
}

// Đếm thao tác cho trang /metrics (hàm metrics_counts, chỉ khoá bí mật gọi được). null: chưa cài đặt.
export function supabaseMetrics(): { counts: (from: string, to: string) => Promise<MetricsRow[]>; aiCalls: (fromDay: string) => Promise<number> } | null {
  const client = secretClient();
  if (!client) return null;
  return {
    async counts(from, to) {
      const { data, error } = await client.rpc("metrics_counts", { p_from: from, p_to: to });
      if (error) {
        console.error("[supabase] lỗi khi đọc số liệu:", error.code);
        throw new Error("không đọc được số liệu");
      }
      return (data ?? []) as MetricsRow[];
    },
    async aiCalls(fromDay) {
      const { data, error } = await client.from("ai_usage_total").select("count").gte("day", fromDay);
      if (error) {
        console.error("[supabase] lỗi khi đọc lượt AI:", error.code);
        throw new Error("không đọc được lượt AI");
      }
      return (data ?? []).reduce((total, row) => total + Number(row.count), 0);
    },
  };
}
