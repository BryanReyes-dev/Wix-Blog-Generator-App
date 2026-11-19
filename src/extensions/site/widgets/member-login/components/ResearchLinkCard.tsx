import FormField from "./FormField";
import { ICON_BUTTON_CLASS, INPUT_CLASS, TEXTAREA_CLASS } from "../lib/styles";
import type { ResearchLink, ResearchLinkCheck } from "../types";

type Props = {
  link: ResearchLink;
  index: number;
  check?: ResearchLinkCheck;
  onChange: (id: string, field: "url" | "notes", value: string) => void;
  onRemove: (id: string) => void;
};

export default function ResearchLinkCard({ link, index, check, onChange, onRemove }: Props) {
  const urlId = "research-url-" + link.id;
  const noteId = "research-note-" + link.id;
  const checkId = urlId + "-check";
  const hasError = check?.status === "error";

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
            aria-invalid={hasError || undefined}
            aria-describedby={check ? checkId : undefined}
          />
          {check?.status === "error" ? (
            <p id={checkId} role="alert" className="mt-2 text-sm leading-5 text-red-700">
              <strong>This research link could not be used.</strong>{" "}
              {check.message ?? "The page could not be retrieved."} Replace this URL with another public article page, or remove this source, then try again.
            </p>
          ) : check?.status === "success" ? (
            <p id={checkId} className="mt-2 text-sm leading-5 text-emerald-700">
              <strong>Verified:</strong> {check.title ?? "The page was retrieved successfully."}
            </p>
          ) : null}
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
