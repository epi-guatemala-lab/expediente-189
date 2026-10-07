// Pruebas del servicio completo: bóveda + cola + motor, con servidor falso e IndexedDB falsa.
import test from 'node:test'
import assert from 'node:assert/strict'
import { IDBFactory } from 'fake-indexeddb'

import {
  CONFIG,
  CUI,
  NOMBRE_MARCADOR,
  TEXTO_MARCADOR,
  archivoDePrueba,
  aBytes,
  asentar,
  crearEntorno,
  crearServidorFalso,
  esperarHasta,
  llaveDePrueba,
  relojManual,
  tokenConSid,
  volcarTodo,
} from './ayudas-prueba.mjs'
import { abrirBoveda, hashDeCui } from './boveda.js'
import { importarLlave } from './cripto.js'

const LLAVE = llaveDePrueba(7)
const vista = (e) => e.servicio.obtenerVista()
const quieto = (e) =>
  esperarHasta(() => !vista(e).sincronizando && vista(e).pendientes === 0, { intentos: 3000 })
const peticiones = (e, desde = 0) =>
  e.servidor.llamadas.slice(desde).filter((l) => !['/salud', '/config'].includes(l.ruta) && !(l.metodo === 'GET' && l.ruta === '/mi-expediente'))
const nombreDe = (l) => `${l.metodo} ${l.ruta}`
const red = () => {
  throw new TypeError('Failed to fetch')
}
const regla = (cuando, responder, veces) => ({ cuando, responder, veces })
const esPut = (r, m) => r === '/mi-expediente' && m === 'PUT'
const esPost = (clave) => (r, m) => m === 'POST' && r === `/mi-expediente/documentos/${clave}`

async function abrir(opciones = {}) {
  const e = crearEntorno(opciones)
  const r = await e.servicio.iniciarSesion({ cui: CUI, llaveBoveda: opciones.llave || LLAVE })
  assert.equal(r.ok, true)
  const ref = await e.servicio.refrescar()
  assert.equal(ref.resultado, 'ok')
  return e
}

const PERSONALES = { nombres: 'ANA MARIA', apellidos: 'LOPEZ PEREZ' }

// ---------------------------------------------------------------------------
// Camino feliz
// ---------------------------------------------------------------------------

test('guardar con conexión: se envía con `version`, se borra de la cola y la copia se actualiza', async () => {
  const e = await abrir()
  assert.equal(vista(e).indicador, 'servidor')
  const r = await e.servicio.guardarDatos(PERSONALES)
  assert.deepEqual(r, { ok: true, encolado: true })
  await quieto(e)
  const [put] = peticiones(e)
  assert.equal(nombreDe(put), 'PUT /mi-expediente')
  assert.deepEqual(JSON.parse(put.cuerpo), { datos: PERSONALES, version: 1 })
  assert.equal(vista(e).indicador, 'servidor')
  assert.equal(e.servicio.obtenerCola().length, 0)
  // La siguiente escritura ya lleva la versión nueva (no hace falta un 409).
  await e.servicio.guardarDatos({ telefono: '22223333' })
  await quieto(e)
  assert.equal(JSON.parse(peticiones(e)[1].cuerpo).version, 2)
  // Guardar lo mismo no encola nada: solo viaja lo que cambió.
  assert.deepEqual(await e.servicio.guardarDatos({ telefono: '22223333' }), { ok: true, encolado: false })
  assert.equal(peticiones(e).length, 2)
})

test('la pantalla refleja el cambio de inmediato (estado optimista), aun antes de que el servidor responda', async () => {
  const e = await abrir()
  e.servidor.caido = true
  await e.servicio.guardarDatos(PERSONALES)
  assert.equal(vista(e).expediente.datos.nombres, 'ANA MARIA')
  assert.equal(e.servidor.expediente.datos.nombres, undefined)
})

// ---------------------------------------------------------------------------
// F — sin conexión desde el inicio de una sesión ya abierta
// ---------------------------------------------------------------------------

test('F: sin conexión, llenar un paso, adjuntar un archivo y pulsar Enviar no pierde nada ni muestra errores crudos', async () => {
  const e = await abrir()
  e.servidor.caido = true

  const r1 = await e.servicio.guardarDatos({ ...PERSONALES, telefono: '22223333' })
  const r2 = await e.servicio.subirDocumento('foto', archivoDePrueba('bytes-foto'), null)
  const r3 = await e.servicio.enviarExpediente()
  assert.deepEqual([r1.ok, r2.ok, r3.ok], [true, true, true])
  await esperarHasta(() => vista(e).conexion === 'caida')

  const v = vista(e)
  assert.equal(v.indicador, 'dispositivo')
  assert.equal(v.pendientes, 3)
  assert.deepEqual(v.fallidas, [])
  assert.equal(v.envioPendiente, true)
  assert.equal(v.expediente.documentos.find((d) => d.clave === 'foto').pendiente, true)
  assert.deepEqual(e.servicio.obtenerCola().map((o) => o.tipo), ['GUARDAR', 'SUBIR', 'ENVIAR'])
  const texto = JSON.stringify(v)
  assert.doesNotMatch(texto, /Failed to fetch|TypeError|fetch/i, 'ningún error crudo de red llega a la pantalla')

  // Vuelve la conexión: se envía todo, en orden, y se limpia el dispositivo.
  const desde = e.servidor.llamadas.length
  e.servidor.caido = false
  await e.reloj.avanzar(2000)
  await quieto(e)
  assert.deepEqual(peticiones(e, desde).map(nombreDe), [
    'PUT /mi-expediente',
    'POST /mi-expediente/documentos/foto',
    'POST /mi-expediente/enviar',
  ])
  assert.equal(e.servidor.expediente.estado, 'ENVIADO')
  assert.equal(vista(e).expediente.estado, 'ENVIADO')
  assert.equal(vista(e).indicador, 'servidor')
  assert.deepEqual(await e.fabrica.databases(), [], 'tras el envío se borra la bóveda: cola y copia')
})

test('el reintento sin conexión espera 2 s, 4 s, 8 s… hasta 60 s y sondea /salud, no repite la operación', async () => {
  const e = await abrir()
  e.servidor.caido = true
  await e.servicio.guardarDatos(PERSONALES)
  await esperarHasta(() => vista(e).conexion === 'caida')
  const esperas = []
  for (let i = 0; i < 8; i++) {
    esperas.push(e.reloj.pendientes[0])
    await e.reloj.avanzar(e.reloj.pendientes[0])
  }
  assert.deepEqual(esperas, [2000, 4000, 8000, 16000, 32000, 60000, 60000, 60000])
  const puts = e.servidor.llamadas.filter((l) => l.metodo === 'PUT')
  assert.equal(puts.length, 1, 'mientras no haya red solo se sondea /salud')
  assert.ok(e.servidor.llamadas.filter((l) => l.ruta === '/salud').length >= 8)
})

// ---------------------------------------------------------------------------
// B — orden, fusión e idempotencia
// ---------------------------------------------------------------------------

test('orden estricto y fusión: GUARDAR seguidos se funden y la fecha se une a la subida pendiente', async () => {
  const e = await abrir()
  e.servidor.caido = true
  await e.servicio.guardarDatos({ nombres: 'ANA' })
  await esperarHasta(() => vista(e).conexion === 'caida')
  await e.servicio.guardarDatos({ apellidos: 'LOPEZ' })
  await e.servicio.guardarDatos({ nombres: 'ANA MARIA' })
  await e.servicio.subirDocumento('rtu', archivoDePrueba('%PDF', 'rtu.pdf', 'application/pdf'), '2026-10-02')
  await e.servicio.corregirFecha('rtu', '2026-10-05')
  await e.servicio.guardarDatos({ telefono: '22223333' })
  const cola = e.servicio.obtenerCola()
  assert.deepEqual(cola.map((o) => o.tipo), ['GUARDAR', 'SUBIR', 'GUARDAR'])
  assert.deepEqual(cola[0].cuerpo.datos, { nombres: 'ANA MARIA', apellidos: 'LOPEZ' })
  assert.equal(cola[1].cuerpo.fecha, '2026-10-05')

  const desde = e.servidor.llamadas.length
  e.servidor.caido = false
  await e.reloj.avanzar(2000)
  await quieto(e)
  assert.deepEqual(peticiones(e, desde).map(nombreDe), [
    'PUT /mi-expediente',
    'POST /mi-expediente/documentos/rtu',
    'PUT /mi-expediente',
  ])
  assert.equal(e.servidor.expediente.documentos.find((d) => d.clave === 'rtu').fecha_documento, '2026-10-05')
})

test('la misma X-Idempotency-Key se reutiliza en cada reintento de una subida', async () => {
  const e = await abrir()
  e.servidor.reglas.push(regla(esPost('foto'), red, 1))
  e.servidor.reglas.push(regla(esPost('foto'), () => new Response('<html>Bad gateway</html>', { status: 503 }), 1))
  await e.servicio.subirDocumento('foto', archivoDePrueba('bytes-foto'), null)
  await esperarHasta(() => vista(e).conexion === 'caida')
  await e.reloj.avanzar(2000)
  await esperarHasta(() => e.servidor.llamadas.filter((l) => l.metodo === 'POST').length >= 2)
  await asentar()
  await e.reloj.avanzar(e.reloj.pendientes[0])
  await quieto(e)
  const posts = e.servidor.llamadas.filter((l) => l.metodo === 'POST')
  assert.equal(posts.length, 3)
  const llaves = posts.map((p) => p.cabeceras['X-Idempotency-Key'])
  assert.match(llaves[0], /^[0-9a-f-]{36}$/)
  assert.deepEqual([...new Set(llaves)], [llaves[0]], 'la llave es la misma en los tres intentos')
  assert.equal(e.servidor.subidas.length, 1)
  assert.equal(e.servicio.obtenerCola().length, 0)
})

test('un archivo se envía con su contenido exacto y la fecha como multipart', async () => {
  const e = await abrir()
  await e.servicio.subirDocumento('rtu', archivoDePrueba('contenido-exacto', 'rtu.jpg'), '2026-10-02')
  await quieto(e)
  const forma = peticiones(e)[0].cuerpo
  assert.equal(forma.get('fecha_documento'), '2026-10-02')
  assert.equal(await forma.get('archivo').text(), 'contenido-exacto')
  assert.equal(vista(e).expediente.documentos.find((d) => d.clave === 'rtu').pendiente, undefined)
})

// ---------------------------------------------------------------------------
// B — clasificación de cada respuesta (con fetch simulado)
// ---------------------------------------------------------------------------

async function conRespuesta(responder, { veces = 1, op = 'guardar' } = {}) {
  const e = await abrir()
  const cuando = op === 'subir' ? esPost('foto') : esPut
  e.servidor.reglas.push(regla(cuando, responder, veces))
  if (op === 'subir') await e.servicio.subirDocumento('foto', archivoDePrueba(), null)
  else await e.servicio.guardarDatos(PERSONALES)
  return e
}
const json = (cuerpo, status, cabeceras) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json', ...cabeceras } })

for (const [titulo, op, status, cuerpo] of [
  ['409 ESTADO (no editable)', 'guardar', 409, { detail: 'El expediente ya no admite cambios', codigo: 'ESTADO' }],
  ['413 ARCHIVO_GRANDE', 'subir', 413, { detail: 'El archivo supera 8 MB', codigo: 'ARCHIVO_GRANDE' }],
  ['422 VALIDACION', 'guardar', 422, { detail: 'Datos inválidos', codigo: 'VALIDACION', errores: { telefono: 'Teléfono inválido' } }],
  ['429 LIMITE_VERSIONES', 'subir', 429, { detail: 'Demasiadas versiones de este documento', codigo: 'LIMITE_VERSIONES' }],
  ['422 ARCHIVO_INFECTADO', 'subir', 422, { detail: 'El archivo fue rechazado', codigo: 'ARCHIVO_INFECTADO' }],
  ['403 NO_VISIBLE', 'guardar', 403, { detail: 'No visible', codigo: 'NO_VISIBLE' }],
]) {
  test(`clasificación: ${titulo} NO se reintenta; pasa a «No se pudo enviar» con el mensaje del servidor`, async () => {
    const e = await conRespuesta(() => json(cuerpo, status), { veces: 5, op })
    await esperarHasta(() => vista(e).fallidas.length === 1)
    await quieto(e)
    const v = vista(e)
    assert.equal(v.fallidas[0].mensaje, cuerpo.detail)
    assert.deepEqual(v.fallidas[0].errores, cuerpo.errores || null)
    assert.equal(v.pendientes, 0)
    assert.equal(e.servicio.obtenerCola()[0].estado, 'fallida', 'nunca se descarta sola: sigue en la cola')
    const antes = peticiones(e).length
    await e.reloj.avanzar(120_000)
    await e.servicio.despertar()
    assert.equal(peticiones(e).length, antes, 'no hubo más intentos')
    assert.equal(antes, 1)
  })
}

for (const [titulo, responder] of [
  ['red caída', red],
  ['tiempo agotado', () => { throw Object.assign(new Error('timeout'), { name: 'AbortError' }) }],
  ['502 del proxy', () => new Response('<html>502</html>', { status: 502 })],
  ['503 del proxy', () => new Response('', { status: 503 })],
  ['504 del proxy', () => new Response('', { status: 504 })],
]) {
  test(`clasificación: ${titulo} deja la operación en la cola y reintenta (sondeando /salud)`, async () => {
    const e = await conRespuesta(responder, { veces: 1 })
    await esperarHasta(() => vista(e).conexion === 'caida')
    assert.equal(vista(e).pendientes, 1)
    assert.deepEqual(vista(e).fallidas, [])
    assert.equal(vista(e).indicador, 'dispositivo')
    await e.reloj.avanzar(2000)
    await quieto(e)
    assert.equal(e.servidor.expediente.datos.nombres, 'ANA MARIA', 'al volver, se envió')
    assert.equal(vista(e).indicador, 'servidor')
  })
}

test('clasificación: 401 SESION pausa la cola, pide volver a entrar y al volver sigue', async () => {
  const e = await conRespuesta(() => json({ detail: 'Su sesión venció', codigo: 'SESION' }, 401), { veces: 1 })
  await esperarHasta(() => vista(e).necesitaReingreso)
  assert.equal(vista(e).pendientes, 1)
  const antes = e.servidor.llamadas.length
  await e.servicio.despertar()
  await e.reloj.avanzar(120_000)
  assert.equal(e.servidor.llamadas.length, antes, 'con la sesión vencida no se envía nada')

  e.sesion.token = tokenConSid('sesion-1') // la persona volvió a entrar
  await e.servicio.renovarSesion({})
  await quieto(e)
  assert.equal(vista(e).necesitaReingreso, false)
  assert.equal(e.servidor.expediente.datos.nombres, 'ANA MARIA')
})

test('clasificación: VERSION toma `actual`, reaplica SOLO lo que la persona cambió y reintenta una vez', async () => {
  const e = await abrir()
  // Otro dispositivo modificó el expediente: la versión que conocemos quedó atrás.
  e.servidor.expediente.version = 5
  e.servidor.expediente.datos.correo = 'otro@dispositivo.com'
  e.servicio.obtenerCola() // (sin efecto) la copia local sigue en versión 1
  e.servidor.reglas.push(
    regla(esPut, (reg) => json({ detail: 'Alguien más modificó este expediente; recargue', codigo: 'VERSION', actual: e.servidor.expediente }, 409), 1)
  )
  // La copia local ya está desactualizada; se fuerza que el primer PUT salga con la versión vieja.
  await e.servicio.guardarDatos({ telefono: '22223333' })
  await quieto(e)
  const puts = e.servidor.llamadas.filter((l) => l.metodo === 'PUT').map((l) => JSON.parse(l.cuerpo))
  assert.ok(puts.length >= 1)
  const ultimo = puts[puts.length - 1]
  assert.deepEqual(ultimo.datos, { telefono: '22223333' }, 'solo el campo que la persona cambió')
  assert.equal(ultimo.version, 5)
  assert.equal(e.servidor.expediente.datos.correo, 'otro@dispositivo.com', 'lo del otro dispositivo se conserva')
  assert.equal(e.servidor.expediente.datos.telefono, '22223333')
})

test('clasificación: VERSION forzada → reaplica una sola vez; si vuelve a chocar pasa a fallida', async () => {
  const e = await abrir()
  e.servidor.reglas.push(
    regla(esPut, () => json({ detail: 'Alguien más modificó este expediente; recargue', codigo: 'VERSION', actual: { ...e.servidor.expediente, version: 9 } }, 409), 5)
  )
  await e.servicio.guardarDatos({ telefono: '22223333' })
  await esperarHasta(() => vista(e).fallidas.length === 1)
  const puts = e.servidor.llamadas.filter((l) => l.metodo === 'PUT').map((l) => JSON.parse(l.cuerpo))
  assert.equal(puts.length, 2, 'un intento y UN reintento')
  assert.equal(puts[1].version, 9, 'el reintento usa la versión de `actual`')
  assert.match(vista(e).fallidas[0].mensaje, /Alguien más modificó/)
})

test('clasificación: OCUPADO con Retry-After NO es un error: se ve «guardando», se espera y se reintenta sin sondear /salud', async () => {
  const e = await conRespuesta(
    () => json({ detail: 'Hay mucha demanda', codigo: 'OCUPADO' }, 503, { 'Retry-After': '3' }),
    { veces: 1, op: 'subir' }
  )
  await esperarHasta(() => vista(e).ocupado === 'SUBIR')
  const v = vista(e)
  assert.equal(v.indicador, 'guardando')
  assert.equal(v.conexion, 'ok', 'el servidor responde: no es una caída de red')
  assert.deepEqual(v.fallidas, [])
  assert.deepEqual(e.reloj.pendientes, [3000])
  await e.reloj.avanzar(3000)
  await quieto(e)
  assert.equal(vista(e).ocupado, null)
  assert.equal(e.servidor.subidas.length, 1)
  assert.equal(e.servidor.llamadas.filter((l) => l.ruta === '/salud').length, 0)
  const llaves = e.servidor.llamadas.filter((l) => l.metodo === 'POST').map((l) => l.cabeceras['X-Idempotency-Key'])
  assert.equal(new Set(llaves).size, 1)
})

for (const codigo of ['ANTIVIRUS_NO_DISPONIBLE', 'LIMITE_SUBIDAS']) {
  test(`clasificación: ${codigo} se reintenta solo`, async () => {
    const e = await conRespuesta(() => json({ detail: 'x', codigo }, 503), { veces: 2, op: 'subir' })
    await esperarHasta(() => vista(e).ocupado === 'SUBIR')
    assert.deepEqual(vista(e).fallidas, [])
    await e.reloj.avanzar(2000)
    await esperarHasta(() => e.servidor.llamadas.filter((l) => l.metodo === 'POST').length >= 2)
    await asentar()
    await e.reloj.avanzar(e.reloj.pendientes[0] || 0)
    await quieto(e)
    assert.equal(e.servidor.subidas.length, 1)
  })
}

test('clasificación: un 500 sin código se reintenta unas veces y después pasa a fallida', async () => {
  const e = await conRespuesta(() => json({ detail: 'Error interno' }, 500), { veces: 99 })
  for (let i = 0; i < 12 && vista(e).fallidas.length === 0; i++) {
    await esperarHasta(() => vista(e).conexion === 'caida' || vista(e).fallidas.length === 1)
    if (e.reloj.pendientes.length) await e.reloj.avanzar(e.reloj.pendientes[0])
  }
  assert.equal(vista(e).fallidas.length, 1)
  assert.equal(e.servidor.llamadas.filter((l) => l.metodo === 'PUT').length, 5)
})

test('una fallida bloquea ENVIAR (no se envía incompleto en silencio) hasta que la persona decide', async () => {
  const e = await conRespuesta(() => json({ detail: 'Teléfono inválido', codigo: 'VALIDACION', errores: { telefono: 'inválido' } }, 422), { veces: 1 })
  await esperarHasta(() => vista(e).fallidas.length === 1)
  await e.servicio.enviarExpediente()
  await e.servicio.despertar()
  assert.equal(e.servidor.llamadas.some((l) => l.ruta === '/mi-expediente/enviar'), false)
  assert.equal(vista(e).pendientes, 1)
  await e.servicio.descartar(vista(e).fallidas[0].id)
  await quieto(e)
  assert.equal(e.servidor.expediente.estado, 'ENVIADO')
})

test('reintentar una fallida la devuelve a la cola (una subida con llave de idempotencia nueva)', async () => {
  const e = await conRespuesta(() => json({ detail: 'Rechazado', codigo: 'ARCHIVO_INVALIDO' }, 422), { veces: 1, op: 'subir' })
  await esperarHasta(() => vista(e).fallidas.length === 1)
  const primera = e.servidor.llamadas.find((l) => l.metodo === 'POST').cabeceras['X-Idempotency-Key']
  await e.servicio.reintentar(vista(e).fallidas[0].id)
  await quieto(e)
  const llaves = e.servidor.llamadas.filter((l) => l.metodo === 'POST').map((l) => l.cabeceras['X-Idempotency-Key'])
  assert.equal(llaves.length, 2)
  assert.notEqual(llaves[1], primera)
  assert.equal(e.servidor.subidas.length, 1)
})

// ---------------------------------------------------------------------------
// Sesiones: copia atada al sid, cola entre sesiones, salir
// ---------------------------------------------------------------------------

test('la copia de OTRO sid se borra al abrir la bóveda y nunca se muestra', async () => {
  const e1 = await abrir({ sid: 'sesion-A' })
  assert.ok(vista(e1).expediente)
  assert.ok((await volcarTodo(e1.fabrica)).some((v) => v.tipo === 'registro' && v.valor.ivArchivo === undefined && v.valor.instante && !v.valor.tipo), 'hay copia guardada')

  // Se cierra la pestaña sin «Salir» y se vuelve a entrar con otra sesión (otro sid).
  const e2 = crearEntorno({ fabrica: e1.fabrica, servidor: e1.servidor, sid: 'sesion-B' })
  e2.servidor.caido = true
  const r = await e2.servicio.iniciarSesion({ cui: CUI, llaveBoveda: LLAVE })
  assert.equal(r.ok, true)
  assert.equal(vista(e2).expediente, null, 'no se muestra nada de la sesión anterior')
  assert.equal(vista(e2).sinServidor, false)
  const hash = await hashDeCui(CUI)
  const abierta = await abrirBoveda({ fabrica: e1.fabrica, hash, llave: await importarLlave(LLAVE), crear: false })
  assert.equal(await abierta.boveda.leerCopia(), null, 'la copia de la otra sesión fue borrada del dispositivo')
  abierta.boveda.cerrar()
})

test('la copia del MISMO sid sí se usa tras recargar la pestaña, aun sin servidor', async () => {
  const e1 = await abrir({ sid: 'sesion-A' })
  await e1.servicio.guardarDatos(PERSONALES)
  await quieto(e1)
  e1.servidor.caido = true
  await e1.servicio.guardarDatos({ telefono: '22223333' })

  // «Recargar»: servicio nuevo, mismo dispositivo, mismo sid, servidor caído.
  const e2 = crearEntorno({ fabrica: e1.fabrica, servidor: e1.servidor, sid: 'sesion-A' })
  const r = await e2.servicio.reanudarSesion({ idBoveda: await hashDeCui(CUI), llaveBoveda: LLAVE })
  assert.equal(r.ok, true)
  assert.equal(vista(e2).sinServidor, true)
  assert.equal(vista(e2).expediente.datos.nombres, 'ANA MARIA')
  assert.equal(vista(e2).expediente.datos.telefono, '22223333', 'lo pendiente de esta sesión también se ve')
  assert.equal(vista(e2).pendientes, 1)
})

test('la cola de una sesión anterior se envía al volver a entrar, pero su contenido no se muestra', async () => {
  const e1 = await abrir({ sid: 'sesion-A' })
  e1.servidor.caido = true
  await e1.servicio.guardarDatos({ nombres: NOMBRE_MARCADOR })
  await esperarHasta(() => vista(e1).conexion === 'caida')
  assert.equal(e1.servicio.obtenerCola().length, 1)

  const e2 = crearEntorno({ fabrica: e1.fabrica, servidor: e1.servidor, sid: 'sesion-B' })
  e1.servidor.caido = false
  await e2.servicio.iniciarSesion({ cui: CUI, llaveBoveda: LLAVE })
  const v = vista(e2)
  assert.equal(v.pendientes, 1)
  assert.equal(v.pendientesAnteriores, 1)
  assert.equal(v.expediente, null)
  assert.doesNotMatch(JSON.stringify(v), new RegExp(NOMBRE_MARCADOR))

  assert.equal(await e2.servicio.drenarYEsperar(), 'vacia')
  assert.equal(e1.servidor.expediente.datos.nombres, NOMBRE_MARCADOR)
  const put = e1.servidor.llamadas.find((l) => l.metodo === 'PUT')
  assert.equal(JSON.parse(put.cuerpo).version, 1, 'antes de escribir se pidió el expediente para tener su versión')
  assert.equal(vista(e2).pendientes, 0)
})

test('lo que se encola en la sesión actual sí se ve; no se mezcla con lo de la anterior', async () => {
  const e1 = await abrir({ sid: 'sesion-A' })
  e1.servidor.caido = true
  await e1.servicio.guardarDatos({ nombres: 'DE ANTES' })
  await esperarHasta(() => vista(e1).conexion === 'caida')
  const e2 = crearEntorno({ fabrica: e1.fabrica, servidor: e1.servidor, sid: 'sesion-B' })
  await e2.servicio.iniciarSesion({ cui: CUI, llaveBoveda: LLAVE })
  e2.servidor.caido = false
  await e2.servicio.refrescar()
  e2.servidor.caido = true
  await e2.servicio.guardarDatos({ apellidos: 'DE AHORA' })
  assert.deepEqual(e2.servicio.obtenerCola().map((o) => o.cuerpo.datos), [{ nombres: 'DE ANTES' }, { apellidos: 'DE AHORA' }])
  assert.equal(vista(e2).expediente.datos.apellidos, 'DE AHORA')
  assert.equal(vista(e2).expediente.datos.nombres, undefined)
})

test('Salir: borra la copia y conserva la cola solo si hay pendientes (y dice cuántos)', async () => {
  const e = await abrir()
  e.servidor.caido = true
  await e.servicio.guardarDatos(PERSONALES)
  const { conservadas } = await e.servicio.cerrar()
  assert.equal(conservadas, 1)
  const hash = await hashDeCui(CUI)
  const r = await abrirBoveda({ fabrica: e.fabrica, hash, llave: await importarLlave(LLAVE), crear: false })
  assert.equal(r.ok, true)
  assert.equal(await r.boveda.leerCopia(), null)
  assert.equal((await r.boveda.listarCola()).length, 1)
  r.boveda.cerrar()
  assert.equal(vista(e).abierta, false)
  assert.equal(vista(e).expediente, null)
})

test('Salir sin pendientes elimina la bóveda; «Salir y borrar» elimina todo aunque haya pendientes', async () => {
  const limpio = await abrir()
  assert.equal((await limpio.servicio.cerrar()).conservadas, 0)
  assert.deepEqual(await limpio.fabrica.databases(), [])

  const e = await abrir()
  e.servidor.caido = true
  await e.servicio.guardarDatos(PERSONALES)
  assert.equal((await e.servicio.cerrar({ borrarTodo: true })).conservadas, 0)
  assert.deepEqual(await e.fabrica.databases(), [])
})

test('tras ENVIAR con una fallida pendiente: la copia se borra pero la bóveda queda con esa cola', async () => {
  const e = await abrir()
  e.servidor.reglas.push(regla((r, m) => m === 'POST' && r.startsWith('/mi-expediente/documentos/foto'), () => json({ detail: 'x', codigo: 'ARCHIVO_TIPO' }, 422), 1))
  await e.servicio.subirDocumento('foto', archivoDePrueba(), null)
  await esperarHasta(() => vista(e).fallidas.length === 1)
  // ENVIAR queda bloqueado mientras exista la fallida; se envía al descartarla.
  await e.servicio.enviarExpediente()
  await e.servicio.descartar(vista(e).fallidas[0].id)
  await quieto(e)
  assert.deepEqual(await e.fabrica.databases(), [])
})

// ---------------------------------------------------------------------------
// Bóveda ilegible, memoria, tope, llaves
// ---------------------------------------------------------------------------

test('una llave que no abre lo guardado NO borra nada: avisa y espera la decisión explícita', async () => {
  const e1 = await abrir()
  e1.servidor.caido = true
  await e1.servicio.guardarDatos(PERSONALES)
  await esperarHasta(() => vista(e1).conexion === 'caida')
  const e2 = crearEntorno({ fabrica: e1.fabrica, servidor: e1.servidor })
  const r = await e2.servicio.iniciarSesion({ cui: CUI, llaveBoveda: llaveDePrueba(99) })
  assert.deepEqual(r, { ok: false, motivo: 'no_abre' })
  assert.equal(vista(e2).bloqueada, true)
  assert.equal(vista(e2).abierta, false)
  assert.equal((await e2.fabrica.databases()).length, 1, 'la bóveda sigue ahí')
  assert.equal(await e2.servicio.guardarDatos({ telefono: '1' }).then((x) => x.ok), false)

  // Con la llave correcta todo sigue ahí.
  const e3 = crearEntorno({ fabrica: e1.fabrica, servidor: e1.servidor })
  e3.servidor.caido = true
  await e3.servicio.iniciarSesion({ cui: CUI, llaveBoveda: LLAVE })
  assert.equal(vista(e3).pendientes, 1)

  // Descartar es una decisión de la persona.
  const e4 = crearEntorno({ fabrica: e1.fabrica, servidor: e1.servidor })
  await e4.servicio.iniciarSesion({ cui: CUI, llaveBoveda: llaveDePrueba(99) })
  const d = await e4.servicio.descartarBovedaIlegible()
  assert.equal(d.ok, true)
  assert.equal(vista(e4).abierta, true)
  assert.equal(vista(e4).pendientes, 0)
})

test('sin IndexedDB funciona en línea y avisa una sola vez que no se guarda sin conexión', async () => {
  const e = crearEntorno({ fabrica: null })
  e.servicio.obtenerVista()
  await e.servicio.iniciarSesion({ cui: CUI, llaveBoveda: LLAVE })
  await e.servicio.refrescar()
  assert.equal(vista(e).almacenamiento, 'memoria')
  assert.equal(vista(e).avisoAlmacenamiento, false, 'el aviso sale al primer guardado, no antes')
  await e.servicio.guardarDatos(PERSONALES)
  assert.equal(vista(e).avisoAlmacenamiento, true)
  await quieto(e)
  assert.equal(e.servidor.expediente.datos.nombres, 'ANA MARIA')
  e.servicio.descartarAviso('almacenamiento')
  await e.servicio.guardarDatos({ telefono: '22223333' })
  assert.equal(vista(e).avisoAlmacenamiento, false, 'no vuelve a aparecer')
})

test('tope de la cola: no se encolan más archivos pasado el límite; reemplazar un archivo libera su espacio', async () => {
  const e = crearEntorno({})
  const servicio = (await import('./servicio.js')).crearServicio
  assert.equal(typeof servicio, 'function')
  const chico = crearEntorno({})
  // Se crea un servicio con tope de 100 bytes.
  const { crearTransporte } = await import('./transporte.js')
  const tope = (await import('./servicio.js')).crearServicio({
    transporte: crearTransporte({ base: 'https://prueba.local/expediente189', obtenerToken: () => tokenConSid('s'), fetchImpl: chico.servidor.fetch }),
    fabricaIdb: new IDBFactory(),
    reloj: relojManual(),
    hayToken: () => true,
    obtenerSid: () => 's',
    topeBytes: 100,
  })
  chico.servidor.caido = true
  await tope.iniciarSesion({ cui: CUI, llaveBoveda: LLAVE })
  await tope.registrarCopia(chico.servidor.expediente, CONFIG)
  assert.equal((await tope.subirDocumento('foto', archivoDePrueba('a'.repeat(60)), null)).ok, true)
  await esperarHasta(() => tope.obtenerVista().conexion === 'caida') // el primer intento ya terminó
  assert.deepEqual(await tope.subirDocumento('rtu', archivoDePrueba('b'.repeat(60)), '2026-10-02'), { ok: false, motivo: 'tope' })
  // Reemplazar la misma foto por otra de 90 bytes sí cabe: la anterior se libera.
  assert.equal((await tope.subirDocumento('foto', archivoDePrueba('c'.repeat(90)), null)).ok, true)
  assert.equal(tope.obtenerCola().length, 1)
  void e
})

test('si el servidor entregara otra llave para la misma persona, lo guardado se vuelve a cifrar (no queda ilegible)', async () => {
  const e = await abrir()
  e.servidor.caido = true
  await e.servicio.guardarDatos(PERSONALES)
  const nueva = llaveDePrueba(42)
  const r = await e.servicio.renovarSesion({ llaveBoveda: nueva })
  assert.equal(r.llaveTexto, nueva)
  const hash = await hashDeCui(CUI)
  assert.equal((await abrirBoveda({ fabrica: e.fabrica, hash, llave: await importarLlave(LLAVE) })).motivo, 'no_abre')
  const ok = await abrirBoveda({ fabrica: e.fabrica, hash, llave: await importarLlave(nueva) })
  assert.equal(ok.ok, true)
  assert.equal((await ok.boveda.listarCola()).length, 1)
  ok.boveda.cerrar()
})

test('renovar la sesión con otro sid borra la copia (y no queda nada de la anterior)', async () => {
  const e = await abrir({ sid: 'sesion-A' })
  e.servidor.caido = true // sin servidor no se vuelve a pedir el expediente: se ve qué queda
  e.sesion.token = tokenConSid('sesion-NUEVA')
  const r = await e.servicio.renovarSesion({})
  assert.equal(r.cambioSid, true)
  assert.equal(vista(e).expediente, null)
  const hash = await hashDeCui(CUI)
  const ab = await abrirBoveda({ fabrica: e.fabrica, hash, llave: await importarLlave(LLAVE) })
  assert.equal(await ab.boveda.leerCopia(), null)
  ab.boveda.cerrar()
})

// ---------------------------------------------------------------------------
// Datos ocultos y verificación automática
// ---------------------------------------------------------------------------

test('con datos ocultos: aviso una sola vez, lo escrito deja de estar oculto y los faltantes cuentan lo guardado', async () => {
  const servidor = crearServidorFalso({
    expediente: {
      datos: { es_colegiado: false },
      campos_guardados: ['es_colegiado', 'telefono', 'correo'],
      campos_ocultos: ['telefono', 'correo'],
    },
  })
  const e = await abrir({ servidor })
  assert.equal(vista(e).avisoOcultos, true)
  e.servicio.descartarAviso('ocultos')
  assert.equal(vista(e).avisoOcultos, false)
  e.servidor.caido = true
  await e.servicio.guardarDatos({ telefono: '22223333' })
  assert.deepEqual(vista(e).expediente.campos_ocultos, ['correo'])
  assert.ok(!vista(e).expediente.faltantes.includes('telefono'))
  assert.ok(!vista(e).expediente.faltantes.includes('correo'), 'oculto = guardado = completo')
})

test('la verificación automática pide el expediente cada 5 s mientras haya un documento EN_PROCESO, máximo 2 minutos', async () => {
  const e = await abrir()
  await e.servicio.subirDocumento('rtu', archivoDePrueba('%PDF', 'rtu.pdf', 'application/pdf'), '2026-10-02')
  await quieto(e)
  const gets = () => e.servidor.llamadas.filter((l) => l.metodo === 'GET' && l.ruta === '/mi-expediente').length
  const antes = gets()
  assert.equal(vista(e).expediente.documentos.find((d) => d.clave === 'rtu').verificacion.estado, 'EN_PROCESO')
  await e.reloj.avanzar(5000)
  assert.equal(gets(), antes + 1)
  await e.reloj.avanzar(5000)
  assert.equal(gets(), antes + 2)
  // El servidor termina de verificar: se deja de preguntar.
  e.servidor.expediente.documentos.find((d) => d.clave === 'rtu').verificacion = { estado: 'LISTA', fecha: 'COINCIDE', tipo: 'COINCIDE', identidad: 'COINCIDE', metodo: 'texto', fechas_detectadas: [] }
  await e.reloj.avanzar(5000)
  const trasListo = gets()
  await e.reloj.avanzar(60_000)
  assert.equal(gets(), trasListo)
})

test('la verificación se detiene a los 2 minutos aunque el servidor siga EN_PROCESO', async () => {
  const e = await abrir()
  await e.servicio.subirDocumento('rtu', archivoDePrueba('%PDF', 'rtu.pdf', 'application/pdf'), '2026-10-02')
  await quieto(e)
  const gets = () => e.servidor.llamadas.filter((l) => l.metodo === 'GET' && l.ruta === '/mi-expediente').length
  const antes = gets()
  await e.reloj.avanzar(10 * 60_000)
  assert.equal(gets() - antes, 24)
})

test('la verificación espera sin gastar su ventana mientras no hay conexión', async () => {
  const e = await abrir()
  await e.servicio.subirDocumento('rtu', archivoDePrueba('%PDF', 'rtu.pdf', 'application/pdf'), '2026-10-02')
  await quieto(e)
  e.servidor.caido = true
  await e.servicio.guardarDatos(PERSONALES) // lo pendiente impide preguntar
  await esperarHasta(() => vista(e).conexion === 'caida')
  await e.reloj.avanzar(60_000)
  e.servidor.caido = false
  await e.reloj.avanzar(60_000)
  await quieto(e)
  const gets = e.servidor.llamadas.filter((l) => l.metodo === 'GET' && l.ruta === '/mi-expediente').length
  assert.ok(gets >= 2)
})

// ---------------------------------------------------------------------------
// C — nada en claro en la IndexedDB
// ---------------------------------------------------------------------------

test('C: ni el CUI, ni el nombre, ni el texto marcador, ni la llave aparecen en claro en ningún registro', async () => {
  const servidor = crearServidorFalso()
  servidor.expediente.nombre_nomina = NOMBRE_MARCADOR
  const e = await abrir({ servidor })
  e.servidor.caido = true
  await e.servicio.guardarDatos({ nombres: NOMBRE_MARCADOR, profesion: TEXTO_MARCADOR })
  await e.servicio.subirDocumento('foto', archivoDePrueba(`bytes ${TEXTO_MARCADOR} bytes`, 'nombre-archivo-marcador.jpg'), null)
  await e.servicio.subirDocumento('rtu', archivoDePrueba('%PDF-1.4 ' + TEXTO_MARCADOR, 'rtu.pdf', 'application/pdf'), '2026-10-02')
  await e.servicio.enviarExpediente()
  await asentar(100)

  const volcado = await volcarTodo(e.fabrica)
  const registros = volcado.filter((v) => v.tipo === 'registro')
  assert.ok(registros.length >= 5, `hay registros que revisar (${registros.length})`)
  assert.ok(volcado.some((v) => v.tipo === 'almacen' && v.valor === 'cola'))
  assert.ok(volcado.some((v) => v.tipo === 'almacen' && v.valor === 'copia'))

  const llaveBytes = Buffer.alloc(32, 7)
  const prohibidos = {
    'CUI': CUI,
    'CUI con espacios': '1234 56789 0101',
    'nombre': NOMBRE_MARCADOR,
    'texto marcador': TEXTO_MARCADOR,
    'nombre de archivo': 'nombre-archivo-marcador',
    'llave (base64url)': LLAVE,
    'llave (bytes)': llaveBytes,
    'sid': 'sesion-1',
    'token': 'cabecera.',
  }
  for (const [nombre, aguja] of Object.entries(prohibidos)) {
    const cadenas = typeof aguja === 'string' ? [Buffer.from(aguja, 'utf8'), Buffer.from(aguja, 'utf16le')] : [aguja]
    for (const entrada of volcado) {
      const bytes = aBytes(entrada.valor)
      for (const c of cadenas) {
        assert.equal(bytes.includes(c), false, `«${nombre}» apareció en claro en ${entrada.tipo}`)
      }
    }
  }
  // En claro en la cola solo: id, tipo, clave del documento, instante, intentos y estado.
  const permitidos = new Set(['id', 'tipo', 'clave', 'instante', 'intentos', 'estado', 'iv', 'cifrado', 'ivArchivo', 'archivo'])
  const enCola = registros.filter((r) => r.valor.tipo && r.valor.cifrado)
  assert.ok(enCola.length >= 4)
  for (const r of enCola) {
    for (const campo of Object.keys(r.valor)) assert.ok(permitidos.has(campo), `campo inesperado en la cola: ${campo}`)
  }
  assert.ok(volcado.filter((v) => v.tipo === 'base').every((v) => !v.valor.includes(CUI)))

  // Control positivo del detector: un registro con el marcador en claro SÍ se detecta.
  const sucia = new IDBFactory()
  await new Promise((res, rej) => {
    const r = sucia.open('sucia', 1)
    r.onupgradeneeded = () => r.result.createObjectStore('x').put({ nota: `hola ${TEXTO_MARCADOR}` }, 1)
    r.onsuccess = () => res(r.result.close())
    r.onerror = () => rej(r.error)
  })
  const detectado = (await volcarTodo(sucia)).some((v) => aBytes(v.valor).includes(Buffer.from(TEXTO_MARCADOR)))
  assert.equal(detectado, true, 'el detector encuentra texto en claro cuando lo hay')

  // Control positivo del cifrado: con la llave, el contenido sí está.
  const hash = await hashDeCui(CUI)
  const ab = await abrirBoveda({ fabrica: e.fabrica, hash, llave: await importarLlave(LLAVE) })
  const cola = await ab.boveda.listarCola()
  assert.ok(JSON.stringify(cola).includes(TEXTO_MARCADOR))
  assert.ok(JSON.stringify(await ab.boveda.leerCopia()).includes(CUI))
  const subida = cola.find((o) => o.clave === 'foto')
  assert.ok(Buffer.from(await ab.boveda.leerArchivo(subida.id)).includes(Buffer.from(TEXTO_MARCADOR)))
  ab.boveda.cerrar()
})
