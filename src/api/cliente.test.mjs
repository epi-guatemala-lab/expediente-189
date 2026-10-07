// Acceso: se envía `sesion_anterior`, la sesión de la pestaña y los mensajes por código.
import test from 'node:test'
import assert from 'node:assert/strict'

const almacen = new Map()
Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  value: {
    getItem: (k) => (almacen.has(k) ? almacen.get(k) : null),
    setItem: (k, v) => void almacen.set(k, String(v)),
    removeItem: (k) => void almacen.delete(k),
  },
})

const cliente = await import('./cliente.js')
const errores = await import('./errores.js')

function simularFetch(responder) {
  const llamadas = []
  globalThis.fetch = async (url, opciones) => {
    llamadas.push({ url, opciones, cuerpo: opciones?.body ? JSON.parse(opciones.body) : null })
    return responder(url, opciones)
  }
  return llamadas
}
const json = (cuerpo, status = 200, cabeceras = {}) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json', ...cabeceras } })

test.beforeEach(() => almacen.clear())

test('acceso: sin sesión previa no manda `sesion_anterior`; el nombre va tal como se escribió', async () => {
  const llamadas = simularFetch(() => json({ token: 't1', nombre: 'Ana', llave_boveda: 'k' }))
  const r = await cliente.acceso('1234567890101', 'ana maría López')
  assert.equal(r.token, 't1')
  assert.match(llamadas[0].url, /\/expediente189\/acceso$/)
  assert.deepEqual(llamadas[0].cuerpo, { cui: '1234567890101', nombre: 'ana maría López' })
})

test('acceso: el último token de la pestaña se envía SIEMPRE como `sesion_anterior`, aunque haya vencido', async () => {
  const llamadas = simularFetch(() => json({ token: 't2', llave_boveda: 'k' }))
  cliente.guardarSesion({ token: 'token-viejo', llave: 'k', idBoveda: 'h' })
  cliente.borrarToken() // el token vigente venció y se descartó
  assert.equal(cliente.leerToken(), null)
  assert.equal(cliente.leerTokenAnterior(), 'token-viejo')
  await cliente.acceso('1234567890101', 'Ana López')
  assert.equal(llamadas[0].cuerpo.sesion_anterior, 'token-viejo')
  // Tras entrar de nuevo, el nuevo token pasa a ser el «anterior».
  cliente.guardarSesion({ token: 't2' })
  await cliente.acceso('1234567890101', 'Ana López')
  assert.equal(llamadas[1].cuerpo.sesion_anterior, 't2')
})

test('cerrarSesion (Salir) borra token, sesión anterior, llave e id de la bóveda', () => {
  cliente.guardarSesion({ token: 'a', llave: 'b', idBoveda: 'c' })
  assert.deepEqual(cliente.leerSesion(), { token: 'a', anterior: 'a', llave: 'b', idBoveda: 'c' })
  cliente.cerrarSesion()
  assert.deepEqual(cliente.leerSesion(), { token: null, anterior: null, llave: null, idBoveda: null })
})

test('en sessionStorage solo viven token, último token, llave e id de bóveda (nada personal)', () => {
  cliente.guardarSesion({ token: 'a', llave: 'b', idBoveda: 'c' })
  assert.deepEqual([...almacen.keys()].sort(), ['exp189_anterior', 'exp189_boveda', 'exp189_llave', 'exp189_token'])
})

test('acceso: el servidor responde con `codigo` y Retry-After; una red caída llega sin error crudo', async () => {
  simularFetch(() => json({ detail: 'Demasiados intentos', codigo: 'BLOQUEADO' }, 429, { 'Retry-After': '600' }))
  await assert.rejects(cliente.acceso('1', 'x'), (e) => e.status === 429 && e.codigo === 'BLOQUEADO' && e.retryAfter === 600)
  simularFetch(() => {
    throw new TypeError('Failed to fetch')
  })
  await assert.rejects(cliente.acceso('1', 'x'), (e) => e.status === 0 && e.red === true && !/fetch/i.test(e.detail))
  simularFetch(() => new Response('<html>502</html>', { status: 502 }))
  await assert.rejects(cliente.acceso('1', 'x'), (e) => e.status === 502 && e.codigo === null)
})

test('mensajes de acceso por código', () => {
  const { mensajeDeAcceso } = errores
  assert.equal(
    mensajeDeAcceso({ status: 401, codigo: 'CREDENCIALES', detail: 'x' }),
    'El DPI o el nombre no coinciden con la nómina. Revise que el DPI esté completo y escriba su nombre como aparece en él.'
  )
  assert.equal(
    mensajeDeAcceso({ status: 429, codigo: 'BLOQUEADO', retryAfter: 900 }),
    'Demasiados intentos con este DPI. Espere 15 minutos o pida a Recepción que lo desbloquee.'
  )
  assert.match(mensajeDeAcceso({ status: 429, codigo: 'BLOQUEADO', retryAfter: 30 }), /Espere 1 minuto o pida/)
  assert.match(mensajeDeAcceso({ status: 429, codigo: 'BLOQUEADO' }), /Espere unos minutos o pida/)
  assert.equal(
    mensajeDeAcceso({ status: 0, red: true }, { hayBoveda: true }),
    'No hay conexión con el servidor en este momento. Lo que usted guardó en este dispositivo sigue aquí, protegido, y se enviará cuando vuelva a entrar con conexión.'
  )
  assert.equal(
    mensajeDeAcceso({ status: 503, codigo: null }, { hayBoveda: false }),
    'No hay conexión con el servidor. Intente de nuevo en unos minutos.'
  )
  assert.match(mensajeDeAcceso({ status: 503, codigo: 'OCUPADO' }), /mucha demanda/)
  assert.match(mensajeDeAcceso({ status: 429, codigo: null }), /mucha demanda/)
})
