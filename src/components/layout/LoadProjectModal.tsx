import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Icon } from '../ui/Icon';
import { deleteProject, listProjects } from '../../utils/project';
import { useShowStore } from '../../store/useShowStore';
import { useT } from '../../i18n/useT';

export function LoadProjectModal({ onClose }: { onClose: () => void }) {
  const [projects, setProjects] = useState(() => listProjects());
  const loadById = useShowStore((s) => s.loadProjectById);
  const currentId = useShowStore((s) => s.project.id);
  const t = useT();

  const refresh = () => setProjects(listProjects());

  return (
    <Modal title={t('load.title')} onClose={onClose} width={480}>
      {projects.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500">
          <Icon name="folder" size={28} className="mx-auto mb-2 opacity-50" />
          {t('load.empty')}
          <div className="mt-1 text-xs text-slate-600">{t('load.emptyHint')}</div>
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {projects.map((p) => (
            <li
              key={p.id}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                p.id === currentId
                  ? 'border-accent-cyan/40 bg-accent-cyan/5'
                  : 'border-ink-700 bg-ink-800 hover:border-ink-600'
              }`}
            >
              <Icon name="file" size={18} className="text-slate-400" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-100">{p.name}</div>
                <div className="text-[11px] text-slate-500">
                  {new Date(p.updatedAt).toLocaleString()}
                  {p.id === currentId && <span className="ml-2 text-accent-cyan">• {t('load.current')}</span>}
                </div>
              </div>
              <button
                className="btn btn-accent h-7"
                onClick={() => {
                  loadById(p.id);
                  onClose();
                }}
              >
                {t('action.open')}
              </button>
              <button
                className="btn-ghost btn-danger h-7 w-7 px-0"
                title={t('load.delete.title')}
                onClick={() => {
                  if (confirm(t('load.delete.confirm', { name: p.name }))) {
                    deleteProject(p.id);
                    refresh();
                  }
                }}
              >
                <Icon name="trash" size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
