# Plan de implementación: Actualizar Expo SDK 54 a 58

**Branch**: `003-expo-sdk-58` | **Date**: 2026-10-27 | **Spec**: [spec.md](./spec.md)

## Resumen

Migrar `apps/mobile` de Expo SDK 54 a SDK 58 para que funcione con Expo Go
58.0.5 en Android, sin tocar la lógica de sincronización ni la app de escritorio.
La migración se hizo en un solo salto con verificación posterior, dado el tamaño
reducido del proyecto (3 módulos Expo y sin módulos nativos propios).

## Contexto técnico

| Capa | Antes | Después |
|---|---|---|
| Expo | 54.0.36 | 58.0.20 |
| React Native | 0.81.5 | 0.88.0 |
| React | 19.1.0 | 19.3.0 |
| TypeScript | 5.9.3 | 6.0.3 |
| @types/react | 19.1.17 | 19.3.0 |
| expo-file-system | 19.0.23 | 58.0.12 |
| expo-secure-store | 15.0.8 | 58.0.2 |
| expo-status-bar | 3.0.9 | 58.0.4 |
| Node | 20.20.1 | 22.23.4 (fnm) |

**Dependencias principales**: ninguna nueva de negocio. Se añadió
`@expo/dom-webview@~58.0.2` para satisfacer el peer de Expo 58.

**Almacenamiento**: sin cambios; sigue `expo-file-system/legacy` y
`expo-secure-store`.

**Testing**: Vitest (core), Playwright (desktop), `expo export` (bundle
Android), `expo-doctor`.

**Restricciones**: no cambiar la lógica de sync; no romper desktop; mantener
Expo Go como cliente de pruebas.

**Escala/Alcance**: 1 app, 1 lockfile, 3 workflows de CI, 1 proyecto nativo
regenerado.

## Constitution Check

| Principio | Cumple | Evidencia |
|---|---|---|
| I. Core puro y testeable | ✅ | No se tocó `packages/core`; 45 tests verdes |
| II. Paridad desktop/mobile | ✅ | Desktop E2E sigue verde; mobile actualizado |
| III. Estados de acción explícitos | ✅ | La feature 002 se mantiene; typecheck de mobile verde |
| IV. Contrato de sync intacto | ✅ | `sync.ts` y `conflict.ts` sin cambios |
| V. Seguridad del token | ✅ | Sigue en SecureStore; sin cambios |
| VI. Simplicidad | ✅ | Sin módulos nativos nuevos; una dependencia peer |

**Violaciones**: una, documentada en Complexity Tracking.

## Estructura del proyecto

```text
apps/mobile/
├── package.json          # expo 58, RN 0.88, React 19.3, TS 6
├── app.json              # plugin expo-status-bar añadido por Expo
├── App.tsx               # sin cambios funcionales
├── android/              # regenerado con expo prebuild (gitignored)
└── dist/                 # bundle de verificación (gitignored, eliminado)

.nvmrc                    # 22
.github/workflows/        # Node 22 en test y releases
```

**Decisión de estructura**: no se creó una rama nueva de código; la app es la
misma. El proyecto nativo se regeneró para SDK 58 y se mantiene gitignored.

## Fases

### Fase 0 — Investigación

- Confirmar que `expo-file-system/legacy` y `StorageAccessFramework` existen en
  SDK 58 (documentación v58.0.0).
- Confirmar la versión de Expo Go para Android: 58.0.5.
- Confirmar que `newArchEnabled=true` ya estaba activo.

### Fase 1 — Migración de dependencias

1. `pnpm --filter mobile add expo@58.0.5`.
2. `expo install --fix` con la CLI 54 revirtió el paquete a 54.0.37 por un
   enlace obsoleto en `apps/mobile/node_modules`.
3. Se eliminó `apps/mobile/node_modules`, se reinstaló y se confirmó
   `expo 58.0.5` + `@expo/cli 58.1.16`.
4. `expo install --fix` alineó: expo 58.0.20, RN 0.88, React 19.3, TS 6,
   módulos Expo 58.
5. Se añadió `@expo/dom-webview@~58.0.2` para el peer de Expo.

### Fase 2 — Entorno y nativo

- Node 22.23.4 instalado con `fnm`; `.nvmrc` en 22.
- `android/` viejo eliminado y regenerado con
  `expo prebuild --platform android --no-install`.
- Scripts `android`/`ios` restaurados a `expo start --android/--ios` para el
  flujo con Expo Go.

### Fase 3 — Verificación

- `expo-doctor`: 20/20.
- `expo export --platform android`: 629 módulos, bundle 1.7 MB.
- `pnpm test`: 45 tests + typechecks.
- `pnpm desktop:test:e2e`: verde.

## Complexity Tracking

| Violación | Por qué es necesaria | Alternativa simple rechazada |
|---|---|---|
| `@expo/dom-webview` como dependencia directa | Expo 58 lo declara como peer `~58.0.2` y el lockfile resolvía 57.0.1; sin él `expo-doctor` falla | Forzar con `pnpm.overrides` no resolvió el peer; añadir la dependencia directa es explícito y estable |

## Riesgos

- **R8 en release**: SDK 58 activa minificación por defecto; hay que validar el
  APK de release en CI.
- **Expo Go 58.0.5 vs expo 58.0.20**: mismo SDK, patches distintos; compatible.
- **`android/` generado**: si se necesita build local, requiere Android SDK +
  Java 17+.
- **Node 22**: el equipo debe usar Node 22; Node 20 queda fuera de soporte para
  Expo CLI 58.
- **Web**: no se soporta; `react-native-web` no está instalado y los módulos
  nativos no aplican.
