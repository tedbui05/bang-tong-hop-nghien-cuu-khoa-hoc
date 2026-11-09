// Số liệu đo hiệu quả cho trang /metrics. Cần mật khẩu METRICS_MAT_KHAU (chỉ nằm ở máy chủ).
import { handleMetrics } from "@/lib/metrics-handler";
import { supabaseMetrics } from "@/lib/supabase.server";

export async function POST(request: Request) {
  const metrics = supabaseMetrics();
  return handleMetrics(request, {
    password: process.env.METRICS_MAT_KHAU,
    counts: metrics?.counts ?? null,
    aiCalls: metrics?.aiCalls ?? (async () => 0),
  });
}
