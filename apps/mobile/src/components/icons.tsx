import { View } from 'react-native';
import { styles } from '../styles';

export function ArrowIcon({ direction }: { direction: 'up' | 'down' }) {
  return (
    <View style={styles.arrowIcon}>
      <View style={styles.arrowShaft} />
      <View style={[styles.arrowHead, direction === 'up' ? styles.arrowHeadUp : styles.arrowHeadDown]} />
    </View>
  );
}

export function ChevronLeftIcon() {
  return <View style={styles.chevronLeft} />;
}

export function PlusIcon() {
  return (
    <View style={styles.plusIcon}>
      <View style={styles.plusIconHorizontal} />
      <View style={styles.plusIconVertical} />
    </View>
  );
}

export function FolderGlyph() {
  return (
    <View style={styles.folderGlyph}>
      <View style={styles.folderGlyphTab} />
    </View>
  );
}

export function LockIcon() {
  return (
    <View style={styles.lockIcon}>
      <View style={styles.lockShackle} />
      <View style={styles.lockBody} />
    </View>
  );
}
