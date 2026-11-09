// Dựng bài mẫu do app tạo, để giám khảo và người dùng mới thử app mà không cần bài báo riêng.
// ĐÂY LÀ BÀI MẪU DO APP TẠO, KHÔNG PHẢI BÀI BÁO THẬT. Nội dung nằm ở src/test/bai-mau.ts.
//
// Chạy lại sau khi sửa nội dung: node scripts/tao-bai-mau.mjs (ghi đè public/bai-mau/bai-mau-do-app-tao.pdf).
// Cần Node 22.18 trở lên (hoặc 23.6 trở lên), vì script đọc thẳng file .ts.
import { mkdirSync, writeFileSync } from "node:fs";
import { makePdf } from "../src/test/make-pdf.ts";
import { SAMPLE_PAPER_PAGES } from "../src/test/bai-mau.ts";

const out = new URL("../public/bai-mau/", import.meta.url);
mkdirSync(out, { recursive: true });
writeFileSync(new URL("bai-mau-do-app-tao.pdf", out), makePdf(SAMPLE_PAPER_PAGES));
console.log("Đã ghi public/bai-mau/bai-mau-do-app-tao.pdf");
