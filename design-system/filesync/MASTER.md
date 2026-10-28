# FileSync — Design System (Dirección 1)

**Dirección**: utilidad técnica, tema oscuro, azul actual.
**Objetivo**: claridad, jerarquía y consistencia sin rediseñar el layout.

## Principios

1. El contenido manda: menos decoración, más jerarquía.
2. Un solo azul de acción; el resto es superficie y texto.
3. Espaciado en múltiplos de 4.
4. Estados visibles: hover, focus, pressed, disabled, loading, error, success.
5. Desktop y mobile comparten escala, no componentes.

## Color

| Token | Valor | Uso |
|---|---|---|
| `--color-bg` | `#0b0e14` | Fondo de app |
| `--color-surface` | `#141824` | Cards y modales |
| `--color-surface-alt` | `#1a1e28` | Carpetas, botones secundarios |
| `--color-surface-hover` | `#232833` | Hover de superficies |
| `--color-border` | `#1c212e` | Bordes suaves |
| `--color-border-strong` | `#2c3342` | Inputs y bordes activos |
| `--color-text` | `#f2f4f8` | Texto principal |
| `--color-text-muted` | `#8b95a7` | Texto secundario |
| `--color-text-subtle` | `#6b7280` | Placeholders y metadatos |
| `--color-primary` | `#1a73e8` | Acción principal |
| `--color-primary-hover` | `#1765cc` | Hover/pressed del azul |
| `--color-primary-soft` | `rgba(26,115,232,0.12)` | Fondo de selección/hover |
| `--color-danger` | `#c0392b` | Acción destructiva |
| `--color-danger-hover` | `#a93226` | Hover destructivo |
| `--color-success` | `#46d39a` | Éxito |
| `--color-error` | `#ff6b6b` | Error |

Contraste: texto principal sobre fondo > 12:1; muted > 4.5:1; azul sobre
superficie se usa para bordes/foco, no para texto pequeño.

## Tipografía

Pila: `system-ui, -apple-system, "Segoe UI", sans-serif`.
Mono: `ui-monospace, Consolas, monospace`.

| Token | Tamaño | Uso |
|---|---:|---|
| `--text-xs` | 12 px | Metadatos, log |
| `--text-sm` | 13 px | Hints, errores |
| `--text-md` | 14 px | Cuerpo, botones |
| `--text-lg` | 16 px | Títulos de card |
| `--text-xl` | 20 px | Título de sección |
| `--text-2xl` | 26 px | Título de app |

Pesos: 400 cuerpo, 500 nombres, 600 botones, 700 secciones, 800 título.
Line-height: 1.4–1.6. Letter-spacing negativo solo en títulos grandes.

## Espaciado y radios

Escala: 4, 8, 12, 16, 20, 24, 32.
Radios: 8 (small), 10 (input/button), 12 (card), 14 (modal).

## Sombras

- `sm`: `0 1px 2px rgba(0,0,0,0.25)`
- `md`: `0 4px 12px rgba(0,0,0,0.25)`
- `lg`: `0 12px 32px rgba(0,0,0,0.45)`

## Componentes

### Button

- Altura mínima: 40 px desktop, 44 px mobile.
- Primario: azul, texto blanco.
- Secundario: superficie alt + borde.
- Peligro: rojo.
- Ghost: transparente + borde.
- Estados: hover (oscurece), focus-visible (anillo azul), pressed (scale 0.98),
  disabled (opacidad 0.5, sin transform).

### Input

- Altura 42 px, radio 10, borde strong.
- Foco: borde azul + anillo `primary-soft`.
- Placeholder: text-subtle.

### Card / Folder

- Superficie, borde suave, radio 12–14, sombra sm/md.
- Hover: superficie-hover + borde azul (solo carpetas).
- Título con `text-lg` / 600.

### File row

- Altura mínima 40 px, borde inferior suave.
- Hover/selección: `primary-soft`.
- Nombre 500; metadata `text-xs` muted.

### Status

- Error: `error`, `text-sm`, `role="alert"`.
- Éxito: `success`, `text-sm`, `role="status"`.
- Mantener el botón Reintentar junto al error.

### Log

- Fondo `bg`, borde suave, mono `text-xs`, line-height 1.5.

## Accesibilidad

- Foco visible en todos los controles.
- Touch targets >= 44 px en mobile.
- No usar solo color para estados: texto/etiqueta acompañando.
- `prefers-reduced-motion` respetado.
- Contraste mínimo 4.5:1 para texto.

## Desktop vs mobile

Mismos tokens; distinta implementación:
- Desktop: CSS variables en `:root`.
- Mobile: `theme.ts` con `colors`, `spacing`, `radius`, `typography`, `shadows`.
