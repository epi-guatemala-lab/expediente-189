# Expediente 189 · IGSS

Formulario del solicitante del trámite de contratación 2027 del renglón 189,
Departamento de Medicina Preventiva del Instituto Guatemalteco de Seguridad
Social. Cada persona de la nómina ingresa con su DPI y su nombre, completa sus datos
y sube sus documentos; Recepción los revisa en `#/panel`. Este repositorio es
solo el frontend: no contiene datos ni credenciales.

## Desarrollo

```bash
npm install
npm run dev        # servidor de desarrollo
npm test           # pruebas (node --test src/): validaciones y capa sin conexión
npm run build      # compilación de producción en dist/
```

## Variables de entorno

| Variable | Obligatoria | Descripción |
|---|---|---|
| `VITE_API_URL` | No | URL pública del API (predeterminada: la del módulo en producción). |
| `VITE_BASE_PATH` | No | Ruta base al compilar para GitHub Pages (p. ej. `/expediente-189/`). |

## Rutas

- `#/` — formulario del solicitante (acceso con DPI y nombre).
- `#/panel` — panel de Recepción (requiere una cuenta con ese rol).

## Notas

- Se entra con DPI y nombre completo (no hay clave personal). El servidor devuelve un token de
  sesión (2 horas) y una llave de 32 bytes (`llave_boveda`) que abre la bóveda cifrada de ese
  dispositivo.
- **Sin conexión (`src/sinconexion/`)**: toda escritura se cifra (AES-GCM, llave no extraíble) y se
  guarda primero en IndexedDB (`exp189-<SHA-256 del CUI>`), y después se envía en orden desde una
  cola con reintentos. Si el servidor se cae, lo escrito queda guardado y se envía al volver la
  conexión. La copia del expediente va atada a la sesión; la cola de pendientes sobrevive entre
  sesiones. «Salir» conserva cifrada solo la cola pendiente; «Salir y borrar de este dispositivo»
  elimina todo. Al confirmarse el envío del expediente se borra la bóveda completa.
- En `sessionStorage` solo viven el token vigente, el último token (para pedir la continuidad de la
  sesión), la llave de la bóveda y el identificador de la bóveda; nunca en `localStorage`.
- El servidor solo devuelve lo escrito en la sesión actual; lo guardado antes aparece como
  «Guardado ✓» y cuenta como completo.
- La sesión del solicitante dura 2 horas; al vencer se pide volver a entrar sin perder lo escrito.
