// Giữ file PDF, chữ từng trang và bài chờ duyệt ngay trong trình duyệt (IndexedDB), để xem lại bằng chứng
// và để tải lại trang không mất kết quả AI (mất là tốn thêm một lượt AI). Khi có cơ sở dữ liệu thì thay file này.
// Mọi hàm đều không ném lỗi: trình duyệt chặn bộ nhớ (cửa sổ ẩn danh, đầy ổ) thì trả về null hoặc false,
// và app vẫn chạy, chỉ là không xem được PDF gốc sau khi tải lại trang.
import type { PdfPage } from "./pdf-read";

const DB_NAME = "tcb-tai-lieu";
const DB_VERSION = 1;
// pdf: file gốc. pages: chữ từng trang. pending: bài AI đã điền xong nhưng chưa lưu vào bảng.
type StoreName = "pdf" | "pages" | "pending";

export type StoredPdf = { blob: Blob; name: string; size: number; hash: string };

let opening: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  opening ??= new Promise<IDBDatabase | null>((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const name of ["pdf", "pages", "pending"]) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  }).then((db) => {
    if (!db) opening = null; // lần sau thử mở lại
    return db;
  });
  return opening;
}

function run<T>(store: StoreName, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) return resolve(null);
        try {
          const transaction = db.transaction(store, mode);
          const request = action(transaction.objectStore(store));
          transaction.oncomplete = () => resolve((request.result as T) ?? null);
          transaction.onerror = () => resolve(null);
          transaction.onabort = () => resolve(null);
        } catch {
          resolve(null);
        }
      }),
  );
}

async function put(store: StoreName, key: string, value: unknown): Promise<boolean> {
  const result = await run<IDBValidKey>(store, "readwrite", (s) => s.put(value, key));
  return result !== null;
}

export const savePdf = (paperId: string, pdf: StoredPdf) => put("pdf", paperId, pdf);
export const loadPdf = (paperId: string) => run<StoredPdf>("pdf", "readonly", (s) => s.get(paperId));
export const savePages = (paperId: string, pages: PdfPage[]) => put("pages", paperId, pages);
export const loadPages = (paperId: string) => run<PdfPage[]>("pages", "readonly", (s) => s.get(paperId));
export const savePending = (id: string, value: unknown) => put("pending", id, value);
export const loadAllPending = () => run<unknown[]>("pending", "readonly", (s) => s.getAll());
export async function deletePending(id: string) {
  await run("pending", "readwrite", (s) => s.delete(id));
}

// Xoá file, chữ và bài chờ duyệt của một bài (bài bị bỏ khỏi hàng chờ trước khi lưu).
export async function deletePaperFiles(paperId: string) {
  await Promise.all((["pdf", "pages", "pending"] as StoreName[]).map((store) => run(store, "readwrite", (s) => s.delete(paperId))));
}

// Nút "Đặt lại dữ liệu mẫu": xoá hết.
export async function clearPaperFiles() {
  await Promise.all((["pdf", "pages", "pending"] as StoreName[]).map((store) => run(store, "readwrite", (s) => s.clear())));
}

// Dấu vân tay của file (SHA-256), để khi tải lại file PDF biết có đúng là file cũ không.
export async function fileHash(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
