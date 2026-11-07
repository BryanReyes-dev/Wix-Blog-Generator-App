import type { WorkflowStatus } from "../types";
import { cx } from "../lib/styles";

type Props = { status: WorkflowStatus | null };

export default function StatusBanner({ status }: Props) {
  if (!status?.message) {
    return <p role="status" aria-live="polite" className="sr-only" />;
  }

  return (
    <p
      role="status"
      aria-live="polite"
      className={cx(
        "m-0 break-words rounded-xl border px-3 py-3 text-sm leading-6",
        status.kind === "error" && "border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger-text)]",
        status.kind === "success" && "border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success-text)]",
        status.kind === "info" && "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]",
      )}
    >
      {status.message}
    </p>
  );
}
