"use client";

import { useState, type FormEvent } from "react";
import { percent, type MetricRange, type MetricsSummary } from "@/lib/metrics";
import { SkeletonLines, StateMessage } from "./StateMessage";

type Loaded = { khoang: MetricRange; tuNgay: string; summary: MetricsSummary };

const RANGES: { key: MetricRange; label: string }[] = [
  { key: "7", label: "7 ngày" },
  { key: "30", label: "30 ngày" },
  { key: "all", label: "Từ đầu" },
];

const showPercent = (value: number | null) => (value === null ? "chưa có" : `${value}%`);

// Trang số liệu đo hiệu quả. Mật khẩu chỉ giữ trong trang đang mở, không lưu lại.
export function MetricsView() {
  const [password, setPassword] = useState("");
  const [range, setRange] = useState<MetricRange>("7");
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load(nextRange: MetricRange) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matKhau: password, khoang: nextRange }),
      });
      const body = await response.json().catch(() => null);
      if (!body?.ok) {
        setError(body?.error ?? "Chưa đọc được số liệu. Hãy thử lại sau ít phút.");
        if (response.status === 401) setData(null);
        return;
      }
      setRange(nextRange);
      setData(body);
    } catch {
      setError("Không kết nối được máy chủ. Hãy kiểm tra kết nối mạng rồi thử lại.");
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!password) {
      setError("Hãy nhập mật khẩu xem số liệu.");
      return;
    }
    void load(range);
  }

  const s = data?.summary;
  const reviewed = s ? s.oGiuNguyen + s.oBiSua : 0;
  const info = s ? s.ttGiuNguyen + s.ttBiSua : 0;

  return (
    <main id="noi-dung" className="page page--narrow">
      <h1 className="page-title">Số liệu đo hiệu quả</h1>
      <p className="fine-print">Chỉ có số đếm thao tác của mọi người dùng, không có nội dung bài hay ô.</p>

      {!data ? (
        <form onSubmit={submit} noValidate className="metrics-login">
          <div className="setup-field">
            <label htmlFor="mat-khau-so-lieu">Mật khẩu xem số liệu</label>
            <input
              id="mat-khau-so-lieu"
              type="password"
              autoComplete="current-password"
              value={password}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "loi-so-lieu" : undefined}
              onChange={(event) => {
                setPassword(event.target.value);
                setError(null);
              }}
            />
          </div>
          {error ? (
            <p id="loi-so-lieu" className="field-error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="button button--primary" disabled={loading}>
            {loading ? "Đang mở…" : "Xem số liệu"}
          </button>
        </form>
      ) : null}

      {data && s ? (
        <>
          <div className="metrics-ranges" role="group" aria-label="Khoảng thời gian">
            {RANGES.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`button ${item.key === range ? "button--primary" : "button--secondary"}`}
                aria-pressed={item.key === range}
                disabled={loading}
                onClick={() => void load(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="fine-print">Tính từ ngày {data.tuNgay.split("-").reverse().join("/")} đến hết hôm nay, theo giờ Việt Nam.</p>
          {error ? <StateMessage tone="error" title="Chưa đọc được số liệu"><p>{error}</p></StateMessage> : null}
          {loading ? <SkeletonLines count={4} /> : null}

          {s.baiTai === 0 && s.baiLuu === 0 && s.luotAi === 0 ? (
            <StateMessage tone="empty" title="Chưa có thao tác nào trong khoảng này">
              <p>Số liệu sẽ có khi sinh viên tải bài và lưu vào bảng.</p>
            </StateMessage>
          ) : (
            <dl className="metrics-grid">
              <Metric label="Người dùng" value={s.nguoiDung} note="Số trình duyệt có thao tác" />
              <Metric label="Bài đã tải và AI điền xong" value={s.baiTai} />
              <Metric label="Lượt gửi bài cho AI" value={s.luotAi} note="Đếm ở máy chủ, kể cả bài lỗi" />
              <Metric label="Bài đã lưu vào bảng" value={s.baiLuu} note={`${showPercent(percent(s.baiLuu, s.baiTai))} số bài đã tải`} />
              <Metric
                label="Ô giữ nguyên lúc duyệt"
                value={showPercent(percent(s.oGiuNguyen, reviewed))}
                note={`${s.oGiuNguyen}/${reviewed} ô nội dung, trong đó ${s.oDuyetNhanh} ô duyệt nhanh`}
              />
              <Metric label="Ô bị sửa lúc duyệt" value={showPercent(percent(s.oBiSua, reviewed))} note={`${s.oBiSua}/${reviewed} ô nội dung`} />
              <Metric label="Thông tin bài bị sửa" value={showPercent(percent(s.ttBiSua, info))} note={`${s.ttBiSua}/${info} ô tác giả, năm, nơi xuất bản…`} />
              <Metric label="Ô cần kiểm tra" value={s.oCanKiemTra} note={s.baiTai ? `Trung bình ${(s.oCanKiemTra / s.baiTai).toFixed(1)} ô mỗi bài` : undefined} />
              <Metric label="Ô sửa trong bảng sau khi lưu" value={s.oSuaTrongBang} />
              <Metric
                label="Bài điền bằng model dự phòng"
                value={showPercent(percent(s.baiDuPhong, s.baiTai))}
                note={`${s.baiDuPhong}/${s.baiTai} bài; gọi model dự phòng ${s.lanDungDuPhong} lần`}
              />
            </dl>
          )}
        </>
      ) : null}
    </main>
  );
}

function Metric({ label, value, note }: { label: string; value: number | string; note?: string }) {
  return (
    <div className="metrics-tile">
      <dt>{label}</dt>
      <dd className="metrics-tile__value">{value}</dd>
      {note ? <dd className="metrics-tile__note">{note}</dd> : null}
    </div>
  );
}
