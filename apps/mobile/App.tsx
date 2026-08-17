import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Alert, TextInput } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { GitHubClient, sync, findOrphans } from '@filesync/core';
import type { LocalFileMeta } from '@filesync/core';

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
    for (const [name, uri] of Object.entries(index)) {
      if (!name.endsWith('.md')) continue;
      try {
        await FileSystem.StorageAccessFramework.readAsStringAsync(uri);
        files.push({ name, modifiedTime: meta[name] ?? 0 });
      } catch {
        delete index[name];
      }
    }
    const uris = await FileSystem.StorageAccessFramework.readDirectoryAsync(storage.safUri);
    for (const uri of uris) {
      const name = nameFromSafUri(uri);
      if (!name.endsWith('.md') || index[name]) continue;
      files.push({ name, modifiedTime: meta[name] ?? 0 });
      index[name] = uri;
    }
    await saveSafIndex(index);
    return files;
  }
  const names = await FileSystem.readDirectoryAsync(SANDBOX_DIR);
  const files: LocalFileMeta[] = [];
  for (const name of names) {
    const info = await FileSystem.getInfoAsync(`${SANDBOX_DIR}${name}`);
    if (info.exists && !info.isDirectory) {
      files.push({ name, modifiedTime: info.modificationTime ? Math.round(info.modificationTime * 1000) : 0 });
    }
  }
  return files;
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
    const uris = await FileSystem.StorageAccessFramework.readDirectoryAsync(storage.safUri);
    const target = uris.find((uri) => nameFromSafUri(uri) === name);
    if (target) {
      await FileSystem.StorageAccessFramework.writeAsStringAsync(target, content);
      index[name] = target;
    } else {
      const base = name.replace(/\.md$/, '');
      const uri = await FileSystem.StorageAccessFramework.createFileAsync(storage.safUri, base, 'text/markdown');
      await FileSystem.StorageAccessFramework.writeAsStringAsync(uri, content);
      index[name] = uri;
    }
    await saveSafIndex(index);
  } else {
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

const localFs = {
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
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [usingSaf, setUsingSaf] = useState(false);
  const [showConfirmLogout, setShowConfirmLogout] = useState(false);
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
  }

  function appendLog(msg: string) {
    setLogs((prev) => [...prev, msg]);
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
    setShowConfirmLogout(false);
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
    try {
      const client = new GitHubClient(config);
      const orphans = await findOrphans(client, localFs, direction);
      if (orphans.length > 0) {
        setBusy(false);
        Alert.alert(
          'Sincronizar eliminaciones',
          direction === 'push'
            ? `Estos archivos existen en GitHub pero no en tu teléfono. Se eliminarán de GitHub:\n\n${orphans.join('\n')}`
            : `Estos archivos existen en tu teléfono pero no en GitHub. Se eliminarán de tu teléfono:\n\n${orphans.join('\n')}`,
          [
            { text: 'No, solo sincronizar', style: 'cancel', onPress: () => doSync(client, direction) },
            { text: 'Sí, eliminar', style: 'destructive', onPress: () => confirmOrphans(client, direction, orphans) },
          ],
        );
        return;
      }
      await doSync(client, direction);
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

  async function doSync(client: GitHubClient, direction: 'push' | 'pull') {
    setBusy(true);
    setError(null);
    try {
      const s = sync(client, localFs, { onLog: appendLog });
      const summary = direction === 'push' ? await s.push() : await s.pull();
      appendLog(`--- Resumen: subidos ${summary.uploaded.length}, descargados ${summary.downloaded.length}, conflictos ${summary.conflicts.length}, sin cambios ${summary.skipped.length}`);
      await refreshLocal();
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

  async function confirmOrphans(client: GitHubClient, direction: 'push' | 'pull', files: string[]) {
    setBusy(true);
    setError(null);
    try {
      for (const name of files) {
        if (direction === 'push') {
          await client.delete(name);
          appendLog(`Eliminado de GitHub: "${name}"`);
        } else {
          await localFs.delete(name);
          appendLog(`Eliminado local: "${name}"`);
        }
      }
      if (direction === 'push') await client.commitMeta();
      await doSync(client, direction);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function createFile() {
    const name = newFileName.trim();
    if (!name) return;
    const fname = name.endsWith('.md') ? name : `${name}.md`;
    try {
      await safWrite(fname, `# ${name}\n\nEscribe tu nota aquí...\n`);
      setNewFileName('');
      await refreshLocal();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
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
                style={[styles.button, styles.primary]}
                onPress={() => runSync('push')}
                disabled={busy}
              >
                <Text style={styles.buttonText}>Subir a GitHub</Text>
              </Pressable>
              <Pressable
                style={[styles.button, styles.primary]}
                onPress={() => runSync('pull')}
                disabled={busy}
              >
                <Text style={styles.buttonText}>Descargar</Text>
              </Pressable>
              <Pressable style={[styles.button, styles.ghost]} onPress={() => setShowConfirmLogout(true)}>
                <Text style={styles.buttonText}>Cambiar</Text>
              </Pressable>
            </View>

            {showConfirmLogout && (
              <View style={styles.confirmBox}>
                <Text style={styles.confirmText}>
                  ¿Seguro que quieres cerrar la sesión? Podrás volver a configurar la conexión.
                </Text>
                <View style={styles.row}>
                  <Pressable style={[styles.button, styles.primarySmall]} onPress={handleLogout}>
                    <Text style={styles.buttonText}>Sí, cerrar sesión</Text>
                  </Pressable>
                  <Pressable style={[styles.button, styles.ghostSmall]} onPress={() => setShowConfirmLogout(false)}>
                    <Text style={styles.buttonText}>No, regresar</Text>
                  </Pressable>
                </View>
              </View>
            )}

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

            <Text style={styles.sectionTitle}>Archivos locales (.md)</Text>
            {localFiles.length === 0 ? (
              <Text style={styles.muted}>No hay archivos .md. Crea uno con el botón "Crear".</Text>
            ) : (
              localFiles.map((f) => (
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
    backgroundColor: '#0f1115',
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    color: '#e6e6e6',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 16,
  },
  text: {
    color: '#e6e6e6',
    fontSize: 15,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#262b36',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  primary: {
    backgroundColor: '#1a73e8',
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#3a4152',
  },
  primarySmall: {
    backgroundColor: '#1a73e8',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  ghostSmall: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#3a4152',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  buttonText: {
    color: '#e6e6e6',
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  createRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  confirmBox: {
    backgroundColor: '#181b22',
    borderColor: '#3a4152',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  confirmText: {
    color: '#e6e6e6',
    fontSize: 14,
    marginBottom: 10,
  },
  folderText: {
    flex: 1,
    color: '#9aa4b2',
    fontSize: 13,
  },
  input: {
    backgroundColor: '#181b22',
    borderColor: '#3a4152',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#e6e6e6',
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#9aa4b2',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#232833',
  },
  checkbox: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  checkboxChecked: {
    color: '#1a73e8',
    fontSize: 20,
  },
  checkboxUnchecked: {
    color: '#3a4152',
    fontSize: 20,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    color: '#e6e6e6',
  },
  danger: {
    backgroundColor: '#c0392b',
    marginTop: 12,
  },
  muted: {
    color: '#9aa4b2',
    fontSize: 12,
    marginBottom: 8,
  },
  error: {
    color: '#ff6b6b',
    marginBottom: 12,
  },
  logBox: {
    backgroundColor: '#0a0c10',
    borderRadius: 8,
    padding: 12,
  },
  logLine: {
    color: '#9aa4b2',
    fontFamily: 'monospace',
    fontSize: 13,
    marginBottom: 4,
  },
});
