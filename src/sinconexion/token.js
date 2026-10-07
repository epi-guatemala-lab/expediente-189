// Lectura (sin verificar) del identificador de sesión `sid` que lleva el token.
// Solo sirve de etiqueta para saber si lo guardado en el dispositivo pertenece a la
// sesión actual; la verificación de la firma es asunto exclusivo del servidor.

import { bytesDeBase64url } from './cripto.js'

const decodificador = new TextDecoder()

export function cargaDeToken(token) {
  if (typeof token !== 'string') return null
  const partes = token.split('.')
  if (partes.length !== 3 || !partes[1]) return null
  try {
    return JSON.parse(decodificador.decode(bytesDeBase64url(partes[1])))
  } catch {
    return null
  }
}

export function sidDeToken(token) {
  const carga = cargaDeToken(token)
  const sid = carga?.sid
  return typeof sid === 'string' && sid ? sid : null
}
