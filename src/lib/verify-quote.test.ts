// Test kiểm tra câu trích, theo danh sách bắt buộc của skill citation-check.
// Không gọi AI: câu trích là chữ viết sẵn trong test.
import { describe, expect, it } from "vitest";
import type { PdfPage } from "./pdf-read";
import type { AiCell } from "./types";
import { CITED_SOURCE_WARNING } from "./cited-source";
import { normalizeForMatch, verifyCells, verifyQuote } from "./verify-quote";

const pages = (...texts: string[]): PdfPage[] => texts.map((text, i) => ({ page: i + 1, text }));

const filler = (topic: string) => `This page discusses ${topic} in general terms without any specific claim.`;

function proposed(quote: string, page: number, column = "ket-qua"): AiCell {
  return {
    column,
    value_vi: "Nội dung AI đề xuất",
    quote_original: quote,
    quote_vi: "Bản dịch",
    page,
    status: "proposed",
    check: null,
    ai_page: page,
  };
}

const notFound: AiCell = {
  column: "han-che",
  value_vi: "không tìm thấy",
  quote_original: null,
  quote_vi: null,
  page: null,
  status: "not_found",
  check: null,
  ai_page: null,
};

describe("chuẩn hoá để so sánh", () => {
  it("NFKC, chữ thường, gộp khoảng trắng", () => {
    expect(normalizeForMatch("  The  ﬁrst\n\tRESULT ")).toBe("the first result");
  });

  it("chuẩn hoá chỉ để so sánh: câu gốc không bị đổi", () => {
    const quote = "The ﬁrst RESULT";
    normalizeForMatch(quote);
    expect(quote).toBe("The ﬁrst RESULT");
  });
});

describe("kết quả kiểm tra một câu trích", () => {
  const paper = pages(
    `${filler("background")}\nStudents in rural schools reported higher engagement after the reading intervention.`,
    `${filler("method")}\nWe surveyed 412 households in three provinces between 2018 and 2020.`,
    `${filler("results")}\nThe effect was larger for girls than for boys in every province.`,
  );

  it("câu khớp, đúng trang: đã khớp", () => {
    expect(verifyQuote("We surveyed 412 households in three provinces", 2, paper)).toEqual({ check: "verified", page: 2 });
  });

  it("khác chữ hoa: vẫn khớp", () => {
    expect(verifyQuote("WE SURVEYED 412 HOUSEHOLDS IN THREE PROVINCES", 2, paper).check).toBe("verified");
  });

  it("bài xuống dòng giữa câu: vẫn khớp", () => {
    const broken = pages("Students in rural\nschools reported higher\n  engagement after the intervention.");
    expect(verifyQuote("Students in rural schools reported higher engagement", 1, broken).check).toBe("verified");
  });

  it("từ bị ngắt bằng gạch nối cuối dòng: vẫn khớp", () => {
    const broken = pages("Green innovation enhances competitive advan-\ntage for listed firms.");
    expect(verifyQuote("Green innovation enhances competitive advantage for listed firms", 1, broken).check).toBe("verified");
  });

  it("từ ghép có gạch nối thật bị ngắt cuối dòng: câu trích giữ gạch nối vẫn khớp", () => {
    const broken = pages("Students in high-\npoverty districts were included in the study.");
    expect(verifyQuote("Students in high-poverty districts were included", 1, broken).check).toBe("verified");
    expect(verifyQuote("Students in highpoverty districts were included", 1, broken).check).toBe("verified");
  });

  it("sai trang: tự sửa theo trang tìm thấy", () => {
    expect(verifyQuote("We surveyed 412 households in three provinces", 3, paper)).toEqual({ check: "page_corrected", page: 2 });
  });

  it("câu bịa: cần kiểm tra", () => {
    expect(verifyQuote("We surveyed 512 households in four provinces", 2, paper)).toEqual({ check: "needs_review", page: 2 });
  });

  it("câu có ở nhiều trang: cần kiểm tra, lý do nhiều trang", () => {
    expect(verifyQuote("in general terms without any specific claim", 1, paper)).toEqual({
      check: "needs_review",
      page: 1,
      review_reason: "multi_page",
    });
  });

  it("câu có hai lần trong cùng một trang vẫn tính là một trang", () => {
    const twice = pages("The sample is balanced across groups. Later we repeat: the sample is balanced across groups.");
    expect(verifyQuote("the sample is balanced across groups", 1, twice).check).toBe("verified");
  });

  it("câu quá ngắn: cần kiểm tra dù tìm thấy", () => {
    expect(verifyQuote("n = 412", 2, pages("Sample size n = 412 households.", "Other page"))).toEqual({
      check: "needs_review",
      page: 2,
      review_reason: "too_short",
    });
  });

  it("câu trích rỗng: cần kiểm tra, không coi là đạt", () => {
    expect(verifyQuote("   ", 1, paper).check).toBe("needs_review");
  });

  it("câu vắt qua hai trang: tính là trang bắt đầu", () => {
    const split = pages(`${filler("a")}\nThe treatment group received weekly reading`, `sessions for six months.\n${filler("b")}`);
    const quote = "The treatment group received weekly reading sessions for six months";
    expect(verifyQuote(quote, 1, split)).toEqual({ check: "verified", page: 1 });
    expect(verifyQuote(quote, 2, split)).toEqual({ check: "page_corrected", page: 1 });
  });

  it("câu vắt qua hai trang có gạch nối ngắt từ ở cuối trang", () => {
    const split = pages("Digital transformation supports the develop-", "ment of logistics firms in Vietnam.");
    expect(verifyQuote("supports the development of logistics firms", 1, split).check).toBe("verified");
  });

  it("câu nằm gọn ở cuối một trang không bị đếm thêm ở chỗ nối", () => {
    const end = pages(`${filler("a")}\nThe effect disappears after two years.`, `Next page starts here.\n${filler("b")}`);
    expect(verifyQuote("The effect disappears after two years.", 1, end)).toEqual({ check: "verified", page: 1 });
  });

  it("câu ở cả trong một trang và ở chỗ nối của hai trang khác: cần kiểm tra", () => {
    const both = pages("The program improved test scores.", "Middle page. The program improved", "test scores.");
    expect(verifyQuote("The program improved test scores", 1, both).review_reason).toBe("multi_page");
  });

  it("chữ dính fi trong PDF (NFKC)", () => {
    expect(verifyQuote("financial constraints reduce firm investment", 1, pages("Financial constraints reduce ﬁrm investment.")).check).toBe(
      "verified",
    );
    expect(verifyQuote("ﬁnancial constraints reduce ﬁrm investment", 1, pages("Financial constraints reduce firm investment.")).check).toBe(
      "verified",
    );
  });

  it("tiếng Việt có dấu tổ hợp, vẫn đúng sau NFKC", () => {
    const text = "Bài viết tập trung nghiên cứu về chuyển đổi số trong doanh nghiệp logistics.";
    expect(verifyQuote(text.normalize("NFC"), 1, pages(text.normalize("NFD"))).check).toBe("verified");
    expect(verifyQuote(text.normalize("NFD"), 1, pages(text.normalize("NFC"))).check).toBe("verified");
  });

  it("tiếng Việt: sai một dấu thì không khớp", () => {
    expect(verifyQuote("Bài viết tập trung nghiên cứu về chuyến đổi số", 1, pages("Bài viết tập trung nghiên cứu về chuyển đổi số.")).check).toBe(
      "needs_review",
    );
  });

  it("tiếng Trung, vẫn đúng sau NFKC (dấu câu toàn khổ)", () => {
    const text = "农村电子商务的出现，改善了农民线下销售农产品的议价能力。";
    expect(verifyQuote("农村电子商务的出现,改善了农民线下销售农产品的议价能力", 1, pages(text)).check).toBe("verified");
  });

  it("tiếng Trung: PDF chèn khoảng trắng và xuống dòng giữa các chữ Hán", () => {
    const pdfText = "本文数据来源于作者 2018 年和 2020 年两轮农户跟踪问卷调查。在农村电子商务发展较为发\n达的山东和浙江两省";
    expect(verifyQuote("本文数据来源于作者2018年和2020年两轮农户跟踪问卷调查。", 1, pages(pdfText)).check).toBe("verified");
    expect(verifyQuote("在农村电子商务发展较为发达的山东和浙江两省", 1, pages(pdfText)).check).toBe("verified");
  });

  it("dấu ngoặc kép cong và gạch dài coi như dấu thường", () => {
    const text = "industries based on the “key evaluation indicators of green credit implementation” in 2012–2020.";
    expect(verifyQuote('based on the "key evaluation indicators of green credit implementation" in 2012-2020', 1, pages(text)).check).toBe(
      "verified",
    );
  });
});

// Chữ thật từ bài tiếng Anh mẫu (Lin et al. 2023, trang 2, 4, 5 của file PDF), chép nguyên như pdf.js đọc ra.
// Số chỉ dẫn nhỏ dính vào chữ: "GI.10", "change,1–3", "Pearson29", "Li46".
describe("số chỉ dẫn nhỏ dính vào chữ", () => {
  const lin = pages(
    "Introduction\nThe utilization of fossil fuels in agricultural and industrial production systems results in\nextreme climate change,1–3 which adversely affects both human health and the natural\nenvironment.4–6 Inefficient energy consumption increases emissions, which ultimately\ndegrades the ecology. Guidance for green technology development will be emphasized in long-\nterm human research, as this technology determines whether more than 60% of the\ncarbon reduction targets can be achieved. Green innovation (GI) promotes the green\ntransformation of companies and enhances productive capacity and competitive advan-\ntage.9 In addition to government policies, the business financing environment is a critical\ndriver of GI.10 Firms engaged in technology research and development (R&D) must\nassume high risks associated with unknown return cycles and returns.11 However, the\nGI generates environmental externality through reduced environmental costs.",
    "or management style in business practice. GI technologies enable the economical use of\nresources, the effective reduction of raw material inputs, and ecological protection. Kemp\nand Pearson29 explained GI from a broad perspective and suggested that technological\ninnovations that benefit the environment can be named GI.",
    "Using survey data from\n442 firms in China, Cai and Li46 discovered that competitors' green behavior affects firms.",
  );

  it("câu trích bỏ số chỉ dẫn sau dấu chấm vẫn khớp (GI.10)", () => {
    expect(verifyQuote("the business financing environment is a critical driver of GI. Firms engaged in technology research", 1, lin).check).toBe(
      "verified",
    );
  });

  it("câu trích bỏ số chỉ dẫn dạng khoảng (change,1–3) vẫn khớp", () => {
    expect(verifyQuote("results in extreme climate change, which adversely affects both human health", 1, lin).check).toBe("verified");
  });

  it("câu trích bỏ số chỉ dẫn dính vào tên tác giả (Pearson29) vẫn khớp", () => {
    expect(verifyQuote("Kemp and Pearson explained GI from a broad perspective", 1, lin)).toEqual({ check: "page_corrected", page: 2 });
    expect(verifyQuote("Cai and Li discovered that competitors' green behavior affects firms", 3, lin).check).toBe("verified");
  });

  it("câu trích chép cả số chỉ dẫn như trong bài vẫn khớp", () => {
    expect(verifyQuote("unknown return cycles and returns.11 However, the GI generates", 1, lin).check).toBe("verified");
  });

  it("từ ghép bị ngắt dòng trong chữ thật (long-term, advantage)", () => {
    expect(verifyQuote("will be emphasized in long-term human research", 1, lin).check).toBe("verified");
    expect(verifyQuote("enhances productive capacity and competitive advantage. In addition", 1, lin).check).toBe("verified");
  });

  it("không bỏ nhầm con số thật: 60% phải còn trong câu trích", () => {
    expect(verifyQuote("determines whether more than 60% of the carbon reduction targets", 1, lin).check).toBe("verified");
    expect(verifyQuote("determines whether more than % of the carbon reduction targets", 1, lin).check).toBe("needs_review");
    expect(verifyQuote("determines whether more than 6% of the carbon reduction targets", 1, lin).check).toBe("needs_review");
  });

  it("không bỏ nhầm con số thật: 442 phải còn trong câu trích", () => {
    expect(verifyQuote("Using survey data from 442 firms in China", 3, lin).check).toBe("verified");
    expect(verifyQuote("Using survey data from firms in China, Cai and Li", 3, lin).check).toBe("needs_review");
  });

  it("con số thật đứng sau dấu chấm và khoảng trắng không bị coi là số chỉ dẫn", () => {
    const text = pages("Green credit matters in GI. 10 firms were surveyed in 2021.\n1. Đặt vấn đề\nNgành logistics.\n2. Phương pháp nghiên cứu");
    expect(verifyQuote("matters in GI. 10 firms were surveyed", 1, text).check).toBe("verified");
    expect(verifyQuote("matters in GI. firms were surveyed", 1, text).check).toBe("needs_review");
    expect(verifyQuote("Ngành logistics. Phương pháp nghiên cứu", 1, text).check).toBe("needs_review");
  });

  // Chữ thật từ bài tiếng Trung mẫu (trang 13): PDF chen khoảng trắng vào giữa số thập phân "26. 7%".
  const chinese = pages(
    "平均而言，相比于非电商村农户，电商村农户的\n农产品收购价提高了 26. 7% － 39. 4% ( 三种处理效应的均值为 33% ) ，农产品销售量提高了约",
  );

  it("tiếng Trung: số thập phân bị chen khoảng trắng vẫn khớp với câu chép liền", () => {
    expect(verifyQuote("电商村农户的农产品收购价提高了26.7%－39.4%", 1, chinese).check).toBe("verified");
    expect(verifyQuote("电商村农户的农产品收购价提高了 26. 7% － 39. 4%", 1, chinese).check).toBe("verified");
  });

  it("tiếng Trung: con số đứng sau chữ Hán không bị coi là số chỉ dẫn", () => {
    expect(verifyQuote("电商村农户的农产品收购价提高了.7%－39.4%", 1, chinese).check).toBe("needs_review");
    expect(verifyQuote("电商村农户的农产品收购价提高了 . 7%", 1, chinese).check).toBe("needs_review");
    expect(verifyQuote("三种处理效应的均值为%)", 1, chinese).check).toBe("needs_review");
  });

  it("không bỏ nhầm số thập phân và số dính chữ viết tắt", () => {
    const text = pages("CO2 emissions fell by 13% in 2020, an annual decline of 14.6% overall.");
    expect(verifyQuote("CO2 emissions fell by 13% in 2020", 1, text).check).toBe("verified");
    expect(verifyQuote("CO2 emissions fell by % in 2020", 1, text).check).toBe("needs_review");
    expect(verifyQuote("an annual decline of 14.% overall", 1, text).check).toBe("needs_review");
  });
});

describe("kiểm tra các ô của một bài", () => {
  const body = (topic: string) =>
    Array.from({ length: 20 }, (_, i) => `Paragraph ${i + 1} discusses ${topic} in rural schools across the provinces.`).join("\n");
  const paper = pages(
    body("reading"),
    `${body("method")}\nTheo Vietnam Report (2022), 100% số doanh nghiệp logistics đã tăng cường đầu tư cho chuyển đổi số.\nWe surveyed 412 households in three provinces.`,
    "References\nSmith J. (2020). Reading interventions in rural schools of Vietnam. Journal of Tests.",
  );

  it("ô không tìm thấy: bỏ qua kiểm tra, không tính là cần kiểm tra", () => {
    const [cell] = verifyCells([notFound], paper);
    expect(cell).toEqual({ ...notFound, cites_other_source: false });
    expect(cell.check).toBeNull();
  });

  it("ô sinh viên tự điền: bỏ qua kiểm tra", () => {
    const manual: AiCell = { ...notFound, status: "manual", value_vi: "Tự gõ" };
    expect(verifyCells([manual], paper)[0].check).toBeNull();
  });

  it("gắn kết quả kiểm tra, giữ nguyên câu trích gốc và trang AI ghi", () => {
    const quote = "We  SURVEYED 412 households\nin three provinces";
    const [cell] = verifyCells([proposed(quote, 3)], paper);
    expect(cell.check).toBe("page_corrected");
    expect(cell.page).toBe(2);
    expect(cell.ai_page).toBe(3);
    expect(cell.quote_original).toBe(quote);
  });

  it("câu trong phần tài liệu tham khảo đã bị cắt: cần kiểm tra", () => {
    const [cell] = verifyCells([proposed("Reading interventions in rural schools of Vietnam", 3)], paper);
    expect(cell.check).toBe("needs_review");
  });

  it("gắn cảnh báo dẫn nguồn khác, thêm vào chứ không thay kết quả kiểm tra", () => {
    const [cited, own, missing] = verifyCells(
      [proposed("Theo Vietnam Report (2022), 100% số doanh nghiệp logistics đã tăng cường đầu tư", 2), proposed("We surveyed 412 households in three provinces", 2, "mau"), notFound],
      paper,
    );
    expect(cited.check).toBe("verified");
    expect(cited.cites_other_source).toBe(true);
    expect(own.cites_other_source).toBe(false);
    expect(missing.cites_other_source).toBe(false);
    expect(CITED_SOURCE_WARNING).toContain("dẫn nguồn khác");
  });

  it("câu bịa có dẫn nguồn: vừa cần kiểm tra vừa có cảnh báo", () => {
    const [cell] = verifyCells([proposed("Smith et al. (2019) found a 40% increase in scores", 2)], paper);
    expect(cell.check).toBe("needs_review");
    expect(cell.cites_other_source).toBe(true);
  });

  it("kiểm tra bị lỗi giữa chừng: cần kiểm tra, không được coi là đạt", () => {
    const broken = [
      {
        page: 1,
        get text(): string {
          throw new Error("trang hỏng");
        },
      },
    ] as PdfPage[];
    const [cell, missing] = verifyCells([proposed("We surveyed 412 households in three provinces", 1), notFound], broken);
    expect(cell.check).toBe("needs_review");
    expect(cell.review_reason).toBe("check_failed");
    expect(missing.check).toBeNull();
  });

  it("ô proposed thiếu số trang vẫn được kiểm tra", () => {
    const [cell] = verifyCells([{ ...proposed("We surveyed 412 households in three provinces", 1), page: null, ai_page: null }], paper);
    expect(cell.check).toBe("page_corrected");
    expect(cell.page).toBe(2);
  });
});
