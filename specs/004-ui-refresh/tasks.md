# Tareas: Mejora de UI (dirección 1)

**Feature**: `004-ui-refresh` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Fase 1: Tokens

- [x] T001 Crear tokens CSS en `apps/desktop/src/styles.css`
- [x] T002 Crear `apps/mobile/theme.ts` con colores, spacing, radios y tipografía
- [x] T003 Documentar la dirección en `design-system/filesync/MASTER.md`

## Fase 2: Desktop

- [x] T004 Aplicar tokens a cards, inputs, botones, listas, carpetas, modales y log
- [x] T005 Mejorar jerarquía tipográfica y espaciado
- [x] T006 Añadir focus-visible, hover, pressed y disabled
- [x] T007 Añadir `role="status"` / `role="alert"` y `aria-busy`
- [x] T008 Reemplazar el emoji de carpeta por un icono SVG
- [x] T009 Añadir responsive básico y `prefers-reduced-motion`

## Fase 3: Mobile

- [x] T010 Importar `theme.ts` y tokenizar los estilos principales
- [x] T011 Aumentar touch targets a 44 px y mejorar tipografía
- [x] T012 Añadir estados pressed en botones y carpetas
- [x] T013 Reemplazar el emoji de carpeta por una forma nativa
- [x] T014 Mantener todos los `testID` y la lógica existente

## Fase 3b: Ajuste de layout mobile

- [x] T020 Mover “Desconectar” a la fila de conexión y dejar dos acciones primarias

## Fase 3c: Carpetas

- [x] T021 Separar “abrir carpeta” de “eliminar” y añadir chevron de navegación
- [x] T022 Convertir “Eliminar” en una acción secundaria (texto rojo + icono)
- [x] T023 Limitar nombres largos a dos líneas con ellipsis
- [x] T024 Aplicar el rediseño en desktop y mobile

## Fase 3d: Estados vacíos

- [x] T025 Crear un componente `EmptyState` en desktop y mobile
- [x] T026 Aplicarlo a “sin notas”, “raíz sin archivos” y “carpeta vacía”
- [x] T027 Verificar que el estado vacío no rompe la carga de archivos

## Fase 3e: Log de actividad

- [x] T028 Ocultar las líneas `[debug]` por defecto en desktop y mobile
- [x] T029 Añadir toggle “Ver detalle” / “Ocultar detalle”
- [x] T030 Mantener el `testID="log"` y el scroll del log

## Fase 3f: Formularios

- [x] T031 Añadir etiquetas visibles a owner, repo y token
- [x] T032 Añadir `autoCapitalize`, `autoCorrect` y `spellCheck`
- [x] T033 Añadir mostrar/ocultar token
- [x] T034 Añadir ayuda de scope y labels accesibles en inputs inline

## Fase 3g: Iconografía

- [x] T035 Reemplazar `+ Nueva carpeta` por un icono en desktop y mobile
- [x] T036 Reemplazar `← Volver` por un chevron en desktop y mobile
- [x] T037 Reemplazar `☑/☐` por un checkbox propio en mobile
- [x] T038 Quitar el emoji `📁` de las cabeceras de carpeta

## Fase 3h: Modales

- [x] T039 Reemplazar los `Alert` de mobile por un `ConfirmDialog` propio
- [x] T040 Cubrir borrar archivos, borrar carpeta y sincronizar huérfanos
- [x] T041 Añadir `role="dialog"`, `aria-modal` y acento rojo en desktop
- [x] T042 Añadir `testID` a las acciones del modal y actualizar Maestro

## Fase 4: Verificación

- [x] T015 `pnpm test` (45 tests + 3 typechecks)
- [x] T016 `pnpm desktop:test:e2e`
- [x] T017 `expo export --platform android`
- [x] T018 Capturas desktop antes/después
- [ ] T019 Validación visual manual en Expo Go (pendiente)

## Verificación (2026-10-27)

| Gate | Resultado |
|---|---|
| `pnpm test` | 45 tests + typechecks core/desktop/mobile |
| `pnpm desktop:test:e2e` | 1 test, ~10 s |
| `expo export --platform android` | 630 módulos, bundle 1.7 MB |
| Capturas desktop | `%TEMP%\filesync-desktop-config.png`, `filesync-desktop-folders.png`, `filesync-desktop-empty.png`, `filesync-desktop-form.png`, `filesync-desktop-icons-root.png`, `filesync-desktop-icons-folder.png`, `filesync-desktop-modal.png` |

**Pendiente**: abrir la app en Expo Go y revisar spacing, tipografía, botones,
tarjetas de carpeta y estados vacíos en el teléfono.
