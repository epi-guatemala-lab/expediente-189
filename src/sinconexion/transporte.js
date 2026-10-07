// Transporte HTTP de la cola: arma las peticiones y devuelve SIEMPRE un resultado
// { status, cuerpo, retryAfter, red } sin lanzar: una red caída o un tiempo agotado
// llegan como { red:true, status:0 } para que nunca se muestre un error crudo.

const TIEMPO_JSON_MS = 20_000
const TIEMPO_SUBIDA_MS = 120_000
const TIEMPO_SALUD_MS = 8_000

function leerRetryAfter(cabeceras) {
  try {
    const valor = cabeceras?.get?.('Retry-After')
    const segundos = Number(valor)
    return Number.isFinite(segundos) && segundos > 0 ? segundos : null
  } catch {
    return null
  }
}

export function crearTransporte({ base, obtenerToken = () => null, fetchImpl = null }) {
  async function ejecutar(ruta, { metodo = 'GET', json, formulario, cabeceras = {}, tiempoMs = TIEMPO_JSON_MS, conSesion = true } = {}) {
    const token = conSesion ? obtenerToken() : null
    if (conSesion && !token) return { status: 401, cuerpo: null, sinToken: true }
    const llamar = fetchImpl || globalThis.fetch
    const controlador = typeof AbortController !== 'undefined' ? new AbortController() : null
    const temporizador = controlador ? setTimeout(() => controlador.abort(), tiempoMs) : null
    try {
      const encabezados = { ...cabeceras }
      if (token) encabezados.Authorization = `Bearer ${token}`
      if (json !== undefined) encabezados['Content-Type'] = 'application/json'
      const respuesta = await llamar(`${base}${ruta}`, {
        method: metodo,
        headers: encabezados,
        body: json !== undefined ? JSON.stringify(json) : formulario,
        signal: controlador?.signal,
      })
      let cuerpo = null
      if (respuesta.status !== 204) {
        try {
          cuerpo = await respuesta.json()
        } catch {
          // respuesta sin cuerpo JSON (p. ej. una página de error del proxy)
        }
      }
      return { status: respuesta.status, cuerpo, retryAfter: leerRetryAfter(respuesta.headers) }
    } catch (error) {
      return { status: 0, cuerpo: null, red: true, agotado: error?.name === 'AbortError' }
    } finally {
      if (temporizador) clearTimeout(temporizador)
    }
  }

  const ruta = (clave) => `/mi-expediente/documentos/${encodeURIComponent(clave)}`

  return {
    salud() {
      return ejecutar('/salud', { conSesion: false, tiempoMs: TIEMPO_SALUD_MS })
    },
    obtenerConfig() {
      return ejecutar('/config', { conSesion: false })
    },
    obtenerExpediente() {
      return ejecutar('/mi-expediente')
    },
    guardar(datos, version) {
      const cuerpo = { datos }
      if (Number.isInteger(version)) cuerpo.version = version
      return ejecutar('/mi-expediente', { metodo: 'PUT', json: cuerpo })
    },
    subir({ clave, archivo, nombre, fecha, idem }) {
      const formulario = new FormData()
      formulario.append('archivo', archivo, nombre || 'documento')
      if (fecha) formulario.append('fecha_documento', fecha)
      return ejecutar(ruta(clave), {
        metodo: 'POST',
        formulario,
        cabeceras: { 'X-Idempotency-Key': idem },
        tiempoMs: TIEMPO_SUBIDA_MS,
      })
    },
    corregirFecha(clave, fecha) {
      return ejecutar(ruta(clave), { metodo: 'PUT', json: { fecha_documento: fecha } })
    },
    quitar(clave) {
      return ejecutar(ruta(clave), { metodo: 'DELETE' })
    },
    enviar() {
      return ejecutar('/mi-expediente/enviar', { metodo: 'POST', json: { declaracion: true } })
    },
  }
}
