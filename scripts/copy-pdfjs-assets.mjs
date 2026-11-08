// Chép file worker và bộ mã chữ (cMap) của pdf.js vào public/pdfjs, để trình duyệt tải được.
// Chạy tự động trước "npm run dev" và "npm run build", nên luôn khớp với bản pdf.js đang cài.
import { cpSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const root = path.dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json"));
const target = path.resolve(import.meta.dirname, "..", "public", "pdfjs");

mkdirSync(target, { recursive: true });
cpSync(path.join(root, "build", "pdf.worker.min.mjs"), path.join(target, "pdf.worker.min.mjs"));
cpSync(path.join(root, "cmaps"), path.join(target, "cmaps"), { recursive: true });
