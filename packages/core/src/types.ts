export interface LocalFileMeta {
  name: string;
  modifiedTime: number;
}

export interface DriveFileMeta {
  id: string;
  name: string;
  modifiedTime: string;
}

export interface DriveClient {
  listFiles(): Promise<DriveFileMeta[]>;
  upload(name: string, content: string, modifiedTime: number): Promise<void>;
  download(fileId: string): Promise<string>;
  touch(name: string, modifiedTime: number): Promise<void>;
  delete(name: string): Promise<void>;
  commitMeta(): Promise<void>;
}

export interface LocalFS {
  list(): Promise<LocalFileMeta[]>;
  read(name: string): Promise<string>;
  write(name: string, content: string): Promise<void>;
  stat(name: string): Promise<number>;
  setMtime(name: string, modifiedTime: number): Promise<void>;
  delete(name: string): Promise<void>;
}

export interface SyncSummary {
  uploaded: string[];
  downloaded: string[];
  conflicts: string[];
  skipped: string[];
}

export interface SyncLog {
  onLog?: (message: string) => void;
}
