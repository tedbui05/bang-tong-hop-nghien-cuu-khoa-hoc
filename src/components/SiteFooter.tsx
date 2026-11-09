import { ResetDataButton } from "./ResetDataButton";

// Chân trang, chỗ ít nổi bật: nút xoá toàn bộ dữ liệu không đứng cạnh các nút hay dùng.
// Trang bảng chiếm trọn màn hình nên ẩn chân trang này; nút nằm ở cuối dòng trạng thái của bảng.
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <ResetDataButton />
    </footer>
  );
}
