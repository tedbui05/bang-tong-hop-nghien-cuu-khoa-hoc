// Ghi thao tác để đo hiệu quả. Trên trình duyệt, thao tác được giữ trong hàng chờ (localStorage) rồi gửi lên
// bảng app_events của Supabase; mất mạng thì gửi lại khi có mạng. Trên máy chủ chỉ in ra log.
// Trang /metrics đọc các thao tác này.
export type AppEvent =
  | "tai_bai"
  // Máy chủ gọi model dự phòng vì model chính quá tải hoặc quá giờ (ghi ở dien-bang-handler.ts).
  // Đếm số lần này để biết model chính có đủ dùng không.
  | "dung_model_du_phong"
  | "o_giu_nguyen"
  | "o_bi_sua"
  | "o_can_kiem_tra"
  | "bam_luu_vao_bang";

export type EventDetail = Record<string, string | number>;
export type QueuedEvent = { event: AppEvent; detail: EventDetail };

const OUTBOX_KEY = "tcb-thao-tac-cho-gui";
// Giữ tối đa chừng này thao tác chờ gửi, để localStorage không đầy khi mất mạng lâu.
const OUTBOX_LIMIT = 2000;

export function readOutbox(): QueuedEvent[] {
  try {
    const data = JSON.parse(window.localStorage.getItem(OUTBOX_KEY) ?? "[]");
    return Array.isArray(data) ? data.filter((item) => typeof item?.event === "string" && item.detail && typeof item.detail === "object") : [];
  } catch {
    return [];
  }
}

function writeOutbox(items: QueuedEvent[]) {
  try {
    if (items.length) window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(items.slice(-OUTBOX_LIMIT)));
    else window.localStorage.removeItem(OUTBOX_KEY);
  } catch {
    // Trình duyệt chặn bộ nhớ: bỏ qua, thao tác vẫn có trong console.
  }
}

type Sender = (items: QueuedEvent[]) => Promise<void>;
let sender: Sender | null = null;
let sending = false;
let timer: ReturnType<typeof setTimeout> | null = null;

// store.tsx đăng ký hàm gửi khi đã cài Supabase. Chưa đăng ký thì thao tác chỉ nằm trong hàng chờ.
export function setEventSender(next: Sender | null) {
  sender = next;
  if (next) scheduleFlush(0);
}

export function scheduleFlush(delay = 1000) {
  if (typeof window === "undefined") return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flushEvents(), delay);
}

// Gửi các thao tác đang chờ. Lỗi (mất mạng, chưa có phiên) thì giữ lại để gửi lần sau.
export async function flushEvents(): Promise<boolean> {
  if (!sender || sending) return false;
  const items = readOutbox();
  if (!items.length) return true;
  sending = true;
  try {
    await sender(items);
    // Trong lúc gửi có thể có thao tác mới: chỉ bỏ đúng số đã gửi.
    writeOutbox(readOutbox().slice(items.length));
    return true;
  } catch {
    return false;
  } finally {
    sending = false;
  }
}

export function logEvent(event: AppEvent, detail: EventDetail = {}) {
  const luc = new Date().toISOString();
  console.info("[thao-tac]", event, { ...detail, luc });
  if (typeof window === "undefined") return;
  writeOutbox([...readOutbox(), { event, detail: { ...detail, luc } }]);
  scheduleFlush();
}
