# Plan: Carpetas privadas

**Feature**: `006-private-folders` | **Spec**: [spec.md](./spec.md)

## Core

- `isPrivatePath(name, privateFolders)`: true para la carpeta y su subárbol.
- `filterPrivate(items, privateFolders)`: helper para listados.
- Tests unitarios.

## Persistencia

- **Desktop**: `privateFolders: string[]` en `config.json`; IPC `config:setPrivateFolders` y `config:get`.
- **Mobile**: `privateFolders` en el config de SecureStore.

## Sync

- Los adaptadores de listado (local y remoto) filtran los paths privados.
- `findOrphans` queda cubierto al usar los adaptadores filtrados.
- Dentro de una carpeta privada, `runSync` responde con un mensaje de no-op.
- Borrado de archivos/carpetas privadas omite las llamadas a GitHub.

## UI

- Checkbox “Carpeta privada” en el formulario de creación.
- Si la carpeta actual es privada, el checkbox aparece como “Privada (heredada)” y bloqueado.
- Sección separada “Carpetas privadas” con chip/candado.
- Desktop y mobile comparten la misma semántica de navegación.

## Verificación

- Core tests, typechecks, E2E desktop, bundle Expo y prueba manual.
