import type { SVGProps } from 'react';

/**
 * The PHOSPHENE icon set: drawn on a 24-unit grid with 1.25 strokes, built
 * from the same apertures, arcs and rays as the Ithran script.
 */
const paths = {
  aperture: (
    <>
      <circle cx="12" cy="12" r="8.25" />
      <circle cx="15.2" cy="8.8" r="1.6" fill="currentColor" stroke="none" />
      <path d="M5.2 15.6a8.25 8.25 0 0 0 4.2 4" />
    </>
  ),
  arrowRight: <path d="M4 12h15.5M14 6.5l5.5 5.5-5.5 5.5" />,
  arrowLeft: <path d="M20 12H4.5M10 6.5 4.5 12l5.5 5.5" />,
  arrowUpRight: <path d="M7 17 17.2 6.8M8.5 6.5h9v9" />,
  arrowDown: <path d="M12 4v15.5M6.5 14l5.5 5.5 5.5-5.5" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  menu: <path d="M4 9h16M4 15h10" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.25" />
      <path d="m15.2 15.2 4.8 4.8" />
    </>
  ),
  command: (
    <path d="M9 9h6v6H9zM9 9V6.5A2.5 2.5 0 1 0 6.5 9H9m6 0h2.5A2.5 2.5 0 1 0 15 6.5V9m0 6v2.5a2.5 2.5 0 1 0 2.5-2.5H15m-6 0H6.5A2.5 2.5 0 1 0 9 17.5V15" />
  ),
  soundOn: <path d="M3.5 12h2M7.5 8v8M11.5 5v14M15.5 9v6M19.5 11v2" />,
  soundOff: <path d="M3.5 12h17" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M12 4.5V8M12 12l3.2-3.2M4.5 12H6M18 12h1.5" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  map: (
    <>
      <path d="m5 18 4.5-8.5 5 4 4.5-9" />
      <circle cx="5" cy="18" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="9.5" cy="9.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="13.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="19" cy="4.5" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  play: <path d="M8 5.5v13l10.5-6.5z" />,
  pause: <path d="M8.5 5.5v13M15.5 5.5v13" />,
  reset: <path d="M5.5 9.5A7 7 0 1 1 5 13.2M5.5 4.5v5h5" />,
  seed: (
    <>
      <path d="M12 20.5c-4.5-2-6.5-5.5-6.5-9A6.5 6.5 0 0 1 12 5a6.5 6.5 0 0 1 6.5 6.5c0 3.5-2 7-6.5 9z" />
      <path d="M12 9v7" />
    </>
  ),
  download: <path d="M12 4v11.5M7 11l5 5 5-5M5 20h14" />,
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="1" />
      <path d="M15.5 8.5V5.5a1 1 0 0 0-1-1h-9a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  external: (
    <path d="M14 4.5h5.5V10M19.5 4.5 11 13M17.5 14v5a.5.5 0 0 1-.5.5H5a.5.5 0 0 1-.5-.5V7a.5.5 0 0 1 .5-.5h5" />
  ),
  chevronLeft: <path d="M14.5 6 8.5 12l6 6" />,
  chevronRight: <path d="m9.5 6 6 6-6 6" />,
  chevronDown: <path d="m6 9.5 6 6 6-6" />,
  chevronUp: <path d="m6 14.5 6-6 6 6" />,
  grid: <path d="M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z" />,
  list: <path d="M4.5 6.5h15M4.5 12h15M4.5 17.5h15" />,
  keyboard: (
    <>
      <rect x="3" y="6.5" width="18" height="11" rx="1.2" />
      <path d="M7 10h.01M10.3 10h.01M13.6 10h.01M17 10h.01M7.5 14h9" />
    </>
  ),
  orbit: (
    <>
      <circle cx="12" cy="12" r="2.4" />
      <ellipse cx="12" cy="12" rx="9" ry="4.2" transform="rotate(-24 12 12)" />
    </>
  ),
  signal: <path d="M3 12h3l2-5 3 10 3-13 3 11 2-3h2" />,
  archive: (
    <>
      <rect x="4" y="4.5" width="16" height="15" rx="1" />
      <path d="M4 10h16M10 13.5h4" />
    </>
  ),
  chronicle: (
    <>
      <path d="M3.5 12h17" />
      <circle cx="6.5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="2.5" />
      <circle cx="17.5" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  instruments: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h3.5a4.5 4.5 0 0 1 9 0H20" />
    </>
  ),
  dish: (
    <>
      <path d="M5 13.5a7.5 7.5 0 0 0 10.5-10.5z" />
      <path d="m10.2 8.8 5.3-5.3M9 17l-2.5 3.5h7L11 17" />
    </>
  ),
  institute: (
    <>
      <path d="M4 19.5h16M6 19.5v-8M10 19.5v-8M14 19.5v-8M18 19.5v-8M3.5 11.5 12 5l8.5 6.5" />
    </>
  ),
  terminal: <path d="m5 7.5 4.5 4.5L5 16.5M12 17h7" />,
  fragment: <path d="M12 3.5 18.5 12 12 20.5 5.5 12z M12 8.5v7" />,
  nocturne: <path d="M18.5 14.5A7.5 7.5 0 0 1 9.5 5.5a7.5 7.5 0 1 0 9 9z" />,
  plate: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  spark: (
    <path d="M12 3v5M12 16v5M3 12h5M16 12h5M6.3 6.3l2.4 2.4M15.3 15.3l2.4 2.4M6.3 17.7l2.4-2.4M15.3 8.7l2.4-2.4" />
  ),
  microphone: (
    <>
      <rect x="9" y="3.5" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
    </>
  ),
} as const;

export type IconName = keyof typeof paths;

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
  /** Accessible label; omit for decorative icons. */
  label?: string;
}

export function Icon({ name, size = 18, label, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      focusable="false"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}
