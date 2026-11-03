import { View, Text, TextInput, Pressable } from 'react-native';
import { theme } from '../../theme';
import { styles } from '../styles';
import { ChevronLeftIcon, FolderGlyph, PlusIcon } from './icons';

interface FoldersSectionProps {
  currentFolder: string | null;
  folders: string[];
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

export function FoldersSection({
  currentFolder,
  folders,
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
      )}

      {folders.length > 0 && (
        <View style={styles.folderGrid}>
          {folders.map((folder) => (
            <View key={folder} style={styles.folderCard}>
              <Pressable
                style={({ pressed }) => [styles.folderOpen, pressed && styles.folderOpenPressed]}
                testID={`folder-${folder}`}
                onPress={() => onEnterFolder(folder)}
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
                onPress={() => onAskDeleteFolder(folder)}
                accessibilityRole="button"
                accessibilityLabel={`Eliminar carpeta ${folder}`}
              >
                <Text style={styles.folderDeleteText}>Eliminar</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </>
  );
}
