"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Props = { active: boolean; title: string; detail: string };

// Hỏi lại trước khi rời trang khi còn việc chưa lưu: đóng tab, tải lại trang (hộp hỏi của trình duyệt)
// và bấm link trong app (hộp hỏi của app). Nút quay lại của trình duyệt không chặn được ổn định với Next.js,
// nhưng phần đã duyệt vẫn được giữ trong trình duyệt nên không mất.
export function LeaveGuard({ active, title, detail }: Props) {
  const router = useRouter();
  const [target, setTarget] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      event.preventDefault();
      event.stopPropagation();
      setTarget(url.pathname + url.search + url.hash);
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", onClick, true);
    };
  }, [active]);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (target && !element.open) element.showModal();
    if (!target && element.open) element.close();
  }, [target]);

  return (
    <dialog ref={dialog} className="confirm-dialog" aria-labelledby="roi-trang-tieu-de" onClose={() => setTarget(null)}>
      <h2 id="roi-trang-tieu-de">{title}</h2>
      <p>{detail}</p>
      <div className="confirm-dialog__actions">
        <button type="button" className="button button--primary" autoFocus onClick={() => setTarget(null)}>
          Ở lại duyệt tiếp
        </button>
        <button
          type="button"
          className="button button--quiet"
          onClick={() => {
            const to = target;
            setTarget(null);
            if (to) router.push(to);
          }}
        >
          Rời trang
        </button>
      </div>
    </dialog>
  );
}
