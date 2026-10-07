// Cliente del módulo expediente189 (CONTRATO §5): acceso, miniaturas y sesión.
// Las escrituras y lecturas del expediente van por la capa sin conexión
// (src/sinconexion), que usa el mismo servidor a través de su propio transporte.
//
// En sessionStorage (vida de la pestaña; jamás en el almacenamiento persistente del
// navegador) solo se guarda lo de la sesión: el token vigente, el último token (aunque haya vencido, para pedir la
// continuidad de la sesión al volver a entrar), la llave de la bóveda cifrada y el
// identificador de la bóveda (SHA-256 del CUI, no el CUI).

const API = import.meta.env?.VITE_API_URL || 'https://igss.mediclic.org/jornadas/api'
export const BASE = `${API}/expediente189`

const CLAVES = {
  token: 'exp189_token',
  anterior: 'exp189_anterior',
  llave: 'exp189_llave',
  boveda: 'exp189_boveda',
}

let oyenteSesionVencida = null

export function alSesionVencida(oyente) {
  oyenteSesionVencida = typeof oyente === 'function' ? oyente : null
}

function leer(clave) {
  try {
    return sessionStorage.getItem(clave)
  } catch {
    return null
  }
}

function escribir(clave, valor) {
  try {
    if (valor === null || valor === undefined) sessionStorage.removeItem(clave)
    else sessionStorage.setItem(clave, valor)
  } catch {
    // sin acceso a sessionStorage: la sesión solo vive en memoria
  }
}

export const leerToken = () => leer(CLAVES.token)
export const leerTokenAnterior = () => leer(CLAVES.anterior)

export function leerSesion() {
  return {
    token: leer(CLAVES.token),
    anterior: leer(CLAVES.anterior),
    llave: leer(CLAVES.llave),
    idBoveda: leer(CLAVES.boveda),
  }
}

// Tras un acceso exitoso. El token queda también como «último token» de la pestaña.
export function guardarSesion({ token, llave, idBoveda }) {
  escribir(CLAVES.token, token)
  escribir(CLAVES.anterior, token)
  if (llave !== undefined) escribir(CLAVES.llave, llave)
  if (idBoveda !== undefined) escribir(CLAVES.boveda, idBoveda)
}

export function guardarLlave(llave) {
  escribir(CLAVES.llave, llave)
}

// El token vigente venció o fue rechazado: se descarta, pero el último token se conserva
// para poder pedir la continuidad de la sesión.
export function borrarToken() {
  escribir(CLAVES.token, null)
}

// «Salir»: se olvida todo lo de la sesión.
export function cerrarSesion() {
  for (const clave of Object.values(CLAVES)) escribir(clave, null)
}

function sesionVencida() {
  borrarToken()
  if (oyenteSesionVencida) oyenteSesionVencida()
  return { status: 401, codigo: 'SESION', detail: 'Su sesión venció' }
}

function segundosDe(cabeceras) {
  try {
    const n = Number(cabeceras?.get?.('Retry-After'))
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

// Una red caída llega como { status: 0, red: true }: nunca un error crudo del navegador.
async function llamar(ruta, opciones) {
  try {
    return await fetch(`${BASE}${ruta}`, opciones)
  } catch {
    throw { status: 0, red: true, detail: 'No hay conexión con el servidor.' }
  }
}

async function errorDe(respuesta) {
  let datos = null
  try {
    datos = await respuesta.json()
  } catch {
    // respuesta sin cuerpo JSON (p. ej. la página de error del proxy)
  }
  return {
    status: respuesta.status,
    codigo: datos?.codigo || null,
    detail: typeof datos?.detail === 'string' ? datos.detail : `Error ${respuesta.status}`,
    errores: datos?.errores || null,
    retryAfter: segundosDe(respuesta.headers),
  }
}

// POST /acceso { cui, nombre, sesion_anterior? } → { token, expira_en_min, nombre, llave_boveda }
// El nombre se envía tal como se escribió (el servidor compara con tolerancia). Si la
// pestaña tuvo una sesión antes, se manda siempre el último token como `sesion_anterior`.
export async function acceso(cui, nombre) {
  const cuerpo = { cui, nombre }
  const anterior = leerTokenAnterior()
  if (anterior) cuerpo.sesion_anterior = anterior
  const respuesta = await llamar('/acceso', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  })
  if (!respuesta.ok) throw await errorDe(respuesta)
  return respuesta.json()
}

// La vista previa es un image/jpeg que se pide con el token y se muestra como blob:.
// Para documentos que no se subieron en esta sesión el servidor responde 403 NO_VISIBLE.
export async function obtenerVistaDocumento(clave, pagina = 1) {
  const token = leerToken()
  const respuesta = await llamar(
    `/mi-expediente/documentos/${encodeURIComponent(clave)}/vista?pagina=${pagina}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} }
  )
  if (respuesta.status === 401) throw sesionVencida()
  if (!respuesta.ok) throw await errorDe(respuesta)
  return respuesta.blob()
}
