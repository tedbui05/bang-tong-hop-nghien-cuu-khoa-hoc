import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Serif } from "next/font/google";
import type { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import { NetworkBanner } from "@/components/NetworkBanner";
import { StoreProvider } from "@/lib/store";
import "./globals.css";

// IBM Plex Sans: lời của giao diện và của AI. IBM Plex Serif: chữ lấy từ bài báo.
// Cả hai phải có bộ chữ tiếng Việt, và đều có chữ số đều nên số trong bảng thẳng hàng.
const uiFont = IBM_Plex_Sans({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ui",
  display: "swap",
});

const sourceFont = IBM_Plex_Serif({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "600"],
  variable: "--font-source",
  display: "swap",
});

export const metadata: Metadata = {
  // Mỗi trang đặt tên riêng, tab trình duyệt hiện "Tên trang · Bảng tổng hợp bài báo".
  title: { default: "Bảng tổng hợp bài báo", template: "%s · Bảng tổng hợp bài báo" },
  description: "Đọc bài báo, duyệt từng ô có câu trích và số trang, rồi lưu vào bảng cho khóa luận.",
};

export const viewport: Viewport = {
  // Trình duyệt không đọc được biến CSS ở đây: giữ đúng bằng --accent trong globals.css.
  themeColor: "#1e3a5f",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className={`${uiFont.variable} ${sourceFont.variable}`}>
      <body>
        <a className="skip-link" href="#noi-dung">
          Chuyển đến nội dung chính
        </a>
        <StoreProvider>
          <AppHeader />
          <NetworkBanner />
          {children}
        </StoreProvider>
      </body>
    </html>
  );
}
