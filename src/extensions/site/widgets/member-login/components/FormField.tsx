import type { ReactNode } from "react";

type Props = {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
};

export default function FormField({ id, label, required = false, hint, children }: Props) {
  return (
    <div className="grid min-w-0 gap-2">
      <label htmlFor={id} className="block text-[13px] font-semibold leading-5 text-[var(--text)]">
        {label}{required ? " *" : ""}
      </label>
      {children}
      {hint ? <small className="break-words text-xs leading-5 text-[var(--text-soft)]">{hint}</small> : null}
    </div>
  );
}
