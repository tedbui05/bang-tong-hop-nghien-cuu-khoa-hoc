// Trạng thái để xem thử giao diện, đọc từ địa chỉ trang (?trang-thai=...).
export type PreviewState = "binh-thuong" | "dang-tai" | "loi" | "trong";

export const PREVIEW_STATES: { value: PreviewState; label: string }[] = [
  { value: "binh-thuong", label: "Bình thường" },
  { value: "dang-tai", label: "Đang tải" },
  { value: "loi", label: "Báo lỗi" },
  { value: "trong", label: "Trống" },
];

export function parsePreviewState(value: string | string[] | undefined): PreviewState {
  const match = PREVIEW_STATES.find((state) => state.value === value);
  return match ? match.value : "binh-thuong";
}
