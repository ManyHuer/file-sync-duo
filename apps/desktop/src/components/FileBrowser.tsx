import type { LocalFile } from "../types";
import { EmptyState } from "./EmptyState";
import { ChevronLeftIcon, ChevronRightIcon, FolderIcon, PlusIcon, TrashIcon } from "./icons";

interface FileBrowserProps {
  currentFolder: string | null;
  folders: string[];
  rootFiles: LocalFile[];
  folderFiles: LocalFile[];
  selectedFiles: string[];
  showCreateFolder: boolean;
  newFolderName: string;
  busy: boolean;
  onEnterFolder: (folder: string) => void;
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

export function FileBrowser({
  currentFolder,
  folders,
  rootFiles,
  folderFiles,
  selectedFiles,
  showCreateFolder,
  newFolderName,
  busy,
  onEnterFolder,
  onGoToRoot,
  onToggleSelect,
  onShowCreateFolder,
  onNewFolderNameChange,
  onCreateFolder,
  onAskDeleteFolder,
  onAskDelete,
}: FileBrowserProps) {
  return (
    <section className="card">
      <div className="card-header">
        <h2>
          {currentFolder ? (
            <>
              <button className="btn back-btn" onClick={onGoToRoot}>
                <ChevronLeftIcon />
                Volver
              </button>
              <span>{currentFolder}</span>
            </>
          ) : (
            <span>Archivos locales (.md)</span>
          )}
        </h2>
        {!currentFolder && (
          <button className="btn" onClick={() => onShowCreateFolder(true)}>
            <PlusIcon />
            Nueva carpeta
          </button>
        )}
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
          <button className="btn primary" onClick={onCreateFolder}>
            Crear
          </button>
          <button className="btn" onClick={() => onShowCreateFolder(false)}>
            Cancelar
          </button>
        </div>
      )}

      {!currentFolder && folders.length > 0 && (
        <div className="folder-grid">
          {folders.map((folder) => (
            <div key={folder} className="folder-card">
              <button
                className="folder-open"
                onClick={() => onEnterFolder(folder)}
                aria-label={`Abrir carpeta ${folder}`}
              >
                <FolderIcon />
                <span className="folder-name">{folder}</span>
                <ChevronRightIcon />
              </button>
              <button
                className="folder-delete"
                aria-label={`Eliminar carpeta ${folder}`}
                onClick={() => onAskDeleteFolder(folder)}
              >
                <TrashIcon />
                <span>Eliminar</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {currentFolder ? (
        folderFiles.length === 0 ? (
          <EmptyState
            title="Esta carpeta está vacía"
            hint="Añade un archivo .md a esta carpeta o vuelve a la raíz."
          />
        ) : (
          <FileList
            files={folderFiles}
            selectedFiles={selectedFiles}
            getLabel={(f) => f.name.slice(currentFolder.length + 1)}
            onToggleSelect={onToggleSelect}
          />
        )
      ) : rootFiles.length === 0 && folders.length === 0 ? (
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
