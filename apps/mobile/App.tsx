import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { View, ScrollView, Text } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { GitHubClient, sync, findOrphans, IDLE, summarizeSync } from '@filesync/core';
import type { ActionState, DriveClient, LocalFileMeta, LocalFS, SyncSummary } from '@filesync/core';
import { styles } from './src/styles';
import {
  CONFIG_KEY,
  SAF_URI_KEY,
  localFs,
  safCreateFolder,
  safEnsureDir,
  safListFolders,
  safWrite,
  storage,
} from './src/storage';
import type { AppConfig } from './src/storage';
import { ActivityLog } from './src/components/ActivityLog';
import { ConfirmDialog } from './src/components/ConfirmDialog';
import type { ConfirmModalState } from './src/components/ConfirmDialog';
import { ConnectionCard } from './src/components/ConnectionCard';
import { ConnectionForm } from './src/components/ConnectionForm';
import { CreateNoteRow } from './src/components/CreateNoteRow';
import { FileList } from './src/components/FileList';
import { FoldersSection } from './src/components/FoldersSection';
import { StorageSection } from './src/components/StorageSection';
import { SyncActions } from './src/components/SyncActions';

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [localFiles, setLocalFiles] = useState<LocalFileMeta[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<
    'push' | 'pull' | 'delete' | 'delete-folder' | 'orphans' | null
  >(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [lastFailedSync, setLastFailedSync] = useState<'push' | 'pull' | null>(null);
  const runningRef = useRef(false);
  const busy = busyAction !== null;
  const [logs, setLogs] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [usingSaf, setUsingSaf] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);

  useEffect(() => {
    (async () => {
      await safEnsureDir();
      const [raw, safUri] = await Promise.all([
        SecureStore.getItemAsync(CONFIG_KEY),
        SecureStore.getItemAsync(SAF_URI_KEY),
      ]);
      if (safUri) {
        storage.safUri = safUri;
        setUsingSaf(true);
      }
      if (raw) {
        const c = JSON.parse(raw) as AppConfig;
        setConfig(c);
        setOwner(c.owner);
        setRepo(c.repo);
      }
      refreshLocal();
    })();
  }, []);

  async function refreshLocal() {
    await safEnsureDir();
    const files = await localFs.list();
    setLocalFiles(files.filter((f) => f.name.endsWith('.md')));
    const folderList = await safListFolders();
    setFolders(folderList);
  }

  function appendLog(msg: string) {
    setLogs((prev) => [...prev, msg]);
  }

  function makeScopedClient(client: GitHubClient): DriveClient {
    if (!currentFolder) return client;
    const prefix = currentFolder + '/';
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

  function makeScopedLocalFs(): LocalFS {
    if (!currentFolder) return localFs;
    const prefix = currentFolder + '/';
    return {
      list: async () => {
        const all = await localFs.list();
        return all.filter((f) => f.name.startsWith(prefix));
      },
      read: localFs.read,
      write: localFs.write,
      stat: localFs.stat,
      setMtime: localFs.setMtime,
      delete: localFs.delete,
    };
  }

  function getSyncContext() {
    if (!config) throw new Error('Configura la conexión primero.');
    const client = new GitHubClient(config);
    return {
      scopedClient: makeScopedClient(client),
      scopedFs: makeScopedLocalFs(),
    };
  }

  async function handleSaveConfig() {
    setError(null);
    setLastFailedSync(null);
    setStatusMessage(null);
    if (!owner.trim() || !repo.trim() || !token.trim()) {
      setError('Completa owner, repo y token.');
      return;
    }
    const c = { owner: owner.trim(), repo: repo.trim(), token: token.trim() };
    await SecureStore.setItemAsync(CONFIG_KEY, JSON.stringify(c));
    setConfig(c);
    setToken('');
    setShowToken(false);
  }

  async function handleLogout() {
    await SecureStore.deleteItemAsync(CONFIG_KEY);
    setConfig(null);
    setError(null);
    setLastFailedSync(null);
    setStatusMessage(null);
    setShowToken(false);
  }

  async function handlePickFolder() {
    setError(null);
    setLastFailedSync(null);
    try {
      const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (permissions.granted && permissions.directoryUri) {
        storage.safUri = permissions.directoryUri;
        await SecureStore.setItemAsync(SAF_URI_KEY, permissions.directoryUri);
        setUsingSaf(true);
        setStatusMessage('Carpeta seleccionada. Los archivos se guardarán ahí.');
        await refreshLocal();
      }
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  async function handleResetFolder() {
    storage.safUri = null;
    await SecureStore.deleteItemAsync(SAF_URI_KEY);
    setUsingSaf(false);
    await refreshLocal();
  }

  function handleSyncError(e: unknown, direction?: 'push' | 'pull') {
    const msg = String((e as any)?.message ?? e);
    const friendly = msg.includes('TOKEN')
      ? 'Token inválido o expirado. Verifica tu token en la configuración.'
      : msg;
    setError(friendly);
    if (direction) setLastFailedSync(direction);
  }

  async function runSync(direction: 'push' | 'pull') {
    if (!config || runningRef.current) return;
    runningRef.current = true;
    setBusyAction(direction);
    setError(null);
    setStatusMessage(null);
    setLastFailedSync(null);
    setLogs([]);
    appendLog(`[debug] runSync(${direction}) iniciado`);
    try {
      const { scopedClient, scopedFs } = getSyncContext();
      appendLog('[debug] llamando findOrphans...');
      const orphans = await findOrphans(scopedClient, scopedFs, direction);
      appendLog(`[debug] findOrphans terminó: ${orphans.length} huérfanos`);
      if (orphans.length > 0) {
        setConfirmModal({ type: 'orphans', direction, files: orphans });
        return;
      }
      await doSync(scopedClient, scopedFs, direction);
    } catch (e: any) {
      handleSyncError(e, direction);
    } finally {
      runningRef.current = false;
      setBusyAction(null);
    }
  }

  async function doSync(client: DriveClient, fs: LocalFS, direction: 'push' | 'pull'): Promise<SyncSummary> {
    runningRef.current = true;
    setBusyAction(direction);
    setError(null);
    setStatusMessage(null);
    appendLog(`[debug] doSync(${direction}) iniciado`);
    try {
      const s = sync(client, fs, { onLog: appendLog });
      appendLog(`[debug] ejecutando s.${direction}()...`);
      const summary = direction === 'push' ? await s.push() : await s.pull();
      appendLog(`[debug] s.${direction}() terminó`);
      appendLog(`--- Resumen: subidos ${summary.uploaded.length}, descargados ${summary.downloaded.length}, conflictos ${summary.conflicts.length}, sin cambios ${summary.skipped.length}`);
      appendLog('[debug] llamando refreshLocal...');
      await refreshLocal();
      appendLog('[debug] refreshLocal terminó');
      setStatusMessage(summarizeSync(direction, summary));
      return summary;
    } catch (e: any) {
      handleSyncError(e, direction);
      throw e;
    } finally {
      runningRef.current = false;
      setBusyAction(null);
    }
  }

  async function skipOrphans(direction: 'push' | 'pull') {
    setConfirmModal(null);
    if (runningRef.current) return;
    try {
      const { scopedClient, scopedFs } = getSyncContext();
      await doSync(scopedClient, scopedFs, direction);
    } catch (e: any) {
      handleSyncError(e, direction);
    }
  }

  async function confirmOrphans(direction: 'push' | 'pull', files: string[]) {
    if (runningRef.current) return;
    runningRef.current = true;
    setBusyAction('orphans');
    setError(null);
    setLastFailedSync(null);
    setStatusMessage(null);
    try {
      const { scopedClient, scopedFs } = getSyncContext();
      for (const name of files) {
        if (direction === 'push') {
          await scopedClient.delete(name);
          appendLog(`Eliminado de GitHub: "${name}"`);
        } else {
          await scopedFs.delete(name);
          appendLog(`Eliminado local: "${name}"`);
        }
      }
      if (direction === 'push') await scopedClient.commitMeta();
      await doSync(scopedClient, scopedFs, direction);
    } catch (e: any) {
      handleSyncError(e, direction);
    } finally {
      runningRef.current = false;
      setBusyAction(null);
    }
  }

  async function createFile() {
    const name = newFileName.trim();
    if (!name) return;
    const base = name.endsWith('.md') ? name : `${name}.md`;
    const fname = currentFolder ? `${currentFolder}/${base}` : base;
    try {
      await safWrite(fname, `# ${name}\n\nEscribe tu nota aquí...\n`);
      setNewFileName('');
      await refreshLocal();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  async function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    if (name.startsWith('.')) {
      setError('El nombre de la carpeta no puede empezar con un punto.');
      return;
    }
    setError(null);
    try {
      await safCreateFolder(name);
      setNewFolderName('');
      setShowCreateFolder(false);
      await refreshLocal();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  async function confirmDeleteFolder(folder: string) {
    if (!config) return;
    setBusyAction('delete-folder');
    setError(null);
    setLastFailedSync(null);
    setStatusMessage(null);
    try {
      const client = new GitHubClient(config);
      const filesInFolder = localFiles.filter((f) => f.name.startsWith(folder + '/'));
      for (const f of filesInFolder) {
        await client.delete(f.name);
      }
      await client.commitMeta();
      for (const f of filesInFolder) {
        await localFs.delete(f.name);
      }
      await localFs.delete(folder);
      appendLog(`Carpeta "${folder}" eliminada`);
      setStatusMessage(`Carpeta "${folder}" eliminada`);
      await refreshLocal();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
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

  async function confirmDelete(names: string[]) {
    if (!config || names.length === 0) return;
    setBusyAction('delete');
    setError(null);
    setLastFailedSync(null);
    setStatusMessage(null);
    try {
      const client = new GitHubClient(config);
      for (const name of names) {
        await client.delete(name);
      }
      await client.commitMeta();
      for (const name of names) {
        await localFs.delete(name);
      }
      appendLog(`Eliminados: ${names.join(', ')}`);
      setStatusMessage(`Eliminados: ${names.length} archivo${names.length === 1 ? '' : 's'}`);
      setSelectedFiles([]);
      await refreshLocal();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusyAction(null);
    }
  }

  function askDelete(names: string[]) {
    setConfirmModal({ type: 'delete-files', names });
  }

  function toggleSelect(name: string) {
    setSelectedFiles((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  }

  function askDeleteFolder(folder: string) {
    setConfirmModal({ type: 'delete-folder', folder });
  }

  function setFolderFormVisible(show: boolean) {
    setShowCreateFolder(show);
    if (!show) setNewFolderName('');
  }

  const rootFiles = localFiles.filter((f) => !f.name.includes('/'));
  const folderFiles = currentFolder
    ? localFiles.filter((f) => f.name.startsWith(currentFolder + '/'))
    : [];
  const pushState: ActionState = busyAction === 'push' ? { status: 'loading' } : IDLE;
  const pullState: ActionState = busyAction === 'pull' ? { status: 'loading' } : IDLE;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>FileSync</Text>

        {!config ? (
          <ConnectionForm
            owner={owner}
            repo={repo}
            token={token}
            showToken={showToken}
            error={error}
            onOwnerChange={setOwner}
            onRepoChange={setRepo}
            onTokenChange={setToken}
            onToggleToken={() => setShowToken((value) => !value)}
            onSave={handleSaveConfig}
          />
        ) : (
          <>
            <ConnectionCard config={config} onLogout={handleLogout} />

            <SyncActions
              busy={busy}
              busyAction={busyAction}
              pushState={pushState}
              pullState={pullState}
              error={error}
              lastFailedSync={lastFailedSync}
              statusMessage={statusMessage}
              onSync={runSync}
            />

            <CreateNoteRow value={newFileName} onChangeText={setNewFileName} onCreate={createFile} />

            <StorageSection
              usingSaf={usingSaf}
              safUriLabel={storage.safUri?.split('/document/').pop() ?? 'seleccionada'}
              onPickFolder={handlePickFolder}
              onResetFolder={handleResetFolder}
            />

            <FoldersSection
              currentFolder={currentFolder}
              folders={folders}
              showCreateFolder={showCreateFolder}
              newFolderName={newFolderName}
              onNewFolderNameChange={setNewFolderName}
              onShowCreateFolder={setFolderFormVisible}
              onCreateFolder={handleCreateFolder}
              onGoToRoot={goToRoot}
              onEnterFolder={enterFolder}
              onAskDeleteFolder={askDeleteFolder}
            />

            <FileList
              currentFolder={currentFolder}
              rootFiles={rootFiles}
              folderFiles={folderFiles}
              isEmptyWorkspace={localFiles.length === 0 && folders.length === 0}
              selectedFiles={selectedFiles}
              busy={busy}
              onToggleSelect={toggleSelect}
              onAskDelete={askDelete}
            />

            <ActivityLog
              logs={logs}
              showDebug={showDebug}
              onToggleDebug={() => setShowDebug((value) => !value)}
            />
          </>
        )}
      </ScrollView>
      <ConfirmDialog
        state={confirmModal}
        onClose={() => setConfirmModal(null)}
        onDeleteFiles={(names) => {
          setConfirmModal(null);
          void confirmDelete(names);
        }}
        onDeleteFolder={(folder) => {
          setConfirmModal(null);
          void confirmDeleteFolder(folder);
        }}
        onSkipOrphans={(direction) => {
          setConfirmModal(null);
          void skipOrphans(direction);
        }}
        onConfirmOrphans={(direction, files) => {
          setConfirmModal(null);
          void confirmOrphans(direction, files);
        }}
      />
    </View>
  );
}
