import React, { useEffect, useRef, useState } from "react";
import { GitHubClient, sync, findOrphans, IDLE, actionLabel, summarizeSync } from "@filesync/core";
import type { ActionState, DriveClient, LocalFS, SyncSummary } from "@filesync/core";
import "./styles.css";

declare global {
  interface Window {
    fileSync: {
      getConfig: () => Promise<{ owner: string; repo: string; hasToken: boolean; syncDir: string } | null>;
      saveConfig: (config: { owner: string; repo: string; token: string; syncDir?: string }) => Promise<{ ok: boolean }>;
      getToken: () => Promise<string | null>;
      clearConfig: () => Promise<{ ok: boolean }>;
      chooseDir: () => Promise<{ canceled: boolean; syncDir?: string }>;
      listFiles: () => Promise<{ name: string; modifiedTime: number }[]>;
      listFolders: () => Promise<string[]>;
      readFile: (name: string) => Promise<string>;
      writeFile: (name: string, content: string) => Promise<void>;
      statFile: (name: string) => Promise<number>;
      setMtime: (name: string, modifiedTime: number) => Promise<void>;
      deleteFile: (name: string) => Promise<void>;
      createFolder: (name: string) => Promise<{ ok: boolean; error?: string }>;
    };
  }
}

interface LocalFile {
  name: string;
  modifiedTime: number;
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="empty-state">
      <svg className="empty-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 3h7l4 4v14H7V3Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M14 3v4h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M9.5 12h6M9.5 15h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <p className="empty-title">{title}</p>
      <p className="empty-hint">{hint}</p>
    </div>
  );
}

export default function App() {
  const [config, setConfig] = useState<{ owner: string; repo: string; hasToken: boolean; syncDir: string } | null>(null);
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [syncDir, setSyncDir] = useState("");
  const [localFiles, setLocalFiles] = useState<LocalFile[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<
    "push" | "pull" | "delete" | "delete-folder" | "orphans" | null
  >(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [lastFailedSync, setLastFailedSync] = useState<"push" | "pull" | null>(null);
  const runningRef = useRef(false);
  const busy = busyAction !== null;
  const [log, setLog] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string[] | null>(null);
  const [orphanConfirm, setOrphanConfirm] = useState<{ direction: "push" | "pull"; files: string[] } | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [deleteFolderConfirm, setDeleteFolderConfirm] = useState<string | null>(null);

  useEffect(() => {
    window.fileSync.getConfig().then((c) => {
      setConfig(c);
      if (c) {
        setOwner(c.owner);
        setRepo(c.repo);
        setSyncDir(c.syncDir);
      }
    });
    refreshLocal();
  }, []);

  async function refreshLocal() {
    const files = await window.fileSync.listFiles();
    const mdFiles = files.filter((f) => f.name.endsWith(".md"));
    setLocalFiles(mdFiles);
    const folderList = await window.fileSync.listFolders();
    setFolders(folderList);
  }

  function appendLog(msg: string) {
    setLog((prev) => [...prev, msg]);
  }

  async function handleSaveConfig() {
    setError(null);
    setLastFailedSync(null);
    setStatusMessage(null);
    if (!owner.trim() || !repo.trim() || !token.trim()) {
      setError("Completa owner, repo y token.");
      return;
    }
    const saved = await window.fileSync.saveConfig({ owner: owner.trim(), repo: repo.trim(), token: token.trim() });
    const updated = await window.fileSync.getConfig();
    setConfig(updated);
    if (updated) setSyncDir(updated.syncDir);
    setToken("");
    setShowToken(false);
  }

  async function handleDisconnect() {
    await window.fileSync.clearConfig();
    setConfig(null);
    setToken("");
    setShowToken(false);
    setError(null);
    setLastFailedSync(null);
    setStatusMessage(null);
  }

  async function handleChooseDir() {
    const result = await window.fileSync.chooseDir();
    if (!result.canceled && result.syncDir) {
      setSyncDir(result.syncDir);
      await refreshLocal();
    }
  }

  async function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    if (name.startsWith(".")) {
      setError("El nombre de la carpeta no puede empezar con un punto.");
      return;
    }
    setError(null);
    setLastFailedSync(null);
    const result = await window.fileSync.createFolder(name);
    if (!result.ok) {
      setError(result.error ?? "No se pudo crear la carpeta.");
      return;
    }
    setNewFolderName("");
    setShowCreateFolder(false);
    await refreshLocal();
  }

  async function confirmDeleteFolder() {
    if (!deleteFolderConfirm) return;
    const folder = deleteFolderConfirm;
    setDeleteFolderConfirm(null);
    setBusyAction("delete-folder");
    setError(null);
    setLastFailedSync(null);
    setStatusMessage(null);
    try {
      const token = await window.fileSync.getToken();
      if (!token || !config) throw new Error("Configura la conexión primero.");
      const client = new GitHubClient({ owner: config.owner, repo: config.repo, token });
      const filesInFolder = localFiles.filter((f) => f.name.startsWith(folder + "/"));
      for (const f of filesInFolder) {
        await client.delete(f.name);
      }
      await client.commitMeta();
      for (const f of filesInFolder) {
        await window.fileSync.deleteFile(f.name);
      }
      await window.fileSync.deleteFile(folder);
      appendLog(`Carpeta "${folder}" eliminada`);
      setStatusMessage(`Carpeta "${folder}" eliminada`);
      await refreshLocal();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusyAction(null);
    }
  }

  async function confirmDelete() {
    if (!deleteConfirm || deleteConfirm.length === 0) return;
    const names = [...deleteConfirm];
    setDeleteConfirm(null);
    setSelectedFiles([]);
    setBusyAction("delete");
    setError(null);
    setLastFailedSync(null);
    setStatusMessage(null);
    try {
      const token = await window.fileSync.getToken();
      if (!token || !config) throw new Error("Configura la conexión primero.");
      const client = new GitHubClient({ owner: config.owner, repo: config.repo, token });
      for (const name of names) {
        await client.delete(name);
      }
      await client.commitMeta();
      for (const name of names) {
        await window.fileSync.deleteFile(name);
      }
      appendLog(`Eliminados: ${names.join(", ")}`);
      setStatusMessage(`Eliminados: ${names.length} archivo${names.length === 1 ? "" : "s"}`);
      await refreshLocal();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusyAction(null);
    }
  }

  function toggleSelect(name: string) {
    setSelectedFiles((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  }

  function makeScopedAdapter(): LocalFS {
    const base: LocalFS = {
      list: () => window.fileSync.listFiles(),
      read: (name) => window.fileSync.readFile(name),
      write: (name, content) => window.fileSync.writeFile(name, content),
      stat: (name) => window.fileSync.statFile(name),
      setMtime: (name, modifiedTime) => window.fileSync.setMtime(name, modifiedTime),
      delete: (name) => window.fileSync.deleteFile(name),
    };
    if (!currentFolder) return base;
    return {
      ...base,
      list: async () => {
        const all = await base.list();
        return all.filter((f) => f.name.startsWith(currentFolder + "/"));
      },
    };
  }

  function makeScopedClient(client: GitHubClient): DriveClient {
    if (!currentFolder) return client;
    const prefix = currentFolder + "/";
    return {
      listFiles: async () => {
        const all = await client.listFiles();
        return all.filter((f) => f.name.startsWith(prefix));
      },
      upload: client.upload.bind(client),
      download: client.download.bind(client),
      touch: client.touch.bind(client),
      delete: client.delete.bind(client),
      commitMeta: client.commitMeta.bind(client),
    };
  }

  async function runSync(direction: "push" | "pull") {
    if (runningRef.current) return;
    runningRef.current = true;
    setBusyAction(direction);
    setError(null);
    setStatusMessage(null);
    setLastFailedSync(null);
    setLog([]);
    try {
      const token = await window.fileSync.getToken();
      if (!token || !config) throw new Error("Configura la conexión primero.");
      const client = new GitHubClient({ owner: config.owner, repo: config.repo, token });
      const fsAdapter = makeScopedAdapter();
      const scopedClient = makeScopedClient(client);
      const orphans = await findOrphans(scopedClient, fsAdapter, direction);
      if (orphans.length > 0) {
        setOrphanConfirm({ direction, files: orphans });
        return;
      }
      const summary = await doSync(scopedClient, fsAdapter, direction);
      setStatusMessage(summarizeSync(direction, summary));
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.includes("TOKEN")) {
        setError("Token inválido o expirado. Verifica tu token en la configuración.");
      } else {
        setError(msg);
      }
      setLastFailedSync(direction);
    } finally {
      runningRef.current = false;
      setBusyAction(null);
    }
  }

  async function doSync(
    client: DriveClient,
    fsAdapter: LocalFS,
    direction: "push" | "pull",
  ): Promise<SyncSummary> {
    const s = sync(client, fsAdapter, { onLog: appendLog });
    const summary = direction === "push" ? await s.push() : await s.pull();
    appendLog("--- Resumen ---");
    appendLog(`Subidos: ${summary.uploaded.length}, Descargados: ${summary.downloaded.length}`);
    appendLog(`Conflictos: ${summary.conflicts.length}, Sin cambios: ${summary.skipped.length}`);
    await refreshLocal();
    return summary;
  }

  async function confirmOrphans() {
    if (!orphanConfirm || runningRef.current) return;
    const { direction, files } = orphanConfirm;
    runningRef.current = true;
    setOrphanConfirm(null);
    setBusyAction("orphans");
    setError(null);
    setLastFailedSync(null);
    setStatusMessage(null);
    try {
      const token = await window.fileSync.getToken();
      if (!token || !config) throw new Error("Configura la conexión primero.");
      const client = new GitHubClient({ owner: config.owner, repo: config.repo, token });
      const fsAdapter = makeScopedAdapter();
      const scopedClient = makeScopedClient(client);
      for (const name of files) {
        if (direction === "push") {
          await scopedClient.delete(name);
          appendLog(`Eliminado de GitHub: "${name}"`);
        } else {
          await fsAdapter.delete(name);
          appendLog(`Eliminado local: "${name}"`);
        }
      }
      if (direction === "push") await scopedClient.commitMeta();
      const summary = await doSync(scopedClient, fsAdapter, direction);
      setStatusMessage(summarizeSync(direction, summary));
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      runningRef.current = false;
      setBusyAction(null);
    }
  }

  function enterFolder(folder: string) {
    setCurrentFolder(folder);
    setSelectedFiles([]);
  }

  function goToRoot() {
    setCurrentFolder(null);
    setSelectedFiles([]);
  }

  const rootFiles = localFiles.filter((f) => !f.name.includes("/"));
  const folderFiles = currentFolder
    ? localFiles.filter((f) => f.name.startsWith(currentFolder + "/"))
    : [];
  const pushState: ActionState = busyAction === "push" ? { status: "loading" } : IDLE;
  const pullState: ActionState = busyAction === "pull" ? { status: "loading" } : IDLE;
  const visibleLog = log.filter((line) => showDebug || !line.startsWith("[debug]"));
  const debugCount = log.filter((line) => line.startsWith("[debug]")).length;

  return (
    <div className="app">
      <header className="header">
        <h1>FileSync</h1>
      </header>

      <section className="card">
        <div className="card-header">
          <h2>Conexión GitHub</h2>
          {config && (
            <button className="btn danger" onClick={handleDisconnect}>
              Desconectar
            </button>
          )}
        </div>
        {config ? (
          <p className="hint">
            Conectado a <code>{config.owner}/{config.repo}</code>
          </p>
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
                  onChange={(e) => setOwner(e.target.value)}
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
                  onChange={(e) => setRepo(e.target.value)}
                />
              </div>
              <div className="field">
                <div className="field-label-row">
                  <label className="field-label" htmlFor="github-token">Token de GitHub</label>
                  <button
                    type="button"
                    className="field-action"
                    onClick={() => setShowToken((value) => !value)}
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
                  onChange={(e) => setToken(e.target.value)}
                />
                <p className="field-help">Necesita scope repo. No se comparte.</p>
              </div>
              <button className="btn primary" onClick={handleSaveConfig}>
                Guardar conexión
              </button>
            </div>
          </>
        )}
        {error && !lastFailedSync && <p className="error" role="alert">{error}</p>}
      </section>

      {config && (
        <>
          <section className="card">
            <h2>Carpeta de sincronización</h2>
            <p className="hint">{syncDir}</p>
            <button className="btn" onClick={handleChooseDir}>
              Cambiar carpeta
            </button>
          </section>

          <section className="card" aria-busy={busy}>
            <div className="actions">
              <button className="btn primary" data-testid="btn-push" disabled={busy} onClick={() => runSync("push")}>
                {actionLabel(pushState, "Subir a GitHub", "Subiendo...")}
              </button>
              <button className="btn primary" data-testid="btn-pull" disabled={busy} onClick={() => runSync("pull")}>
                {actionLabel(pullState, "Descargar de GitHub", "Descargando...")}
              </button>
            </div>
            {statusMessage && <p className="success" role="status">{statusMessage}</p>}
            {error && lastFailedSync && (
              <div className="error-row">
                <p className="error" role="alert">{error}</p>
                <button className="btn" data-testid="btn-retry" disabled={busy} onClick={() => runSync(lastFailedSync)}>
                  Reintentar
                </button>
              </div>
            )}
            {currentFolder && (
              <p className="hint">Sincronizando solo la carpeta: <code>{currentFolder}</code></p>
            )}
          </section>

          <section className="card">
            <div className="card-header">
              <h2>
                {currentFolder ? (
                  <>
                    <button className="btn back-btn" onClick={goToRoot}>
                      <svg className="icon-sm" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="m15 18-6-6 6-6"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Volver
                    </button>
                    <span>{currentFolder}</span>
                  </>
                ) : (
                  <span>Archivos locales (.md)</span>
                )}
              </h2>
              {!currentFolder && (
                <button className="btn" onClick={() => setShowCreateFolder(true)}>
                  <svg className="icon-sm" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M12 5v14M5 12h14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  Nueva carpeta
                </button>
              )}
            </div>

            {showCreateFolder && (
              <div className="create-folder-row">
                <input
                  className="input"
                  aria-label="Nombre de la carpeta"
                  placeholder="Nombre de la carpeta"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                />
                <button className="btn primary" onClick={handleCreateFolder}>
                  Crear
                </button>
                <button className="btn" onClick={() => setShowCreateFolder(false)}>
                  Cancelar
                </button>
              </div>
            )}

            {!currentFolder && folders.length > 0 && (
              <div className="folder-grid">
                {folders.map((folder) => (
                  <div key={folder} className="folder-card">
                    <button
                      className="folder-open"
                      onClick={() => enterFolder(folder)}
                      aria-label={`Abrir carpeta ${folder}`}
                    >
                      <svg className="folder-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M3 6.5A2.5 2.5 0 0 1 5.5 4H9l2 2h7.5A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-10Z"
                          fill="currentColor"
                        />
                      </svg>
                      <span className="folder-name">{folder}</span>
                      <svg className="folder-chevron" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="m9 6 6 6-6 6"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <button
                      className="folder-delete"
                      aria-label={`Eliminar carpeta ${folder}`}
                      onClick={() => setDeleteFolderConfirm(folder)}
                    >
                      <svg className="icon-trash" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-3 6h12l-1 12H7L6 9Z" fill="currentColor" />
                      </svg>
                      <span>Eliminar</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {currentFolder ? (
              folderFiles.length === 0 ? (
                <EmptyState
                  title="Esta carpeta está vacía"
                  hint="Añade un archivo .md a esta carpeta o vuelve a la raíz."
                />
              ) : (
                <ul className="file-list">
                  {folderFiles.map((f) => (
                    <li key={f.name}>
                      <label className="file-row">
                        <input
                          type="checkbox"
                          className="file-checkbox"
                          checked={selectedFiles.includes(f.name)}
                          onChange={() => toggleSelect(f.name)}
                        />
                        <span className="file-name">{f.name.slice(currentFolder.length + 1)}</span>
                        <span className="muted">{new Date(f.modifiedTime).toLocaleString()}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )
            ) : rootFiles.length === 0 && folders.length === 0 ? (
              <EmptyState
                title="No hay notas todavía"
                hint="Crea un archivo .md en la carpeta de sincronización y pulsa Subir a GitHub."
              />
            ) : rootFiles.length > 0 ? (
              <ul className="file-list">
                {rootFiles.map((f) => (
                  <li key={f.name}>
                    <label className="file-row">
                      <input
                        type="checkbox"
                        className="file-checkbox"
                        checked={selectedFiles.includes(f.name)}
                        onChange={() => toggleSelect(f.name)}
                      />
                      <span className="file-name">{f.name}</span>
                      <span className="muted">{new Date(f.modifiedTime).toLocaleString()}</span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No hay archivos en la raíz"
                hint="Entra a una carpeta o crea un archivo .md en la carpeta de sincronización."
              />
            )}

            {selectedFiles.length > 0 && (
              <div className="delete-bar">
                <button className="btn danger" disabled={busy} onClick={() => setDeleteConfirm([...selectedFiles])}>
                  Eliminar seleccionados ({selectedFiles.length})
                </button>
              </div>
            )}
          </section>

          {log.length > 0 && (
            <section className="card">
              <div className="card-header">
                <h2>Actividad</h2>
                {debugCount > 0 && (
                  <button className="btn back-btn" onClick={() => setShowDebug((value) => !value)}>
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
          )}
        </>
      )}

      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Eliminar archivos">
            <h3>Eliminar {deleteConfirm.length} archivo{deleteConfirm.length > 1 ? "s" : ""}</h3>
            <p>Se eliminarán de la carpeta local y de GitHub. Esta acción no se puede deshacer.</p>
            <ul className="orphan-list">
              {deleteConfirm.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <div className="modal-actions">
              <button className="btn" onClick={() => setDeleteConfirm(null)} disabled={busy}>
                Cancelar
              </button>
              <button className="btn danger" onClick={confirmDelete} disabled={busy}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteFolderConfirm && (
        <div className="modal-overlay">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Eliminar carpeta">
            <h3>Eliminar carpeta</h3>
            <p>
              Se eliminarán la carpeta <code>{deleteFolderConfirm}</code> y todos sus archivos de la carpeta
              local y de GitHub. Esta acción no se puede deshacer.
            </p>
            <div className="modal-actions">
              <button className="btn" onClick={() => setDeleteFolderConfirm(null)} disabled={busy}>
                Cancelar
              </button>
              <button className="btn danger" onClick={confirmDeleteFolder} disabled={busy}>
                Eliminar carpeta
              </button>
            </div>
          </div>
        </div>
      )}

      {orphanConfirm && (
        <div className="modal-overlay">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Sincronizar eliminaciones">
            <h3>Sincronizar eliminaciones</h3>
            <p>
              {orphanConfirm.direction === "push"
                ? "Estos archivos existen en GitHub pero no en tu carpeta local. Se eliminarán de GitHub."
                : "Estos archivos existen en tu carpeta local pero no en GitHub. Se eliminarán de tu carpeta."}
            </p>
            <ul className="orphan-list">
              {orphanConfirm.files.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <div className="modal-actions">
              <button className="btn" onClick={() => setOrphanConfirm(null)} disabled={busy}>
                No, solo sincronizar
              </button>
              <button className="btn danger" onClick={confirmOrphans} disabled={busy}>
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
