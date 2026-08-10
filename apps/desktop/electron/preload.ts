import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("fileSync", {
  getConfig: () => ipcRenderer.invoke("config:get"),
  saveConfig: (config: { owner: string; repo: string; token: string; syncDir?: string }) =>
    ipcRenderer.invoke("config:save", config),
  getToken: () => ipcRenderer.invoke("config:getToken"),
  chooseDir: () => ipcRenderer.invoke("fs:chooseDir"),
  listFiles: () => ipcRenderer.invoke("fs:list"),
  readFile: (name: string) => ipcRenderer.invoke("fs:read", name),
  writeFile: (name: string, content: string) => ipcRenderer.invoke("fs:write", name, content),
  statFile: (name: string) => ipcRenderer.invoke("fs:stat", name),
});
