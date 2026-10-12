import test from 'node:test'
import assert from 'node:assert/strict'

import { avisosDeVerificacion, motivosParaRevisar } from './avisos.js'

// Un documento ya cargado, visible y con la verificación terminada: el punto
// de partida de todos los avisos. Sin fecha ni tipo declarado no genera
// avisos por sí solo.
const BASE = {
  cargado: true,
  oculto: false,
  alertas: [],
  verificacion: { estado: 'LISTA' },
}
const DEF = { clave: 'rtu', titulo: 'RTU emitido por la SAT' }
const DEF_FOTO = { clave: 'foto', titulo: 'Fotografía reciente tipo cédula' }

function avisos(documento, definicion = DEF) {
  return avisosDeVerificacion(documento, definicion, [DEF, DEF_FOTO])
}

test('sin verificación o sin estar LISTA no hay avisos', () => {
  assert.deepEqual(avisosDeVerificacion({ cargado: true }, DEF, []), [])
  assert.deepEqual(
    avisosDeVerificacion({ ...BASE, verificacion: { estado: 'EN_PROCESO' } }, DEF, []),
    []
  )
  assert.deepEqual(avisosDeVerificacion({ ...BASE, oculto: true }, DEF, []), [])
})

test('legible === false pide una foto o escaneo mejor (ámbar)', () => {
  const lista = avisos({ ...BASE, verificacion: { estado: 'LISTA', legible: false } })
  const aviso = lista.find((a) => a.clave === 'legible')
  assert.equal(aviso.tipo, 'alerta')
  assert.equal(
    aviso.texto,
    'No pudimos leer este documento. Si es una foto, tómela de nuevo con buena luz, sin sombras y con el papel completo y derecho.'
  )
})

test('legible === false no avisa cuando el archivo está en blanco', () => {
  const lista = avisos({
    ...BASE,
    alertas: ['EN_BLANCO'],
    verificacion: { estado: 'LISTA', legible: false, en_blanco: true },
  })
  assert.equal(lista.find((a) => a.clave === 'legible'), undefined)
  assert.equal(lista.find((a) => a.clave === 'en_blanco').tipo, 'error')
})

test('identidad NO_COINCIDE avisa en rojo que no están el nombre ni el DPI', () => {
  const aviso = avisos({ ...BASE, verificacion: { estado: 'LISTA', identidad: 'NO_COINCIDE' } }).find(
    (a) => a.clave === 'identidad'
  )
  assert.equal(aviso.tipo, 'error')
  assert.equal(
    aviso.texto,
    'En este documento no encontramos su nombre ni su DPI. Revise que sea el suyo.'
  )
})

test('colegiado NO_COINCIDE avisa en rojo la diferencia con el paso 3', () => {
  const aviso = avisos({
    ...BASE,
    verificacion: { estado: 'LISTA', colegiado: 'NO_COINCIDE' },
  }).find((a) => a.clave === 'colegiado')
  assert.equal(aviso.tipo, 'error')
  assert.equal(
    aviso.texto,
    'El número de colegiado del documento no coincide con el que usted escribió en el paso 3.'
  )
})

test('ARCHIVO_REPETIDO avisa en rojo que cada casillero necesita su archivo', () => {
  const aviso = avisos({ ...BASE, alertas: ['ARCHIVO_REPETIDO'] }).find(
    (a) => a.clave === 'archivo_repetido'
  )
  assert.equal(aviso.tipo, 'error')
  assert.equal(
    aviso.texto,
    'Este mismo archivo ya está cargado en otro documento. Cada casillero necesita su propio archivo.'
  )
})

test('VARIOS_DOCUMENTOS avisa en ámbar que se suba cada documento por separado', () => {
  const aviso = avisos({ ...BASE, alertas: ['VARIOS_DOCUMENTOS'] }).find(
    (a) => a.clave === 'varios_documentos'
  )
  assert.equal(aviso.tipo, 'alerta')
  assert.equal(
    aviso.texto,
    'Este archivo trae varios documentos juntos. Suba cada documento por separado en su casillero.'
  )
})

test('las alertas de la fotografía rematan con el consejo de foto tipo cédula', () => {
  const CONSEJO = 'Use una foto de frente, vertical, tipo cédula.'
  const pequena = avisos({ ...BASE, alertas: ['FOTO_PEQUENA'] }, DEF_FOTO).find(
    (a) => a.clave === 'foto_pequena'
  )
  assert.equal(pequena.tipo, 'alerta')
  assert.equal(pequena.texto, `La fotografía es muy pequeña. ${CONSEJO}`)

  const horizontal = avisos({ ...BASE, alertas: ['FOTO_HORIZONTAL'] }, DEF_FOTO).find(
    (a) => a.clave === 'foto_horizontal'
  )
  assert.equal(horizontal.tipo, 'alerta')
  assert.equal(horizontal.texto, `La fotografía está en horizontal. ${CONSEJO}`)

  const pareceDoc = avisos({ ...BASE, alertas: ['FOTO_PARECE_DOCUMENTO'] }, DEF_FOTO).find(
    (a) => a.clave === 'foto_parece_documento'
  )
  assert.equal(pareceDoc.tipo, 'error')
  assert.equal(pareceDoc.texto, `Esto parece un documento, no una fotografía. ${CONSEJO}`)
})

test('el resultado de los antecedentes (solo del panel) nunca genera un aviso', () => {
  const lista = avisos({
    ...BASE,
    verificacion: { estado: 'LISTA', resultado: 'REVISAR', legible: true },
  })
  assert.equal(lista.length, 0)
})

test('los motivos para revisar antes de enviar cubren los escenarios nuevos', () => {
  assert.deepEqual(motivosParaRevisar({ alertas: ['ARCHIVO_REPETIDO'] }), [
    'el mismo archivo está cargado en otro documento',
  ])
  assert.deepEqual(motivosParaRevisar({ alertas: ['FOTO_PARECE_DOCUMENTO'] }), [
    'la fotografía parece ser un documento',
  ])
  assert.deepEqual(
    motivosParaRevisar({ verificacion: { identidad: 'NO_COINCIDE' } }),
    ['no aparecen el nombre ni el DPI de la persona']
  )
  assert.deepEqual(
    motivosParaRevisar({ verificacion: { colegiado: 'NO_COINCIDE' } }),
    ['el número de colegiado no coincide con el escrito en el paso 3']
  )
  // Los de siempre siguen: alertas rojas, fecha y tipo.
  assert.deepEqual(motivosParaRevisar({ alertas: ['EN_BLANCO', 'VENCIDO'] }), [
    'el archivo está en blanco',
    'ya está vencido',
  ])
  assert.deepEqual(motivosParaRevisar({ verificacion: { fecha: 'NO_COINCIDE', tipo: 'NO_COINCIDE' } }), [
    'la fecha escrita no coincide con la del documento',
    'no parece ser el documento correcto',
  ])
  assert.deepEqual(motivosParaRevisar({}), [])
})
