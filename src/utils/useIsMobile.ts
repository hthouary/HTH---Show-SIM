import { useEffect, useState } from 'react';

/**
 * True when the viewport is phone-sized. Drives the switch between the desktop
 * multi-panel layout and the touch-first mobile shell. Updates live on resize /
 * orientation change via matchMedia.
 */
export function useIsMobile(query = '(max-width: 767px)'): boolean {
  const get = () => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false);
  const [mobile, setMobile] = useState(get);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMobile(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return mobile;
}
