import { useShowStore } from '../store/useShowStore';
import { translate } from './translations';

/** Hook returning a translator bound to the current language. */
export function useT() {
  const lang = useShowStore((s) => s.language);
  return (key: string, params?: Record<string, string | number>) => translate(lang, key, params);
}
