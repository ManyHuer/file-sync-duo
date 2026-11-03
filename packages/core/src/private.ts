export function isPrivatePath(name: string, privateFolders: string[]): boolean {
  return privateFolders.some((folder) => {
    const normalized = folder.replace(/^\/+|\/+$/g, "");
    if (!normalized) return false;
    return name === normalized || name.startsWith(`${normalized}/`);
  });
}

export function filterPrivate<T extends { name: string }>(items: T[], privateFolders: string[]): T[] {
  if (privateFolders.length === 0) return items;
  return items.filter((item) => !isPrivatePath(item.name, privateFolders));
}
