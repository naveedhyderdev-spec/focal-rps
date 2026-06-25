export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--gray-400)' }}>
      <i className="ti ti-loader-2" style={{ fontSize: 28, animation: 'spin 1s linear infinite', display: 'inline-block' }} />
      <div style={{ marginTop: 8, fontSize: 'var(--text-sm)' }}>{label}</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
