// Kiểm tra quy tắc phân quyền (RLS) trên Supabase thật: người dùng này không đọc, không sửa được dữ liệu của người khác.
// Chạy: npm run test:phan-quyen (cần đã chạy supabase/sql/gioi-han-goi-ai.sql, du-lieu-bang.sql và phien-ban.sql).
// Tạo hai người dùng ẩn danh tạm, thử mọi cách đọc, ghi chéo nhau, rồi xoá hai người dùng đó (dữ liệu xoá theo).
// Không in khoá hay địa chỉ dự án.
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
const secret = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !publishable || !secret) {
  console.error("Thiếu NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY hoặc SUPABASE_SECRET_KEY.");
  process.exit(1);
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secret, options);
const results = [];
const expectTrue = (name, ok, note = "") => results.push({ name, ok: Boolean(ok), note });
// Bị chặn đúng vì thiếu quyền (42501), không phải vì một lỗi khác làm câu lệnh hỏng.
const denied = (r, codes = ["42501"]) => Boolean(r.error) && codes.includes(r.error.code);

async function anonymousUser() {
  const client = createClient(url, publishable, options);
  const { data, error } = await client.auth.signInAnonymously();
  if (error) throw new Error(`không đăng nhập ẩn danh được (${error.code ?? error.status})`);
  return { client, id: data.user.id };
}

const created = [];
try {
  const a = await anonymousUser();
  created.push(a.id);
  const b = await anonymousUser();
  created.push(b.id);
  const nobody = createClient(url, publishable, options);

  // Người A tạo một bảng, một bài và một thao tác.
  const table = { owner_id: a.id, id: "bang-kiem-tra", position: 0, name: "Bảng của A", columns: [], tags: [] };
  const paper = { owner_id: a.id, table_id: "bang-kiem-tra", id: "bai-kiem-tra", position: 0, title: "Bài của A", data: { id: "bai-kiem-tra", note: "bí mật của A" } };
  let r = await a.client.from("sheet_tables").insert(table);
  expectTrue("A thêm bảng của mình", !r.error, r.error?.code);
  r = await a.client.from("sheet_papers").insert(paper);
  expectTrue("A thêm bài của mình", !r.error, r.error?.code);
  r = await a.client.from("app_events").insert({ owner_id: a.id, event: "tai_bai", detail: { bai: "bai-kiem-tra" } });
  expectTrue("A ghi thao tác của mình", !r.error, r.error?.code);
  r = await a.client.from("sheet_papers").select("id, data");
  expectTrue("A đọc lại được bài của mình", r.data?.length === 1, r.error?.code);
  r = await a.client.from("sheet_papers").update({ title: "Đổi tên" }).eq("id", "bai-kiem-tra").select("id");
  expectTrue("A sửa được bài của mình", r.data?.length === 1, r.error?.code);

  // Người B thử đọc, sửa, xoá dữ liệu của A.
  for (const name of ["sheet_tables", "sheet_papers", "app_events"]) {
    r = await b.client.from(name).select("*");
    expectTrue(`B không đọc được ${name} của A`, !r.error && r.data.length === 0, r.error?.code ?? `${r.data.length} dòng`);
  }
  r = await b.client.from("sheet_papers").update({ title: "B sửa" }).eq("owner_id", a.id).select("id");
  expectTrue("B không sửa được bài của A", !r.error && r.data.length === 0, r.error?.code);
  r = await b.client.from("sheet_tables").update({ owner_id: b.id }).eq("owner_id", a.id).select("id");
  expectTrue("B không chiếm được bảng của A (đổi chủ)", !r.error && r.data.length === 0, r.error?.code);
  r = await b.client.from("sheet_papers").delete().eq("owner_id", a.id).select("id");
  expectTrue("B không xoá được bài của A", !r.error && r.data.length === 0, r.error?.code);
  r = await b.client.from("sheet_tables").insert({ ...table, id: "bang-gia-mao", name: "Giả mạo" });
  expectTrue("B không thêm được bảng đứng tên A", denied(r), r.error?.code);
  r = await b.client.from("app_events").insert({ owner_id: a.id, event: "tai_bai", detail: {} });
  expectTrue("B không ghi được thao tác đứng tên A", denied(r), r.error?.code);
  r = await b.client.from("sheet_papers").insert({ ...paper, owner_id: b.id });
  // 23503: bảng "bang-kiem-tra" của B không tồn tại, B không gắn được bài vào bảng của A.
  expectTrue("B không thêm được bài vào bảng của A", denied(r, ["42501", "23503"]), r.error?.code);
  // A sửa bài sang tên B cũng không được.
  r = await a.client.from("sheet_papers").update({ owner_id: b.id }).eq("id", "bai-kiem-tra").select("id");
  expectTrue("A không đẩy được bài sang tên B", denied(r), r.error?.code);
  r = await b.client.from("app_events").update({ event: "o_bi_sua" }).eq("owner_id", b.id).select("id");
  expectTrue("Không ai sửa được thao tác đã ghi", denied(r), r.error?.code);

  // Người chưa đăng nhập không dùng được bảng nào.
  for (const name of ["sheet_tables", "sheet_papers", "app_events", "ai_usage_user", "ai_usage_total"]) {
    r = await nobody.from(name).select("*");
    expectTrue(`Chưa đăng nhập: không đọc được ${name}`, Boolean(r.error) || r.data.length === 0, r.error?.code);
  }
  r = await nobody.from("sheet_tables").insert({ ...table, owner_id: a.id, id: "bang-khach" });
  expectTrue("Chưa đăng nhập: không thêm được bảng", denied(r), r.error?.code);

  // Bộ đếm lượt AI và số liệu /metrics: người dùng không đọc, không gọi được.
  for (const name of ["ai_usage_user", "ai_usage_total"]) {
    r = await b.client.from(name).select("*");
    expectTrue(`B không đọc được ${name}`, Boolean(r.error) || r.data.length === 0, r.error?.code);
  }
  r = await b.client.rpc("claim_ai_call", { p_user: b.id, p_day: "2026-01-01", p_user_limit: 999, p_total_limit: 999 });
  expectTrue("B không tự cộng lượt AI được", denied(r), r.error?.code);
  r = await b.client.rpc("metrics_counts", { p_from: "2026-01-01T00:00:00Z", p_to: "2100-01-01T00:00:00Z" });
  expectTrue("B không đọc được số liệu /metrics", denied(r), r.error?.code);

  r = await admin.from("sheet_papers").select("id").eq("owner_id", a.id);
  expectTrue("Máy chủ (khoá bí mật) vẫn thấy bài của A", r.data?.length === 1, r.error?.code);

  // Lịch sử phiên bản (supabase/sql/phien-ban.sql).
  const version = { owner_id: a.id, table_id: "bang-kiem-tra", table_name: "Bảng của A", name: "Trước khi gửi thầy", kind: "tu_dat", paper_count: 1, data: { id: "bang-kiem-tra", note: "bí mật của A" } };
  r = await a.client.from("sheet_versions").insert(version).select("id");
  if (r.error?.code === "42P01" || r.error?.code === "PGRST205") {
    expectTrue("Bảng sheet_versions đã có (chạy supabase/sql/phien-ban.sql)", false, r.error.code);
  } else {
    expectTrue("A lưu được phiên bản của mình", !r.error && r.data?.length === 1, r.error?.code);
    const versionId = r.data?.[0]?.id;
    r = await a.client.from("sheet_versions").select("id, data");
    expectTrue("A đọc lại được phiên bản của mình", r.data?.length === 1, r.error?.code);
    r = await b.client.from("sheet_versions").select("*");
    expectTrue("B không đọc được phiên bản của A", !r.error && r.data.length === 0, r.error?.code ?? `${r.data.length} dòng`);
    r = await b.client.from("sheet_versions").delete().eq("owner_id", a.id).select("id");
    expectTrue("B không xoá được phiên bản của A", !r.error && r.data.length === 0, r.error?.code);
    r = await b.client.from("sheet_versions").insert({ ...version, name: "Giả mạo" });
    expectTrue("B không thêm được phiên bản đứng tên A", denied(r), r.error?.code);
    r = await a.client.from("sheet_versions").update({ name: "Đổi" }).eq("id", versionId).select("id");
    expectTrue("Không ai sửa được phiên bản đã lưu (kể cả A)", denied(r), r.error?.code);
    r = await nobody.from("sheet_versions").select("*");
    expectTrue("Chưa đăng nhập: không đọc được sheet_versions", Boolean(r.error) || r.data.length === 0, r.error?.code);
    // Tự lưu: chỉ giữ 30 bản mới nhất của mỗi bảng; bản tự đặt tên vẫn còn.
    for (let i = 0; i < 32; i++) {
      await a.client.from("sheet_versions").insert({ ...version, name: null, kind: "tu_dong", reason: `tự lưu ${i}` });
    }
    r = await a.client.from("sheet_versions").select("kind, reason").eq("table_id", "bang-kiem-tra");
    const auto = (r.data ?? []).filter((row) => row.kind === "tu_dong");
    expectTrue("Tự lưu giữ đúng 30 bản mới nhất", auto.length === 30 && !auto.some((row) => row.reason === "tự lưu 0" || row.reason === "tự lưu 1"), `${auto.length} bản`);
    expectTrue("Phiên bản tự đặt tên không bị tự xoá", (r.data ?? []).some((row) => row.kind === "tu_dat"), r.error?.code);
  }
} catch (error) {
  expectTrue("Chạy được bài kiểm tra", false, error instanceof Error ? error.message : "lỗi");
} finally {
  // Xoá hai người dùng tạm; bảng, bài, thao tác của họ xoá theo (on delete cascade).
  for (const id of created) await admin.auth.admin.deleteUser(id).catch(() => undefined);
}

for (const item of results) console.log(`${item.ok ? "ĐẠT " : "LỖI "} ${item.name}${!item.ok && item.note ? ` (${item.note})` : ""}`);
const failed = results.filter((item) => !item.ok).length;
console.log(failed ? `\n${failed} mục chưa đạt.` : `\nĐạt cả ${results.length} mục.`);
process.exit(failed ? 1 : 0);
