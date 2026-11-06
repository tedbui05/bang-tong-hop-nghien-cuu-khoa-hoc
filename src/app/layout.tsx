import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Source_Serif_4 } from "next/font/google";
import type { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import { StoreProvider } from "@/lib/store";
import "./globals.css";

// Be Vietnam Pro: lời của giao diện và của AI. Source Serif 4: chữ lấy từ bài báo.
const uiFont = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ui",
  display: "swap",
});

const sourceFont = Source_Serif_4({
  subsets: ["latin", "vietnamese"],
  variable: "--font-source",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bảng tổng hợp bài báo",
  description: "Đọc bài báo, duyệt từng ô có câu trích và số trang, rồi lưu vào bảng cho khóa luận.",
};

export const viewport: Viewport = {
  themeColor: "#f6f7f7",
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
          {children}
        </StoreProvider>
      </body>
    </html>
  );
}
