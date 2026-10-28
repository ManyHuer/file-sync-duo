# Quickstart: Red de seguridad de pruebas

**Feature**: `001-test-harness`

## Instalación

```powershell
pnpm install
```

## 1. Tests del core

```powershell
pnpm core:test
```

Salida esperada: resumen de Vitest con todos los tests en verde. No requiere
red ni token.

## 2. E2E de escritorio

```powershell
pnpm desktop:test:e2e
```

Qué hace:

1. Compila `main`, `preload` y el renderer.
2. Crea un `FILESYNC_HOME` temporal.
3. Lanza Electron con Playwright.
4. Intercepta `api.github.com` con respuestas simuladas.
5. Verifica configuración, subida, descarga, navegación de carpetas y error.
6. Cierra la app y borra el directorio temporal.

Si falla, Playwright deja traza en `apps/desktop/test-results/`.

## 3. Flujos de mobile (opcional)

Requisitos: Maestro instalado y un emulador/dispositivo Android conectado.

```powershell
pnpm mobile:test:e2e
```

Si Maestro no está instalado, el comando muestra las instrucciones y no rompe
la suite principal.

## 4. Todo junto

```powershell
pnpm test
```

## Solución de problemas

| Síntoma | Causa probable | Acción |
|---|---|---|
| Electron no arranca | Falta `dist/index.html` o `dist-electron/main.js` | `pnpm --filter desktop build` |
| La E2E escribe en Documents | `FILESYNC_HOME` no se propagó | Revisar `playwright.config.ts` |
| Maestro no encuentra la app | Paquete distinto o emulador apagado | `adb devices` y `appId` correcto |
| Tests del core fallan por `btoa` | Node < 18 | Actualizar Node a 20 |
