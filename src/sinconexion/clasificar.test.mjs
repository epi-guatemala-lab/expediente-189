// Clasificación de respuestas por `codigo` (y por estado HTTP cuando no hay código).
import test from 'node:test'
import assert from 'node:assert/strict'

import { CODIGOS_NO_REINTENTAR, CODIGOS_REINTENTAR, clasificarRespuesta } from './clasificar.js'

const r = (status, cuerpo = null, extra = {}) => clasificarRespuesta({ status, cuerpo, ...extra })

test('éxito y red caída', () => {
  assert.equal(r(200, { id: 1 }).clase, 'ok')
  assert.equal(r(204).clase, 'ok')
  assert.equal(clasificarRespuesta({ status: 0, red: true }).clase, 'red')
  assert.equal(clasificarRespuesta({ status: 0, red: true, agotado: true }).clase, 'red')
})

test('502, 503, 504 y 408 sin código (del proxy) se reintentan solos', () => {
  for (const status of [502, 503, 504, 408]) assert.equal(r(status).clase, 'red', String(status))
  assert.equal(r(503, { detail: 'x' }).clase, 'red')
})

test('429 sin cuerpo JSON es freno de ritmo: reintentar con Retry-After', () => {
  const c = r(429, null, { retryAfter: 7 })
  assert.equal(c.clase, 'ocupado')
  assert.equal(c.esperaMs, 7000)
  assert.equal(r(429).esperaMs, null)
})

test('códigos de «reintentar solo»: OCUPADO, ANTIVIRUS_NO_DISPONIBLE y LIMITE_SUBIDAS', () => {
  assert.deepEqual(CODIGOS_REINTENTAR, ['OCUPADO', 'ANTIVIRUS_NO_DISPONIBLE', 'LIMITE_SUBIDAS'])
  for (const codigo of CODIGOS_REINTENTAR) {
    for (const status of [429, 503]) {
      const c = r(status, { detail: 'mucha demanda', codigo }, { retryAfter: 3 })
      assert.equal(c.clase, 'ocupado', `${codigo}/${status}`)
      assert.equal(c.esperaMs, 3000)
    }
  }
})

test('SESION pausa y pide entrar de nuevo (con o sin código 401)', () => {
  assert.equal(r(401, { detail: 'x', codigo: 'SESION' }).clase, 'sesion')
  assert.equal(r(401).clase, 'sesion')
})

test('VERSION trae `actual` y se reaplica; sin `actual` no hay nada que reaplicar', () => {
  const actual = { version: 9, datos: {} }
  const c = r(409, { detail: 'recargue', codigo: 'VERSION', actual })
  assert.equal(c.clase, 'version')
  assert.deepEqual(c.actual, actual)
  assert.equal(r(409, { detail: 'recargue', codigo: 'VERSION' }).clase, 'fallida')
  assert.equal(r(409, { detail: 'v', actual }).clase, 'version') // sin código, por compatibilidad
})

test('códigos de «no reintentar»: pasan a fallida con el mensaje del servidor y sus errores', () => {
  assert.deepEqual(CODIGOS_NO_REINTENTAR, [
    'ESTADO', 'VALIDACION', 'ARCHIVO_GRANDE', 'ARCHIVO_TIPO', 'ARCHIVO_INFECTADO',
    'ARCHIVO_INVALIDO', 'LIMITE_VERSIONES', 'LIMITE_ESPACIO', 'NO_VISIBLE',
  ])
  const estados = { ESTADO: 409, VALIDACION: 422, ARCHIVO_GRANDE: 413, ARCHIVO_TIPO: 422, ARCHIVO_INFECTADO: 422, ARCHIVO_INVALIDO: 422, LIMITE_VERSIONES: 429, LIMITE_ESPACIO: 413, NO_VISIBLE: 403 }
  for (const codigo of CODIGOS_NO_REINTENTAR) {
    const c = r(estados[codigo], { detail: `mensaje ${codigo}`, codigo, errores: { telefono: 'mal' } })
    assert.equal(c.clase, 'fallida', codigo)
    assert.equal(c.mensaje, `mensaje ${codigo}`)
    assert.deepEqual(c.errores, { telefono: 'mal' })
  }
})

test('el código manda sobre el número: un 429 con LIMITE_VERSIONES NO se reintenta', () => {
  assert.equal(r(429, { detail: 'v', codigo: 'LIMITE_VERSIONES' }, { retryAfter: 5 }).clase, 'fallida')
  assert.equal(r(429, { detail: 'v' }).clase, 'fallida') // con cuerpo y sin código: no es del proxy
})

test('sin código, por estado: otros 5xx se reintentan unas veces; otros 4xx son fallida', () => {
  assert.equal(r(500, { detail: 'boom' }).clase, 'servidor')
  assert.equal(r(404, { detail: 'no' }).clase, 'fallida')
  assert.equal(r(403, null).clase, 'fallida')
  assert.match(r(413).mensaje, /demasiado grande/)
})
