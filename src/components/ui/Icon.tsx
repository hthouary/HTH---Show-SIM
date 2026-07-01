/**
 * Minimal inline icon set (stroke-based, lucide-ish) so we avoid an icon
 * dependency. Each icon is a set of SVG children rendered inside a shared frame.
 */
import type { CSSProperties } from 'react';

export type IconName =
  | 'play'
  | 'pause'
  | 'stop'
  | 'plus'
  | 'trash'
  | 'copy'
  | 'save'
  | 'folder'
  | 'download'
  | 'upload'
  | 'file'
  | 'music'
  | 'bolt'
  | 'lightbulb'
  | 'laser'
  | 'sparkles'
  | 'monitor'
  | 'box'
  | 'speaker'
  | 'flame'
  | 'cloud'
  | 'snow'
  | 'party'
  | 'truss'
  | 'crowd'
  | 'target'
  | 'close'
  | 'chevron'
  | 'eye'
  | 'skip-back'
  | 'undo'
  | 'redo'
  | 'magnet'
  | 'grid';

const PATHS: Record<IconName, JSX.Element> = {
  play: <path d="M6 4l14 8-14 8z" />,
  pause: (
    <>
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </>
  ),
  stop: <rect x="5" y="5" width="14" height="14" rx="2" />,
  'skip-back': (
    <>
      <path d="M18 5v14l-9-7z" />
      <rect x="5" y="5" width="2.4" height="14" rx="1" />
    </>
  ),
  plus: (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h8" />
    </>
  ),
  save: (
    <>
      <path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M8 3v5h7" />
      <rect x="8" y="13" width="8" height="6" />
    </>
  ),
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  download: (
    <>
      <path d="M12 3v12" />
      <path d="M7 11l5 5 5-5" />
      <path d="M4 20h16" />
    </>
  ),
  upload: (
    <>
      <path d="M12 17V5" />
      <path d="M7 9l5-5 5 5" />
      <path d="M4 20h16" />
    </>
  ),
  file: (
    <>
      <path d="M6 3h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v5h5" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V6l11-2v12" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="17" cy="16" r="3" />
    </>
  ),
  bolt: <path d="M13 3L4 14h7l-1 7 9-11h-7z" />,
  lightbulb: (
    <>
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 1 4 10c-.7.7-1 1.4-1 2H9c0-.6-.3-1.3-1-2A6 6 0 0 1 12 3z" />
    </>
  ),
  laser: (
    <>
      <circle cx="6" cy="18" r="2" />
      <path d="M7.5 16.5L20 4" />
      <path d="M7.5 16.5L19 9" />
      <path d="M7.5 16.5L17 16" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" />
      <path d="M18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8z" />
    </>
  ),
  monitor: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8" />
      <path d="M12 16v4" />
    </>
  ),
  box: (
    <>
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
      <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
    </>
  ),
  speaker: (
    <>
      <rect x="6" y="3" width="12" height="18" rx="2" />
      <circle cx="12" cy="15" r="3" />
      <circle cx="12" cy="7" r="1" />
    </>
  ),
  flame: <path d="M12 3c1 3-2 4-2 7a2 2 0 0 0 4 0c2 1.5 3 3.5 3 5a5 5 0 0 1-10 0c0-3 2-4 2-7 0-2 2-3 3-5z" />,
  cloud: <path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.4A4 4 0 0 1 17 18z" />,
  snow: (
    <>
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="5.5" y1="5.5" x2="18.5" y2="18.5" />
      <line x1="18.5" y1="5.5" x2="5.5" y2="18.5" />
    </>
  ),
  party: (
    <>
      <path d="M4 20l5-13 8 8z" />
      <path d="M13 4l1 1M17 3l.5 1.5M19 8l1.2.4" />
    </>
  ),
  truss: (
    <>
      <line x1="3" y1="7" x2="21" y2="7" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <path d="M5 7l4 8M9 7l-4 8M13 7l4 8M17 7l-4 8" />
    </>
  ),
  crowd: (
    <>
      <circle cx="7" cy="9" r="2" />
      <circle cx="17" cy="9" r="2" />
      <circle cx="12" cy="7" r="2" />
      <path d="M3 20c0-3 2-5 4-5s4 2 4 5M13 20c0-3 2-5 4-5s4 2 4 5" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <line x1="12" y1="2" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="2" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
    </>
  ),
  close: (
    <>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </>
  ),
  chevron: <path d="M9 6l6 6-6 6" />,
  undo: (
    <>
      <path d="M7 8l-4 4 4 4" />
      <path d="M3 12h11a5 5 0 1 1 0 10h-3" />
    </>
  ),
  redo: (
    <>
      <path d="M17 8l4 4-4 4" />
      <path d="M21 12H10a5 5 0 1 0 0 10h3" />
    </>
  ),
  magnet: (
    <>
      <path d="M6 4H3v8a9 9 0 0 0 18 0V4h-3v8a6 6 0 0 1-12 0z" />
      <line x1="3" y1="9" x2="6" y2="9" />
      <line x1="18" y1="9" x2="21" y2="9" />
    </>
  ),
  grid: (
    <>
      <line x1="4" y1="3" x2="4" y2="21" />
      <line x1="10" y1="3" x2="10" y2="21" />
      <line x1="16" y1="3" x2="16" y2="21" />
      <line x1="21" y1="8" x2="3" y2="8" />
      <line x1="21" y1="16" x2="3" y2="16" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
};

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  filled?: boolean;
  style?: CSSProperties;
}

export function Icon({ name, size = 16, className, filled, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}
