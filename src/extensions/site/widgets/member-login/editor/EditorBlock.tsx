import type { ArticleBlock, BlockStyle, ImageBlock } from "../../../../../lib/article-document";
import { EditorIcon } from "./EditorIcon";

const INPUT = "mt-1 min-h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)]";
const TEXTAREA = INPUT + " min-h-24 resize-y py-2 leading-6";

type Props = {
  block: ArticleBlock;
  index: number;
  total: number;
  onChange: (block: ArticleBlock) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
};

function StyleControls({ value, onChange }: { value: BlockStyle; onChange: (style: BlockStyle) => void }) {
  return (
    <details className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-3">
      <summary className="cursor-pointer text-xs font-semibold text-[var(--text-muted)]">Block styling</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="flex items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
          Background
          <input type="color" aria-label="Block background color" value={value.backgroundColor || "#FFFFFF"} onChange={(event) => onChange({ ...value, backgroundColor: event.target.value })}/>
        </label>
        <label className="flex items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
          Text color
          <input type="color" aria-label="Block text color" value={value.color || "#344054"} onChange={(event) => onChange({ ...value, color: event.target.value })}/>
        </label>
        <label className="text-xs text-[var(--text-muted)]">
          Top padding · {value.paddingTop}px
          <input className="mt-2 w-full accent-[var(--accent)]" type="range" min="0" max="64" value={value.paddingTop} onChange={(event) => onChange({ ...value, paddingTop: Number(event.target.value) })}/>
        </label>
        <label className="text-xs text-[var(--text-muted)]">
          Bottom padding · {value.paddingBottom}px
          <input className="mt-2 w-full accent-[var(--accent)]" type="range" min="0" max="64" value={value.paddingBottom} onChange={(event) => onChange({ ...value, paddingBottom: Number(event.target.value) })}/>
        </label>
        <label className="text-xs text-[var(--text-muted)]">
          Font size · {value.fontSize || "Theme"} 
          <input className="mt-2 w-full accent-[var(--accent)]" type="range" min="0" max="56" value={value.fontSize} onChange={(event) => onChange({ ...value, fontSize: Number(event.target.value) })}/>
        </label>
        <label className="text-xs text-[var(--text-muted)]">
          Alignment
          <select className={INPUT} value={value.textAlignment} onChange={(event) => onChange({ ...value, textAlignment: event.target.value as BlockStyle["textAlignment"] })}>
            <option value="INHERIT">Theme default</option><option value="LEFT">Left</option><option value="CENTER">Center</option><option value="RIGHT">Right</option><option value="JUSTIFY">Justify</option>
          </select>
        </label>
      </div>
    </details>
  );
}

function ImageFields({ block, onChange }: { block: ImageBlock; onChange: (next: ImageBlock) => void }) {
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-semibold text-[var(--text-muted)] sm:col-span-2">
        Alternative text (required)
        <input className={INPUT} maxLength={1000} required value={block.altText} onChange={(event) => onChange({ ...block, altText: event.target.value })} placeholder="Describe the image for screen readers"/>
      </label>
      <label className="text-xs font-semibold text-[var(--text-muted)] sm:col-span-2">
        Caption
        <input className={INPUT} maxLength={500} value={block.caption} onChange={(event) => onChange({ ...block, caption: event.target.value })} placeholder="Optional image caption"/>
      </label>
      <label className="text-xs font-semibold text-[var(--text-muted)]">
        Image width
        <select className={INPUT} value={block.width} onChange={(event) => onChange({ ...block, width: event.target.value as ImageBlock["width"] })}>
          <option value="SMALL">Small</option><option value="CONTENT">Content width</option><option value="ORIGINAL">Original width</option><option value="FULL_WIDTH">Full width</option>
        </select>
      </label>
      <label className="text-xs font-semibold text-[var(--text-muted)]">
        Alignment
        <select className={INPUT} value={block.alignment} onChange={(event) => onChange({ ...block, alignment: event.target.value as ImageBlock["alignment"] })}>
          <option value="LEFT">Left</option><option value="CENTER">Center</option><option value="RIGHT">Right</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)] sm:col-span-2">
        <input type="checkbox" checked={block.textWrap} onChange={(event) => onChange({ ...block, textWrap: event.target.checked })}/>
        Allow text to wrap around this image
      </label>
      <label className="text-xs font-semibold text-[var(--text-muted)]">
        Border width · {block.borderWidth}px
        <input className="mt-3 w-full accent-[var(--accent)]" type="range" min="0" max="12" value={block.borderWidth} onChange={(event) => onChange({ ...block, borderWidth: Number(event.target.value) })}/>
      </label>
      <label className="text-xs font-semibold text-[var(--text-muted)]">
        Corner radius · {block.borderRadius}px
        <input className="mt-3 w-full accent-[var(--accent)]" type="range" min="0" max="48" value={block.borderRadius} onChange={(event) => onChange({ ...block, borderRadius: Number(event.target.value) })}/>
      </label>
      <label className="flex items-center justify-between gap-2 text-xs font-semibold text-[var(--text-muted)] sm:col-span-2">
        Border color
        <input type="color" aria-label="Image border color" value={block.borderColor} onChange={(event) => onChange({ ...block, borderColor: event.target.value })}/>
      </label>
    </div>
  );
}

export default function EditorBlock({ block, index, total, onChange, onMove, onRemove }: Props) {
  return (
    <section className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4" aria-label={"Article block " + (index + 1)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-[var(--text-soft)]">
          {block.type === "heading" ? "Heading H" + block.level : block.type === "image" ? "Image / GIF" : block.type}
        </span>
        <div className="flex items-center gap-1">
          <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-soft)] disabled:opacity-30" aria-label="Move block up" title="Move up" disabled={index === 0} onClick={() => onMove(-1)}><EditorIcon name="arrow-up"/></button>
          <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-soft)] disabled:opacity-30" aria-label="Move block down" title="Move down" disabled={index === total - 1} onClick={() => onMove(1)}><EditorIcon name="arrow-down"/></button>
          <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--danger-text)] hover:bg-[var(--danger-bg)]" aria-label="Remove block" title="Remove block" onClick={onRemove}><EditorIcon name="trash"/></button>
        </div>
      </div>

      {block.type === "heading" ? (
        <div className="grid gap-2 sm:grid-cols-[100px_minmax(0,1fr)]">
          <label className="text-xs font-semibold text-[var(--text-muted)]">
            Level
            <select className={INPUT} value={block.level} onChange={(event) => onChange({ ...block, level: Number(event.target.value) as 2 | 3 | 4 })}>
              <option value="2">H2</option><option value="3">H3</option><option value="4">H4</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-[var(--text-muted)]">
            Heading text
            <input className={INPUT} maxLength={500} value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })}/>
          </label>
        </div>
      ) : null}

      {block.type === "paragraph" || block.type === "quote" ? (
        <label className="block text-xs font-semibold text-[var(--text-muted)]">
          {block.type === "quote" ? "Quoted text" : "Paragraph text"}
          <textarea className={TEXTAREA} rows={block.type === "quote" ? 3 : 4} maxLength={block.type === "quote" ? 3000 : 5000} value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })}/>
        </label>
      ) : null}

      {block.type === "list" ? (
        <label className="block text-xs font-semibold text-[var(--text-muted)]">
          List items
          <textarea className={TEXTAREA} rows={Math.max(3, Math.min(8, block.items.length + 1))} value={block.items.join("\n")} onChange={(event) => onChange({ ...block, items: event.target.value.split("\n") })} placeholder="One item per line"/>
        </label>
      ) : null}

      {block.type === "image" ? (
        <div className="grid gap-3">
          <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-raised)]">
            <img className="max-h-64 w-full object-contain" src={block.media.url} alt={block.altText || block.media.name}/>
          </div>
          <p className="m-0 break-all text-xs text-[var(--text-soft)]">{block.media.name} · {block.media.width} × {block.media.height} · {block.media.mimeType}</p>
          <ImageFields block={block} onChange={onChange}/>
        </div>
      ) : null}

      {block.type === "divider" ? <p className="m-0 py-2 text-sm text-[var(--text-soft)]">A horizontal divider will appear at this position in the article.</p> : null}

      {block.type !== "image" && block.type !== "divider" ? (
        <StyleControls value={block.style} onChange={(style) => onChange({ ...block, style })}/>
      ) : null}
    </section>
  );
}
