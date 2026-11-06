import type { CSSProperties, ReactNode } from "react";
import type { ArticleBlock, ArticleDocument } from "../../../../../lib/article-document";

type Props = {
  document: ArticleDocument;
  title: string;
  metaDescription: string;
  sources: Array<{ id: string; title: string; url: string }>;
  device: "desktop" | "mobile";
};

function InlineText({ value, sources }: { value: string; sources: Props["sources"] }): ReactNode[] {
  const sourceMap = new Map(sources.map((source) => [source.id, source] as const));
  const pattern = /\[(S\d+)\]|https?:\/\/[^\s<>"']+|\*\*[^*\n]+\*\*|\*[^*\n]+\*/g;
  const output: ReactNode[] = [];
  let cursor = 0;
  for (const match of value.matchAll(pattern)) {
    const token = match[0];
    const index = match.index;
    if (index > cursor) output.push(value.slice(cursor, index));
    const citation = /^\[(S\d+)\]$/.exec(token);
    if (citation) {
      const source = sourceMap.get(citation[1] ?? "");
      output.push(source ? <a key={"source-" + index} href={source.url} target="_blank" rel="noreferrer" className="text-[var(--accent)] underline underline-offset-2" title={source.title}>{token}</a> : token);
    } else if (token.startsWith("**")) {
      output.push(<strong key={"bold-" + index}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      output.push(<em key={"italic-" + index}>{token.slice(1, -1)}</em>);
    } else {
      const trailing = /[),.;!?]+$/.exec(token)?.[0] ?? "";
      const candidate = trailing ? token.slice(0, -trailing.length) : token;
      let safeUrl = "";
      try {
        const parsed = new URL(candidate);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") safeUrl = parsed.href;
      } catch {
        safeUrl = "";
      }
      output.push(safeUrl ? <a key={"url-" + index} href={safeUrl} target="_blank" rel="noreferrer" className="text-[var(--accent)] underline underline-offset-2">{candidate}</a> : candidate);
      if (trailing) output.push(trailing);
    }
    cursor = index + token.length;
  }
  if (cursor < value.length) output.push(value.slice(cursor));
  return output;
}

function blockTextStyle(block: Exclude<ArticleBlock, { type: "image" }>, document: ArticleDocument): CSSProperties {
  const isHeading = block.type === "heading";
  const alignment = block.style.textAlignment === "INHERIT"
    ? document.appearance.textAlignment
    : block.style.textAlignment;
  const textAlign: CSSProperties["textAlign"] = alignment === "LEFT"
    ? "left"
    : alignment === "CENTER"
      ? "center"
      : alignment === "RIGHT"
        ? "right"
        : "justify";
  return {
    color: block.style.color || (isHeading ? document.appearance.headingColor : document.appearance.bodyColor),
    fontFamily: block.style.fontFamily || (isHeading ? document.appearance.headingFontFamily : document.appearance.bodyFontFamily),
    fontSize: (block.style.fontSize || (isHeading ? document.appearance.headingFontSize : document.appearance.bodyFontSize)) + "px",
    lineHeight: block.style.lineHeight || document.appearance.lineHeight,
    textAlign,
    backgroundColor: block.style.backgroundColor || undefined,
    paddingTop: block.style.paddingTop ? block.style.paddingTop + "px" : undefined,
    paddingBottom: block.style.paddingBottom ? block.style.paddingBottom + "px" : undefined,
    marginTop: "1rem",
    marginBottom: "1rem",
    overflowWrap: "anywhere",
  };
}

function PreviewBlock({ block, document, sources }: { block: ArticleBlock; document: ArticleDocument; sources: Props["sources"] }) {
  if (block.type === "divider") return <hr className="my-8 border-0 border-t border-[var(--border-strong)]"/>;
  if (block.type === "image") {
    const floating = block.textWrap && (block.alignment === "LEFT" || block.alignment === "RIGHT") && block.width !== "FULL_WIDTH";
    const imageStyle: CSSProperties = {
      width: block.width === "SMALL" ? "220px" : block.width === "ORIGINAL" ? block.media.width + "px" : "100%",
      maxWidth: "100%",
      border: block.borderWidth + "px solid " + block.borderColor,
      borderRadius: block.borderRadius + "px",
    };
    const figureStyle: CSSProperties = floating
      ? { float: block.alignment === "LEFT" ? "left" : "right", width: block.width === "SMALL" ? "220px" : "min(48%, 420px)", margin: block.alignment === "LEFT" ? "0.5rem 1.5rem 1rem 0" : "0.5rem 0 1rem 1.5rem" }
      : { width: block.width === "SMALL" ? "220px" : block.width === "ORIGINAL" ? Math.min(block.media.width, 760) + "px" : "100%", maxWidth: "100%", margin: block.alignment === "LEFT" ? "1.5rem auto 1.5rem 0" : block.alignment === "RIGHT" ? "1.5rem 0 1.5rem auto" : "1.5rem auto" };
    return (
      <figure className="min-w-0" style={figureStyle}>
        <img src={block.media.url} alt={block.altText} loading="lazy" className="block h-auto max-w-full" style={imageStyle}/>
        {block.caption ? <figcaption className="mt-2 text-center text-xs leading-5 text-[var(--text-muted)]">{block.caption}</figcaption> : null}
      </figure>
    );
  }
  if (block.type === "heading") {
    const content = InlineText({ value: block.text, sources });
    if (block.level === 2) return <h2 style={blockTextStyle(block, document)} className="font-bold tracking-tight">{content}</h2>;
    if (block.level === 3) return <h3 style={blockTextStyle(block, document)} className="font-bold tracking-tight">{content}</h3>;
    return <h4 style={blockTextStyle(block, document)} className="font-bold tracking-tight">{content}</h4>;
  }
  if (block.type === "quote") {
    return <blockquote style={blockTextStyle(block, document)} className="border-l-4 border-[var(--accent)] pl-4 italic">{InlineText({ value: block.text, sources })}</blockquote>;
  }
  if (block.type === "list") {
    return <ul style={blockTextStyle(block, document)} className="list-disc space-y-2 pl-6">{block.items.map((item, index) => <li key={block.id + "-" + index}>{InlineText({ value: item, sources })}</li>)}</ul>;
  }
  return <p style={blockTextStyle(block, document)}>{InlineText({ value: block.text, sources })}</p>;
}

export default function ArticlePreview({ document, title, metaDescription, sources, device }: Props) {
  const frameClass = device === "mobile" ? "mx-auto w-full max-w-[390px] rounded-[2rem] border-[8px] border-slate-800" : "w-full";
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3">
        <div>
          <h3 className="m-0 text-sm font-bold text-[var(--text)]">Visitor preview</h3>
          <p className="mb-0 mt-1 text-xs text-[var(--text-soft)]">Live rendering of the editable article content</p>
        </div>
        <span className="text-xs text-[var(--text-soft)]">{device === "mobile" ? "Mobile" : "Desktop"}</span>
      </div>
      <div className="min-w-0 overflow-x-auto p-3 sm:p-4" style={{ backgroundColor: document.appearance.canvasColor }}>
        <div className={frameClass}>
          <article className="min-h-[560px] min-w-0 overflow-hidden bg-white px-5 py-8 text-slate-800 shadow-sm sm:px-8 sm:py-10" style={{ color: document.appearance.bodyColor, fontFamily: document.appearance.bodyFontFamily, backgroundColor: "#FFFFFF" }}>
            <h1 className="mb-4 break-words font-bold leading-tight tracking-tight" style={{ color: document.appearance.headingColor, fontFamily: document.appearance.headingFontFamily, fontSize: Math.min(42, document.appearance.headingFontSize + 8) + "px" }}>{title || "Your article title"}</h1>
            {metaDescription ? <p className="mb-8 text-sm leading-6 text-slate-500">{metaDescription}</p> : null}
            <div className="min-w-0 break-words text-base leading-8">
              {document.blocks.map((block) => <PreviewBlock key={block.id} block={block} document={document} sources={sources}/>)}
              <div className="clear-both"/>
            </div>
          </article>
        </div>
      </div>
      <p className="m-0 border-t border-[var(--border)] px-4 py-2 text-xs leading-5 text-[var(--text-soft)]">
        Preview shows this article's content and saved rich-text settings. The Wix site's header, footer, Blog theme, and final page template remain controlled by the site.
      </p>
    </div>
  );
}
