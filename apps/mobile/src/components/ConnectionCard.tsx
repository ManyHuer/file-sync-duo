import { View, Text, Pressable } from 'react-native';
import { styles } from '../styles';
import type { AppConfig } from '../storage';

interface ConnectionCardProps {
  config: AppConfig;
  onLogout: () => void;
}

export function ConnectionCard({ config, onLogout }: ConnectionCardProps) {
  return (
    <View style={styles.connectionCard}>
      <View style={styles.connectionHeader}>
        <Text style={[styles.sectionTitle, styles.connectionTitle]}>Conexión GitHub</Text>
        <Pressable
          style={({ pressed }) => [styles.disconnectSmall, pressed && styles.pressed]}
          testID="btn-logout"
          onPress={onLogout}
          accessibilityRole="button"
        >
          <Text style={styles.disconnectText}>Desconectar</Text>
        </Pressable>
      </View>
      <View style={styles.connectionStatus}>
        <View style={styles.connectionDot} />
        <Text style={styles.connectionLabel}>Conectado</Text>
        <Text style={styles.connectionRepo} numberOfLines={1}>{config.owner}/{config.repo}</Text>
      </View>
    </View>
  );
}
