# Expediente 189 · IGSS

Formulario del solicitante del trámite de contratación 2027 del renglón 189,
Departamento de Medicina Preventiva del Instituto Guatemalteco de Seguridad
Social. Cada persona de la nómina ingresa con su CUI y una clave personal,
completa sus datos y sube sus documentos; Recepción los revisa en `#/panel`.

## Desarrollo

```bash
npm install
npm run dev        # servidor de desarrollo
npm test           # pruebas de las validaciones (node --test)
npm run build      # compilación de producción en dist/
```

## Variables de entorno

| Variable | Obligatoria | Descripción |
|---|---|---|
| `VITE_API_URL` | No | URL pública del API (predeterminada: la del módulo en producción). |
| `VITE_BASE_PATH` | No | Ruta base al compilar para GitHub Pages (p. ej. `/expediente-189/`). |

## Rutas

- `#/` — formulario del solicitante (acceso con CUI y clave).
- `#/panel` — panel de Recepción (en desarrollo).

## Notas

- El token de sesión vive en `sessionStorage`; ningún dato personal se guarda
  en el navegador: el borrador reside en el servidor.
- La sesión del solicitante dura 2 horas; al vencer se vuelve a la pantalla de
  acceso con el aviso correspondiente.
