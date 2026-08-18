import React, { useEffect, useState } from "react";
import { GitHubClient, sync, findOrphans } from "@filesync/core";
import type { DriveClient, LocalFS } from "@filesync/core";
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

export default function App() {
  const [config, setConfig] = useState<{ owner: string; repo: string; hasToken: boolean; syncDir: string } | null>(null);
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [token, setToken] = useState("");
  const [syncDir, setSyncDir] = useState("");
  const [localFiles, setLocalFiles] = useState<LocalFile[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
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
    if (!owner.trim() || !repo.trim() || !token.trim()) {
      setError("Completa owner, repo y token.");
      return;
    }
    const saved = await window.fileSync.saveConfig({ owner: owner.trim(), repo: repo.trim(), token: token.trim() });
    const updated = await window.fileSync.getConfig();
    setConfig(updated);
    if (updated) setSyncDir(updated.syncDir);
    setToken("");
  }

  async function handleDisconnect() {
    await window.fileSync.clearConfig();
    setConfig(null);
    setToken("");
    setError(null);
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
    setBusy(true);
    setError(null);
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
      await refreshLocal();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteConfirm || deleteConfirm.length === 0) return;
    const names = [...deleteConfirm];
    setDeleteConfirm(null);
    setSelectedFiles([]);
    setBusy(true);
    setError(null);
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
      await refreshLocal();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
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
    setBusy(true);
    setError(null);
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
      await doSync(scopedClient, fsAdapter, direction);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.includes("TOKEN")) {
        setError("Token inválido o expirado. Verifica tu token en la configuración.");
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  async function doSync(client: DriveClient, fsAdapter: LocalFS, direction: "push" | "pull") {
    const s = sync(client, fsAdapter, { onLog: appendLog });
    const summary = direction === "push" ? await s.push() : await s.pull();
    appendLog("--- Resumen ---");
    appendLog(`Subidos: ${summary.uploaded.length}, Descargados: ${summary.downloaded.length}`);
    appendLog(`Conflictos: ${summary.conflicts.length}, Sin cambios: ${summary.skipped.length}`);
    await refreshLocal();
  }

  async function confirmOrphans() {
    if (!orphanConfirm) return;
    const { direction, files } = orphanConfirm;
    setOrphanConfirm(null);
    setBusy(true);
    setError(null);
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
      await doSync(scopedClient, fsAdapter, direction);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
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
              <input
                className="input"
                placeholder="Owner (usuario de GitHub)"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
              />
              <input
                className="input"
                placeholder="Repo (nombre del repositorio)"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
              />
              <input
                className="input"
                type="password"
                placeholder="Personal Access Token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <button className="btn primary" onClick={handleSaveConfig}>
                Guardar conexión
              </button>
            </div>
          </>
        )}
        {error && <p className="error">{error}</p>}
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

          <section className="card">
            <div className="actions">
              <button className="btn primary" disabled={busy} onClick={() => runSync("push")}>
                Subir a GitHub
              </button>
              <button className="btn primary" disabled={busy} onClick={() => runSync("pull")}>
                Descargar de GitHub
              </button>
            </div>
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
                      ← Volver
                    </button>
                    <span>📁 {currentFolder}</span>
                  </>
                ) : (
                  <span>Archivos locales (.md)</span>
                )}
              </h2>
              {!currentFolder && (
                <button className="btn" onClick={() => setShowCreateFolder(true)}>
                  + Nueva carpeta
                </button>
              )}
            </div>

            {showCreateFolder && (
              <div className="create-folder-row">
                <input
                  className="input"
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
                  <div key={folder} className="folder-card" onClick={() => enterFolder(folder)}>
                    <span className="folder-icon">📁</span>
                    <span className="folder-name">{folder}</span>
                    <button
                      className="btn danger folder-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteFolderConfirm(folder);
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            )}

            {currentFolder ? (
              folderFiles.length === 0 ? (
                <p className="hint">Esta carpeta está vacía.</p>
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
              <p className="hint">
                No hay archivos .md en la carpeta FileSync. Crea uno y pulsa "Subir a GitHub".
              </p>
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
              <p className="hint">No hay archivos en la raíz.</p>
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
              <h2>Actividad</h2>
              <div className="log">
                {log.map((line, i) => (
                  <div key={i} className="log-line">{line}</div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal">
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
          <div className="modal">
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
          <div className="modal">
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
