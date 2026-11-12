import type { ReactNode } from 'react';
import styles from './StatusPanel.module.css';

type StatusPanelProps = {
  title: string;
  message: string;
  tone?: 'info' | 'error' | 'success';
  children?: ReactNode;
};

export function StatusPanel({
  title,
  message,
  tone = 'info',
  children,
}: StatusPanelProps) {
  return (
    <section
      className={styles.panel + ' ' + styles[tone]}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
    >
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.message}>{message}</p>
      {children ? <div className={styles.actions}>{children}</div> : null}
    </section>
  );
}
