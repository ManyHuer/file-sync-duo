import type { LocalFile } from "../types";
import { EmptyState } from "./EmptyState";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FolderIcon,
  LockIcon,
  PlusIcon,
  TrashIcon,
} from "./icons";

interface FileBrowserProps {
  currentFolder: string | null;
  folders: string[];
  privateFolders: string[];
  currentFolderIsPrivate: boolean;
  newFolderPrivate: boolean;
  onNewFolderPrivateChange: (value: boolean) => void;
  rootFiles: LocalFile[];
  folderFiles: LocalFile[];
  selectedFiles: string[];
  showCreateFolder: boolean;
  newFolderName: string;
  busy: boolean;
  onEnterFolder: (folder: string) => void;
  onGoToParent: () => void;
  onGoToRoot: () => void;
  onToggleSelect: (name: string) => void;
  onShowCreateFolder: (show: boolean) => void;
  onNewFolderNameChange: (value: string) => void;
  onCreateFolder: () => void;
  onAskDeleteFolder: (folder: string) => void;
  onAskDelete: (names: string[]) => void;
}

function FileList({
  files,
  selectedFiles,
  getLabel,
  onToggleSelect,
}: {
  files: LocalFile[];
  selectedFiles: string[];
  getLabel: (file: LocalFile) => string;
  onToggleSelect: (name: string) => void;
}) {
  return (
    <ul className="file-list">
      {files.map((f) => (
        <li key={f.name} className={selectedFiles.includes(f.name) ? "selected" : undefined}>
          <label className="file-row">
            <input
              type="checkbox"
              className="file-checkbox"
              checked={selectedFiles.includes(f.name)}
              onChange={() => onToggleSelect(f.name)}
            />
            <span className="file-name">{getLabel(f)}</span>
            <span className="muted">{new Date(f.modifiedTime).toLocaleString()}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}

function FolderCard({
  folder,
  isPrivate,
  onEnter,
  onAskDelete,
}: {
  folder: string;
  isPrivate: boolean;
  onEnter: () => void;
  onAskDelete: () => void;
}) {
  return (
    <div className={`folder-card${isPrivate ? " folder-card-private" : ""}`}>
      {isPrivate && (
        <span className="private-badge private-badge-corner">
          <LockIcon />
          Privada
        </span>
      )}
      <button className="folder-open" onClick={onEnter} aria-label={`Abrir carpeta ${folder}`}>
        <FolderIcon />
        <span className="folder-name">{folder.split("/").pop()}</span>
        <ChevronRightIcon />
      </button>
      <button
        className="folder-delete"
        aria-label={`Eliminar carpeta ${folder}`}
        onClick={onAskDelete}
      >
        <TrashIcon />
        <span>Eliminar</span>
      </button>
    </div>
  );
}

export function FileBrowser({
  currentFolder,
  folders,
  privateFolders,
  currentFolderIsPrivate,
  newFolderPrivate,
  onNewFolderPrivateChange,
  rootFiles,
  folderFiles,
  selectedFiles,
  showCreateFolder,
  newFolderName,
  busy,
  onEnterFolder,
  onGoToParent,
  onGoToRoot,
  onToggleSelect,
  onShowCreateFolder,
  onNewFolderNameChange,
  onCreateFolder,
  onAskDeleteFolder,
  onAskDelete,
}: FileBrowserProps) {
  const totalChildFolders = folders.length + privateFolders.length;
  const createPrivate = currentFolderIsPrivate || newFolderPrivate;

  return (
    <section className="card">
      <div className="card-header">
        <h2>
          {currentFolder ? (
            <>
              <button className="btn back-btn" onClick={onGoToParent}>
                <ChevronLeftIcon />
                Volver
              </button>
              <span>{currentFolder}</span>
              {currentFolderIsPrivate && (
                <span className="private-badge">
                  <LockIcon />
                  Privada
                </span>
              )}
            </>
          ) : (
            <span>Archivos locales (.md)</span>
          )}
        </h2>
        <div className="card-header-actions">
          {currentFolder && (
            <button className="btn" onClick={onGoToRoot}>
              Ir a la raíz
            </button>
          )}
          <button className="btn" onClick={() => onShowCreateFolder(true)}>
            <PlusIcon />
            Nueva carpeta
          </button>
        </div>
      </div>

      {showCreateFolder && (
        <div className="create-folder-row">
          <input
            className="input"
            aria-label="Nombre de la carpeta"
            placeholder="Nombre de la carpeta"
            value={newFolderName}
            onChange={(e) => onNewFolderNameChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onCreateFolder()}
          />
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={createPrivate}
              disabled={currentFolderIsPrivate}
              onChange={(e) => onNewFolderPrivateChange(e.target.checked)}
            />
            {currentFolderIsPrivate ? "Privada (heredada)" : "Carpeta privada"}
          </label>
          <button className="btn primary" onClick={onCreateFolder}>
            Crear
          </button>
          <button className="btn" onClick={() => onShowCreateFolder(false)}>
            Cancelar
          </button>
        </div>
      )}

      {folders.length > 0 && (
        <div className="folder-grid">
          {folders.map((folder) => (
            <FolderCard
              key={folder}
              folder={folder}
              isPrivate={false}
              onEnter={() => onEnterFolder(folder)}
              onAskDelete={() => onAskDeleteFolder(folder)}
            />
          ))}
        </div>
      )}

      {privateFolders.length > 0 && (
        <>
          <h3 className="folder-section-title">Carpetas privadas</h3>
          <div className="folder-grid">
            {privateFolders.map((folder) => (
              <FolderCard
                key={folder}
                folder={folder}
                isPrivate
                onEnter={() => onEnterFolder(folder)}
                onAskDelete={() => onAskDeleteFolder(folder)}
              />
            ))}
          </div>
        </>
      )}

      {currentFolder ? (
        folderFiles.length === 0 && totalChildFolders === 0 ? (
          <EmptyState
            title="Esta carpeta está vacía"
            hint="Añade un archivo .md a esta carpeta o crea una subcarpeta."
          />
        ) : folderFiles.length > 0 ? (
          <FileList
            files={folderFiles}
            selectedFiles={selectedFiles}
            getLabel={(f) => f.name.slice(currentFolder.length + 1)}
            onToggleSelect={onToggleSelect}
          />
        ) : null
      ) : rootFiles.length === 0 && totalChildFolders === 0 ? (
        <EmptyState
          title="No hay notas todavía"
          hint="Crea un archivo .md en la carpeta de sincronización y pulsa Subir a GitHub."
        />
      ) : rootFiles.length > 0 ? (
        <FileList
          files={rootFiles}
          selectedFiles={selectedFiles}
          getLabel={(f) => f.name}
          onToggleSelect={onToggleSelect}
        />
      ) : (
        <EmptyState
          title="No hay archivos en la raíz"
          hint="Entra a una carpeta o crea un archivo .md en la carpeta de sincronización."
        />
      )}

      {selectedFiles.length > 0 && (
        <div className="delete-bar">
          <button className="btn danger" disabled={busy} onClick={() => onAskDelete([...selectedFiles])}>
            Eliminar seleccionados ({selectedFiles.length})
          </button>
        </div>
      )}
    </section>
  );
}
