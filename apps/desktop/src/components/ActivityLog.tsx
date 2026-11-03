interface ActivityLogProps {
  log: string[];
  showDebug: boolean;
  onToggleDebug: () => void;
}

export function ActivityLog({ log, showDebug, onToggleDebug }: ActivityLogProps) {
  if (log.length === 0) return null;

  const visibleLog = log.filter((line) => showDebug || !line.startsWith("[debug]"));
  const debugCount = log.filter((line) => line.startsWith("[debug]")).length;

  return (
    <section className="card">
      <div className="card-header">
        <h2>Actividad</h2>
        {debugCount > 0 && (
          <button className="btn back-btn" onClick={onToggleDebug}>
            {showDebug ? "Ocultar detalle" : "Ver detalle"}
          </button>
        )}
      </div>
      {visibleLog.length > 0 ? (
        <div className="log" role="log">
          {visibleLog.map((line, i) => (
            <div key={i} className="log-line">{line}</div>
          ))}
        </div>
      ) : (
        <p className="hint">
          Sin actividad visible. Usa “Ver detalle” para ver los logs internos.
        </p>
      )}
    </section>
  );
}
