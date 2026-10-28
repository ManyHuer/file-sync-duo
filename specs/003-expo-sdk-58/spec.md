# Especificación de Feature: Actualizar Expo SDK 54 a 58

**Feature Branch**: `003-expo-sdk-58`

**Created**: 2026-10-27

**Status**: Implemented

**Input**: User description: "Actualizar Expo SDK 54 a 58 sin regresiones en Android"

## Escenarios de usuario y pruebas *(obligatorio)*

### Historia de usuario 1 - Abrir la app en la Expo Go actual (Prioridad: P1)

Como usuario de Android, quiero abrir FileSync en la Expo Go más reciente
(58.0.5) sin instalar una versión antigua del cliente, para probar los cambios
en mi teléfono.

**Por qué esta prioridad**: es el bloqueo actual: el proyecto está en SDK 54 y
la Expo Go del teléfono en SDK 58, por lo que la app no carga.

**Prueba independiente**: ejecutar `pnpm mobile:start`, escanear el QR con Expo
Go 58.0.5 y ver la pantalla de configuración sin errores.

**Escenarios de aceptación**:

1. **Dado** Expo Go 58.0.5 en Android, **cuando** se abre el proyecto,
   **entonces** carga sin “Project is incompatible with this version of Expo Go”.
2. **Dado** la app cargada, **cuando** se configura owner/repo/token,
   **entonces** la sesión persiste y las acciones funcionan igual que antes.
3. **Dado** un archivo local, **cuando** se pulsa Subir, **entonces** se ve
   “Subiendo...”, el resumen y el estado final.

---

### Historia de usuario 2 - Mantener el comportamiento existente (Prioridad: P2)

Como usuario, quiero que la actualización no cambie la sincronización, los
conflictos, SAF ni el almacenamiento seguro.

**Por qué esta prioridad**: una migración de SDK no debe introducir regresiones
funcionales.

**Prueba independiente**: typecheck, 45 tests del core, bundle Android y
`expo-doctor` en verde.

**Escenarios de aceptación**:

1. **Dado** el proyecto actualizado, **cuando** se ejecuta `pnpm test`,
   **entonces** los 45 tests del core y los typechecks pasan.
2. **Dado** el proyecto actualizado, **cuando** se ejecuta `expo export
   --platform android`, **entonces** Metro genera el bundle sin errores.
3. **Dado** el proyecto actualizado, **cuando** se ejecuta `expo-doctor`,
   **entonces** las 20 comprobaciones pasan.

---

### Historia de usuario 3 - No romper desktop (Prioridad: P3)

Como usuario de escritorio, quiero que la migración de mobile no afecte la app
Electron.

**Por qué esta prioridad**: el monorepo comparte lockfile y hoisting; un cambio
de React/RN en mobile puede afectar la resolución de desktop.

**Prueba independiente**: `pnpm desktop:test:e2e` sigue en verde.

**Escenarios de aceptación**:

1. **Dado** el lockfile actualizado, **cuando** se ejecuta la E2E de Electron,
   **entonces** pasa y usa React 18.3.1/react-dom 18.3.1.
2. **Dado** el typecheck de desktop, **cuando** se ejecuta, **entonces** pasa.

---

### Casos de borde

- Node < 22.13.0 (Expo CLI 58 no lo soporta).
- `expo install --fix` ejecutado con la CLI vieja (puede revertir el SDK).
- `@expo/dom-webview` con versión incompatible.
- R8 activado por defecto en release builds.
- Expo Go con un patch distinto de 58.0.5 (mismo SDK, compatible).
- `android/` generado con SDK 54 (debe regenerarse).

## Requisitos *(obligatorio)*

### Requisitos funcionales

- **FR-001**: El proyecto DEBE usar Expo SDK 58 (paquete `expo` 58.x).
- **FR-002**: React Native DEBE ser 0.88.x y React 19.3.x.
- **FR-003**: Node DEBE ser >= 22.13.0 para la CLI de Expo.
- **FR-004**: `expo-file-system/legacy` y `StorageAccessFramework` DEBEN seguir
  funcionando en Android.
- **FR-005**: `expo-secure-store` DEBE seguir persistiendo la configuración.
- **FR-006**: `expo-doctor` DEBE pasar sin issues.
- **FR-007**: El bundle Android DEBE generarse sin errores de Metro.
- **FR-008**: Los 45 tests del core y los typechecks DEBEN pasar.
- **FR-009**: La E2E de desktop DEBE seguir pasando.
- **FR-010**: El proyecto `android/` DEBE regenerarse con SDK 58.
- **FR-011**: CI DEBE usar Node 22.
- **FR-012**: La app NO DEBE depender de una Expo Go antigua.

### Entidades clave

- **SDK 58**: versión de Expo, RN 0.88, React 19.3.
- **Expo Go 58.0.5**: cliente Android con SDK 58.
- **Bundle Android**: salida de `expo export` para verificar Metro.
- **`android/`**: proyecto nativo generado por `expo prebuild`.

## Criterios de éxito *(obligatorio)*

### Resultados medibles

- **SC-001**: Expo Go 58.0.5 abre el proyecto sin error de incompatibilidad.
- **SC-002**: `expo-doctor` pasa 20/20.
- **SC-003**: `expo export --platform android` genera un bundle > 0 bytes.
- **SC-004**: `pnpm test` pasa con 45 tests y 3 typechecks.
- **SC-005**: `pnpm desktop:test:e2e` pasa en menos de 2 minutos.
- **SC-006**: `expo prebuild --platform android` termina sin errores.

## Supuestos

- El teléfono usa Android y Expo Go 58.0.5 (última disponible).
- El proyecto usa el workflow gestionado (prebuild) y no tiene cambios nativos
  manuales.
- No se usa web; `react-native-web` no es requisito.
- R8 en release se probará en CI al generar el APK.
- El patch exacto de Expo Go (58.0.5) y el de `expo` (58.0.20) pertenecen al
  mismo SDK 58 y son compatibles.
