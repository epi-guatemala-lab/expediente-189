// Servicio sin conexión: une la bóveda cifrada, la cola de operaciones y el motor de
// sincronización, y ofrece a la interfaz una vista optimista que se puede suscribir.
//
// Garantías:
//  - Toda escritura de la persona se cifra y se guarda PRIMERO en el dispositivo y
//    después se intenta enviar. La pantalla refleja el cambio de inmediato.
//  - La llave de la bóveda llega del servidor al entrar; vive solo en memoria (como
//    CryptoKey no extraíble). Sin ella la bóveda no se abre.
//  - La copia del expediente va atada al `sid` de la sesión: al abrir, la de otra
//    sesión se borra. La cola sobrevive entre sesiones (para no perder lo escrito) y
//    se envía al volver a entrar, pero lo de sesiones anteriores no se muestra.

import {
  abrirBoveda,
  crearBovedaMemoria,
  descartarBoveda as borrarBovedaDe,
  existeBoveda,
  hashDeCui,
} from './boveda.js'
import { TIPOS, TOPE_BYTES, bytesEnCola, hayBloqueadas, planEncolar, siguienteOperacion } from './cola.js'
import { disponible as criptoDisponible, importarLlave } from './cripto.js'
import { completarGrupos } from '../lib/pasos.js'
import { crearMotor } from './motor.js'
import {
  aplicarPendientes,
  calcularFaltantes,
  diffDatos,
  documentoVacio,
  esNoEditable,
} from './optimista.js'

const INTERVALO_VERIFICACION_MS = 5_000
const MAX_SONDEOS_VERIFICACION = 24 // 2 minutos a 5 s

export function relojReal() {
  return {
    ahora: () => Date.now(),
    programar: (fn, ms) => setTimeout(fn, ms),
    cancelar: (id) => clearTimeout(id),
  }
}

export function crearServicio({
  transporte,
  fabricaIdb = typeof indexedDB !== 'undefined' ? indexedDB : null,
  reloj = relojReal(),
  uuid = () => globalThis.crypto.randomUUID(),
  hayToken = () => true,
  obtenerSid = () => null,
  alSesionVencida = () => {},
  entorno = {},
  aleatorio = Math.random,
  topeBytes = TOPE_BYTES,
}) {
  // --- estado ---------------------------------------------------------------
  let abierto = false
  let bloqueado = false // la bóveda existe pero esta llave no la abre
  let llave = null
  let llaveTexto = null
  let hash = null
  let cui = null
  let sidSesion = null
  let boveda = null
  let almacenamiento = 'ninguno' // 'idb' | 'memoria' | 'ninguno'
  let copia = null // { expediente, config }
  let cola = []
  const enVuelo = new Set()
  let copiaVieja = false
  let usandoCopia = false
  let cadena = Promise.resolve()
  let vista = null
  const oyentes = new Set()
  const avisos = { almacenamiento: false, almacenamientoVisto: false, ocultosDescartado: false }
  let sondeosVerificacion = 0
  let temporizadorVerificacion = null

  // Todo cambio de la cola/copia se serializa: nunca dos a la vez.
  function enCadena(fn) {
    const siguiente = cadena.then(fn)
    cadena = siguiente.catch(() => {})
    return siguiente
  }

  // --- vista ----------------------------------------------------------------
  const deEstaSesion = (op) => (op.cuerpo?.sid ?? null) === (sidSesion ?? null)

  function construirVista() {
    const m = motor.estado
    const expediente = copia
      ? aplicarPendientes(copia.expediente, cola, copia.config, { sid: sidSesion })
      : null
    const pendientes = cola.filter((op) => op.estado === 'pendiente')
    const fallidas = cola
      .filter((op) => op.estado === 'fallida')
      .map((op) => ({
        id: op.id,
        tipo: op.tipo,
        clave: op.clave,
        anterior: !deEstaSesion(op),
        mensaje: op.cuerpo?.fallo?.mensaje || 'No se pudo enviar.',
        errores: op.cuerpo?.fallo?.errores || null,
      }))
    let indicador = 'servidor'
    if (pendientes.length > 0) {
      indicador = (m.sincronizando && m.conexion === 'ok') || m.ocupado ? 'guardando' : 'dispositivo'
    }
    const tieneOcultos = Boolean(
      expediente &&
        ((expediente.campos_ocultos || []).length > 0 ||
          (expediente.documentos || []).some((d) => d.oculto && d.cargado))
    )
    return {
      abierta: abierto && !bloqueado,
      bloqueada: bloqueado,
      cui: cui || copia?.expediente?.cui || null,
      expediente,
      config: copia?.config || null,
      pendientes: pendientes.length,
      pendientesAnteriores: pendientes.filter((op) => !deEstaSesion(op)).length,
      fallidas,
      indicador,
      ocupado: m.ocupado,
      sincronizando: m.sincronizando,
      conexion: m.conexion,
      sinServidor: usandoCopia,
      necesitaReingreso: abierto && !bloqueado && m.sesion !== 'ok',
      proximoIntentoMs: m.proximoIntentoMs,
      almacenamiento,
      avisoAlmacenamiento: avisos.almacenamiento,
      avisoOcultos: !avisos.ocultosDescartado && tieneOcultos,
      envioPendiente: Boolean(expediente?.envioPendiente),
    }
  }

  function emitir() {
    vista = construirVista()
    for (const oyente of oyentes) oyente()
  }

  // --- bóveda ---------------------------------------------------------------
  function pasarAMemoria() {
    boveda = crearBovedaMemoria()
    almacenamiento = 'memoria'
  }

  // La bóveda se crea cuando hay algo que proteger (primer dato editable o primera operación).
  async function asegurarBovedaInterno() {
    if (boveda) return
    if (!llave) {
      pasarAMemoria()
      return
    }
    const r = await abrirBoveda({ fabrica: fabricaIdb, hash, llave, crear: true })
    if (r.ok) {
      boveda = r.boveda
      almacenamiento = 'idb'
    } else {
      pasarAMemoria()
    }
  }

  async function persistirCopiaInterno() {
    if (!copia) return
    try {
      if (esNoEditable(copia.expediente)) {
        // Enviado o aprobado: no queda nada que proteger; la copia no se conserva.
        if (boveda) await boveda.borrarCopia()
        return
      }
      await asegurarBovedaInterno()
      await boveda.guardarCopia({ sid: sidSesion, expediente: copia.expediente, config: copia.config })
    } catch {
      // la copia es una comodidad: si no se puede guardar, la cola sigue siendo segura
    }
  }

  // Sin cola y con el expediente ya enviado: se borra la bóveda completa del dispositivo.
  async function limpiezaInterno() {
    if (boveda && cola.length === 0 && copia && esNoEditable(copia.expediente)) {
      const b = boveda
      boveda = null
      await b.eliminar().catch(() => {})
    }
  }

  async function cargarDeBoveda() {
    cola = await boveda.listarCola()
    const guardada = await boveda.leerCopia()
    if (guardada) {
      if ((guardada.sid ?? null) === (sidSesion ?? null)) {
        copia = { expediente: guardada.expediente, config: guardada.config }
        copiaVieja = true
        usandoCopia = true
      } else {
        // Copia de otra sesión: se borra, nunca se muestra.
        await boveda.borrarCopia().catch(() => {})
        copia = null
      }
    }
  }

  async function liberar() {
    motor.detener()
    cancelarVerificacion()
    try {
      boveda?.cerrar()
    } catch {
      // ya cerrada
    }
    abierto = false
    bloqueado = false
    llave = null
    llaveTexto = null
    hash = null
    cui = null
    sidSesion = null
    boveda = null
    almacenamiento = 'ninguno'
    copia = null
    cola = []
    enVuelo.clear()
    copiaVieja = false
    usandoCopia = false
    avisos.almacenamiento = false
    avisos.almacenamientoVisto = false
    avisos.ocultosDescartado = false
  }

  async function abrirInterno() {
    llave = null
    if (criptoDisponible()) {
      try {
        llave = await importarLlave(llaveTexto)
      } catch {
        llave = null
      }
    }
    if (!llave) {
      pasarAMemoria()
    } else {
      const r = await abrirBoveda({ fabrica: fabricaIdb, hash, llave, crear: false })
      if (r.ok) {
        boveda = r.boveda
        almacenamiento = 'idb'
        await cargarDeBoveda()
      } else if (r.motivo === 'sin_boveda') {
        almacenamiento = 'idb'
      } else if (r.motivo === 'no_abre') {
        bloqueado = true
        emitir()
        return { ok: false, motivo: 'no_abre' }
      } else {
        pasarAMemoria()
      }
    }
    motor.iniciar(entorno)
    emitir()
    return { ok: true, pendientes: cola.filter((op) => op.estado === 'pendiente').length }
  }

  // --- verificación automática de documentos (cada 5 s, máximo 2 min) -----------
  function cancelarVerificacion() {
    if (temporizadorVerificacion !== null) {
      reloj.cancelar(temporizadorVerificacion)
      temporizadorVerificacion = null
    }
  }

  function programarVerificacion() {
    cancelarVerificacion()
    if (!abierto) return
    const enProceso = (copia?.expediente?.documentos || []).some((d) => d.verificacion?.estado === 'EN_PROCESO')
    if (!enProceso) {
      sondeosVerificacion = 0
      return
    }
    if (sondeosVerificacion >= MAX_SONDEOS_VERIFICACION) return
    temporizadorVerificacion = reloj.programar(async () => {
      temporizadorVerificacion = null
      if (!abierto) return
      const m = motor.estado
      const hayPendientes = cola.some((op) => op.estado === 'pendiente')
      if (m.conexion !== 'ok' || m.sesion !== 'ok' || hayPendientes || !hayToken()) {
        programarVerificacion() // sin conexión: se espera sin gastar la ventana de 2 minutos
        return
      }
      sondeosVerificacion += 1
      const r = await motor.refrescar()
      if (r.resultado === 'sesion') {
        alSesionVencida()
        motor.marcarSesionVencida()
      }
      programarVerificacion()
    }, INTERVALO_VERIFICACION_MS)
  }

  // --- API para el motor ----------------------------------------------------
  const api = {
    alCambiar: emitir,
    hayToken: () => hayToken(),
    alSesionVencida: () => alSesionVencida(),
    tomarSiguiente: () =>
      enCadena(() => {
        const op = siguienteOperacion(cola, enVuelo)
        if (op) enVuelo.add(op.id)
        return op
      }),
    soltar: (op) => {
      enVuelo.delete(op.id)
    },
    leerArchivo: async (op) => (boveda ? boveda.leerArchivo(op.id) : null),
    version: () => copia?.expediente?.version ?? null,
    tieneConfig: () => Boolean(copia?.config),
    // Sin copia (o con una copia sin confirmar) hay que pedir el expediente antes de escribir:
    // el PUT necesita su `version`.
    copiaVieja: () => copiaVieja || !copia,
    hayBloqueadas: () => hayBloqueadas(cola),

    aplicarServidor: (expediente, config = null) =>
      enCadena(async () => {
        if (!abierto) return
        copia = { expediente, config: config ?? copia?.config ?? null }
        copiaVieja = false
        usandoCopia = false
        await persistirCopiaInterno()
        await limpiezaInterno()
        emitir()
        programarVerificacion()
      }),

    completar: (op, respuesta) =>
      enCadena(async () => {
        if (!abierto) return
        if (copia && respuesta && typeof respuesta === 'object') {
          if (op.tipo === TIPOS.GUARDAR || op.tipo === TIPOS.ENVIAR) {
            copia = { ...copia, expediente: respuesta }
            copiaVieja = false
            usandoCopia = false
          } else if (op.tipo === TIPOS.SUBIR || op.tipo === TIPOS.FECHA) {
            copia = { ...copia, expediente: conDocumento(copia, respuesta) }
            copiaVieja = true
            if (op.tipo === TIPOS.SUBIR) sondeosVerificacion = 0
          }
        }
        if (copia && op.tipo === TIPOS.QUITAR) {
          copia = { ...copia, expediente: conDocumento(copia, { ...documentoVacio(op.clave) }) }
          copiaVieja = true
        }
        // Primero se quita la operación y después se guarda la copia: si el proceso se
        // corta entre ambos pasos no se pierde nada (la copia se refresca sola).
        await boveda?.quitar(op.id)
        cola = cola.filter((o) => o.id !== op.id)
        await persistirCopiaInterno()
        await limpiezaInterno()
        emitir()
        programarVerificacion()
      }),

    fallar: (op, fallo) =>
      enCadena(async () => {
        if (!abierto) return
        const cuerpo = { ...op.cuerpo, fallo: { mensaje: fallo.mensaje, status: fallo.status ?? null, errores: fallo.errores ?? null } }
        await boveda?.actualizar(op.id, { estado: 'fallida', cuerpo })
        cola = cola.map((o) => (o.id === op.id ? { ...o, estado: 'fallida', cuerpo } : o))
        emitir()
      }),

    contarIntentoServidor: (op) =>
      enCadena(async () => {
        const actual = cola.find((o) => o.id === op.id)
        const intentos = (actual?.intentos || 0) + 1
        await boveda?.actualizar(op.id, { intentos })
        cola = cola.map((o) => (o.id === op.id ? { ...o, intentos } : o))
        return intentos
      }),
  }

  function conDocumento(c, documento) {
    const docs = [...(c.expediente.documentos || [])]
    const i = docs.findIndex((d) => d.clave === documento.clave)
    if (i >= 0) docs[i] = { ...docs[i], ...documento }
    else docs.push(documento)
    const expediente = { ...c.expediente, documentos: docs }
    expediente.faltantes = calcularFaltantes(expediente.datos || {}, docs, c.config || {}, {
      cui: expediente.cui,
      ocultos: expediente.campos_ocultos || [],
    })
    return expediente
  }

  const motor = crearMotor({ transporte, api, reloj, aleatorio })
  vista = construirVista()

  // --- encolar --------------------------------------------------------------
  async function aplicarPlanInterno(plan) {
    for (const cambio of plan.actualizar) {
      await boveda.actualizar(cambio.id, { cuerpo: cambio.cuerpo })
      cola = cola.map((op) => (op.id === cambio.id ? { ...op, cuerpo: cambio.cuerpo } : op))
    }
    if (plan.agregar) {
      const { tipo, clave = null, cuerpo, archivo = null } = plan.agregar
      const id = await boveda.agregar({ tipo, clave, cuerpo, archivo })
      cola = [
        ...cola,
        {
          id,
          tipo,
          clave,
          instante: Date.now(),
          intentos: 0,
          estado: 'pendiente',
          cuerpo,
          bytes: archivo ? archivo.byteLength : 0,
        },
      ]
    }
    for (const id of plan.quitar) {
      await boveda.quitar(id)
      cola = cola.filter((op) => op.id !== id)
    }
  }

  function baseTieneDoc(clave) {
    return Boolean((copia?.expediente?.documentos || []).find((d) => d.clave === clave)?.cargado)
  }

  function expedienteOptimista() {
    return copia ? aplicarPendientes(copia.expediente, cola, copia.config, { sid: sidSesion }) : null
  }

  // Encola (o funde) una operación. Devuelve { ok, ... }; nunca lanza hacia la interfaz.
  async function encolar(nueva) {
    if (!abierto || bloqueado) return { ok: false, motivo: 'cerrado' }
    try {
      await asegurarBovedaInterno()
      const plan = planEncolar(cola, nueva, { enVuelo, baseTieneDoc })
      if (plan.agregar?.archivo) {
        const liberado = cola.filter((op) => plan.quitar.includes(op.id)).reduce((s, op) => s + (op.bytes || 0), 0)
        if (bytesEnCola(cola) - liberado + plan.agregar.archivo.byteLength > topeBytes) {
          return { ok: false, motivo: 'tope' }
        }
      }
      await aplicarPlanInterno(plan)
      if (almacenamiento === 'memoria' && !avisos.almacenamientoVisto) {
        avisos.almacenamiento = true
        avisos.almacenamientoVisto = true
      }
      emitir()
      return { ok: true, encolado: Boolean(plan.agregar) || plan.fusionado || plan.actualizar.length > 0 }
    } catch (error) {
      return { ok: false, motivo: 'almacenamiento', error }
    }
  }

  function alEncolar(resultado) {
    if (resultado.ok) motor.alEncolar()
    return resultado
  }

  // --- API pública ----------------------------------------------------------
  return {
    suscribir(oyente) {
      oyentes.add(oyente)
      return () => oyentes.delete(oyente)
    },
    obtenerVista: () => vista,
    obtenerCola: () => cola.map((op) => ({ ...op })),
    llaveActual: () => llaveTexto,

    async existeBovedaDe(cuiTexto) {
      return existeBoveda({ fabrica: fabricaIdb, hash: await hashDeCui(cuiTexto) })
    },

    // Tras un POST /acceso exitoso. { ok } | { ok:false, motivo:'no_abre' }
    iniciarSesion({ cui: cuiTexto, llaveBoveda }) {
      return enCadena(async () => {
        await liberar()
        abierto = true
        cui = String(cuiTexto ?? '').replace(/\D+/g, '') || null
        hash = await hashDeCui(cuiTexto)
        sidSesion = obtenerSid()
        llaveTexto = llaveBoveda
        return abrirInterno()
      })
    },

    // Al recargar la pestaña con la sesión abierta (token y llave en sessionStorage).
    reanudarSesion({ idBoveda, llaveBoveda }) {
      return enCadena(async () => {
        await liberar()
        abierto = true
        hash = idBoveda
        sidSesion = obtenerSid()
        llaveTexto = llaveBoveda
        return abrirInterno()
      })
    },

    // Bóveda ajena o dañada que no se pudo abrir: solo se borra si la persona lo decide.
    descartarBovedaIlegible() {
      return enCadena(async () => {
        if (!abierto || !hash) return { ok: false }
        await borrarBovedaDe({ fabrica: fabricaIdb, hash })
        bloqueado = false
        cola = []
        copia = null
        return abrirInterno()
      })
    },

    // Guarda la respuesta del servidor como copia vigente.
    registrarCopia(expediente, config = null) {
      return api.aplicarServidor(expediente, config)
    },

    // Pide el expediente al servidor. { resultado:'ok'|'red'|'sesion'|'otro', mensaje? }
    async refrescar() {
      const r = await motor.refrescar()
      if (r.resultado === 'sesion') {
        alSesionVencida()
        motor.marcarSesionVencida()
      }
      if (r.resultado === 'red') motor.despertar()
      return r
    },

    // Envía lo pendiente y espera a que termine el primer intento (no a que haya red).
    // Devuelve 'vacia' | 'bloqueada' | 'red' | 'ocupado' | 'sesion' | 'detenido'.
    drenarYEsperar() {
      return motor.despertar()
    },

    marcarSesionVencida() {
      alSesionVencida()
      motor.marcarSesionVencida()
    },

    // Se volvió a entrar (token nuevo ya guardado). Si la sesión cambió, la copia se borra.
    renovarSesion({ llaveBoveda = null } = {}) {
      return enCadena(async () => {
        const sidNuevo = obtenerSid()
        const cambioSid = (sidNuevo ?? null) !== (sidSesion ?? null)
        sidSesion = sidNuevo
        if (cambioSid) {
          try {
            await boveda?.borrarCopia()
          } catch {
            // nada
          }
          copia = null
        }
        copiaVieja = true
        // La llave de la persona debería ser siempre la misma; si cambiara, lo guardado se
        // vuelve a cifrar con la nueva en lugar de quedar ilegible.
        if (llaveBoveda && llave && llaveBoveda !== llaveTexto) {
          try {
            const nueva = await importarLlave(llaveBoveda)
            if (boveda) await boveda.recifrarCon(nueva)
            llave = nueva
            llaveTexto = llaveBoveda
          } catch {
            // se conserva la llave anterior: lo guardado sigue abriéndose
          }
        }
        emitir()
        motor.reanudar()
        return { cambioSid, llaveTexto }
      })
    },

    despertar() {
      return motor.despertar()
    },

    // --- escrituras de la persona ---
    // payload: campos del paso ya normalizados. Solo se encola lo que cambió.
    guardarDatos(payload) {
      return enCadena(async () => {
        const base = expedienteOptimista()
        if (!base) return { ok: false, motivo: 'cerrado' }
        if (esNoEditable(base)) return { ok: false, motivo: 'no_editable' }
        // Solo lo que cambió; si cambió un campo de un grupo (departamento/municipio,
        // colegiatura), viaja el grupo completo porque el servidor los valida juntos.
        const cambios = completarGrupos(diffDatos(base.datos, payload), payload)
        if (Object.keys(cambios).length === 0) return { ok: true, encolado: false }
        return alEncolar(await encolar({ tipo: TIPOS.GUARDAR, cuerpo: { datos: cambios, sid: sidSesion } }))
      })
    },

    // archivo: File/Blob ya preparado (imágenes reescaladas a JPEG). fecha: AAAA-MM-DD|null
    async subirDocumento(clave, archivo, fecha) {
      let bytes
      try {
        bytes = new Uint8Array(await archivo.arrayBuffer())
      } catch (error) {
        return { ok: false, motivo: 'archivo', error }
      }
      return enCadena(async () => {
        const esPdf = archivo.type === 'application/pdf'
        const cuerpo = {
          nombre: archivo.name || 'documento',
          mime: archivo.type || (esPdf ? 'application/pdf' : 'image/jpeg'),
          tipo: esPdf ? 'pdf' : 'jpg',
          tamano: bytes.byteLength,
          fecha: fecha || null,
          idem: uuid(),
          sid: sidSesion,
        }
        return alEncolar(await encolar({ tipo: TIPOS.SUBIR, clave, cuerpo, archivo: bytes }))
      })
    },

    corregirFecha(clave, fecha) {
      return enCadena(async () => {
        const doc = (expedienteOptimista()?.documentos || []).find((d) => d.clave === clave)
        if (doc?.oculto) return { ok: false, motivo: 'oculto' }
        return alEncolar(await encolar({ tipo: TIPOS.FECHA, clave, cuerpo: { fecha, sid: sidSesion } }))
      })
    },

    quitarDocumento(clave) {
      return enCadena(async () =>
        alEncolar(await encolar({ tipo: TIPOS.QUITAR, clave, cuerpo: { sid: sidSesion } }))
      )
    },

    enviarExpediente() {
      return enCadena(async () => {
        const base = expedienteOptimista()
        if (!base) return { ok: false, motivo: 'cerrado' }
        if (esNoEditable(base)) return { ok: false, motivo: 'no_editable' }
        return alEncolar(await encolar({ tipo: TIPOS.ENVIAR, cuerpo: { sid: sidSesion } }))
      })
    },

    // Una fallida vuelve a la cola (una subida lleva llave de idempotencia nueva).
    reintentar(id) {
      return enCadena(async () => {
        const op = cola.find((o) => o.id === id && o.estado === 'fallida')
        if (!op || !boveda) return
        const cuerpo = { ...op.cuerpo }
        delete cuerpo.fallo
        if (op.tipo === TIPOS.SUBIR) cuerpo.idem = uuid()
        await boveda.actualizar(id, { estado: 'pendiente', intentos: 0, cuerpo })
        cola = cola.map((o) => (o.id === id ? { ...o, estado: 'pendiente', intentos: 0, cuerpo } : o))
        emitir()
        motor.despertar()
      })
    },

    // Descartar es siempre una decisión explícita de la persona.
    descartar(id) {
      return enCadena(async () => {
        if (!cola.some((o) => o.id === id)) return
        await boveda?.quitar(id)
        cola = cola.filter((o) => o.id !== id)
        await limpiezaInterno()
        emitir()
        motor.despertar()
      })
    },

    // Miniatura local: solo de lo encolado en ESTA sesión.
    async vistaLocal(clave) {
      const op = [...cola]
        .reverse()
        .find((o) => o.tipo === TIPOS.SUBIR && o.clave === clave && o.estado === 'pendiente' && deEstaSesion(o))
      if (!op || !boveda) return null
      const bytes = await boveda.leerArchivo(op.id)
      if (!bytes) return null
      return { blob: new Blob([bytes], { type: op.cuerpo.mime }), tipo: op.cuerpo.tipo, nombre: op.cuerpo.nombre }
    },

    descartarAviso(cual) {
      if (cual === 'almacenamiento') avisos.almacenamiento = false
      if (cual === 'ocultos') avisos.ocultosDescartado = true
      emitir()
    },

    // «Salir»: se olvida la llave y la copia; la cola se conserva cifrada solo si hay
    // pendientes. Con `borrarTodo` (Salir y borrar de este dispositivo) se elimina todo.
    // Devuelve { conservadas } con la cantidad de cambios que quedaron en el dispositivo.
    cerrar({ borrarTodo = false } = {}) {
      return enCadena(async () => {
        motor.detener()
        cancelarVerificacion()
        let conservadas = 0
        try {
          if (boveda) {
            if (borrarTodo) {
              await boveda.eliminar()
            } else {
              await boveda.borrarCopia().catch(() => {})
              if (cola.length === 0) {
                await boveda.eliminar()
              } else {
                conservadas = boveda.tipo === 'idb' ? cola.length : 0
                boveda.cerrar()
              }
            }
          } else if (borrarTodo && hash) {
            await borrarBovedaDe({ fabrica: fabricaIdb, hash })
          }
        } finally {
          boveda = null
          await liberar()
          emitir()
        }
        return { conservadas }
      })
    },
  }
}
