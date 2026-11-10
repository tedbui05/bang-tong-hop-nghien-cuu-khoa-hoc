// Câu trạng thái lưu ở đầu bảng, giống Google Sheets: app tự lưu, không cần nút Save.
// cloud: trạng thái lưu lên máy chủ (store.tsx). saveFailed: trình duyệt không cho ghi localStorage.
// savedAt: lúc lưu xong gần nhất (mili giây), null nếu chưa lưu lần nào trong phiên này.
export type SaveCloudState = "local" | "loading" | "saving" | "saved" | "offline" | "error";
export type SaveTone = "busy" | "ok" | "warn";

export function formatClock(time: number): string {
  return new Date(time).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function saveStatus(cloud: SaveCloudState, saveFailed: boolean, savedAt: number | null): { text: string; tone: SaveTone } {
  if (cloud === "loading" || cloud === "saving") return { text: "Đang lưu…", tone: "busy" };
  if (cloud === "offline") return { text: "Chưa lưu được, sẽ thử lại khi có mạng", tone: "warn" };
  if (cloud === "error") return { text: "Chưa lưu được lên máy chủ, đang thử lại", tone: "warn" };
  if (saveFailed && cloud !== "saved") return { text: "Trình duyệt không cho lưu, hãy xuất Excel để giữ bản sao", tone: "warn" };
  if (cloud === "saved") return { text: savedAt ? `Đã lưu lúc ${formatClock(savedAt)}` : "Đã lưu", tone: "ok" };
  // Chưa cài máy chủ hoặc chưa có dữ liệu riêng: chỉ lưu trên trình duyệt.
  return { text: savedAt ? `Đã lưu trên trình duyệt lúc ${formatClock(savedAt)}` : "Đã lưu trên trình duyệt", tone: "ok" };
}

// Cmd+S trên Mac, Ctrl+S trên máy khác: chỉ lưu ngay, không mở hộp lưu trang của trình duyệt.
export function isSaveShortcut(event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">): boolean {
  return (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "s";
}
