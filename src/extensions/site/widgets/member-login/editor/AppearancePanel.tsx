import type { ArticleAppearance } from "../../../../../lib/article-document";

const FONTS = ["Arial", "Georgia", "Inter", "Times New Roman", "Trebuchet MS", "Verdana"] as const;
const CONTROL = "mt-1 min-h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)]";

type Props = {
  value: ArticleAppearance;
  onChange: (next: ArticleAppearance) => void;
};

export default function AppearancePanel({ value, onChange }: Props) {
  const update = <K extends keyof ArticleAppearance>(key: K, next: ArticleAppearance[K]) => {
    onChange({ ...value, [key]: next });
  };

  return (
    <details className="rounded-xl border border-[var(--border)] bg-[var(--surface)]" open>
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-[var(--text)]">
        <span className="flex items-center gap-2"><span aria-hidden="true">◈</span> Typography and appearance</span>
        <span className="text-xs text-[var(--text-soft)]">Expand settings</span>
      </summary>
      <div className="grid gap-4 border-t border-[var(--border)] p-4 sm:grid-cols-2 xl:grid-cols-3">
        <label className="text-xs font-semibold text-[var(--text-muted)]">
          Body font
          <select className={CONTROL} value={value.bodyFontFamily} onChange={(event) => update("bodyFontFamily", event.target.value)}>
            {FONTS.map((font) => <option key={font} value={font}>{font}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-[var(--text-muted)]">
          Heading font
          <select className={CONTROL} value={value.headingFontFamily} onChange={(event) => update("headingFontFamily", event.target.value)}>
            {FONTS.map((font) => <option key={font} value={font}>{font}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-[var(--text-muted)]">
          Body size · {value.bodyFontSize}px
          <input className="mt-3 w-full accent-[var(--accent)]" type="range" min="12" max="30" step="1" value={value.bodyFontSize} onChange={(event) => update("bodyFontSize", Number(event.target.value))}/>
        </label>
        <label className="text-xs font-semibold text-[var(--text-muted)]">
          Heading size · {value.headingFontSize}px
          <input className="mt-3 w-full accent-[var(--accent)]" type="range" min="18" max="56" step="1" value={value.headingFontSize} onChange={(event) => update("headingFontSize", Number(event.target.value))}/>
        </label>
        <label className="flex items-center justify-between gap-3 text-xs font-semibold text-[var(--text-muted)]">
          Body text color
          <input aria-label="Body text color" type="color" className="h-9 w-12 cursor-pointer rounded border border-[var(--border)] bg-transparent" value={value.bodyColor} onChange={(event) => update("bodyColor", event.target.value)}/>
        </label>
        <label className="flex items-center justify-between gap-3 text-xs font-semibold text-[var(--text-muted)]">
          Heading color
          <input aria-label="Heading text color" type="color" className="h-9 w-12 cursor-pointer rounded border border-[var(--border)] bg-transparent" value={value.headingColor} onChange={(event) => update("headingColor", event.target.value)}/>
        </label>
        <label className="text-xs font-semibold text-[var(--text-muted)]">
          Text alignment
          <select className={CONTROL} value={value.textAlignment} onChange={(event) => update("textAlignment", event.target.value as ArticleAppearance["textAlignment"])}>
            <option value="LEFT">Left</option><option value="CENTER">Center</option><option value="RIGHT">Right</option><option value="JUSTIFY">Justify</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-[var(--text-muted)]">
          Line spacing · {value.lineHeight.toFixed(2)}
          <input className="mt-3 w-full accent-[var(--accent)]" type="range" min="1.1" max="2.4" step="0.05" value={value.lineHeight} onChange={(event) => update("lineHeight", Number(event.target.value))}/>
        </label>
        <label className="flex items-center justify-between gap-3 text-xs font-semibold text-[var(--text-muted)]">
          Preview canvas color
          <input aria-label="Preview canvas color" type="color" className="h-9 w-12 cursor-pointer rounded border border-[var(--border)] bg-transparent" value={value.canvasColor} onChange={(event) => update("canvasColor", event.target.value)}/>
        </label>
        <p className="m-0 text-xs leading-5 text-[var(--text-soft)] sm:col-span-2 xl:col-span-3">
          Typography, text color, alignment, and line spacing are stored in the article. The canvas color changes this editor preview only; the website's global background and Blog theme remain controlled by Wix.
        </p>
      </div>
    </details>
  );
}
