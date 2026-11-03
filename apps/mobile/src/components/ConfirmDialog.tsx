import { Modal, View, Text, ScrollView, Pressable } from 'react-native';
import { styles } from '../styles';

export type ConfirmModalState =
  | { type: 'delete-files'; names: string[] }
  | { type: 'delete-folder'; folder: string }
  | { type: 'orphans'; direction: 'push' | 'pull'; files: string[] };

interface ConfirmDialogProps {
  state: ConfirmModalState | null;
  onClose: () => void;
  onDeleteFiles: (names: string[]) => void;
  onDeleteFolder: (folder: string) => void;
  onSkipOrphans: (direction: 'push' | 'pull') => void;
  onConfirmOrphans: (direction: 'push' | 'pull', files: string[]) => void;
}

export function ConfirmDialog({
  state,
  onClose,
  onDeleteFiles,
  onDeleteFolder,
  onSkipOrphans,
  onConfirmOrphans,
}: ConfirmDialogProps) {
  if (!state) return null;
  const current = state;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard} accessibilityViewIsModal>
          {current.type === 'delete-files' && (
            <>
              <Text style={styles.modalTitle} accessibilityRole="header">Eliminar archivos</Text>
              <Text style={styles.modalText}>
                Se eliminarán de tu teléfono y de GitHub. Esta acción no se puede deshacer.
              </Text>
              <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent}>
                {current.names.map((name) => (
                  <Text key={name} style={styles.modalListItem}>{name}</Text>
                ))}
              </ScrollView>
              <View style={styles.modalActions}>
                <Pressable
                  style={({ pressed }) => [styles.button, styles.ghost, styles.modalAction, pressed && styles.pressed]}
                  testID="btn-modal-cancel"
                  onPress={onClose}
                >
                  <Text style={styles.buttonText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.button, styles.danger, styles.modalAction, pressed && styles.dangerPressed]}
                  testID="btn-confirm-delete"
                  onPress={() => onDeleteFiles(current.names)}
                >
                  <Text style={styles.buttonText}>Eliminar</Text>
                </Pressable>
              </View>
            </>
          )}
          {current.type === 'delete-folder' && (
            <>
              <Text style={styles.modalTitle} accessibilityRole="header">Eliminar carpeta</Text>
              <Text style={styles.modalText}>
                Se eliminará la carpeta <Text style={styles.modalStrong}>{current.folder}</Text> y todos sus archivos. Esta acción no se puede deshacer.
              </Text>
              <View style={styles.modalActions}>
                <Pressable
                  style={({ pressed }) => [styles.button, styles.ghost, styles.modalAction, pressed && styles.pressed]}
                  testID="btn-modal-cancel"
                  onPress={onClose}
                >
                  <Text style={styles.buttonText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.button, styles.danger, styles.modalAction, pressed && styles.dangerPressed]}
                  testID="btn-confirm-delete-folder"
                  onPress={() => onDeleteFolder(current.folder)}
                >
                  <Text style={styles.buttonText}>Eliminar carpeta</Text>
                </Pressable>
              </View>
            </>
          )}
          {current.type === 'orphans' && (
            <>
              <Text style={styles.modalTitle} accessibilityRole="header">Sincronizar eliminaciones</Text>
              <Text style={styles.modalText}>
                {current.direction === 'push'
                  ? 'Estos archivos existen en GitHub pero no en tu teléfono. Se eliminarán de GitHub.'
                  : 'Estos archivos existen en tu teléfono pero no en GitHub. Se eliminarán de tu teléfono.'}
              </Text>
              <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent}>
                {current.files.map((name) => (
                  <Text key={name} style={styles.modalListItem}>{name}</Text>
                ))}
              </ScrollView>
              <View style={styles.modalActions}>
                <Pressable
                  style={({ pressed }) => [styles.button, styles.ghost, styles.modalAction, pressed && styles.pressed]}
                  testID="btn-skip-orphans"
                  onPress={() => onSkipOrphans(current.direction)}
                >
                  <Text style={styles.buttonText}>No, solo sincronizar</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.button, styles.danger, styles.modalAction, pressed && styles.dangerPressed]}
                  testID="btn-confirm-orphans"
                  onPress={() => onConfirmOrphans(current.direction, current.files)}
                >
                  <Text style={styles.buttonText}>Sí, eliminar</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
