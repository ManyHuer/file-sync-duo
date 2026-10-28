# FileSync

Sincroniza archivos `.md` entre tu teléfono y tu PC usando **GitHub** como puente (100% gratis). Apps para escritorio (Electron + React) y móvil (Expo/React Native), con botones manuales para subir/descargar y resolución de conflictos mediante copias.

## Estructura

```
FileSync/
├── packages/core/    Lógica compartida: GitHubClient, sync, conflictos
├── apps/desktop/     Electron + React + Vite
└── apps/mobile/      Expo (React Native)
```

## Requisitos

- Node.js ≥ 22.13.0
- pnpm (`npm install -g pnpm`)
- Cuenta de GitHub

> Expo CLI 58 requiere Node 22.13+. Si usas `fnm` o `nvm`, ejecuta `fnm use 22` o `nvm use 22` antes de `pnpm install`. Hay un `.nvmrc` en la raíz.

## Ejecutar la app

Instala las dependencias una vez:

```powershell
pnpm install
```

| Quiero ejecutar... | Comando | Requisitos |
|---|---|---|
| **Desktop** (desarrollo) | `pnpm desktop:dev` | Nada extra |
| **Móvil** en Expo Go (misma red) | `pnpm mobile:start` | Expo Go 58.x en el teléfono |
| **Móvil** forzando la IP LAN | `pnpm mobile:start:lan` | Misma red; evita WireGuard/VPN |
| **Móvil** por túnel (cualquier red) | `pnpm mobile:start:tunnel` | Internet; no requiere cuenta Expo |
| Ver la URL `exp://` actual | `pnpm mobile:url` | Servidor de Expo corriendo |
| **Emulador Android** | `pnpm --filter mobile android` | Emulador + Android SDK |
| **Instalador de escritorio** | `pnpm --filter desktop dist` | `electron-builder` (viene con pnpm) |
| **APK Android local** | `cd apps/mobile/android; .\gradlew.bat assembleDebug` | Android SDK + Java 17+ |

> Para móvil, el teléfono y el PC deben poder hablarse. Si hay WireGuard/VPN,
> están en redes distintas o el QR no carga, usa `pnpm mobile:start:tunnel`.
>
> Para el APK local, `apps/mobile/android` se genera con
> `pnpm --filter mobile exec expo prebuild --platform android` (ya está generado
> en esta máquina; está en `.gitignore`).

## Configuración: GitHub

1. Crea un repositorio (puede ser privado) donde se guardarán tus notas, ej. `mis-notas`.
2. Crea un **Personal Access Token**:
   - GitHub → Settings → Developer settings → **Personal access tokens** → *Tokens (classic)* → *Generate new token*.
   - Scope: marca **`repo`** (acceso completo a repositorios).
   - Copia el token (solo se muestra una vez).
3. En la app (móvil o escritorio) ingresa:
   - **Owner**: tu usuario de GitHub.
   - **Repo**: nombre del repositorio.
   - **Token**: el token que generaste.

> El token se guarda en `Documentos\FileSync\config.json` (escritorio) o en el SecureStore del dispositivo (móvil). No lo compartas.

## Escritorio

```bash
pnpm install
pnpm desktop:dev        # desde la raíz (lanza Vite + Electron)
```

- Los archivos viven en `Documentos\FileSync`.

## Móvil

```bash
pnpm install
pnpm mobile:start       # luego escanea el QR con Expo Go
```

- Los archivos viven en el directorio de documentos de la app.
- Requiere **Expo Go 58.x** en el teléfono (SDK 58). La versión de Expo Go debe coincidir con el SDK del proyecto.
- Para emulador Android: `pnpm --filter mobile android` (requiere emulador; no compila APK).

### Si el teléfono no descarga el bundle

Si el PC tiene WireGuard/VPN activo, Expo puede anunciar la IP del túnel y el
teléfono no podrá conectarse. Usa el script que detecta la IP LAN:

```powershell
pnpm mobile:start:lan
```

O fuerza la IP manualmente:

```powershell
$env:REACT_NATIVE_PACKAGER_HOSTNAME = "192.168.50.16"
pnpm mobile:start
```

La URL del QR debe ser `exp://192.168.50.16:8081`, no `192.168.5.4`.

### Túnel para cualquier red

Si el teléfono está en otra Wi-Fi o con datos móviles, usa el túnel:

```powershell
pnpm mobile:start:tunnel
```

No requiere cuenta de Expo: usa `@expo/ngrok`. Espera a “Tunnel ready” y
escanea el QR o abre la URL `exp://...` que aparezca. La URL cambia en cada
arranque.

Opciones del script:

```powershell
# Si el puerto 8081 está ocupado por un Metro viejo
.\scripts\start-mobile-tunnel.ps1 -Force

# Usar otro puerto
.\scripts\start-mobile-tunnel.ps1 -Port 8082

# No limpiar la caché de Metro
.\scripts\start-mobile-tunnel.ps1 -NoClear
```

Mientras el túnel corre, puedes obtener la URL actual con:

```powershell
pnpm mobile:url
```

Imprime algo como `exp://xxxx-anonymous-8081.exp.direct`, que puedes pegar en
“Enter URL manually” de Expo Go.

## Uso

1. Abre la app y configura owner/repo/token.
2. Crea archivos `.md` localmente (botón **Crear** en móvil, o cualquier editor en la carpeta de sincronización del PC).
3. Pulsa **Subir a GitHub** o **Descargar de GitHub** (botones manuales, bidireccional).

### Resolución de conflictos

Si el mismo archivo se modificó en ambos lados (teléfono y PC) desde la última sincronización, no se sobrescribe nada: se crea una copia `nombre_conflict_YYYY-MM-DD_HH-mm-ss.md` en el lado que sube, y el log te indica qué archivo entró en conflicto. Ambos quedan visibles para que decidas cuál conservar.

### Cómo funciona

- Los archivos `.md` se guardan en la raíz del repo.
- Un archivo oculto `.filesync-meta.json` guarda la fecha de modificación de cada archivo (GitHub no expone `mtime` de los archivos, así que se usa este metadato para comparar versiones).

## Scripts

| Comando | Qué hace |
|---|---|
| `pnpm desktop:dev` | Lanza la app de escritorio en modo desarrollo |
| `pnpm mobile:start` | Lanza el servidor de Expo para Expo Go |
| `pnpm mobile:start:lan` | Lanza Expo forzando la IP LAN (evita WireGuard) |
| `pnpm mobile:start:tunnel` | Lanza Expo con túnel ngrok para cualquier red |
| `pnpm mobile:url` | Imprime la URL `exp://` actual del servidor |
| `pnpm --filter mobile android` | Abre Expo en un emulador Android |
| `pnpm --filter desktop dist` | Genera el instalador `.exe` de escritorio |
| `pnpm core:check` | Ejecuta el autochequeo de la lógica de conflictos |
| `pnpm core:test` | Ejecuta la suite de Vitest del core |
| `pnpm desktop:test:e2e` | Compila y ejecuta el smoke E2E de Electron con Playwright |
| `pnpm mobile:test:e2e` | Ejecuta los flujos Maestro (si Maestro está instalado) |
| `pnpm test` | Core + typechecks (gate principal) |
| `pnpm --filter desktop typecheck` | Typecheck del escritorio |
| `pnpm --filter mobile typecheck` | Typecheck del móvil |

## Pruebas

```bash
pnpm test               # core + tipos, sin red ni credenciales
pnpm desktop:test:e2e   # Electron real con GitHub simulado
pnpm mobile:test:e2e    # Maestro contra emulador/dispositivo
```

- **Core**: Vitest sobre `packages/core`. Usa dobles en memoria (`FakeDriveClient`,
  `FakeLocalFS`); nunca toca GitHub.
- **Desktop**: Playwright `_electron` lanza la app con un `FILESYNC_HOME`
  temporal e intercepta `api.github.com`. No escribe en `Documents/FileSync`.
- **Mobile**: flujos Maestro con `testID` estables. Ver
  `apps/mobile/.maestro/README.md`.

`FILESYNC_HOME` es una variable solo para pruebas y automatizaciones: cambia el
directorio base de configuración y sincronización. Sin ella, la app usa
`Documents/FileSync` como siempre.

## Estados de acciones

Las acciones de sincronización comparten contrato entre desktop y mobile
(`packages/core/src/action.ts`):

| Estado | Qué ve el usuario |
|---|---|
| `idle` | Botón disponible con su etiqueta normal |
| `loading` | "Subiendo..." / "Descargando...", botón deshabilitado |
| `success` | Resumen: subidos/descargados, conflictos y sin cambios |
| `error` | Mensaje de causa + botón "Reintentar" |
| `blocked` | Formulario de configuración (sin conexión) |

Un doble click no dispara dos operaciones: además de deshabilitar el botón, hay
un guard con `useRef` en ambas apps. Un error de token nunca muestra el token.

## Skills locales (solo FileSync)

Las skills de diseño (`ui-ux-pro-max` y su suite) y el wrapper de `spec-kit`
viven en `.opencode/skills/`, que está en `.gitignore`. No se versionan y solo
aplican a este proyecto.

Para reinstalar la suite de diseño:

```powershell
npx -y ui-ux-pro-max-cli init --ai opencode
```

Los comandos `/speckit.*` están en `.opencode/commands/` y sí se versionan.
No uses estas skills en proyectos dentro de `C:\Users\manue\Desktop\Trabajo`.

## Publicar una versión (instaladores)

Al crear un **tag** `vX.Y.Z` (ej. `v1.0.0`) y subirlo a GitHub, un workflow compila automáticamente:

- **Escritorio**: instalador NSIS `FileSync Setup X.Y.Z.exe` (Windows x64)
- **Móvil**: APK de Android (firmado con el keystore de debug, solo para uso personal)

```bash
git tag v1.0.0
git push origin v1.0.0
```

Los archivos quedan adjuntos en **GitHub → Releases** del repositorio. Para instalar el APK en tu teléfono, habilita "instalar apps de orígenes desconocidos".
