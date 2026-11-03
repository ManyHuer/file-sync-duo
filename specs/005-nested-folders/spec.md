# Especificación: Carpetas anidadas (N niveles)

**Feature**: `005-nested-folders`

## Objetivo

Permitir crear, navegar y sincronizar archivos `.md` en carpetas anidadas a cualquier profundidad, tanto en desktop como en mobile, sin perder archivos ni generar huérfanos falsos.

## Requisitos funcionales

1. **RF1** — El listado remoto (GitHub) debe recorrer todos los niveles de carpetas.
2. **RF2** — El listado local de desktop y mobile debe devolver archivos y carpetas a cualquier profundidad.
3. **RF3** — La navegación debe ser carpeta por carpeta, con botón **Volver** al padre y botón **Raíz** para volver al inicio.
4. **RF4** — Debe poder crearse una carpeta dentro de la carpeta actual.
5. **RF5** — El push/pull dentro de una carpeta debe sincronizar todo su subárbol.
6. **RF6** — Borrar una carpeta debe eliminar recursivamente sus archivos y subcarpetas, en local y en GitHub.
7. **RF7** — Las copias de conflicto `_conflict_...` deben crearse en la subcarpeta local correspondiente.
8. **RF8** — Los archivos anidados existentes en ambos lados no deben reportarse como huérfanos.
9. **RF9** — Se mantiene el límite de 2000 archivos remotos.

## Criterios de aceptación

- Crear `a`, entrar, crear `b`, entrar, crear `nota.md`; la app muestra `a/b/nota.md` en la ruta correcta.
- Subir desde la raíz sube `a/b/nota.md` a GitHub con su path.
- Descargar un archivo remoto en `a/b/` crea la carpeta local y el archivo.
- Un conflicto en `a/b/nota.md` genera `a/b/nota_conflict_<fecha>.md` en local.
- Borrar la carpeta `a` elimina `a/b/nota.md` local y remoto.
- Un pull ya no ofrece borrar archivos anidados que existen en GitHub.

## Verificación

- `pnpm --filter @filesync/core test` — incluye tests de listado recursivo, push/pull, conflictos y huérfanos anidados.
- `pnpm --filter desktop test:e2e` — navegación, subida y borrado recursivo.
- `pnpm --filter desktop typecheck` / `pnpm --filter mobile typecheck`.
- `npx expo export --platform android`.
- Prueba manual en Expo Go con SAF y con almacenamiento interno.
