# Investigación: Red de seguridad de pruebas

**Feature**: `001-test-harness` | **Fecha**: 2026-10-27

## Hallazgos

### 1. Vitest en `packages/core`

- El paquete es ESM (`"type": "module"`) y exporta TypeScript directamente.
- `tsx` ya está instalado y funciona con Node 20.
- Vitest puede ejecutar `.ts` sin build previo y usa `node` como entorno.
- `btoa`/`atob` y `fetch` son globales en Node 20, así que `github.ts` no
  requiere polyfills en tests.

**Decisión**: Vitest 3 con configuración mínima (`environment: "node"`,
`include: ["test/**/*.test.ts"]`).

### 2. Playwright + Electron

- Playwright expone `_electron.launch()` en el paquete `playwright`.
- `@playwright/test` aporta runner, fixtures y reportes.
- La app carga `dist/index.html` si no existe `VITE_DEV_SERVER_URL`, y
  `package.json` apunta `main` a `dist-electron/main.js`.
- Por tanto, la E2E debe ejecutar `pnpm build` antes de lanzar Electron, o
  levantar Vite y pasar `VITE_DEV_SERVER_URL`.

**Decisión**: build previo (`vite build` + `esbuild`) y lanzamiento con
`_electron.launch({ args: ["."] })`. Es determinista y no depende de un servidor.

### 3. Aislamiento del directorio de configuración

- `main.ts` calcula `DEFAULT_SYNC_DIR` con `app.getPath("documents")` en tiempo
  de módulo.
- `--user-data-dir` no afecta a `app.getPath("documents")`.
- La solución menos invasiva es un override por variable de entorno leído al
  arrancar:

```ts
const BASE_DIR = process.env.FILESYNC_HOME ?? path.join(app.getPath("documents"), "FileSync");
```

- Sin la variable, el comportamiento es idéntico al actual.

**Decisión**: `FILESYNC_HOME` solo para tests y automatizaciones. Documentada.

### 4. Simulación de GitHub

- `GitHubClient` usa `fetch` en el renderer.
- Playwright puede interceptar con `page.route("https://api.github.com/**")`.
- No hace falta cambiar el core ni inyectar un cliente falso en la UI.

**Decisión**: interceptar en la E2E. Para los tests del core, usar fakes en
memoria de `DriveClient`.

### 5. Maestro en Windows

- Maestro no está instalado en esta máquina.
- `adb` sí está disponible.
- Maestro se distribuye como CLI Java; en Windows se ejecuta mejor desde WSL o
  Git Bash, y requiere un emulador o dispositivo conectado.

**Decisión**: dejar los flujos YAML y un script que detecte Maestro. Si no está,
el script explica cómo instalarlo y no falla la suite del core.

### 6. Reloj y conflictos

- `conflictName` usa `new Date()`, lo que hace no determinista el nombre exacto.
- Los tests deben verificar el patrón (`_conflict_YYYY-MM-DD_HH-mm-ss`) y no un
  string fijo.

**Decisión**: usar `hasConflictSuffix` y expresiones regulares.

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| Jest | Más configuración para ESM/TypeScript; Vitest ya encaja con Vite |
| Cypress | No soporta Electron de forma nativa |
| Detox | Requiere dev client y build nativo; Maestro es más simple para un APK |
| Mockear `fs` en el proceso principal | Frágil y acoplado a la implementación de Electron |
| Repo GitHub real en tests | No determinista, requiere token y red |
