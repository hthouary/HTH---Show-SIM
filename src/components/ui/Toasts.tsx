import { useShowStore } from '../../store/useShowStore';
import { Icon } from './Icon';

const KIND_STYLES: Record<string, string> = {
  info: 'border-accent-blue/40 text-slate-200',
  success: 'border-accent-cyan/50 text-accent-cyan',
  error: 'border-rose-500/50 text-rose-300',
};

export function Toasts() {
  const toasts = useShowStore((s) => s.toasts);
  const dismiss = useShowStore((s) => s.dismissToast);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`panel pointer-events-auto flex items-center gap-2 rounded-lg border px-3 py-2 text-xs shadow-panel ${KIND_STYLES[t.kind]}`}
          onClick={() => dismiss(t.id)}
        >
          <Icon name={t.kind === 'error' ? 'close' : t.kind === 'success' ? 'sparkles' : 'eye'} size={14} />
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
