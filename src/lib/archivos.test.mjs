import test from 'node:test'
import assert from 'node:assert/strict'

import { aceptacionParaTipos, esDocumentoWord, prepararArchivo, tipoDeArchivo } from './archivos.js'

// Archivo estilo File (name/type/size): prepararArchivo solo llega a tocar el
// DOM cuando la imagen se decodifica, y ese caso se prueba con stubs.
function archivo({ name = 'a.pdf', type = 'application/pdf', size = 1024 } = {}) {
  return { name, type, size }
}

const DEF = { clave: 'rtu' }
const FOTO = { clave: 'foto' }

test('un PDF normal pasa sin errores', async () => {
  const r = await prepararArchivo(archivo({ name: 'rtu.pdf', size: 500 * 1024 }), DEF)
  assert.equal(r.error, undefined)
  assert.equal(r.archivo.name, 'rtu.pdf')
})

test('Word se detecta por MIME o por extensión', () => {
  assert.equal(esDocumentoWord(archivo({ name: 'cv.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })), true)
  assert.equal(esDocumentoWord(archivo({ name: 'cv.doc', type: 'application/msword' })), true)
  // El navegador a veces reporta el MIME vacío: la extensión alcanza.
  assert.equal(esDocumentoWord(archivo({ name: 'Mi curriculum.docx', type: '' })), true)
  assert.equal(esDocumentoWord(archivo({ name: 'rtu.pdf' })), false)
})

test('Word tiene su propio mensaje, con cómo convertirlo', async () => {
  for (const nombre of ['cv.doc', 'cv.docx', 'Mi curriculum vitae.docx']) {
    const r = await prepararArchivo(archivo({ name: nombre, type: '' }), DEF)
    assert.equal(
      r.error,
      'Los documentos de Word no se aceptan. Ábralo y use “Guardar como PDF”, o tómele una foto al documento impreso.',
      nombre
    )
  }
  const porMime = await prepararArchivo(
    archivo({ name: 'x.bin', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
    DEF
  )
  assert.equal(
    porMime.error,
    'Los documentos de Word no se aceptan. Ábralo y use “Guardar como PDF”, o tómele una foto al documento impreso.'
  )
})

test('el PDF que pesa más del máximo dice cuánto pesa y cómo achicarlo', async () => {
  const r = await prepararArchivo(
    archivo({ name: 'penales.pdf', type: 'application/pdf', size: Math.round(8.4 * 1024 * 1024) }),
    DEF
  )
  assert.equal(
    r.error,
    'El PDF pesa 8.4 MB y el máximo es 8 MB. Escanéelo en escala de grises o a menor resolución (150 ppp), o suba una foto de cada página.'
  )
  // El tope de la definición manda: con 20 MB el mensaje dice 20.
  const r20 = await prepararArchivo(
    archivo({ name: 'grande.pdf', type: 'application/pdf', size: 21 * 1024 * 1024 }),
    { clave: 'rtu', max_mb: 20 }
  )
  assert.ok(r20.error.startsWith('El PDF pesa 21.0 MB y el máximo es 20 MB.'), r20.error)
  // El mismo exceso en una imagen sigue con el mensaje genérico (se mide el
  // archivo original, antes de reescalarlo).
  const rImg = await prepararArchivo(
    archivo({ name: 'foto.jpg', type: 'image/jpeg', size: 9 * 1024 * 1024 }),
    DEF
  )
  assert.equal(rImg.error, 'El archivo supera el máximo de 8 MB')
})

test('cualquier imagen del navegador cuenta como imagen (HEIC, WEBP)', () => {
  assert.equal(tipoDeArchivo(archivo({ name: 'foto.heic', type: 'image/heic' })), 'jpg')
  assert.equal(tipoDeArchivo(archivo({ name: 'foto.webp', type: 'image/webp' })), 'jpg')
  assert.equal(tipoDeArchivo(archivo({ name: 'foto.jpg', type: 'image/jpeg' })), 'jpg')
  assert.equal(tipoDeArchivo(archivo({ name: 'a.pdf' })), 'pdf')
  assert.equal(tipoDeArchivo(archivo({ name: 'x.zip', type: 'application/zip' })), null)
})

test('la imagen que el navegador no puede decodificar tiene su propio mensaje', async () => {
  // Sin DOM en node: se stubbean Image y URL. El setter de src dispara el
  // error de decodificación (el caso de un HEIC en un navegador sin soporte).
  const urlPrevia = globalThis.URL
  const imagenPrevia = globalThis.Image
  globalThis.URL = { createObjectURL: () => 'blob:prueba', revokeObjectURL: () => {} }
  globalThis.Image = class {
    set src(valor) {
      queueMicrotask(() => this.onerror?.())
    }
  }
  try {
    const r = await prepararArchivo(archivo({ name: 'IMG_0001.heic', type: 'image/heic' }), FOTO)
    assert.equal(r.error, 'Este formato de imagen no se pudo abrir. Tome la foto de nuevo o guárdela como JPG.')
  } finally {
    globalThis.URL = urlPrevia
    globalThis.Image = imagenPrevia
  }
})

test('el selector de archivos acepta cualquier imagen, y la foto solo imágenes', () => {
  assert.equal(aceptacionParaTipos(['pdf', 'jpg', 'png']), 'application/pdf,image/*')
  assert.equal(aceptacionParaTipos(['jpg', 'png']), 'image/*')
})
