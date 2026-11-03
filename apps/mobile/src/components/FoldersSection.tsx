import { View, Text, TextInput, Pressable } from 'react-native';
import { theme } from '../../theme';
import { styles } from '../styles';
import { ChevronLeftIcon, FolderGlyph, LockIcon, PlusIcon } from './icons';

interface FoldersSectionProps {
  currentFolder: string | null;
  folders: string[];
  privateFolders: string[];
  currentFolderIsPrivate: boolean;
  newFolderPrivate: boolean;
  onNewFolderPrivateChange: (value: boolean) => void;
  showCreateFolder: boolean;
  newFolderName: string;
  onNewFolderNameChange: (value: string) => void;
  onShowCreateFolder: (show: boolean) => void;
  onCreateFolder: () => void;
  onGoToParent: () => void;
  onGoToRoot: () => void;
  onEnterFolder: (folder: string) => void;
  onAskDeleteFolder: (folder: string) => void;
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
    <View style={[styles.folderCard, isPrivate && styles.folderCardPrivate]}>
      {isPrivate && (
        <View style={[styles.privateBadge, styles.privateBadgeCorner]}>
          <LockIcon />
          <Text style={styles.privateBadgeText}>Privada</Text>
        </View>
      )}
      <Pressable
        style={({ pressed }) => [styles.folderOpen, pressed && styles.folderOpenPressed]}
        testID={`folder-${folder}`}
        onPress={onEnter}
        accessibilityRole="button"
        accessibilityLabel={`Abrir carpeta ${folder}`}
      >
        <FolderGlyph />
        <Text style={styles.folderName} numberOfLines={2} ellipsizeMode="tail">
          {folder.split('/').pop()}
        </Text>
        <View style={styles.folderChevron} />
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.folderDelete, pressed && styles.pressed]}
        testID={`delete-folder-${folder}`}
        onPress={onAskDelete}
        accessibilityRole="button"
        accessibilityLabel={`Eliminar carpeta ${folder}`}
      >
        <Text style={styles.folderDeleteText}>Eliminar</Text>
      </Pressable>
    </View>
  );
}

export function FoldersSection({
  currentFolder,
  folders,
  privateFolders,
  currentFolderIsPrivate,
  newFolderPrivate,
  onNewFolderPrivateChange,
  showCreateFolder,
  newFolderName,
  onNewFolderNameChange,
  onShowCreateFolder,
  onCreateFolder,
  onGoToParent,
  onGoToRoot,
  onEnterFolder,
  onAskDeleteFolder,
}: FoldersSectionProps) {
  const createPrivate = currentFolderIsPrivate || newFolderPrivate;

  return (
    <>
      <View style={styles.folderRow}>
        <Text style={styles.sectionTitle}>
          {currentFolder ? `Carpeta: ${currentFolder}` : 'Carpetas'}
        </Text>
        <View style={styles.folderHeaderActions}>
          {currentFolder && (
            <Pressable style={({ pressed }) => [styles.button, styles.ghostSmall, pressed && styles.pressed]} testID="btn-back" onPress={onGoToParent}>
              <View style={styles.iconRow}>
                <ChevronLeftIcon />
                <Text style={styles.buttonText}>Volver</Text>
              </View>
            </Pressable>
          )}
          {currentFolder && (
            <Pressable style={({ pressed }) => [styles.button, styles.ghostSmall, pressed && styles.pressed]} testID="btn-root" onPress={onGoToRoot}>
              <Text style={styles.buttonText}>Raíz</Text>
            </Pressable>
          )}
          <Pressable style={({ pressed }) => [styles.button, styles.primarySmall, pressed && styles.primaryPressed]} testID="btn-new-folder" onPress={() => onShowCreateFolder(true)}>
            <View style={styles.iconRow}>
              <PlusIcon />
              <Text style={styles.buttonText}>Nueva carpeta</Text>
            </View>
          </Pressable>
        </View>
      </View>

      {showCreateFolder && (
        <>
          <View style={styles.createRow}>
            <TextInput
              style={styles.createInput}
              testID="input-new-folder"
              accessibilityLabel="Nombre de la carpeta"
              placeholder="Nombre de la carpeta"
              placeholderTextColor={theme.colors.textSubtle}
              value={newFolderName}
              onChangeText={onNewFolderNameChange}
              onSubmitEditing={onCreateFolder}
            />
            <Pressable style={({ pressed }) => [styles.button, styles.primary, styles.createBtn, pressed && styles.primaryPressed]} testID="btn-create-folder" onPress={onCreateFolder}>
              <Text style={styles.buttonText}>Crear</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.button, styles.ghost, styles.createBtn, pressed && styles.pressed]}
              testID="btn-cancel-folder"
              onPress={() => onShowCreateFolder(false)}
            >
              <Text style={styles.buttonText}>Cancelar</Text>
            </Pressable>
          </View>
          <Pressable
            style={styles.checkboxRow}
            onPress={() => {
              if (!currentFolderIsPrivate) onNewFolderPrivateChange(!createPrivate);
            }}
            disabled={currentFolderIsPrivate}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: createPrivate, disabled: currentFolderIsPrivate }}
            accessibilityLabel={currentFolderIsPrivate ? 'Carpeta privada heredada' : 'Carpeta privada'}
            testID="check-private-folder"
          >
            <View style={[styles.checkboxBox, createPrivate && styles.checkboxBoxChecked]}>
              {createPrivate && <View style={styles.checkboxMark} />}
            </View>
            <Text style={styles.checkboxLabel}>
              {currentFolderIsPrivate ? 'Privada (heredada)' : 'Carpeta privada'}
            </Text>
          </Pressable>
        </>
      )}

      {folders.length > 0 && (
        <View style={styles.folderGrid}>
          {folders.map((folder) => (
            <FolderCard
              key={folder}
              folder={folder}
              isPrivate={false}
              onEnter={() => onEnterFolder(folder)}
              onAskDelete={() => onAskDeleteFolder(folder)}
            />
          ))}
        </View>
      )}

      {privateFolders.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, styles.privateSectionTitle]}>Carpetas privadas</Text>
          <View style={styles.folderGrid}>
            {privateFolders.map((folder) => (
              <FolderCard
                key={folder}
                folder={folder}
                isPrivate
                onEnter={() => onEnterFolder(folder)}
                onAskDelete={() => onAskDeleteFolder(folder)}
              />
            ))}
          </View>
        </>
      )}
    </>
  );
}
