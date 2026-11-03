# Plan: Carpetas anidadas

**Feature**: `005-nested-folders` | **Spec**: [spec.md](./spec.md)

## Core (`packages/core`)

- `encodePath(path)` codifica cada segmento por separado y se usa en `getFileSha`, `upload`, `download` y `delete`.
- `listFiles()` recorre la Contents API de forma recursiva (`walk`), omitiendo carpetas ocultas.
- `sync.ts` y `conflict.ts` no requieren cambios de lógica: ya trabajan con paths completos.
- Tests nuevos: listado recursivo, encoding, push/pull anidado, conflicto en subcarpeta y huérfanos.

## Desktop

- `fs:listFolders` devuelve todas las carpetas con path relativo.
- `fs:delete` borra directorios con `fs.rm({ recursive: true })`.
- `currentFolder` pasa a ser un path; helpers `parentPath`, `joinPath`, `directChildFolders`, `directFiles`.
- `FileBrowser` navega por hijos directos, con Volver al padre y botón Raíz.
- La creación de carpetas usa el path actual.
- E2E: navegación a dos niveles, subida anidada y borrado recursivo.

## Mobile

- `safList` y `safListFolders` recorren todos los niveles (SAF y sandbox).
- `resolveSafDir` resuelve/crea cada segmento; `safWrite` lo usa para crear archivos en paths profundos.
- `findSafUri` busca archivos por path; `deleteSafTree` y `deleteSandboxTree` borran subárboles.
- `safDelete` limpia índice, metadatos y contenido del subárbol.
- Misma navegación por path que desktop en `FoldersSection`/`FileList`.
- Verificación por typecheck, bundle y prueba manual en Expo Go.

## Riesgos

- Diferencias de SAF entre dispositivos para borrar directorios: se eliminan primero los hijos y se intenta borrar el directorio, tolerando el fallo del proveedor.
- Coste de listados recursivos en árboles grandes: se mantiene el límite de 2000 archivos remotos.
