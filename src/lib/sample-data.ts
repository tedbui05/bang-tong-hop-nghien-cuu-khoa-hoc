import { suggestedColumns } from "./columns";
import type { AiCell, Paper, PaperInfo, ReviewCell, SavedPaper, SheetTable } from "./types";

// Dữ liệu mẫu lấy từ các bài báo có thật. Mọi câu trích đều chép nguyên văn từ file PDF và đã được
// dò lại trong bài gốc. Nhãn được gán tay vì code kiểm tra chưa có; ô "cần kiểm tra" dùng trường hợp
// thật theo quy tắc đã chốt: câu trích ngắn dưới 15 ký tự, hoặc câu xuất hiện ở nhiều trang.
// Số trang là số trang của file PDF, không phải số in trên trang.

// Mã cột của bảng mẫu; cột này chỉ có ở bảng mẫu, không nằm trong bộ cột gợi ý.
const CUSTOM_COLUMN = "so-lieu-viet-nam";

type RawPaper = {
  id: string;
  title: string;
  authors: string;
  year: number;
  source: string;
  language_vi: string;
  language_code: string;
};

function toPaper({ id, title, authors, year, source, language_vi, language_code }: RawPaper): Paper {
  const info: PaperInfo = { title, authors, year: String(year), source, language: language_vi };
  return { id, language_code, info, suggested_info: info };
}

const notFound = (column: string): AiCell => ({
  column,
  value_vi: "không tìm thấy",
  quote_original: null,
  quote_vi: null,
  page: null,
  status: "not_found",
  check: null,
  ai_page: null,
});

export const reviewPaper: Paper = toPaper({
  id: "bloom-2013",
  title: "Does Working from Home Work? Evidence from a Chinese Experiment",
  authors: "Bloom, Liang, Roberts & Ying",
  year: 2013,
  source: "NBER Working Paper 18871",
  language_vi: "tiếng Anh",
  language_code: "en",
});

export const reviewCells: AiCell[] = [
  {
    column: "cau-hoi",
    value_vi:
      "Cho nhân viên làm việc tại nhà có phải là cách quản lý hữu ích không? Bài kiểm chứng câu hỏi này bằng thí nghiệm tại CTrip, công ty du lịch lớn nhất Trung Quốc.",
    quote_original:
      "Having employees work from home raises two major issues. First, is it a useful management practice?",
    quote_vi:
      "Việc cho nhân viên làm việc tại nhà đặt ra hai vấn đề lớn. Thứ nhất, đây có phải là một cách quản lý hữu ích không?",
    page: 3,
    status: "proposed",
    check: "verified",
    ai_page: 3,
  },
  {
    column: "phuong-phap",
    value_vi:
      "Thí nghiệm ngẫu nhiên có đối chứng kéo dài 9 tháng. Bốc thăm theo ngày sinh: người sinh ngày chẵn làm tại nhà, người sinh ngày lẻ ở lại văn phòng làm nhóm đối chứng.",
    quote_original:
      "After a lottery draw, those with even-numbered birthdays were selected to work at home from these 249 employees while those with odd-numbered birthdates stayed in the office to act as the control group.",
    quote_vi:
      "Sau khi bốc thăm, trong số 249 nhân viên này, những người có ngày sinh chẵn được chọn làm việc tại nhà, còn những người có ngày sinh lẻ ở lại văn phòng để làm nhóm đối chứng.",
    page: 4,
    status: "proposed",
    check: "verified",
    ai_page: 4,
  },
  {
    column: "mau",
    value_vi:
      "249 nhân viên tổng đài của CTrip tại Thượng Hải, chọn từ 503 người tình nguyện. Điều kiện: làm ít nhất 6 tháng, có mạng băng thông rộng và có chỗ làm việc riêng ở nhà.",
    quote_original:
      "Among the volunteers, 249 (50%) of the employees met the eligibility requirements and were recruited into the experiment.",
    quote_vi:
      "Trong số những người tình nguyện, 249 nhân viên (50%) đạt yêu cầu và được đưa vào thí nghiệm.",
    page: 9,
    status: "proposed",
    check: "page_corrected",
    ai_page: 4,
  },
  {
    column: "ket-qua",
    value_vi:
      "Hiệu suất của nhóm làm tại nhà tăng 13%: khoảng 9% do làm nhiều phút hơn mỗi ca, 4% do nhận nhiều cuộc gọi hơn mỗi phút.",
    quote_original: "by 13%",
    quote_vi: "tăng 13%",
    page: 4,
    status: "proposed",
    check: "needs_review",
    ai_page: 4,
    review_reason: "too_short",
  },
  {
    column: "han-che",
    value_vi:
      "Bài chỉ nghiên cứu nhân viên tổng đài, thường lương thấp và có kết quả dễ đo, nên kết luận trực tiếp về hiệu suất chỉ áp dụng cho những công việc như vậy.",
    quote_original:
      "As such the direct implications for performance are limited to these types of jobs.",
    quote_vi: "Vì vậy, những hàm ý trực tiếp về hiệu suất chỉ giới hạn ở các loại công việc này.",
    page: 6,
    status: "proposed",
    check: "verified",
    ai_page: 6,
  },
  notFound(CUSTOM_COLUMN),
];

const microfinanceCells: AiCell[] = [
  {
    column: "cau-hoi",
    value_vi: "Đưa sản phẩm tín dụng vi mô cho vay theo nhóm vào một thị trường mới tạo ra tác động gì?",
    quote_original:
      "This paper reports on the first randomized evaluation of the impact of introducing the standard microcredit group-based lending product in a new market.",
    quote_vi:
      "Bài này trình bày đánh giá ngẫu nhiên đầu tiên về tác động của việc đưa sản phẩm tín dụng vi mô tiêu chuẩn, cho vay theo nhóm, vào một thị trường mới.",
    page: 2,
    status: "proposed",
    check: "verified",
    ai_page: 2,
  },
  {
    column: "phuong-phap",
    value_vi:
      "Đánh giá ngẫu nhiên: năm 2005, chọn ngẫu nhiên một nửa trong 104 khu ổ chuột ở Hyderabad (Ấn Độ) để mở chi nhánh của tổ chức tài chính vi mô Spandana.",
    quote_original:
      "In 2005, half of 104 slums in Hyderabad, India were randomly selected for opening of a branch of a particular microfinance institution (Spandana) while the remainder were not, although other MFIs were free to enter those slums.",
    quote_vi:
      "Năm 2005, một nửa trong 104 khu ổ chuột ở Hyderabad, Ấn Độ, được chọn ngẫu nhiên để mở chi nhánh của một tổ chức tài chính vi mô (Spandana), còn các khu còn lại thì không, dù các tổ chức khác vẫn được tự do vào những khu đó.",
    page: 2,
    status: "proposed",
    check: "verified",
    ai_page: 2,
  },
  {
    column: "mau",
    value_vi: "Khảo sát ban đầu 2.800 hộ gia đình để đánh giá nhanh tình hình các khu dân cư.",
    quote_original:
      "We surveyed a total of 2,800 households in order to obtain a rapid assessment of the baseline conditions of the neighborhoods.",
    quote_vi:
      "Chúng tôi khảo sát tổng cộng 2.800 hộ gia đình để đánh giá nhanh tình hình ban đầu của các khu dân cư.",
    page: 9,
    status: "proposed",
    check: "verified",
    ai_page: 9,
  },
  {
    column: "ket-qua",
    value_vi: "Sau 15 đến 18 tháng, chi tiêu bình quân đầu người mỗi tháng không thay đổi.",
    quote_original: "There was no effect on average monthly expenditure per capita.",
    quote_vi: "Không có tác động nào đến chi tiêu bình quân đầu người hằng tháng.",
    page: 2,
    status: "proposed",
    check: "verified",
    ai_page: 2,
  },
  {
    column: "han-che",
    value_vi:
      "Kết quả từ một thành phố đang phát triển mạnh như Hyderabad chưa chắc áp dụng được cho nông thôn hoặc nước khác.",
    quote_original:
      "The external validity question is straightforward: are the results obtained in a booming city like Hyderabad any guide to what one would obtain in rural areas, or in another country?",
    quote_vi:
      "Câu hỏi về giá trị ngoại suy rất đơn giản: kết quả thu được ở một thành phố đang bùng nổ như Hyderabad có giúp dự đoán kết quả ở nông thôn hay ở nước khác không?",
    page: 31,
    status: "proposed",
    check: "verified",
    ai_page: 31,
  },
  notFound(CUSTOM_COLUMN),
];

type Cell = Omit<AiCell, "status" | "check" | "ai_page"> & Partial<Pick<AiCell, "check" | "ai_page" | "review_reason">>;

// Gọn cách viết: mặc định ô đã khớp và AI ghi đúng trang.
const cell = (data: Cell): AiCell => ({
  ...data,
  status: "proposed",
  check: data.check ?? "verified",
  ai_page: data.ai_page ?? data.page,
});

const chinaSyndromeCells: AiCell[] = [
  cell({
    column: "cau-hoi",
    value_vi: "Cạnh tranh từ hàng nhập khẩu Trung Quốc tác động thế nào đến các thị trường lao động địa phương ở Mỹ, giai đoạn 1990 đến 2007?",
    quote_original:
      "In this paper, we relate changes in labor-market outcomes from 1990 to 2007 across U.S. local labor markets to changes in exposure to Chinese import competition.",
    quote_vi:
      "Trong bài này, chúng tôi liên hệ những thay đổi về kết quả thị trường lao động từ 1990 đến 2007 giữa các thị trường lao động địa phương ở Mỹ với những thay đổi về mức độ chịu cạnh tranh từ hàng nhập khẩu Trung Quốc.",
    page: 3,
  }),
  cell({
    column: "phuong-phap",
    value_vi: "Dùng biến công cụ: lấy mức tăng nhập khẩu từ Trung Quốc của các nước thu nhập cao khác để đại diện cho mức tăng nhập khẩu vào Mỹ.",
    quote_original:
      "we instrument for the growth in U.S. imports from China using Chinese import growth in other high-income markets.",
    quote_vi:
      "chúng tôi dùng mức tăng nhập khẩu từ Trung Quốc ở các thị trường thu nhập cao khác làm biến công cụ cho mức tăng nhập khẩu của Mỹ từ Trung Quốc.",
    page: 5,
    check: "needs_review",
    review_reason: "multi_page",
  }),
  cell({
    column: "mau",
    value_vi: "722 vùng đi lại (commuting zones), phủ toàn bộ lục địa Mỹ, gồm cả đô thị và nông thôn.",
    quote_original: "722 CZs",
    quote_vi: "722 vùng đi lại",
    page: 13,
    check: "needs_review",
    review_reason: "too_short",
  }),
  cell({
    column: "ket-qua",
    value_vi: "Chịu cạnh tranh nhập khẩu nhiều hơn làm tăng thất nghiệp, giảm tỷ lệ tham gia lao động và giảm lương ở thị trường địa phương.",
    quote_original:
      "Rising exposure increases unemployment, lowers labor force participation, and reduces wages in local labor markets.",
    quote_vi:
      "Mức độ chịu cạnh tranh tăng làm tăng thất nghiệp, giảm tỷ lệ tham gia lực lượng lao động và giảm lương ở các thị trường lao động địa phương.",
    page: 2,
  }),
  cell({
    column: "han-che",
    value_vi: "Tác giả không loại trừ được khả năng có thêm tác động cân bằng tổng thể lên việc làm và tiền lương toàn quốc.",
    quote_original:
      "We cannot rule out the possibility that there are also general equilibrium effects on national employment and wages.",
    quote_vi:
      "Chúng tôi không thể loại trừ khả năng còn có các tác động cân bằng tổng thể lên việc làm và tiền lương toàn quốc.",
    page: 30,
  }),
  notFound(CUSTOM_COLUMN),
];

const movingToOpportunityCells: AiCell[] = [
  cell({
    column: "cau-hoi",
    value_vi: "Chuyển đến khu vực ít nghèo hơn có cải thiện kết quả kinh tế dài hạn cho những trẻ còn nhỏ lúc được phân nhóm ngẫu nhiên không?",
    quote_original:
      "First, we hypothesize that moving to a lower-poverty area improves long-term economic outcomes for children who were young at the point of random assignment (RA).",
    quote_vi:
      "Thứ nhất, chúng tôi giả thuyết rằng chuyển đến khu vực ít nghèo hơn sẽ cải thiện kết quả kinh tế dài hạn cho những trẻ còn nhỏ tại thời điểm phân nhóm ngẫu nhiên (RA).",
    page: 3,
  }),
  cell({
    column: "phuong-phap",
    value_vi: "Ước lượng theo ý định điều trị (ITT), hồi quy kết quả lúc trưởng thành theo nhóm được phân ngẫu nhiên, nối dữ liệu thí nghiệm với hồ sơ thuế.",
    quote_original:
      "We estimate the treatment effects of growing up in these very different environments by replicating the intent-to-treat (ITT) specifications used in prior work",
    quote_vi:
      "Chúng tôi ước lượng tác động của việc lớn lên trong những môi trường rất khác nhau này bằng cách lặp lại các đặc tả theo ý định điều trị (ITT) đã dùng trong các nghiên cứu trước",
    page: 4,
  }),
  cell({
    column: "mau",
    value_vi: "4.604 gia đình ở năm thành phố lớn của Mỹ, được phân ngẫu nhiên vào ba nhóm, thực hiện từ 1994 đến 1998.",
    quote_original: "The experimental sample included 4,604 families, who were randomly assigned to one of three groups",
    quote_vi: "Mẫu thí nghiệm gồm 4.604 gia đình, được phân ngẫu nhiên vào một trong ba nhóm",
    page: 4,
    check: "page_corrected",
    ai_page: 3,
  }),
  cell({
    column: "ket-qua",
    value_vi: "Trẻ dưới 13 tuổi có gia đình dùng phiếu hỗ trợ thí nghiệm có thu nhập năm cao hơn 3.477 USD (31%) khi ở độ tuổi giữa 20.",
    quote_original:
      "have an annual income that is $3,477 (31%) higher on average relative to a mean of $11,270 in the control group in their mid-twenties.",
    quote_vi:
      "có thu nhập năm cao hơn trung bình 3.477 USD (31%) so với mức trung bình 11.270 USD của nhóm đối chứng khi ở độ tuổi giữa 20.",
    page: 2,
  }),
  cell({
    column: "han-che",
    value_vi: "Mẫu ở mỗi độ tuổi nhỏ nên các ước lượng theo từng độ tuổi chưa thật chính xác.",
    quote_original: "the age-specific estimates are not very precise because of the small sample sizes",
    quote_vi: "các ước lượng theo từng độ tuổi không thật chính xác vì cỡ mẫu nhỏ",
    page: 32,
  }),
  notFound(CUSTOM_COLUMN),
];

const microcreditSpendingCells: AiCell[] = [
  cell({
    column: "cau-hoi",
    value_vi: "Tiếp cận tín dụng vi mô tác động thế nào đến cấu trúc chi tiêu của hộ nông thôn Bắc Trung Bộ?",
    quote_original:
      "Nghiên cứu xem xét tác động của việc tiếp cận tín dụng vi mô đối với cấu trúc chi tiêu, cụ thể là tỷ lệ chi tiêu phi lương thực so với tổng chi tiêu, của hộ gia đình nông thôn khu vực Bắc Trung Bộ Việt Nam.",
    quote_vi: null,
    page: 1,
  }),
  cell({
    column: "phuong-phap",
    value_vi: "So khớp điểm xu hướng (PSM) trên dữ liệu Khảo sát Mức sống Hộ gia đình Việt Nam năm 2020.",
    quote_original:
      "Nhóm tác giả đã sử dụng phương pháp so sánh điểm xu hướng (PSM) trên dữ liệu từ Khảo sát Mức sống Hộ gia đình Việt Nam năm 2020.",
    quote_vi: null,
    page: 1,
  }),
  cell({
    column: "mau",
    value_vi: "714 quan sát là hộ gia đình ở nông thôn Bắc Trung Bộ, lấy từ VHLSS 2020.",
    quote_original: "Bảng 2 bao gồm 714 quan sát",
    quote_vi: null,
    page: 8,
  }),
  cell({
    column: "ket-qua",
    value_vi: "Tỷ lệ chi tiêu phi lương thực của hộ nông thôn có thể tăng từ 2,75% đến 3,25% khi tham gia chương trình tín dụng vi mô.",
    quote_original: "có thể tăng từ 2,75% đến 3,25% khi tham gia vào các chương trình tín dụng vi mô.",
    quote_vi: null,
    page: 14,
    check: "page_corrected",
    ai_page: 13,
  }),
  cell({
    column: "han-che",
    value_vi: "Bài chỉ xét mức sống qua tỷ lệ chi tiêu phi thực phẩm nói chung, chưa xét riêng y tế, giáo dục.",
    quote_original:
      "nghiên cứu này vẫn còn một số hạn chế khi chỉ xem xét tác động của việc tiếp cận tín dụng đối với mức sống thông qua tỷ lệ chi tiêu phi thực phẩm nói chung.",
    quote_vi: null,
    page: 14,
  }),
  cell({
    column: CUSTOM_COLUMN,
    value_vi: "Khoản vay trung bình ở nông thôn Bắc Trung Bộ là 102 triệu đồng.",
    quote_original: "giá trị trung bình của một khoản vay ở khu vực nông thôn Bắc Trung Bộ là 102 triệu đồng.",
    quote_vi: null,
    page: 8,
  }),
];

const formalMicrocreditCells: AiCell[] = [
  cell({
    column: "cau-hoi",
    value_vi: "Điều gì quyết định việc hộ gia đình tiếp cận được tín dụng vi mô, và tín dụng đó tác động thế nào đến phúc lợi của hộ?",
    quote_original:
      "Nghiên cứu này được thực hiện nhằm xác định các nhân tố quyết định tiếp cận tín dụng vi mô và tác động của nó đến phúc lợi hộ gia đình.",
    quote_vi: null,
    page: 1,
  }),
  cell({
    column: "phuong-phap",
    value_vi: "So sánh thay đổi thu nhập và chi tiêu giữa hộ có và không tham gia, kết hợp so khớp điểm xu hướng (PSM) với khác biệt kép (DID).",
    quote_original:
      "so sánh sự thay đổi của các chỉ tiêu phúc lợi (thu nhập/chi tiêu) của các hộ gia đình giữa nhóm tham gia và nhóm không tham gia các chương trình tín dụng vi mô.",
    quote_vi: null,
    page: 2,
  }),
  cell({
    column: "mau",
    value_vi: "Bộ số liệu mảng cân bằng gồm 8.092 quan sát, tương ứng 4.046 hộ gia đình.",
    quote_original: "bộ số liệu mảng cân bằng cuối gồm 8092 quan sát, tương ứng với 4046 hộ.",
    quote_vi: null,
    page: 4,
  }),
  cell({
    column: "ket-qua",
    value_vi: "Chính sách chưa đạt hiệu quả mong muốn về tổng thể, nhưng hộ tham gia chi nhiều hơn cho giáo dục, lương thực và đầu tư sản xuất.",
    quote_original: "Chính sách hỗ trợ tín dụng vi mô chưa đạt hiệu quả mong muốn.",
    quote_vi: null,
    page: 1,
  }),
  notFound("han-che"),
  cell({
    column: CUSTOM_COLUMN,
    value_vi: "Dùng số liệu Điều tra mức sống hộ gia đình (VHLSS) năm 2010 và 2012.",
    quote_original: "Nghiên cứu này sử dụng bộ số liệu Điều tra mức sống hộ gia đình (VHLSS) năm 2010 và 2012.",
    quote_vi: null,
    page: 4,
  }),
];

const minimumWageCells: AiCell[] = [
  cell({
    column: "cau-hoi",
    value_vi: "Lương tối thiểu ảnh hưởng thế nào đến việc làm ở các vùng và các mức năng suất lao động khác nhau tại Trung Quốc?",
    quote_original: "进一步分析了最低工资标准对不同地区、不同劳动生产率就业人员的影响。",
    quote_vi: "phân tích thêm ảnh hưởng của mức lương tối thiểu đến người lao động ở các vùng và các mức năng suất lao động khác nhau.",
    page: 1,
  }),
  cell({
    column: "phuong-phap",
    value_vi: "Bình phương tối thiểu tổng quát khả thi (FGLS), tách riêng lao động trong và ngoài biên chế.",
    quote_original: "运用广义最小二乘法（ＦＧＬＳ）实证研究了最低工资标准对我国体制内和体制外就业人员的影响",
    quote_vi: "dùng phương pháp bình phương tối thiểu tổng quát (FGLS) để nghiên cứu thực chứng ảnh hưởng của mức lương tối thiểu đến lao động trong và ngoài biên chế ở nước ta",
    page: 1,
  }),
  cell({
    column: "mau",
    value_vi: "31 tỉnh, thành của Trung Quốc đại lục, giai đoạn 2003 đến 2014.",
    quote_original: "３１个省份",
    quote_vi: "31 tỉnh, thành",
    page: 1,
    check: "needs_review",
    review_reason: "too_short",
  }),
  cell({
    column: "ket-qua",
    value_vi: "Tăng lương tối thiểu có ảnh hưởng tiêu cực nhất định đến việc làm; riêng miền Đông lại thúc đẩy việc làm.",
    quote_original: "最低工资标准的提高对就业存在一定的负向影响",
    quote_vi: "việc tăng mức lương tối thiểu có ảnh hưởng tiêu cực nhất định đến việc làm",
    page: 1,
    check: "needs_review",
    review_reason: "multi_page",
  }),
  notFound("han-che"),
  notFound(CUSTOM_COLUMN),
];

const digitalFinanceCells: AiCell[] = [
  cell({
    column: "cau-hoi",
    value_vi: "Tài chính toàn diện số thúc đẩy tăng trưởng tài sản của hộ gia đình ra sao, và qua cơ chế nào?",
    quote_original: "研究了数字普惠金融促进家庭财富增长的效应及机制。",
    quote_vi: "nghiên cứu hiệu ứng và cơ chế tài chính toàn diện số thúc đẩy tăng trưởng tài sản của hộ gia đình.",
    page: 1,
  }),
  cell({
    column: "phuong-phap",
    value_vi: "Dùng khoảng cách địa lý làm biến công cụ để giảm vấn đề nội sinh, kèm phân tích khác biệt giữa các nhóm hộ.",
    quote_original: "采用地理距离作为工具变量缓解了内生性问题",
    quote_vi: "dùng khoảng cách địa lý làm biến công cụ để giảm bớt vấn đề nội sinh",
    page: 3,
  }),
  cell({
    column: "mau",
    value_vi: "8.120 hộ gia đình với 24.360 lượt quan sát, từ Khảo sát theo dõi gia đình Trung Quốc (CFPS) 2012, 2014 và 2016.",
    quote_original: "本文涉及 8 120 户家庭的 24 360 次观察。",
    quote_vi: "Bài này gồm 24.360 lượt quan sát của 8.120 hộ gia đình.",
    page: 5,
  }),
  cell({
    column: "ket-qua",
    value_vi: "So với tài chính toàn diện truyền thống, tài chính toàn diện số thúc đẩy quy mô tài sản của hộ mạnh hơn.",
    quote_original: "数字普惠金融更能促进家庭总体财富规模的增长",
    quote_vi: "tài chính toàn diện số thúc đẩy tăng trưởng quy mô tổng tài sản của hộ gia đình mạnh hơn",
    page: 1,
  }),
  notFound("han-che"),
  notFound(CUSTOM_COLUMN),
];

export function toReviewCells(cells: AiCell[]): ReviewCell[] {
  return cells.map((cell) => ({ ...cell, suggested_value: cell.value_vi, review: "pending" }));
}

const confirmed = (cells: AiCell[]) => toReviewCells(cells).map((item) => ({ ...item, review: "confirmed" as const }));

const samplePapers: SavedPaper[] = ([
  {
    id: "banerjee-2013",
    title: "The Miracle of Microfinance? Evidence from a Randomized Evaluation",
    authors: "Duflo, Banerjee, Glennerster & Kinnan",
    year: 2013,
    source: "NBER Working Paper 18950",
    language_vi: "tiếng Anh",
    language_code: "en",
    cells: confirmed(microfinanceCells),
  },
  {
    id: "autor-2012",
    title: "The China Syndrome: Local Labor Market Effects of Import Competition in the United States",
    authors: "Autor, Dorn & Hanson",
    year: 2012,
    source: "NBER Working Paper 18054",
    language_vi: "tiếng Anh",
    language_code: "en",
    cells: confirmed(chinaSyndromeCells),
  },
  {
    id: "chetty-2015",
    title: "The Effects of Exposure to Better Neighborhoods on Children: New Evidence from the Moving to Opportunity Experiment",
    authors: "Chetty, Hendren & Katz",
    year: 2015,
    source: "NBER Working Paper 21156",
    language_vi: "tiếng Anh",
    language_code: "en",
    cells: confirmed(movingToOpportunityCells),
  },
  {
    id: "nguyen-2025",
    title: "Tín dụng vi mô và cấu trúc chi tiêu của hộ gia đình: Nghiên cứu tại khu vực nông thôn Bắc Trung Bộ, Việt Nam",
    authors: "Nguyễn Thị Khánh Trang & Lê Viết Giáp",
    year: 2025,
    source: "Tạp chí Khoa học Quản lý & Kinh tế, số 34",
    language_vi: "tiếng Việt",
    language_code: "vi",
    cells: confirmed(microcreditSpendingCells),
  },
  {
    id: "ho-2016",
    title: "Tác động của tín dụng vi mô chính thức đến phúc lợi hộ gia đình Việt Nam",
    authors: "Hồ Đình Bảo",
    year: 2016,
    source: "Tạp chí Kinh tế và Phát triển, số 227",
    language_vi: "tiếng Việt",
    language_code: "vi",
    cells: confirmed(formalMicrocreditCells),
  },
  {
    id: "wang-2018",
    title: "最低工资标准、劳动生产率差异与就业效应研究",
    authors: "王延中、王国洪",
    year: 2018,
    source: "中国社会科学院研究生院学报, 2018年第1期",
    language_vi: "tiếng Trung",
    language_code: "zh",
    cells: confirmed(minimumWageCells),
  },
  {
    id: "zhou-2021",
    title: "数字渗透、金融普惠与家庭财富增长",
    authors: "周天芸、陈铭翔",
    year: 2021,
    source: "财经研究, 第47卷第7期",
    language_vi: "tiếng Trung",
    language_code: "zh",
    cells: confirmed(digitalFinanceCells),
  },
] satisfies (RawPaper & { cells: ReviewCell[] })[]).map(({ cells, ...raw }) => ({ ...toPaper(raw), cells }));

export const sampleTable: SheetTable = {
  id: "bang-mau",
  name: "Bảng mẫu",
  description: "Dữ liệu minh hoạ từ 7 bài báo thật về tín dụng vi mô, việc làm và chính sách.",
  columns: [
    ...suggestedColumns(),
    {
      id: CUSTOM_COLUMN,
      name: "Số liệu tại Việt Nam",
      description: "Số liệu về Việt Nam được nêu trong bài, kèm năm của số liệu",
      kind: "content",
      visible: true,
    },
  ],
  papers: samplePapers,
};
