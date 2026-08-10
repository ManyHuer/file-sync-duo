import React, { useEffect, useState } from "react";
import { GitHubClient, sync } from "@filesync/core";
import type { LocalFS, SyncSummary } from "@filesync/core";
import "./styles.css";

declare global {
  interface Window {
    fileSync: {
      getConfig: () => Promise<{ owner: string; repo: string; hasToken: boolean; syncDir: string } | null>;
      saveConfig: (config: { owner: string; repo: string; token: string; syncDir?: string }) => Promise<{ ok: boolean }>;
      getToken: () => Promise<string | null>;
      chooseDir: () => Promise<{ canceled: boolean; syncDir?: string }>;
      listFiles: () => Promise<{ name: string; modifiedTime: number }[]>;
      readFile: (name: string) => Promise<string>;
      writeFile: (name: string, content: string) => Promise<void>;
      statFile: (name: string) => Promise<number>;
    };
  }
}

export default function App() {
  const [config, setConfig] = useState<{ owner: string; repo: string; hasToken: boolean; syncDir: string } | null>(null);
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [token, setToken] = useState("");
  const [syncDir, setSyncDir] = useState("");
  const [localFiles, setLocalFiles] = useState<{ name: string; modifiedTime: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.fileSync.getConfig().then((c) => {
      setConfig(c);
      if (c) {
        setOwner(c.owner);
        setRepo(c.repo);
        setSyncDir(c.syncDir);
      }
    });
    refreshLocal();
  }, []);

  async function refreshLocal() {
    const files = await window.fileSync.listFiles();
    setLocalFiles(files.filter((f) => f.name.endsWith(".md")));
  }

  function appendLog(msg: string) {
    setLog((prev) => [...prev, msg]);
  }

  async function handleSaveConfig() {
    setError(null);
    if (!owner.trim() || !repo.trim() || !token.trim()) {
      setError("Completa owner, repo y token.");
      return;
    }
    const saved = await window.fileSync.saveConfig({ owner: owner.trim(), repo: repo.trim(), token: token.trim() });
    const updated = await window.fileSync.getConfig();
    setConfig(updated);
    if (updated) setSyncDir(updated.syncDir);
    setToken("");
  }

  async function handleChooseDir() {
    const result = await window.fileSync.chooseDir();
    if (!result.canceled && result.syncDir) {
      setSyncDir(result.syncDir);
      await refreshLocal();
    }
  }

  async function runSync(direction: "push" | "pull") {
    setBusy(true);
    setError(null);
    setLog([]);
    try {
      const token = await window.fileSync.getToken();
      if (!token || !config) throw new Error("Configura la conexión primero.");
      const client = new GitHubClient({ owner: config.owner, repo: config.repo, token });
      const fsAdapter: LocalFS = {
        list: () => window.fileSync.listFiles(),
        read: (name) => window.fileSync.readFile(name),
        write: (name, content) => window.fileSync.writeFile(name, content),
        stat: (name) => window.fileSync.statFile(name),
      };
      const s = sync(client, fsAdapter, { onLog: appendLog });
      const summary = direction === "push" ? await s.push() : await s.pull();
      appendLog("--- Resumen ---");
      appendLog(`Subidos: ${summary.uploaded.length}, Descargados: ${summary.downloaded.length}`);
      appendLog(`Conflictos: ${summary.conflicts.length}, Sin cambios: ${summary.skipped.length}`);
      await refreshLocal();
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.includes("TOKEN")) {
        setError("Token inválido o expirado. Verifica tu token en la configuración.");
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>FileSync</h1>
      </header>

      <section className="card">
        <h2>Conexión GitHub</h2>
        {config ? (
          <p className="hint">
            Conectado a <code>{config.owner}/{config.repo}</code>
          </p>
        ) : (
          <p className="hint">Configura tu repo de GitHub para sincronizar archivos .md.</p>
        )}
        <div className="form">
          <input
            className="input"
            placeholder="Owner (usuario de GitHub)"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
          />
          <input
            className="input"
            placeholder="Repo (nombre del repositorio)"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
          />
          <input
            className="input"
            type="password"
            placeholder="Personal Access Token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <button className="btn primary" onClick={handleSaveConfig}>
            Guardar conexión
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </section>

      {config && (
        <>
          <section className="card">
            <h2>Carpeta de sincronización</h2>
            <p className="hint">{syncDir}</p>
            <button className="btn" onClick={handleChooseDir}>
              Cambiar carpeta
            </button>
          </section>

          <section className="card">
            <div className="actions">
              <button className="btn primary" disabled={busy} onClick={() => runSync("push")}>
                Subir a GitHub
              </button>
              <button className="btn primary" disabled={busy} onClick={() => runSync("pull")}>
                Descargar de GitHub
              </button>
            </div>
          </section>

          <section className="card">
            <h2>Archivos locales (.md)</h2>
            {localFiles.length === 0 ? (
              <p className="hint">
                No hay archivos .md en la carpeta FileSync. Crea uno y pulsa "Subir a GitHub".
              </p>
            ) : (
              <ul className="file-list">
                {localFiles.map((f) => (
                  <li key={f.name}>
                    <span>{f.name}</span>
                    <span className="muted">{new Date(f.modifiedTime).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {log.length > 0 && (
            <section className="card">
              <h2>Actividad</h2>
              <div className="log">
                {log.map((line, i) => (
                  <div key={i} className="log-line">{line}</div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
