import type { DriveClient, DriveFileMeta, LocalFS, LocalFileMeta } from "../../src/types";

export interface FakeEntry {
  content: string;
  modifiedTime: number;
}

export class FakeDriveClient implements DriveClient {
  readonly files = new Map<string, FakeEntry>();
  readonly uploads: Array<{ name: string; content: string; modifiedTime: number }> = [];
  readonly deletes: string[] = [];
  commitCount = 0;

  /** Si se define, la siguiente operación falla con este mensaje. */
  failNext: string | null = null;

  private maybeFail(): void {
    if (this.failNext) {
      const message = this.failNext;
      this.failNext = null;
      throw new Error(message);
    }
  }

  seed(name: string, content: string, modifiedTime: number): void {
    this.files.set(name, { content, modifiedTime });
  }

  async listFiles(): Promise<DriveFileMeta[]> {
    this.maybeFail();
    return [...this.files.entries()].map(([name, entry]) => ({
      id: name,
      name,
      modifiedTime: new Date(entry.modifiedTime).toISOString(),
    }));
  }

  async upload(name: string, content: string, modifiedTime: number): Promise<void> {
    this.maybeFail();
    this.files.set(name, { content, modifiedTime });
    this.uploads.push({ name, content, modifiedTime });
  }

  async download(fileId: string): Promise<string> {
    this.maybeFail();
    const entry = this.files.get(fileId);
    if (!entry) throw new Error(`GitHub API 404: ${fileId}`);
    return entry.content;
  }

  async touch(name: string, modifiedTime: number): Promise<void> {
    this.maybeFail();
    const entry = this.files.get(name);
    if (entry) entry.modifiedTime = modifiedTime;
  }

  async delete(name: string): Promise<void> {
    this.maybeFail();
    this.files.delete(name);
    this.deletes.push(name);
  }

  async commitMeta(): Promise<void> {
    this.maybeFail();
    this.commitCount += 1;
  }
}

export class FakeLocalFS implements LocalFS {
  readonly files = new Map<string, FakeEntry>();
  readonly writes: Array<{ name: string; content: string }> = [];
  readonly deletes: string[] = [];
  readonly mtimes: Array<{ name: string; modifiedTime: number }> = [];

  seed(name: string, content: string, modifiedTime: number): void {
    this.files.set(name, { content, modifiedTime });
  }

  async list(): Promise<LocalFileMeta[]> {
    return [...this.files.entries()].map(([name, entry]) => ({
      name,
      modifiedTime: entry.modifiedTime,
    }));
  }

  async read(name: string): Promise<string> {
    const entry = this.files.get(name);
    if (!entry) throw new Error(`ENOENT: ${name}`);
    return entry.content;
  }

  async write(name: string, content: string): Promise<void> {
    const previous = this.files.get(name);
    this.files.set(name, { content, modifiedTime: previous?.modifiedTime ?? 0 });
    this.writes.push({ name, content });
  }

  async stat(name: string): Promise<number> {
    const entry = this.files.get(name);
    if (!entry) throw new Error(`ENOENT: ${name}`);
    return entry.modifiedTime;
  }

  async setMtime(name: string, modifiedTime: number): Promise<void> {
    const entry = this.files.get(name);
    if (entry) entry.modifiedTime = modifiedTime;
    this.mtimes.push({ name, modifiedTime });
  }

  async delete(name: string): Promise<void> {
    this.files.delete(name);
    this.deletes.push(name);
  }
}

export const T0 = Date.parse("2026-01-01T00:00:00.000Z");
