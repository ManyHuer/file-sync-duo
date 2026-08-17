import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";
import { readFileSync, statSync, existsSync, mkdirSync } from "node:fs";

const DEFAULT_SYNC_DIR = path.join(app.getPath("documents"), "FileSync");
const CONFIG_PATH = path.join(DEFAULT_SYNC_DIR, "config.json");

interface AppConfig {
  owner: string;
  repo: string;
  token: string;
  syncDir?: string;
}

let config: AppConfig | null = null;

function loadConfig(): AppConfig | null {
  if (!existsSync(CONFIG_PATH)) return null;
  try {
    const json = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
    if (json.owner && json.repo && json.token) {
      config = json;
      return json;
    }
  } catch {}
  return null;
}

function saveConfig(cfg: AppConfig) {
  mkdirSync(DEFAULT_SYNC_DIR, { recursive: true });
  fs.writeFile(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

function getSyncDir(): string {
  if (config?.syncDir && existsSync(config.syncDir)) {
    return config.syncDir;
  }
  return DEFAULT_SYNC_DIR;
}

function ensureSyncDir() {
  mkdirSync(getSyncDir(), { recursive: true });
}

function registerIpc() {
  ipcMain.handle("config:get", () => {
    const cfg = loadConfig();
    return cfg ? { owner: cfg.owner, repo: cfg.repo, hasToken: true, syncDir: cfg.syncDir ?? DEFAULT_SYNC_DIR } : null;
  });

  ipcMain.handle("config:save", (_e, cfg: AppConfig) => {
    config = cfg;
    saveConfig(cfg);
    return { ok: true };
  });

  ipcMain.handle("config:getToken", () => loadConfig()?.token ?? null);

  ipcMain.handle("fs:chooseDir", async () => {
    const result = await dialog.showOpenDialog({
      title: "Elegir carpeta de sincronización",
      properties: ["openDirectory", "createDirectory"],
      defaultPath: getSyncDir(),
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }
    const syncDir = result.filePaths[0];
    if (config) {
      config.syncDir = syncDir;
      saveConfig(config);
    }
    mkdirSync(syncDir, { recursive: true });
    return { canceled: false, syncDir };
  });

  ipcMain.handle("fs:list", async () => {
    ensureSyncDir();
    const entries = await fs.readdir(getSyncDir(), { withFileTypes: true, recursive: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith(".md"))
      .map((e) => {
        const fullPath = path.join(e.parentPath, e.name);
        const stat = statSync(fullPath);
        const relPath = path.relative(getSyncDir(), fullPath).replace(/\\/g, "/");
        return { name: relPath, modifiedTime: Math.round(stat.mtimeMs) };
      })
      .filter((f) => !f.name.split("/").some((seg) => seg.startsWith(".")));
  });

  ipcMain.handle("fs:listFolders", async () => {
    ensureSyncDir();
    const entries = await fs.readdir(getSyncDir(), { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => e.name)
      .sort();
  });

  ipcMain.handle("fs:read", async (_e, name: string) => {
    return fs.readFile(path.join(getSyncDir(), name), "utf8");
  });

  ipcMain.handle("fs:write", async (_e, name: string, content: string) => {
    const fullPath = path.join(getSyncDir(), name);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, "utf8");
  });

  ipcMain.handle("fs:stat", async (_e, name: string) => {
    return Math.round(statSync(path.join(getSyncDir(), name)).mtimeMs);
  });

  ipcMain.handle("fs:setMtime", async (_e, name: string, modifiedTime: number) => {
    await fs.utimes(path.join(getSyncDir(), name), modifiedTime / 1000, modifiedTime / 1000);
  });

  ipcMain.handle("fs:delete", async (_e, name: string) => {
    const fullPath = path.join(getSyncDir(), name);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      await fs.rmdir(fullPath);
    } else {
      await fs.unlink(fullPath);
    }
  });

  ipcMain.handle("fs:createFolder", async (_e, name: string) => {
    const fullPath = path.join(getSyncDir(), name);
    if (existsSync(fullPath)) return { ok: false, error: "Ya existe una carpeta con ese nombre." };
    await fs.mkdir(fullPath, { recursive: true });
    return { ok: true };
  });
}

app.whenReady().then(() => {
  registerIpc();
  ensureSyncDir();
  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    win.loadURL(devUrl);
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
