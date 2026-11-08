// Mã màu thật nằm trong biến CSS ở globals.css; ở đây chỉ giữ khoá và tên hiển thị.
export const FILL_COLORS = [
  { key: "hong", name: "Hồng" },
  { key: "dao", name: "Đào" },
  { key: "chanh", name: "Vàng chanh" },
  { key: "la", name: "Lá mạ" },
  { key: "ngoc", name: "Ngọc" },
  { key: "tim", name: "Tím nhạt" },
  { key: "xam", name: "Xám ấm" },
] as const;

export const TEXT_COLORS = [
  { key: "do", name: "Đỏ" },
  { key: "cam", name: "Cam" },
  { key: "luc", name: "Xanh lục" },
  { key: "duong", name: "Xanh dương" },
  { key: "tia", name: "Tím" },
  { key: "xam", name: "Xám" },
] as const;

export const TAG_COLORS = [
  { key: "1", name: "Xanh dương" },
  { key: "2", name: "Xanh lục" },
  { key: "3", name: "Vàng" },
  { key: "4", name: "Hồng" },
  { key: "5", name: "Tím" },
  { key: "6", name: "Xám" },
] as const;

export type FillKey = (typeof FILL_COLORS)[number]["key"];
export type TextColorKey = (typeof TEXT_COLORS)[number]["key"];
export type TagColorKey = (typeof TAG_COLORS)[number]["key"];

// Đọc mã màu từ biến CSS, dùng khi xuất Excel. Trả về dạng AARRGGBB.
export function cssColorToArgb(variable: string): string | null {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? `FF${value.slice(1).toUpperCase()}` : null;
}
