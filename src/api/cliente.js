// Cliente del módulo expediente189 (CONTRATO §5, endpoints de solicitante y públicos).
// El token vive en sessionStorage; ningún dato personal se guarda en el navegador.

const API = import.meta.env.VITE_API_URL || 'https://igss.mediclic.org/jornadas/api'
const BASE = `${API}/expediente189`
const CLAVE_SESION = 'exp189_token'

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
  return { status: 401, detail: 'Tu sesión venció' }
}

async function responder(r) {
  if (r.status === 204) return null
  let datos = null
  try {
    datos = await r.json()
  } catch {
    // respuesta sin cuerpo JSON
  }
  if (!r.ok) {
    throw {
      status: r.status,
      detail: datos?.detail || `Error ${r.status}`,
      errores: datos?.errores || null,
    }
  }
  return datos
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
  // Un 401 fuera del inicio de sesión significa que el token expiró (dura 2 horas).
  if (respuesta.status === 401 && ruta !== '/acceso') throw sesionVencida()
  return responder(respuesta)
}

// ---------------------------------------------------------------------------
// Endpoints públicos
// ---------------------------------------------------------------------------

export function obtenerConfig() {
  return pedir('/config')
}

export function acceso(cui, clave) {
  return pedir('/acceso', { metodo: 'POST', cuerpo: { cui, clave } })
}

// ---------------------------------------------------------------------------
// Endpoints del solicitante
// ---------------------------------------------------------------------------

export function obtenerExpediente() {
  return pedir('/mi-expediente')
}

export function guardarDatos(datos) {
  return pedir('/mi-expediente', { metodo: 'PUT', cuerpo: { datos } })
}

export function corregirFechaDocumento(clave, fechaDocumento) {
  return pedir(`/mi-expediente/documentos/${encodeURIComponent(clave)}`, {
    metodo: 'PUT',
    cuerpo: { fecha_documento: fechaDocumento },
  })
}

export function quitarDocumento(clave) {
  return pedir(`/mi-expediente/documentos/${encodeURIComponent(clave)}`, { metodo: 'DELETE' })
}

export function enviarExpediente() {
  return pedir('/mi-expediente/enviar', { metodo: 'POST', cuerpo: { declaracion: true } })
}

// La vista previa es un image/jpeg que se pide con el token y se muestra como blob:.
export async function obtenerVistaDocumento(clave, pagina = 1) {
  const token = leerToken()
  const respuesta = await fetch(
    `${BASE}/mi-expediente/documentos/${encodeURIComponent(clave)}/vista?pagina=${pagina}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} }
  )
  if (respuesta.status === 401) throw sesionVencida()
  if (!respuesta.ok) {
    let datos = null
    try {
      datos = await respuesta.json()
    } catch {
      // sin cuerpo
    }
    throw { status: respuesta.status, detail: datos?.detail || 'No se pudo cargar la vista previa' }
  }
  return respuesta.blob()
}

// La subida usa XMLHttpRequest para poder reportar el progreso al usuario.
export function subirDocumento(clave, archivo, fechaDocumento, alProgresar) {
  return new Promise((resolve, reject) => {
    const forma = new FormData()
    forma.append('archivo', archivo, archivo.name)
    if (fechaDocumento) forma.append('fecha_documento', fechaDocumento)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${BASE}/mi-expediente/documentos/${encodeURIComponent(clave)}`)
    const token = leerToken()
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && typeof alProgresar === 'function') {
        alProgresar(Math.round((e.loaded / e.total) * 100))
      }
    }
    xhr.onerror = () => reject({ status: 0, detail: 'No se pudo conectar con el servidor' })
    xhr.onload = () => {
      let datos = null
      try {
        datos = JSON.parse(xhr.responseText)
      } catch {
        // respuesta sin cuerpo JSON
      }
      if (xhr.status === 401) return reject(sesionVencida())
      if (xhr.status === 204) return resolve(null)
      if (xhr.status >= 200 && xhr.status < 300) return resolve(datos)
      reject({
        status: xhr.status,
        detail: datos?.detail || `Error ${xhr.status}`,
        errores: datos?.errores || null,
      })
    }
    xhr.send(forma)
  })
}
