"use client";

import { useEffect, useState } from "react";

// Báo khi mất mạng, trên mọi trang. Bảng vẫn xem, sửa được; thay đổi giữ trên trình duyệt và tự lưu khi có mạng lại.
export function NetworkBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return (
    <div role="status" aria-live="polite">
      {offline ? (
        <p className="network-banner">
          <strong>Mất kết nối mạng.</strong> Bạn vẫn xem và sửa được bảng, app sẽ tự lưu lên máy chủ khi có mạng lại. Chưa gửi được bài mới cho
          AI.
        </p>
      ) : null}
    </div>
  );
}
