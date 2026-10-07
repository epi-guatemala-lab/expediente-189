// Vista optimista, diferencia de datos y lo que falta para enviar (con datos ocultos).
import test from 'node:test'
import assert from 'node:assert/strict'

import { aplicarPendientes, calcularFaltantes, diffDatos, documentoVacio, esNoEditable } from './optimista.js'
import { CONFIG, CUI } from './ayudas-prueba.mjs'
import {
  completarGrupos,
  datosParaInterfaz,
  ocultoSinEditar,
  payloadPaso,
  validarPaso,
} from '../lib/pasos.js'

const HOY = new Date('2026-10-06T12:00:00')

const COMPLETOS = {
  nombres: 'ANA MARIA',
  apellidos: 'LOPEZ PEREZ',
  fecha_nacimiento: '1990-05-10',
  estado_civil: 'SOLTERO(A)',
  direccion: '5a avenida 10-20 zona 1, colonia centro',
  departamento: 'GUATEMALA',
  municipio: 'MIXCO',
  telefono: '22223333',
  correo: 'ana@correo.com',
  nacionalidad: 'GUATEMALTECA',
  profesion: 'MEDICA',
  es_colegiado: false,
  nit: CUI,
  area_contratada: 'Medicina Preventiva',
  estudios: [{ nivel: 'LICENCIATURA', centro: 'USAC', titulo: 'MEDICO Y CIRUJANO', inicio: '2008-01', fin: '2014-12' }],
  actividades: ['Vigilancia epidemiológica de rutina', 'Apoyo en brotes y reportes semanales'],
}
const DOCS_COMPLETOS = [
  { ...documentoVacio('foto'), cargado: true },
  { ...documentoVacio('rtu'), cargado: true, fecha_documento: '2026-10-02' },
  documentoVacio('colegiado_activo'),
]
const faltantes = (datos, docs, extra = {}) =>
  calcularFaltantes(datos, docs, CONFIG, { cui: CUI, hoy: HOY, ...extra })

test('calcularFaltantes: con todo completo no falta nada', () => {
  assert.deepEqual(faltantes(COMPLETOS, DOCS_COMPLETOS), [])
})

test('calcularFaltantes: lista campos y documentos que faltan, con la llave doc:<clave>', () => {
  const lista = faltantes({ ...COMPLETOS, telefono: '', actividades: ['una sola actividad de más de quince'] }, [documentoVacio('foto')])
  assert.deepEqual(lista, ['telefono', 'actividades', 'doc:foto', 'doc:rtu'])
})

test('un campo guardado pero OCULTO cuenta como completo', () => {
  const sinTelefono = { ...COMPLETOS }
  delete sinTelefono.telefono
  delete sinTelefono.estudios
  assert.deepEqual(faltantes(sinTelefono, DOCS_COMPLETOS), ['telefono', 'estudios'])
  assert.deepEqual(faltantes(sinTelefono, DOCS_COMPLETOS, { ocultos: ['telefono', 'estudios'] }), [])
})

test('un documento oculto (sin fecha visible) cuenta como completo si está cargado', () => {
  const docs = [
    { ...documentoVacio('foto'), cargado: true, oculto: true },
    { ...documentoVacio('rtu'), cargado: true, oculto: true, fecha_documento: null },
    documentoVacio('colegiado_activo'),
  ]
  assert.deepEqual(faltantes(COMPLETOS, docs), [])
  const sinOculto = docs.map((d) => ({ ...d, oculto: false }))
  assert.deepEqual(faltantes(COMPLETOS, sinOculto), ['doc:rtu'])
})

test('colegiado con colegio y número ocultos: completo; la constancia sí se exige', () => {
  const datos = { ...COMPLETOS, es_colegiado: true }
  assert.deepEqual(faltantes(datos, DOCS_COMPLETOS, { ocultos: ['colegio_profesional', 'numero_colegiado'] }), ['doc:colegiado_activo'])
})

test('diffDatos: solo lo que cambió (nulo y vacío son lo mismo; el orden de claves no importa)', () => {
  const base = { nombres: 'ANA', telefono: '22223333', estudios: [{ nivel: 'A', centro: 'B' }] }
  assert.deepEqual(diffDatos(base, { nombres: 'ANA', telefono: '22224444', apellido_casada: null, correo: '' }), { telefono: '22224444' })
  assert.deepEqual(diffDatos(base, { estudios: [{ centro: 'B', nivel: 'A' }] }), {})
  assert.deepEqual(diffDatos(base, { nombres: null }), { nombres: null })
  assert.deepEqual(diffDatos({ numero_colegiado: 123 }, { numero_colegiado: '123' }), {})
})

const BASE = {
  id: 1,
  estado: 'BORRADOR',
  version: 3,
  cui: CUI,
  datos: { es_colegiado: false },
  campos_guardados: ['es_colegiado', 'telefono'],
  campos_ocultos: ['telefono'],
  documentos: [documentoVacio('foto'), { ...documentoVacio('rtu'), cargado: true, oculto: true, fecha_documento: null }],
  faltantes: ['x'],
}
const gu = (datos, extra = {}, sid = 'S') => ({ id: 1, tipo: 'GUARDAR', clave: null, estado: 'pendiente', cuerpo: { sid, datos }, ...extra })

test('aplicarPendientes: los datos escritos en esta sesión dejan de estar ocultos', () => {
  const vista = aplicarPendientes(BASE, [gu({ telefono: '22223333', nombres: 'ANA' })], CONFIG, { sid: 'S', hoy: HOY })
  assert.equal(vista.datos.telefono, '22223333')
  assert.deepEqual(vista.campos_ocultos, [])
  assert.ok(vista.campos_guardados.includes('nombres'))
  assert.equal(BASE.datos.telefono, undefined, 'la base no se muta')
})

test('aplicarPendientes: lo de una sesión anterior NO se muestra', () => {
  const vista = aplicarPendientes(BASE, [gu({ nombres: 'SECRETO' }, {}, 'VIEJA')], CONFIG, { sid: 'S', hoy: HOY })
  assert.equal(vista.datos.nombres, undefined)
  assert.deepEqual(vista.campos_ocultos, ['telefono'])
  assert.deepEqual(vista.faltantes, ['x'], 'sin cambios de esta sesión se conservan los faltantes del servidor')
})

test('aplicarPendientes: subida, fecha, quitar y envío', () => {
  const subir = { id: 2, tipo: 'SUBIR', clave: 'foto', estado: 'pendiente', cuerpo: { sid: 'S', tipo: 'jpg', tamano: 99, nombre: 'f.jpg', fecha: null } }
  const quitarRtu = { id: 3, tipo: 'QUITAR', clave: 'rtu', estado: 'pendiente', cuerpo: { sid: 'S' } }
  const enviar = { id: 4, tipo: 'ENVIAR', clave: null, estado: 'pendiente', cuerpo: { sid: 'S' } }
  const vista = aplicarPendientes(BASE, [subir, quitarRtu, enviar], CONFIG, { sid: 'S', hoy: HOY })
  const foto = vista.documentos.find((d) => d.clave === 'foto')
  assert.deepEqual([foto.cargado, foto.pendiente, foto.oculto, foto.tipo], [true, true, false, 'jpg'])
  assert.equal(vista.documentos.find((d) => d.clave === 'rtu').cargado, false)
  assert.equal(vista.envioPendiente, true)
})

test('aplicarPendientes: una subida fallida no cuenta como hecha y marca el documento', () => {
  const subir = { id: 2, tipo: 'SUBIR', clave: 'foto', estado: 'fallida', cuerpo: { sid: 'S', tipo: 'jpg', fallo: { mensaje: 'Archivo demasiado grande' } } }
  const vista = aplicarPendientes(BASE, [subir], CONFIG, { sid: 'S', hoy: HOY })
  const foto = vista.documentos.find((d) => d.clave === 'foto')
  assert.equal(foto.cargado, false)
  assert.equal(foto.fallo.mensaje, 'Archivo demasiado grande')
  const enviarFallido = { id: 3, tipo: 'ENVIAR', estado: 'fallida', cuerpo: { sid: 'S' } }
  assert.equal(aplicarPendientes(BASE, [enviarFallido], CONFIG, { sid: 'S' }).envioPendiente, false)
})

test('esNoEditable: enviado, aprobado o editable=false', () => {
  assert.equal(esNoEditable({ estado: 'ENVIADO' }), true)
  assert.equal(esNoEditable({ estado: 'BORRADOR', editable: false }), true)
  assert.equal(esNoEditable({ estado: 'OBSERVADO', editable: true }), false)
})

// --- Formulario: campos ocultos ------------------------------------------------

test('datosParaInterfaz: un campo oculto se muestra vacío y no recibe valores por defecto', () => {
  const ui = datosParaInterfaz({ es_colegiado: false }, { ocultos: ['nacionalidad', 'telefono'] })
  assert.equal(ui.nacionalidad, '')
  assert.equal(ui.telefono, '')
  assert.equal(datosParaInterfaz({}, { ocultos: [] }).nacionalidad, 'GUATEMALTECA')
})

test('payloadPaso: un campo oculto sin editar NO se envía (enviarlo vacío lo borraría)', () => {
  const ocultos = ['direccion', 'departamento', 'municipio', 'telefono']
  const ui = { ...datosParaInterfaz({ correo: 'a@b.co' }, { ocultos }) }
  const payload = payloadPaso(2, ui, { ocultos })
  assert.deepEqual(Object.keys(payload), ['correo'])
  // Si la persona escribe en uno oculto, ese sí viaja.
  assert.deepEqual(Object.keys(payloadPaso(2, { ...ui, telefono: '2222-3333' }, { ocultos })).sort(), ['correo', 'telefono'])
  // Lo escrito en esta sesión y luego vaciado SÍ se envía como null (es un borrado explícito).
  assert.equal(payloadPaso(2, { ...ui, correo: '' }, { ocultos }).correo, null)
})

test('validarPaso: oculto sin editar cuenta como completo; tocar un grupo exige llenarlo entero', () => {
  const ocultos = ['departamento', 'municipio', 'telefono']
  const ui = datosParaInterfaz({}, { ocultos })
  assert.deepEqual(validarPaso(2, ui, { ocultos }), {})
  const soloDepartamento = validarPaso(2, { ...ui, departamento: 'PETÉN' }, { ocultos })
  assert.deepEqual(Object.keys(soloDepartamento), ['municipio'])
  assert.deepEqual(validarPaso(2, { ...ui, departamento: 'GUATEMALA', municipio: 'MIXCO' }, { ocultos }), {})
})

test('validarPaso 3: colegio y número se escriben juntos', () => {
  const ocultos = ['colegio_profesional', 'numero_colegiado']
  const ui = { ...datosParaInterfaz({ es_colegiado: true }, { ocultos }) }
  assert.deepEqual(validarPaso(3, ui, { ocultos }), {})
  const soloColegio = validarPaso(3, { ...ui, colegio_profesional: 'COLEGIO DE MEDICOS' }, { ocultos })
  assert.deepEqual(Object.keys(soloColegio), ['numero_colegiado'])
})

test('ocultoSinEditar y completarGrupos', () => {
  assert.equal(ocultoSinEditar('telefono', { telefono: '' }, ['telefono']), true)
  assert.equal(ocultoSinEditar('telefono', { telefono: '2222' }, ['telefono']), false)
  assert.equal(ocultoSinEditar('estudios', { estudios: [{ nivel: '', centro: '', titulo: '', inicio: '', fin: '' }] }, ['estudios']), true)
  const payload = { departamento: 'PETÉN', municipio: 'FLORES', correo: 'a@b.co' }
  assert.deepEqual(completarGrupos({ municipio: 'FLORES' }, payload), { municipio: 'FLORES', departamento: 'PETÉN' })
  assert.deepEqual(completarGrupos({ correo: 'a@b.co' }, payload), { correo: 'a@b.co' })
})
