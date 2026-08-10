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

- Node.js ≥ 20
- pnpm (`npm install -g pnpm`)
- Cuenta de GitHub

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
| `pnpm mobile:start` | Lanza el servidor de Expo |
| `pnpm core:check` | Ejecuta el autochequeo de la lógica de conflictos |
| `pnpm --filter desktop typecheck` | Typecheck del escritorio |
| `pnpm --filter mobile typecheck` | Typecheck del móvil |
