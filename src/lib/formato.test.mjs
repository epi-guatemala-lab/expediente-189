import test from 'node:test'
import assert from 'node:assert/strict'

import { formatoDia, formatoInstante } from './formato.js'

test('los instantes UTC se muestran en hora de Guatemala (UTC−6)', () => {
  assert.equal(formatoInstante('2026-10-06T03:30:00Z'), '05/10/2026, 21:30')
  assert.equal(formatoInstante('2026-10-06T06:00:00Z'), '06/10/2026, 00:00')
  assert.equal(formatoDia('2026-10-06T03:30:00Z'), '05/10/2026')
  assert.equal(formatoInstante(null), '')
  assert.equal(formatoInstante('no es fecha'), '')
})
