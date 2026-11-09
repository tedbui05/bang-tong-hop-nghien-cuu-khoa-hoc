// Trạng thái để xem thử giao diện, đọc từ địa chỉ trang (?trang-thai=...).
export type PreviewState = "binh-thuong" | "dang-tai" | "loi" | "trong";

export const PREVIEW_STATES: { value: PreviewState; label: string }[] = [
  { value: "binh-thuong", label: "Bình thường" },
  { value: "dang-tai", label: "Đang tải" },
  { value: "loi", label: "Báo lỗi" },
  { value: "trong", label: "Trống" },
];

// Chỉ người làm app dùng, nên chỉ nhận khi chạy `npm run dev`. Bản chạy thật luôn ở trạng thái bình thường,
// để link có ?trang-thai=loi không hiện màn hình lỗi giả cho người dùng.
export function parsePreviewState(value: string | string[] | undefined, mode: string | undefined = process.env.NODE_ENV): PreviewState {
  if (mode !== "development") return "binh-thuong";
  const match = PREVIEW_STATES.find((state) => state.value === value);
  return match ? match.value : "binh-thuong";
}
