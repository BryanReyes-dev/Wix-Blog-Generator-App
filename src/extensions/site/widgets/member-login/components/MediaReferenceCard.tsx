import { formatBytes } from "../lib/media-reference";
import { cx, ICON_BUTTON_CLASS, TEXTAREA_CLASS } from "../lib/styles";
import type { MediaReference } from "../types";

type Props = {
  reference: MediaReference;
  onNoteChange: (id: string, value: string) => void;
  onRemove: (id: string) => void;
};

export default function MediaReferenceCard({ reference, onNoteChange, onRemove }: Props) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-3 sm:grid-cols-[82px_minmax(0,1fr)_auto]">
      <img
        src={reference.frames[0]?.dataUrl ?? ""}
        alt={reference.name + " preview"}
        className="col-span-2 h-28 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] object-cover sm:col-span-1 sm:h-[72px] sm:w-[82px]"
      />
      <div className="grid min-w-0 gap-2 sm:col-span-1">
        <div className="grid min-w-0 gap-1">
          <strong className="break-words text-[13px] text-[var(--text)]">{reference.name}</strong>
          <small className="break-words text-xs leading-5 text-[var(--text-soft)]">
            {(reference.kind === "video" ? "Video · " + reference.frames.length + " sampled frames" : "Image reference") +
              " · " + formatBytes(reference.originalBytes)}
          </small>
        </div>
        <textarea
          rows={2}
          maxLength={500}
          aria-label={"Context for " + reference.name}
          placeholder="Optional context for the model (up to 500 characters)"
          value={reference.notes}
          onChange={(event) => onNoteChange(reference.id, event.target.value)}
          className={TEXTAREA_CLASS + " min-h-16"}
        />
      </div>
      <button
        type="button"
        aria-label={"Remove file " + reference.name}
        title="Remove file"
        onClick={() => onRemove(reference.id)}
        className={cx("col-start-2 row-start-1", ICON_BUTTON_CLASS, "sm:col-start-3 sm:row-start-1")}
      >
        ×
      </button>
    </div>
  );
}
