import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Icon } from './Icon';
import { useT } from '../../i18n/useT';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}

export function Modal({ title, onClose, children, footer, width = 460 }: ModalProps) {
  const t = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="panel rounded-xl shadow-panel"
        style={{ width }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-700/70 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
          <button className="btn-ghost h-7 w-7 px-0" onClick={onClose} aria-label={t('common.close')}>
            <Icon name="close" size={15} />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-ink-700/70 px-4 py-3">{footer}</div>}
      </div>
    </div>
  );
}
