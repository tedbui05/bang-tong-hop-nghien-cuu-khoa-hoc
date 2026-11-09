// Test trang /metrics: tính chỉ số từ số đếm, khoảng ngày theo giờ Việt Nam, khoá bằng mật khẩu.
import { describe, expect, it, vi } from "vitest";
import { percent, rangeBounds, summarize, type MetricsRow } from "./metrics";
import { handleMetrics, passwordMatches, type MetricsDeps } from "./metrics-handler";

const row = (event: string | null, so_lan: number, extra: Partial<MetricsRow> = {}): MetricsRow => ({
  event,
  noi: "",
  cach: "",
  loai: "noi_dung",
  du_phong: "",
  so_lan,
  so_nguoi: 1,
  ...extra,
});

const rows: MetricsRow[] = [
  row(null, 40, { so_nguoi: 3 }),
  row("tai_bai", 3, { du_phong: "0" }),
  row("tai_bai", 1, { du_phong: "1" }),
  row("dung_model_du_phong", 2),
  row("o_can_kiem_tra", 5),
  row("o_giu_nguyen", 12, { noi: "duyet" }),
  row("o_giu_nguyen", 6, { noi: "duyet", cach: "duyet_nhanh" }),
  row("o_bi_sua", 2, { noi: "duyet" }),
  row("o_giu_nguyen", 8, { noi: "duyet", loai: "thong_tin" }),
  row("o_bi_sua", 4, { noi: "duyet", loai: "thong_tin" }),
  row("o_bi_sua", 3, { noi: "bang" }),
  row("bam_luu_vao_bang", 3),
];

describe("summarize", () => {
  it("tách ô nội dung, thông tin bài, ô sửa trong bảng; đếm người dùng từ dòng tổng", () => {
    expect(summarize(rows, 7)).toEqual({
      nguoiDung: 3,
      baiTai: 4,
      baiDuPhong: 1,
      baiLuu: 3,
      lanDungDuPhong: 2,
      oCanKiemTra: 5,
      oGiuNguyen: 18,
      oBiSua: 2,
      oDuyetNhanh: 6,
      ttGiuNguyen: 8,
      ttBiSua: 4,
      oSuaTrongBang: 3,
      luotAi: 7,
    });
  });

  it("không có thao tác thì mọi số là 0 và tỉ lệ ghi 'chưa có'", () => {
    const empty = summarize([]);
    expect(empty.baiTai).toBe(0);
    expect(empty.nguoiDung).toBe(0);
    expect(percent(0, 0)).toBeNull();
    expect(percent(18, 20)).toBe(90);
  });
});

describe("rangeBounds", () => {
  it("7 ngày tính từ 0 giờ giờ Việt Nam của 6 ngày trước đến hết hôm nay", () => {
    // 23 giờ 30 ngày 9/11 theo giờ Việt Nam là 16 giờ 30 UTC.
    const bounds = rangeBounds("7", Date.UTC(2026, 10, 9, 16, 30));
    expect(bounds).toEqual({ fromDay: "2026-11-03", from: "2026-11-02T17:00:00.000Z", to: "2026-11-09T17:00:00.000Z" });
  });
  it("sau 0 giờ giờ Việt Nam đã là ngày mới", () => {
    expect(rangeBounds("7", Date.UTC(2026, 10, 9, 17, 30)).fromDay).toBe("2026-11-04");
  });
});

describe("handleMetrics", () => {
  const password = "mat-khau-du-dai-123";
  const counts = vi.fn(async () => rows);
  const deps = (extra: Partial<MetricsDeps> = {}): MetricsDeps => ({
    password,
    counts,
    aiCalls: async () => 7,
    now: () => Date.UTC(2026, 10, 9, 3),
    wrongDelayMs: 0,
    ...extra,
  });
  const send = (body: unknown, d = deps()) =>
    handleMetrics(new Request("http://localhost/api/metrics", { method: "POST", body: JSON.stringify(body) }), d);

  it("sai mật khẩu hoặc không có mật khẩu: 401, không đọc số liệu", async () => {
    counts.mockClear();
    expect((await send({ matKhau: "sai" })).status).toBe(401);
    expect((await send({})).status).toBe(401);
    expect(counts).not.toHaveBeenCalled();
  });

  it("chưa đặt mật khẩu ở máy chủ (hoặc quá ngắn): trang bị khoá, kể cả khi gửi chuỗi rỗng", async () => {
    expect((await send({ matKhau: "" }, deps({ password: undefined }))).status).toBe(503);
    expect((await send({ matKhau: "ngan" }, deps({ password: "ngan" }))).status).toBe(503);
  });

  it("đúng mật khẩu: trả số liệu đã tính", async () => {
    const response = await send({ matKhau: password, khoang: "30" });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.khoang).toBe("30");
    expect(body.summary.baiTai).toBe(4);
    expect(body.summary.luotAi).toBe(7);
  });

  it("lỗi khi đọc số liệu: 503 với câu tiếng Việt", async () => {
    const response = await send({ matKhau: password }, deps({ counts: async () => Promise.reject(new Error("x")) }));
    expect(response.status).toBe(503);
    expect((await response.json()).error).toMatch(/Chưa đọc được số liệu/);
  });

  it("so mật khẩu", () => {
    expect(passwordMatches(password, password)).toBe(true);
    expect(passwordMatches(password, password + " ")).toBe(false);
  });
});
