# Plan de implementación: Mejora de UI (dirección 1)

**Branch**: `004-ui-refresh` | **Date**: 2026-10-27 | **Spec**: [spec.md](./spec.md)

## Resumen

Introducir un sistema de tokens compartido conceptualmente entre desktop y
mobile, manteniendo el tema oscuro y el azul `#1a73e8`. Pulir jerarquía,
espaciado, tipografía y estados sin cambiar el layout ni la lógica.

## Contexto técnico

**Desktop**: React 18 + CSS plano (`styles.css`), Electron 31.

**Mobile**: Expo SDK 58 + React Native 0.88 + `StyleSheet`.

**Dependencias nuevas**: ninguna.

**Tipografía**: pila del sistema; sin fuentes externas.

**Testing**: Vitest, Playwright `_electron`, typechecks, Expo Go manual.

**Restricciones**: no tocar `packages/core`, `sync.ts`, `conflict.ts` ni la
lógica de SAF/SecureStore.

## Constitution Check

| Principio | Cumple | Evidencia |
|---|---|---|
| I. Core puro y testeable | ✅ | No se toca `packages/core` |
| II. Paridad desktop/mobile | ✅ | Mismos tokens y criterios en ambas apps |
| III. Estados de acción explícitos | ✅ | Se conservan y se refuerzan visualmente |
| IV. Contrato de sync intacto | ✅ | Sin cambios en sync/conflictos |
| V. Seguridad del token | ✅ | Sin cambios |
| VI. Simplicidad | ✅ | Solo CSS variables y un `theme.ts`; sin librerías |

**Violaciones**: ninguna.

## Estructura

```text
design-system/filesync/MASTER.md   # tokens y reglas de la dirección 1
apps/desktop/src/styles.css        # variables + pulido
apps/mobile/theme.ts               # tokens de mobile
apps/mobile/App.tsx                # StyleSheet usa theme.ts
```

## Fases

### Fase 1 — Tokens

- Desktop: `:root` con colores, spacing, radios, tipografía y sombras.
- Mobile: `theme.ts` con la misma escala.
- Documento `MASTER.md` como fuente de verdad.

### Fase 2 — Desktop

- Jerarquía: título, sección, cuerpo, muted, mono.
- Botones: hover, focus-visible, pressed, disabled.
- Inputs: foco con anillo, placeholder, altura.
- Cards, filas, carpetas y modales con tokens.
- Responsive básico y `prefers-reduced-motion`.

### Fase 3 — Mobile

- `theme.ts` importado en `App.tsx`.
- Colores, spacing, radios y tipografía de los estilos principales.
- Botones con altura mínima 44 px y estado pressed.
- Tarjetas y filas con tokens.
- Mantener toda la lógica y los `testID`.

### Fase 4 — Verificación

- `pnpm test`.
- `pnpm desktop:test:e2e`.
- `pnpm --filter mobile typecheck`.
- Prueba manual en Expo Go.
- Captura desktop antes/después (opcional).

## Riesgos

- **Refactor masivo**: no se reescribe `App.tsx`; solo se tokenizan estilos.
- **Contraste**: el azul sobre fondo oscuro debe cumplir 4.5:1 en texto; se
  verifica con los valores actuales.
- **Regresión visual**: los `testID` y la estructura se mantienen.
- **Fuentes**: usar la pila del sistema evita diferencias desktop/mobile.
