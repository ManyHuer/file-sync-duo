# Tareas: Red de seguridad de pruebas

**Feature**: `001-test-harness` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Fase 1: Setup

- [x] T001 Añadir Vitest a `packages/core` (`devDependencies`, `test`, `test:watch`) en `packages/core/package.json`
- [x] T002 Crear `packages/core/vitest.config.ts` con entorno `node` e includes `test/**/*.test.ts`
- [x] T003 [P] Añadir `@playwright/test` y `playwright` a `apps/desktop/package.json` con scripts E2E
- [x] T004 [P] Añadir scripts `mobile:test:e2e` y `test`/`test:e2e` en el `package.json` raíz

## Fase 2: Foundational

- [x] T005 Crear fakes en memoria `FakeDriveClient` y `FakeLocalFS` en `packages/core/test/helpers/fakes.ts`
- [x] T006 Añadir override `FILESYNC_HOME` en `apps/desktop/electron/main.ts` sin cambiar el comportamiento por defecto
- [x] T007 Crear fixture de directorio temporal en `apps/desktop/e2e/fixtures/temp-home.ts`
- [x] T008 Crear `apps/desktop/playwright.config.ts` con build previo, timeout y reporte
- [x] T009 Documentar `FILESYNC_HOME` en `AGENTS.md`

## Fase 3: US1 — Tests del core (P1)

- [x] T010 [P] [US1] Tests de `conflictName` y `hasConflictSuffix` en `packages/core/test/conflict.test.ts`
- [x] T011 [P] [US1] Tests de `isHiddenPath` y `findOrphans` en `packages/core/test/orphans.test.ts`
- [x] T012 [US1] Tests de `sync.push` (nuevo, modificado, igual, conflicto) en `packages/core/test/sync-push.test.ts`
- [x] T013 [US1] Tests de `sync.pull` (nuevo, local más nuevo, igual, 404) en `packages/core/test/sync-pull.test.ts`
- [x] T014 [US1] Tests de `GitHubClient` con `fetch` mockeado (token, 401, timeout, base64) en `packages/core/test/github.test.ts`
- [x] T015 [US1] Verificar que `pnpm core:test` pasa y tarda menos de 30 s

## Fase 4: US2 — E2E de escritorio (P2)

- [x] T016 [US2] Implementar `apps/desktop/e2e/smoke.spec.ts` con escenarios de configuración, subida, descarga, carpetas y error
- [x] T017 [US2] Interceptar `api.github.com` con respuestas simuladas y fallo explícito en rutas no contempladas
- [x] T018 [US2] Verificar cierre limpio de Electron y limpieza del directorio temporal
- [x] T019 [US2] Ejecutar `pnpm desktop:test:e2e` y corregir fallos

## Fase 5: US3 — Flujos mobile (P3)

- [x] T020 [P] [US3] Añadir `testID` a las acciones críticas de `apps/mobile/App.tsx`
- [x] T021 [P] [US3] Crear `apps/mobile/.maestro/01-create-file.yaml`
- [x] T022 [P] [US3] Crear `apps/mobile/.maestro/02-navigate-folders.yaml`
- [x] T023 [P] [US3] Crear `apps/mobile/.maestro/03-delete-file.yaml`
- [x] T024 [US3] Crear script `apps/mobile/scripts/test-e2e.mjs` que detecte Maestro y dé instrucciones si falta
- [x] T025 [US3] Documentar requisitos de Maestro y `appId` en `apps/mobile/.maestro/README.md`

## Fase 6: Polish

- [x] T026 Actualizar `README.md` y `AGENTS.md` con los comandos nuevos
- [x] T027 Crear workflow `.github/workflows/test.yml` para core + typechecks
- [x] T028 Ejecutar todos los gates y registrar resultados
- [x] T029 Ejecutar `/speckit.converge` y corregir brechas

## Dependencias

- T005 bloquea T010–T014 y T016.
- T006 bloquea T016–T019.
- T008 bloquea T016.
- T020 bloquea T021–T023.
- T026 depende de T004 y T024.

## Criterio de terminado

- `pnpm core:test` verde y < 30 s.
- `pnpm desktop:test:e2e` verde en local.
- Flujos Maestro presentes y ejecutables si Maestro está instalado.
- README/AGENTS actualizados.
- `converge` sin brechas abiertas.

## Convergence (2026-10-27)

- [x] T030 Añadir cobertura de `GitHubClient.touch` y `GitHubClient.delete` (SC-002)
- [x] T031 Verificación final: tests de core, typechecks y E2E desktop en verde
- [x] T032 Documentar la limitación de Maestro (no instalado; flujos presentes y omitidos)

### Resultado

- `pnpm test`: 39 tests en 5 archivos, 1.55 s; typechecks de core, desktop y mobile OK.
- `pnpm desktop:test:e2e`: 1 test E2E, 6.4 s; Electron cerrado y temporal limpio.
- `pnpm mobile:test:e2e`: sale 0 con instrucciones porque Maestro no está instalado.
- YAML de Maestro válido (parseado con PyYAML).
- Brecha conocida: SC-004 (< 3 min en emulador) no verificable sin Maestro y un
  dispositivo conectado. No es una brecha de código.
