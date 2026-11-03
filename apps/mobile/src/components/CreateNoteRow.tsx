import { View, Text, TextInput, Pressable } from 'react-native';
import { theme } from '../../theme';
import { styles } from '../styles';

interface CreateNoteRowProps {
  value: string;
  onChangeText: (value: string) => void;
  onCreate: () => void;
}

export function CreateNoteRow({ value, onChangeText, onCreate }: CreateNoteRowProps) {
  return (
    <View style={styles.createRow}>
      <TextInput
        style={styles.input}
        testID="input-new-file"
        accessibilityLabel="Nombre de nota nueva"
        placeholder="Nombre de nota nueva"
        placeholderTextColor={theme.colors.textSubtle}
        value={value}
        onChangeText={onChangeText}
      />
      <Pressable style={({ pressed }) => [styles.button, styles.primary, pressed && styles.primaryPressed]} testID="btn-create-file" onPress={onCreate}>
        <Text style={styles.buttonText}>Crear</Text>
      </Pressable>
    </View>
  );
}
