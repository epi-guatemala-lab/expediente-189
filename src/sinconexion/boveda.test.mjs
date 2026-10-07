// Pruebas de la bóveda cifrada sobre IndexedDB falsa.
import test from 'node:test'
import assert from 'node:assert/strict'
import { IDBFactory } from 'fake-indexeddb'

import { abrirBoveda, crearBovedaMemoria, descartarBoveda, existeBoveda, hashDeCui, nombreBoveda } from './boveda.js'
import { importarLlave } from './cripto.js'
import { CUI, llaveDePrueba, volcarTodo } from './ayudas-prueba.mjs'

async function nueva(relleno = 7) {
  const fabrica = new IDBFactory()
  const hash = await hashDeCui(CUI)
  const llave = await importarLlave(llaveDePrueba(relleno))
  return { fabrica, hash, llave }
}

test('el nombre de la bóveda usa el SHA-256 del CUI, nunca el CUI', async () => {
  const hash = await hashDeCui('1234 56789 0101')
  assert.match(hash, /^[0-9a-f]{64}$/)
  assert.equal(nombreBoveda(hash), `exp189-${hash}`)
  assert.ok(!nombreBoveda(hash).includes(CUI))
  assert.equal(hash, await hashDeCui(CUI))
})

test('sin bóveda y sin pedir crearla: no se crea nada ni queda rastro', async () => {
  const { fabrica, hash, llave } = await nueva()
  assert.equal(await existeBoveda({ fabrica, hash }), false)
  const r = await abrirBoveda({ fabrica, hash, llave, crear: false })
  assert.deepEqual({ ok: r.ok, motivo: r.motivo }, { ok: false, motivo: 'sin_boveda' })
  assert.deepEqual(await fabrica.databases(), [])
})

test('crear, guardar y volver a abrir con la misma llave: la copia y la cola vuelven iguales', async () => {
  const { fabrica, hash, llave } = await nueva()
  const r1 = await abrirBoveda({ fabrica, hash, llave, crear: true })
  assert.equal(r1.ok, true)
  assert.equal(r1.creada, true)
  await r1.boveda.guardarCopia({ sid: 's1', expediente: { cui: CUI, datos: { a: 'ñandú' } }, config: { x: 1 } })
  const id1 = await r1.boveda.agregar({ tipo: 'GUARDAR', cuerpo: { datos: { nombres: 'ANA' } } })
  const id2 = await r1.boveda.agregar({
    tipo: 'SUBIR',
    clave: 'foto',
    cuerpo: { nombre: 'foto.jpg', fecha: null },
    archivo: Uint8Array.from([1, 2, 3, 250]),
  })
  assert.ok(id2 > id1)
  r1.boveda.cerrar()

  assert.equal(await existeBoveda({ fabrica, hash }), true)
  const r2 = await abrirBoveda({ fabrica, hash, llave, crear: false })
  assert.equal(r2.ok, true)
  assert.equal(r2.creada, false)
  assert.deepEqual(await r2.boveda.leerCopia(), { sid: 's1', expediente: { cui: CUI, datos: { a: 'ñandú' } }, config: { x: 1 } })
  const cola = await r2.boveda.listarCola()
  assert.deepEqual(cola.map((o) => [o.id, o.tipo, o.clave, o.estado]), [
    [id1, 'GUARDAR', null, 'pendiente'],
    [id2, 'SUBIR', 'foto', 'pendiente'],
  ])
  assert.deepEqual(cola[0].cuerpo, { datos: { nombres: 'ANA' } })
  assert.equal(cola[1].bytes, 4 + 16) // el archivo cifrado lleva la etiqueta de 16 bytes
  assert.deepEqual(await r2.boveda.leerArchivo(id2), Uint8Array.from([1, 2, 3, 250]))
  r2.boveda.cerrar()
})

test('llave equivocada: falla limpio (no_abre) y NO borra nada; con la llave correcta todo sigue ahí', async () => {
  const { fabrica, hash, llave } = await nueva(7)
  const buena = await abrirBoveda({ fabrica, hash, llave, crear: true })
  await buena.boveda.agregar({ tipo: 'GUARDAR', cuerpo: { datos: { nombres: 'ANA' } } })
  await buena.boveda.guardarCopia({ sid: 's', expediente: {}, config: null })
  buena.boveda.cerrar()

  const otra = await importarLlave(llaveDePrueba(9))
  const mala = await abrirBoveda({ fabrica, hash, llave: otra, crear: true }) // ni siquiera con crear:true
  assert.deepEqual({ ok: mala.ok, motivo: mala.motivo }, { ok: false, motivo: 'no_abre' })
  assert.equal(await existeBoveda({ fabrica, hash }), true)

  const de_nuevo = await abrirBoveda({ fabrica, hash, llave, crear: false })
  assert.equal(de_nuevo.ok, true)
  assert.equal((await de_nuevo.boveda.listarCola()).length, 1)
  assert.ok(await de_nuevo.boveda.leerCopia())
  de_nuevo.boveda.cerrar()
})

test('actualizar cambia el cuerpo con un IV nuevo; quitar y borrarCopia funcionan', async () => {
  const { fabrica, hash, llave } = await nueva()
  const { boveda } = await abrirBoveda({ fabrica, hash, llave, crear: true })
  const id = await boveda.agregar({ tipo: 'FECHA', clave: 'rtu', cuerpo: { fecha: '2026-10-02' } })
  const antes = (await volcarTodo(fabrica)).find((v) => v.tipo === 'registro' && v.valor.tipo === 'FECHA').valor
  await boveda.actualizar(id, { cuerpo: { fecha: '2026-10-03' }, estado: 'fallida', intentos: 2 })
  const despues = (await volcarTodo(fabrica)).find((v) => v.tipo === 'registro' && v.valor.tipo === 'FECHA').valor
  assert.notDeepEqual(antes.iv, despues.iv)
  const [op] = await boveda.listarCola()
  assert.deepEqual([op.cuerpo.fecha, op.estado, op.intentos], ['2026-10-03', 'fallida', 2])
  await boveda.guardarCopia({ sid: 's', expediente: {}, config: null })
  await boveda.borrarCopia()
  assert.equal(await boveda.leerCopia(), null)
  await boveda.quitar(id)
  assert.deepEqual(await boveda.listarCola(), [])
  boveda.cerrar()
})

test('recifrarCon: todo se vuelve a cifrar con la llave nueva y la anterior deja de servir', async () => {
  const { fabrica, hash, llave } = await nueva(7)
  const nuevaLlave = await importarLlave(llaveDePrueba(11))
  const { boveda } = await abrirBoveda({ fabrica, hash, llave, crear: true })
  await boveda.agregar({ tipo: 'SUBIR', clave: 'foto', cuerpo: { fecha: null }, archivo: Uint8Array.from([9, 8, 7]) })
  await boveda.guardarCopia({ sid: 's', expediente: { cui: CUI }, config: null })
  await boveda.recifrarCon(nuevaLlave)
  boveda.cerrar()

  assert.equal((await abrirBoveda({ fabrica, hash, llave, crear: false })).motivo, 'no_abre')
  const r = await abrirBoveda({ fabrica, hash, llave: nuevaLlave, crear: false })
  assert.equal(r.ok, true)
  const [op] = await r.boveda.listarCola()
  assert.deepEqual(await r.boveda.leerArchivo(op.id), Uint8Array.from([9, 8, 7]))
  assert.deepEqual((await r.boveda.leerCopia()).expediente, { cui: CUI })
  r.boveda.cerrar()
})

test('eliminar y descartarBoveda borran la base completa', async () => {
  const { fabrica, hash, llave } = await nueva()
  const { boveda } = await abrirBoveda({ fabrica, hash, llave, crear: true })
  await boveda.agregar({ tipo: 'ENVIAR', cuerpo: {} })
  await boveda.eliminar()
  assert.deepEqual(await fabrica.databases(), [])

  const otra = await abrirBoveda({ fabrica, hash, llave, crear: true })
  otra.boveda.cerrar()
  await descartarBoveda({ fabrica, hash })
  assert.deepEqual(await fabrica.databases(), [])
})

test('sin IndexedDB el resultado es sin_soporte; la bóveda en memoria cumple el mismo contrato', async () => {
  const llave = await importarLlave(llaveDePrueba())
  assert.equal((await abrirBoveda({ fabrica: null, hash: 'x', llave, crear: true })).motivo, 'sin_soporte')
  const memoria = crearBovedaMemoria()
  const id = await memoria.agregar({ tipo: 'SUBIR', clave: 'foto', cuerpo: { a: 1 }, archivo: Uint8Array.from([5]) })
  await memoria.actualizar(id, { estado: 'fallida' })
  const [op] = await memoria.listarCola()
  assert.deepEqual([op.estado, op.bytes, op.cuerpo], ['fallida', 1, { a: 1 }])
  assert.deepEqual(await memoria.leerArchivo(id), Uint8Array.from([5]))
})
