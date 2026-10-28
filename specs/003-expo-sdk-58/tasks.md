# Tareas: Actualizar Expo SDK 54 a 58

**Feature**: `003-expo-sdk-58` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Fase 1: Dependencias

- [x] T001 Instalar `expo@58.0.5` en `apps/mobile`
- [x] T002 Corregir el enlace obsoleto de `apps/mobile/node_modules` y reinstalar
- [x] T003 Ejecutar `expo install --fix` con la CLI 58
- [x] T004 Alinear React 19.3, React Native 0.88, TypeScript 6 y módulos Expo 58
- [x] T005 Añadir `@expo/dom-webview@~58.0.2` para el peer de Expo

## Fase 2: Entorno y nativo

- [x] T006 Instalar Node 22 y añadir `.nvmrc`
- [x] T007 Añadir `engines.node >=22.13.0` al `package.json` raíz
- [x] T008 Eliminar el `android/` de SDK 54 y regenerarlo con `expo prebuild`
- [x] T009 Restaurar scripts `android`/`ios` a `expo start --android/--ios`

## Fase 3: Verificación

- [x] T010 `expo-doctor` en verde (20/20)
- [x] T011 `expo export --platform android` sin errores (629 módulos)
- [x] T012 `pnpm test` (45 tests + 3 typechecks)
- [x] T013 `pnpm desktop:test:e2e` en verde
- [x] T014 Confirmar que React 18.3.1 sigue resolviéndose en desktop

## Fase 4: Documentación y CI

- [x] T015 Actualizar workflows de CI a Node 22
- [x] T016 Actualizar README (Node 22, Expo Go 58.x)
- [x] T017 Actualizar `AGENTS.md` (SDK 58, RN 0.88, React 19.3)
- [x] T018 Actualizar el perfil FileSync de la skill `spec-kit`

## Criterio de terminado

- Expo Go 58.0.5 abre el proyecto sin error de incompatibilidad.
- `expo-doctor` 20/20.
- Bundle Android generado.
- Core y typechecks en verde.
- Desktop E2E en verde.
- CI en Node 22.

## Verificación (2026-10-27)

| Gate | Resultado |
|---|---|
| `expo-doctor` | 20/20, sin issues |
| `expo export --platform android` | 629 módulos, bundle 1.7 MB |
| `pnpm core:test` | 45 tests, 6 archivos |
| `pnpm --filter mobile typecheck` | OK |
| `pnpm --filter desktop typecheck` | OK |
| `pnpm desktop:test:e2e` | 1 test, ~10 s |
| `expo prebuild --platform android` | OK |
| React en desktop | 18.3.1 / react-dom 18.3.1 |

**Pendiente de validación manual**: abrir la app en Expo Go 58.0.5 en el
teléfono y recorrer el checklist de estados (subir, descargar, error,
reintentar, doble click).
