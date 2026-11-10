// Đăng nhập ẩn danh của Supabase trên trình duyệt: sinh viên không cần tạo tài khoản, nhưng mỗi trình duyệt có
// một danh tính thật. Phiên đăng nhập được gửi kèm khi gọi AI để máy chủ biết ai đang dùng và đếm lượt.
// Chỉ dùng khoá công khai (publishable). Khoá bí mật chỉ nằm ở máy chủ.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { PaperRow, Remote, TableRow } from "./cloud-sync";
import type { QueueError } from "./paper-pipeline";
import type { VersionInsert, VersionMeta, VersionRow } from "./versions";

let client: SupabaseClient | null = null;

// Phải viết đúng dạng process.env.NEXT_PUBLIC_... thì Next.js mới gắn giá trị vào code trình duyệt, và chỉ gắn
// lúc build: thêm biến trên Vercel xong phải build lại. Thiếu lúc build thì trên trình duyệt luôn trống.
function publicConfig() {
  return { url: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(), key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() };
}

// Tên các biến công khai còn thiếu (chỉ tên, không có giá trị), để câu báo lỗi nói đúng chỗ cần sửa.
export function missingPublicConfig(config = publicConfig()): string[] {
  const missing: string[] = [];
  if (!config.url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!config.key) missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  return missing;
}

function browserClient(): SupabaseClient | null {
  const { url, key } = publicConfig();
  if (!url || !key) return null;
  client ??= createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
}

export type TokenResult = { ok: true; token: string } | { ok: false; error: QueueError };

// Lấy phiên đăng nhập hiện có, chưa có thì đăng nhập ẩn danh.
export async function getAccessToken(): Promise<TokenResult> {
  const supabase = browserClient();
  if (!supabase) {
    const missing = missingPublicConfig();
    console.error(`[đăng nhập] Bản app này được build khi thiếu ${missing.join(", ")}: thêm biến rồi build lại.`);
    return {
      ok: false,
      // Có nút Thử lại: cài đặt xong (docs/cai-dat-supabase.md) thì gửi lại được, không phải chọn lại file.
      error: {
        title: "Đăng nhập chưa được cài đặt",
        detail: `Bản app này được dựng khi còn thiếu ${missing.join(" và ")}, nên chưa gửi được bài cho AI. Hãy báo người quản lý app: thêm biến này rồi dựng lại app (deploy lại), sau đó bấm Thử lại.`,
        retry: true,
      },
    };
  }
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) return { ok: true, token: data.session.access_token };
    return { ok: true, token: await signInOnce(supabase) };
  } catch (error) {
    // Ghi lỗi gốc (tên, mã, nội dung; không có khoá) để lần sau tìm được nguyên nhân thật.
    console.error("[đăng nhập] Đăng nhập ẩn danh thất bại:", describeAuthError(error));
    return { ok: false, error: signInError(error, typeof navigator !== "undefined" && navigator.onLine === false) };
  }
}

// Người dùng mới: tạo bảng (bắt đầu lưu lên máy chủ) và tải bài (gọi AI) gần như cùng lúc, cả hai cùng cần đăng nhập.
// Hai lần đăng nhập ẩn danh song song tạo ra hai danh tính khác nhau: dữ liệu ghi dưới danh tính đầu, trình duyệt
// lại giữ danh tính sau, mở lại app thì mất bài (gặp ngày 10/11/2026). Các lần gọi cùng lúc dùng chung một lần đăng nhập.
let signingIn: Promise<string> | null = null;

export function signInOnce(supabase: Pick<SupabaseClient, "auth">): Promise<string> {
  signingIn ??= (async () => {
    try {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error || !data.session?.access_token) throw error ?? new Error("không có phiên");
      return data.session.access_token;
    } finally {
      signingIn = null;
    }
  })();
  return signingIn;
}

type AuthErrorLike = { name?: unknown; status?: unknown; code?: unknown; message?: unknown };

export function describeAuthError(error: unknown): string {
  if (!error || typeof error !== "object") return String(error);
  const { name, status, code, message } = error as AuthErrorLike;
  return [name, status, code, message].filter((part) => part !== undefined && part !== null && part !== "").map(String).join(" | ");
}

// Đổi lỗi đăng nhập ẩn danh thành câu tiếng Việt nói đúng nguyên nhân. Chỉ nói "kiểm tra mạng" khi đúng là mạng.
export function signInError(error: unknown, offline: boolean): QueueError {
  const { status, code, message } = (error && typeof error === "object" ? error : {}) as AuthErrorLike;
  const text = `${String(code ?? "")} ${String(message ?? "")}`.toLowerCase();
  if (offline || /failed to fetch|networkerror|network request failed|load failed/.test(text)) {
    return { title: "Chưa đăng nhập được", detail: "Không kết nối được tới máy chủ đăng nhập. Hãy kiểm tra kết nối mạng rồi bấm Thử lại.", retry: true };
  }
  if (/anonymous_provider_disabled|anonymous sign-ins are disabled/.test(text)) {
    return {
      title: "Đăng nhập ẩn danh chưa được bật",
      detail: "Máy chủ đăng nhập (Supabase) đang tắt đăng nhập ẩn danh. Hãy báo người quản lý app bật lại theo docs/cai-dat-supabase.md, rồi bấm Thử lại.",
      retry: true,
    };
  }
  if (/captcha/.test(text)) {
    return {
      title: "Máy chủ đăng nhập đòi xác minh",
      detail: "Supabase đang bật CAPTCHA cho đăng nhập ẩn danh nhưng app chưa hỗ trợ. Hãy báo người quản lý app.",
      retry: true,
    };
  }
  if (status === 429 || /rate limit|too many/.test(text)) {
    return { title: "Đăng nhập quá nhiều lần", detail: "Máy chủ đăng nhập đang tạm chặn vì có quá nhiều lần đăng nhập. Hãy chờ vài phút rồi bấm Thử lại.", retry: true };
  }
  return {
    title: "Chưa đăng nhập được",
    detail: "Máy chủ đăng nhập từ chối hoặc gặp lỗi. Hãy bấm Thử lại sau ít phút; nếu vẫn lỗi, hãy báo người quản lý app.",
    retry: true,
  };
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
    // Phiên bản cũng là dữ liệu của người dùng. Máy chủ chưa có bảng phiên bản thì bỏ qua.
    const versions = await supabase.from("sheet_versions").delete().eq("owner_id", userId);
    if (versions.error && !isMissingTable(versions.error.code)) throw new Error(`supabase ${versions.error.code ?? "loi"}`);
  },
};

// Máy chủ chưa có bảng (chưa chạy file SQL tương ứng).
export function isMissingTable(code: string | undefined): boolean {
  return code === "42P01" || code === "PGRST205";
}

export class VersionsUnavailable extends Error {}

const VERSION_META = "id, table_id, table_name, name, reason, kind, paper_count, created_at";

async function checkVersions<T extends { error: { code?: string } | null }>(request: PromiseLike<T>): Promise<T> {
  const result = await request;
  if (result.error && isMissingTable(result.error.code)) throw new VersionsUnavailable("chưa có bảng sheet_versions");
  if (result.error) throw new Error(`supabase ${result.error.code ?? "loi"}`);
  return result;
}

// Lịch sử phiên bản (bảng sheet_versions, supabase/sql/phien-ban.sql). Phân quyền ở máy chủ: chỉ thấy phiên bản của mình.
export const versionsRemote = {
  async list(): Promise<VersionMeta[]> {
    const { supabase } = await ensureUser();
    const result = await checkVersions(supabase.from("sheet_versions").select(VERSION_META).order("created_at", { ascending: false }).limit(1000));
    return (result.data ?? []) as VersionMeta[];
  },
  async load(id: string): Promise<VersionRow> {
    const { supabase } = await ensureUser();
    const result = await checkVersions(supabase.from("sheet_versions").select(`${VERSION_META}, data`).eq("id", id).single());
    return result.data as VersionRow;
  },
  async save(row: VersionInsert): Promise<VersionMeta> {
    const { supabase, userId } = await ensureUser();
    const result = await checkVersions(supabase.from("sheet_versions").insert({ ...row, owner_id: userId }).select(VERSION_META).single());
    return result.data as VersionMeta;
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
