"use client";

import { useEffect, useState } from "react";
import { saveStatus } from "@/lib/save-status";
import { useStore } from "@/lib/store";

// Trạng thái lưu ở đầu bảng: "Đang lưu…", "Đã lưu lúc 08:10", "Chưa lưu được, sẽ thử lại khi có mạng".
// App tự lưu nên không có nút Save; Cmd+S chỉ lưu ngay và chớp chữ "Đã lưu".
export function SaveStatus() {
  const { cloud, saveFailed, savedAt, saveFlash } = useStore();
  const status = saveStatus(cloud, saveFailed, savedAt);
  return (
    <p className={`save-status save-status--${status.tone}`} role="status" aria-live="polite">
      {status.tone === "busy" ? <span className="spinner" aria-hidden="true" /> : null}
      <span>{status.text}</span>
      {saveFlash > 0 ? <SavedFlash key={saveFlash} /> : null}
    </p>
  );
}

function SavedFlash() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 2000);
    return () => clearTimeout(timer);
  }, []);
  return visible ? <span className="save-status__flash">Đã lưu</span> : null;
}
