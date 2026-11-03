import type { LocalFile } from "./types";

export function parentPath(path: string | null): string | null {
  if (!path) return null;
  const index = path.lastIndexOf("/");
  return index === -1 ? null : path.slice(0, index);
}

export function joinPath(parent: string | null, name: string): string {
  return parent ? `${parent}/${name}` : name;
}

export function directChildFolders(folders: string[], current: string | null): string[] {
  return folders.filter((folder) => parentPath(folder) === current);
}

export function directFiles(files: LocalFile[], current: string | null): LocalFile[] {
  return files.filter((file) => parentPath(file.name) === current);
}
