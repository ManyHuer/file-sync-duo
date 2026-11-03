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
          await scanDir(itemUri, name);
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
  const files: LocalFileMeta[] = [];
  const walkSandbox = async (prefix: string) => {
    const dir = prefix ? `${SANDBOX_DIR}${prefix}` : SANDBOX_DIR;
    const entries = await FileSystem.readDirectoryAsync(dir);
    for (const name of entries) {
      if (name.startsWith('.')) continue;
      const full = prefix ? `${prefix}/${name}` : name;
      const info = await FileSystem.getInfoAsync(`${SANDBOX_DIR}${full}`);
      if (!info.exists) continue;
      if (info.isDirectory) {
        await walkSandbox(full);
        continue;
      }
      if (!full.endsWith('.md') || isHiddenPath(full)) continue;
      files.push({
        name: full,
        modifiedTime: info.modificationTime ? Math.round(info.modificationTime * 1000) : 0,
      });
    }
  };
  await walkSandbox('');
  return files;
}

export async function safListFolders(): Promise<string[]> {
  await safEnsureDir();
  const folders: string[] = [];
  if (storage.safUri) {
    const walk = async (uri: string, prefix: string) => {
      const uris = await FileSystem.StorageAccessFramework.readDirectoryAsync(uri);
      for (const itemUri of uris) {
        const baseName = nameFromSafUri(itemUri);
        if (baseName.startsWith('.')) continue;
        const name = prefix ? `${prefix}/${baseName}` : baseName;
        try {
          await FileSystem.StorageAccessFramework.readDirectoryAsync(itemUri);
        } catch {
          continue;
        }
        folders.push(name);
        await walk(itemUri, name);
      }
    };
    await walk(storage.safUri, '');
    return folders.sort();
  }
  const walkSandbox = async (prefix: string) => {
    const dir = prefix ? `${SANDBOX_DIR}${prefix}` : SANDBOX_DIR;
    const names = await FileSystem.readDirectoryAsync(dir);
    for (const name of names) {
      if (name.startsWith('.')) continue;
      const full = prefix ? `${prefix}/${name}` : name;
      const info = await FileSystem.getInfoAsync(`${SANDBOX_DIR}${full}`);
      if (info.exists && info.isDirectory) {
        folders.push(full);
        await walkSandbox(full);
      }
    }
  };
  await walkSandbox('');
  return folders.sort();
}

async function resolveSafDir(relativePath: string, create: boolean): Promise<string | null> {
  if (!storage.safUri) return null;
  let currentUri = storage.safUri;
  for (const segment of relativePath.split('/').filter(Boolean)) {
    const uris = await FileSystem.StorageAccessFramework.readDirectoryAsync(currentUri);
    let next: string | null = null;
    for (const uri of uris) {
      if (nameFromSafUri(uri) !== segment) continue;
      try {
        await FileSystem.StorageAccessFramework.readDirectoryAsync(uri);
        next = uri;
        break;
      } catch {
        // es un archivo con el mismo nombre
      }
    }
    if (!next) {
      if (!create) return null;
      next = await FileSystem.StorageAccessFramework.makeDirectoryAsync(currentUri, segment);
    }
    currentUri = next;
  }
  return currentUri;
}

async function findSafUri(relativePath: string): Promise<string | null> {
  if (!storage.safUri) return null;
  const slash = relativePath.lastIndexOf('/');
  const parent = slash > 0 ? relativePath.slice(0, slash) : '';
  const base = slash > 0 ? relativePath.slice(slash + 1) : relativePath;
  const dirUri = await resolveSafDir(parent, false);
  if (!dirUri) return null;
  const uris = await FileSystem.StorageAccessFramework.readDirectoryAsync(dirUri);
  for (const uri of uris) {
    if (nameFromSafUri(uri) !== base) continue;
    try {
      await FileSystem.StorageAccessFramework.readDirectoryAsync(uri);
      continue;
    } catch {
      return uri;
    }
  }
  return null;
}

async function deleteSafTree(dirUri: string, prefix: string): Promise<void> {
  const uris = await FileSystem.StorageAccessFramework.readDirectoryAsync(dirUri);
  for (const uri of uris) {
    const base = nameFromSafUri(uri);
    const child = prefix ? `${prefix}/${base}` : base;
    let isDir = false;
    try {
      await FileSystem.StorageAccessFramework.readDirectoryAsync(uri);
      isDir = true;
    } catch {
      // es un archivo
    }
    if (isDir) {
      await deleteSafTree(uri, child);
    } else {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  }
  try {
    await FileSystem.deleteAsync(dirUri, { idempotent: true });
  } catch {
    // SAF puede no permitir borrar el directorio; sus hijos ya fueron eliminados
  }
}

async function deleteSandboxTree(path: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(path);
  if (info.exists && info.isDirectory) {
    const names = await FileSystem.readDirectoryAsync(path);
    for (const name of names) {
      await deleteSandboxTree(`${path}/${name}`);
    }
  }
  await FileSystem.deleteAsync(path, { idempotent: true });
}

export async function safCreateFolder(name: string): Promise<void> {
  await safEnsureDir();
  if (storage.safUri) {
    await resolveSafDir(name, true);
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
    const target = await findSafUri(name);
    if (!target) throw new Error(`No se encontró "${name}" en la carpeta elegida.`);
    return FileSystem.StorageAccessFramework.readAsStringAsync(target);
  }
  return FileSystem.readAsStringAsync(`${SANDBOX_DIR}${name}`);
}

export async function safWrite(name: string, content: string): Promise<void> {
  await safEnsureDir();
  const meta = await loadLocalMeta();
  const slash = name.lastIndexOf('/');
  const parent = slash > 0 ? name.slice(0, slash) : '';
  const base = slash > 0 ? name.slice(slash + 1) : name;

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
    const dirUri = await resolveSafDir(parent, true);
    if (!dirUri) throw new Error(`No se pudo resolver la carpeta "${parent}".`);
    const subUris = await FileSystem.StorageAccessFramework.readDirectoryAsync(dirUri);
    const target = subUris.find((uri) => nameFromSafUri(uri) === base);
    if (target) {
      await FileSystem.StorageAccessFramework.writeAsStringAsync(target, content);
      index[name] = target;
    } else {
      const fileBase = base.replace(/\.md$/, '');
      const uri = await FileSystem.StorageAccessFramework.createFileAsync(dirUri, fileBase, 'text/markdown');
      await FileSystem.StorageAccessFramework.writeAsStringAsync(uri, content);
      index[name] = uri;
    }
    await saveSafIndex(index);
  } else {
    if (parent) {
      await FileSystem.makeDirectoryAsync(`${SANDBOX_DIR}${parent}`, { intermediates: true });
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
    const fileUri = await findSafUri(name);
    if (fileUri) {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    } else {
      const dirUri = await resolveSafDir(name, false);
      if (dirUri) {
        await deleteSafTree(dirUri, name);
      }
    }
    for (const key of Object.keys(index)) {
      if (key === name || key.startsWith(`${name}/`)) delete index[key];
    }
    await saveSafIndex(index);
  } else {
    await deleteSandboxTree(`${SANDBOX_DIR}${name}`);
  }
  delete meta[name];
  for (const key of Object.keys(meta)) {
    if (key.startsWith(`${name}/`)) delete meta[key];
  }
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
