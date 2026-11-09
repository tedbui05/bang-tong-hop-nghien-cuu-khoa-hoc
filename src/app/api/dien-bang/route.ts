// Máy chủ nhận chữ của bài và danh sách cột, gọi AI, trả về các ô AI đề xuất.
// Kết quả chỉ là đề xuất: chưa kiểm tra câu trích, chưa ghi vào bảng.
// Chỉ nhận yêu cầu có phiên đăng nhập hợp lệ và còn lượt trong ngày (xem dien-bang-handler.ts, ai-limit.ts).
import { extractPaper, readExtractBody } from "@/lib/ai-extract";
import { readAiLimits } from "@/lib/ai-limit";
import { handleDienBang } from "@/lib/dien-bang-handler";
import { callGemini, geminiModels } from "@/lib/gemini.server";
import { sampleAnswer, sampleAnswersEnabled } from "@/lib/sample-answer.server";
import { supabaseUsageStore, verifySupabaseUser } from "@/lib/supabase.server";

// Chờ AI đọc bài có thể mất vài phút.
export const maxDuration = 300;

export async function POST(request: Request) {
  // Chỉ khi chạy trên máy bằng `npm run dev` và bật AI_DUNG_KET_QUA_MAU=1 (xem sample-answer.server.ts).
  // Chế độ này không gọi Gemini nên không tốn lượt, không cần đăng nhập.
  if (sampleAnswersEnabled()) {
    const body = (await request.json().catch(() => null)) as { fileName?: unknown } | null;
    const input = readExtractBody(body);
    if (!input) return Response.json({ ok: false, error: { code: "bad_request", title: "Dữ liệu gửi lên không hợp lệ", detail: "Hãy tải lại trang rồi thử lại.", retry: false } }, { status: 400 });
    const ids = input.columns.filter((column) => column.kind === "content").map((column) => column.id);
    return Response.json(await sampleAnswer(typeof body?.fileName === "string" ? body.fileName : "", ids));
  }

  return handleDienBang(request, {
    verifyUser: verifySupabaseUser,
    store: supabaseUsageStore(),
    limits: readAiLimits(process.env),
    // Lỗi đã được đổi thành câu tiếng Việt nằm trong kết quả, trang web đọc trường ok để biết.
    extract: (input) => extractPaper(input.columns, input.pages, callGemini, geminiModels()),
  });
}
