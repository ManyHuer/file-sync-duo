import { View, Text, Pressable } from 'react-native';
import type { LocalFileMeta } from '@filesync/core';
import { styles } from '../styles';
import { EmptyState } from './EmptyState';
import { SelectCheckbox } from './SelectCheckbox';

interface FileListProps {
  currentFolder: string | null;
  rootFiles: LocalFileMeta[];
  folderFiles: LocalFileMeta[];
  isEmptyWorkspace: boolean;
  hasChildFolders: boolean;
  selectedFiles: string[];
  busy: boolean;
  onToggleSelect: (name: string) => void;
  onAskDelete: (names: string[]) => void;
}

function FileRow({
  file,
  label,
  selected,
  disabled,
  onToggle,
}: {
  file: LocalFileMeta;
  label: string;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={[styles.fileRow, selected && styles.fileRowSelected]}>
      <SelectCheckbox
        name={file.name}
        checked={selected}
        disabled={disabled}
        onToggle={onToggle}
      />
      <View style={styles.fileInfo}>
        <Text style={styles.fileName}>{label}</Text>
        <Text style={styles.muted}>
          {new Date(file.modifiedTime).toLocaleString()}
        </Text>
      </View>
    </View>
  );
}

export function FileList({
  currentFolder,
  rootFiles,
  folderFiles,
  isEmptyWorkspace,
  hasChildFolders,
  selectedFiles,
  busy,
  onToggleSelect,
  onAskDelete,
}: FileListProps) {
  return (
    <>
      <Text style={styles.sectionTitle}>Archivos locales (.md)</Text>
      {currentFolder ? (
        folderFiles.length === 0 && !hasChildFolders ? (
          <EmptyState
            title="Esta carpeta está vacía"
            hint="Crea una nota con el botón Crear o crea una subcarpeta."
          />
        ) : folderFiles.length > 0 ? (
          folderFiles.map((f) => (
            <FileRow
              key={f.name}
              file={f}
              label={f.name.slice(currentFolder.length + 1)}
              selected={selectedFiles.includes(f.name)}
              disabled={busy}
              onToggle={() => onToggleSelect(f.name)}
            />
          ))
        ) : null
      ) : isEmptyWorkspace ? (
        <EmptyState
          title="No hay notas todavía"
          hint="Crea tu primera nota con el botón Crear."
        />
      ) : rootFiles.length > 0 ? (
        rootFiles.map((f) => (
          <FileRow
            key={f.name}
            file={f}
            label={f.name}
            selected={selectedFiles.includes(f.name)}
            disabled={busy}
            onToggle={() => onToggleSelect(f.name)}
          />
        ))
      ) : (
        <EmptyState
          title="No hay archivos en la raíz"
          hint="Entra a una carpeta o crea una nota."
        />
      )}
      {selectedFiles.length > 0 && (
        <Pressable
          style={({ pressed }) => [styles.button, styles.danger, pressed && styles.dangerPressed]}
          testID="btn-delete-selected"
          onPress={() => onAskDelete([...selectedFiles])}
          disabled={busy}
        >
          <Text style={styles.buttonText}>Eliminar seleccionados ({selectedFiles.length})</Text>
        </Pressable>
      )}
    </>
  );
}
