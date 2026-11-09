import type { Metadata } from "next";
import { MetricsView } from "@/components/MetricsView";

export const metadata: Metadata = { title: "Số liệu đo hiệu quả", robots: { index: false } };

export default function Page() {
  return <MetricsView />;
}
