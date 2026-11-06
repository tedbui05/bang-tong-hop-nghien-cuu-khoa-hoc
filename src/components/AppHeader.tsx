"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";

export function AppHeader() {
  const pathname = usePathname();
  const { review } = useStore();

  const links = [
    { href: "/", label: "Bảng tổng hợp" },
    { href: "/tao-bang", label: "Tạo bảng" },
    { href: "/them-bai", label: "Thêm bài" },
  ];
  // "Duyệt bài" chỉ hiện khi có bài đang chờ duyệt hoặc đang đứng ở trang đó.
  if (review || pathname === "/duyet-bai") links.push({ href: "/duyet-bai", label: "Duyệt bài" });

  return (
    <header className="app-header">
      <nav className="app-nav" aria-label="Các trang chính">
        {links.map((link) => (
          <Link key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined}>
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
