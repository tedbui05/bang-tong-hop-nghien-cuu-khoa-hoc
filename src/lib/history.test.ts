import { describe, expect, it } from "vitest";
import { applyEntry, emptyHistory, historyShortcut, isTypingTarget, pushEntry, redoTitle, takeRedo, takeUndo, undoTitle, type HistoryEntry } from "./history";
import { sampleTable } from "@/test/sample-data";
import type { SheetTable } from "./types";

const table = (id: string, name = id): SheetTable => ({ id, name, columns: sampleTable.columns, papers: [] });
let nextId = 1;
const entry = (label: string, before: SheetTable | null, after: SheetTable | null, index = 0): HistoryEntry => ({
  id: nextId++,
  label,
  tableId: (before ?? after)!.id,
  before,
  after,
  index,
});

describe("ngăn hoàn tác và làm lại", () => {
  it("hoàn tác rồi làm lại theo đúng thứ tự", () => {
    let h = emptyHistory();
    h = pushEntry(h, entry("sửa ô Mẫu", table("a"), table("a", "1")));
    h = pushEntry(h, entry("xoá cột Hạn chế", table("a", "1"), table("a", "2")));
    expect(undoTitle(h)).toBe("Hoàn tác: xoá cột Hạn chế");
    const first = takeUndo(h)!;
    expect(first.entry.label).toBe("xoá cột Hạn chế");
    expect(redoTitle(first.history)).toBe("Làm lại: xoá cột Hạn chế");
    expect(undoTitle(first.history)).toBe("Hoàn tác: sửa ô Mẫu");
    const back = takeRedo(first.history)!;
    expect(back.history.undo).toHaveLength(2);
    expect(back.history.redo).toHaveLength(0);
  });

  it("thao tác mới thì bỏ ngăn làm lại", () => {
    let h = pushEntry(emptyHistory(), entry("a", table("a"), table("a")));
    h = takeUndo(h)!.history;
    expect(h.redo).toHaveLength(1);
    h = pushEntry(h, entry("b", table("a"), table("a")));
    expect(h.redo).toHaveLength(0);
  });

  it("giữ tối đa 50 thao tác, bỏ thao tác cũ nhất", () => {
    let h = emptyHistory();
    for (let i = 0; i < 60; i++) h = pushEntry(h, entry(`thao tác ${i}`, table("a"), table("a")));
    expect(h.undo).toHaveLength(50);
    expect(h.undo[0].label).toBe("thao tác 10");
  });

  it("không còn gì thì nút mờ", () => {
    expect(takeUndo(emptyHistory())).toBeNull();
    expect(takeRedo(emptyHistory())).toBeNull();
    expect(undoTitle(emptyHistory())).toBe("Không còn gì để hoàn tác");
  });
});

describe("đưa bảng về trạng thái cũ", () => {
  it("hoàn tác sửa bảng, giữ độ rộng cột đang dùng", () => {
    const before = table("a", "cũ");
    const after = { ...table("a", "mới"), columns: before.columns.map((column, i) => (i === 1 ? { ...column, width: 333 } : column)) };
    const result = applyEntry([table("x"), after], entry("đổi", before, after), "undo");
    expect(result[1].name).toBe("cũ");
    expect(result[1].columns[1].width).toBe(333);
  });

  it("hoàn tác xoá bảng đưa bảng về đúng vị trí; làm lại thì xoá lại", () => {
    const b = table("b");
    const removed = entry("xoá bảng b", b, null, 1);
    const restored = applyEntry([table("a"), table("c")], removed, "undo");
    expect(restored.map((t) => t.id)).toEqual(["a", "b", "c"]);
    expect(applyEntry(restored, removed, "redo").map((t) => t.id)).toEqual(["a", "c"]);
  });
});

describe("phím tắt", () => {
  const key = (k: string, extra: Partial<KeyboardEvent> = {}) => ({ key: k, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...extra });
  it("Cmd+Z hoàn tác, Cmd+Shift+Z và Ctrl+Y làm lại", () => {
    expect(historyShortcut(key("z", { metaKey: true }), false)).toBe("undo");
    expect(historyShortcut(key("Z", { metaKey: true, shiftKey: true }), false)).toBe("redo");
    expect(historyShortcut(key("y", { ctrlKey: true }), false)).toBe("redo");
    expect(historyShortcut(key("z"), false)).toBeNull();
  });

  it("đang gõ trong ô chữ thì để ô đó tự hoàn tác", () => {
    expect(historyShortcut(key("z", { metaKey: true }), true)).toBeNull();
    expect(isTypingTarget({ tagName: "TEXTAREA" })).toBe(true);
    expect(isTypingTarget({ tagName: "INPUT", type: "search" })).toBe(true);
    expect(isTypingTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
    expect(isTypingTarget({ tagName: "INPUT", type: "checkbox" })).toBe(false);
    expect(isTypingTarget({ tagName: "BUTTON" })).toBe(false);
    expect(isTypingTarget({ tagName: "DIV" })).toBe(false);
  });
});
