export interface AppConfig {
  owner: string;
  repo: string;
  hasToken: boolean;
  syncDir: string;
  privateFolders: string[];
}

export interface LocalFile {
  name: string;
  modifiedTime: number;
}

export type SyncDirection = "push" | "pull";

export type BusyAction = SyncDirection | "delete" | "delete-folder" | "orphans" | null;

declare global {
  interface Window {
    fileSync: {
      getConfig: () => Promise<AppConfig | null>;
      saveConfig: (config: { owner: string; repo: string; token: string; syncDir?: string }) => Promise<{ ok: boolean }>;
      setPrivateFolders: (folders: string[]) => Promise<{ ok: boolean }>;
      getToken: () => Promise<string | null>;
      clearConfig: () => Promise<{ ok: boolean }>;
      chooseDir: () => Promise<{ canceled: boolean; syncDir?: string }>;
      listFiles: () => Promise<LocalFile[]>;
      listFolders: () => Promise<string[]>;
      readFile: (name: string) => Promise<string>;
      writeFile: (name: string, content: string) => Promise<void>;
      statFile: (name: string) => Promise<number>;
      setMtime: (name: string, modifiedTime: number) => Promise<void>;
      deleteFile: (name: string) => Promise<void>;
      createFolder: (name: string) => Promise<{ ok: boolean; error?: string }>;
    };
  }
}
