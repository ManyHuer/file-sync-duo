import { View, Text, Pressable } from 'react-native';
import { styles } from '../styles';

interface ActivityLogProps {
  logs: string[];
  showDebug: boolean;
  onToggleDebug: () => void;
}

export function ActivityLog({ logs, showDebug, onToggleDebug }: ActivityLogProps) {
  if (logs.length === 0) return null;

  const visibleLogs = logs.filter((line) => showDebug || !line.startsWith('[debug]'));
  const debugCount = logs.filter((line) => line.startsWith('[debug]')).length;

  return (
    <>
      <View style={styles.logHeader}>
        <Text style={[styles.sectionTitle, styles.logTitle]}>Actividad</Text>
        {debugCount > 0 && (
          <Pressable
            style={({ pressed }) => [styles.logToggle, pressed && styles.pressed]}
            onPress={onToggleDebug}
            accessibilityRole="button"
          >
            <Text style={styles.logToggleText}>
              {showDebug ? 'Ocultar detalle' : 'Ver detalle'}
            </Text>
          </Pressable>
        )}
      </View>
      {visibleLogs.length > 0 ? (
        <View style={styles.logBox} testID="log">
          {visibleLogs.map((line, i) => (
            <Text key={i} style={styles.logLine}>
              {line}
            </Text>
          ))}
        </View>
      ) : (
        <Text style={styles.muted}>
          Sin actividad visible. Usa “Ver detalle” para ver los logs internos.
        </Text>
      )}
    </>
  );
}
