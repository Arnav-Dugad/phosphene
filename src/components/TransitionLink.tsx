import type { MouseEvent, Ref } from 'react';
import { Link, type LinkProps } from 'react-router';
import { prefetchPath } from '../app/pageModules.ts';
import { useTransitionNavigate, type TransitionKind } from '../features/transition/useTransitionNavigate.ts';
import type { SpectralKey } from '../design/tokens.ts';

export interface TransitionLinkProps extends Omit<LinkProps, 'to'> {
  to: string;
  transition?: TransitionKind;
  line?: SpectralKey;
  ref?: Ref<HTMLAnchorElement>;
}

/**
 * A router link that travels through the blink. Modified clicks (new tab,
 * etc.) fall through to the browser untouched; hover and focus prefetch the
 * destination's page and scene chunks.
 */
export function TransitionLink({
  to,
  transition = 'blink',
  line,
  onClick,
  onPointerEnter,
  onFocus,
  ...rest
}: TransitionLinkProps) {
  const go = useTransitionNavigate();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>): void => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (rest.target && rest.target !== '_self') return;
    event.preventDefault();
    let { clientX: x, clientY: y } = event;
    if (event.detail === 0) {
      // Keyboard activation: close the aperture on the link itself.
      const rect = event.currentTarget.getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
    }
    go(to, { x, y, transition, line });
  };

  return (
    <Link
      to={to}
      onClick={handleClick}
      onPointerEnter={(e) => {
        onPointerEnter?.(e);
        prefetchPath(to);
      }}
      onFocus={(e) => {
        onFocus?.(e);
        prefetchPath(to);
      }}
      viewTransition={transition === 'morph'}
      {...rest}
    />
  );
}
