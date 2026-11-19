import type { Theme } from "../types";

export const DARK_THEME_TOKENS =
  "[--page:#0a0d13] [--surface:#121722] [--surface-raised:#1a2230] [--surface-soft:#202a3a] [--border:#2e394b] [--border-strong:#44536a] [--text:#f1f5fb] [--text-muted:#a5b1c2] [--text-soft:#7c8ba0] [--accent:#8db7ff] [--accent-strong:#4a8dff] [--accent-text:#071326] [--focus:rgb(117_170_255_/_40%)] [--danger-bg:#351a22] [--danger-border:#7b3948] [--danger-text:#ffc3cf] [--success-bg:#123025] [--success-border:#29664a] [--success-text:#b7f2ce] [--chip-bg:#1e3557] [--chip-text:#c4dcff]";

export const LIGHT_THEME_TOKENS =
  "[--page:#f3f6fb] [--surface:#ffffff] [--surface-raised:#f8faff] [--surface-soft:#eaf0f8] [--border:#d8e0ed] [--border-strong:#b4c1d5] [--text:#1b2433] [--text-muted:#506077] [--text-soft:#66758b] [--accent:#255fba] [--accent-strong:#1f61c5] [--accent-text:#ffffff] [--focus:rgb(37_95_186_/_18%)] [--danger-bg:#fff2f4] [--danger-border:#e7aab5] [--danger-text:#8e2537] [--success-bg:#effbf4] [--success-border:#a9d7bc] [--success-text:#16633e] [--chip-bg:#e5efff] [--chip-text:#244b82]";

export const INPUT_CLASS =
  "block w-full min-w-0 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 py-3 text-sm leading-6 text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-[var(--accent-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)]";
export const TEXTAREA_CLASS = INPUT_CLASS + " min-h-24 resize-y";
const BUTTON_BASE_CLASS =
  "inline-flex min-h-10 max-w-full items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold leading-5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--page)] disabled:cursor-not-allowed disabled:opacity-50";

export const PRIMARY_BUTTON_CLASS =
  BUTTON_BASE_CLASS + " border-transparent bg-[var(--accent)] text-[var(--accent-text)] hover:brightness-105";
export const SECONDARY_BUTTON_CLASS =
  BUTTON_BASE_CLASS + " border-[var(--border-strong)] bg-[var(--surface-raised)] text-[var(--text)] hover:bg-[var(--surface-soft)]";
export const SOFT_BUTTON_CLASS =
  BUTTON_BASE_CLASS + " border-[var(--border-strong)] bg-[var(--surface-soft)] text-[var(--text)] hover:bg-[var(--surface-raised)]";
export const ICON_BUTTON_CLASS =
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] text-2xl font-normal leading-none text-[var(--text-muted)] hover:bg-[var(--surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] disabled:cursor-not-allowed disabled:opacity-50";
export const PANEL_CLASS =
  "grid min-w-0 content-start gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 lg:p-6";

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function themeTokens(theme: Theme): string {
  return theme === "light" ? LIGHT_THEME_TOKENS : DARK_THEME_TOKENS;
}
