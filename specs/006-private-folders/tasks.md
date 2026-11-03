# Tareas: Carpetas privadas

**Feature**: `006-private-folders` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Core

- [x] T001 Crear `isPrivatePath` y `filterPrivate`
- [x] T002 Tests unitarios de herencia y límites de path

## Desktop

- [x] T003 Persistir `privateFolders` en config y exponer IPC
- [x] T004 Filtrado de paths privados en adaptadores de sync
- [x] T005 Checkbox “Carpeta privada” y herencia dentro de privadas
- [x] T006 Sección separada “Carpetas privadas” con distintivo
- [x] T007 No-op de sync dentro de carpetas privadas
- [x] T008 Borrado local-only de archivos y carpetas privadas
- [x] T009 E2E de exclusión, no-op y borrado

## Mobile

- [x] T010 Persistir `privateFolders` en SecureStore
- [x] T011 Filtrado de paths privados en adaptadores de sync
- [x] T012 Checkbox “Carpeta privada” y herencia
- [x] T013 Sección separada “Carpetas privadas” con candado
- [x] T014 No-op de sync dentro de carpetas privadas
- [x] T015 Borrado local-only de archivos y carpetas privadas

## Verificación

- [x] T016 `pnpm --filter @filesync/core test` (54 tests)
- [x] T017 `pnpm --filter desktop test:e2e`
- [x] T018 Typechecks desktop y mobile
- [x] T019 `npx expo export --platform android`
- [ ] T020 Prueba manual en Expo Go (pendiente)
