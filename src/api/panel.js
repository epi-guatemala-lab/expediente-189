// Cliente del panel de Recepción (CONTRATO §5 «Recepción» + adenda §6).
// Sesión separada de la del solicitante: el token del portal vive en
// sessionStorage bajo `exp189_panel_token` y ningún dato personal se guarda
// en el navegador.

const API = import.meta.env.VITE_API_URL || 'https://igss.mediclic.org/jornadas/api'
const BASE = `${API}/expediente189`
const CLAVE_SESION = 'exp189_panel_token'

let oyenteSesionVencida = null

export function alSesionVencida(oyente) {
  oyenteSesionVencida = typeof oyente === 'function' ? oyente : null
}

export function leerToken() {
  try {
    return sessionStorage.getItem(CLAVE_SESION)
  } catch {
    return null
  }
}

export function guardarToken(token) {
  try {
    sessionStorage.setItem(CLAVE_SESION, token)
  } catch {
    // sin acceso a sessionStorage: la sesión solo vive en memoria
  }
}

export function borrarToken() {
  try {
    sessionStorage.removeItem(CLAVE_SESION)
  } catch {
    // nada que hacer
  }
}

export function cerrarSesion() {
  borrarToken()
}

function sesionVencida() {
  borrarToken()
  if (oyenteSesionVencida) oyenteSesionVencida()
  return { status: 401, detail: 'Su sesión venció' }
}

async function leerError(respuesta) {
  let datos = null
  try {
    datos = await respuesta.json()
  } catch {
    // respuesta sin cuerpo JSON
  }
  return {
    status: respuesta.status,
    detail: datos?.detail || `Error ${respuesta.status}`,
    errores: datos?.errores || null,
    // El 409 por versión trae el expediente vigente en `actual` (adenda §6).
    actual: datos?.actual || null,
  }
}

async function pedir(ruta, { metodo = 'GET', cuerpo } = {}) {
  const token = leerToken()
  const respuesta = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers: {
      ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  })
  // Un 401 con el token guardado significa que la sesión expiró.
  if (respuesta.status === 401) throw sesionVencida()
  if (!respuesta.ok) throw await leerError(respuesta)
  if (respuesta.status === 204) return null
  return respuesta.json()
}

// Login del portal (fuera del prefijo expediente189). Acepta `access_token`
// o `token`; el token solo se guarda si la cuenta tiene rol «recepción».
export async function ingresarPanel(usuario, contrasena) {
  const respuesta = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: usuario, password: contrasena }),
  })
  if (!respuesta.ok) throw await leerError(respuesta)
  const datos = await respuesta.json().catch(() => null)
  const token = datos?.access_token || datos?.token
  if (!token) {
    throw { status: 0, detail: 'El servidor no devolvió un token de acceso' }
  }
  if (datos?.user?.rol !== 'recepcion') {
    throw { status: 403, detail: 'Esta cuenta no tiene acceso al panel de Recepción' }
  }
  guardarToken(token)
  return { token, user: datos.user }
}

// Nombre de archivo desde Content-Disposition (con respaldo UTF-8), si el
// servidor lo envía.
function nombreDesdeDisposition(disposition) {
  if (!disposition) return null
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposition)
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1])
    } catch {
      // codificación inesperada: se intenta la forma simple
    }
  }
  const simple = /filename="?([^";]+)"?/i.exec(disposition)
  return simple ? simple[1] : null
}

// Archivos (vistas, descargas, ZIP, Excel): fetch con Bearer → blob.
// Quien llama es dueño del blob y debe revocar su URL al cerrar o desmontar.
async function pedirBinario(ruta) {
  const token = leerToken()
  const respuesta = await fetch(`${BASE}${ruta}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (respuesta.status === 401) throw sesionVencida()
  if (!respuesta.ok) throw await leerError(respuesta)
  const blob = await respuesta.blob()
  return { blob, nombre: nombreDesdeDisposition(respuesta.headers.get('Content-Disposition')) }
}

// ---------------------------------------------------------------------------
// Configuración pública (títulos y etiquetas de fecha de los documentos)
// ---------------------------------------------------------------------------

export function obtenerConfig() {
  return pedir('/config')
}

// ---------------------------------------------------------------------------
// Inicio del panel: resumen y listado de expedientes
// ---------------------------------------------------------------------------

export function obtenerResumen() {
  return pedir('/panel/resumen')
}

export function obtenerExpedientes({ estado = '', q = '', page = 1, limit = 50 } = {}) {
  const params = new URLSearchParams()
  if (estado) params.set('estado', estado)
  if (q) params.set('q', q)
  params.set('page', String(page))
  params.set('limit', String(limit))
  return pedir(`/panel/expedientes?${params.toString()}`)
}

export function obtenerExpediente(id) {
  return pedir(`/panel/expedientes/${encodeURIComponent(id)}`)
}

// ---------------------------------------------------------------------------
// Documentos y acciones de revisión (todas envían `version`; 409 = recargar)
// ---------------------------------------------------------------------------

export function obtenerVistaDocumento(id, clave, pagina = 1) {
  return pedirBinario(
    `/panel/expedientes/${encodeURIComponent(id)}/documentos/${encodeURIComponent(clave)}/vista?pagina=${pagina}`
  )
}

export function obtenerArchivoDocumento(id, clave) {
  return pedirBinario(
    `/panel/expedientes/${encodeURIComponent(id)}/documentos/${encodeURIComponent(clave)}/archivo`
  )
}

export function revisionDocumento(id, clave, estado, motivo, version) {
  return pedir(
    `/panel/expedientes/${encodeURIComponent(id)}/documentos/${encodeURIComponent(clave)}/revision`,
    {
      metodo: 'POST',
      cuerpo: { estado, ...(motivo ? { motivo } : {}), version },
    }
  )
}

export function devolverExpediente(id, observacion, version) {
  return pedir(`/panel/expedientes/${encodeURIComponent(id)}/devolver`, {
    metodo: 'POST',
    cuerpo: { observacion, version },
  })
}

export function aprobarExpediente(id, version) {
  return pedir(`/panel/expedientes/${encodeURIComponent(id)}/aprobar`, {
    metodo: 'POST',
    cuerpo: { version },
  })
}

export function obtenerZipExpediente(id) {
  return pedirBinario(`/panel/expedientes/${encodeURIComponent(id)}/zip`)
}

export function exportarExcel() {
  return pedirBinario('/panel/exportar.xlsx')
}

// ---------------------------------------------------------------------------
// Nómina
// ---------------------------------------------------------------------------

export function crearNomina(personas) {
  return pedir('/panel/nomina', { metodo: 'POST', cuerpo: { personas } })
}

export function regenerarClave(id) {
  return pedir(`/panel/nomina/${encodeURIComponent(id)}/regenerar-clave`, { metodo: 'POST' })
}

export function desactivarPersona(id) {
  return pedir(`/panel/nomina/${encodeURIComponent(id)}/desactivar`, { metodo: 'POST' })
}

export function activarPersona(id) {
  return pedir(`/panel/nomina/${encodeURIComponent(id)}/activar`, { metodo: 'POST' })
}

export function eliminarPersona(id) {
  return pedir(`/panel/nomina/${encodeURIComponent(id)}`, { metodo: 'DELETE' })
}
