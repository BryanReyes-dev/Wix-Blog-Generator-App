import { useState } from "react";
import type { Theme } from "../types";
import { SECONDARY_BUTTON_CLASS, cx } from "../lib/styles";

type Props = {
  theme: Theme;
  onToggleTheme: () => void;
  onSignOut: () => Promise<void>;
  onSignOutError: () => void;
};

export default function WorkflowHeader({ theme, onToggleTheme, onSignOut, onSignOutError }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const themeButtonLabel = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);

    try {
      await onSignOut();
    } catch {
      onSignOutError();
      setIsSigningOut(false);
    }
  };

  return (
    <header className="flex min-w-0 flex-col justify-between gap-4 sm:flex-row sm:items-start sm:gap-6">
      <div className="min-w-0">
        <p className="mb-2 mt-0 text-[11px] font-extrabold tracking-[0.13em] text-[var(--accent)]">EDITORIAL WORKSPACE</p>
        <h2 className="m-0 text-2xl font-bold leading-tight tracking-tight text-[var(--text)] sm:text-3xl">
          Create a Wix Blog draft
        </h2>
        <p className="mb-0 mt-2 max-w-4xl break-words text-sm leading-6 text-[var(--text-muted)]">
          Build your brief, add research and visual references, then edit and preview before saving an unpublished draft.
        </p>
      </div>

      <div className="flex min-w-0 flex-wrap items-center justify-start gap-2 sm:shrink-0 sm:justify-end">
        <button
          type="button"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close workflow menu" : "Open workflow menu"}
          onClick={() => setMenuOpen((open) => !open)}
          className={cx(SECONDARY_BUTTON_CLASS, "sm:hidden")}
        >
          {menuOpen ? "Close" : "Menu"}
        </button>
        <div className={cx("flex min-w-0 flex-col gap-2 sm:flex-row", menuOpen ? "flex" : "hidden sm:flex")}>
          <button
            type="button"
            aria-label={themeButtonLabel}
            aria-pressed={theme === "light"}
            onClick={onToggleTheme}
            className={SECONDARY_BUTTON_CLASS}
          >
            {themeButtonLabel}
          </button>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={isSigningOut}
            className={SECONDARY_BUTTON_CLASS}
          >
            {isSigningOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    </header>
  );
}
