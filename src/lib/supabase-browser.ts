// Đăng nhập ẩn danh của Supabase trên trình duyệt: sinh viên không cần tạo tài khoản, nhưng mỗi trình duyệt có
// một danh tính thật. Phiên đăng nhập được gửi kèm khi gọi AI để máy chủ biết ai đang dùng và đếm lượt.
// Chỉ dùng khoá công khai (publishable). Khoá bí mật chỉ nằm ở máy chủ.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { QueueError } from "./paper-pipeline";

let client: SupabaseClient | null = null;

function browserClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return null;
  client ??= createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
}

export type TokenResult = { ok: true; token: string } | { ok: false; error: QueueError };

// Lấy phiên đăng nhập hiện có, chưa có thì đăng nhập ẩn danh.
export async function getAccessToken(): Promise<TokenResult> {
  const supabase = browserClient();
  if (!supabase) {
    return {
      ok: false,
      // Có nút Thử lại: cài đặt xong (docs/cai-dat-supabase.md) thì gửi lại được, không phải chọn lại file.
      error: {
        title: "Đăng nhập chưa được cài đặt",
        detail: "App thiếu thông tin để đăng nhập nên chưa gửi được bài cho AI. Hãy báo người quản lý app; cài đặt xong thì bấm Thử lại.",
        retry: true,
      },
    };
  }
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) return { ok: true, token: data.session.access_token };
    const { data: signedIn, error } = await supabase.auth.signInAnonymously();
    if (error || !signedIn.session?.access_token) throw error ?? new Error("không có phiên");
    return { ok: true, token: signedIn.session.access_token };
  } catch {
    return {
      ok: false,
      error: {
        title: "Chưa đăng nhập được",
        detail: "App cần một phiên đăng nhập (không cần tạo tài khoản) để gửi bài cho AI. Hãy kiểm tra kết nối mạng rồi bấm Thử lại.",
        retry: true,
      },
    };
  }
}
