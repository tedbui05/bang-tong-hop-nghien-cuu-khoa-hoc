// Bài mẫu do app tạo (public/bai-mau/, dựng bằng scripts/tao-bai-mau.mjs), không phải bài báo thật.
// Giám khảo và người mới dùng bài này để thử app, nên mọi thao tác trên bài này không tính vào số liệu đo hiệu quả,
// giống quy ước "bài mẫu không ghi thao tác".
export const SAMPLE_PAPER_URL = "/bai-mau/bai-mau-do-app-tao.pdf";
export const SAMPLE_PAPER_NAME = "bai-mau-do-app-tao.pdf";

export function isAppSamplePaper(fileName: string | null | undefined): boolean {
  return fileName === SAMPLE_PAPER_NAME;
}
