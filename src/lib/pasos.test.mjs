import test from 'node:test'
import assert from 'node:assert/strict'
import { datosParaInterfaz, faltantesDePaso } from './pasos.js'

const CONFIG_DOCS = {
  documentos: [
    { clave: 'foto', obligatorio: 'siempre', etiqueta_fecha: null },
    {
      clave: 'antecedentes_penales',
      obligatorio: 'siempre',
      etiqueta_fecha: 'Fecha de emisión',
      fecha_min: '2026-09-01',
    },
    { clave: 'colegiado_activo', obligatorio: 'colegiado', etiqueta_fecha: 'Activo hasta' },
    { clave: 'carta_recomendacion', obligatorio: 'nunca', etiqueta_fecha: 'Fecha de la carta' },
  ],
}

const doc = (clave, extra = {}) => ({
  clave,
  cargado: true,
  oculto: false,
  fecha_documento: '2026-09-15',
  ...extra,
})

test('paso 1 vacío: faltan los cinco obligatorios (el apellido de casada nunca)', () => {
  assert.deepEqual(faltantesDePaso(1, {}, { config: CONFIG_DOCS }), [
    'nombres',
    'apellidos',
    'fecha_nacimiento',
    'estado_civil',
    'nacionalidad',
  ])
})

test('paso 1 completo no tiene faltantes', () => {
  const datos = {
    nombres: 'MARIA',
    apellidos: 'PEREZ',
    fecha_nacimiento: '1990-01-31',
    estado_civil: 'SOLTERA',
    nacionalidad: 'GUATEMALTECA',
    apellido_casada: '',
  }
  assert.deepEqual(faltantesDePaso(1, datos, { config: CONFIG_DOCS }), [])
})

test('un campo guardado y oculto cuenta como presente', () => {
  const datos = {
    nombres: 'MARIA',
    apellidos: 'PEREZ',
    fecha_nacimiento: '1990-01-31',
    estado_civil: 'SOLTERA',
    nacionalidad: '',
  }
  const conOculto = faltantesDePaso(1, datos, { ocultos: ['nacionalidad'], config: CONFIG_DOCS })
  assert.deepEqual(conOculto, [])
})

test('paso 2 vacío faltan los cinco campos de contacto', () => {
  assert.deepEqual(faltantesDePaso(2, {}, { config: CONFIG_DOCS }), [
    'direccion',
    'departamento',
    'municipio',
    'telefono',
    'correo',
  ])
})

test('paso 3 sin colegiado: no exige colegio ni número', () => {
  const faltan = faltantesDePaso(3, { es_colegiado: false }, { config: CONFIG_DOCS })
  assert.ok(faltan.includes('es_colegiado') === false)
  assert.ok(!faltan.includes('colegio_profesional'))
  assert.ok(!faltan.includes('numero_colegiado'))
})

test('paso 3 colegiado: exige colegio y número, y la constancia solo se pide en el paso 4', () => {
  const faltan = faltantesDePaso(3, { es_colegiado: true }, { config: CONFIG_DOCS })
  assert.ok(faltan.includes('colegio_profesional'))
  assert.ok(faltan.includes('numero_colegiado'))
  assert.ok(!faltan.some((c) => c.startsWith('doc:')))
})

test('actividades: una sola no basta, dos sí', () => {
  const base = { profesion: 'MEDICO', es_colegiado: false, nit: '1234567-8', area_contratada: 'URGENCIAS', estudios: [{ nivel: 'UNIVERSITARIO', centro: 'USAC', titulo: 'MEDICO', inicio: '2010-01', fin: '2016-12' }] }
  assert.ok(faltantesDePaso(3, { ...base, actividades: ['Consultar pacientes'] }).includes('actividades'))
  assert.deepEqual(faltantesDePaso(3, { ...base, actividades: ['Consultar pacientes', 'Dirigir turno'] }), [])
})

test('paso 4: faltan los requeridos, no los opcionales ni el doc de colegiado sin declarar', () => {
  const faltan = faltantesDePaso(4, {}, { documentos: [], config: CONFIG_DOCS })
  assert.deepEqual(faltan, ['doc:foto', 'doc:antecedentes_penales'])
})

test('paso 4: con colegiado declarado también falta la constancia', () => {
  const faltan = faltantesDePaso(4, { es_colegiado: true }, { documentos: [doc('foto'), doc('antecedentes_penales')], config: CONFIG_DOCS })
  assert.deepEqual(faltan, ['doc:colegiado_activo'])
})

test('paso 4: cargado sin fecha (y con fecha pedida) sigue faltando; oculto sin fecha no', () => {
  const documentos = [doc('foto'), doc('antecedentes_penales', { fecha_documento: null })]
  assert.deepEqual(faltantesDePaso(4, {}, { documentos, config: CONFIG_DOCS }), ['doc:antecedentes_penales'])
  const oculto = [doc('foto'), doc('antecedentes_penales', { fecha_documento: null, oculto: true })]
  assert.deepEqual(faltantesDePaso(4, {}, { documentos: oculto, config: CONFIG_DOCS }), [])
})

test('paso 5 (envío) no tiene faltantes propios', () => {
  assert.deepEqual(faltantesDePaso(5, {}, { config: CONFIG_DOCS }), [])
})

test('datosParaInterfaz: la sección de nómina se propone como área contratada (editable) si no hay valor ni está oculta', () => {
  // Sin área contratada, sin ocultar y con sección: se propone la sección.
  assert.equal(datosParaInterfaz({}, { ocultos: [], seccion: 'SIPRESALUD' }).area_contratada, 'SIPRESALUD')
  // Un área ya escrita manda sobre la sección.
  assert.equal(
    datosParaInterfaz({ area_contratada: 'URGENCIAS' }, { ocultos: [], seccion: 'SIPRESALUD' })
      .area_contratada,
    'URGENCIAS'
  )
  // Si el área vino guardada-oculta, no se pisa con la sección.
  assert.equal(
    datosParaInterfaz({}, { ocultos: ['area_contratada'], seccion: 'SIPRESALUD' }).area_contratada,
    ''
  )
  // Sección ausente: sigue vacía, no null.
  assert.equal(datosParaInterfaz({}, { ocultos: [] }).area_contratada, '')
})
