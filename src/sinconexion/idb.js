// Envoltorio mínimo de IndexedDB con promesas.
// Regla de oro: dentro de una transacción solo se pide a IndexedDB; el cifrado (que es
// asíncrono) se hace ANTES de abrirla, porque una transacción se cierra sola al quedar ociosa.

export function pedido(solicitud) {
  return new Promise((resolver, rechazar) => {
    solicitud.onsuccess = () => resolver(solicitud.result)
    solicitud.onerror = () => rechazar(solicitud.error)
  })
}

export function abrirDb(fabrica, nombre, version, crearEsquema) {
  return new Promise((resolver, rechazar) => {
    let solicitud
    try {
      solicitud = fabrica.open(nombre, version)
    } catch (error) {
      rechazar(error)
      return
    }
    solicitud.onupgradeneeded = () => crearEsquema(solicitud.result)
    solicitud.onsuccess = () => {
      const db = solicitud.result
      // Si otra pestaña (o la persona) borra la bóveda, esta conexión se cierra y no la bloquea.
      db.onversionchange = () => db.close()
      resolver(db)
    }
    solicitud.onerror = () => rechazar(solicitud.error)
    solicitud.onblocked = () => rechazar(new Error('La base de datos está bloqueada por otra pestaña'))
  })
}

// Ejecuta `fn(tx)` y resuelve con su resultado cuando la transacción termina de verdad.
export function transaccion(db, almacenes, modo, fn) {
  return new Promise((resolver, rechazar) => {
    let resultado
    let tx
    try {
      tx = db.transaction(almacenes, modo)
    } catch (error) {
      rechazar(error)
      return
    }
    tx.oncomplete = () => resolver(resultado)
    tx.onerror = () => rechazar(tx.error)
    tx.onabort = () => rechazar(tx.error || new Error('Transacción cancelada'))
    Promise.resolve()
      .then(() => fn(tx))
      .then(
        (valor) => {
          resultado = valor
        },
        (error) => {
          try {
            tx.abort()
          } catch {
            // ya estaba cerrada
          }
          rechazar(error)
        }
      )
  })
}

// Borra la base de datos. Si otra conexión la mantiene abierta, el borrado queda
// pendiente y termina solo cuando esa conexión se cierre; no se espera.
export function borrarDb(fabrica, nombre) {
  return new Promise((resolver, rechazar) => {
    let solicitud
    try {
      solicitud = fabrica.deleteDatabase(nombre)
    } catch (error) {
      rechazar(error)
      return
    }
    solicitud.onsuccess = () => resolver(true)
    solicitud.onerror = () => rechazar(solicitud.error)
    solicitud.onblocked = () => resolver(false)
  })
}
