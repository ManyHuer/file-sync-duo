# Especificación de Feature: Red de seguridad de pruebas

**Feature Branch**: `001-test-harness`

**Created**: 2026-10-27

**Status**: Draft

**Input**: User description: "Red de seguridad de pruebas: Vitest para packages/core, Playwright para Electron y Maestro para mobile"

## Escenarios de usuario y pruebas *(obligatorio)*

### Historia de usuario 1 - Verificar la lógica de sincronización sin abrir la app (Prioridad: P1)

Como desarrollador de FileSync, quiero ejecutar una suite automatizada del core
para saber si un cambio rompió la sincronización, los conflictos o la detección
de huérfanos, sin tener que abrir Electron ni el teléfono.

**Por qué esta prioridad**: es la base de todo. Si el core está mal, ninguna
prueba de UI tiene valor.

**Prueba independiente**: ejecutar un único comando desde la raíz y obtener
un resultado claro (pasa/falla) en menos de 30 segundos, sin red ni token.

**Escenarios de aceptación**:

1. **Dado** un directorio local con archivos `.md` y un repositorio remoto
   simulado, **cuando** se ejecuta la subida, **entonces** los archivos nuevos y
   modificados se envían y los metadatos quedan actualizados.
2. **Dado** un archivo modificado en local y en remoto desde la última
   sincronización, **cuando** se sincroniza, **entonces** se crea una copia
   `nombre_conflict_YYYY-MM-DD_HH-mm-ss.md` y no se sobrescribe ninguna versión.
3. **Dado** un archivo presente solo en local, **cuando** se buscan huérfanos,
   **entonces** se reporta como candidato a borrado sin eliminarlo.
4. **Dado** un fallo de red o un token inválido, **cuando** se ejecuta el core,
   **entonces** el error se propaga con un mensaje útil y sin filtrar el token.

---

### Historia de usuario 2 - Verificar la app de escritorio de punta a punta (Prioridad: P2)

Como desarrollador, quiero una prueba de humo que abra la app de escritorio,
configure un destino temporal y pulse las acciones principales, para detectar
regresiones de comportamiento antes de publicar.

**Por qué esta prioridad**: el core puede estar bien y la app seguir rota por un
problema de IPC, configuración o estado de UI.

**Prueba independiente**: la prueba arranca la app, completa el flujo y termina
con un veredicto, usando un directorio temporal y sin tocar datos reales.

**Escenarios de aceptación**:

1. **Dado** un entorno sin configuración previa, **cuando** se abre la app,
   **entonces** se muestra el formulario de configuración y no hay errores en
   consola.
2. **Dado** una configuración válida, **cuando** se pulsa "Subir a GitHub",
   **entonces** el botón entra en estado ocupado, se deshabilita y al terminar
   muestra el resultado.
3. **Dado** un fallo simulado del cliente, **cuando** se pulsa "Descargar de
   GitHub", **entonces** la UI muestra el error y vuelve a estado disponible.
4. **Dado** una carpeta dentro del directorio sincronizado, **cuando** se entra
   y se sale, **entonces** la ruta visible cambia correctamente.

---

### Historia de usuario 3 - Verificar los flujos críticos en mobile (Prioridad: P3)

Como desarrollador, quiero flujos automatizados en el dispositivo/emulador para
comprobar que las acciones principales siguen funcionando en Android.

**Por qué esta prioridad**: mobile tiene su propio filesystem y no comparte UI
con desktop; una regresión ahí no la detecta la suite de escritorio.

**Prueba independiente**: ejecutar los flujos contra un build instalado y
obtener un resultado por flujo.

**Escenarios de aceptación**:

1. **Dado** la app instalada y abierta, **cuando** se crea un archivo,
   **entonces** aparece en la lista con su nombre.
2. **Dado** un archivo en la lista, **cuando** se pulsa borrar y se confirma,
   **entonces** desaparece de la lista.
3. **Dado** una carpeta, **cuando** se entra y se vuelve a la raíz,
   **entonces** la navegación refleja la ubicación actual.
4. **Dado** una operación en curso, **cuando** se intenta pulsar de nuevo,
   **entonces** la acción no se duplica.

---

### Casos de borde

- ¿Qué pasa si el directorio temporal no existe o no tiene permisos?
- ¿Qué pasa si el repositorio remoto está vacío?
- ¿Qué pasa si el token expira a mitad de una operación?
- ¿Qué pasa si el dispositivo móvil no tiene red?
- ¿Qué pasa si dos archivos tienen el mismo nombre y distinta extensión?
- ¿Qué pasa si el reloj del sistema cambia entre ejecuciones?

## Requisitos *(obligatorio)*

### Requisitos funcionales

- **FR-001**: El proyecto DEBE exponer un comando único para ejecutar todas las
  pruebas del core sin requerir UI, red ni credenciales.
- **FR-002**: Las pruebas del core DEBEN cubrir subida, descarga, archivos
  nuevos, archivos modificados, conflictos y huérfanos.
- **FR-003**: Las pruebas del core DEBEN usar dobles de prueba o un remoto
  simulado; NUNCA un repositorio real.
- **FR-004**: Un fallo de credenciales DEBE producir un error legible y NO DEBE
  incluir el token en el mensaje ni en los logs.
- **FR-005**: El proyecto DEBE exponer un comando para una prueba de humo de la
  app de escritorio que arranque la aplicación real.
- **FR-006**: La prueba de escritorio DEBE usar un directorio temporal aislado y
  limpiarlo al finalizar.
- **FR-007**: La prueba de escritorio DEBE verificar al menos: configuración,
  subida, descarga, entrada/salida de carpeta y estado de error.
- **FR-008**: La prueba de escritorio DEBE fallar si la UI queda bloqueada en
  estado ocupado después de un error.
- **FR-009**: El proyecto DEBE incluir flujos automatizados para mobile que
  cubran crear, borrar y navegar carpetas.
- **FR-010**: Los flujos de mobile DEBEN poder ejecutarse contra un build
  instalado en emulador o dispositivo, sin depender de datos de producción.
- **FR-011**: Los comandos de prueba DEBEN documentarse en el README y en
  `AGENTS.md`.
- **FR-012**: La suite DEBE poder ejecutarse en CI sin secretos reales.

### Entidades clave

- **Ejecución de prueba**: conjunto de casos, entorno aislado y veredicto.
- **Directorio temporal de sincronización**: carpeta efímera que simula el
  filesystem del usuario.
- **Remoto simulado**: implementación de prueba del cliente de GitHub con
  respuestas controladas.
- **Flujo de mobile**: secuencia de acciones sobre la app instalada.

## Criterios de éxito *(obligatorio)*

### Resultados medibles

- **SC-001**: `pnpm core:test` termina en menos de 30 segundos en una máquina de
  desarrollo estándar.
- **SC-002**: El 100% de las funciones exportadas por `packages/core` tiene al
  menos un test.
- **SC-003**: La prueba de humo de escritorio termina en menos de 2 minutos y no
  deja procesos de Electron vivos.
- **SC-004**: Los flujos de mobile se ejecutan en menos de 3 minutos en un
  emulador local.
- **SC-005**: Un desarrollador nuevo puede ejecutar las tres suites siguiendo
  solo el README.
- **SC-006**: La suite de CI termina en menos de 5 minutos y no requiere ningún
  secreto.

## Supuestos

- El entorno de desarrollo tiene Node 20+, pnpm 10 y Python no es requisito.
- Para la prueba de escritorio se puede compilar `main`/`preload` con esbuild
  antes de lanzar Electron.
- Para mobile existe un emulador Android disponible o se puede usar un
  dispositivo físico; si no, los flujos quedan documentados y se ejecutan
  manualmente.
- No se prueba contra la API real de GitHub en la suite automatizada.
- El repositorio de prueba y el token real siguen siendo responsabilidad del
  usuario para pruebas manuales.
