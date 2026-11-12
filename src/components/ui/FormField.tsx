import type { ReactNode } from 'react';
import styles from './FormField.module.css';

type FormFieldProps = {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
};

export function FormField({
  label,
  htmlFor,
  required = false,
  hint,
  children,
}: FormFieldProps) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={htmlFor}>
        {label}{required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {children}
      {hint ? <small className={styles.hint}>{hint}</small> : null}
    </div>
  );
}
