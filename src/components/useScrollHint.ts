"use client";

import { useEffect, type RefObject } from "react";

// Hàng cuộn ngang (ô số liệu, thanh công cụ trên điện thoại): còn nội dung bên phải thì gắn data-more-right
// để CSS vẽ vệt mờ ở mép phải, gợi ý vuốt ngang. Cuộn tới cuối hoặc vừa đủ chỗ thì bỏ.
export function useScrollHint(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      const more = element.scrollLeft + element.clientWidth < element.scrollWidth - 2;
      if (more) element.dataset.moreRight = "";
      else delete element.dataset.moreRight;
    };
    update();
    element.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    for (const child of element.children) observer.observe(child);
    return () => {
      element.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [ref]);
}
