import { View, Pressable } from 'react-native';
import { styles } from '../styles';

export function SelectCheckbox({
  name,
  checked,
  disabled,
  onToggle,
}: {
  name: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      style={styles.checkbox}
      testID={`select-${name}`}
      onPress={onToggle}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={`Seleccionar ${name}`}
    >
      <View style={[styles.checkboxBox, checked && styles.checkboxBoxChecked]}>
        {checked && <View style={styles.checkboxMark} />}
      </View>
    </Pressable>
  );
}
