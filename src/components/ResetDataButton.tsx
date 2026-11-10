"use client";

import { useEffect, useRef, useState } from "react";
import { sampleTable } from "@/lib/sample-data";
import { useStore } from "@/lib/store";

// Phải gõ đúng chữ này mới xoá được. Nhận cả hai cách bỏ dấu "XOÁ" và "XÓA", không phân biệt hoa thường.
const CONFIRM_WORDS = ["XOÁ", "XÓA"];

export function isResetConfirmed(text: string) {
  return CONFIRM_WORDS.includes(text.normalize("NFC").trim().toLocaleUpperCase("vi"));
}

// Đưa app về dữ liệu mẫu ban đầu. Việc này XOÁ HẾT dữ liệu của người dùng, kể cả bảng do sinh viên tự tạo
// và bản đã lưu trên máy chủ, không khôi phục được (người dùng chọn giữ cách xoá này, chỉ hỏi kỹ hơn, 9/11/2026).
export function ResetDataButton() {
  const { resetData, tables, queue } = useStore();
  const dialog = useRef<HTMLDialogElement | null>(null);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  const ownTables = tables.filter((table) => table.id !== sampleTable.id);
  const ownPapers = ownTables.reduce((sum, table) => sum + table.papers.length, 0);
  const waiting = queue.filter((item) => !item.sample && item.status !== "saved").length;
  const confirmed = isResetConfirmed(typed);

  function close() {
    setOpen(false);
    setTyped("");
  }

  return (
    <>
      <button type="button" className="link-button data-reset" onClick={() => setOpen(true)}>
        Xoá toàn bộ dữ liệu của tôi
      </button>
      <dialog ref={dialog} className="confirm-dialog" aria-labelledby="dat-lai-tieu-de" aria-describedby="dat-lai-mo-ta" onClose={close}>
        <h2 id="dat-lai-tieu-de">Xoá hết dữ liệu của bạn?</h2>
        <div id="dat-lai-mo-ta">
          <p>App sẽ xoá vĩnh viễn, cả trên trình duyệt này lẫn trên máy chủ:</p>
          <ul className="confirm-dialog__list">
            <li>
              {ownTables.length > 0
                ? `${ownTables.length} bảng bạn đã tạo, cùng ${ownPapers} bài đã lưu trong các bảng đó`
                : "Mọi bảng bạn đã tạo (hiện chưa có bảng nào)"}
              , kể cả định dạng, ghi chú và nhãn
            </li>
            <li>{waiting > 0 ? `${waiting} bài đang chờ xử lý hoặc chờ duyệt` : "Mọi bài đang chờ duyệt (hiện không có)"}</li>
            <li>Các file PDF đã giữ trong trình duyệt</li>
            <li>Lịch sử phiên bản của mọi bảng</li>
          </ul>
          <p>Sau đó app chỉ còn Bảng mẫu ban đầu. Không khôi phục lại được. Nếu cần giữ bảng, hãy xuất Excel trước.</p>
        </div>
        <label className="confirm-dialog__label" htmlFor="dat-lai-xac-nhan">
          Gõ chữ XOÁ để xác nhận
        </label>
        <input
          id="dat-lai-xac-nhan"
          name="dat-lai-xac-nhan"
          type="text"
          autoComplete="off"
          spellCheck={false}
          className="confirm-dialog__input"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
        />
        <div className="confirm-dialog__actions">
          <button type="button" className="button button--primary" autoFocus onClick={close}>
            Giữ dữ liệu
          </button>
          <button
            type="button"
            className="button button--secondary"
            disabled={!confirmed || busy}
            onClick={async () => {
              setBusy(true);
              await resetData();
              // Xoá xong thì trang tự tải lại; xoá trên máy chủ lỗi thì app đã báo, cho bấm lại.
              setBusy(false);
            }}
          >
            {busy ? "Đang xoá…" : "Xoá hết và đặt lại"}
          </button>
        </div>
      </dialog>
    </>
  );
}
