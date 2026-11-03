import { View, Text, Pressable } from 'react-native';
import { styles } from '../styles';

interface StorageSectionProps {
  usingSaf: boolean;
  safUriLabel: string;
  onPickFolder: () => void;
  onResetFolder: () => void;
}

export function StorageSection({ usingSaf, safUriLabel, onPickFolder, onResetFolder }: StorageSectionProps) {
  return (
    <>
      <View style={styles.folderRow}>
        <Text style={styles.folderText} numberOfLines={2}>
          {usingSaf
            ? `Carpeta: ${safUriLabel}`
            : 'Carpeta: almacenamiento interno de la app'}
        </Text>
        {usingSaf ? (
          <Pressable style={({ pressed }) => [styles.button, styles.ghostSmall, pressed && styles.pressed]} testID="btn-reset-folder" onPress={onResetFolder}>
            <Text style={styles.buttonText}>Quitar</Text>
          </Pressable>
        ) : (
          <Pressable style={({ pressed }) => [styles.button, styles.primarySmall, pressed && styles.primaryPressed]} testID="btn-pick-folder" onPress={onPickFolder}>
            <Text style={styles.buttonText}>Elegir carpeta</Text>
          </Pressable>
        )}
      </View>
      {!usingSaf && (
        <Text style={styles.muted}>
          Elige la carpeta "Documentos" de tu teléfono para guardar los archivos allí.
        </Text>
      )}
    </>
  );
}
