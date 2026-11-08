import { Fragment } from "react";
import { parseMarkdown, type MdInline } from "@/lib/markdown";

function Inline({ nodes }: { nodes: MdInline[] }) {
  return (
    <>
      {nodes.map((node, index) => {
        if (node.type === "text") return <Fragment key={index}>{node.text}</Fragment>;
        if (node.type === "bold") return <strong key={index}><Inline nodes={node.children} /></strong>;
        if (node.type === "italic") return <em key={index}><Inline nodes={node.children} /></em>;
        return (
          <a key={index} href={node.href} target="_blank" rel="noopener noreferrer">
            <Inline nodes={node.children} />
          </a>
        );
      })}
    </>
  );
}

// Ghi chú hiện đã định dạng; chữ người dùng luôn là văn bản, không bao giờ là HTML.
export function MarkdownView({ source }: { source: string }) {
  return (
    <div className="markdown-view">
      {parseMarkdown(source).map((block, index) =>
        block.type === "paragraph" ? (
          <p key={index}>
            <Inline nodes={block.children} />
          </p>
        ) : (
          <ul key={index}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <Inline nodes={item} />
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}
