import Link from "next/link";
import { PREVIEW_STATES, type PreviewState } from "@/lib/preview-state";
import { SampleNote } from "./SampleNote";

// Phần "Xem thử trạng thái" chỉ để người làm app xem các màn hình,
// nên chỉ hiện khi chạy `npm run dev`. Nút xoá toàn bộ dữ liệu nằm ở chân trang (SiteFooter, chân bảng).
export function PreviewBar({ path, state }: { path: string; state: PreviewState }) {
  return <SampleNote extra={process.env.NODE_ENV === "development" ? <PreviewStates path={path} state={state} /> : null} />;
}

function PreviewStates({ path, state }: { path: string; state: PreviewState }) {
  return (
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
  );
}
