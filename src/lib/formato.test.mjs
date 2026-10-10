import test from 'node:test'
import assert from 'node:assert/strict'

import { ALERTAS_ROJAS, TEXTOS_ALERTAS, formatoDia, formatoInstante } from './formato.js'

test('los instantes UTC se muestran en hora de Guatemala (UTC−6)', () => {
  assert.equal(formatoInstante('2026-10-06T03:30:00Z'), '05/10/2026, 21:30')
  assert.equal(formatoInstante('2026-10-06T06:00:00Z'), '06/10/2026, 00:00')
  assert.equal(formatoDia('2026-10-06T03:30:00Z'), '05/10/2026')
  assert.equal(formatoInstante(null), '')
  assert.equal(formatoInstante('no es fecha'), '')
})

test('textos de las alertas nuevas de la verificación v2 y su conjunto rojo', () => {
  assert.equal(TEXTOS_ALERTAS.EN_BLANCO, 'El archivo está en blanco')
  assert.equal(TEXTOS_ALERTAS.EMITIDO_ANTES_DEL_MINIMO, 'El documento fue emitido antes de la fecha mínima pedida')
  assert.equal(TEXTOS_ALERTAS.VENCIDO, 'El documento ya está vencido')
  // Las alertas de siempre siguen en ámbar: el conjunto rojo son solo estas tres.
  assert.deepEqual(ALERTAS_ROJAS, ['EN_BLANCO', 'EMITIDO_ANTES_DEL_MINIMO', 'VENCIDO'])
})
