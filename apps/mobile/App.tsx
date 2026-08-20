import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Alert, TextInput } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { GitHubClient, sync, findOrphans, isHiddenPath } from '@filesync/core';
import type { DriveClient, LocalFileMeta, LocalFS } from '@filesync/core';

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

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [token, setToken] = useState('');
  const [localFiles, setLocalFiles] = useState<LocalFileMeta[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [usingSaf, setUsingSaf] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

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

  async function handleSaveConfig() {
    setError(null);
    if (!owner.trim() || !repo.trim() || !token.trim()) {
      setError('Completa owner, repo y token.');
      return;
    }
    const c = { owner: owner.trim(), repo: repo.trim(), token: token.trim() };
    await SecureStore.setItemAsync(CONFIG_KEY, JSON.stringify(c));
    setConfig(c);
    setToken('');
  }

  async function handleLogout() {
    await SecureStore.deleteItemAsync(CONFIG_KEY);
    setConfig(null);
  }

  async function handlePickFolder() {
    setError(null);
    try {
      const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (permissions.granted && permissions.directoryUri) {
        storage.safUri = permissions.directoryUri;
        await SecureStore.setItemAsync(SAF_URI_KEY, permissions.directoryUri);
        setUsingSaf(true);
        Alert.alert('Carpeta seleccionada', 'Los archivos se guardarán en la carpeta que elegiste.');
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

  async function runSync(direction: 'push' | 'pull') {
    if (!config) return;
    setBusy(true);
    setError(null);
    setLogs([]);
    appendLog(`[debug] runSync(${direction}) iniciado`);
    try {
      const client = new GitHubClient(config);
      const scopedClient = makeScopedClient(client);
      const scopedFs = makeScopedLocalFs();
      appendLog('[debug] llamando findOrphans...');
      const orphans = await findOrphans(scopedClient, scopedFs, direction);
      appendLog(`[debug] findOrphans terminó: ${orphans.length} huérfanos`);
      if (orphans.length > 0) {
        setBusy(false);
        Alert.alert(
          'Sincronizar eliminaciones',
          direction === 'push'
            ? `Estos archivos existen en GitHub pero no en tu teléfono. Se eliminarán de GitHub:\n\n${orphans.join('\n')}`
            : `Estos archivos existen en tu teléfono pero no en GitHub. Se eliminarán de tu teléfono:\n\n${orphans.join('\n')}`,
          [
            { text: 'No, solo sincronizar', style: 'cancel', onPress: () => doSync(scopedClient, scopedFs, direction) },
            { text: 'Sí, eliminar', style: 'destructive', onPress: () => confirmOrphans(scopedClient, scopedFs, direction, orphans) },
          ],
        );
        return;
      }
      await doSync(scopedClient, scopedFs, direction);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.includes('TOKEN')) {
        setError('Token inválido o expirado. Verifica tu token en la configuración.');
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  async function doSync(client: DriveClient, fs: LocalFS, direction: 'push' | 'pull') {
    setBusy(true);
    setError(null);
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
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.includes('TOKEN')) {
        setError('Token inválido o expirado. Verifica tu token en la configuración.');
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  async function confirmOrphans(client: DriveClient, fs: LocalFS, direction: 'push' | 'pull', files: string[]) {
    setBusy(true);
    setError(null);
    try {
      for (const name of files) {
        if (direction === 'push') {
          await client.delete(name);
          appendLog(`Eliminado de GitHub: "${name}"`);
        } else {
          await fs.delete(name);
          appendLog(`Eliminado local: "${name}"`);
        }
      }
      if (direction === 'push') await client.commitMeta();
      await doSync(client, fs, direction);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
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
    setBusy(true);
    setError(null);
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
      await refreshLocal();
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

  async function confirmDelete(names: string[]) {
    if (!config || names.length === 0) return;
    setBusy(true);
    setError(null);
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
      setSelectedFiles([]);
      await refreshLocal();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  function askDelete(names: string[]) {
    Alert.alert(
      'Eliminar archivos',
      `Se eliminarán de tu teléfono y de GitHub. Esta acción no se puede deshacer:\n\n${names.map((n) => `• ${n}`).join('\n')}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => confirmDelete(names) },
      ],
    );
  }

  function toggleSelect(name: string) {
    setSelectedFiles((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  }

  function askDeleteFolder(folder: string) {
    Alert.alert(
      'Eliminar carpeta',
      `Se eliminarán la carpeta "${folder}" y todos sus archivos de tu teléfono y de GitHub. Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => confirmDeleteFolder(folder) },
      ],
    );
  }

  const rootFiles = localFiles.filter((f) => !f.name.includes('/'));
  const folderFiles = currentFolder
    ? localFiles.filter((f) => f.name.startsWith(currentFolder + '/'))
    : [];

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
            <TextInput
              style={styles.input}
              placeholder="Owner (usuario de GitHub)"
              placeholderTextColor="#777"
              value={owner}
              onChangeText={setOwner}
            />
            <TextInput
              style={styles.input}
              placeholder="Repo (nombre del repositorio)"
              placeholderTextColor="#777"
              value={repo}
              onChangeText={setRepo}
            />
            <TextInput
              style={styles.input}
              placeholder="Personal Access Token"
              placeholderTextColor="#777"
              secureTextEntry
              value={token}
              onChangeText={setToken}
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <Pressable style={[styles.button, styles.primary]} onPress={handleSaveConfig}>
              <Text style={styles.buttonText}>Guardar conexión</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.text}>
              Conectado a {config.owner}/{config.repo}
            </Text>
            <View style={styles.row}>
              <Pressable
                style={[styles.button, styles.primary, styles.rowBtn]}
                onPress={() => runSync('push')}
                disabled={busy}
              >
                <Text style={styles.buttonText}>Subir a GitHub</Text>
              </Pressable>
              <Pressable
                style={[styles.button, styles.primary, styles.rowBtn]}
                onPress={() => runSync('pull')}
                disabled={busy}
              >
                <Text style={styles.buttonText}>Descargar</Text>
              </Pressable>
              <Pressable style={[styles.button, styles.dangerBtn, styles.rowBtn]} onPress={handleLogout}>
                <Text style={styles.buttonText}>Desconectar</Text>
              </Pressable>
            </View>

            {error && <Text style={styles.error}>{error}</Text>}

            <View style={styles.createRow}>
              <TextInput
                style={styles.input}
                placeholder="Nombre de nota nueva"
                placeholderTextColor="#777"
                value={newFileName}
                onChangeText={setNewFileName}
              />
              <Pressable style={[styles.button, styles.primary]} onPress={createFile}>
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
                <Pressable style={[styles.button, styles.ghostSmall]} onPress={handleResetFolder}>
                  <Text style={styles.buttonText}>Quitar</Text>
                </Pressable>
              ) : (
                <Pressable style={[styles.button, styles.primarySmall]} onPress={handlePickFolder}>
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
                {currentFolder ? `📁 ${currentFolder}` : 'Carpetas'}
              </Text>
              {currentFolder ? (
                <Pressable style={[styles.button, styles.ghostSmall]} onPress={goToRoot}>
                  <Text style={styles.buttonText}>← Volver</Text>
                </Pressable>
              ) : (
                <Pressable style={[styles.button, styles.primarySmall]} onPress={() => setShowCreateFolder(true)}>
                  <Text style={styles.buttonText}>+ Nueva carpeta</Text>
                </Pressable>
              )}
            </View>

            {showCreateFolder && (
              <View style={styles.createRow}>
                <TextInput
                  style={styles.createInput}
                  placeholder="Nombre de la carpeta"
                  placeholderTextColor="#777"
                  value={newFolderName}
                  onChangeText={setNewFolderName}
                  onSubmitEditing={handleCreateFolder}
                />
                <Pressable style={[styles.button, styles.primary, styles.createBtn]} onPress={handleCreateFolder}>
                  <Text style={styles.buttonText}>Crear</Text>
                </Pressable>
                <Pressable
                  style={[styles.button, styles.ghost, styles.createBtn]}
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
                  <Pressable
                    key={folder}
                    style={styles.folderCard}
                    onPress={() => enterFolder(folder)}
                  >
                    <Text style={styles.folderIcon}>📁</Text>
                    <Text style={styles.folderName}>{folder}</Text>
                    <Pressable
                      style={[styles.button, styles.dangerSmall]}
                      onPress={() => askDeleteFolder(folder)}
                    >
                      <Text style={styles.buttonText}>Eliminar</Text>
                    </Pressable>
                  </Pressable>
                ))}
              </View>
            )}

            <Text style={styles.sectionTitle}>Archivos locales (.md)</Text>
            {currentFolder ? (
              folderFiles.length === 0 ? (
                <Text style={styles.muted}>Esta carpeta está vacía.</Text>
              ) : (
                folderFiles.map((f) => (
                  <View key={f.name} style={styles.fileRow}>
                    <Pressable
                      style={styles.checkbox}
                      onPress={() => toggleSelect(f.name)}
                      disabled={busy}
                    >
                      <Text style={selectedFiles.includes(f.name) ? styles.checkboxChecked : styles.checkboxUnchecked}>
                        {selectedFiles.includes(f.name) ? '☑' : '☐'}
                      </Text>
                    </Pressable>
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
              <Text style={styles.muted}>No hay archivos .md. Crea uno con el botón "Crear".</Text>
            ) : rootFiles.length > 0 ? (
              rootFiles.map((f) => (
                <View key={f.name} style={styles.fileRow}>
                  <Pressable
                    style={styles.checkbox}
                    onPress={() => toggleSelect(f.name)}
                    disabled={busy}
                  >
                    <Text style={selectedFiles.includes(f.name) ? styles.checkboxChecked : styles.checkboxUnchecked}>
                      {selectedFiles.includes(f.name) ? '☑' : '☐'}
                    </Text>
                  </Pressable>
                  <View style={styles.fileInfo}>
                    <Text style={styles.fileName}>{f.name}</Text>
                    <Text style={styles.muted}>
                      {new Date(f.modifiedTime).toLocaleString()}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.muted}>No hay archivos en la raíz.</Text>
            )}
            {selectedFiles.length > 0 && (
              <Pressable
                style={[styles.button, styles.danger]}
                onPress={() => askDelete([...selectedFiles])}
                disabled={busy}
              >
                <Text style={styles.buttonText}>Eliminar seleccionados ({selectedFiles.length})</Text>
              </Pressable>
            )}

            {logs.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Actividad</Text>
                <View style={styles.logBox}>
                  {logs.map((line, i) => (
                    <Text key={i} style={styles.logLine}>
                      {line}
                    </Text>
                  ))}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0e14',
  },
  content: {
    padding: 20,
    paddingTop: 64,
    paddingBottom: 40,
  },
  title: {
    color: '#f2f4f8',
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  text: {
    color: '#e6e6e6',
    fontSize: 15,
    marginBottom: 16,
    lineHeight: 22,
  },
  button: {
    backgroundColor: '#262b36',
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 10,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  primary: {
    backgroundColor: '#1a73e8',
  },
  dangerBtn: {
    backgroundColor: '#c0392b',
  },
  rowBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 0,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#3a4152',
    shadowOpacity: 0,
    elevation: 0,
  },
  primarySmall: {
    backgroundColor: '#1a73e8',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  ghostSmall: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#3a4152',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  buttonText: {
    color: '#f2f4f8',
    fontWeight: '700',
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  createRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    alignItems: 'center',
  },
  createInput: {
    flex: 1,
    backgroundColor: '#141824',
    borderColor: '#2c3342',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#f2f4f8',
    fontSize: 13,
  },
  createBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 0,
  },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  folderText: {
    flex: 1,
    color: '#9aa4b2',
    fontSize: 13,
  },
  input: {
    backgroundColor: '#141824',
    borderColor: '#2c3342',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f2f4f8',
    marginBottom: 10,
    fontSize: 15,
  },
  sectionTitle: {
    color: '#8b95a7',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1c212e',
  },
  checkbox: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxChecked: {
    color: '#1a73e8',
    fontSize: 22,
  },
  checkboxUnchecked: {
    color: '#3a4152',
    fontSize: 22,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    color: '#f2f4f8',
    fontSize: 15,
    fontWeight: '500',
  },
  danger: {
    backgroundColor: '#c0392b',
    marginTop: 14,
  },
  dangerSmall: {
    backgroundColor: '#c0392b',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 0,
    marginTop: 6,
  },
  folderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 14,
  },
  folderCard: {
    backgroundColor: '#1a1e28',
    borderColor: '#2c3342',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    width: '47%',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  folderIcon: {
    fontSize: 30,
  },
  folderName: {
    color: '#f2f4f8',
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 14,
  },
  muted: {
    color: '#8b95a7',
    fontSize: 12,
    marginBottom: 8,
    lineHeight: 17,
  },
  error: {
    color: '#ff6b6b',
    marginBottom: 12,
    fontSize: 13,
  },
  logBox: {
    backgroundColor: '#0a0d13',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1c212e',
  },
  logLine: {
    color: '#9aa4b2',
    fontFamily: 'monospace',
    fontSize: 12,
    marginBottom: 5,
    lineHeight: 17,
  },
});
