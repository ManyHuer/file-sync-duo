import type { AppConfig } from "../types";

interface ConnectionCardProps {
  config: AppConfig | null;
  owner: string;
  repo: string;
  token: string;
  showToken: boolean;
  error: string | null;
  hasFailedSync: boolean;
  onOwnerChange: (value: string) => void;
  onRepoChange: (value: string) => void;
  onTokenChange: (value: string) => void;
  onToggleToken: () => void;
  onSave: () => void;
  onDisconnect: () => void;
}

export function ConnectionCard({
  config,
  owner,
  repo,
  token,
  showToken,
  error,
  hasFailedSync,
  onOwnerChange,
  onRepoChange,
  onTokenChange,
  onToggleToken,
  onSave,
  onDisconnect,
}: ConnectionCardProps) {
  return (
    <section className="card">
      <div className="card-header">
        <h2>Conexión GitHub</h2>
        {config && (
          <button className="btn danger" onClick={onDisconnect}>
            Desconectar
          </button>
        )}
      </div>
      {config ? (
        <div className="connection-status">
          <span className="status-dot connection-dot" aria-hidden="true" />
          <span>Conectado</span>
          <code>{config.owner}/{config.repo}</code>
        </div>
      ) : (
        <>
          <p className="hint">Configura tu repo de GitHub para sincronizar archivos .md.</p>
          <div className="form">
            <div className="field">
              <label className="field-label" htmlFor="github-owner">Usuario de GitHub</label>
              <input
                id="github-owner"
                name="owner"
                className="input"
                placeholder="tu-usuario"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={owner}
                onChange={(e) => onOwnerChange(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="github-repo">Repositorio</label>
              <input
                id="github-repo"
                name="repo"
                className="input"
                placeholder="mis-notas"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={repo}
                onChange={(e) => onRepoChange(e.target.value)}
              />
            </div>
            <div className="field">
              <div className="field-label-row">
                <label className="field-label" htmlFor="github-token">Token de GitHub</label>
                <button
                  type="button"
                  className="field-action"
                  onClick={onToggleToken}
                >
                  {showToken ? "Ocultar" : "Mostrar"}
                </button>
              </div>
              <input
                id="github-token"
                name="token"
                className="input"
                type={showToken ? "text" : "password"}
                placeholder="ghp_..."
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={token}
                onChange={(e) => onTokenChange(e.target.value)}
              />
              <p className="field-help">Necesita scope repo. No se comparte.</p>
            </div>
            <button className="btn primary" onClick={onSave}>
              Guardar conexión
            </button>
          </div>
        </>
      )}
      {error && !hasFailedSync && <p className="error" role="alert">{error}</p>}
    </section>
  );
}
