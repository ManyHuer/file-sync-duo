# Tareas: Carpetas anidadas

**Feature**: `005-nested-folders` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Fase 1: Core

- [x] T001 Agregar `encodePath` y usarlo en `getFileSha`, `upload`, `download` y `delete`
- [x] T002 Hacer recursivo `GitHubClient.listFiles` con la Contents API
- [x] T003 Tests de listado recursivo y encoding por segmentos
- [x] T004 Tests de push/pull, conflicto y huérfanos con paths anidados

## Fase 2: Desktop

- [x] T005 `fs:listFolders` recursivo con paths relativos
- [x] T006 `fs:delete` recursivo para directorios
- [x] T007 Navegación por path con Volver al padre y botón Raíz
- [x] T008 Crear carpetas dentro de la carpeta actual
- [x] T009 Mostrar solo hijos directos (carpetas y archivos)
- [x] T010 E2E de navegación, subida y borrado recursivo

## Fase 3: Mobile

- [x] T011 `safList` y `safListFolders` recursivos (SAF y sandbox)
- [x] T012 `resolveSafDir` y `safWrite` para crear paths profundos
- [x] T013 `findSafUri`, `deleteSafTree` y `deleteSandboxTree`
- [x] T014 Navegación por path con Volver al padre y botón Raíz
- [x] T015 Crear carpetas y notas dentro de la carpeta actual
- [x] T016 Mostrar solo hijos directos y estados vacíos correctos

## Fase 4: Verificación

- [x] T017 `pnpm --filter @filesync/core test` (50 tests)
- [x] T018 `pnpm --filter desktop test:e2e`
- [x] T019 Typechecks de desktop y mobile
- [x] T020 `npx expo export --platform android`
- [x] T021 Prueba manual en Expo Go con SAF y almacenamiento interno
