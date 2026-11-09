// Đăng nhập ẩn danh của Supabase trên trình duyệt: sinh viên không cần tạo tài khoản, nhưng mỗi trình duyệt có
// một danh tính thật. Phiên đăng nhập được gửi kèm khi gọi AI để máy chủ biết ai đang dùng và đếm lượt.
// Chỉ dùng khoá công khai (publishable). Khoá bí mật chỉ nằm ở máy chủ.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { PaperRow, Remote, TableRow } from "./cloud-sync";
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

// Đã cài Supabase cho trình duyệt chưa (thiếu thì app chạy như cũ, chỉ giữ dữ liệu trên trình duyệt).
export function cloudConfigured(): boolean {
  return browserClient() !== null;
}

// Mã người dùng của phiên hiện có. Không tự đăng nhập: người chỉ xem bảng mẫu thì không tạo danh tính mới.
export async function currentUserId(): Promise<string | null> {
  const supabase = browserClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

// Có phiên thì dùng, chưa có thì đăng nhập ẩn danh. Trả về mã người dùng.
async function ensureUser(): Promise<{ supabase: SupabaseClient; userId: string }> {
  const supabase = browserClient();
  if (!supabase) throw new Error("chưa cài đặt");
  const token = await getAccessToken();
  if (!token.ok) throw new Error("chưa đăng nhập được");
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("chưa đăng nhập được");
  return { supabase, userId: data.session.user.id };
}

const BATCH = 50;

function chunks<T>(list: T[], size = BATCH): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

async function check<T extends { error: { code?: string } | null }>(request: PromiseLike<T>): Promise<T> {
  const result = await request;
  // Chỉ đưa mã lỗi ra ngoài, không kèm dữ liệu của sinh viên.
  if (result.error) throw new Error(`supabase ${result.error.code ?? "loi"}`);
  return result;
}

// Đọc, ghi bảng của chính người dùng này. Quy tắc phân quyền ở máy chủ chặn mọi dòng của người khác.
export const supabaseRemote: Remote = {
  async load() {
    const { supabase } = await ensureUser();
    const tables = await check(supabase.from("sheet_tables").select("id, position, name, description, columns, tags"));
    const papers: PaperRow[] = [];
    // Đọc từng trang 500 dòng, vì Supabase trả tối đa 1000 dòng mỗi lần.
    for (let from = 0; ; from += 500) {
      const page = await check(
        supabase.from("sheet_papers").select("table_id, id, position, title, data").order("table_id").order("id").range(from, from + 499),
      );
      papers.push(...((page.data ?? []) as PaperRow[]));
      if ((page.data ?? []).length < 500) break;
    }
    return { tables: (tables.data ?? []) as TableRow[], papers };
  },
  async apply(plan) {
    const { supabase, userId } = await ensureUser();
    const now = new Date().toISOString();
    for (const batch of chunks(plan.upsertTables)) {
      await check(supabase.from("sheet_tables").upsert(batch.map((row) => ({ ...row, owner_id: userId, updated_at: now })), { onConflict: "owner_id,id" }));
    }
    for (const batch of chunks(plan.upsertPapers, 20)) {
      await check(supabase.from("sheet_papers").upsert(batch.map((row) => ({ ...row, owner_id: userId, updated_at: now })), { onConflict: "owner_id,table_id,id" }));
    }
    for (const row of plan.deletePapers) {
      await check(supabase.from("sheet_papers").delete().eq("owner_id", userId).eq("table_id", row.table_id).eq("id", row.id));
    }
    for (const batch of chunks(plan.deleteTables)) {
      await check(supabase.from("sheet_tables").delete().eq("owner_id", userId).in("id", batch));
    }
  },
  async clear() {
    const { supabase, userId } = await ensureUser();
    await check(supabase.from("sheet_tables").delete().eq("owner_id", userId));
  },
};

export type EventRow = { event: string; detail: Record<string, string | number> };

// Gửi các thao tác đã ghi (bảng app_events). Chỉ gửi khi đã có phiên: thao tác chỉ phát sinh sau khi đã gọi AI.
export async function sendEvents(rows: EventRow[]): Promise<void> {
  const supabase = browserClient();
  if (!supabase) throw new Error("chưa cài đặt");
  const userId = await currentUserId();
  if (!userId) throw new Error("chưa có phiên");
  for (const batch of chunks(rows, 200)) {
    await check(supabase.from("app_events").insert(batch.map((row) => ({ ...row, owner_id: userId }))));
  }
}
