// Pruebas del parser de alta masiva de nómina (src/panel/nomina.js).
// Corren con `node --test src/lib/`.
import test from 'node:test'
import assert from 'node:assert/strict'

import { MAX_PERSONAS, parsearNomina } from '../panel/nomina.js'

// CUI válidos (verificador por módulo 11, CONTRATO §3): el vector del
// contrato y 2468135710101 (2·2+4·3+6·4+8·5+1·6+3·7+5·8+7·9 = 210, 210 % 11 = 1).
const CUI_A = '1234567890101'
const CUI_B = '2468135710101'

test('nomina: línea con tabulaciones (pegado de Excel) es válida', () => {
  const r = parsearNomina(`${CUI_A}\tJUAN PÉREZ\t55551234`)
  assert.equal(r.invalidas, 0)
  assert.equal(r.validas.length, 1)
  assert.deepEqual(r.lineas[0], {
    numero: 1,
    cruda: `${CUI_A}\tJUAN PÉREZ\t55551234`,
    cui: CUI_A,
    nombre: 'JUAN PÉREZ',
    seccion: '',
    renglon: '',
    tipoServicio: '',
    telefono: '55551234',
    errores: [],
  })
})

test('nomina: la línea de 3 columnas con 8 dígitos al final es el formato viejo (teléfono)', () => {
  const r = parsearNomina(`${CUI_A}\tJUAN PÉREZ\t55551234`)
  // La tercera columna son 8 dígitos: teléfono, no sección.
  assert.equal(r.validas[0].telefono, '55551234')
  assert.equal(r.validas[0].seccion, '')
})

test('nomina: las 6 columnas completas se interpretan en orden', () => {
  const r = parsearNomina(
    `${CUI_A}\tJUAN PÉREZ\tSIPRESALUD\t182 - Servicios Médico-Sanitarios\tENFERMERÍA\t55551234`
  )
  assert.equal(r.invalidas, 0)
  const linea = r.validas[0]
  assert.equal(linea.cui, CUI_A)
  assert.equal(linea.nombre, 'JUAN PÉREZ')
  assert.equal(linea.seccion, 'SIPRESALUD')
  assert.equal(linea.renglon, '182 - Servicios Médico-Sanitarios')
  assert.equal(linea.tipoServicio, 'ENFERMERÍA')
  assert.equal(linea.telefono, '55551234')
})

test('nomina: 4 y 5 columnas dejan sin teléfono y sin tipo lo que no viene', () => {
  const cuatro = parsearNomina(`${CUI_A}\tJUAN PÉREZ\tSIPRESALUD\t189 - Otros Estudios y/o Servicios`)
  assert.equal(cuatro.invalidas, 0)
  assert.equal(cuatro.validas[0].seccion, 'SIPRESALUD')
  assert.equal(cuatro.validas[0].renglon, '189 - Otros Estudios y/o Servicios')
  assert.equal(cuatro.validas[0].tipoServicio, '')
  assert.equal(cuatro.validas[0].telefono, '')
  const cinco = parsearNomina(`${CUI_B};MARÍA LÓPEZ;NUTRICIÓN;189 - Otros Estudios y/o Servicios;NUTRICIONISTA`)
  assert.equal(cinco.invalidas, 0)
  assert.equal(cinco.validas[0].tipoServicio, 'NUTRICIONISTA')
  assert.equal(cinco.validas[0].telefono, '')
})

test('nomina: la tercera columna que no son 8 dígitos es la sección', () => {
  const r = parsearNomina(`${CUI_A}\tJUAN PÉREZ\tSIPRESALUD`)
  assert.equal(r.invalidas, 0)
  assert.equal(r.validas[0].seccion, 'SIPRESALUD')
  assert.equal(r.validas[0].telefono, '')
})

test('nomina: el punto y coma separa columnas', () => {
  const r = parsearNomina(`${CUI_B}; MARÍA LÓPEZ`)
  assert.equal(r.invalidas, 0)
  assert.equal(r.validas[0].cui, CUI_B)
  assert.equal(r.validas[0].telefono, '')
})

test('nomina: la coma ya NO separa columnas', () => {
  // Los renglones traen «y/o» y los nombres pueden traer comas: una línea
  // separada por comas es UNA sola columna y queda marcada.
  const r = parsearNomina(`${CUI_B}, MARÍA LÓPEZ`)
  assert.equal(r.validas.length, 0)
  assert.match(r.lineas[0].errores[0], /entre 2 y 6 columnas/)
})

test('nomina: ignora líneas vacías y espacios en blanco', () => {
  const r = parsearNomina(`\n   \n${CUI_A}\tJUAN PÉREZ\n\n\t \n`)
  assert.equal(r.lineas.length, 1)
  assert.equal(r.validas.length, 1)
})

test('nomina: CUI con verificador incorrecto queda inválido', () => {
  const r = parsearNomina(`1234567800101\tJUAN PÉREZ`)
  assert.equal(r.validas.length, 0)
  assert.equal(r.invalidas, 1)
  assert.match(r.lineas[0].errores[0], /cui/i)
})

test('nomina: CUI repetido dentro de la lista pegada queda inválido', () => {
  const r = parsearNomina(`${CUI_A}\tJUAN PÉREZ\n${CUI_A} \tOTRA PERSONA`)
  assert.equal(r.validas.length, 1)
  assert.equal(r.invalidas, 1)
  assert.match(r.lineas[1].errores.join(' '), /repetido/i)
})

test('nomina: CUI que ya existe en la nómina queda inválido', () => {
  const r = parsearNomina(`${CUI_A}\tJUAN PÉREZ`, [CUI_A])
  assert.equal(r.validas.length, 0)
  assert.match(r.lineas[0].errores.join(' '), /ya está en la nómina/i)
})

test('nomina: marca líneas con más de seis columnas', () => {
  const r = parsearNomina(`${CUI_A}\tJUAN\tSIPRESALUD\t189 - Otros\tENFERMERÍA\t55551234\tEXTRA`)
  assert.equal(r.validas.length, 0)
  assert.match(r.lineas[0].errores[0], /entre 2 y 6 columnas/)
})

test('nomina: marca la línea con solo el CUI (falta el nombre)', () => {
  const r = parsearNomina(`${CUI_A}`)
  assert.equal(r.validas.length, 0)
  assert.match(r.lineas[0].errores.join(' '), /entre 2 y 6 columnas/)
})

test('nomina: teléfono inválido queda marcado (formato viejo y completo)', () => {
  const viejo = parsearNomina(`${CUI_A}\tJUAN PÉREZ\t91234567`)
  assert.equal(viejo.validas.length, 0)
  assert.match(viejo.lineas[0].errores.join(' '), /teléfono/i)
  const completo = parsearNomina(`${CUI_A}\tJUAN PÉREZ\tSIPRESALUD\t189 - Otros\tENFERMERÍA\t91234567`)
  assert.equal(completo.validas.length, 0)
  assert.match(completo.lineas[0].errores.join(' '), /teléfono/i)
})

test('nomina: teléfono vacío al final (tab sobrante) no cuenta como columna', () => {
  const r = parsearNomina(`${CUI_A}\tJUAN PÉREZ\t`)
  assert.equal(r.validas.length, 1)
  assert.equal(r.validas[0].telefono, '')
})

test('nomina: nombre inválido (números) queda marcado', () => {
  const r = parsearNomina(`${CUI_A}\tJUAN PÉREZ 123`)
  assert.equal(r.validas.length, 0)
  assert.match(r.lineas[0].errores.join(' '), /nombre/i)
})

test('nomina: el nombre se envía tal como se escribió (el servidor lo normaliza)', () => {
  const r = parsearNomina(`${CUI_A}\t juan    pérez `)
  assert.equal(r.validas.length, 1)
  // Solo se recorta el espacio de relleno de la columna; mayúsculas y espacios
  // intermedios los normaliza el servidor (adenda §7).
  assert.equal(r.validas[0].nombre, 'juan    pérez')
})

test('nomina: CUI con espacios o guiones se limpia antes de validar', () => {
  const r = parsearNomina(`1234 56789 0101\tJUAN PÉREZ`)
  assert.equal(r.validas.length, 1)
  assert.equal(r.validas[0].cui, CUI_A)
})

test('nomina: varias líneas mezclan válidas e inválidas con su número de línea', () => {
  const r = parsearNomina(
    `${CUI_A}\tJUAN PÉREZ\nnope\n${CUI_B}\tMARÍA LÓPEZ\t22334455`
  )
  assert.equal(r.lineas.length, 3)
  assert.equal(r.validas.length, 2)
  assert.equal(r.lineas[1].numero, 2)
  assert.deepEqual(r.lineas.map((l) => l.numero), [1, 2, 3])
})

test('nomina: expone el máximo de personas del CONTRATO', () => {
  assert.equal(MAX_PERSONAS, 300)
})
