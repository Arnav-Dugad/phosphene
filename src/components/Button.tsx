import type { ButtonHTMLAttributes, CSSProperties, PointerEvent, ReactNode } from 'react';
import type { SpectralKey } from '../design/tokens.ts';
import { Icon, type IconName } from './Icon.tsx';
import { TransitionLink } from './TransitionLink.tsx';
import styles from './Button.module.css';

type Variant = 'primary' | 'ghost' | 'quiet';

interface CommonProps {
  children: ReactNode;
  variant?: Variant;
  icon?: IconName | null;
  /** Spectral line tinting hover glow. */
  line?: SpectralKey;
  className?: string;
  cursorLabel?: string;
}

type ButtonProps = CommonProps &
  (
    | ({ to: string; href?: never } & Omit<ButtonHTMLAttributes<HTMLAnchorElement>, 'children' | 'className'>)
    | ({ href: string; to?: never } & Omit<ButtonHTMLAttributes<HTMLAnchorElement>, 'children' | 'className'>)
    | ({ to?: never; href?: never } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'>)
  );

/** Tracks the pointer so the edge glow follows it across the control. */
function trackGlow(e: PointerEvent<HTMLElement>): void {
  const rect = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--gx', `${e.clientX - rect.left}px`);
  e.currentTarget.style.setProperty('--gy', `${e.clientY - rect.top}px`);
}

/**
 * The instrument button: a hairline control with registration-mark corners, a
 * glow that follows the pointer along its edge and an arrow that travels.
 */
export function Button(props: ButtonProps) {
  const { children, variant = 'primary', icon = 'arrowRight', line, className, cursorLabel, ...rest } = props;
  const style = line ? ({ '--btn-line': `var(--line-${line})` } as CSSProperties) : undefined;
  const classes = `${styles.button} ${styles[variant] ?? ''} ${className ?? ''}`;
  const inner = (
    <>
      <span className={styles.corners} aria-hidden="true" />
      <span className={styles.label}>{children}</span>
      {icon && (
        <span className={styles.icon} aria-hidden="true">
          <Icon name={icon} size={16} />
          <Icon name={icon} size={16} />
        </span>
      )}
    </>
  );

  if ('to' in rest && typeof rest.to === 'string') {
    const { to, ...anchor } = rest;
    return (
      <TransitionLink
        to={to}
        className={classes}
        style={style}
        onPointerMove={trackGlow}
        data-magnetic
        data-cursor-label={cursorLabel}
        {...anchor}
      >
        {inner}
      </TransitionLink>
    );
  }
  if ('href' in rest && typeof rest.href === 'string') {
    const { href, ...anchor } = rest;
    return (
      <a
        href={href}
        className={classes}
        style={style}
        onPointerMove={trackGlow}
        data-magnetic
        data-cursor-label={cursorLabel}
        {...anchor}
      >
        {inner}
      </a>
    );
  }
  const buttonProps = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button
      type="button"
      className={classes}
      style={style}
      onPointerMove={trackGlow}
      data-magnetic
      data-cursor-label={cursorLabel}
      {...buttonProps}
    >
      {inner}
    </button>
  );
}
