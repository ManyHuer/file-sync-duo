# Especificación de Feature: Estados de acciones y paridad desktop/mobile

**Feature Branch**: `002-action-states-parity`

**Created**: 2026-10-27

**Status**: Implemented

**Input**: User description: "Contrato de estados de acciones y paridad desktop/mobile"

## Escenarios de usuario y pruebas *(obligatorio)*

### Historia de usuario 1 - Saber qué está pasando al sincronizar (Prioridad: P1)

Como usuario, quiero que al pulsar "Subir" o "Descargar" la interfaz me diga
que la operación está en curso, me impida pulsar de nuevo y me muestre el
resultado, para no duplicar operaciones ni quedarme en duda.

**Por qué esta prioridad**: es el corazón de la percepción de calidad: un botón
que no responde o que responde dos veces rompe la confianza.

**Prueba independiente**: en la app de escritorio, pulsar Subir y observar
"Subiendo...", el botón deshabilitado y el mensaje de resumen al terminar.

**Escenarios de aceptación**:

1. **Dado** que hay archivos pendientes, **cuando** se pulsa "Subir a GitHub",
   **entonces** el botón cambia a "Subiendo...", queda deshabilitado y no se
   puede disparar otra operación.
2. **Dado** que la subida termina, **cuando** se completa, **entonces** se
   muestra "Subida completada: N subidos, conflictos: X, sin cambios: Y" y el
   botón vuelve a estar disponible.
3. **Dado** que se pulsa "Descargar de GitHub", **cuando** termina,
   **entonces** se muestra el resumen equivalente de descarga.

---

### Historia de usuario 2 - Reintentar tras un error (Prioridad: P2)

Como usuario, quiero ver la causa del error y poder reintentar la misma acción
sin volver a configurar nada.

**Por qué esta prioridad**: los fallos de red y token son los más frecuentes;
obligar a repetir todo el flujo es fricción innecesaria.

**Prueba independiente**: forzar un fallo de subida y comprobar que aparece el
error y el botón "Reintentar", y que al pulsarlo la operación se completa.

**Escenarios de aceptación**:

1. **Dado** un fallo de red, **cuando** la subida falla, **entonces** se muestra
   el mensaje de error, el botón vuelve a estar disponible y aparece
   "Reintentar".
2. **Dado** el error visible, **cuando** se pulsa "Reintentar", **entonces** se
   ejecuta la misma dirección (push/pull), desaparece el error y se muestra el
   resumen.
3. **Dado** un token inválido, **cuando** falla, **entonces** el mensaje es
   "Token inválido o expirado..." y nunca incluye el token.

---

### Historia de usuario 3 - Misma experiencia en mobile (Prioridad: P3)

Como usuario de la app móvil, quiero los mismos estados, etiquetas y mensajes
que en escritorio.

**Por qué esta prioridad**: la app se usa en ambos dispositivos; la
inconsistencia genera dudas sobre si la operación se ejecutó.

**Prueba independiente**: revisar que mobile importa y usa las mismas funciones
de estado (`actionLabel`, `summarizeSync`) y que sus botones se deshabilitan y
cambian de etiqueta.

**Escenarios de aceptación**:

1. **Dado** mobile conectado, **cuando** se pulsa "Subir a GitHub",
   **entonces** muestra "Subiendo..." y se deshabilita.
2. **Dado** un error de red en mobile, **cuando** falla, **entonces** muestra el
   error y un botón "Reintentar".
3. **Dado** un resultado exitoso, **cuando** termina, **entonces** muestra el
   mismo formato de resumen que escritorio.

---

### Casos de borde

- Doble click en el mismo instante.
- Error mientras hay un modal de huérfanos abierto.
- Cambio de carpeta durante una operación.
- Token expirado a mitad de la operación.
- Operación cancelada por el usuario (no aplica hoy; no hay cancelación).
- Texto de error muy largo.

## Requisitos *(obligatorio)*

### Requisitos funcionales

- **FR-001**: El core DEBE exponer un contrato `ActionState` con estados
  `idle`, `loading`, `success`, `error` y `blocked`.
- **FR-002**: Las acciones de sincronización DEBEN cambiar su etiqueta a
  "Subiendo..." o "Descargando..." mientras están en curso.
- **FR-003**: Los botones DEBEN estar deshabilitados mientras hay una acción en
  curso.
- **FR-004**: Una segunda ejecución de la misma acción DEBE ignorarse aunque el
  botón reciba dos eventos antes de re-renderizar.
- **FR-005**: Al terminar una sincronización, la UI DEBE mostrar un resumen con
  subidos/descargados, conflictos y sin cambios.
- **FR-006**: Ante un error de sincronización, la UI DEBE mostrar el error y un
  botón "Reintentar" que repita la misma dirección.
- **FR-007**: El token NUNCA debe aparecer en mensajes de error ni en la UI.
- **FR-008**: Desktop y mobile DEBEN usar las mismas funciones de etiqueta y
  resumen del core.
- **FR-009**: Eliminar archivos/carpetas DEBE seguir bloqueando la UI mientras
  dura la operación.
- **FR-010**: Los cambios NO DEBEN alterar el comportamiento de sincronización
  ni los conflictos.

### Entidades clave

- **ActionState**: estado y mensaje de una acción.
- **SyncSummary**: conteos de subidos, descargados, conflictos y omitidos.
- **Acción en curso**: `push`, `pull`, `delete`, `delete-folder` u `orphans`.

## Criterios de éxito *(obligatorio)*

### Resultados medibles

- **SC-001**: La E2E de escritorio verifica etiqueta de carga, deshabilitado,
  resumen, error y reintento en menos de 2 minutos.
- **SC-002**: `pnpm typecheck` pasa en core, desktop y mobile.
- **SC-003**: Los tests del core siguen en verde (≥ 39 tests) y no hay
  regresiones de sync.
- **SC-004**: Ambas apps importan `actionLabel` y `summarizeSync` del core.
- **SC-005**: En mobile, los estados son verificables con Maestro cuando esté
  instalado; sin Maestro, el typecheck y los `testID` cubren la estructura.

## Supuestos

- No se añade cancelación de operaciones en esta fase.
- Los textos siguen en español.
- La app móvil no comparte componentes con desktop; solo lógica pura.
- El botón "Reintentar" solo aplica a push/pull, no a borrados.
