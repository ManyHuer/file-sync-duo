# Especificación de Feature: Mejora de UI (dirección 1)

**Feature Branch**: `004-ui-refresh`

**Created**: 2026-10-27

**Status**: Implemented (desktop) / pending mobile visual validation

**Input**: "Mantener el azul actual y mejorar jerarquía, spacing, tipografía y estados."

## Escenarios de usuario y pruebas *(obligatorio)*

### Historia de usuario 1 - Desktop más claro y consistente (Prioridad: P1)

Como usuario de escritorio, quiero que la interfaz tenga una jerarquía visual
clara, espaciado consistente y estados visibles, sin cambiar el flujo ni el
color azul actual.

**Por qué esta prioridad**: es la pantalla principal de trabajo y la que más se
usa para sincronizar.

**Prueba independiente**: abrir la app, recorrer configuración, acciones,
carpetas, archivos, modales y actividad; verificar foco, hover, disabled y
errores.

**Escenarios de aceptación**:

1. **Dado** un botón o input, **cuando** recibe foco por teclado, **entonces**
   muestra un anillo de foco visible.
2. **Dado** un botón en carga, **cuando** está deshabilitado, **entonces** se
   distingue claramente y no cambia de tamaño.
3. **Dado** una lista de archivos, **cuando** se pasa el ratón, **entonces** la
   fila se resalta sin mover el layout.
4. **Dado** una ventana estrecha, **cuando** se reduce, **entonces** las acciones
   y carpetas se reorganizan sin solaparse.

---

### Historia de usuario 2 - Mobile más legible y táctil (Prioridad: P2)

Como usuario de móvil, quiero textos más legibles, botones con área táctil
cómoda y estados de pulsación claros, manteniendo el tema oscuro y el azul.

**Por qué esta prioridad**: el uso principal es el teléfono y los toques
imprecisos son frecuentes.

**Prueba independiente**: abrir la app en Expo Go y recorrer configuración,
acciones, carpetas, archivos y modales.

**Escenarios de aceptación**:

1. **Dado** un botón principal, **cuando** se pulsa, **entonces** muestra un
   estado de pulsación y mantiene al menos 44 px de alto.
2. **Dado** un texto secundario, **cuando** se muestra, **entonces** usa el
   token de texto muted con line-height legible.
3. **Dado** una tarjeta de carpeta, **cuando** se pulsa, **entonces** se
   distingue del fondo y no se solapa con el botón de eliminar.
4. **Dado** un error o éxito, **cuando** aparece, **entonces** usa el color y
   espaciado del sistema.

---

### Historia de usuario 3 - Paridad y cero regresiones (Prioridad: P3)

Como usuario, quiero que la mejora visual no cambie la sincronización, los
conflictos, SAF, SecureStore ni los estados de acción.

**Por qué esta prioridad**: la UI no debe romper la lógica ya validada.

**Prueba independiente**: `pnpm test`, E2E de desktop y prueba manual en móvil.

**Escenarios de aceptación**:

1. **Dado** el cambio visual, **cuando** se ejecuta `pnpm test`, **entonces**
   45 tests y 3 typechecks pasan.
2. **Dado** el cambio visual, **cuando** se ejecuta la E2E de Electron,
   **entonces** pasa.
3. **Dado** móvil, **cuando** se sube/descarga, **entonces** los estados
   “Subiendo...”, resumen, error y reintento siguen funcionando.

---

### Casos de borde

- Ventana desktop muy estrecha.
- Texto de error largo.
- Nombre de archivo/carpeta muy largo.
- Modo de accesibilidad con movimiento reducido.
- Teclado sin ratón.
- Tema claro del sistema (la app sigue siendo oscura).

## Requisitos *(obligatorio)*

### Requisitos funcionales

- **FR-001**: Desktop DEBE usar variables CSS para color, spacing, radios,
  tipografía y sombras.
- **FR-002**: Mobile DEBE usar un módulo `theme.ts` con tokens equivalentes.
- **FR-003**: El azul primario DEBE seguir siendo `#1a73e8` (con un hover/pressed
  más oscuro).
- **FR-004**: La jerarquía tipográfica DEBE ser consistente (título, sección,
  cuerpo, secundario, mono).
- **FR-005**: Los botones e inputs DEBEN tener estados hover, focus-visible,
  pressed y disabled.
- **FR-006**: Los botones móviles DEBEN tener al menos 44 px de alto.
- **FR-007**: Las tarjetas, listas y modales DEBEN usar los mismos tokens de
  superficie, borde y radio.
- **FR-008**: La UI DEBE respetar `prefers-reduced-motion`.
- **FR-009**: NO se DEBE cambiar la lógica de sync, conflictos, SAF ni
  SecureStore.
- **FR-010**: NO se DEBEN añadir dependencias ni fuentes externas.

### Entidades clave

- **Token**: valor semántico de color, spacing, radio, tipografía o sombra.
- **Componente visual**: botón, card, input, fila, carpeta, modal, estado.
- **Dirección 1**: tema oscuro existente + azul `#1a73e8`.

## Criterios de éxito *(obligatorio)*

### Resultados medibles

- **SC-001**: `pnpm test` pasa (45 tests + 3 typechecks).
- **SC-002**: `pnpm desktop:test:e2e` pasa.
- **SC-003**: No hay colores hardcodeados en los estilos principales de desktop.
- **SC-004**: Los estilos principales de mobile usan `theme.ts`.
- **SC-005**: La app móvil se ve consistente en Expo Go 58.x.
- **SC-006**: La E2E sigue verificando estados de carga, éxito, error y retry.

## Supuestos

- Se mantiene el tema oscuro y el azul actual.
- No se introduce una librería de componentes ni Tailwind.
- La tipografía usa la pila del sistema (sin descargar fuentes).
- La primera pasada es de tokens y pulido, no un rediseño de layout.
- La estructura de `App.tsx` se refactoriza en una fase posterior si hace falta.
