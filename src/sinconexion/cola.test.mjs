// Pruebas de la lógica pura de la cola: fusión, orden y bloqueos.
import test from 'node:test'
import assert from 'node:assert/strict'

import { TIPOS, planEncolar, siguienteOperacion, bytesEnCola, TOPE_BYTES } from './cola.js'

const op = (id, tipo, extra = {}) => ({
  id,
  tipo,
  clave: null,
  estado: 'pendiente',
  intentos: 0,
  bytes: 0,
  cuerpo: { sid: 'S' },
  ...extra,
})
const guardar = (datos, sid = 'S') => ({ tipo: 'GUARDAR', cuerpo: { datos, sid } })

test('dos GUARDAR seguidos que no han salido se funden en uno (gana el último valor)', () => {
  const cola = [op(1, 'GUARDAR', { cuerpo: { sid: 'S', datos: { nombres: 'ANA', apellidos: 'LOPEZ' } } })]
  const plan = planEncolar(cola, guardar({ apellidos: 'PEREZ', telefono: '22223333' }))
  assert.equal(plan.fusionado, true)
  assert.equal(plan.agregar, null)
  assert.deepEqual(plan.actualizar, [
    { id: 1, cuerpo: { sid: 'S', datos: { nombres: 'ANA', apellidos: 'PEREZ', telefono: '22223333' } } },
  ])
})

test('un GUARDAR que ya se está enviando NO se funde: el nuevo va aparte', () => {
  const cola = [op(1, 'GUARDAR', { cuerpo: { sid: 'S', datos: { nombres: 'ANA' } } })]
  const plan = planEncolar(cola, guardar({ apellidos: 'PEREZ' }), { enVuelo: new Set([1]) })
  assert.equal(plan.fusionado, false)
  assert.equal(plan.agregar.tipo, 'GUARDAR')
  assert.deepEqual(plan.actualizar, [])
})

test('un GUARDAR no se funde si hay otra operación en medio ni con uno de otra sesión', () => {
  const conSubida = [
    op(1, 'GUARDAR', { cuerpo: { sid: 'S', datos: { nombres: 'ANA' } } }),
    op(2, 'SUBIR', { clave: 'foto' }),
  ]
  assert.equal(planEncolar(conSubida, guardar({ apellidos: 'X' })).fusionado, false)
  const deAntes = [op(1, 'GUARDAR', { cuerpo: { sid: 'VIEJA', datos: { nombres: 'ANA' } } })]
  const plan = planEncolar(deAntes, guardar({ apellidos: 'X' }, 'S'))
  assert.equal(plan.fusionado, false)
  assert.ok(plan.agregar)
})

test('un GUARDAR fallido que la persona corrige se reemplaza; si solo cubre una parte, queda el resto', () => {
  const fallida = op(1, 'GUARDAR', {
    estado: 'fallida',
    cuerpo: { sid: 'S', datos: { telefono: '1', correo: 'x' }, fallo: { mensaje: 'm', errores: { telefono: 'a', correo: 'b' } } },
  })
  const total = planEncolar([fallida], guardar({ telefono: '22223333', correo: 'a@b.co' }))
  assert.deepEqual(total.quitar, [1])
  assert.ok(total.agregar)
  const parcial = planEncolar([fallida], guardar({ telefono: '22223333' }))
  assert.deepEqual(parcial.quitar, [])
  assert.deepEqual(parcial.actualizar[0].cuerpo.datos, { correo: 'x' })
  assert.deepEqual(parcial.actualizar[0].cuerpo.fallo.errores, { correo: 'b' })
})

test('SUBIR reemplaza lo anterior del mismo documento que no salió, pero no toca lo que ya va en camino', () => {
  const cola = [
    op(1, 'SUBIR', { clave: 'foto' }),
    op(2, 'FECHA', { clave: 'foto' }),
    op(3, 'SUBIR', { clave: 'rtu' }),
    op(4, 'SUBIR', { clave: 'foto', estado: 'fallida' }),
  ]
  const plan = planEncolar(cola, { tipo: 'SUBIR', clave: 'foto', cuerpo: { sid: 'S' }, archivo: new Uint8Array(1) })
  assert.deepEqual(plan.quitar.sort(), [1, 2, 4])
  assert.ok(plan.agregar)
  const enCamino = planEncolar(cola, { tipo: 'SUBIR', clave: 'foto', cuerpo: { sid: 'S' } }, { enVuelo: new Set([1]) })
  assert.deepEqual(enCamino.quitar.sort(), [2, 4])
})

test('FECHA se funde en la subida pendiente del mismo documento (conserva su llave de idempotencia)', () => {
  const cola = [op(1, 'SUBIR', { clave: 'rtu', cuerpo: { sid: 'S', fecha: '2026-10-01', idem: 'u-1' } })]
  const plan = planEncolar(cola, { tipo: 'FECHA', clave: 'rtu', cuerpo: { sid: 'S', fecha: '2026-10-05' } })
  assert.equal(plan.fusionado, true)
  assert.deepEqual(plan.actualizar, [{ id: 1, cuerpo: { sid: 'S', fecha: '2026-10-05', idem: 'u-1' } }])
  const sinSubida = planEncolar([], { tipo: 'FECHA', clave: 'rtu', cuerpo: { sid: 'S', fecha: '2026-10-05' } })
  assert.ok(sinSubida.agregar)
})

test('QUITAR: si el servidor no tiene el documento, subida y quitar se anulan; si lo tiene, solo queda quitar', () => {
  const cola = [op(1, 'SUBIR', { clave: 'foto' })]
  const nueva = { tipo: 'QUITAR', clave: 'foto', cuerpo: { sid: 'S' } }
  const sinBase = planEncolar(cola, nueva, { baseTieneDoc: () => false })
  assert.deepEqual(sinBase.quitar, [1])
  assert.equal(sinBase.agregar, null)
  const conBase = planEncolar(cola, nueva, { baseTieneDoc: () => true })
  assert.deepEqual(conBase.quitar, [1])
  assert.ok(conBase.agregar)
  const enCamino = planEncolar(cola, nueva, { baseTieneDoc: () => false, enVuelo: new Set([1]) })
  assert.deepEqual(enCamino.quitar, [])
  assert.ok(enCamino.agregar)
})

test('ENVIAR no se duplica; uno fallido se reemplaza', () => {
  assert.equal(planEncolar([op(1, 'ENVIAR')], { tipo: 'ENVIAR', cuerpo: { sid: 'S' } }).agregar, null)
  const plan = planEncolar([op(1, 'ENVIAR', { estado: 'fallida' })], { tipo: 'ENVIAR', cuerpo: { sid: 'S' } })
  assert.deepEqual(plan.quitar, [1])
  assert.ok(plan.agregar)
})

test('orden estricto: se envía por id, aunque la lista llegue desordenada', () => {
  const cola = [op(3, 'FECHA', { clave: 'rtu' }), op(1, 'GUARDAR'), op(2, 'SUBIR', { clave: 'foto' })]
  assert.equal(siguienteOperacion(cola).id, 1)
  assert.equal(siguienteOperacion(cola, new Set([1])).id, 2)
  assert.equal(siguienteOperacion([], new Set()), null)
})

test('una fallida se salta, pero lo que dependa de ese mismo documento queda detrás', () => {
  const cola = [
    op(1, 'SUBIR', { clave: 'foto', estado: 'fallida' }),
    op(2, 'FECHA', { clave: 'foto' }),
    op(3, 'GUARDAR'),
  ]
  assert.equal(siguienteOperacion(cola).id, 3)
  assert.equal(siguienteOperacion([cola[0], cola[1]]), null)
})

test('ENVIAR espera a que no quede nada antes y a que no haya NINGUNA fallida', () => {
  const enviar = op(5, 'ENVIAR')
  assert.equal(siguienteOperacion([op(1, 'GUARDAR'), enviar]).id, 1)
  assert.equal(siguienteOperacion([op(1, 'GUARDAR'), enviar], new Set([1])), null) // la primera va en camino
  assert.equal(siguienteOperacion([enviar]).id, 5)
  assert.equal(siguienteOperacion([op(1, 'GUARDAR', { estado: 'fallida' }), enviar]), null)
})

test('tope de 80 MB y suma de bytes', () => {
  assert.equal(TOPE_BYTES, 80 * 1024 * 1024)
  assert.equal(bytesEnCola([op(1, 'SUBIR', { bytes: 10 }), op(2, 'SUBIR', { bytes: 5 }), op(3, 'GUARDAR')]), 15)
})
