// Test kiểm tra câu trích với chữ thật đọc từ 3 bài mẫu trong samples/.
// samples/ không đưa vào git (bài có bản quyền), nên máy nào không có file thì nhóm test này tự bỏ qua.
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import * as pdfjs from "pdfjs-dist";
import { beforeAll, describe, expect, it } from "vitest";
import { readPdfFile, type PdfEngine, type PdfPage } from "./pdf-read";
import type { AiCell } from "./types";
import { verifyCells } from "./verify-quote";

const SAMPLES = path.join(process.cwd(), "samples");
const cMapUrl = path.join(path.dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json")), "cmaps") + path.sep;

// Tìm file theo phần đầu tên, để không phải ghi cả tên file dài.
// macOS lưu tên file tiếng Việt ở dạng dấu tổ hợp (NFD), nên chuẩn hoá trước khi so.
function findSample(prefix: string): string | null {
  if (!fs.existsSync(SAMPLES)) return null;
  const name = fs.readdirSync(SAMPLES).find((file) => file.normalize("NFC").startsWith(prefix.normalize("NFC")) && file.endsWith(".pdf"));
  return name ? path.join(SAMPLES, name) : null;
}

async function readSample(file: string): Promise<PdfPage[]> {
  const data = fs.readFileSync(file);
  const blob = Object.assign(new Blob([data]), { name: path.basename(file) });
  const result = await readPdfFile(blob as unknown as File, pdfjs as unknown as PdfEngine, { cMapUrl });
  if (!result.ok) throw new Error(`Không đọc được ${file}: ${result.error.title}`);
  return result.pages;
}

function cell(quote: string, page: number): AiCell {
  return { column: "test", value_vi: "x", quote_original: quote, quote_vi: "x", page, status: "proposed", check: null, ai_page: page };
}

type Case = { name: string; quote: string; page: number; check: AiCell["check"]; correctedPage?: number; cites?: boolean };

const papers: { label: string; prefix: string; cases: Case[] }[] = [
  {
    label: "bài tiếng Việt (Phạm Quang Hải và cộng sự, 2023)",
    prefix: "4-4786",
    cases: [
      {
        name: "câu có thật, xuống dòng nhiều chỗ",
        quote: "Bài viết tập trung nghiên cứu về chuyển đổi số trong các doanh nghiệp logistics Việt Nam bằng phương pháp định tính thông qua nghiên cứu các tài liệu.",
        page: 2,
        check: "verified",
      },
      {
        name: "câu có thật, có dẫn nguồn khác",
        quote: "Theo Vietnam Report (2022), 100% số doanh nghiệp logistics đã tăng cường đầu tư cho chuyển đổi số",
        page: 6,
        check: "verified",
        cites: true,
      },
      {
        name: "câu có thật nhưng AI ghi sai trang",
        quote: "Bài viết tập trung nghiên cứu về chuyển đổi số trong các doanh nghiệp logistics Việt Nam bằng phương pháp định tính",
        page: 3,
        check: "page_corrected",
        correctedPage: 2,
      },
      {
        name: "câu vắt từ trang 2 sang trang 3, dòng đầu trang tạp chí chen giữa câu",
        quote: "Thông qua sử dụng phương pháp nghiên cứu tổng hợp - so sánh, các tác giả tiến hành tổng hợp, so sánh dữ từ các nguồn nghiên cứu trên, đưa ra các nhận định, đánh giá về thực trạng chuyển đổi số trong các doanh nghiệp logistics Việt Nam, từ đó đề xuất các giải pháp có tính khả thi nhằm thúc đẩy chuyển đổi số trong các doanh nghiệp logistics phát triển theo đúng tiềm năng, thế mạnh.",
        page: 2,
        check: "verified",
      },
      {
        name: "sửa một chữ (định tính thành định lượng)",
        quote: "Bài viết tập trung nghiên cứu về chuyển đổi số trong các doanh nghiệp logistics Việt Nam bằng phương pháp định lượng thông qua nghiên cứu các tài liệu.",
        page: 2,
        check: "needs_review",
      },
      {
        name: "câu trong phần tài liệu tham khảo đã bị cắt",
        quote: "Decision 749/QD-TTg dated June 20, 2020, approving the “National Digital Transformation Program to 2025",
        page: 10,
        check: "needs_review",
      },
    ],
  },
  {
    label: "bài tiếng Trung (汪阳洁 và cộng sự, 2022)",
    prefix: "Chi phí giao dịch",
    cases: [
      {
        name: "câu có thật, PDF chèn khoảng trắng quanh con số",
        quote: "本文数据来源于作者2018年和2020年两轮农户跟踪问卷调查。",
        page: 10,
        check: "verified",
      },
      {
        name: "câu có thật, xuống dòng giữa các chữ Hán, dấu phẩy toàn khổ",
        quote: "命题1:农村电子商务的出现，改善了农民线下销售农产品的议价能力，扩大了农产品的交易规模，提升了农民的销售利润。",
        page: 10,
        check: "verified",
      },
      {
        name: "sửa một chữ (2020 thành 2021)",
        quote: "本文数据来源于作者2018年和2021年两轮农户跟踪问卷调查。",
        page: 10,
        check: "needs_review",
      },
      {
        name: "câu trong phần tài liệu tham khảo đã bị cắt",
        quote: "演化视角下农村电商“上下并行”的逻辑与趋势",
        page: 19,
        check: "needs_review",
      },
    ],
  },
  {
    label: "bài tiếng Anh (Lin và cộng sự, 2023)",
    prefix: "lin-et-al-2023",
    cases: [
      {
        name: "câu có thật, có số chỉ dẫn dính vào dấu chấm ở cuối",
        quote: "Firms engaged in technology research and development (R&D) must assume high risks associated with unknown return cycles and returns.",
        page: 2,
        check: "verified",
      },
      {
        name: "câu có thật, bỏ số chỉ dẫn dính vào tên tác giả (Pearson29)",
        quote: "Kemp and Pearson explained GI from a broad perspective and suggested that technological innovations that benefit the environment can be named GI.",
        page: 4,
        check: "verified",
      },
      {
        name: "câu có thật, giữ con số thật 60%",
        quote: "as this technology determines whether more than 60% of the carbon reduction targets can be achieved",
        page: 2,
        check: "verified",
      },
      {
        name: "sửa một chữ (high thành low)",
        quote: "Firms engaged in technology research and development (R&D) must assume low risks associated with unknown return cycles and returns.",
        page: 2,
        check: "needs_review",
      },
      {
        name: "câu trong phần tài liệu tham khảo đã bị cắt",
        quote: "Understanding farmers’ intention and willingness to install renewable energy technology",
        page: 19,
        check: "needs_review",
      },
    ],
  },
];

for (const paper of papers) {
  const file = findSample(paper.prefix);
  describe.skipIf(!file)(`chữ thật: ${paper.label}`, () => {
    let pages: PdfPage[] = [];
    beforeAll(async () => {
      pages = await readSample(file!);
    }, 30_000);

    for (const test of paper.cases) {
      it(test.name, () => {
        const [result] = verifyCells([cell(test.quote, test.page)], pages);
        expect(result.check).toBe(test.check);
        if (test.correctedPage) expect(result.page).toBe(test.correctedPage);
        expect(result.cites_other_source).toBe(test.cites ?? false);
        // Câu trích gốc không bao giờ bị đổi.
        expect(result.quote_original).toBe(test.quote);
      });
    }

    it("câu trong tài liệu tham khảo có thật trong file PDF trước khi cắt", () => {
      // Để chắc test "đã bị cắt" ở trên thất bại vì bị cắt, chứ không phải vì câu sai.
      // So thô: bỏ hết khoảng trắng, lấy 20 ký tự đầu của câu trích.
      const refCase = paper.cases.find((test) => test.name.includes("tài liệu tham khảo"))!;
      const squash = (text: string) => text.replace(/\s+/g, "");
      const raw = squash(pages.map((page) => page.text).join(""));
      expect(raw).toContain(squash(refCase.quote).slice(0, 20));
    });
  });
}
