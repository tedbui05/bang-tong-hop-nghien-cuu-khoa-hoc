"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useStore } from "@/lib/store";
import { VersionsUnavailable, versionsRemote } from "@/lib/supabase-browser";
import type { SheetTable } from "@/lib/types";
import { formatVersionTime, groupVersions, versionTitle, type VersionMeta } from "@/lib/versions";

type Preview = { meta: VersionMeta; data: SheetTable | null; error: boolean };

// Lịch sử phiên bản của bảng: lưu một mốc có tên, xem trước và khôi phục phiên bản cũ.
// Khôi phục không xoá trạng thái hiện tại: app lưu nó thành phiên bản mới trước (xem restoreVersion trong store).
// table null: mở từ màn hình trống, chỉ có phần "Bảng đã xoá".
export function VersionHistory({ table, onClose }: { table: SheetTable | null; onClose: () => void }) {
  const { tables, versionsEnabled, listVersions, saveVersion, restoreVersion } = useStore();
  const dialog = useRef<HTMLDialogElement | null>(null);
  const [list, setList] = useState<VersionMeta[] | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error" | "missing">("loading");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  const load = useCallback(async () => {
    try {
      setList(await listVersions());
      setState("ready");
    } catch (error) {
      setState(error instanceof VersionsUnavailable ? "missing" : "error");
    }
  }, [listVersions]);

  useEffect(() => {
    if (!versionsEnabled) return;
    let alive = true;
    void listVersions()
      .then((items) => {
        if (!alive) return;
        setList(items);
        setState("ready");
      })
      .catch((error) => alive && setState(error instanceof VersionsUnavailable ? "missing" : "error"));
    return () => {
      alive = false;
    };
  }, [versionsEnabled, listVersions]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setNotice(null);
    try {
      const saved = await saveVersion(name);
      setName("");
      setNotice(`Đã lưu phiên bản “${versionTitle(saved)}”.`);
      await load();
    } catch {
      setNotice("Chưa lưu được phiên bản. Hãy kiểm tra kết nối mạng rồi thử lại.");
    } finally {
      setSaving(false);
    }
  }

  async function open(meta: VersionMeta) {
    setConfirming(false);
    setPreview({ meta, data: null, error: false });
    try {
      const row = await versionsRemote.load(meta.id);
      setPreview((current) => (current?.meta.id === meta.id ? { meta, data: row.data, error: false } : current));
    } catch {
      setPreview((current) => (current?.meta.id === meta.id ? { meta, data: null, error: true } : current));
    }
  }

  async function restore() {
    if (!preview) return;
    setRestoring(true);
    try {
      await restoreVersion(preview.meta.id);
      onClose();
    } catch {
      setNotice("Chưa khôi phục được. Bảng hiện tại vẫn giữ nguyên. Hãy kiểm tra kết nối mạng rồi thử lại.");
      setConfirming(false);
    } finally {
      setRestoring(false);
    }
  }

  const groups = list ? groupVersions(list, tables.map((item) => item.id), table?.id ?? null) : null;

  const item = (meta: VersionMeta) => (
    <li key={meta.id}>
      <button type="button" className="version-item" aria-current={preview?.meta.id === meta.id ? "true" : undefined} onClick={() => void open(meta)}>
        <span className="version-item__title">{versionTitle(meta)}</span>
        <span className="version-item__meta">
          {formatVersionTime(meta.created_at)} · {meta.paper_count} bài
          {meta.kind === "tu_dong" ? <span className="version-item__badge">tự lưu</span> : null}
        </span>
      </button>
    </li>
  );

  let body;
  if (!versionsEnabled) {
    body = <p className="version-empty">Lịch sử phiên bản cần máy chủ (Supabase). App chưa được cài máy chủ nên chưa dùng được.</p>;
  } else if (state === "loading") {
    body = (
      <p className="version-empty" role="status">
        <span className="spinner" aria-hidden="true" /> Đang tải lịch sử phiên bản…
      </p>
    );
  } else if (state === "missing") {
    body = <p className="field-error">Máy chủ chưa có bảng lưu phiên bản. Hãy báo người quản lý app chạy supabase/sql/phien-ban.sql.</p>;
  } else if (state === "error") {
    body = (
      <p className="field-error">
        Chưa tải được lịch sử phiên bản. Hãy kiểm tra kết nối mạng rồi{" "}
        <button type="button" className="link-button" onClick={() => void load()}>
          thử lại
        </button>
        .
      </p>
    );
  } else {
    body = (
      <div className="version-layout">
        <div className="version-lists">
          {table ? (
            <section aria-labelledby="pb-bang-nay">
              <h3 id="pb-bang-nay">Phiên bản của bảng này</h3>
              {groups!.current.length ? <ul className="version-list">{groups!.current.map(item)}</ul> : <p className="version-empty">Chưa có phiên bản nào. Hãy lưu một mốc ở trên.</p>}
            </section>
          ) : null}
          {groups!.deleted.length ? (
            <section aria-labelledby="pb-bang-da-xoa">
              <h3 id="pb-bang-da-xoa">Bảng đã xoá</h3>
              {groups!.deleted.map((versions) => (
                <div key={versions[0].table_id} className="version-group">
                  <p className="version-group__name">{versions[0].table_name}</p>
                  <ul className="version-list">{versions.map(item)}</ul>
                </div>
              ))}
            </section>
          ) : !table ? (
            <p className="version-empty">Không có bảng đã xoá nào để khôi phục.</p>
          ) : null}
        </div>
        <section className="version-preview" aria-label="Xem trước phiên bản" aria-live="polite">
          {!preview ? (
            <p className="version-empty">Chọn một phiên bản để xem trước.</p>
          ) : (
            <>
              <h3>{versionTitle(preview.meta)}</h3>
              <p className="version-item__meta">
                {preview.meta.table_name} · {formatVersionTime(preview.meta.created_at)} · {preview.meta.paper_count} bài
              </p>
              {preview.error ? (
                <p className="field-error">Chưa tải được phiên bản này. Hãy thử lại.</p>
              ) : !preview.data ? (
                <p className="version-empty" role="status">
                  <span className="spinner" aria-hidden="true" /> Đang tải…
                </p>
              ) : (
                <>
                  <p className="version-preview__label">{preview.data.columns.length} cột: {preview.data.columns.map((column) => column.name).join(", ")}</p>
                  <ol className="version-preview__papers">
                    {preview.data.papers.slice(0, 30).map((paper) => (
                      <li key={paper.id} className="source-text" lang={paper.language_code} translate="no">
                        {paper.info.title}
                      </li>
                    ))}
                  </ol>
                  {preview.data.papers.length > 30 ? <p className="version-empty">… và {preview.data.papers.length - 30} bài khác</p> : null}
                  {confirming ? (
                    <div className="version-confirm" role="group" aria-label="Xác nhận khôi phục">
                      <p>
                        Bảng “{preview.meta.table_name}” sẽ trở về như phiên bản này. Trạng thái hiện tại của bảng không mất: app lưu nó
                        thành một phiên bản mới trước khi khôi phục, nên luôn quay lại được.
                      </p>
                      <div className="confirm-dialog__actions">
                        <button type="button" className="button button--secondary" autoFocus onClick={() => setConfirming(false)}>
                          Thôi
                        </button>
                        <button type="button" className="button button--primary" disabled={restoring} onClick={() => void restore()}>
                          {restoring ? "Đang khôi phục…" : "Khôi phục"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" className="button button--primary version-preview__restore" onClick={() => setConfirming(true)}>
                      Khôi phục phiên bản này
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </section>
      </div>
    );
  }

  return (
    <dialog ref={dialog} className="confirm-dialog version-dialog" aria-labelledby="lich-su-tieu-de" onClose={onClose}>
      <div className="version-dialog__head">
        <h2 id="lich-su-tieu-de">{table ? `Lịch sử phiên bản: ${table.name}` : "Khôi phục bảng đã xoá"}</h2>
        <button type="button" className="evidence-panel__close" aria-label="Đóng lịch sử phiên bản" onClick={onClose}>
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <span>Đóng</span>
        </button>
      </div>
      {table && versionsEnabled && state === "ready" ? (
        <form className="version-save" onSubmit={(event) => void submit(event)}>
          <label htmlFor="ten-phien-ban">Lưu phiên bản hiện tại</label>
          <div className="version-save__row">
            <input
              id="ten-phien-ban"
              name="ten-phien-ban"
              type="text"
              autoComplete="off"
              maxLength={200}
              placeholder="Ví dụ: Trước khi gửi thầy"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <button type="submit" className="button button--secondary" disabled={saving || !name.trim()}>
              {saving ? "Đang lưu…" : "Lưu phiên bản"}
            </button>
          </div>
          <p className="version-empty">Phiên bản không chứa file PDF. App cũng tự lưu một phiên bản trước khi xoá cột, xoá nhiều bài hoặc xoá bảng.</p>
        </form>
      ) : null}
      {notice ? (
        <p className="version-notice" role="status">
          {notice}
        </p>
      ) : null}
      {body}
    </dialog>
  );
}
