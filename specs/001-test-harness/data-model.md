# Modelo de datos: Red de seguridad de pruebas

**Feature**: `001-test-harness`

No hay datos persistidos nuevos en producción. Este documento describe las
estructuras efímeras que usan las pruebas.

## Entidades de prueba

### FakeDriveClient

Implementación en memoria de `DriveClient`.

| Campo | Tipo | Descripción |
|---|---|---|
| `files` | `Map<string, { content: string; modifiedTime: number }>` | Archivos remotos simulados |
| `uploads` | `string[]` | Nombres subidos, en orden |
| `deletes` | `string[]` | Nombres borrados |
| `commitCount` | `number` | Veces que se llamó `commitMeta` |
| `failNext` | `string \| null` | Fuerza un error en la siguiente operación |

Métodos: `listFiles`, `upload`, `download`, `touch`, `delete`, `commitMeta`.

### FakeLocalFS

Implementación en memoria de `LocalFS`.

| Campo | Tipo | Descripción |
|---|---|---|
| `files` | `Map<string, { content: string; modifiedTime: number }>` | Archivos locales |
| `writes` | `Array<{ name: string; content: string }>` | Traza de escrituras |
| `deletes` | `string[]` | Nombres borrados |

Métodos: `list`, `read`, `write`, `stat`, `setMtime`, `delete`.

### TempHome

Directorio temporal por ejecución de Playwright.

```text
<tmp>/filesync-e2e-<random>/
├── config.json          # owner/repo/token falsos
└── notes/               # syncDir aislado
    ├── a.md
    └── b.md
```

Se elimina en `afterAll`. Nunca apunta a `Documents/FileSync`.

### Fixture de red GitHub

Rutas interceptadas por Playwright:

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/repos/:owner/:repo/contents/` | Lista de archivos |
| GET | `/repos/:owner/:repo/contents/.filesync-meta.json` | Metadatos o 404 |
| PUT | `/repos/:owner/:repo/contents/:name` | `{ content: { sha } }` |
| GET | `/repos/:owner/:repo/contents/:name` | Contenido base64 |
| DELETE | `/repos/:owner/:repo/contents/:name` | 200 |

Cualquier ruta no contemplada responde 500 para que el test falle de forma
explícita.

## Estados de UI observados

| Estado | Señal en desktop | Señal en mobile |
|---|---|---|
| `idle` | Botón habilitado, sin texto de progreso | Botón habilitado |
| `loading` | `disabled` + texto "Subiendo..." / "Descargando..." | `disabled` + indicador |
| `success` | Log con conteo | Log/lista actualizada |
| `error` | `.error` visible | Texto de error visible |
| `blocked` | Formulario de configuración | Pantalla de configuración |

## Contratos

Ver `contracts/test-commands.md` para los comandos públicos de la suite.
