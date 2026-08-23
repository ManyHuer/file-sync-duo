import { conflictName, hasConflictSuffix } from "./conflict";
import { DriveClient, LocalFS, SyncLog, SyncSummary } from "./types";

const MAX_REMOTE_FILES = 2000;

export function isHiddenPath(name: string): boolean {
  return name.split("/").some((seg) => seg.startsWith("."));
}

export function sync(
  client: DriveClient,
  fs: LocalFS,
  log: SyncLog = {},
): {
  push(): Promise<SyncSummary>;
  pull(): Promise<SyncSummary>;
} {
  async function push(): Promise<SyncSummary> {
    const summary: SyncSummary = { uploaded: [], downloaded: [], conflicts: [], skipped: [] };
    const localFiles = (await fs.list()).filter((f) => f.name.endsWith(".md") && !isHiddenPath(f.name));
    const remote = new Map((await client.listFiles()).map((f) => [f.name, f]));

    for (const local of localFiles) {
      const remoteFile = remote.get(local.name);
      const remoteTime = remoteFile ? Date.parse(remoteFile.modifiedTime) : 0;
      log.onLog?.(`[debug] push "${local.name}": local=${local.modifiedTime} remote=${remoteTime} existe=${!!remoteFile}`);

      if (remoteFile && remoteTime > local.modifiedTime) {
        const copyName = conflictName(local.name);
        const localContent = await fs.read(local.name);
        const remoteContent = await client.download(remoteFile.id);
        log.onLog?.(`Conflicto en "${local.name}" (ambos cambiaron). Copia local: "${copyName}"`);
        await fs.write(copyName, remoteContent);
        await fs.setMtime(copyName, remoteTime);
        await client.upload(local.name, localContent, local.modifiedTime);
        summary.conflicts.push(local.name);
      } else if (remoteFile && remoteTime === local.modifiedTime) {
        const localContent = await fs.read(local.name);
        const remoteContent = await client.download(remoteFile.id);
        if (localContent === remoteContent) {
          log.onLog?.(`"${local.name}" ya está sincronizado`);
          summary.skipped.push(local.name);
        } else {
          log.onLog?.(`"${local.name}" cambió (contenido distinto). Subiendo...`);
          await client.upload(local.name, localContent, local.modifiedTime);
          summary.uploaded.push(local.name);
        }
      } else {
        log.onLog?.(`Subiendo "${local.name}"...`);
        await client.upload(local.name, await fs.read(local.name), local.modifiedTime);
        summary.uploaded.push(local.name);
      }
    }
    await client.commitMeta();
    return summary;
  }

  async function pull(): Promise<SyncSummary> {
    const summary: SyncSummary = { uploaded: [], downloaded: [], conflicts: [], skipped: [] };
    const remote = (await client.listFiles()).filter((f) => f.name.endsWith(".md") && !isHiddenPath(f.name));
    if (remote.length > MAX_REMOTE_FILES) {
      throw new Error(`Demasiados archivos en el repo (${remote.length}). Máximo ${MAX_REMOTE_FILES}.`);
    }
    const local = new Map((await fs.list()).map((f) => [f.name, f.modifiedTime]));

    for (const file of remote) {
      const localTime = local.get(file.name) ?? 0;
      const remoteTime = Date.parse(file.modifiedTime);
      log.onLog?.(`[debug] pull "${file.name}": local=${localTime} remote=${remoteTime}`);

      if (localTime > remoteTime) {
        const copyName = conflictName(file.name);
        const localContent = await fs.read(file.name);
        const remoteContent = await client.download(file.id);
        log.onLog?.(`Conflicto en "${file.name}" (local más nuevo). Copia local: "${copyName}"`);
        await fs.write(copyName, localContent);
        await fs.setMtime(copyName, localTime);
        await fs.write(file.name, remoteContent);
        await fs.setMtime(file.name, remoteTime);
        await client.touch(file.name, remoteTime);
        summary.conflicts.push(file.name);
      } else if (localTime === remoteTime && localTime > 0) {
        const localContent = await fs.read(file.name);
        const remoteContent = await client.download(file.id);
        if (localContent === remoteContent) {
          log.onLog?.(`"${file.name}" ya está sincronizado`);
          summary.skipped.push(file.name);
        } else {
          const copyName = conflictName(file.name);
          log.onLog?.(`"${file.name}" cambió (contenido distinto). Copia local: "${copyName}"`);
          await fs.write(copyName, localContent);
          await fs.setMtime(copyName, localTime);
          await fs.write(file.name, remoteContent);
          await fs.setMtime(file.name, remoteTime);
          await client.touch(file.name, remoteTime);
          summary.conflicts.push(file.name);
        }
      } else {
        log.onLog?.(`Descargando "${file.name}"...`);
        try {
          const content = await client.download(file.id);
          await fs.write(file.name, content);
          await fs.setMtime(file.name, remoteTime);
          await client.touch(file.name, remoteTime);
          summary.downloaded.push(file.name);
        } catch (e: any) {
          if (String(e?.message ?? e).includes("GitHub API 404")) {
            log.onLog?.(`"${file.name}" ya no existe en GitHub, omitiendo`);
            summary.skipped.push(file.name);
          } else {
            throw e;
          }
        }
      }
    }
    await client.commitMeta();
    return summary;
  }

  return { push, pull };
}

export async function findOrphans(
  client: DriveClient,
  fs: LocalFS,
  direction: "push" | "pull",
): Promise<string[]> {
  const localNames = new Set(
    (await fs.list()).filter((f) => f.name.endsWith(".md") && !isHiddenPath(f.name)).map((f) => f.name),
  );
  const remoteNames = new Set(
    (await client.listFiles()).filter((f) => f.name.endsWith(".md") && !isHiddenPath(f.name)).map((f) => f.name),
  );
  if (direction === "push") {
    return [...remoteNames].filter((name) => !localNames.has(name));
  }
  return [...localNames].filter((name) => !remoteNames.has(name));
}

export { hasConflictSuffix };
