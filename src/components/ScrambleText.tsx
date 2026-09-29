import { useEffect, useRef, type Ref } from 'react';
import { useResolvedMotion } from '../hooks/useResolvedMotion.ts';

const GLYPHS = '·:∘◦○◌⊙◎●∴∵⁘⁙+×/\\|=≡≈∆◊';

interface ScrambleTextProps {
  text: string;
  className?: string;
  /** Delay before decoding starts, ms. */
  delay?: number;
  /** Per-character stagger, ms. */
  stagger?: number;
  /** Replay whenever `text` changes (default) or only once. */
  once?: boolean;
  /** Start decoding only when scrolled into view. */
  inView?: boolean;
  as?: 'span' | 'p' | 'div';
}

/**
 * Text that decodes: characters resolve out of signal noise one by one. Used
 * for things the instruments are "receiving". Updates the DOM directly —
 * no React render per frame — and exposes the final text to assistive tech.
 */
export function ScrambleText({
  text,
  className,
  delay = 0,
  stagger = 28,
  once = false,
  inView = false,
  as: Tag = 'span',
}: ScrambleTextProps) {
  const ref = useRef<HTMLElement>(null);
  const played = useRef(false);
  const motion = useResolvedMotion();

  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[data-scramble]');
    if (!el) return;
    if (motion === 'still' || (once && played.current)) {
      el.textContent = text;
      return;
    }
    let raf = 0;
    let timer = 0;
    let observer: IntersectionObserver | null = null;

    const run = (): void => {
      played.current = true;
      const start = performance.now() + delay;
      const chars = Array.from(text);
      const tick = (now: number): void => {
        const elapsed = now - start;
        let out = '';
        let done = true;
        for (let i = 0; i < chars.length; i++) {
          const c = chars[i] as string;
          const resolveAt = i * stagger + 180;
          if (c === ' ' || elapsed >= resolveAt) out += c;
          else {
            done = false;
            out += elapsed < 0 ? ' ' : (GLYPHS[Math.floor(Math.random() * GLYPHS.length)] ?? '·');
          }
        }
        el.textContent = out;
        if (!done) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    if (inView && 'IntersectionObserver' in window) {
      el.textContent = Array.from(text, (c) => (c === ' ' ? ' ' : ' ')).join('');
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            observer?.disconnect();
            run();
          }
        },
        { threshold: 0.4 },
      );
      if (ref.current) observer.observe(ref.current);
    } else {
      timer = window.setTimeout(run, 0);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      observer?.disconnect();
      el.textContent = text;
    };
  }, [text, delay, stagger, once, inView, motion]);

  return (
    <Tag ref={ref as Ref<never>} className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" data-scramble>
        {text}
      </span>
    </Tag>
  );
}
