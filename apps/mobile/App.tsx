import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Modal, TextInput } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { GitHubClient, sync, findOrphans, isHiddenPath, IDLE, actionLabel, summarizeSync } from '@filesync/core';
import type { ActionState, DriveClient, LocalFileMeta, LocalFS, SyncSummary } from '@filesync/core';
import { theme } from './theme';

const CONFIG_KEY = 'filesync_config';
const SAF_URI_KEY = 'filesync_saf_uri';
const SANDBOX_DIR = `${FileSystem.documentDirectory}FileSync/`;
const META_PATH = `${FileSystem.documentDirectory}filesync-local-meta.json`;
const SAF_INDEX_PATH = `${FileSystem.documentDirectory}filesync-saf-index.json`;

interface AppConfig {
  owner: string;
  repo: string;
  token: string;
}

const storage = {
  safUri: null as string | null,
};

function nameFromSafUri(uri: string): string {
  const afterDoc = uri.split('/document/').pop() ?? uri;
  const decoded = decodeURIComponent(afterDoc);
  const name = decoded.split('/').pop() ?? decoded;
  return name.replace(/^primary:/, '');
}

async function loadLocalMeta(): Promise<Record<string, number>> {
  try {
    const raw = await FileSystem.readAsStringAsync(META_PATH);
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
}

async function saveLocalMeta(meta: Record<string, number>): Promise<void> {
  await FileSystem.writeAsStringAsync(META_PATH, JSON.stringify(meta));
}

async function loadSafIndex(): Promise<Record<string, string>> {
  try {
    const raw = await FileSystem.readAsStringAsync(SAF_INDEX_PATH);
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

async function saveSafIndex(index: Record<string, string>): Promise<void> {
  await FileSystem.writeAsStringAsync(SAF_INDEX_PATH, JSON.stringify(index));
}

async function safEnsureDir(): Promise<void> {
  if (storage.safUri) return;
  const info = await FileSystem.getInfoAsync(SANDBOX_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(SANDBOX_DIR, { intermediates: true });
  }
}

async function safList(): Promise<LocalFileMeta[]> {
  await safEnsureDir();
  const meta = await loadLocalMeta();
  if (storage.safUri) {
    const index = await loadSafIndex();
    const files: LocalFileMeta[] = [];
    const seen = new Set<string>();
    const scanDir = async (uri: string, prefix: string) => {
      const uris = await FileSystem.StorageAccessFramework.readDirectoryAsync(uri);
      for (const itemUri of uris) {
        const baseName = nameFromSafUri(itemUri);
        if (baseName.startsWith('.')) continue;
        const name = prefix ? `${prefix}/${baseName}` : baseName;
        let isDir = false;
        try {
          await FileSystem.StorageAccessFramework.readDirectoryAsync(itemUri);
          isDir = true;
        } catch {
          // no es directorio
        }
        if (isDir) {
          if (!prefix) await scanDir(itemUri, baseName);
          continue;
        }
        if (!name.endsWith('.md') || isHiddenPath(name)) continue;
        seen.add(name);
        index[name] = itemUri;
        const info = await FileSystem.getInfoAsync(itemUri);
        console.log(`[debug] getInfoAsync(${name}) =>`, JSON.stringify(info));
        const mtime = info.exists && info.modificationTime ? Math.round(info.modificationTime * 1000) : (meta[name] ?? 0);
        meta[name] = mtime;
        files.push({ name, modifiedTime: mtime });
      }
    };
    try {
      await scanDir(storage.safUri, '');
    } catch (e: any) {
      throw new Error(`No se pudo leer la carpeta elegida: ${String(e?.message ?? e)}`);
    }
    for (const name of Object.keys(index)) {
      if (!seen.has(name)) delete index[name];
    }
    await saveSafIndex(index);
    await saveLocalMeta(meta);
    return files;
  }
  const names = await FileSystem.readDirectoryAsync(SANDBOX_DIR);
  const files: LocalFileMeta[] = [];
  for (const name of names) {
    if (isHiddenPath(name)) continue;
    const info = await FileSystem.getInfoAsync(`${SANDBOX_DIR}${name}`);
    if (info.exists && !info.isDirectory) {
      files.push({ name, modifiedTime: info.modificationTime ? Math.round(info.modificationTime * 1000) : 0 });
    } else if (info.exists && info.isDirectory) {
      const subNames = await FileSystem.readDirectoryAsync(`${SANDBOX_DIR}${name}`);
      for (const sub of subNames) {
        const full = `${name}/${sub}`;
        if (!full.endsWith('.md') || isHiddenPath(full)) continue;
        const subInfo = await FileSystem.getInfoAsync(`${SANDBOX_DIR}${full}`);
        if (subInfo.exists && !subInfo.isDirectory) {
          files.push({ name: full, modifiedTime: subInfo.modificationTime ? Math.round(subInfo.modificationTime * 1000) : 0 });
        }
      }
    }
  }
  return files;
}

async function safListFolders(): Promise<string[]> {
  await safEnsureDir();
  if (storage.safUri) {
    const uris = await FileSystem.StorageAccessFramework.readDirectoryAsync(storage.safUri);
    const folders: string[] = [];
    for (const uri of uris) {
      const name = nameFromSafUri(uri);
      if (name.startsWith('.')) continue;
      try {
        await FileSystem.StorageAccessFramework.readDirectoryAsync(uri);
        folders.push(name);
      } catch {
        // no es directorio, ignorar
      }
    }
    return folders.sort();
  }
  const names = await FileSystem.readDirectoryAsync(SANDBOX_DIR);
  return names
    .filter((n) => !n.startsWith('.'))
    .sort();
}

async function safCreateFolder(name: string): Promise<void> {
  await safEnsureDir();
  if (storage.safUri) {
    await FileSystem.StorageAccessFramework.makeDirectoryAsync(storage.safUri, name);
  } else {
    await FileSystem.makeDirectoryAsync(`${SANDBOX_DIR}${name}`, { intermediates: true });
  }
}

async function safRead(name: string): Promise<string> {
  await safEnsureDir();
  if (storage.safUri) {
    const index = await loadSafIndex();
    const known = index[name];
    if (known) {
      try {
        return await FileSystem.StorageAccessFramework.readAsStringAsync(known);
      } catch {
        delete index[name];
        await saveSafIndex(index);
      }
    }
    const uris = await FileSystem.StorageAccessFramework.readDirectoryAsync(storage.safUri);
    const target = uris.find((uri) => nameFromSafUri(uri) === name);
    if (!target) throw new Error(`No se encontró "${name}" en la carpeta elegida.`);
    return FileSystem.StorageAccessFramework.readAsStringAsync(target);
  }
  return FileSystem.readAsStringAsync(`${SANDBOX_DIR}${name}`);
}

async function safWrite(name: string, content: string): Promise<void> {
  await safEnsureDir();
  const meta = await loadLocalMeta();
  if (storage.safUri) {
    const index = await loadSafIndex();
    const known = index[name];
    if (known) {
      try {
        await FileSystem.StorageAccessFramework.writeAsStringAsync(known, content);
        meta[name] = Date.now();
        await saveLocalMeta(meta);
        return;
      } catch {
        delete index[name];
      }
    }
    const slash = name.indexOf('/');
    let baseUri = storage.safUri;
    let base = name;
    if (slash > 0) {
      const folderName = name.slice(0, slash);
      base = name.slice(slash + 1);
      const uris = await FileSystem.StorageAccessFramework.readDirectoryAsync(storage.safUri);
      let folderUri: string | null = null;
      for (const uri of uris) {
        if (nameFromSafUri(uri) === folderName) {
          try {
            await FileSystem.StorageAccessFramework.readDirectoryAsync(uri);
            folderUri = uri;
          } catch {
            // no es directorio, seguir buscando
          }
        }
      }
      if (!folderUri) {
        folderUri = await FileSystem.StorageAccessFramework.makeDirectoryAsync(storage.safUri, folderName);
      }
      baseUri = folderUri;
    }
    const subUris = await FileSystem.StorageAccessFramework.readDirectoryAsync(baseUri);
    const target = subUris.find((uri) => nameFromSafUri(uri) === base);
    if (target) {
      await FileSystem.StorageAccessFramework.writeAsStringAsync(target, content);
      index[name] = target;
    } else {
      const fileBase = base.replace(/\.md$/, '');
      const uri = await FileSystem.StorageAccessFramework.createFileAsync(baseUri, fileBase, 'text/markdown');
      await FileSystem.StorageAccessFramework.writeAsStringAsync(uri, content);
      index[name] = uri;
    }
    await saveSafIndex(index);
  } else {
    const slash = name.indexOf('/');
    if (slash > 0) {
      await FileSystem.makeDirectoryAsync(`${SANDBOX_DIR}${name.slice(0, slash)}`, { intermediates: true });
    }
    await FileSystem.writeAsStringAsync(`${SANDBOX_DIR}${name}`, content);
  }
  meta[name] = Date.now();
  await saveLocalMeta(meta);
}

async function safStat(name: string): Promise<number> {
  const meta = await loadLocalMeta();
  return meta[name] ?? 0;
}

async function safSetMtime(name: string, modifiedTime: number): Promise<void> {
  const meta = await loadLocalMeta();
  meta[name] = modifiedTime;
  await saveLocalMeta(meta);
}

async function safDelete(name: string): Promise<void> {
  await safEnsureDir();
  const meta = await loadLocalMeta();
  if (storage.safUri) {
    const index = await loadSafIndex();
    const known = index[name];
    if (known) {
      try {
        await FileSystem.deleteAsync(known, { idempotent: true });
        delete index[name];
        await saveSafIndex(index);
        delete meta[name];
        await saveLocalMeta(meta);
        return;
      } catch {
        delete index[name];
        await saveSafIndex(index);
      }
    }
    const uris = await FileSystem.StorageAccessFramework.readDirectoryAsync(storage.safUri);
    const target = uris.find((uri) => nameFromSafUri(uri) === name);
    if (target) {
      await FileSystem.deleteAsync(target, { idempotent: true });
    }
  } else {
    await FileSystem.deleteAsync(`${SANDBOX_DIR}${name}`, { idempotent: true });
  }
  delete meta[name];
  await saveLocalMeta(meta);
}

const localFs: LocalFS = {
  list: safList,
  read: safRead,
  write: safWrite,
  stat: safStat,
  setMtime: safSetMtime,
  delete: safDelete,
};

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyGlyph}>
        <View style={styles.emptyGlyphLine} />
        <View style={styles.emptyGlyphLine} />
        <View style={styles.emptyGlyphLine} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyHint}>{hint}</Text>
    </View>
  );
}

function SelectCheckbox({
  name,
  checked,
  disabled,
  onToggle,
}: {
  name: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      style={styles.checkbox}
      testID={`select-${name}`}
      onPress={onToggle}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={`Seleccionar ${name}`}
    >
      <View style={[styles.checkboxBox, checked && styles.checkboxBoxChecked]}>
        {checked && <View style={styles.checkboxMark} />}
      </View>
    </Pressable>
  );
}

type ConfirmModalState =
  | { type: 'delete-files'; names: string[] }
  | { type: 'delete-folder'; folder: string }
  | { type: 'orphans'; direction: 'push' | 'pull'; files: string[] };

function ConfirmDialog({
  state,
  onClose,
  onDeleteFiles,
  onDeleteFolder,
  onSkipOrphans,
  onConfirmOrphans,
}: {
  state: ConfirmModalState | null;
  onClose: () => void;
  onDeleteFiles: (names: string[]) => void;
  onDeleteFolder: (folder: string) => void;
  onSkipOrphans: (direction: 'push' | 'pull') => void;
  onConfirmOrphans: (direction: 'push' | 'pull', files: string[]) => void;
}) {
  if (!state) return null;
  const current = state;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard} accessibilityViewIsModal>
          {current.type === 'delete-files' && (
            <>
              <Text style={styles.modalTitle} accessibilityRole="header">Eliminar archivos</Text>
              <Text style={styles.modalText}>
                Se eliminarán de tu teléfono y de GitHub. Esta acción no se puede deshacer.
              </Text>
              <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent}>
                {current.names.map((name) => (
                  <Text key={name} style={styles.modalListItem}>{name}</Text>
                ))}
              </ScrollView>
              <View style={styles.modalActions}>
                <Pressable
                  style={({ pressed }) => [styles.button, styles.ghost, styles.modalAction, pressed && styles.pressed]}
                  testID="btn-modal-cancel"
                  onPress={onClose}
                >
                  <Text style={styles.buttonText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.button, styles.danger, styles.modalAction, pressed && styles.dangerPressed]}
                  testID="btn-confirm-delete"
                  onPress={() => onDeleteFiles(current.names)}
                >
                  <Text style={styles.buttonText}>Eliminar</Text>
                </Pressable>
              </View>
            </>
          )}
          {current.type === 'delete-folder' && (
            <>
              <Text style={styles.modalTitle} accessibilityRole="header">Eliminar carpeta</Text>
              <Text style={styles.modalText}>
                Se eliminará la carpeta <Text style={styles.modalStrong}>{current.folder}</Text> y todos sus archivos. Esta acción no se puede deshacer.
              </Text>
              <View style={styles.modalActions}>
                <Pressable
                  style={({ pressed }) => [styles.button, styles.ghost, styles.modalAction, pressed && styles.pressed]}
                  testID="btn-modal-cancel"
                  onPress={onClose}
                >
                  <Text style={styles.buttonText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.button, styles.danger, styles.modalAction, pressed && styles.dangerPressed]}
                  testID="btn-confirm-delete-folder"
                  onPress={() => onDeleteFolder(current.folder)}
                >
                  <Text style={styles.buttonText}>Eliminar carpeta</Text>
                </Pressable>
              </View>
            </>
          )}
          {current.type === 'orphans' && (
            <>
              <Text style={styles.modalTitle} accessibilityRole="header">Sincronizar eliminaciones</Text>
              <Text style={styles.modalText}>
                {current.direction === 'push'
                  ? 'Estos archivos existen en GitHub pero no en tu teléfono. Se eliminarán de GitHub.'
                  : 'Estos archivos existen en tu teléfono pero no en GitHub. Se eliminarán de tu teléfono.'}
              </Text>
              <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent}>
                {current.files.map((name) => (
                  <Text key={name} style={styles.modalListItem}>{name}</Text>
                ))}
              </ScrollView>
              <View style={styles.modalActions}>
                <Pressable
                  style={({ pressed }) => [styles.button, styles.ghost, styles.modalAction, pressed && styles.pressed]}
                  testID="btn-skip-orphans"
                  onPress={() => onSkipOrphans(current.direction)}
                >
                  <Text style={styles.buttonText}>No, solo sincronizar</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.button, styles.danger, styles.modalAction, pressed && styles.dangerPressed]}
                  testID="btn-confirm-orphans"
                  onPress={() => onConfirmOrphans(current.direction, current.files)}
                >
                  <Text style={styles.buttonText}>Sí, eliminar</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

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

  const rootFiles = localFiles.filter((f) => !f.name.includes('/'));
  const folderFiles = currentFolder
    ? localFiles.filter((f) => f.name.startsWith(currentFolder + '/'))
    : [];
  const pushState: ActionState = busyAction === 'push' ? { status: 'loading' } : IDLE;
  const pullState: ActionState = busyAction === 'pull' ? { status: 'loading' } : IDLE;
  const visibleLogs = logs.filter((line) => showDebug || !line.startsWith('[debug]'));
  const debugCount = logs.filter((line) => line.startsWith('[debug]')).length;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>FileSync</Text>

        {!config ? (
          <>
            <Text style={styles.text}>
              Configura tu repo de GitHub para sincronizar tus archivos .md.
            </Text>
            <Text style={styles.fieldLabel}>Usuario de GitHub</Text>
            <TextInput
              style={styles.input}
              testID="input-owner"
              placeholder="tu-usuario"
              placeholderTextColor={theme.colors.textSubtle}
              autoCapitalize="none"
              autoCorrect={false}
              value={owner}
              onChangeText={setOwner}
            />
            <Text style={styles.fieldLabel}>Repositorio</Text>
            <TextInput
              style={styles.input}
              testID="input-repo"
              placeholder="mis-notas"
              placeholderTextColor={theme.colors.textSubtle}
              autoCapitalize="none"
              autoCorrect={false}
              value={repo}
              onChangeText={setRepo}
            />
            <View style={styles.fieldLabelRow}>
              <Text style={styles.fieldLabel}>Token de GitHub</Text>
              <Pressable
                style={({ pressed }) => [styles.fieldAction, pressed && styles.pressed]}
                testID="btn-toggle-token"
                onPress={() => setShowToken((value) => !value)}
                accessibilityRole="button"
              >
                <Text style={styles.fieldActionText}>{showToken ? 'Ocultar' : 'Mostrar'}</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.input}
              testID="input-token"
              placeholder="ghp_..."
              placeholderTextColor={theme.colors.textSubtle}
              secureTextEntry={!showToken}
              autoCapitalize="none"
              autoCorrect={false}
              value={token}
              onChangeText={setToken}
            />
            <Text style={styles.fieldHelp}>Necesita scope repo. No se comparte.</Text>
            {error && <Text style={styles.error} testID="text-error">{error}</Text>}
            <Pressable style={({ pressed }) => [styles.button, styles.primary, pressed && styles.primaryPressed]} testID="btn-save-config" onPress={handleSaveConfig}>
              <Text style={styles.buttonText}>Guardar conexión</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.connectionRow}>
              <Text style={[styles.text, styles.connectionText]}>
                Conectado a {config.owner}/{config.repo}
              </Text>
              <Pressable
                style={({ pressed }) => [styles.disconnectSmall, pressed && styles.pressed]}
                testID="btn-logout"
                onPress={handleLogout}
                accessibilityRole="button"
              >
                <Text style={styles.disconnectText}>Desconectar</Text>
              </Pressable>
            </View>
            <View style={styles.row}>
              <Pressable
                style={({ pressed }) => [styles.button, styles.primary, styles.rowBtn, pressed && styles.primaryPressed]}
                testID="btn-push"
                onPress={() => runSync('push')}
                disabled={busy}
              >
                <Text style={styles.buttonText}>
                  {actionLabel(pushState, 'Subir a GitHub', 'Subiendo...')}
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.button, styles.primary, styles.rowBtn, pressed && styles.primaryPressed]}
                testID="btn-pull"
                onPress={() => runSync('pull')}
                disabled={busy}
              >
                <Text style={styles.buttonText}>
                  {actionLabel(pullState, 'Descargar', 'Descargando...')}
                </Text>
              </Pressable>
            </View>

            {error && (
              <View style={styles.errorRow}>
                <Text style={[styles.error, styles.errorText]} testID="text-error">{error}</Text>
                {lastFailedSync && (
                  <Pressable
                    style={({ pressed }) => [styles.button, styles.primarySmall, pressed && styles.primaryPressed]}
                    testID="btn-retry"
                    onPress={() => runSync(lastFailedSync)}
                    disabled={busy}
                  >
                    <Text style={styles.buttonText}>Reintentar</Text>
                  </Pressable>
                )}
              </View>
            )}
            {statusMessage && (
              <Text style={styles.success} testID="text-status">{statusMessage}</Text>
            )}

            <View style={styles.createRow}>
              <TextInput
                style={styles.input}
                testID="input-new-file"
                accessibilityLabel="Nombre de nota nueva"
                placeholder="Nombre de nota nueva"
                placeholderTextColor={theme.colors.textSubtle}
                value={newFileName}
                onChangeText={setNewFileName}
              />
              <Pressable style={({ pressed }) => [styles.button, styles.primary, pressed && styles.primaryPressed]} testID="btn-create-file" onPress={createFile}>
                <Text style={styles.buttonText}>Crear</Text>
              </Pressable>
            </View>

            <View style={styles.folderRow}>
              <Text style={styles.folderText} numberOfLines={2}>
                {usingSaf
                  ? `Carpeta: ${storage.safUri?.split('/document/').pop() ?? 'seleccionada'}`
                  : 'Carpeta: almacenamiento interno de la app'}
              </Text>
              {usingSaf ? (
                <Pressable style={({ pressed }) => [styles.button, styles.ghostSmall, pressed && styles.pressed]} testID="btn-reset-folder" onPress={handleResetFolder}>
                  <Text style={styles.buttonText}>Quitar</Text>
                </Pressable>
              ) : (
                <Pressable style={({ pressed }) => [styles.button, styles.primarySmall, pressed && styles.primaryPressed]} testID="btn-pick-folder" onPress={handlePickFolder}>
                  <Text style={styles.buttonText}>Elegir carpeta</Text>
                </Pressable>
              )}
            </View>
            {!usingSaf && (
              <Text style={styles.muted}>
                Elige la carpeta "Documentos" de tu teléfono para guardar los archivos allí.
              </Text>
            )}

            <View style={styles.folderRow}>
              <Text style={styles.sectionTitle}>
                {currentFolder ? `Carpeta: ${currentFolder}` : 'Carpetas'}
              </Text>
              {currentFolder ? (
                <Pressable style={({ pressed }) => [styles.button, styles.ghostSmall, pressed && styles.pressed]} testID="btn-back" onPress={goToRoot}>
                  <View style={styles.iconRow}>
                    <View style={styles.chevronLeft} />
                    <Text style={styles.buttonText}>Volver</Text>
                  </View>
                </Pressable>
              ) : (
                <Pressable style={({ pressed }) => [styles.button, styles.primarySmall, pressed && styles.primaryPressed]} testID="btn-new-folder" onPress={() => setShowCreateFolder(true)}>
                  <View style={styles.iconRow}>
                    <View style={styles.plusIcon}>
                      <View style={styles.plusIconHorizontal} />
                      <View style={styles.plusIconVertical} />
                    </View>
                    <Text style={styles.buttonText}>Nueva carpeta</Text>
                  </View>
                </Pressable>
              )}
            </View>

            {showCreateFolder && (
              <View style={styles.createRow}>
                <TextInput
                  style={styles.createInput}
                  testID="input-new-folder"
                  accessibilityLabel="Nombre de la carpeta"
                  placeholder="Nombre de la carpeta"
                  placeholderTextColor={theme.colors.textSubtle}
                  value={newFolderName}
                  onChangeText={setNewFolderName}
                  onSubmitEditing={handleCreateFolder}
                />
                <Pressable style={({ pressed }) => [styles.button, styles.primary, styles.createBtn, pressed && styles.primaryPressed]} testID="btn-create-folder" onPress={handleCreateFolder}>
                  <Text style={styles.buttonText}>Crear</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.button, styles.ghost, styles.createBtn, pressed && styles.pressed]}
                  testID="btn-cancel-folder"
                  onPress={() => {
                    setShowCreateFolder(false);
                    setNewFolderName('');
                  }}
                >
                  <Text style={styles.buttonText}>Cancelar</Text>
                </Pressable>
              </View>
            )}

            {!currentFolder && folders.length > 0 && (
              <View style={styles.folderGrid}>
                {folders.map((folder) => (
                  <View key={folder} style={styles.folderCard}>
                    <Pressable
                      style={({ pressed }) => [styles.folderOpen, pressed && styles.folderOpenPressed]}
                      testID={`folder-${folder}`}
                      onPress={() => enterFolder(folder)}
                      accessibilityRole="button"
                      accessibilityLabel={`Abrir carpeta ${folder}`}
                    >
                      <View style={styles.folderGlyph}>
                        <View style={styles.folderGlyphTab} />
                      </View>
                      <Text style={styles.folderName} numberOfLines={2} ellipsizeMode="tail">
                        {folder}
                      </Text>
                      <View style={styles.folderChevron} />
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.folderDelete, pressed && styles.pressed]}
                      testID={`delete-folder-${folder}`}
                      onPress={() => askDeleteFolder(folder)}
                      accessibilityRole="button"
                      accessibilityLabel={`Eliminar carpeta ${folder}`}
                    >
                      <Text style={styles.folderDeleteText}>Eliminar</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.sectionTitle}>Archivos locales (.md)</Text>
            {currentFolder ? (
              folderFiles.length === 0 ? (
                <EmptyState
                  title="Esta carpeta está vacía"
                  hint="Crea una nota con el botón Crear o vuelve a la raíz."
                />
              ) : (
                folderFiles.map((f) => (
                  <View key={f.name} style={styles.fileRow}>
                    <SelectCheckbox
                      name={f.name}
                      checked={selectedFiles.includes(f.name)}
                      disabled={busy}
                      onToggle={() => toggleSelect(f.name)}
                    />
                    <View style={styles.fileInfo}>
                      <Text style={styles.fileName}>{f.name.slice(currentFolder.length + 1)}</Text>
                      <Text style={styles.muted}>
                        {new Date(f.modifiedTime).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                ))
              )
            ) : localFiles.length === 0 && folders.length === 0 ? (
              <EmptyState
                title="No hay notas todavía"
                hint="Crea tu primera nota con el botón Crear."
              />
            ) : rootFiles.length > 0 ? (
              rootFiles.map((f) => (
                <View key={f.name} style={styles.fileRow}>
                  <SelectCheckbox
                    name={f.name}
                    checked={selectedFiles.includes(f.name)}
                    disabled={busy}
                    onToggle={() => toggleSelect(f.name)}
                  />
                  <View style={styles.fileInfo}>
                    <Text style={styles.fileName}>{f.name}</Text>
                    <Text style={styles.muted}>
                      {new Date(f.modifiedTime).toLocaleString()}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <EmptyState
                title="No hay archivos en la raíz"
                hint="Entra a una carpeta o crea una nota."
              />
            )}
            {selectedFiles.length > 0 && (
              <Pressable
                style={({ pressed }) => [styles.button, styles.danger, pressed && styles.dangerPressed]}
                testID="btn-delete-selected"
                onPress={() => askDelete([...selectedFiles])}
                disabled={busy}
              >
                <Text style={styles.buttonText}>Eliminar seleccionados ({selectedFiles.length})</Text>
              </Pressable>
            )}

            {logs.length > 0 && (
              <>
                <View style={styles.logHeader}>
                  <Text style={[styles.sectionTitle, styles.logTitle]}>Actividad</Text>
                  {debugCount > 0 && (
                    <Pressable
                      style={({ pressed }) => [styles.logToggle, pressed && styles.pressed]}
                      onPress={() => setShowDebug((value) => !value)}
                      accessibilityRole="button"
                    >
                      <Text style={styles.logToggleText}>
                        {showDebug ? 'Ocultar detalle' : 'Ver detalle'}
                      </Text>
                    </Pressable>
                  )}
                </View>
                {visibleLogs.length > 0 ? (
                  <View style={styles.logBox} testID="log">
                    {visibleLogs.map((line, i) => (
                      <Text key={i} style={styles.logLine}>
                        {line}
                      </Text>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.muted}>
                    Sin actividad visible. Usa “Ver detalle” para ver los logs internos.
                  </Text>
                )}
              </>
            )}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.xl,
    paddingTop: 64,
    paddingBottom: theme.spacing.xxxl + theme.spacing.sm,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.typography.xxxl,
    fontWeight: '800',
    marginBottom: theme.spacing.lg,
    letterSpacing: -0.3,
    lineHeight: 36,
  },
  text: {
    color: theme.colors.textBody,
    fontSize: theme.typography.lg,
    marginBottom: theme.spacing.lg,
    lineHeight: 24,
  },
  fieldLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.xs,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  fieldAction: {
    minHeight: 32,
    paddingHorizontal: 8,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldActionText: {
    color: theme.colors.primary,
    fontSize: theme.typography.xs,
    fontWeight: '600',
  },
  fieldHelp: {
    color: theme.colors.textSubtle,
    fontSize: theme.typography.xs,
    lineHeight: 16,
    marginTop: -theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  connectionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  connectionText: {
    flexShrink: 1,
    minWidth: 200,
    marginBottom: 0,
  },
  disconnectSmall: {
    minHeight: 40,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.danger,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  disconnectText: {
    color: theme.colors.error,
    fontSize: theme.typography.sm,
    fontWeight: '600',
  },
  button: {
    backgroundColor: theme.colors.button,
    minHeight: 44,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: theme.radius.lg,
    marginBottom: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.sm,
  },
  primary: {
    backgroundColor: theme.colors.primary,
  },
  primaryPressed: {
    backgroundColor: theme.colors.primaryPressed,
  },
  dangerPressed: {
    backgroundColor: theme.colors.dangerPressed,
  },
  rowBtn: {
    flex: 1,
    minHeight: 44,
    minWidth: 96,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: theme.radius.md,
    marginBottom: 0,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    shadowOpacity: 0,
    elevation: 0,
  },
  primarySmall: {
    backgroundColor: theme.colors.primary,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostSmall: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: theme.colors.text,
    fontWeight: '600',
    fontSize: theme.typography.lg,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm + 2,
  },
  createRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    alignItems: 'center',
  },
  createInput: {
    flex: 1,
    minHeight: 42,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.borderStrong,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: theme.colors.text,
    fontSize: theme.typography.md,
  },
  createBtn: {
    minHeight: 42,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    marginBottom: 0,
  },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  folderText: {
    flex: 1,
    color: theme.colors.textSoft,
    fontSize: theme.typography.sm,
    lineHeight: 18,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  chevronLeft: {
    width: 8,
    height: 8,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: theme.colors.text,
    transform: [{ rotate: '45deg' }],
  },
  plusIcon: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusIconHorizontal: {
    position: 'absolute',
    top: 6,
    left: 0,
    width: 14,
    height: 2,
    borderRadius: 1,
    backgroundColor: theme.colors.text,
  },
  plusIconVertical: {
    position: 'absolute',
    top: 0,
    left: 6,
    width: 2,
    height: 14,
    borderRadius: 1,
    backgroundColor: theme.colors.text,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.borderStrong,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    fontSize: theme.typography.lg,
    minHeight: 46,
  },
  sectionTitle: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.xs,
    fontWeight: '700',
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm + 2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  checkbox: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxChecked: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  checkboxMark: {
    width: 6,
    height: 10,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#fff',
    transform: [{ rotate: '45deg' }],
    marginTop: -2,
  },
  fileInfo: {
    flex: 1,
    minWidth: 0,
  },
  fileName: {
    color: theme.colors.text,
    fontSize: theme.typography.xl,
    fontWeight: '500',
    lineHeight: 21,
  },
  danger: {
    backgroundColor: theme.colors.danger,
    marginTop: theme.spacing.lg,
  },
  folderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  folderCard: {
    backgroundColor: theme.colors.surfaceAlt,
    borderColor: theme.colors.borderStrong,
    borderWidth: 1,
    borderRadius: theme.radius.xl,
    padding: 0,
    width: '47%',
    alignItems: 'stretch',
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  folderOpen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
    width: '100%',
  },
  folderOpenPressed: {
    backgroundColor: theme.colors.surfaceHover,
  },
  folderGlyph: {
    width: 30,
    height: 22,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
    position: 'relative',
    flexShrink: 0,
  },
  folderGlyphTab: {
    position: 'absolute',
    top: -5,
    left: 0,
    width: 14,
    height: 8,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  folderName: {
    flex: 1,
    minWidth: 0,
    color: theme.colors.text,
    fontWeight: '600',
    textAlign: 'left',
    fontSize: theme.typography.lg,
    lineHeight: 20,
  },
  folderChevron: {
    width: 8,
    height: 8,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: theme.colors.textSubtle,
    transform: [{ rotate: '45deg' }],
    marginLeft: theme.spacing.xs,
    flexShrink: 0,
  },
  folderDelete: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    paddingTop: theme.spacing.xs,
  },
  folderDeleteText: {
    color: theme.colors.error,
    fontSize: theme.typography.xs,
    fontWeight: '600',
  },
  muted: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.xs,
    marginBottom: theme.spacing.sm,
    lineHeight: 18,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.background,
  },
  emptyGlyph: {
    width: 34,
    height: 42,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.colors.borderSoft,
    paddingHorizontal: 8,
    paddingVertical: 9,
    gap: 4,
    marginBottom: theme.spacing.sm,
  },
  emptyGlyphLine: {
    height: 2,
    borderRadius: 1,
    backgroundColor: theme.colors.borderSoft,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.lg,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  emptyHint: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.sm,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 280,
  },
  error: {
    color: theme.colors.error,
    marginBottom: theme.spacing.md,
    fontSize: theme.typography.sm,
    lineHeight: 18,
  },
  errorText: {
    flex: 1,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  success: {
    color: theme.colors.success,
    fontSize: theme.typography.sm,
    marginBottom: theme.spacing.md,
    lineHeight: 18,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm + 2,
  },
  logTitle: {
    marginTop: 0,
    marginBottom: 0,
  },
  logToggle: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logToggleText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.xs,
    fontWeight: '600',
  },
  logBox: {
    backgroundColor: theme.colors.logBackground,
    borderRadius: theme.radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  logLine: {
    color: theme.colors.textSoft,
    fontFamily: 'monospace',
    fontSize: theme.typography.xs,
    marginBottom: theme.spacing.xs,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '85%',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderTopWidth: 3,
    borderColor: theme.colors.borderStrong,
    borderTopColor: theme.colors.danger,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    ...theme.shadows.md,
  },
  modalTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.xl,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: theme.spacing.sm,
  },
  modalText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.md,
    lineHeight: 20,
    marginBottom: theme.spacing.md,
  },
  modalStrong: {
    color: theme.colors.text,
    fontWeight: '600',
  },
  modalList: {
    maxHeight: 160,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.md,
  },
  modalListContent: {
    padding: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  modalListItem: {
    color: theme.colors.textSoft,
    fontFamily: 'monospace',
    fontSize: theme.typography.xs,
    lineHeight: 17,
  },
  modalActions: {
    gap: theme.spacing.sm,
  },
  modalAction: {
    width: '100%',
    marginTop: 0,
    marginBottom: 0,
  },
});
