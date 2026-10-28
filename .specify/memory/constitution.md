# Constitución de FileSync

## Principios fundamentales

### I. Core puro y testeable (NO NEGOCIABLE)

`packages/core` contiene la lógica de sincronización y debe permanecer libre de
dependencias de Electron, React o React Native. Toda regla de negocio (sync,
conflictos, huérfanos, metadatos) vive ahí y debe poder ejecutarse con Node y
Vitest sin UI.

- La UI no implementa lógica de sync; solo presenta estado y dispara acciones.
- Cada función exportada del core debe tener al menos un test que cubra el
  camino feliz y un caso de borde.
- Un cambio en el contrato del core exige actualizar tipos y tests en el mismo
  cambio.

### II. Paridad desktop/mobile

Toda feature de usuario se especifica para ambas apps. Si una plataforma no
aplica, el spec debe decirlo explícitamente y justificarlo.

- Los nombres de acciones visibles deben ser equivalentes ("Subir a GitHub",
  "Descargar de GitHub").
- Un comportamiento nuevo en desktop sin equivalente en mobile (o viceversa)
  requiere justificación en `plan.md` y una tarea de seguimiento.

### III. Estados de acción explícitos

Ningún botón o acción puede quedar sin contrato de estado. Toda acción declara:

- `idle`: disponible.
- `loading`: en curso, deshabilitada, con progreso visible.
- `success`: resultado visible y estado limpio.
- `error`: causa accionable y opción de reintento.
- `blocked`: precondition no cumplida (sin config, sin red, sin permisos).

El doble click no puede disparar dos operaciones. Un error no puede dejar la UI
en `loading` permanente.

### IV. Contrato de sincronización intacto

El formato de `.filesync-meta.json`, la convención
`name_conflict_YYYY-MM-DD_HH-mm-ss.md` y la semántica de `findOrphans` son
contratos públicos del producto. No se cambian sin:

1. Actualizar la especificación.
2. Añadir tests que prueben el comportamiento anterior y el nuevo.
3. Documentar la migración en `quickstart.md`.

### V. Seguridad del token y del filesystem

- El token de GitHub nunca se loguea, imprime ni incluye en mensajes de error.
- Desktop persiste la configuración solo en `Documents/FileSync/config.json`;
  mobile solo en SecureStore.
- Electron mantiene `nodeIntegration: false`; todo acceso nativo pasa por
  `preload.ts`.
- No se escribe fuera del directorio de sincronización configurado.

### VI. Simplicidad deliberada

Se prefiere la solución más pequeña que cumpla el spec. Dependencias nuevas,
abstracciones y capas extra deben justificarse en `plan.md` (Complexity
Tracking). YAGNI aplica: no se construye para un futuro hipotético.

## Restricciones adicionales

- **Stack**: pnpm 10, TypeScript estricto, Electron 31 + React 18 (desktop),
  Expo 54 + React Native 0.81 + React 19 (mobile).
- **Mobile filesystem**: usar `expo-file-system/legacy`; no migrar sin verificar
  compatibilidad con el SDK de Expo.
- **Sin linter/formatter configurado**: no introducir uno sin una tarea
  explícita en el spec.
- **CI**: los workflows de GitHub Actions solo compilan releases por tag; las
  pruebas nuevas deben poder correr localmente y en CI sin secretos reales.

## Flujo de desarrollo y gates

Antes de declarar una feature terminada:

```powershell
pnpm core:test
pnpm --filter desktop typecheck
pnpm --filter mobile typecheck
pnpm desktop:test:e2e
maestro test apps/mobile/.maestro   # cuando aplique
```

- `converge` solo puede reportar `Converged` si los gates pasan.
- Los checklists de requisitos son del revisor; el agente no los autoaprueba.
- No se hace commit ni push automático.

## Gobernanza

Esta constitución prevalece sobre prácticas informales. Cualquier excepción debe
registrarse en la tabla de Complexity Tracking del `plan.md` correspondiente.

- Enmiendas: requieren justificación escrita, actualización de esta constitución
  y revisión de los specs activos que se vean afectados.
- Versionado semántico: MAYOR si elimina o redefine un principio; MENOR si añade
  uno; PARCHE si aclara redacción.
- Cumplimiento: cada `/speckit.plan` verifica estos principios y cada
  `/speckit.converge` comprueba que se respetaron en la implementación.

**Version**: 1.0.0 | **Ratified**: 2026-10-27 | **Last Amended**: 2026-10-27
