# Contrato de comandos de prueba

**Feature**: `001-test-harness`

Estos comandos son la interfaz pública de la red de seguridad. Deben funcionar
desde la raíz del repo.

## Core

```bash
pnpm core:test          # una ejecución, sale con código != 0 si falla
pnpm core:test:watch    # modo watch para desarrollo
```

Requisitos:

- No requiere red, token ni Electron.
- Termina en menos de 30 s.
- No escribe fuera de `packages/core`.

## Desktop

```bash
pnpm desktop:test:e2e
```

Requisitos:

- Compila `main`/`preload` y el renderer antes de lanzar.
- Usa `FILESYNC_HOME` apuntando a un directorio temporal.
- Intercepta toda llamada a `api.github.com`.
- Cierra Electron y limpia el directorio temporal incluso si el test falla.
- Sale con código != 0 si algún escenario falla.

## Mobile

```bash
pnpm mobile:test:e2e
```

Requisitos:

- Detecta `maestro`; si no existe, imprime instrucciones y sale con código 0
  (suite opcional) salvo que se pase `--require-maestro`.
- Ejecuta los flujos de `apps/mobile/.maestro`.
- No depende de datos de producción.

## Gates combinados

```bash
pnpm test        # core + typechecks (siempre)
pnpm test:e2e    # desktop + mobile (local)
```

## Compatibilidad

- Node 20+.
- Windows PowerShell 5.1+ para los scripts `.ps1`.
- Sin secretos en el entorno.
