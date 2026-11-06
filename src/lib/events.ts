// Ghi thao tác để đo hiệu quả. Bản xem thử chỉ in ra console của trình duyệt.
// Khi có cơ sở dữ liệu, chỉ cần đổi nội dung hàm logEvent.
export type AppEvent =
  | "tai_bai"
  | "o_giu_nguyen"
  | "o_bi_sua"
  | "o_can_kiem_tra"
  | "bam_luu_vao_bang";

export function logEvent(event: AppEvent, detail: Record<string, string | number> = {}) {
  console.info("[thao-tac]", event, { ...detail, luc: new Date().toISOString() });
}
