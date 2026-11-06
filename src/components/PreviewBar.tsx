import Link from "next/link";
import { PREVIEW_STATES, type PreviewState } from "@/lib/preview-state";

// Thanh này chỉ dùng cho bản xem thử, sẽ bỏ khi nối dữ liệu thật.
export function PreviewBar({ path, state }: { path: string; state: PreviewState }) {
  return (
    <aside className="preview-bar" aria-label="Thông tin bản xem thử">
      <p>Bản xem thử, dùng dữ liệu mẫu. Nhãn được gán sẵn, chưa phải kết quả kiểm tra thật.</p>
      <details className="preview-states" open={state !== "binh-thuong"}>
        <summary>Xem thử trạng thái</summary>
        <nav aria-label="Xem thử trạng thái màn hình">
          {PREVIEW_STATES.map((item) => (
            <Link
              key={item.value}
              href={item.value === "binh-thuong" ? path : `${path}?trang-thai=${item.value}`}
              aria-current={item.value === state ? "true" : undefined}
              scroll={false}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </details>
    </aside>
  );
}
