// Nhận ra câu trích có dấu hiệu dẫn nguồn khác, bằng code thường, không dùng AI.
// Câu như "Theo Vietnam Report (2022), 100% doanh nghiệp..." vẫn có thật trong bài nên bước kiểm tra
// sẽ báo khớp, nhưng nội dung là kết quả của nguồn khác. Cảnh báo này gắn thêm vào ô,
// không thay thế kết quả kiểm tra (đã khớp, đã sửa số trang, cần kiểm tra).
// Chỉ bắt các mẫu dẫn nguồn rõ ràng, để không báo nhầm câu chỉ có năm như "năm 2022, doanh thu tăng".

export const CITED_SOURCE_WARNING =
  "Câu trích có dẫn nguồn khác, kiểm tra xem đây có phải kết quả của chính bài này không";

const YEAR = String.raw`(?:19|20)\d{2}[a-z]?`;
// Tên tác giả hoặc tổ chức: bắt đầu bằng chữ hoa, có thể nhiều từ ("Vietnam Report", "Ministry of Industry and Trade").
// Có thể có tiền tố viết thường như "van der Heijden", "de Janvry".
const NAME = String.raw`(?:(?:van|von|de|der|den|di|da|du|le|la)\s+)*\p{Lu}[\p{L}'’\-]+(?:\s+(?:\p{Lu}[\p{L}'’\-.]*|of|and|for|the|và|&))*`;
// Phần nối nhiều tác giả: "Smith & Lee", "Nguyễn và cộng sự", "Smith et al.".
const CO_AUTHORS = String.raw`(?:\s*(?:,|&|and|và)\s*${NAME})*(?:\s+(?:et al\.?|và cộng sự|và cs\.?|等))?`;

const PATTERNS: RegExp[] = [
  // "Nguyễn (2020) cho thấy", "Theo Vietnam Report (2022)", "Smith et al. (2019) found", "王某等(2019)".
  new RegExp(String.raw`(?:${NAME}|[\p{Script=Han}]{1,12})${CO_AUTHORS}\s*\(\s*${YEAR}(?:\s*[,;]\s*${YEAR})*\s*\)`, "u"),
  // "(Smith, 2019)", "(Smith & Lee, 2019; Nguyen, 2020)", "(Ministry of Industry and Trade, 2021)", "（张三，2019）".
  // PDF tiếng Trung hay có khoảng trắng ngay sau dấu mở ngoặc: "( 许恒等，2020)".
  new RegExp(String.raw`\(\s*(?:[^()]*?;\s*)?(?:${NAME}|[\p{Script=Han}]{1,12})${CO_AUTHORS}\s*,\s*${YEAR}`, "u"),
  // "et al.", "và cộng sự", "và cs." ở bất cứ đâu trong câu.
  /\bet al\b/iu,
  /\svà (?:cộng sự|cs\.)/iu,
  // Trích theo số thứ tự tài liệu: "[12]", "[3, 5]", "[4-7]".
  /\[\s*\d{1,3}(?:\s*[,–-]\s*\d{1,3})*\s*\]/u,
  // "据某某研究", "根据国家统计局统计". Bỏ "据此" (theo đó) và "据本文…" (theo chính bài này).
  // Bỏ chữ 据 nằm trong từ khác như "数据" (dữ liệu): 据 phải đứng đầu câu, sau dấu câu, hoặc trong "根据".
  /(?:^|[\s,.;:、(]|根)据(?!此|本文|本研究|作者|笔者|我们)[^,.;。，；]{1,30}?(?:研究|报告|统计|调查|数据|测算)/u,
];

export function citesOtherSource(quote: string | null): boolean {
  if (!quote) return false;
  // NFKC đổi ngoặc và dấu phẩy toàn khổ của tiếng Trung ("（", "，") thành dạng thường.
  // PDF tiếng Trung hay chèn khoảng trắng giữa các chữ Hán ("研 究"): bỏ đi để so mẫu.
  const text = quote.normalize("NFKC").replace(/(?<=\p{Script=Han})\s+(?=\p{Script=Han})/gu, "");
  return PATTERNS.some((pattern) => pattern.test(text));
}
