# Tareas: Estados de acciones y paridad

**Feature**: `002-action-states-parity` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Fase 1: Setup

- [x] T001 Crear `packages/core/src/action.ts` con `ActionState`, constructores y helpers
- [x] T002 Exportar el módulo desde `packages/core/src/index.ts`
- [x] T003 [P] Añadir `packages/core/test/action.test.ts`

## Fase 2: Foundational

- [x] T004 Implementar `actionLabel` y `summarizeSync` con textos únicos
- [x] T005 Verificar que mobile puede importar el módulo sin dependencias de Node

## Fase 3: US1 — Feedback de sincronización (P1)

- [x] T006 [US1] Reemplazar `busy` por `busyAction` en desktop
- [x] T007 [US1] Mostrar "Subiendo..." / "Descargando..." en desktop
- [x] T008 [US1] Mostrar resumen de éxito en desktop
- [x] T009 [P] [US1] Reemplazar `busy` por `busyAction` en mobile
- [x] T010 [P] [US1] Mostrar etiquetas y resumen en mobile

## Fase 4: US2 — Reintento (P2)

- [x] T011 [US2] Guardar `lastFailedSync` y renderizar "Reintentar" en desktop
- [x] T012 [US2] Guard de doble ejecución con `runningRef` en desktop
- [x] T013 [P] [US2] Reintento y guard en mobile
- [x] T014 [US2] Verificar que el token no aparece en la UI de error

## Fase 5: US3 — Paridad (P3)

- [x] T015 [P] [US3] Añadir `testID` de estado (`text-status`) y reintento (`btn-retry`) en mobile
- [x] T016 [P] [US3] Usar las mismas funciones del core en ambas apps
- [x] T017 [US3] Documentar el contrato en README

## Fase 6: Verificación

- [x] T018 Ampliar `apps/desktop/e2e/smoke.spec.ts` con etiquetas, resumen, error y reintento
- [x] T019 Ejecutar `pnpm test` (core + typechecks)
- [x] T020 Ejecutar `pnpm desktop:test:e2e`
- [x] T021 Verificar que no hay regresiones en conflictos ni huérfanos

## Dependencias

- T001 bloquea T004, T006–T010.
- T006 bloquea T007, T008, T011, T012.
- T009 bloquea T010, T013, T015.
- T018 depende de T006–T013.

## Criterio de terminado

- 45+ tests de core en verde.
- E2E de escritorio verifica loading, success, error y retry.
- Typechecks de core, desktop y mobile en verde.
- Sin cambios en `sync.ts`, `conflict.ts` ni `github.ts`.

## Verificación (2026-10-27)

- `pnpm test`: 45 tests en 6 archivos; typechecks de core, desktop y mobile OK.
- `pnpm desktop:test:e2e`: 1 test E2E, ~8 s; verifica etiqueta de carga,
  deshabilitado, resumen de éxito, error y reintento.
- `pnpm core:check`: OK.
- `pnpm mobile:test:e2e`: omitido (Maestro no instalado); `testID` y typecheck
  cubren la estructura.
- Sin cambios en `sync.ts`, `conflict.ts` ni `github.ts`.
