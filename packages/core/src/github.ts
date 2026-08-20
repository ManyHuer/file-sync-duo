import { DriveFileMeta } from "./types";

const META_FILE = ".filesync-meta.json";
const REQUEST_TIMEOUT_MS = 20000;

function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToUtf8(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export interface GitHubConfig {
  owner: string;
  repo: string;
  token: string;
}

export class GitHubClient {
  private meta: Record<string, number> | null = null;
  private metaSha: string | null = null;

  constructor(private config: GitHubConfig) {}

  private repoPath(path: string): string {
    return `/repos/${this.config.owner}/${this.config.repo}/contents/${path}`;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`https://api.github.com${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          ...init?.headers,
        },
      });
    } catch (e: any) {
      if (e?.name === "AbortError") {
        throw new Error(`GitHub API timeout (${REQUEST_TIMEOUT_MS}ms): ${path}`);
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 401) {
      throw new Error("TOKEN_EXPIRED");
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`GitHub API ${res.status}: ${body.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
  }

  private async loadMeta(): Promise<Record<string, number>> {
    if (this.meta) return this.meta;
    let meta: Record<string, number> = {};
    try {
      const data = await this.request<{ content: string; sha: string }>(this.repoPath(META_FILE));
      meta = JSON.parse(base64ToUtf8(data.content));
      this.metaSha = data.sha;
    } catch (e: any) {
      if (!String(e?.message ?? e).includes("GitHub API 404")) throw e;
    }
    this.meta = meta;
    return meta;
  }

  private async getFileSha(name: string): Promise<string | null> {
    try {
      const existing = await this.request<{ sha: string }>(this.repoPath(encodeURIComponent(name)));
      return existing.sha;
    } catch (e: any) {
      if (String(e?.message ?? e).includes("GitHub API 404")) return null;
      throw e;
    }
  }

  async commitMeta(): Promise<void> {
    if (!this.meta) return;
    const body: Record<string, unknown> = {
      message: "sync meta",
      content: utf8ToBase64(JSON.stringify(this.meta)),
    };
    if (this.metaSha) body.sha = this.metaSha;
    const res = await this.request<{ content: { sha: string } }>(this.repoPath(META_FILE), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    this.metaSha = res.content.sha;
  }

  async listFiles(): Promise<DriveFileMeta[]> {
    const meta = await this.loadMeta();
    let data: { name: string; type: string }[];
    try {
      data = await this.request<{ name: string; type: string }[]>(this.repoPath(""));
    } catch (e: any) {
      if (String(e?.message ?? e).includes("This repository is empty")) return [];
      throw e;
    }
    const result: DriveFileMeta[] = [];
    const rootFiles = data.filter((f) => f.type === "file" && f.name.endsWith(".md"));
    for (const f of rootFiles) {
      result.push({
        id: f.name,
        name: f.name,
        modifiedTime: new Date(meta[f.name] ?? 0).toISOString(),
      });
    }
    const dirs = data.filter((d) => d.type === "dir");
    for (const dir of dirs) {
      const sub = await this.request<{ name: string; type: string }[]>(
        this.repoPath(encodeURIComponent(dir.name)),
      );
      for (const f of sub) {
        if (f.type === "file" && f.name.endsWith(".md")) {
          const full = `${dir.name}/${f.name}`;
          result.push({
            id: full,
            name: full,
            modifiedTime: new Date(meta[full] ?? 0).toISOString(),
          });
        }
      }
    }
    return result;
  }

  async upload(name: string, content: string, modifiedTime: number): Promise<void> {
    const meta = await this.loadMeta();
    const sha = await this.getFileSha(name);
    const body: Record<string, unknown> = {
      message: `sync ${name}`,
      content: utf8ToBase64(content),
    };
    if (sha) body.sha = sha;
    await this.request(this.repoPath(encodeURIComponent(name)), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    meta[name] = modifiedTime;
  }

  async download(fileId: string): Promise<string> {
    const data = await this.request<{ content: string }>(this.repoPath(encodeURIComponent(fileId)));
    return base64ToUtf8(data.content);
  }

  async touch(name: string, modifiedTime: number): Promise<void> {
    const meta = await this.loadMeta();
    meta[name] = modifiedTime;
  }

  async delete(name: string): Promise<void> {
    const sha = await this.getFileSha(name);
    if (!sha) return;
    await this.request(this.repoPath(encodeURIComponent(name)), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: `delete ${name}`, sha }),
    });
    const meta = await this.loadMeta();
    delete meta[name];
  }
}
