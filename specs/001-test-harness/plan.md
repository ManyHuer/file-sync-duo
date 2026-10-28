# Plan de implementación: Red de seguridad de pruebas

**Branch**: `001-test-harness` | **Date**: 2026-10-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-test-harness/spec.md`

## Resumen

Construir tres niveles de verificación sobre el monorepo: pruebas unitarias del
core con Vitest, una prueba de humo real de Electron con Playwright y flujos
Maestro para Android. El objetivo no es cobertura exhaustiva, sino una red que
detecte regresiones en sync, conflictos, huérfanos y en el ciclo de vida de las
acciones principales, sin depender de GitHub real ni de secretos.

## Contexto técnico

**Lenguaje/Versión**: TypeScript 5.5–5.9, Node 20.20.1

**Dependencias principales**: `vitest`, `@playwright/test` (incluye `_electron`),
`tsx` (ya presente), `maestro` (CLI externa)

**Almacenamiento**: directorios temporales por ejecución; sin tocar
`Documents/FileSync` ni SecureStore

**Testing**: Vitest (core), Playwright `_electron` (desktop), Maestro (mobile)

**Plataforma objetivo**: Windows para desktop E2E; Linux/Windows para core;
Android para mobile

**Tipo de proyecto**: monorepo pnpm con paquete compartido y dos apps

**Objetivos de rendimiento**: core < 30 s; desktop E2E < 2 min; mobile < 3 min

**Restricciones**: sin secretos, sin red real, sin procesos Electron huérfanos,
sin cambios de comportamiento en producción

**Escala/Alcance**: ~540 líneas de core, 2 apps, 3 suites nuevas

## Constitution Check

*GATE: debe pasar antes de Fase 0. Re-evaluar después de Fase 1.*

| Principio | Cumple | Evidencia |
|---|---|---|
| I. Core puro y testeable | ✅ | Los tests viven en `packages/core/test`, sin Electron ni React |
| II. Paridad desktop/mobile | ✅ | Historia P2 (desktop) y P3 (mobile); ambas en el alcance |
| III. Estados de acción explícitos | ✅ | FR-007/FR-008 verifican busy, disabled y recuperación tras error |
| IV. Contrato de sync intacto | ✅ | Los tests fijan el comportamiento actual de conflicto y huérfanos |
| V. Seguridad del token | ✅ | FR-003/FR-004: remoto simulado y token falso; se prueba que no se filtre |
| VI. Simplicidad | ✅ | Solo se añaden Vitest, Playwright y flujos Maestro |

**Violaciones que requieren justificación**: una sola, en Complexity Tracking
(variable de entorno para aislar el directorio de sincronización en E2E).

## Estructura del proyecto

### Documentación (esta feature)

```text
specs/001-test-harness/
├── spec.md
├── plan.md
├── research.md
└── tasks.md
```

### Código fuente

```text
packages/core/
├── src/
│   ├── sync.ts
│   ├── conflict.ts
│   ├── github.ts
│   └── types.ts
├── test/
│   ├── conflict.test.ts
│   ├── sync.test.ts
│   ├── orphans.test.ts
│   └── helpers/fakes.ts
├── vitest.config.ts
└── package.json

apps/desktop/
├── electron/main.ts          # + override FILESYNC_HOME para tests
├── e2e/
│   ├── smoke.spec.ts
│   └── fixtures/temp-home.ts
├── playwright.config.ts
└── package.json

apps/mobile/
├── .maestro/
│   ├── 01-create-file.yaml
│   ├── 02-navigate-folders.yaml
│   └── 03-delete-file.yaml
└── App.tsx                   # + testID en acciones críticas
```

**Decisión de estructura**: tests junto al paquete que prueban; E2E en la app
correspondiente. No se crea un paquete `testing` separado: sería una capa extra
sin beneficio para tres suites.

## Fase 0 — Investigación

- Confirmar que `@playwright/test` puede lanzar Electron 31 con `_electron`.
- Confirmar que Vitest funciona con el `tsconfig` actual y ESM (`"type": "module"`).
- Verificar cómo aislar el directorio de configuración de Electron sin tocar
  `Documents/FileSync`.
- Verificar el estado de Maestro en Windows (nativo vs WSL) y si hay emulador.

Salida: `research.md`.

## Fase 1 — Diseño

- Fakes en memoria de `DriveClient` y `LocalFS` reutilizables.
- Fixtures de tiempo deterministas (sin depender del reloj real en conflictos).
- `FILESYNC_HOME` como override del directorio base en `main.ts`.
- Intercepción de red de Playwright (`page.route`) para simular GitHub.
- Contratos de los flujos Maestro: textos visibles y `testID` estables.

Salida: `data-model.md` (fakes), `contracts/test-commands.md`,
`quickstart.md`.

## Fase 2 — Tareas

Ver `tasks.md`. Orden:

1. Vitest + tests del core.
2. Playwright + smoke de Electron.
3. Maestro + flujos mobile.
4. Scripts, documentación y CI.

## Complexity Tracking

| Violación | Por qué es necesaria | Alternativa simple rechazada |
|---|---|---|
| Variable `FILESYNC_HOME` en `main.ts` | Sin ella, la E2E escribiría en `Documents/FileSync` real y no sería repetible | `--user-data-dir` de Electron no cambia `app.getPath("documents")`; mockear el módulo `fs` en el proceso principal es más frágil |
| `testID` en mobile | Maestro necesita selectores estables; el texto cambia con el idioma | Buscar solo por texto funciona hoy, pero se rompe con cualquier copy change |

## Riesgos

- **Maestro no instalado**: los flujos quedan listos y documentados; la suite se
  marca como omitida hasta que exista el binario.
- **Electron E2E en CI**: requiere display; se deja fuera de CI y se ejecuta
  localmente.
- **Red real**: cualquier llamada no interceptada debe fallar ruidosamente, no
  pasar silenciosamente.
