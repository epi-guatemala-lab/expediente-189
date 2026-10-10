// Enlace al validador oficial (verificación v2) y fechas leídas del documento.
import test from 'node:test'
import assert from 'node:assert/strict'

import { diaGuatemala, fechaLeida, hoyGuatemala, urlValidadorOficial } from './utiles.js'

test('el validador oficial se enlaza solo con https y dominios institucionales', () => {
  assert.equal(
    urlValidadorOficial('https://consultas.oj.gob.gt/validar?codigo=ABC123'),
    'https://consultas.oj.gob.gt/validar?codigo=ABC123'
  )
  assert.equal(urlValidadorOficial('https://pnc.gob.gt/verifica'), 'https://pnc.gob.gt/verifica')
  assert.equal(urlValidadorOficial('https://mimp.mp.gob.gt/consulta'), 'https://mimp.mp.gob.gt/consulta')
  assert.equal(urlValidadorOficial('https://sat.gob.gt/'), 'https://sat.gob.gt/')
})

test('dominios parecidos o esquemas peligrosos NO se enlazan', () => {
  // Un subdominio falso: el dominio real es evil.example.
  assert.equal(urlValidadorOficial('https://oj.gob.gt.evil.example/validar'), null)
  assert.equal(urlValidadorOficial('javascript:alert(1)'), null)
  assert.equal(urlValidadorOficial('https://evil.example/?u=https://oj.gob.gt'), null)
  // Usuario informativo: el host real es evil.example.
  assert.equal(urlValidadorOficial('https://oj.gob.gt@evil.example/'), null)
  // Sin https no se abre: ni http ni otros esquemas.
  assert.equal(urlValidadorOficial('http://oj.gob.gt/validar'), null)
  assert.equal(urlValidadorOficial('data:text/html,<h1>hola</h1>'), null)
  // Los dominios válidos con otro subdominio extra también pasan la lista,
  // pero un dominio ajeno aunque se parezca, no.
  assert.equal(urlValidadorOficial('https://oj.gob.gt.example.com/'), null)
  assert.equal(urlValidadorOficial('https://mpng.gob.gt/'), null)
  // Entradas que no son URL.
  assert.equal(urlValidadorOficial('no-es-url'), null)
  assert.equal(urlValidadorOficial(''), null)
  assert.equal(urlValidadorOficial(null), null)
  assert.equal(urlValidadorOficial(undefined), null)
})

test('las fechas leídas del documento se muestran DD/MM/AAAA', () => {
  assert.equal(fechaLeida('2026-09-14'), '14/09/2026')
  // Un instante completo se convierte al día de Guatemala (UTC−6).
  assert.equal(fechaLeida('2026-09-14T02:30:00Z'), '13/09/2026')
  assert.equal(diaGuatemala('2026-09-14T02:30:00Z'), '2026-09-13')
  assert.equal(diaGuatemala('2026-09-14'), '2026-09-14')
  assert.equal(fechaLeida('no es fecha'), '')
  assert.equal(fechaLeida(null), '')
})

test('hoy en Guatemala viene como AAAA-MM-DD', () => {
  // 18:30 UTC del 8 de octubre == 12:30 del mismo día en Guatemala.
  assert.equal(hoyGuatemala(new Date('2026-10-08T18:30:00Z')), '2026-10-08')
  // La medianoche UTC todavía es el día anterior en Guatemala.
  assert.equal(hoyGuatemala(new Date('2026-10-09T00:30:00Z')), '2026-10-08')
  assert.match(hoyGuatemala(), /^\d{4}-\d{2}-\d{2}$/)
})
