// Test kiểm tra câu trích, theo danh sách bắt buộc của skill citation-check.
// Không gọi AI: câu trích là chữ viết sẵn trong test.
import { describe, expect, it } from "vitest";
import type { PdfPage } from "./pdf-read";
import type { AiCell } from "./types";
import { CITED_SOURCE_WARNING } from "./cited-source";
import { findRepeatedEdgeLines, locateQuote, normalizeForMatch, verifyCells, verifyQuote } from "./verify-quote";

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
      pages: [1, 2, 3],
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

// Dòng đầu trang, chân trang lặp lại (tên tạp chí, số trang) chen giữa câu vắt qua hai trang.
describe("dòng đầu trang và chân trang ở chỗ nối hai trang", () => {
  // Chữ thật từ bài tiếng Việt mẫu: dòng đầu trang có số trang dính vào theo hai kiểu "28-37 29" và "28-3730".
  const header = (n: number) =>
    `P.Q. Hai et al. / VNU Journal of Economics and Business, Vol. 3, No. 1 (2023) ${n % 2 ? `28-37 ${n}` : `28-37${n}`}`;
  const vietnamese = pages(
    `${header(29)}\nThông qua sử dụng phương pháp nghiên cứu\ntổng hợp - so sánh, các tác giả tiến hành tổng\nhợp, so sánh dữ từ các nguồn nghiên cứu trên,\nđưa ra các nhận định, đánh giá về thực trạng\nchuyển đổi số trong các doanh nghiệp logistics\nViệt Nam, từ đó đề xuất các giải pháp có tính khả\nthi nhằm thúc đẩy chuyển đổi số trong các doanh`,
    `${header(30)}\nnghiệp logistics phát triển theo đúng tiềm năng,\nthế mạnh.\n3. Kết quả nghiên cứu`,
    `${header(31)}\nNội dung trang tiếp theo của bài.`,
    `${header(32)}\nNội dung một trang khác nữa.`,
  );
  const vietnameseQuote =
    "Thông qua sử dụng phương pháp nghiên cứu tổng hợp - so sánh, các tác giả tiến hành tổng hợp, so sánh dữ từ các nguồn nghiên cứu trên, đưa ra các nhận định, đánh giá về thực trạng chuyển đổi số trong các doanh nghiệp logistics Việt Nam, từ đó đề xuất các giải pháp có tính khả thi nhằm thúc đẩy chuyển đổi số trong các doanh nghiệp logistics phát triển theo đúng tiềm năng, thế mạnh.";

  it("câu thật của bài tiếng Việt vắt qua trang 2 sang 3, dòng đầu trang chen giữa: đã khớp", () => {
    expect(verifyQuote(vietnameseQuote, 1, vietnamese)).toEqual({ check: "verified", page: 1 });
  });

  it("nhận ra dòng đầu trang dù số trang dính vào theo nhiều kiểu", () => {
    expect(findRepeatedEdgeLines(vietnamese).size).toBe(1);
  });

  it("chân trang có số trang thay đổi chen giữa câu: đã khớp", () => {
    const footer = (n: number) => `${n} Science Progress 106(3)`;
    const english = pages(
      `${filler("a")}\nGreen credit significantly contributes to the\n${footer(2)}`,
      `innovative performance of green firms and limits the flow of credit.\n${footer(3)}`,
      `${filler("b")}\n${footer(4)}`,
      `${filler("c")}\n${footer(5)}`,
    );
    expect(verifyQuote("Green credit significantly contributes to the innovative performance of green firms", 1, english)).toEqual({
      check: "verified",
      page: 1,
    });
  });

  it("cả chân trang lẫn đầu trang chen giữa câu: đã khớp", () => {
    const both = (n: number, body: string) => `Journal of Tests, Vol. 3\n${body}\nPage ${n} of 9`;
    const paper = pages(
      both(1, `${filler("a")}\nThe treatment group received weekly reading`),
      both(2, `sessions for six months.\n${filler("b")}`),
      both(3, filler("c")),
    );
    expect(verifyQuote("The treatment group received weekly reading sessions for six months", 1, paper).check).toBe("verified");
  });

  it("không bỏ nhầm: câu nội dung thật tình cờ ở đầu 2 trang không bị coi là đầu trang", () => {
    const paper = pages(
      `${filler("a")}\nThe treatment group received weekly reading`,
      `sessions for six months.\n${filler("b")}`,
      filler("c"),
      `sessions for six months.\n${filler("d")}`,
    );
    expect(findRepeatedEdgeLines(paper).size).toBe(0);
    // Nếu dòng "sessions for six months." bị bỏ nhầm, câu vắt qua trang 1 và 2 sẽ không còn khớp.
    expect(verifyQuote("The treatment group received weekly reading sessions for six months", 1, paper).check).toBe("verified");
  });

  it("dòng chỉ lặp ở 2 trang thì không coi là đầu trang", () => {
    const paper = pages(`Running title\n${filler("a")}\nThe sample covers`, `Running title\nfour provinces in 2020.`, filler("c"));
    expect(findRepeatedEdgeLines(paper).size).toBe(0);
    expect(verifyQuote("The sample covers four provinces in 2020", 1, paper).check).toBe("needs_review");
  });

  it("bài dưới 3 trang thì không áp dụng", () => {
    const paper = pages(`Running title 1\nThe sample covers`, `Running title 2\nfour provinces in 2020.`);
    expect(findRepeatedEdgeLines(paper).size).toBe(0);
  });

  it("chỉ bỏ dòng đầu trang khi so ở chỗ nối, không xoá khỏi chữ của bài", () => {
    const before = vietnamese.map((page) => page.text);
    verifyQuote(vietnameseQuote, 1, vietnamese);
    expect(vietnamese.map((page) => page.text)).toEqual(before);
    // Câu nằm trong dòng đầu trang vẫn tìm thấy (ở mọi trang), không bị coi là không có.
    expect(verifyQuote("VNU Journal of Economics and Business", 1, vietnamese).review_reason).toBe("multi_page");
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

  it("câu có ở nhiều trang: nhớ từng trang và chỗ tô ở trang đó, nhãn vẫn là cần kiểm tra", () => {
    const quote = "Paragraph 3 discusses reading in rural schools";
    const twice = pages(body("reading"), body("method"), `${body("reading")}`, "References\nSmith J. (2020).");
    const [cell] = verifyCells([proposed(quote, 3)], twice);
    expect(cell.check).toBe("needs_review");
    expect(cell.review_reason).toBe("multi_page");
    expect(cell.quote_ranges).toBeNull();
    expect(cell.page_matches?.map((match) => match.page)).toEqual([1, 3]);
    for (const match of cell.page_matches ?? []) {
      const range = match.ranges?.[0];
      expect(range?.page).toBe(match.page);
      expect(twice[match.page - 1].text.slice(range!.start, range!.end)).toBe(quote);
    }
  });

  it("chỉ có ở một trang thì không có page_matches", () => {
    const [cell] = verifyCells([proposed("We surveyed 412 households in three provinces", 2)], paper);
    expect(cell.page_matches).toBeUndefined();
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

describe("tìm vị trí câu trích để tô vàng", () => {
  const slice = (texts: PdfPage[], range: { page: number; start: number; end: number }) =>
    texts.find((page) => page.page === range.page)!.text.slice(range.start, range.end);

  it("câu nằm gọn trong trang: trả về đúng đoạn chữ gốc, kể cả chữ hoa và xuống dòng", () => {
    const doc = pages(filler("a"), "Intro text. The Treatment group\nimproved by 13% after one year. End.");
    const ranges = locateQuote("the treatment group improved by 13% after one year", 2, doc)!;
    expect(ranges).toHaveLength(1);
    expect(slice(doc, ranges[0])).toBe("The Treatment group\nimproved by 13% after one year");
  });

  it("gạch nối cuối dòng và chữ dính fi", () => {
    const doc = pages("We study high-\npoverty areas and ﬁnd strong effects here.");
    const ranges = locateQuote("high-poverty areas and find strong effects", 1, doc)!;
    expect(slice(doc, ranges[0])).toBe("high-\npoverty areas and ﬁnd strong effects");
  });

  it("tiếng Việt dấu tổ hợp và tiếng Trung", () => {
    const vi = "Kết quả cho thấy doanh nghiệp tăng trưởng".normalize("NFD");
    const doc = pages(`Mở đầu. ${vi} mạnh.`, "本文数据来源于 作者 2018 年和\n2020 年两轮调查。");
    expect(slice(doc, locateQuote("Kết quả cho thấy doanh nghiệp tăng trưởng", 1, doc)![0])).toBe(vi);
    expect(slice(doc, locateQuote("本文数据来源于作者2018年和2020年两轮调查", 2, doc)![0])).toBe("本文数据来源于 作者 2018 年和\n2020 年两轮调查");
  });

  it("số chỉ dẫn dính vào chữ vẫn tìm được", () => {
    const doc = pages("Kemp and Pearson29 explained GI from a broad perspective.");
    const ranges = locateQuote("Kemp and Pearson explained GI from a broad perspective", 1, doc)!;
    expect(slice(doc, ranges[0])).toBe("Kemp and Pearson29 explained GI from a broad perspective");
  });

  it("câu vắt qua hai trang, dòng đầu trang chen giữa: tô hai đoạn", () => {
    const header = "Journal of Tests 12 (2023) 1-20";
    const doc = pages(
      `${header}\n${filler("a")}\nThe main finding is that firms`,
      `${header}\nwith green credit innovate more often.\n${filler("b")}`,
      `${header}\n${filler("c")}`,
    );
    const ranges = locateQuote("The main finding is that firms with green credit innovate more often", 1, doc)!;
    expect(ranges.map((range) => range.page)).toEqual([1, 2]);
    expect(slice(doc, ranges[0])).toBe("The main finding is that firms");
    expect(slice(doc, ranges[1])).toBe("with green credit innovate more often");
  });

  it("bỏ số chỉ dẫn nhưng không bỏ con số thật: không tô nhầm câu khác chỉ khác con số", () => {
    const doc = pages("Pearson raised patents by 12 percent in the first group. Later, Pearson29 raised patents by 15 percent in the second group.");
    const ranges = locateQuote("Pearson raised patents by 15 percent in the second group", 1, doc)!;
    expect(slice(doc, ranges[0])).toBe("Pearson29 raised patents by 15 percent in the second group");
  });

  it("không tô trong phần tài liệu tham khảo đã bị cắt", () => {
    const doc = pages(filler("a"), "Main text ends here.\nReferences\nSmith J. Green credit and innovation outcomes in China. 2019.");
    const body = [doc[0], { page: 2, text: "Main text ends here.\n" }];
    expect(locateQuote("Green credit and innovation outcomes in China", 2, doc, body)).toBeNull();
    expect(locateQuote("Green credit and innovation outcomes in China", 2, doc)).not.toBeNull();
  });

  it("không có trong trang: trả về null", () => {
    expect(locateQuote("a sentence that does not exist anywhere", 1, pages(filler("a")))).toBeNull();
  });

  it("verifyCells gắn vị trí cho ô đã khớp, không gắn cho ô cần kiểm tra", () => {
    const doc = pages(filler("a"), "Results: the treatment group improved by 13% after one year.");
    const [ok, bad] = verifyCells(
      [proposed("the treatment group improved by 13% after one year", 2), proposed("an invented sentence that is not in the paper", 2, "han-che")],
      doc,
    );
    expect(ok.quote_ranges).toEqual([{ page: 2, start: 9, end: 59 }]);
    expect(bad.check).toBe("needs_review");
    expect(bad.quote_ranges ?? null).toBeNull();
  });
});
