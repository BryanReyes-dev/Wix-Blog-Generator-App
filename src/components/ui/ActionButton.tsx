import type { ButtonHTMLAttributes } from 'react';
import styles from './ActionButton.module.css';

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary';
};

export function ActionButton({
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ActionButtonProps) {
  const classes = [styles.button, styles[variant], className].filter(Boolean).join(' ');

  return <button {...props} className={classes} type={type} />;
}
