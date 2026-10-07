// Mensajes para la persona a partir de los errores del servidor (siempre traen `codigo`).

export const MSJ_SIN_SERVIDOR_CON_BOVEDA =
  'No hay conexión con el servidor en este momento. Lo que usted guardó en este dispositivo sigue aquí, protegido, y se enviará cuando vuelva a entrar con conexión.'
export const MSJ_SIN_SERVIDOR =
  'No hay conexión con el servidor. Intente de nuevo en unos minutos.'
export const MSJ_CREDENCIALES =
  'El DPI o el nombre no coinciden con la nómina. Revise que el DPI esté completo y escriba su nombre como aparece en él.'
export const MSJ_DEMANDA = 'Hay mucha demanda en este momento. Intente de nuevo en unos segundos.'

export function minutosDeEspera(retryAfter) {
  const segundos = Number(retryAfter)
  if (!Number.isFinite(segundos) || segundos <= 0) return null
  return Math.max(1, Math.ceil(segundos / 60))
}

// ¿El fallo fue de conexión o del servidor (no de las credenciales)?
export function esFalloDeServidor(error) {
  return Boolean(error?.red) || !error?.status || error.status >= 500
}

export function esDemanda(error) {
  return error?.codigo === 'OCUPADO' || (error?.status === 429 && !error?.codigo)
}

// Mensaje de la pantalla de acceso. `hayBoveda`: este dispositivo guarda datos de esa persona.
export function mensajeDeAcceso(error, { hayBoveda = false } = {}) {
  if (error?.codigo === 'CREDENCIALES') return MSJ_CREDENCIALES
  if (error?.codigo === 'BLOQUEADO') {
    const minutos = minutosDeEspera(error.retryAfter)
    const espera = minutos === null ? 'unos minutos' : `${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`
    return `Demasiados intentos con este DPI. Espere ${espera} o pida a Recepción que lo desbloquee.`
  }
  if (esDemanda(error)) return MSJ_DEMANDA
  if (esFalloDeServidor(error)) return hayBoveda ? MSJ_SIN_SERVIDOR_CON_BOVEDA : MSJ_SIN_SERVIDOR
  return error?.detail || 'No se pudo iniciar sesión. Intente de nuevo.'
}
