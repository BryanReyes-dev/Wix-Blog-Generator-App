import FormField from "./FormField";
import { ICON_BUTTON_CLASS, INPUT_CLASS, TEXTAREA_CLASS } from "../lib/styles";
import type { ResearchLink } from "../types";

type Props = {
  link: ResearchLink;
  index: number;
  onChange: (id: string, field: "url" | "notes", value: string) => void;
  onRemove: (id: string) => void;
};

export default function ResearchLinkCard({ link, index, onChange, onRemove }: Props) {
  const urlId = "research-url-" + link.id;
  const noteId = "research-note-" + link.id;

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-3 sm:gap-3">
      <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
        <FormField id={urlId} label={"URL " + (index + 1)}>
          <input
            id={urlId}
            name={urlId}
            type="url"
            maxLength={2048}
            placeholder="https://example.com/article"
            value={link.url}
            onChange={(event) => onChange(link.id, "url", event.target.value)}
            className={INPUT_CLASS}
          />
        </FormField>
        <FormField id={noteId} label="Source focus note (optional)">
          <textarea
            id={noteId}
            name={noteId}
            rows={2}
            maxLength={500}
            placeholder="Optional: what should the model focus on in this source?"
            value={link.notes}
            onChange={(event) => onChange(link.id, "notes", event.target.value)}
            className={TEXTAREA_CLASS + " min-h-16"}
          />
        </FormField>
      </div>
      <button
        type="button"
        title="Remove link"
        aria-label={"Remove research link " + (index + 1)}
        onClick={() => onRemove(link.id)}
        className={ICON_BUTTON_CLASS}
      >
        ×
      </button>
    </div>
  );
}
