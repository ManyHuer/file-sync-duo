# Flujos Maestro

Pruebas de humo de la app Android. Requieren:

1. Maestro instalado (`maestro -v`).
2. Un emulador o dispositivo conectado (`adb devices`).
3. La app instalada (`com.filesync.app`).
4. Credenciales de un repo de prueba la primera vez.

## Ejecutar

```powershell
$env:OWNER = "tu-usuario"
$env:REPO = "repo-de-prueba"
$env:TOKEN = "ghp_..."
pnpm mobile:test:e2e
```

O directamente:

```bash
maestro test .maestro -e OWNER=... -e REPO=... -e TOKEN=...
```

## Orden

Los flujos comparten estado de la app:

1. `01-create-file.yaml` — configura (si hace falta) y crea `maestro-nota.md`.
2. `02-navigate-folders.yaml` — crea y navega `maestro-carpeta`.
3. `03-delete-file.yaml` — borra `maestro-nota.md`.

## Notas

- `launchApp` no limpia el estado entre flujos; es intencional para reutilizar
  la configuración.
- Si `maestro` no está instalado, `pnpm mobile:test:e2e` no falla: muestra las
  instrucciones. Usa `--require-maestro` para exigirlo en CI.
- Los `testID` viven en `apps/mobile/App.tsx`.
