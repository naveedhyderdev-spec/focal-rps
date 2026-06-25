import { useAppStore } from '../../store/appStore';

const ICONS: Record<string, string> = {
  success: 'ti-circle-check',
  warning: 'ti-alert-triangle',
  danger: 'ti-alert-circle',
  info: 'ti-info-circle',
};

export function Toaster() {
  const toasts = useAppStore((s) => s.toasts);
  const dismiss = useAppStore((s) => s.dismissToast);
  return (
    <div id="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast show ${t.kind}`}>
          <i className={`ti ${ICONS[t.kind] ?? ICONS.info}`} />
          <span className="toast-msg">{t.message}</span>
          <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
            <i className="ti ti-x" />
          </button>
        </div>
      ))}
    </div>
  );
}
