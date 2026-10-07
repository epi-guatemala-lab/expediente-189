// Cifrado del dispositivo con WebCrypto.
//
// La llave es AES-GCM de 256 bits y la entrega el servidor al iniciar sesión
// (`llave_boveda`: 32 bytes en base64url, estables por persona). Se importa como
// NO extraíble: el código de la página puede usarla para cifrar y descifrar, pero
// no puede leerla ni serializarla. Cada texto cifrado lleva su propio IV aleatorio
// de 12 bytes; nunca se reutiliza un IV con la misma llave.

export const TAM_LLAVE = 32
export const TAM_IV = 12

const codificador = new TextEncoder()
const decodificador = new TextDecoder()

export class ErrorLlave extends Error {
  constructor(mensaje) {
    super(mensaje)
    this.name = 'ErrorLlave'
  }
}

export class ErrorDescifrado extends Error {
  constructor(mensaje = 'No se pudo descifrar: la llave no corresponde o el dato está dañado') {
    super(mensaje)
    this.name = 'ErrorDescifrado'
  }
}

// ¿Este navegador puede cifrar? (WebCrypto exige un contexto seguro: https o localhost.)
export function disponible() {
  const c = globalThis.crypto
  return Boolean(c && c.subtle && typeof c.getRandomValues === 'function')
}

export function aleatorios(cantidad) {
  const bytes = new Uint8Array(cantidad)
  globalThis.crypto.getRandomValues(bytes)
  return bytes
}

// base64url (o base64 común, por tolerancia) → bytes. Lanza ErrorLlave si no es válido.
export function bytesDeBase64url(texto) {
  const limpio = String(texto ?? '').trim()
  if (!/^[A-Za-z0-9_+/-]+={0,2}$/.test(limpio)) {
    throw new ErrorLlave('La llave no tiene formato base64url')
  }
  const base64 = limpio.replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/')
  const relleno = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  let binario
  try {
    binario = atob(relleno)
  } catch {
    throw new ErrorLlave('La llave no tiene formato base64url')
  }
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return bytes
}

export function base64urlDeBytes(bytes) {
  let binario = ''
  for (const b of bytes) binario += String.fromCharCode(b)
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Importa la llave del servidor como CryptoKey AES-GCM NO extraíble.
export async function importarLlave(llaveBase64url) {
  const bytes = bytesDeBase64url(llaveBase64url)
  if (bytes.length !== TAM_LLAVE) {
    throw new ErrorLlave(`La llave debe tener ${TAM_LLAVE} bytes`)
  }
  const extractable = false
  try {
    return await globalThis.crypto.subtle.importKey(
      'raw',
      bytes,
      { name: 'AES-GCM' },
      extractable, // false: la página puede usar la llave, no leerla
      ['encrypt', 'decrypt']
    )
  } finally {
    bytes.fill(0)
  }
}

function adicional(aad) {
  return codificador.encode(String(aad ?? ''))
}

// Cifra texto o bytes. `aad` liga el cifrado a su uso (p. ej. 'cola:archivo').
export async function cifrar(llave, datos, aad = '') {
  const iv = aleatorios(TAM_IV)
  const plano = typeof datos === 'string' ? codificador.encode(datos) : datos
  const cifrado = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: adicional(aad) },
    llave,
    plano
  )
  return { iv, cifrado: new Uint8Array(cifrado) }
}

// Devuelve los bytes originales. Con otra llave, otro `aad` o un dato alterado lanza ErrorDescifrado.
export async function descifrar(llave, { iv, cifrado }, aad = '') {
  try {
    const plano = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: adicional(aad) },
      llave,
      cifrado
    )
    return new Uint8Array(plano)
  } catch {
    throw new ErrorDescifrado()
  }
}

export async function descifrarTexto(llave, registro, aad = '') {
  return decodificador.decode(await descifrar(llave, registro, aad))
}

export async function cifrarJson(llave, valor, aad = '') {
  return cifrar(llave, JSON.stringify(valor), aad)
}

export async function descifrarJson(llave, registro, aad = '') {
  return JSON.parse(await descifrarTexto(llave, registro, aad))
}

export async function sha256Hex(texto) {
  const resumen = await globalThis.crypto.subtle.digest('SHA-256', codificador.encode(String(texto)))
  return Array.from(new Uint8Array(resumen), (b) => b.toString(16).padStart(2, '0')).join('')
}
