import { useShowStore } from '../../store/useShowStore';
import { Modal } from './Modal';
import { Icon, type IconName } from './Icon';
import { useT } from '../../i18n/useT';

/** One illustrated row in the guide. */
function Step({ icon, title, body, accent }: { icon: IconName; title: string; body: string; accent: string }) {
  return (
    <div className="flex gap-3">
      <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg ${accent}`}>
        <Icon name={icon} size={18} />
      </span>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-100">{title}</div>
        <div className="text-xs leading-relaxed text-slate-400">{body}</div>
      </div>
    </div>
  );
}

/**
 * Friendly welcome / how-to guide. Opens on first run and from the "?" button.
 * Explains the two modes and the three core actions in plain language, so a
 * first-time user knows exactly what to click.
 */
export function HelpModal() {
  const open = useShowStore((s) => s.helpOpen);
  const setHelpOpen = useShowStore((s) => s.setHelpOpen);
  const setAppMode = useShowStore((s) => s.setAppMode);
  const t = useT();
  if (!open) return null;

  const close = () => setHelpOpen(false);
  const goBuild = () => {
    setAppMode('build');
    close();
  };

  return (
    <Modal title={t('help.title')} onClose={close} width={520}>
      <div className="flex flex-col gap-5">
        <p className="text-sm text-slate-300">{t('help.intro')}</p>

        {/* The two modes */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-accent-cyan/30 bg-accent-cyan/5 p-3">
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-accent-cyan">
              <Icon name="box" size={15} /> {t('mode.build')}
            </div>
            <p className="text-xs leading-relaxed text-slate-400">{t('help.build')}</p>
          </div>
          <div className="rounded-xl border border-accent-violet/30 bg-accent-violet/5 p-3">
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-accent-violet">
              <Icon name="play" size={15} filled /> {t('mode.show')}
            </div>
            <p className="text-xs leading-relaxed text-slate-400">{t('help.show')}</p>
          </div>
        </div>

        {/* Core actions */}
        <div className="flex flex-col gap-3 border-t border-ink-700/70 pt-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t('help.stepsTitle')}</div>
          <Step icon="plus" accent="bg-accent-cyan/15 text-accent-cyan" title={t('help.step1.title')} body={t('help.step1.body')} />
          <Step icon="target" accent="bg-accent-violet/15 text-accent-violet" title={t('help.step2.title')} body={t('help.step2.body')} />
          <Step icon="play" accent="bg-accent-magenta/15 text-accent-magenta" title={t('help.step3.title')} body={t('help.step3.body')} />
        </div>

        {/* Handy shortcuts */}
        <div className="rounded-lg border border-ink-700/70 bg-ink-850 p-3 text-[11px] text-slate-400">
          <span className="font-semibold text-slate-300">{t('help.tipsTitle')} </span>
          {t('help.tips')}
        </div>

        <div className="flex justify-end gap-2 border-t border-ink-700/70 pt-4">
          <button className="btn flex-1 justify-center sm:flex-none" onClick={close}>
            {t('common.close')}
          </button>
          <button className="btn btn-accent flex-1 justify-center sm:flex-none" onClick={goBuild}>
            <Icon name="box" size={14} /> {t('help.startBuilding')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
