// Markdown tối giản cho cột Ghi chú: in đậm, in nghiêng, gạch đầu dòng, đường link.
// Không bao giờ dựng HTML từ chữ người dùng: chỉ tạo cây dữ liệu, chữ luôn được gán dạng văn bản.

export type MdInline =
  | { type: "text"; text: string }
  | { type: "bold"; children: MdInline[] }
  | { type: "italic"; children: MdInline[] }
  | { type: "link"; href: string; children: MdInline[] };

export type MdBlock = { type: "paragraph"; children: MdInline[] } | { type: "list"; items: MdInline[][] };

// Chỉ nhận link an toàn; "javascript:" và các kiểu khác giữ nguyên là chữ.
function safeHref(href: string): string | null {
  return /^(https?:\/\/|mailto:)/i.test(href.trim()) ? href.trim() : null;
}

const INLINE = /\*\*(.+?)\*\*|\*([^*\s](?:[^*]*[^*\s])?)\*|\[([^\]]+)\]\(([^)\s]+)\)/;

export function parseInline(text: string): MdInline[] {
  const nodes: MdInline[] = [];
  let rest = text;
  while (rest) {
    const match = INLINE.exec(rest);
    if (!match) {
      nodes.push({ type: "text", text: rest });
      break;
    }
    if (match.index > 0) nodes.push({ type: "text", text: rest.slice(0, match.index) });
    const [whole, bold, italic, label, href] = match;
    if (bold !== undefined) nodes.push({ type: "bold", children: parseInline(bold) });
    else if (italic !== undefined) nodes.push({ type: "italic", children: parseInline(italic) });
    else {
      const safe = safeHref(href);
      nodes.push(safe ? { type: "link", href: safe, children: parseInline(label) } : { type: "text", text: whole });
    }
    rest = rest.slice(match.index + whole.length);
  }
  return nodes;
}

export function parseMarkdown(source: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  source.split(/\r?\n/).forEach((line) => {
    const item = /^\s*[-*]\s+(.*)$/.exec(line);
    if (item) {
      const last = blocks[blocks.length - 1];
      if (last?.type === "list") last.items.push(parseInline(item[1]));
      else blocks.push({ type: "list", items: [parseInline(item[1])] });
    } else if (line.trim()) {
      blocks.push({ type: "paragraph", children: parseInline(line.trim()) });
    }
  });
  return blocks;
}

function inlineText(nodes: MdInline[]): string {
  return nodes
    .map((node) => {
      if (node.type === "text") return node.text;
      if (node.type === "link") return `${inlineText(node.children)} (${node.href})`;
      return inlineText(node.children);
    })
    .join("");
}

// Dùng khi xuất Excel: bỏ dấu định dạng, vẫn giữ gạch đầu dòng và địa chỉ link.
export function markdownToPlain(source: string): string {
  return parseMarkdown(source)
    .flatMap((block) =>
      block.type === "paragraph" ? [inlineText(block.children)] : block.items.map((item) => `- ${inlineText(item)}`),
    )
    .join("\n");
}

function appendInline(parent: HTMLElement, nodes: MdInline[]) {
  nodes.forEach((node) => {
    if (node.type === "text") {
      parent.append(document.createTextNode(node.text));
      return;
    }
    const element = document.createElement(node.type === "bold" ? "strong" : node.type === "italic" ? "em" : "a");
    if (node.type === "link" && element instanceof HTMLAnchorElement) {
      element.href = node.href;
      element.target = "_blank";
      element.rel = "noopener noreferrer";
      // Bấm link trong ô thì mở link, không chọn ô.
      element.addEventListener("mousedown", (event) => event.stopPropagation());
    }
    appendInline(element, node.children);
    parent.append(element);
  });
}

// Dùng trong ô của bảng, nơi thư viện bảng cần một phần tử DOM.
export function markdownToDom(source: string): HTMLElement {
  const root = document.createElement("span");
  root.className = "sheet-text sheet-md";
  parseMarkdown(source).forEach((block) => {
    if (block.type === "paragraph") {
      const paragraph = document.createElement("span");
      paragraph.className = "sheet-md__p";
      appendInline(paragraph, block.children);
      root.append(paragraph);
    } else {
      block.items.forEach((item) => {
        const line = document.createElement("span");
        line.className = "sheet-md__li";
        appendInline(line, item);
        root.append(line);
      });
    }
  });
  return root;
}
