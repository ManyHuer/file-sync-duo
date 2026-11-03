# Especificación: Carpetas privadas

**Feature**: `006-private-folders`

## Objetivo

Permitir crear carpetas locales marcadas como privadas que nunca se suben al repositorio de GitHub, manteniéndolas visibles y navegables en la app. Cada dispositivo gestiona su propia lista; el contenido se mueve manualmente entre dispositivos.

## Requisitos funcionales

1. **RF1** — Al crear una carpeta se puede marcar como privada.
2. **RF2** — Se pueden crear varias carpetas privadas en distintos niveles.
3. **RF3** — Las subcarpetas de una carpeta privada heredan la condición de privadas.
4. **RF4** — Los archivos de una carpeta privada nunca se suben, descargan, ni se reportan como huérfanos.
5. **RF5** — Las carpetas privadas se muestran en una sección separada “Carpetas privadas” con un distintivo.
6. **RF6** — Dentro de una carpeta privada los botones de sync siguen activos pero no sincronizan esa carpeta; se muestra “Carpeta privada: nada para sincronizar”.
7. **RF7** — Borrar una carpeta privada borra solo en local y no llama a GitHub.
8. **RF8** — La lista de carpetas privadas se guarda por dispositivo (no se sincroniza).

## Criterios de aceptación

- Crear `privado` como privada, agregar `privado/nota.md`, sincronizar desde la raíz y verificar que `privado/nota.md` no está en GitHub.
- Un archivo público creado al mismo tiempo sí se sincroniza.
- Entrar a `privado` y pulsar Subir/Descargar muestra el mensaje de no-op.
- Borrar `privado` elimina la carpeta local y no modifica el repo.
- Al reiniciar la app, `privado` sigue marcada como privada.

## Verificación

- Tests de `isPrivatePath`/`filterPrivate` en core.
- E2E de desktop con creación, exclusión del repo, no-op y borrado local.
- Typechecks, bundle Android y prueba manual en Expo Go.
