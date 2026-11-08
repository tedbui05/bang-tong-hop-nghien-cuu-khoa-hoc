import { describe, expect, it } from "vitest";
import { CITED_SOURCE_WARNING, citesOtherSource } from "./cited-source";

describe("nhận ra câu trích dẫn nguồn khác", () => {
  const cited: [string, string][] = [
    // Tiếng Việt
    ["Theo X (2022)", "Theo Vietnam Report (2022), 100% số doanh nghiệp logistics đã tăng cường đầu tư cho chuyển đổi số."],
    ["Tên (năm) cho thấy", "Nguyễn (2020) cho thấy tín dụng vi mô làm tăng chi tiêu cho giáo dục."],
    ["nhiều tác giả", "Nguyễn và Trần (2019) chỉ ra rằng hộ nghèo ít tiếp cận tín dụng."],
    ["và cộng sự", "Kết quả của Lê và cộng sự cho thấy mức tăng 12%."],
    ["ngoặc có tổ chức", "Có tới 42,11% doanh nghiệp cho biết nguồn nhân lực hạn chế (Ministry of Industry and Trade, 2021)."],
    ["ngoặc tiếng Việt", "Chuyển đổi số giúp giảm 80% chi phí (Bộ Công Thương, 2020)."],
    // Tiếng Anh
    ["et al. (năm)", "Smith et al. (2019) found that remote work increased productivity by 13%."],
    ["(Tên, năm)", "Remote work increased productivity (Smith, 2019)."],
    ["nhiều nguồn trong ngoặc", "Green credit reduces emissions (Zhang & Li, 2020; Wang et al., 2021)."],
    ["et al. trong câu", "As shown by Bloom et al., the effect persisted after the experiment."],
    ["số thứ tự tài liệu", "Green credit policies have been shown to promote innovation [12, 15]."],
    ["năm có chữ cái", "Chen (2018a) reports a similar elasticity."],
    // Tiếng Trung
    ["据...研究", "据中国社会科学院研究，农村电商交易额增长了30%。"],
    ["据...统计", "据国家统计局统计，2020年农村网络零售额达到1.79万亿元。"],
    ["Tên等(năm)", "汪阳洁等（2019）发现交易成本显著影响销售渠道选择。"],
    ["ngoặc toàn khổ", "交易成本影响农户的渠道选择（张三，2019）。"],
    // Câu thật trong bài tiếng Trung mẫu: có khoảng trắng sau dấu mở ngoặc.
    ["khoảng trắng sau ngoặc, tên Hán", "电子商务在培育经济发展新动能、拉动就业与推动中国产业结构升级( 许恒等，2020) 。"],
    ["khoảng trắng sau ngoặc, tên Hán có 和", "进而实现经济高质量发展上起着重要作用( 马述忠和房超，2020) 。"],
    ["khoảng trắng sau ngoặc, tên Latin", "相对稀有和小众的产品更容易被发现( Yang，2013) ，地方性农产品也开始流向全国市场。"],
    ["根据...报告", "根据商务部报告，农村网络零售额持续增长。"],
    ["tên có tiền tố viết thường", "另一种观点则强调中间商具有显著降低交易成本和销售壁垒的作用( van der Heijden，1996) 。"],
    ["khoảng trắng giữa chữ Hán", "根据北京大学中国农业 政 策 研 究 中 心 ( CCAP) 2022 年 初 在 5 省 的 抽 样 调 查，样 本中仅有约 0.5%。"],
  ];
  for (const [name, quote] of cited) {
    it(`báo: ${name}`, () => expect(citesOtherSource(quote)).toBe(true));
  }

  const own: [string, string][] = [
    ["năm đứng đầu câu", "Năm 2022, doanh thu của các doanh nghiệp logistics tăng 15%."],
    ["năm trong câu", "Trong năm 2022, doanh thu tăng mạnh so với năm 2021."],
    ["khoảng năm trong ngoặc", "Dữ liệu được thu thập trong giai đoạn (2015-2020) tại ba tỉnh."],
    ["cỡ mẫu trong ngoặc", "The sample included 412 households (n = 412, 2019 survey wave)."],
    ["p-value", "The effect was significant (p < 0.05) in all specifications."],
    ["In năm", "In 2022, revenue increased by 15% across the sample."],
    ["bảng và năm", "Table 3 (2019) reports the baseline estimates for our sample."],
    ["câu của chính bài", "This study finds that green credit increases green technology innovation."],
    ["tiếng Trung có năm", "2022年，样本农户的线上销售收入增长了15%。"],
    ["据此", "据此，本文研究发现交易成本显著影响销售渠道选择。"],
    ["本文研究表明", "本文研究表明，电商发展提高了农户收入。"],
    // Câu thật trong bài tiếng Trung mẫu: dữ liệu của chính bài, chữ 据 nằm trong 数据.
    ["数据 không phải 据", "本文数据来源于作者 2018 年和 2020 年两轮农户跟踪问卷调查。"],
    ["根据本文 (theo chính bài này)", "根 据本文样本村的调研数据，核桃、猕猴桃的线上销售比重分别为 70% 、48% 。"],
    ["số hiệu quỹ trong ngoặc", "本研究得到国家自然科学基金面上项目( 71873148) 的资助。"],
    ["trích dẫn trống", ""],
  ];
  for (const [name, quote] of own) {
    it(`không báo nhầm: ${name}`, () => expect(citesOtherSource(quote)).toBe(false));
  }

  it("ô không có câu trích thì không báo", () => expect(citesOtherSource(null)).toBe(false));

  it("câu cảnh báo đúng lời đã thống nhất", () => {
    expect(CITED_SOURCE_WARNING).toBe("Câu trích có dẫn nguồn khác, kiểm tra xem đây có phải kết quả của chính bài này không");
  });
});
