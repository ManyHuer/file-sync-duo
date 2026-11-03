import { View, Text } from 'react-native';
import { styles } from '../styles';

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyGlyph}>
        <View style={styles.emptyGlyphLine} />
        <View style={styles.emptyGlyphLine} />
        <View style={styles.emptyGlyphLine} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyHint}>{hint}</Text>
    </View>
  );
}
