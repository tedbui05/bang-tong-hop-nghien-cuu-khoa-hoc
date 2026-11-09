// Chép file worker, bộ mã chữ (cMap), phông chuẩn và wasm của pdf.js vào public/pdfjs, để trình duyệt tải được.
// Phông chuẩn và wasm cần khi vẽ trang PDF để xem bằng chứng (phông không nhúng trong file, ảnh JPEG 2000).
// Chạy tự động trước "npm run dev" và "npm run build", nên luôn khớp với bản pdf.js đang cài.
import { cpSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const root = path.dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json"));
const target = path.resolve(import.meta.dirname, "..", "public", "pdfjs");

mkdirSync(target, { recursive: true });
cpSync(path.join(root, "build", "pdf.worker.min.mjs"), path.join(target, "pdf.worker.min.mjs"));
cpSync(path.join(root, "cmaps"), path.join(target, "cmaps"), { recursive: true });
cpSync(path.join(root, "standard_fonts"), path.join(target, "standard_fonts"), { recursive: true });
cpSync(path.join(root, "wasm"), path.join(target, "wasm"), { recursive: true });
