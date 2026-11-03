import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { actionLabel } from '@filesync/core';
import type { ActionState } from '@filesync/core';
import { styles } from '../styles';
import { ArrowIcon } from './icons';

interface SyncActionsProps {
  busy: boolean;
  busyAction: 'push' | 'pull' | 'delete' | 'delete-folder' | 'orphans' | null;
  pushState: ActionState;
  pullState: ActionState;
  error: string | null;
  lastFailedSync: 'push' | 'pull' | null;
  statusMessage: string | null;
  privateFolder?: boolean;
  onSync: (direction: 'push' | 'pull') => void;
}

export function SyncActions({
  busy,
  busyAction,
  pushState,
  pullState,
  error,
  lastFailedSync,
  statusMessage,
  privateFolder,
  onSync,
}: SyncActionsProps) {
  return (
    <>
      <View style={styles.row}>
        <Pressable
          style={({ pressed }) => [styles.button, styles.primary, styles.rowBtn, pressed && styles.primaryPressed]}
          testID="btn-push"
          onPress={() => onSync('push')}
          disabled={busy}
        >
          <View style={styles.buttonContent}>
            {busyAction === 'push' ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <ArrowIcon direction="up" />
            )}
            <Text style={styles.buttonText}>
              {actionLabel(pushState, 'Subir a GitHub', 'Subiendo...')}
            </Text>
          </View>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.button, styles.primary, styles.rowBtn, pressed && styles.primaryPressed]}
          testID="btn-pull"
          onPress={() => onSync('pull')}
          disabled={busy}
        >
          <View style={styles.buttonContent}>
            {busyAction === 'pull' ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <ArrowIcon direction="down" />
            )}
            <Text style={styles.buttonText}>
              {actionLabel(pullState, 'Descargar', 'Descargando...')}
            </Text>
          </View>
        </Pressable>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <View style={styles.statusDotError} />
          <Text style={[styles.error, styles.errorText]} testID="text-error">{error}</Text>
          {lastFailedSync && (
            <Pressable
              style={({ pressed }) => [styles.button, styles.primarySmall, pressed && styles.primaryPressed]}
              testID="btn-retry"
              onPress={() => onSync(lastFailedSync)}
              disabled={busy}
            >
              <Text style={styles.buttonText}>Reintentar</Text>
            </Pressable>
          )}
        </View>
      )}
      {statusMessage && (
        <View style={styles.successBanner}>
          <View style={styles.statusDotSuccess} />
          <Text style={styles.successText} testID="text-status">{statusMessage}</Text>
        </View>
      )}
      {privateFolder && (
        <Text style={styles.muted}>Carpeta privada: se excluye de la sincronización.</Text>
      )}
    </>
  );
}
