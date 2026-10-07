// Pruebas con `node --test src/lib/`.
// Incluye los vectores de prueba calculados a mano en el CONTRATO (§3).
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ESTADOS_CIVILES,
  NIVELES_ESTUDIO,
  calcularEdad,
  clavePlana,
  compararMeses,
  esFechaReal,
  estudioVacio,
  estudioVacioRevision,
  fechaEnPalabras,
  fechaISO,
  formatoClave,
  formatoCUI,
  formatoNIT,
  formatoTelefono,
  mesActual,
  mesEnPalabras,
  normalizarCorreo,
  normalizarTexto,
  nitPlano,
  soloDigitos,
  textoMayusculas,
  validarActividad,
  validarActividades,
  validarCorreo,
  validarCUI,
  validarEstudio,
  validarEstudios,
  validarFechaNacimiento,
  validarLongitud,
  validarNombreAcceso,
  nombreParaEnviar,
  validarNacionalidad,
  validarNombrePersona,
  validarNIT,
  validarTelefono,
} from './validaciones.js'

// Fecha fija para que las pruebas de fechas sean deterministas.
const HOY = new Date(2026, 9, 6) // 6 de octubre de 2026

// ---------------------------------------------------------------------------
// CUI
// ---------------------------------------------------------------------------

test('CUI: vector del CONTRATO 1234567890101 es válido', () => {
  // suma = 1·2+2·3+…+8·9 = 240; 240 mod 11 = 9 = dígito verificador.
  assert.deepEqual(validarCUI('1234567890101'), { valido: true })
})

test('CUI: rechaza verificador incorrecto, longitud, departamento y municipio', () => {
  assert.equal(validarCUI('1234567800101').valido, false) // dígito verificador 0 ≠ 9
  assert.equal(validarCUI('12345678901').valido, false) // 11 dígitos
  assert.equal(validarCUI('12345678901011').valido, false) // 14 dígitos
  assert.equal(validarCUI('').valido, false) // vacío
  assert.equal(validarCUI('abcdefghijk').valido, false) // no dígitos (quedan 0)
  assert.equal(validarCUI('1234567892301').valido, false) // departamento 23 no existe
  assert.equal(validarCUI('1234567890136').valido, false) // municipio 36 no existe
  assert.equal(validarCUI('5000000000101').valido, false) // residuo 10 → inválido
})

test('CUI: formato de máscara 0000 00000 0000', () => {
  assert.equal(formatoCUI('1234567890101'), '1234 56789 0101')
  assert.equal(formatoCUI('12345678'), '1234 5678')
  assert.equal(formatoCUI('123'), '123')
})

// ---------------------------------------------------------------------------
// NIT
// ---------------------------------------------------------------------------

test('NIT: vectores del CONTRATO 12345679 válido y 12345678 inválido', () => {
  // cuerpo 1234567 → suma 112, 112 mod 11 = 2, v = 9.
  assert.deepEqual(validarNIT('1234567-9'), { valido: true })
  assert.equal(validarNIT('1234567-8').valido, false)
})

test('NIT: verificador K cuando v = 10', () => {
  assert.deepEqual(validarNIT('0000006K'), { valido: true })
  assert.equal(validarNIT('00000060').valido, false)
})

test('NIT: igual al CUI de la persona es válido (SAT usa CUI como NIT)', () => {
  assert.deepEqual(validarNIT('1234567890101', '1234567890101'), { valido: true })
})

test('NIT: rechaza longitudes y caracteres inválidos', () => {
  assert.equal(validarNIT('12').valido, false) // le falta el verificador
  assert.equal(validarNIT('12345678901234').valido, false) // 14 caracteres
  assert.equal(validarNIT('12345X78').valido, false) // letra en medio del cuerpo
  assert.equal(validarNIT('1234567A').valido, false) // verificador que no es dígito ni K
  assert.equal(validarNIT('').valido, false)
})

test('NIT: formato y limpieza aceptan con o sin guion', () => {
  assert.equal(formatoNIT('1234567-9'), '1234567-9')
  assert.equal(formatoNIT('12345679'), '1234567-9')
  assert.equal(formatoNIT('1234567-9k'), '12345679-K') // la K escrita al final pasa a ser el verificador
  assert.equal(nitPlano('1234567-9'), '12345679')
})

// ---------------------------------------------------------------------------
// Teléfono
// ---------------------------------------------------------------------------

test('teléfono: acepta 8 dígitos iniciando entre 2 y 7', () => {
  assert.deepEqual(validarTelefono('2345-6789'), { valido: true })
  assert.deepEqual(validarTelefono('77777777'), { valido: true })
})

test('teléfono: rechaza longitudes y prefijos inválidos', () => {
  assert.equal(validarTelefono('2345678').valido, false) // 7 dígitos
  assert.equal(validarTelefono('234567890').valido, false) // 9 dígitos
  assert.equal(validarTelefono('83456789').valido, false) // inicia en 8
  assert.equal(validarTelefono('12345678').valido, false) // inicia en 1
  assert.equal(validarTelefono('abcdefg').valido, false)
  assert.equal(validarTelefono('').valido, false)
})

test('teléfono: máscara 0000-0000', () => {
  assert.equal(formatoTelefono('23456789'), '2345-6789')
  assert.equal(formatoTelefono('2345'), '2345')
})

// ---------------------------------------------------------------------------
// Correo
// ---------------------------------------------------------------------------

test('correo: acepta correos válidos y se normaliza a minúsculas', () => {
  assert.equal(validarCorreo('Juan.Perez@Gmail.com').valido, true)
  assert.equal(normalizarCorreo(' Juan@GMAIL.com '), 'juan@gmail.com')
})

test('correo: rechaza formatos inválidos y longitud excesiva', () => {
  assert.equal(validarCorreo('juangmail.com').valido, false) // sin @
  assert.equal(validarCorreo('juan@').valido, false) // sin dominio
  assert.equal(validarCorreo('juan @gmail.com').valido, false) // espacio
  assert.equal(validarCorreo('juan@gmail').valido, false) // sin punto final
  assert.equal(validarCorreo('a'.repeat(111) + '@gmail.com').valido, false) // > 120
  assert.equal(validarCorreo('').valido, false)
})

test('correo: avisa (sin bloquear) dominios mal escritos', () => {
  assert.equal(validarCorreo('juan@gmial.com').aviso !== undefined, true)
  assert.equal(validarCorreo('juan@hotmail.con').aviso !== undefined, true)
  assert.equal(validarCorreo('juan@gmail.com').aviso, undefined)
})

// ---------------------------------------------------------------------------
// Nombres y textos
// ---------------------------------------------------------------------------

test('nombre de persona: acepta tildes, ñ, ü, apóstrofo y guion', () => {
  assert.equal(validarNombrePersona("MARÍA JOSÉ ÑON").valido, true)
  assert.equal(validarNombrePersona("D'LEÓN").valido, true)
  assert.equal(validarNombrePersona('ANA CRUZ-PEREZ').valido, true)
})

test('nombre de persona: rechaza cortos, largos y caracteres prohibidos', () => {
  assert.equal(validarNombrePersona('A').valido, false) // 1 carácter
  assert.equal(validarNombrePersona('A'.repeat(61)).valido, false) // > 60
  assert.equal(validarNombrePersona('JUAN123').valido, false) // dígitos
  assert.equal(validarNombrePersona('JUAN@PEREZ').valido, false) // símbolos
  assert.equal(validarNombrePersona('').valido, false)
})

test('normalizarTexto: recorta, colapsa espacios y elimina <> y control', () => {
  assert.equal(normalizarTexto('  CALLE   5-20  '), 'CALLE 5-20')
  assert.equal(normalizarTexto('A<B>C'), 'A B C')
  assert.equal(normalizarTexto('uno\u0000dos'), 'uno dos')
  assert.equal(textoMayusculas(' josé '), 'JOSÉ')
  assert.equal(soloDigitos('2345-6789'), '23456789')
})

test('validarLongitud y nacionalidad', () => {
  assert.equal(validarLongitud('CALLE 5', 10, 200).valido, false) // muy corto
  assert.equal(validarLongitud('X'.repeat(201), 10, 200).valido, false) // muy largo
  assert.equal(validarLongitud('', 10, 200).valido, true) // vacío válido en borrador
  assert.equal(validarLongitud('CALLE 5 ZONA 1', 10, 200).valido, true)
  assert.equal(validarNacionalidad('AB').valido, false)
  assert.equal(validarNacionalidad('GUATEMALTECA123').valido, false)
  assert.equal(validarNacionalidad('GUATEMALTECA').valido, true)
})

// ---------------------------------------------------------------------------
// Fechas
// ---------------------------------------------------------------------------

test('esFechaReal detecta fechas inexistentes', () => {
  assert.equal(esFechaReal('2026-02-30'), false)
  assert.equal(esFechaReal('2026-13-01'), false)
  assert.equal(esFechaReal('2024-02-29'), true)
  assert.equal(esFechaReal('2023-02-29'), false)
  assert.equal(esFechaReal('fecha'), false)
})

test('calcularEdad con fecha fija', () => {
  assert.equal(calcularEdad('1990-06-15', HOY), 36)
  assert.equal(calcularEdad('1990-10-07', HOY), 35) // aún no cumple años
  assert.equal(calcularEdad('2008-10-06', HOY), 18) // cumple hoy
  assert.equal(calcularEdad('no-valida', HOY), null)
})

test('validarFechaNacimiento: entre 18 y 85 años, sin fechas futuras', () => {
  assert.equal(validarFechaNacimiento('1990-06-15', HOY).valido, true)
  assert.equal(validarFechaNacimiento('2008-10-07', HOY).valido, false) // 17 años
  assert.equal(validarFechaNacimiento('1940-10-06', HOY).valido, false) // cumple 86 hoy
  assert.equal(validarFechaNacimiento('1940-10-08', HOY).valido, true) // 85 años, aún vigente
  assert.equal(validarFechaNacimiento('2027-01-01', HOY).valido, false) // futura
  assert.equal(validarFechaNacimiento('2026-02-30', HOY).valido, false) // no existe
  assert.equal(validarFechaNacimiento('', HOY).valido, false)
})

test('fechas y meses en palabras', () => {
  assert.equal(fechaEnPalabras('2026-09-01'), '1 de septiembre de 2026')
  assert.equal(mesEnPalabras('2026-10'), 'octubre de 2026')
  assert.equal(fechaISO(HOY), '2026-10-06')
  assert.equal(mesActual(HOY), '2026-10')
  assert.equal(compararMeses('2026-09', '2026-10'), -1)
  assert.equal(compararMeses('2026-10', '2026-10'), 0)
  assert.equal(compararMeses('2027-01', '2026-10'), 1)
  assert.equal(compararMeses('2026-1', '2026-10'), null)
})

// ---------------------------------------------------------------------------
// Estudios
// ---------------------------------------------------------------------------

const OPCIONES_ESTUDIO = { fechaNacimiento: '1990-06-15', hoy: HOY }

test('estudio válido', () => {
  const e = {
    nivel: 'LICENCIATURA',
    centro: 'UNIVERSIDAD DE SAN CARLOS',
    titulo: 'MÉDICO Y CIRUJANO',
    inicio: '2009-01',
    fin: '2015-12',
  }
  assert.deepEqual(validarEstudio(e, OPCIONES_ESTUDIO), { valido: true, errores: {} })
})

test('estudio: rechaza nivel, longitudes, orden y límites temporales', () => {
  const base = {
    nivel: 'LICENCIATURA', centro: 'CENTRO VALIDO', titulo: 'TITULO VALIDO',
    inicio: '2009-01', fin: '2015-12',
  }
  assert.equal(validarEstudio({ ...base, nivel: 'PREPARATORIA' }, OPCIONES_ESTUDIO).valido, false) // nivel fuera de catálogo
  assert.equal(validarEstudio({ ...base, centro: 'US' }, OPCIONES_ESTUDIO).valido, false) // < 3
  assert.equal(validarEstudio({ ...base, titulo: 'X'.repeat(121) }, OPCIONES_ESTUDIO).valido, false) // > 120
  assert.equal(validarEstudio({ ...base, fin: '2008-12' }, OPCIONES_ESTUDIO).valido, false) // fin < inicio
  assert.equal(validarEstudio({ ...base, fin: '2026-11' }, OPCIONES_ESTUDIO).valido, false) // fin > mes actual
  assert.equal(validarEstudio({ ...base, inicio: '1998-01' }, OPCIONES_ESTUDIO).valido, false) // inicio ≤ nacimiento + 10
  assert.equal(validarEstudio({ ...base, inicio: '', fin: '' }, OPCIONES_ESTUDIO).valido, false)
})

test('estudios: bloque vacío y listas', () => {
  assert.equal(estudioVacioRevision(estudioVacio()), true)
  assert.equal(estudioVacioRevision({ nivel: 'LICENCIATURA' }), false)
  const validos = [estudioVacio(), {
    nivel: 'DIVERSIFICADO', centro: 'INSTITUTO VALIDO', titulo: 'BACHILLER',
    inicio: '2006-01', fin: '2007-10',
  }]
  assert.equal(validarEstudios(validos, OPCIONES_ESTUDIO).valido, true) // el bloque vacío no se valida
})

// ---------------------------------------------------------------------------
// Actividades
// ---------------------------------------------------------------------------

test('actividades: longitudes 15 a 300', () => {
  assert.equal(validarActividad('Consulta externa matutina').valido, true)
  assert.equal(validarActividad('Corta').valido, false) // < 15
  assert.equal(validarActividad('X'.repeat(301)).valido, false) // > 300
  assert.equal(validarActividad('').valido, true) // vacía no bloquea en borrador
})

test('actividades: al enviar exige las dos obligatorias', () => {
  const una = ['Consulta externa matutina en el puesto de salud']
  assert.equal(validarActividades(una, { completas: true }).valido, false)
  const dos = [...una, 'Vigilancia epidemiológica semanal del área asignada']
  assert.equal(validarActividades(dos, { completas: true }).valido, true)
  assert.equal(validarActividades([...dos, 'X'.repeat(301)]).valido, false)
})

// ---------------------------------------------------------------------------
// Clave de acceso
// ---------------------------------------------------------------------------

test('clave: máscara XXXXX-XXXXX y limpieza', () => {
  assert.equal(formatoClave('abcde12345'), 'ABCDE-12345')
  assert.equal(formatoClave('ABCDE'), 'ABCDE')
  assert.equal(formatoClave('ABCDE-1234'), 'ABCDE-1234')
  assert.equal(clavePlana('abcde-12345'), 'ABCDE12345')
})

// ---------------------------------------------------------------------------
// Catálogos del contrato
// ---------------------------------------------------------------------------

test('catálogos: 5 estados civiles y 5 niveles de estudio', () => {
  assert.equal(ESTADOS_CIVILES.length, 5)
  assert.ok(ESTADOS_CIVILES.includes('UNIDO(A) DE HECHO'))
  assert.equal(NIVELES_ESTUDIO.length, 5)
  assert.ok(NIVELES_ESTUDIO.includes('TÉCNICO UNIVERSITARIO'))
})

test('nombre de acceso: al menos dos palabras de 3 o más letras; no se altera mayúsculas ni tildes', () => {
  assert.equal(validarNombreAcceso('Ana María López').valido, true)
  assert.equal(validarNombreAcceso('  JOSÉ   PÉREZ ').valido, true)
  assert.equal(validarNombreAcceso('Ana de la Cruz').valido, true) // «Ana» y «Cruz»
  assert.equal(validarNombreAcceso('Ana').valido, false)
  assert.equal(validarNombreAcceso('Li Xu').valido, false)
  assert.equal(validarNombreAcceso('').valido, false)
  assert.equal(validarNombreAcceso(null).valido, false)
  assert.equal(nombreParaEnviar('  ana   maría  López '), 'ana maría López')
})
