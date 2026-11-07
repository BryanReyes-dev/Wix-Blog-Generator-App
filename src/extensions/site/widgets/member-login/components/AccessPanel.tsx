import type { ReactNode } from "react";

type Props = {
  title: string;
  message: string;
  children?: ReactNode;
};

const PANEL_CLASS =
  "mx-auto flex min-h-[280px] w-full min-w-0 max-w-3xl flex-col items-start justify-center gap-4 rounded-2xl border border-[#2e394b] bg-[#0a0d13] p-4 text-[#f1f5fb] sm:p-8";

export const BUTTON_CLASS =
  "inline-flex min-h-11 max-w-full items-center justify-center rounded-xl border border-transparent bg-[#4a8dff] px-4 py-3 text-sm font-semibold leading-5 text-white transition-colors hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8db7ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0d13] disabled:cursor-not-allowed disabled:opacity-50";

export const SECONDARY_BUTTON_CLASS =
  "inline-flex min-h-11 max-w-full items-center justify-center rounded-xl border border-[#44536a] bg-[#1a2230] px-4 py-3 text-sm font-semibold leading-5 text-[#f1f5fb] transition-colors hover:bg-[#202a3a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8db7ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0d13] disabled:cursor-not-allowed disabled:opacity-50";

export default function AccessPanel({ title, message, children }: Props) {
  return (
    <section className={PANEL_CLASS}>
      <h2 className="m-0 break-words text-2xl font-bold leading-tight tracking-tight text-[#f1f5fb] sm:text-3xl">
        {title}
      </h2>
      <p role="status" aria-live="polite" className="m-0 break-words text-sm leading-6 text-[#a5b1c2]">
        {message}
      </p>
      {children ? <div className="flex w-full flex-wrap gap-3">{children}</div> : null}
    </section>
  );
}
