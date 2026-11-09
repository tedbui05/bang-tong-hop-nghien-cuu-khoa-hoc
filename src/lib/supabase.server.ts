// Supabase ở máy chủ: kiểm tra phiên đăng nhập và đếm lượt gọi AI. Chỉ chạy trên máy chủ.
// SUPABASE_SECRET_KEY (khoá bí mật, quyền service_role) không bao giờ được gửi cho trình duyệt hay ghi vào log.
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AiUsageStore } from "./ai-limit";

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
