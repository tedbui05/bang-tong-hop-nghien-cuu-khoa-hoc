import type { ReactNode } from "react";

type Props = {
  tone: "empty" | "error" | "loading";
  title: string;
  children: ReactNode;
  action?: ReactNode;
};

// Khung chung cho trạng thái trống, báo lỗi và đang tải.
export function StateMessage({ tone, title, children, action }: Props) {
  return (
    <div
      className={`state-message state-message--${tone}`}
      role={tone === "error" ? "alert" : tone === "loading" ? "status" : undefined}
    >
      <h2>{title}</h2>
      <div className="state-message__body">{children}</div>
      {action ? <div className="state-message__action">{action}</div> : null}
    </div>
  );
}

export function SkeletonLines({ count = 3 }: { count?: number }) {
  return (
    <div className="skeleton" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="skeleton__line" />
      ))}
    </div>
  );
}
