// Tính các chỉ số cho trang /metrics từ số đếm thao tác (hàm metrics_counts trong supabase/sql/du-lieu-bang.sql).
// Chỉ có số đếm, không có mã người dùng hay nội dung ô.

export type MetricsRow = {
  // null: dòng tổng (so_nguoi là số người dùng khác nhau).
  event: string | null;
  noi: string | null;
  cach: string | null;
  loai: string | null;
  du_phong: string | null;
  so_lan: number;
  so_nguoi: number;
};

export type MetricsSummary = {
  nguoiDung: number;
  baiTai: number;
  baiDuPhong: number;
  baiLuu: number;
  lanDungDuPhong: number;
  oCanKiemTra: number;
  // Ô nội dung lúc lưu ở trang duyệt.
  oGiuNguyen: number;
  oBiSua: number;
  oDuyetNhanh: number;
  // Thông tin bài (tác giả, năm…) lúc lưu.
  ttGiuNguyen: number;
  ttBiSua: number;
  // Ô sửa ngay trong bảng tổng hợp sau khi đã lưu.
  oSuaTrongBang: number;
  luotAi: number;
};

export function summarize(rows: MetricsRow[], aiCalls = 0): MetricsSummary {
  const sum = (match: (row: MetricsRow) => boolean) =>
    rows.filter((row) => row.event !== null && match(row)).reduce((total, row) => total + Number(row.so_lan), 0);
  const is = (event: string) => (row: MetricsRow) => row.event === event;
  const atReview = (row: MetricsRow) => row.noi === "duyet";
  return {
    nguoiDung: Number(rows.find((row) => row.event === null)?.so_nguoi ?? 0),
    baiTai: sum(is("tai_bai")),
    baiDuPhong: sum((row) => row.event === "tai_bai" && row.du_phong === "1"),
    baiLuu: sum(is("bam_luu_vao_bang")),
    lanDungDuPhong: sum(is("dung_model_du_phong")),
    oCanKiemTra: sum(is("o_can_kiem_tra")),
    oGiuNguyen: sum((row) => row.event === "o_giu_nguyen" && atReview(row) && row.loai === "noi_dung"),
    oBiSua: sum((row) => row.event === "o_bi_sua" && atReview(row) && row.loai === "noi_dung"),
    oDuyetNhanh: sum((row) => row.event === "o_giu_nguyen" && atReview(row) && row.cach === "duyet_nhanh"),
    ttGiuNguyen: sum((row) => row.event === "o_giu_nguyen" && atReview(row) && row.loai === "thong_tin"),
    ttBiSua: sum((row) => row.event === "o_bi_sua" && atReview(row) && row.loai === "thong_tin"),
    oSuaTrongBang: sum((row) => row.event === "o_bi_sua" && row.noi === "bang"),
    luotAi: aiCalls,
  };
}

// Tỉ lệ phần trăm, làm tròn. Không có mẫu số thì trả về null để giao diện ghi "chưa có".
export function percent(part: number, whole: number): number | null {
  if (!whole) return null;
  return Math.round((part / whole) * 100);
}

export const METRIC_RANGES = { "7": 7, "30": 30, all: null } as const;
export type MetricRange = keyof typeof METRIC_RANGES;

// Khoảng thời gian theo giờ Việt Nam: từ 0 giờ của ngày đầu đến hết hôm nay.
export function rangeBounds(range: MetricRange, now: number): { from: string; to: string; fromDay: string } {
  const VN = 7 * 3600 * 1000;
  const today = new Date(now + VN).toISOString().slice(0, 10);
  const days = METRIC_RANGES[range];
  const startDay = days === null ? "2026-01-01" : new Date(Date.parse(`${today}T00:00:00Z`) - (days - 1) * 86400000).toISOString().slice(0, 10);
  const from = new Date(Date.parse(`${startDay}T00:00:00Z`) - VN).toISOString();
  const to = new Date(Date.parse(`${today}T00:00:00Z`) + 86400000 - VN).toISOString();
  return { from, to, fromDay: startDay };
}
