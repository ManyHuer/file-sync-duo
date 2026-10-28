# Plan de implementación: Estados de acciones y paridad

**Branch**: `002-action-states-parity` | **Date**: 2026-10-27 | **Spec**: [spec.md](./spec.md)

## Resumen

Introducir un contrato compartido de estados en `packages/core` y aplicarlo a
las dos apps: etiquetas de progreso, bloqueo de doble ejecución, resumen de
resultado y reintento tras error. La UI sigue siendo independiente por
plataforma; solo se comparte la lógica pura.

## Contexto técnico

**Lenguaje/Versión**: TypeScript 5.5–5.9; React 18 (desktop) y React 19 (mobile)

**Dependencias principales**: ninguna nueva

**Almacenamiento**: sin cambios

**Testing**: Vitest (core), Playwright `_electron` (desktop), Maestro (mobile)

**Plataforma objetivo**: Windows (desktop), Android (mobile)

**Tipo de proyecto**: monorepo con UI duplicada por plataforma

**Restricciones**: no compartir componentes React; no cambiar la lógica de sync;
no introducir librerías de estado

**Escala/Alcance**: 1 módulo nuevo en core, 2 apps, 1 E2E ampliada

## Constitution Check

| Principio | Cumple | Evidencia |
|---|---|---|
| I. Core puro y testeable | ✅ | `action.ts` es puro y tiene tests |
| II. Paridad desktop/mobile | ✅ | Mismas funciones y mismos textos en ambas apps |
| III. Estados de acción explícitos | ✅ | Implementa el contrato completo |
| IV. Contrato de sync intacto | ✅ | No se toca `sync.ts` ni `conflict.ts`; tests siguen verdes |
| V. Seguridad del token | ✅ | E2E verifica que no aparece en la UI |
| VI. Simplicidad | ✅ | Sin dependencias nuevas; un módulo pequeño |

**Violaciones**: ninguna.

## Estructura del proyecto

```text
packages/core/src/action.ts        # ActionState + helpers + summarizeSync
packages/core/test/action.test.ts

apps/desktop/src/App.tsx           # busyAction, statusMessage, lastFailedSync, guard
apps/desktop/src/styles.css        # .success, .error-row
apps/desktop/e2e/smoke.spec.ts     # etiquetas, resumen, error, reintento

apps/mobile/App.tsx                # mismos estados y textos
apps/mobile/.maestro/              # testIDs ya existentes
```

**Decisión de estructura**: la lógica de estado va al core porque es pura y
compartible; los componentes no se comparten porque los renderers son distintos.

## Fases

### Fase 0 — Investigación

Confirmar que `@filesync/core` se puede importar en mobile sin arrastrar
dependencias de Node (solo tipos y funciones puras). Se verificó con el
typecheck de mobile.

### Fase 1 — Diseño

- `ActionState` + constructores + `actionLabel` + `summarizeSync`.
- `busyAction` por app para saber qué botón muestra progreso.
- `runningRef` para el guard de doble ejecución.
- `lastFailedSync` para el reintento.

### Fase 2 — Implementación

Ver `tasks.md`.

## Complexity Tracking

No hay violaciones. El guard con `useRef` es la solución mínima para el doble
click; usar un estado adicional sería insuficiente por el batching de React.

## Riesgos

- Duplicación de textos entre apps: se mitiga centralizando etiquetas y resumen
  en el core.
- Diferencias de comportamiento por React 18 vs 19: el contrato es el mismo;
  se cubre con typecheck y pruebas manuales/Maestro.
- El reintento podría repetir una operación ya aplicada: es idempotente porque
  el sync compara mtime y contenido antes de subir.
