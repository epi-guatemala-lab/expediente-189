// Utilidades compartidas por las pruebas de la capa sin conexión (no es una prueba).
// Simula el servidor con un `fetch` falso que sigue el contrato (CONTRATO §5 y §6).

import { IDBFactory } from 'fake-indexeddb'
import { base64urlDeBytes } from './cripto.js'
import { crearServicio } from './servicio.js'
import { sidDeToken } from './token.js'
import { crearTransporte } from './transporte.js'

export const CUI = '1234567890101'
export const NOMBRE_MARCADOR = 'MARCADOR NOMBRE PRUEBA'
export const TEXTO_MARCADOR = 'texto-marcador-confidencial-xyz'

export function llaveDePrueba(relleno = 7) {
  return base64urlDeBytes(new Uint8Array(32).fill(relleno))
}

export function tokenConSid(sid) {
  const carga = Buffer.from(JSON.stringify({ sid, aud: 'exp189-solicitante' })).toString('base64url')
  return `cabecera.${carga}.firma`
}

// Reloj manual: los temporizadores solo corren cuando la prueba avanza el tiempo.
export function relojManual() {
  let ahora = 1_000_000
  let siguiente = 1
  const pendientes = new Map()
  return {
    ahora: () => ahora,
    programar(fn, ms) {
      const id = siguiente++
      pendientes.set(id, { fn, en: ahora + ms })
      return id
    },
    cancelar(id) {
      pendientes.delete(id)
    },
    get pendientes() {
      return [...pendientes.values()].map((p) => p.en - ahora)
    },
    // Avanza el tiempo y ejecuta lo vencido (en orden). Espera a que cada tarea termine.
    async avanzar(ms) {
      const limite = ahora + ms
      for (;;) {
        const vencidas = [...pendientes.entries()].filter(([, p]) => p.en <= limite).sort((a, b) => a[1].en - b[1].en)
        if (vencidas.length === 0) break
        const [id, p] = vencidas[0]
        pendientes.delete(id)
        ahora = Math.max(ahora, p.en)
        await p.fn()
        await asentar()
      }
      ahora = limite
    },
  }
}

// Deja que se resuelvan las promesas encadenadas (cifrado, IndexedDB, cadena del servicio).
export async function asentar(veces = 40) {
  for (let i = 0; i < veces; i++) await new Promise((r) => setImmediate(r))
}

export async function esperarHasta(condicion, { intentos = 400 } = {}) {
  for (let i = 0; i < intentos; i++) {
    if (await condicion()) return
    await new Promise((r) => setImmediate(r))
  }
  throw new Error('La condición no se cumplió a tiempo')
}

export const CONFIG = {
  periodo: '2027',
  documentos: [
    { clave: 'foto', titulo: 'Fotografía reciente tipo cédula', obligatorio: 'siempre', etiqueta_fecha: null, tipos: ['jpg', 'png'], max_mb: 8 },
    { clave: 'rtu', titulo: 'RTU emitido por la SAT (ratificado)', obligatorio: 'siempre', etiqueta_fecha: 'Fecha de ratificación', fecha_min: '2026-10-01', fecha_max_sugerida: '2026-10-31', tipos: ['pdf', 'jpg', 'png'], max_mb: 8 },
    { clave: 'colegiado_activo', titulo: 'Constancia de colegiado activo', obligatorio: 'colegiado', etiqueta_fecha: 'Activo hasta', tipos: ['pdf', 'jpg', 'png'], max_mb: 8 },
  ],
  catalogos: { estado_civil: [], niveles_estudio: [], colegios: [] },
  limites: { max_paginas: 15 },
}

export function documentoNuevo(clave) {
  return {
    clave,
    oculto: false,
    cargado: false,
    tipo: null,
    paginas: 0,
    tamano: 0,
    fecha_documento: null,
    alertas: [],
    revision: { estado: 'PENDIENTE', motivo: null },
    cargado_at: null,
    requerido: true,
    verificacion: null,
  }
}

// Servidor falso. `reglas` permite forzar respuestas: [{ cuando(ruta, metodo), responder() , veces }].
export function crearServidorFalso({ sid = 'sesion-1', expediente: inicial = {} } = {}) {
  const servidor = {
    caido: false, // true → todo fetch falla como una red caída
    sid,
    llamadas: [],
    reglas: [],
    expediente: {
      id: 1,
      estado: 'BORRADOR',
      periodo: '2027',
      version: 1,
      cui: CUI,
      nombre_nomina: NOMBRE_MARCADOR,
      datos: {},
      campos_guardados: [],
      campos_ocultos: [],
      documentos: CONFIG.documentos.map((d) => documentoNuevo(d.clave)),
      observacion_general: null,
      faltantes: [],
      editable: true,
      actualizado_at: '2026-10-06T00:00:00Z',
      enviado_at: null,
      ...inicial,
    },
    idempotencia: new Map(),
    subidas: [],
  }

  const json = (cuerpo, status = 200, cabeceras = {}) =>
    new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json', ...cabeceras } })

  servidor.responder = json

  servidor.fetch = async (url, opciones = {}) => {
    const metodo = (opciones.method || 'GET').toUpperCase()
    const ruta = String(url).split('/expediente189')[1] || ''
    const registro = { metodo, ruta, cabeceras: opciones.headers || {}, cuerpo: opciones.body }
    servidor.llamadas.push(registro)
    if (servidor.caido) throw new TypeError('Failed to fetch')

    const regla = servidor.reglas.find((r) => r.cuando(ruta, metodo, registro))
    if (regla) {
      if (regla.veces !== undefined) {
        regla.veces -= 1
        if (regla.veces <= 0) servidor.reglas.splice(servidor.reglas.indexOf(regla), 1)
      }
      return regla.responder(registro)
    }

    const exp = servidor.expediente
    const autorizado = String(opciones.headers?.Authorization || '').startsWith('Bearer ')
    if (ruta === '/salud') return json({ ok: true })
    if (ruta === '/config') return json(CONFIG)
    if (!autorizado) return json({ detail: 'Sesión inválida', codigo: 'SESION' }, 401)

    if (ruta === '/mi-expediente' && metodo === 'GET') return json(exp)
    if (ruta === '/mi-expediente' && metodo === 'PUT') {
      const cuerpo = JSON.parse(opciones.body)
      if (cuerpo.version !== exp.version) {
        return json({ detail: 'Alguien más modificó este expediente; recargue', codigo: 'VERSION', actual: exp }, 409)
      }
      for (const [k, v] of Object.entries(cuerpo.datos)) {
        if (v === null) delete exp.datos[k]
        else exp.datos[k] = v
      }
      exp.campos_guardados = Object.keys(exp.datos)
      exp.version += 1
      return json(exp)
    }
    const doc = ruta.match(/^\/mi-expediente\/documentos\/([^/?]+)$/)
    if (doc) {
      const clave = decodeURIComponent(doc[1])
      const actual = exp.documentos.find((d) => d.clave === clave)
      if (metodo === 'POST') {
        const idem = opciones.headers?.['X-Idempotency-Key']
        if (idem && servidor.idempotencia.has(idem)) return json(servidor.idempotencia.get(idem))
        const forma = opciones.body
        const archivo = forma.get('archivo')
        const nuevo = {
          ...actual,
          cargado: true,
          oculto: false,
          tipo: archivo.type === 'application/pdf' ? 'pdf' : 'jpg',
          tamano: archivo.size,
          fecha_documento: forma.get('fecha_documento') || null,
          cargado_at: '2026-10-06T12:00:00Z',
          verificacion: { estado: 'EN_PROCESO', metodo: null, fecha: 'NO_LEIDA', identidad: 'NO_LEIDA', tipo: 'NO_LEIDA', fechas_detectadas: [] },
        }
        Object.assign(actual, nuevo)
        servidor.subidas.push({ clave, idem, nombre: archivo.name, tamano: archivo.size })
        if (idem) servidor.idempotencia.set(idem, nuevo)
        exp.version += 1
        return json(nuevo)
      }
      if (metodo === 'PUT') {
        actual.fecha_documento = JSON.parse(opciones.body).fecha_documento
        exp.version += 1
        return json(actual)
      }
      if (metodo === 'DELETE') {
        Object.assign(actual, documentoNuevo(clave))
        exp.version += 1
        return new Response(null, { status: 204 })
      }
    }
    if (ruta === '/mi-expediente/enviar' && metodo === 'POST') {
      exp.estado = 'ENVIADO'
      exp.editable = false
      exp.enviado_at = '2026-10-06T13:00:00Z'
      exp.version += 1
      return json(exp)
    }
    return json({ detail: 'No encontrado', codigo: 'NO_ENCONTRADO' }, 404)
  }

  return servidor
}

// Servicio de prueba completo: servidor falso + IndexedDB falsa + reloj manual.
export function crearEntorno({ servidor = crearServidorFalso(), fabrica = new IDBFactory(), reloj = relojManual(), sid = servidor.sid, conToken = true } = {}) {
  const sesion = { token: conToken ? tokenConSid(sid) : null, anterior: tokenConSid(sid) }
  const servicio = crearServicio({
    transporte: crearTransporte({
      base: 'https://prueba.local/expediente189',
      obtenerToken: () => sesion.token,
      fetchImpl: servidor.fetch,
    }),
    fabricaIdb: fabrica,
    reloj,
    hayToken: () => Boolean(sesion.token),
    obtenerSid: () => sidDeToken(sesion.token || sesion.anterior),
    alSesionVencida: () => {
      sesion.token = null
    },
    entorno: { ventana: null, documento: null },
    aleatorio: () => 0.5,
    uuid: (() => {
      let n = 0
      return () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`
    })(),
  })
  return { servidor, fabrica, reloj, servicio, sesion }
}

export function archivoDePrueba(contenido = 'contenido-del-archivo', nombre = 'foto.jpg', tipo = 'image/jpeg') {
  return new File([contenido], nombre, { type: tipo })
}

// Vuelca TODO lo que hay en las bases IndexedDB falsas: nombres, almacenes, claves y valores.
export async function volcarTodo(fabrica) {
  const salida = []
  const bases = await fabrica.databases()
  for (const { name } of bases) {
    salida.push({ tipo: 'base', valor: name })
    const db = await new Promise((res, rej) => {
      const r = fabrica.open(name)
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
    for (const almacen of Array.from(db.objectStoreNames)) {
      salida.push({ tipo: 'almacen', valor: almacen })
      const tx = db.transaction(almacen, 'readonly')
      const s = tx.objectStore(almacen)
      const [claves, valores] = await Promise.all(
        ['getAllKeys', 'getAll'].map(
          (m) =>
            new Promise((res, rej) => {
              const r = s[m]()
              r.onsuccess = () => res(r.result)
              r.onerror = () => rej(r.error)
            })
        )
      )
      claves.forEach((c) => salida.push({ tipo: 'clave', valor: c }))
      valores.forEach((v) => salida.push({ tipo: 'registro', valor: v }))
    }
    db.close()
  }
  return salida
}

// Representación en bytes de cualquier valor (cadenas, números, objetos, buffers) para buscar texto.
export function aBytes(valor) {
  const trozos = []
  const visitar = (v) => {
    if (v === null || v === undefined) return
    if (v instanceof ArrayBuffer) trozos.push(Buffer.from(v))
    else if (ArrayBuffer.isView(v)) trozos.push(Buffer.from(v.buffer, v.byteOffset, v.byteLength))
    else if (typeof v === 'string') {
      trozos.push(Buffer.from(v, 'utf8'))
      trozos.push(Buffer.from(v, 'utf16le'))
    } else if (typeof v === 'number' || typeof v === 'boolean') trozos.push(Buffer.from(String(v)))
    else if (Array.isArray(v)) v.forEach(visitar)
    else if (typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) {
        visitar(k)
        visitar(x)
      }
    }
  }
  visitar(valor)
  return Buffer.concat(trozos)
}
