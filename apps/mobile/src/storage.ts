import * as FileSystem from 'expo-file-system/legacy';
import { isHiddenPath } from '@filesync/core';
import type { LocalFileMeta, LocalFS } from '@filesync/core';

export const CONFIG_KEY = 'filesync_config';
export const SAF_URI_KEY = 'filesync_saf_uri';
const SANDBOX_DIR = `${FileSystem.documentDirectory}FileSync/`;
const META_PATH = `${FileSystem.documentDirectory}filesync-local-meta.json`;
const SAF_INDEX_PATH = `${FileSystem.documentDirectory}filesync-saf-index.json`;

export interface AppConfig {
  owner: string;
  repo: string;
  token: string;
}

export const storage = {
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

export async function safEnsureDir(): Promise<void> {
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

export async function safListFolders(): Promise<string[]> {
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

export async function safCreateFolder(name: string): Promise<void> {
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

export async function safWrite(name: string, content: string): Promise<void> {
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

export const localFs: LocalFS = {
  list: safList,
  read: safRead,
  write: safWrite,
  stat: safStat,
  setMtime: safSetMtime,
  delete: safDelete,
};
