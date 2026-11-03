import { useEffect, useRef, useState } from "react";
import { GitHubClient, sync, findOrphans, IDLE, summarizeSync } from "@filesync/core";
import type { ActionState, DriveClient, LocalFS, SyncSummary } from "@filesync/core";
import type { AppConfig, BusyAction, LocalFile, SyncDirection } from "./types";
import { directChildFolders, directFiles, joinPath, parentPath } from "./paths";
import { ActivityLog } from "./components/ActivityLog";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { ConnectionCard } from "./components/ConnectionCard";
import { FileBrowser } from "./components/FileBrowser";
import { SyncActionsCard } from "./components/SyncActionsCard";
import "./styles.css";

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [syncDir, setSyncDir] = useState("");
  const [localFiles, setLocalFiles] = useState<LocalFile[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [lastFailedSync, setLastFailedSync] = useState<SyncDirection | null>(null);
  const runningRef = useRef(false);
  const busy = busyAction !== null;
  const [log, setLog] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string[] | null>(null);
  const [orphanConfirm, setOrphanConfirm] = useState<{ direction: SyncDirection; files: string[] } | null>(null);
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
    if (name.split("/").some((segment) => !segment || segment.startsWith("."))) {
      setError("El nombre de la carpeta no puede empezar con un punto ni contener segmentos vacíos.");
      return;
    }
    setError(null);
    setLastFailedSync(null);
    const result = await window.fileSync.createFolder(joinPath(currentFolder, name));
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

  async function runSync(direction: SyncDirection) {
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
    direction: SyncDirection,
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

  function goToParent() {
    setCurrentFolder((current) => parentPath(current));
    setSelectedFiles([]);
  }

  function goToRoot() {
    setCurrentFolder(null);
    setSelectedFiles([]);
  }

  const rootFiles = directFiles(localFiles, null);
  const folderFiles = directFiles(localFiles, currentFolder);
  const visibleFolders = directChildFolders(folders, currentFolder);
  const pushState: ActionState = busyAction === "push" ? { status: "loading" } : IDLE;
  const pullState: ActionState = busyAction === "pull" ? { status: "loading" } : IDLE;

  return (
    <div className="app">
      <header className="header">
        <h1>FileSync</h1>
      </header>

      <ConnectionCard
        config={config}
        owner={owner}
        repo={repo}
        token={token}
        showToken={showToken}
        error={error}
        hasFailedSync={!!lastFailedSync}
        onOwnerChange={setOwner}
        onRepoChange={setRepo}
        onTokenChange={setToken}
        onToggleToken={() => setShowToken((value) => !value)}
        onSave={handleSaveConfig}
        onDisconnect={handleDisconnect}
      />

      {config && (
        <>
          <section className="card">
            <h2>Carpeta de sincronización</h2>
            <p className="hint">{syncDir}</p>
            <button className="btn" onClick={handleChooseDir}>
              Cambiar carpeta
            </button>
          </section>

          <SyncActionsCard
            busy={busy}
            busyAction={busyAction}
            pushState={pushState}
            pullState={pullState}
            statusMessage={statusMessage}
            error={error}
            lastFailedSync={lastFailedSync}
            currentFolder={currentFolder}
            onSync={runSync}
          />

          <FileBrowser
            currentFolder={currentFolder}
            folders={visibleFolders}
            rootFiles={rootFiles}
            folderFiles={folderFiles}
            selectedFiles={selectedFiles}
            showCreateFolder={showCreateFolder}
            newFolderName={newFolderName}
            busy={busy}
            onEnterFolder={enterFolder}
            onGoToParent={goToParent}
            onGoToRoot={goToRoot}
            onToggleSelect={toggleSelect}
            onShowCreateFolder={setShowCreateFolder}
            onNewFolderNameChange={setNewFolderName}
            onCreateFolder={handleCreateFolder}
            onAskDeleteFolder={setDeleteFolderConfirm}
            onAskDelete={setDeleteConfirm}
          />

          <ActivityLog log={log} showDebug={showDebug} onToggleDebug={() => setShowDebug((value) => !value)} />
        </>
      )}

      {deleteConfirm && (
        <ConfirmDialog
          ariaLabel="Eliminar archivos"
          title={`Eliminar ${deleteConfirm.length} archivo${deleteConfirm.length > 1 ? "s" : ""}`}
          description="Se eliminarán de la carpeta local y de GitHub. Esta acción no se puede deshacer."
          items={deleteConfirm}
          confirmLabel="Eliminar"
          onCancel={() => setDeleteConfirm(null)}
          onConfirm={confirmDelete}
          busy={busy}
        />
      )}

      {deleteFolderConfirm && (
        <ConfirmDialog
          ariaLabel="Eliminar carpeta"
          title="Eliminar carpeta"
          description={
            <>
              Se eliminarán la carpeta <code>{deleteFolderConfirm}</code> y todos sus archivos de la carpeta
              local y de GitHub. Esta acción no se puede deshacer.
            </>
          }
          confirmLabel="Eliminar carpeta"
          onCancel={() => setDeleteFolderConfirm(null)}
          onConfirm={confirmDeleteFolder}
          busy={busy}
        />
      )}

      {orphanConfirm && (
        <ConfirmDialog
          ariaLabel="Sincronizar eliminaciones"
          title="Sincronizar eliminaciones"
          description={
            orphanConfirm.direction === "push"
              ? "Estos archivos existen en GitHub pero no en tu carpeta local. Se eliminarán de GitHub."
              : "Estos archivos existen en tu carpeta local pero no en GitHub. Se eliminarán de tu carpeta."
          }
          items={orphanConfirm.files}
          cancelLabel="No, solo sincronizar"
          confirmLabel="Sí, eliminar"
          onCancel={() => setOrphanConfirm(null)}
          onConfirm={confirmOrphans}
          busy={busy}
        />
      )}
    </div>
  );
}
