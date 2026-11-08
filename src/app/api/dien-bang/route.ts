// Máy chủ nhận chữ của bài và danh sách cột, gọi AI, trả về các ô AI đề xuất.
// Kết quả chỉ là đề xuất: chưa kiểm tra câu trích, chưa ghi vào bảng.
import { extractPaper, readExtractBody } from "@/lib/ai-extract";
import { callGemini } from "@/lib/gemini.server";

// Chờ AI đọc bài có thể mất vài phút.
export const maxDuration = 300;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const input = readExtractBody(body);
  if (!input) {
    return Response.json(
      { ok: false, error: { code: "bad_request", title: "Dữ liệu gửi lên không hợp lệ", detail: "Hãy tải lại trang rồi thử lại.", retry: false } },
      { status: 400 },
    );
  }
  const result = await extractPaper(input.columns, input.pages, callGemini);
  // Lỗi đã được đổi thành câu tiếng Việt nằm trong result, trang web đọc trường ok để biết.
  return Response.json(result);
}
