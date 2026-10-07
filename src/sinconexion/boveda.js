// Bóveda del dispositivo: IndexedDB cifrada, una por persona.
//
// Nombre de la base: `exp189-<SHA-256(CUI) en hex>` (el CUI en claro no se escribe).
// Almacenes:
//   meta  → esquema, fecha de creación y un valor centinela cifrado (sirve para saber
//           si la llave recibida abre esta bóveda sin tocar los datos).
//   copia → último Expediente y config recibidos del servidor, cifrados.
//   cola  → operaciones pendientes. En claro SOLO: id autoincremental, tipo, `clave`
//           del documento, instante, intentos y estado. Todo lo demás (cuerpo JSON y el
//           archivo ya convertido) va cifrado, cada pieza con su IV aleatorio.
//
// La CryptoKey vive dentro de la clausura de cada bóveda: no se expone ni se serializa.

import {
  cifrar,
  descifrar,
  descifrarTexto,
  sha256Hex,
} from './cripto.js'
import { abrirDb, borrarDb, pedido, transaccion } from './idb.js'

export const ESQUEMA = 1
const TEXTO_CENTINELA = 'exp189-boveda-v1'
const AAD = {
  centinela: 'meta:centinela',
  copia: 'copia:ultima',
  cuerpo: 'cola:cuerpo',
  archivo: 'cola:archivo',
}

const decodificador = new TextDecoder()

export function nombreBoveda(hash) {
  return `exp189-${hash}`
}

// Identificador de la bóveda de una persona: SHA-256 del CUI (solo dígitos).
export async function hashDeCui(cui) {
  return sha256Hex(String(cui ?? '').replace(/\D+/g, ''))
}

function crearEsquema(db) {
  db.createObjectStore('meta')
  db.createObjectStore('copia')
  db.createObjectStore('cola', { keyPath: 'id', autoIncrement: true })
}

function fabricaPorDefecto() {
  return typeof indexedDB !== 'undefined' ? indexedDB : null
}

async function leerMeta(db) {
  return transaccion(db, ['meta'], 'readonly', async (tx) => {
    const almacen = tx.objectStore('meta')
    const [creado, centinela] = await Promise.all([
      pedido(almacen.get('creado')),
      pedido(almacen.get('centinela')),
    ])
    return { creado, centinela }
  })
}

// ¿Existe una bóveda para este hash? No requiere llave. Si solo había una base vacía
// (se abrió y no se llegó a crear), la elimina para no dejar rastro.
export async function existeBoveda({ fabrica = fabricaPorDefecto(), hash }) {
  if (!fabrica || !hash) return false
  let db
  try {
    db = await abrirDb(fabrica, nombreBoveda(hash), ESQUEMA, crearEsquema)
  } catch {
    return false
  }
  try {
    const { creado } = await leerMeta(db)
    if (creado == null) {
      db.close()
      await borrarDb(fabrica, nombreBoveda(hash)).catch(() => {})
      return false
    }
    return true
  } catch {
    return false
  } finally {
    db.close()
  }
}

export async function descartarBoveda({ fabrica = fabricaPorDefecto(), hash }) {
  if (!fabrica || !hash) return
  await borrarDb(fabrica, nombreBoveda(hash)).catch(() => {})
}

// Abre la bóveda con la llave recibida del servidor.
//   { ok:true, boveda, creada }
//   { ok:false, motivo:'sin_boveda' }  no existe y no se pidió crearla
//   { ok:false, motivo:'no_abre' }     existe pero esta llave no la descifra (NO se toca)
//   { ok:false, motivo:'sin_soporte' } el navegador no ofrece IndexedDB o la abrió con error
export async function abrirBoveda({ fabrica = fabricaPorDefecto(), hash, llave, crear = false }) {
  if (!fabrica) return { ok: false, motivo: 'sin_soporte' }
  const nombre = nombreBoveda(hash)
  let db
  let meta
  try {
    db = await abrirDb(fabrica, nombre, ESQUEMA, crearEsquema)
    meta = await leerMeta(db)
  } catch (error) {
    try {
      db?.close()
    } catch {
      // nada que cerrar
    }
    return { ok: false, motivo: 'sin_soporte', error }
  }

  if (meta.creado == null) {
    if (!crear) {
      db.close()
      await borrarDb(fabrica, nombre).catch(() => {})
      return { ok: false, motivo: 'sin_boveda' }
    }
    try {
      const centinela = await cifrar(llave, TEXTO_CENTINELA, AAD.centinela)
      await transaccion(db, ['meta'], 'readwrite', (tx) => {
        const almacen = tx.objectStore('meta')
        almacen.put(ESQUEMA, 'esquema')
        almacen.put(centinela, 'centinela')
        almacen.put(Date.now(), 'creado')
      })
    } catch (error) {
      db.close()
      return { ok: false, motivo: 'sin_soporte', error }
    }
    pedirPersistencia()
    return { ok: true, creada: true, boveda: construirBoveda({ db, llave, hash, fabrica }) }
  }

  try {
    const texto = await descifrarTexto(llave, meta.centinela, AAD.centinela)
    if (texto !== TEXTO_CENTINELA) throw new Error('centinela distinto')
  } catch {
    db.close()
    return { ok: false, motivo: 'no_abre' }
  }
  return { ok: true, creada: false, boveda: construirBoveda({ db, llave, hash, fabrica }) }
}

// Pide al navegador que no borre esta bóveda por falta de espacio. Es solo una petición.
function pedirPersistencia() {
  try {
    const almacenamiento = typeof navigator !== 'undefined' ? navigator.storage : null
    if (almacenamiento && typeof almacenamiento.persist === 'function') {
      Promise.resolve(almacenamiento.persist()).catch(() => {})
    }
  } catch {
    // sin soporte: no pasa nada
  }
}

function construirBoveda({ db, llave: llaveInicial, hash, fabrica }) {
  let llave = llaveInicial
  let cerrada = false

  return {
    tipo: 'idb',
    hash,

    async guardarCopia(copia) {
      const registro = await cifrar(llave, JSON.stringify(copia), AAD.copia)
      await transaccion(db, ['copia'], 'readwrite', (tx) => {
        tx.objectStore('copia').put({ ...registro, instante: Date.now() }, 'ultima')
      })
    },

    async leerCopia() {
      const registro = await transaccion(db, ['copia'], 'readonly', (tx) =>
        pedido(tx.objectStore('copia').get('ultima'))
      )
      if (!registro) return null
      try {
        return JSON.parse(await descifrarTexto(llave, registro, AAD.copia))
      } catch {
        return null
      }
    },

    async borrarCopia() {
      await transaccion(db, ['copia'], 'readwrite', (tx) => {
        tx.objectStore('copia').delete('ultima')
      })
    },

    // Devuelve las operaciones en orden, con el cuerpo ya descifrado. El archivo NO se
    // conserva en memoria: solo su tamaño (se lee aparte con leerArchivo).
    async listarCola() {
      const registros = await transaccion(db, ['cola'], 'readonly', (tx) =>
        pedido(tx.objectStore('cola').getAll())
      )
      registros.sort((a, b) => a.id - b.id)
      return Promise.all(
        registros.map(async (r) => {
          const base = {
            id: r.id,
            tipo: r.tipo,
            clave: r.clave ?? null,
            instante: r.instante,
            intentos: r.intentos || 0,
            estado: r.estado || 'pendiente',
            bytes: r.archivo ? r.archivo.byteLength : 0,
          }
          try {
            const cuerpo = JSON.parse(await descifrarTexto(llave, r, AAD.cuerpo))
            return { ...base, cuerpo }
          } catch {
            return {
              ...base,
              cuerpo: { fallo: { mensaje: 'Este cambio guardado en el dispositivo no se pudo leer.' } },
              estado: 'fallida',
              corrupta: true,
            }
          }
        })
      )
    },

    async leerArchivo(id) {
      const registro = await transaccion(db, ['cola'], 'readonly', (tx) =>
        pedido(tx.objectStore('cola').get(id))
      )
      if (!registro || !registro.archivo) return null
      try {
        return await descifrar(llave, { iv: registro.ivArchivo, cifrado: registro.archivo }, AAD.archivo)
      } catch {
        return null
      }
    },

    // op: { tipo, clave?, cuerpo, archivo? (Uint8Array) } → id asignado.
    async agregar({ tipo, clave = null, cuerpo, archivo = null }) {
      const encabezado = await cifrar(llave, JSON.stringify(cuerpo), AAD.cuerpo)
      const registro = {
        tipo,
        clave,
        instante: Date.now(),
        intentos: 0,
        estado: 'pendiente',
        iv: encabezado.iv,
        cifrado: encabezado.cifrado,
      }
      if (archivo) {
        const adjunto = await cifrar(llave, archivo, AAD.archivo)
        registro.ivArchivo = adjunto.iv
        registro.archivo = adjunto.cifrado
      }
      return transaccion(db, ['cola'], 'readwrite', (tx) => pedido(tx.objectStore('cola').add(registro)))
    },

    // cambios: { cuerpo?, intentos?, estado? }. Un cuerpo nuevo lleva un IV nuevo.
    async actualizar(id, cambios) {
      const actual = await transaccion(db, ['cola'], 'readonly', (tx) =>
        pedido(tx.objectStore('cola').get(id))
      )
      if (!actual) return false
      const nuevo = { ...actual }
      if (cambios.intentos !== undefined) nuevo.intentos = cambios.intentos
      if (cambios.estado !== undefined) nuevo.estado = cambios.estado
      if (cambios.cuerpo !== undefined) {
        const encabezado = await cifrar(llave, JSON.stringify(cambios.cuerpo), AAD.cuerpo)
        nuevo.iv = encabezado.iv
        nuevo.cifrado = encabezado.cifrado
      }
      await transaccion(db, ['cola'], 'readwrite', (tx) => {
        tx.objectStore('cola').put(nuevo)
      })
      return true
    },

    async quitar(id) {
      await transaccion(db, ['cola'], 'readwrite', (tx) => {
        tx.objectStore('cola').delete(id)
      })
    },

    // Vuelve a cifrar TODO el contenido con otra llave, en una sola transacción: si algo
    // falla no se cambia nada. Solo se usa si el servidor entregara una llave distinta
    // para la misma persona mientras hay cambios sin enviar.
    async recifrarCon(llaveNueva) {
      const [copiaRegistro, colaRegistros] = await transaccion(db, ['copia', 'cola'], 'readonly', async (tx) =>
        Promise.all([pedido(tx.objectStore('copia').get('ultima')), pedido(tx.objectStore('cola').getAll())])
      )
      const copiaNueva = copiaRegistro
        ? { ...(await cifrar(llaveNueva, await descifrar(llave, copiaRegistro, AAD.copia), AAD.copia)), instante: copiaRegistro.instante }
        : null
      const colaNueva = await Promise.all(
        colaRegistros.map(async (r) => {
          const cuerpo = await cifrar(llaveNueva, await descifrar(llave, r, AAD.cuerpo), AAD.cuerpo)
          const nuevo = { ...r, iv: cuerpo.iv, cifrado: cuerpo.cifrado }
          if (r.archivo) {
            const adjunto = await cifrar(
              llaveNueva,
              await descifrar(llave, { iv: r.ivArchivo, cifrado: r.archivo }, AAD.archivo),
              AAD.archivo
            )
            nuevo.ivArchivo = adjunto.iv
            nuevo.archivo = adjunto.cifrado
          }
          return nuevo
        })
      )
      const centinela = await cifrar(llaveNueva, TEXTO_CENTINELA, AAD.centinela)
      await transaccion(db, ['meta', 'copia', 'cola'], 'readwrite', (tx) => {
        tx.objectStore('meta').put(centinela, 'centinela')
        if (copiaNueva) tx.objectStore('copia').put(copiaNueva, 'ultima')
        const cola = tx.objectStore('cola')
        for (const registro of colaNueva) cola.put(registro)
      })
      llave = llaveNueva
    },

    cerrar() {
      if (cerrada) return
      cerrada = true
      db.close()
    },

    // Borra la bóveda completa (copia, cola y meta) del dispositivo.
    async eliminar() {
      this.cerrar()
      await borrarDb(fabrica, nombreBoveda(hash)).catch(() => {})
    },
  }
}

// ---------------------------------------------------------------------------
// Bóveda en memoria: mismo contrato, sin cifrado y sin tocar el disco. Se usa cuando el
// navegador no permite IndexedDB (modo privado, contexto no seguro): la cola funciona
// mientras la pestaña siga abierta, pero no sobrevive a cerrarla.
// ---------------------------------------------------------------------------
export function crearBovedaMemoria() {
  let copia = null
  let siguiente = 1
  const registros = new Map()

  return {
    tipo: 'memoria',
    hash: null,
    async guardarCopia(valor) {
      copia = JSON.parse(JSON.stringify(valor))
    },
    async leerCopia() {
      return copia ? JSON.parse(JSON.stringify(copia)) : null
    },
    async borrarCopia() {
      copia = null
    },
    async listarCola() {
      return [...registros.values()]
        .sort((a, b) => a.id - b.id)
        .map((r) => ({
          id: r.id,
          tipo: r.tipo,
          clave: r.clave,
          instante: r.instante,
          intentos: r.intentos,
          estado: r.estado,
          bytes: r.archivo ? r.archivo.byteLength : 0,
          cuerpo: JSON.parse(JSON.stringify(r.cuerpo)),
        }))
    },
    async leerArchivo(id) {
      const r = registros.get(id)
      return r?.archivo ? new Uint8Array(r.archivo) : null
    },
    async agregar({ tipo, clave = null, cuerpo, archivo = null }) {
      const id = siguiente++
      registros.set(id, {
        id,
        tipo,
        clave,
        instante: Date.now(),
        intentos: 0,
        estado: 'pendiente',
        cuerpo: JSON.parse(JSON.stringify(cuerpo)),
        archivo: archivo ? new Uint8Array(archivo) : null,
      })
      return id
    },
    async actualizar(id, cambios) {
      const r = registros.get(id)
      if (!r) return false
      if (cambios.intentos !== undefined) r.intentos = cambios.intentos
      if (cambios.estado !== undefined) r.estado = cambios.estado
      if (cambios.cuerpo !== undefined) r.cuerpo = JSON.parse(JSON.stringify(cambios.cuerpo))
      return true
    },
    async quitar(id) {
      registros.delete(id)
    },
    async recifrarCon() {},
    cerrar() {},
    async eliminar() {
      registros.clear()
      copia = null
    },
  }
}
