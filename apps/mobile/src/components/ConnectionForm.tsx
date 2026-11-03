import { View, Text, TextInput, Pressable } from 'react-native';
import { theme } from '../../theme';
import { styles } from '../styles';

interface ConnectionFormProps {
  owner: string;
  repo: string;
  token: string;
  showToken: boolean;
  error: string | null;
  onOwnerChange: (value: string) => void;
  onRepoChange: (value: string) => void;
  onTokenChange: (value: string) => void;
  onToggleToken: () => void;
  onSave: () => void;
}

export function ConnectionForm({
  owner,
  repo,
  token,
  showToken,
  error,
  onOwnerChange,
  onRepoChange,
  onTokenChange,
  onToggleToken,
  onSave,
}: ConnectionFormProps) {
  return (
    <>
      <Text style={styles.text}>
        Configura tu repo de GitHub para sincronizar tus archivos .md.
      </Text>
      <Text style={styles.fieldLabel}>Usuario de GitHub</Text>
      <TextInput
        style={styles.input}
        testID="input-owner"
        placeholder="tu-usuario"
        placeholderTextColor={theme.colors.textSubtle}
        autoCapitalize="none"
        autoCorrect={false}
        value={owner}
        onChangeText={onOwnerChange}
      />
      <Text style={styles.fieldLabel}>Repositorio</Text>
      <TextInput
        style={styles.input}
        testID="input-repo"
        placeholder="mis-notas"
        placeholderTextColor={theme.colors.textSubtle}
        autoCapitalize="none"
        autoCorrect={false}
        value={repo}
        onChangeText={onRepoChange}
      />
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>Token de GitHub</Text>
        <Pressable
          style={({ pressed }) => [styles.fieldAction, pressed && styles.pressed]}
          testID="btn-toggle-token"
          onPress={onToggleToken}
          accessibilityRole="button"
        >
          <Text style={styles.fieldActionText}>{showToken ? 'Ocultar' : 'Mostrar'}</Text>
        </Pressable>
      </View>
      <TextInput
        style={styles.input}
        testID="input-token"
        placeholder="ghp_..."
        placeholderTextColor={theme.colors.textSubtle}
        secureTextEntry={!showToken}
        autoCapitalize="none"
        autoCorrect={false}
        value={token}
        onChangeText={onTokenChange}
      />
      <Text style={styles.fieldHelp}>Necesita scope repo. No se comparte.</Text>
      {error && <Text style={styles.error} testID="text-error">{error}</Text>}
      <Pressable style={({ pressed }) => [styles.button, styles.primary, pressed && styles.primaryPressed]} testID="btn-save-config" onPress={onSave}>
        <Text style={styles.buttonText}>Guardar conexión</Text>
      </Pressable>
    </>
  );
}
