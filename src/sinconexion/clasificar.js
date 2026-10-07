// Clasificación de las respuestas del servidor para la cola. Se decide por el `codigo`
// que trae todo error del servidor (no por el texto del mensaje ni solo por el número HTTP);
// cuando no hay `codigo` (respuestas del proxy, sin cuerpo JSON) se usa el estado HTTP.
//
//   ok       → se borra de la cola y se actualiza la copia
//   red      → red caída, tiempo agotado, 408 y 502/503/504 del proxy: queda en cola y se
//              reintenta (sondeando /salud)
//   ocupado  → OCUPADO, ANTIVIRUS_NO_DISPONIBLE, LIMITE_SUBIDAS y 429 sin cuerpo: el
//              servidor está saturado, NO es un error: se reintenta tras `Retry-After`
//              (o con espera creciente) y la persona solo ve «hay mucha demanda»
//   servidor → otro 5xx sin código (p. ej. 500): se reintenta unas veces y pasa a fallida
//   sesion   → SESION (401): se pausa la cola y se pide volver a entrar
//   version  → VERSION con `actual`: se reaplica encima del expediente vigente, una vez
//   fallida  → ESTADO, VALIDACION, ARCHIVO_*, LIMITE_VERSIONES, LIMITE_ESPACIO,
//              NO_VISIBLE y demás 4xx: NO se reintenta; se muestra a la persona

export const MAX_INTENTOS_SERVIDOR = 5

export const CODIGOS_REINTENTAR = ['OCUPADO', 'ANTIVIRUS_NO_DISPONIBLE', 'LIMITE_SUBIDAS']
export const CODIGOS_NO_REINTENTAR = [
  'ESTADO',
  'VALIDACION',
  'ARCHIVO_GRANDE',
  'ARCHIVO_TIPO',
  'ARCHIVO_INFECTADO',
  'ARCHIVO_INVALIDO',
  'LIMITE_VERSIONES',
  'LIMITE_ESPACIO',
  'NO_VISIBLE',
]

const MENSAJES_POR_CODIGO = {
  ESTADO: 'El expediente ya no admite estos cambios.',
  VALIDACION: 'El servidor no aceptó la información enviada.',
  ARCHIVO_GRANDE: 'El archivo es demasiado grande.',
  ARCHIVO_TIPO: 'El tipo de archivo no está permitido.',
  ARCHIVO_INFECTADO: 'El archivo fue rechazado por seguridad. Suba otro archivo.',
  ARCHIVO_INVALIDO: 'El archivo no se pudo leer. Suba otro archivo.',
  LIMITE_VERSIONES: 'Se superó el límite de versiones permitidas para este documento.',
  LIMITE_ESPACIO: 'Se alcanzó el espacio máximo permitido para los documentos.',
  NO_VISIBLE: 'Por seguridad este dato no se puede modificar desde esta sesión. Vuelva a escribirlo completo.',
}

const MENSAJES_POR_ESTADO = {
  409: 'El expediente ya no admite estos cambios.',
  413: 'El archivo es demasiado grande para el servidor.',
  422: 'El servidor no aceptó la información enviada.',
}

function mensajeDe(status, cuerpo, codigo) {
  const detalle = cuerpo?.detail
  if (typeof detalle === 'string' && detalle.trim()) return detalle.trim()
  if (Array.isArray(detalle) && detalle.length) {
    const textos = detalle.map((d) => d?.msg).filter(Boolean)
    if (textos.length) return textos.join(' ')
  }
  return MENSAJES_POR_CODIGO[codigo] || MENSAJES_POR_ESTADO[status] || `El servidor respondió con el código ${status}.`
}

function esperaDe(retryAfter) {
  if (!retryAfter || retryAfter <= 0) return null
  return Math.min(Math.max(retryAfter * 1000, 1000), 120_000)
}

// resultado = { status, cuerpo, retryAfter?, red? } tal como lo entrega el transporte.
export function clasificarRespuesta(resultado) {
  const { status, cuerpo = null, retryAfter = null, red = false } = resultado || {}
  if (red || !status) return { clase: 'red', status: 0 }
  if (status >= 200 && status < 300) return { clase: 'ok', status, cuerpo }

  const hayCuerpo = cuerpo !== null && typeof cuerpo === 'object'
  const codigo = hayCuerpo && typeof cuerpo.codigo === 'string' ? cuerpo.codigo : null
  const errores = hayCuerpo ? cuerpo.errores || null : null

  if (codigo === 'SESION') return { clase: 'sesion', status, codigo }
  if (codigo === 'VERSION') {
    if (cuerpo.actual && typeof cuerpo.actual === 'object') {
      return { clase: 'version', status, codigo, actual: cuerpo.actual, mensaje: mensajeDe(status, cuerpo, codigo) }
    }
    return { clase: 'fallida', status, codigo, mensaje: mensajeDe(status, cuerpo, codigo), errores }
  }
  if (CODIGOS_REINTENTAR.includes(codigo)) {
    return { clase: 'ocupado', status, codigo, esperaMs: esperaDe(retryAfter) }
  }
  if (CODIGOS_NO_REINTENTAR.includes(codigo)) {
    return { clase: 'fallida', status, codigo, mensaje: mensajeDe(status, cuerpo, codigo), errores }
  }

  // Sin código conocido: se decide por el estado HTTP.
  if (status === 401) return { clase: 'sesion', status }
  if (status === 409) {
    if (hayCuerpo && cuerpo.actual && typeof cuerpo.actual === 'object') {
      return { clase: 'version', status, actual: cuerpo.actual, mensaje: mensajeDe(status, cuerpo) }
    }
    return { clase: 'fallida', status, mensaje: mensajeDe(status, cuerpo), errores }
  }
  if (status === 429) {
    if (!hayCuerpo) return { clase: 'ocupado', status, esperaMs: esperaDe(retryAfter) }
    return { clase: 'fallida', status, mensaje: mensajeDe(status, cuerpo), errores }
  }
  if (status === 408 || status === 502 || status === 503 || status === 504) {
    return { clase: 'red', status }
  }
  if (status >= 500) return { clase: 'servidor', status, mensaje: mensajeDe(status, cuerpo) }
  return { clase: 'fallida', status, mensaje: mensajeDe(status, cuerpo), errores }
}
