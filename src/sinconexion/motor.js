// Motor de sincronización: vacía la cola de a una operación, en orden.
//
// Se despierta al entrar, con el evento `online`, al volver a la pestaña y con reintentos
// de espera creciente (2 s → 60 s con variación aleatoria). Si falla la red, sondea
// GET /salud en lugar de repetir a ciegas la operación (que puede ser una subida pesada).
//
// El motor no conoce IndexedDB ni React: habla con el servicio mediante `api`.

import { clasificarRespuesta, MAX_INTENTOS_SERVIDOR } from './clasificar.js'
import { TIPOS } from './cola.js'

export const ESPERA_MINIMA_MS = 2_000
export const ESPERA_MAXIMA_MS = 60_000

// n = 0, 1, 2… → ~2 s, 4 s, 8 s, 16 s, 32 s, 60 s (con ±25 % de variación).
export function esperaReintento(n, aleatorio = Math.random) {
  const base = Math.min(ESPERA_MAXIMA_MS, ESPERA_MINIMA_MS * 2 ** Math.max(0, n))
  return Math.min(ESPERA_MAXIMA_MS, Math.round(base * (0.75 + aleatorio() * 0.5)))
}

const MSJ_ARCHIVO_ILEGIBLE = 'El archivo guardado en este dispositivo no se pudo leer. Vuelva a seleccionarlo.'

export function crearMotor({ transporte, api, reloj, aleatorio = Math.random }) {
  const estado = {
    sincronizando: false,
    conexion: 'ok', // 'ok' | 'caida'
    sesion: 'ok', // 'ok' | 'vencida' | 'sin_token'
    ocupado: null, // null | 'SUBIR' | 'otro': el servidor pidió esperar (hay mucha demanda)
    proximoIntentoMs: null,
  }
  let promesa = null
  let otraVuelta = false
  let intentosRed = 0
  let intentosOcupado = 0
  let esperaOcupado = null
  let temporizador = null
  let activo = false
  let quitarEscuchas = []

  const cambiar = (parcial) => {
    Object.assign(estado, parcial)
    api.alCambiar()
  }

  // -------------------------------------------------------------------------
  // Temporizador de reintento / sondeo
  // -------------------------------------------------------------------------

  function cancelarTemporizador() {
    if (temporizador !== null) {
      reloj.cancelar(temporizador)
      temporizador = null
      estado.proximoIntentoMs = null
    }
  }

  function programar(espera, accion) {
    cancelarTemporizador()
    if (!activo) return
    estado.proximoIntentoMs = reloj.ahora() + espera
    temporizador = reloj.programar(accion, espera)
    api.alCambiar()
  }

  function programarSondeo() {
    // intentosRed cuenta las fallas seguidas: la primera espera es la mínima (2 s).
    programar(esperaReintento(Math.max(0, intentosRed - 1), aleatorio), sondear)
  }

  // Servidor saturado: no hace falta sondear /salud (responde), solo esperar y reintentar.
  function reintentoDirecto() {
    temporizador = null
    estado.proximoIntentoMs = null
    if (activo) drenar()
  }

  async function sondear() {
    temporizador = null
    estado.proximoIntentoMs = null
    if (!activo) return
    const r = await transporte.salud()
    if (r.status >= 200 && r.status < 300 && r.cuerpo?.ok !== false) {
      intentosRed = 0
      cambiar({ conexion: 'ok' })
      drenar()
    } else {
      intentosRed += 1
      programarSondeo()
    }
  }

  function marcarCaida() {
    intentosRed += 1
    cambiar({ conexion: 'caida' })
    programarSondeo()
  }

  // -------------------------------------------------------------------------
  // Pedir el expediente vigente al servidor
  // -------------------------------------------------------------------------

  // Devuelve { resultado: 'ok' | 'red' | 'sesion' | 'otro', mensaje? }.
  async function refrescar() {
    const [rExpediente, rConfig] = await Promise.all([transporte.obtenerExpediente(), transporte.obtenerConfig()])
    const c = clasificarRespuesta(rExpediente)
    if (c.clase === 'ok') {
      const cfg = clasificarRespuesta(rConfig)
      // Sin configuración (documentos, catálogos) el formulario no se puede armar.
      if (cfg.clase !== 'ok' && !api.tieneConfig()) {
        return { resultado: cfg.clase === 'red' || cfg.clase === 'servidor' ? 'red' : 'otro', mensaje: cfg.mensaje }
      }
      await api.aplicarServidor(c.cuerpo, cfg.clase === 'ok' ? cfg.cuerpo : null)
      return { resultado: 'ok' }
    }
    if (c.clase === 'sesion') return { resultado: 'sesion' }
    if (c.clase === 'red' || c.clase === 'servidor' || c.clase === 'ocupado') return { resultado: 'red' }
    return { resultado: 'otro', mensaje: c.mensaje }
  }

  // -------------------------------------------------------------------------
  // Una operación
  // -------------------------------------------------------------------------

  async function enviarOperacion(op) {
    switch (op.tipo) {
      case TIPOS.GUARDAR:
        return transporte.guardar(op.cuerpo.datos, api.version())
      case TIPOS.SUBIR: {
        const bytes = await api.leerArchivo(op)
        if (!bytes) return { archivoIlegible: true }
        const archivo = new Blob([bytes], { type: op.cuerpo.mime || 'application/octet-stream' })
        return transporte.subir({
          clave: op.clave,
          archivo,
          nombre: op.cuerpo.nombre,
          fecha: op.cuerpo.fecha,
          idem: op.cuerpo.idem, // la MISMA llave en cada reintento
        })
      }
      case TIPOS.FECHA:
        return transporte.corregirFecha(op.clave, op.cuerpo.fecha)
      case TIPOS.QUITAR:
        return transporte.quitar(op.clave)
      case TIPOS.ENVIAR:
        return transporte.enviar()
      default:
        return { status: 400, cuerpo: { detail: 'Operación desconocida.' } }
    }
  }

  // Devuelve 'ok' (se resolvió, bien o en «fallida»), 'red' o 'sesion'.
  async function procesar(op) {
    if (op.tipo === TIPOS.GUARDAR && (api.copiaVieja() || api.version() === null)) {
      const { resultado } = await refrescar()
      if (resultado === 'red') return 'red'
      if (resultado === 'sesion') return 'sesion'
    }
    let reaplicado = false
    for (;;) {
      const bruto = await enviarOperacion(op)
      if (bruto.archivoIlegible) {
        await api.fallar(op, { mensaje: MSJ_ARCHIVO_ILEGIBLE, status: 0 })
        return 'ok'
      }
      const r = clasificarRespuesta(bruto)
      switch (r.clase) {
        case 'ok':
          intentosRed = 0
          intentosOcupado = 0
          if (estado.conexion !== 'ok') estado.conexion = 'ok'
          if (estado.ocupado) estado.ocupado = null
          await api.completar(op, r.cuerpo)
          return 'ok'
        case 'red':
          return 'red'
        case 'ocupado':
          esperaOcupado = r.esperaMs
          return 'ocupado'
        case 'sesion':
          return 'sesion'
        case 'version':
          // 409 por versión: se toma el expediente vigente (`actual`) y se vuelve a enviar
          // SOLO lo que la persona cambió, una vez.
          if (!reaplicado) {
            reaplicado = true
            await api.aplicarServidor(r.actual, null)
            continue
          }
          await api.fallar(op, { mensaje: r.mensaje, status: r.status })
          return 'ok'
        case 'servidor': {
          const intentos = await api.contarIntentoServidor(op)
          if (intentos >= MAX_INTENTOS_SERVIDOR) {
            await api.fallar(op, { mensaje: r.mensaje, status: r.status })
            return 'ok'
          }
          return 'red'
        }
        default:
          await api.fallar(op, { mensaje: r.mensaje, status: r.status, errores: r.errores || null })
          return 'ok'
      }
    }
  }

  // -------------------------------------------------------------------------
  // Vaciado
  // -------------------------------------------------------------------------

  // Resultado: 'vacia' | 'bloqueada' (quedan fallidas) | 'red' | 'ocupado' | 'sesion' | 'detenido'
  async function vuelta() {
    if (!activo) return 'detenido'
    if (estado.sesion === 'vencida') return 'sesion'
    if (!api.hayToken()) {
      cambiar({ sesion: 'sin_token' })
      return 'sesion'
    }
    if (estado.sesion === 'sin_token') cambiar({ sesion: 'ok' })
    cambiar({ sincronizando: true })
    try {
      for (;;) {
        const op = await api.tomarSiguiente()
        if (!op) {
          if (api.copiaVieja()) {
            const { resultado } = await refrescar()
            if (resultado === 'red') {
              marcarCaida()
              return 'red'
            }
            if (resultado === 'sesion') {
              api.alSesionVencida()
              cambiar({ sesion: 'vencida' })
              return 'sesion'
            }
          }
          if (estado.conexion !== 'ok') estado.conexion = 'ok'
          return api.hayBloqueadas() ? 'bloqueada' : 'vacia'
        }
        let r
        try {
          r = await procesar(op)
        } finally {
          api.soltar(op)
        }
        if (r === 'red') {
          marcarCaida()
          return 'red'
        }
        if (r === 'ocupado') {
          cambiar({ ocupado: op.tipo === TIPOS.SUBIR ? 'SUBIR' : 'otro' })
          const espera = esperaOcupado ?? esperaReintento(intentosOcupado, aleatorio)
          intentosOcupado += 1
          esperaOcupado = null
          programar(espera, reintentoDirecto)
          return 'ocupado'
        }
        if (r === 'sesion') {
          api.alSesionVencida()
          cambiar({ sesion: 'vencida' })
          return 'sesion'
        }
      }
    } finally {
      cambiar({ sincronizando: false })
    }
  }

  // Vacía la cola. Si ya hay un vaciado en curso, se une a él (y pide otra vuelta por si
  // llegó algo nuevo). Devuelve cómo terminó.
  function drenar() {
    if (promesa) {
      otraVuelta = true
      return promesa
    }
    promesa = (async () => {
      let resultado
      try {
        do {
          otraVuelta = false
          cancelarTemporizador()
          resultado = await vuelta()
        } while (otraVuelta && resultado === 'vacia')
      } catch (error) {
        // Un fallo inesperado no debe dejar la cola colgada: se reintenta con espera.
        resultado = 'red'
        marcarCaida()
      } finally {
        promesa = null
      }
      return resultado
    })()
    return promesa
  }

  // Cualquier señal de que quizá ya hay conexión: se reinicia la espera y se vacía.
  function despertar() {
    if (!activo) return Promise.resolve('detenido')
    intentosRed = 0
    intentosOcupado = 0
    return drenar()
  }

  // Una acción de la persona (guardar, subir…) intenta enviar de inmediato SOLO si no se
  // viene de una falla de red: si la hubo, el sondeo de /salud decide cuándo reintentar.
  function alEncolar() {
    if (!activo || estado.sesion !== 'ok' || estado.conexion !== 'ok' || estado.ocupado) return
    drenar()
  }

  function reanudar() {
    cambiar({ sesion: 'ok' })
    return despertar()
  }

  function iniciar(entorno = {}) {
    if (activo) return
    activo = true
    const ventana = entorno.ventana ?? (typeof window !== 'undefined' ? window : null)
    const documento = entorno.documento ?? (typeof document !== 'undefined' ? document : null)
    if (ventana?.addEventListener) {
      const alConectar = () => {
        despertar()
      }
      const alDesconectar = () => cambiar({ conexion: 'caida' })
      ventana.addEventListener('online', alConectar)
      ventana.addEventListener('offline', alDesconectar)
      quitarEscuchas.push(() => ventana.removeEventListener('online', alConectar))
      quitarEscuchas.push(() => ventana.removeEventListener('offline', alDesconectar))
    }
    if (documento?.addEventListener) {
      const alVolver = () => {
        if (documento.visibilityState === 'visible') despertar()
      }
      documento.addEventListener('visibilitychange', alVolver)
      quitarEscuchas.push(() => documento.removeEventListener('visibilitychange', alVolver))
    }
  }

  function detener() {
    activo = false
    cancelarTemporizador()
    for (const quitar of quitarEscuchas) quitar()
    quitarEscuchas = []
    estado.sincronizando = false
    estado.conexion = 'ok'
    estado.sesion = 'ok'
    estado.ocupado = null
    intentosRed = 0
    intentosOcupado = 0
  }

  return {
    estado,
    iniciar,
    detener,
    drenar,
    despertar,
    alEncolar,
    refrescar,
    reanudar,
    marcarSesionVencida() {
      cambiar({ sesion: 'vencida' })
    },
    get activo() {
      return activo
    },
  }
}
